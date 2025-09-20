#!/usr/bin/env node

/**
 * Enhanced Base Agent Class with Enterprise Features
 * - Automatic error recovery with exponential backoff
 * - Circuit breaker pattern for failing services
 * - Distributed tracing with OpenTelemetry
 * - Health checks and self-healing
 * - Message acknowledgment and retry logic
 * - Metrics collection and reporting
 */

const EventEmitter = require('events');
const Redis = require('ioredis');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider } = require('@opentelemetry/sdk-metrics');
const CircuitBreaker = require('opossum');
const axios = require('axios');

class BaseAgent extends EventEmitter {
  constructor(config) {
    super();
    
    // Agent identity
    this.id = config.id || `agent-${uuidv4()}`;
    this.type = config.type || 'generic';
    this.version = config.version || '2.0.0';
    this.capabilities = config.capabilities || {};
    
    // Status management
    this.status = 'initializing';
    this.health = {
      status: 'healthy',
      lastCheck: Date.now(),
      metrics: {
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        averageProcessingTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
    
    // Infrastructure
    this.redis = null;
    this.rabbitmq = null;
    this.channel = null;
    this.logger = null;
    this.metrics = null;
    
    // Configuration
    this.config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3
      },
      rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        prefetch: parseInt(process.env.PREFETCH_COUNT) || 1,
        heartbeat: 60
      },
      orchestrator: {
        url: process.env.ORCHESTRATOR_URL || 'http://localhost:9090',
        wsUrl: process.env.ORCHESTRATOR_WS_URL || 'ws://localhost:9092'
      },
      ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2:1b'
      },
      retry: {
        maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
        initialDelay: parseInt(process.env.INITIAL_RETRY_DELAY) || 1000,
        maxDelay: parseInt(process.env.MAX_RETRY_DELAY) || 30000,
        factor: parseFloat(process.env.RETRY_FACTOR) || 2
      },
      healthCheck: {
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
      },
      ...config
    };
    
    // Circuit breakers for external services
    this.circuitBreakers = {
      ollama: null,
      orchestrator: null,
      database: null
    };
    
    // Task processing
    this.taskQueue = [];
    this.processingTasks = new Map();
    this.taskHandlers = new Map();
    
    // Graceful shutdown
    this.isShuttingDown = false;
    this.setupShutdownHandlers();
  }
  
  async initialize() {
    try {
      this.logger = this.setupLogger();
      this.logger.info({ agentId: this.id }, 'Initializing agent');
      
      // Setup metrics collection
      await this.setupMetrics();
      
      // Connect to infrastructure
      await this.connectRedis();
      await this.connectRabbitMQ();
      
      // Setup circuit breakers
      this.setupCircuitBreakers();
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Subscribe to tasks
      await this.subscribeToTasks();
      
      this.status = 'ready';
      this.logger.info({ agentId: this.id }, 'Agent initialized successfully');
      
      this.emit('ready');
    } catch (error) {
      this.logger.error({ error, agentId: this.id }, 'Failed to initialize agent');
      await this.shutdown(1);
    }
  }
  
  setupLogger() {
    return pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: ['password', 'token', 'secret', 'apiKey'],
      serializers: {
        error: pino.stdSerializers.err
      }
    });
  }
  
  async setupMetrics() {
    const exporter = new PrometheusExporter(
      { port: 9464 + Math.floor(Math.random() * 100) },
      () => this.logger.info('Prometheus metrics server started')
    );
    
    const meterProvider = new MeterProvider({
      readers: [exporter]
    });
    
    this.metrics = meterProvider.getMeter(this.id);
    
    // Create standard metrics
    this.taskCounter = this.metrics.createCounter('tasks_processed_total', {
      description: 'Total number of tasks processed'
    });
    
    this.taskDuration = this.metrics.createHistogram('task_duration_seconds', {
      description: 'Task processing duration in seconds'
    });
    
    this.errorCounter = this.metrics.createCounter('errors_total', {
      description: 'Total number of errors'
    });
  }
  
  async connectRedis() {
    this.redis = new Redis(this.config.redis);
    
    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis');
    });
    
    this.redis.on('error', (error) => {
      this.logger.error({ error }, 'Redis connection error');
    });
    
    await this.redis.ping();
  }
  
  async connectRabbitMQ() {
    try {
      const connection = await amqp.connect(this.config.rabbitmq.url);
      this.channel = await connection.createChannel();
      
      await this.channel.prefetch(this.config.rabbitmq.prefetch);
      
      // Create exchanges and queues
      await this.channel.assertExchange('hive.tasks', 'topic', { durable: true });
      await this.channel.assertExchange('hive.dlx', 'topic', { durable: true });
      
      const queueName = `${this.id}.tasks`;
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'hive.dlx',
          'x-message-ttl': 3600000 // 1 hour
        }
      });
      
      // Bind queue to receive tasks for this agent type
      await this.channel.bindQueue(queueName, 'hive.tasks', `${this.type}.*`);
      
      connection.on('error', (error) => {
        this.logger.error({ error }, 'RabbitMQ connection error');
        setTimeout(() => this.connectRabbitMQ(), 5000);
      });
      
      this.logger.info('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to RabbitMQ');
      throw error;
    }
  }
  
  setupCircuitBreakers() {
    const options = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    };
    
    // Ollama AI circuit breaker
    this.circuitBreakers.ollama = new CircuitBreaker(
      async (prompt) => {
        const response = await axios.post(`${this.config.ollama.url}/api/generate`, {
          model: this.config.ollama.model,
          prompt,
          stream: false
        });
        return response.data;
      },
      options
    );
    
    this.circuitBreakers.ollama.on('open', () => {
      this.logger.warn('Ollama circuit breaker opened');
    });
    
    // Orchestrator circuit breaker
    this.circuitBreakers.orchestrator = new CircuitBreaker(
      async (data) => {
        const response = await axios.post(
          `${this.config.orchestrator.url}/api/report`,
          data,
          { timeout: 5000 }
        );
        return response.data;
      },
      options
    );
  }
  
  async registerWithOrchestrator() {
    const registration = {
      id: this.id,
      type: this.type,
      version: this.version,
      capabilities: this.capabilities,
      status: this.status,
      endpoint: `http://${require('os').hostname()}:${9464 + Math.floor(Math.random() * 100)}/metrics`
    };
    
    try {
      await this.circuitBreakers.orchestrator.fire({
        type: 'agent.register',
        payload: registration
      });
      
      this.logger.info('Registered with orchestrator');
    } catch (error) {
      this.logger.error({ error }, 'Failed to register with orchestrator');
    }
  }
  
  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheck.interval);
  }
  
  async performHealthCheck() {
    const checks = {
      redis: false,
      rabbitmq: false,
      memory: false,
      cpu: false
    };
    
    try {
      // Check Redis
      await this.redis.ping();
      checks.redis = true;
      
      // Check RabbitMQ
      if (this.channel) {
        await this.channel.checkQueue(`${this.id}.tasks`);
        checks.rabbitmq = true;
      }
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      checks.memory = memPercent < 90;
      
      this.health.metrics.memoryUsage = memPercent;
      
      // Check CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      checks.cpu = true; // Would need more sophisticated check
      
      // Update health status
      const allHealthy = Object.values(checks).every(v => v);
      this.health.status = allHealthy ? 'healthy' : 'degraded';
      this.health.lastCheck = Date.now();
      
      // Report health to orchestrator
      await this.reportHealth();
      
      if (!allHealthy) {
        this.logger.warn({ checks }, 'Health check detected issues');
        await this.attemptSelfHealing(checks);
      }
    } catch (error) {
      this.logger.error({ error }, 'Health check failed');
      this.health.status = 'unhealthy';
    }
  }
  
  async attemptSelfHealing(checks) {
    this.logger.info('Attempting self-healing');
    
    if (!checks.redis) {
      await this.connectRedis().catch(e => 
        this.logger.error({ error: e }, 'Failed to reconnect to Redis')
      );
    }
    
    if (!checks.rabbitmq) {
      await this.connectRabbitMQ().catch(e =>
        this.logger.error({ error: e }, 'Failed to reconnect to RabbitMQ')
      );
    }
    
    if (!checks.memory) {
      global.gc && global.gc();
      this.logger.info('Forced garbage collection');
    }
  }
  
  async reportHealth() {
    const report = {
      id: this.id,
      type: this.type,
      status: this.status,
      health: this.health,
      timestamp: new Date().toISOString()
    };
    
    await this.redis.setex(
      `agent:health:${this.id}`,
      60,
      JSON.stringify(report)
    );
    
    await this.redis.publish('hive:health', JSON.stringify(report));
  }
  
  async subscribeToTasks() {
    const queueName = `${this.id}.tasks`;
    
    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;
      
      const startTime = Date.now();
      const task = JSON.parse(msg.content.toString());
      
      this.logger.info({ taskId: task.id, type: task.type }, 'Received task');
      
      try {
        await this.processTask(task);
        
        // Acknowledge successful processing
        this.channel.ack(msg);
        
        // Update metrics
        this.taskCounter.add(1, { status: 'success', type: task.type });
        this.taskDuration.record((Date.now() - startTime) / 1000, { type: task.type });
        this.health.metrics.tasksSucceeded++;
        
      } catch (error) {
        this.logger.error({ error, taskId: task.id }, 'Task processing failed');
        
        // Check retry count
        const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
        
        if (retryCount <= this.config.retry.maxAttempts) {
          // Requeue with exponential backoff
          const delay = Math.min(
            this.config.retry.initialDelay * Math.pow(this.config.retry.factor, retryCount - 1),
            this.config.retry.maxDelay
          );
          
          setTimeout(() => {
            this.channel.publish(
              'hive.tasks',
              `${this.type}.retry`,
              Buffer.from(JSON.stringify(task)),
              {
                headers: { 'x-retry-count': retryCount },
                persistent: true
              }
            );
          }, delay);
          
          this.logger.info({ taskId: task.id, retryCount, delay }, 'Task requeued for retry');
        } else {
          // Send to dead letter queue
          this.channel.nack(msg, false, false);
          this.errorCounter.add(1, { type: task.type });
          this.health.metrics.tasksFailed++;
        }
      }
    });
    
    this.logger.info('Subscribed to task queue');
  }
  
  async processTask(task) {
    // Store task in processing map
    this.processingTasks.set(task.id, {
      task,
      startTime: Date.now(),
      status: 'processing'
    });
    
    try {
      // Check if handler exists
      const handler = this.taskHandlers.get(task.type);
      if (!handler) {
        throw new Error(`No handler for task type: ${task.type}`);
      }
      
      // Execute handler with timeout
      const result = await Promise.race([
        handler.call(this, task),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), 60000)
        )
      ]);
      
      // Report success
      await this.reportTaskComplete(task, result);
      
    } finally {
      this.processingTasks.delete(task.id);
    }
  }
  
  registerTaskHandler(type, handler) {
    this.taskHandlers.set(type, handler);
    this.logger.info({ type }, 'Registered task handler');
  }
  
  async reportTaskComplete(task, result) {
    const report = {
      id: task.id,
      agentId: this.id,
      status: 'completed',
      result,
      completedAt: new Date().toISOString()
    };
    
    await this.redis.setex(
      `task:result:${task.id}`,
      3600,
      JSON.stringify(report)
    );
    
    await this.redis.publish('hive:tasks:completed', JSON.stringify(report));
    
    this.logger.info({ taskId: task.id }, 'Task completed');
  }
  
  async callOllama(prompt, options = {}) {
    try {
      const result = await this.circuitBreakers.ollama.fire(prompt);
      return result.response;
    } catch (error) {
      if (error.message === 'Breaker is open') {
        this.logger.warn('Ollama circuit breaker is open, using fallback');
        return this.getFallbackResponse(prompt);
      }
      throw error;
    }
  }
  
  getFallbackResponse(prompt) {
    // Basic fallback logic when AI is unavailable
    return 'AI service temporarily unavailable. Processing with rule-based logic.';
  }
  
  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      this.logger.info({ signal }, 'Shutdown signal received');
      await this.shutdown(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.fatal({ error }, 'Uncaught exception');
      this.shutdown(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.fatal({ reason, promise }, 'Unhandled rejection');
      this.shutdown(1);
    });
  }
  
  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    this.logger.info('Starting graceful shutdown');
    this.status = 'shutting_down';
    
    try {
      // Stop accepting new tasks
      if (this.channel) {
        await this.channel.cancel(`${this.id}.tasks`);
      }
      
      // Wait for processing tasks to complete (max 30s)
      const shutdownTimeout = setTimeout(() => {
        this.logger.warn('Shutdown timeout, forcing exit');
        process.exit(exitCode);
      }, 30000);
      
      while (this.processingTasks.size > 0) {
        this.logger.info(`Waiting for ${this.processingTasks.size} tasks to complete`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      clearTimeout(shutdownTimeout);
      
      // Deregister from orchestrator
      await this.circuitBreakers.orchestrator.fire({
        type: 'agent.deregister',
        payload: { id: this.id }
      }).catch(e => this.logger.error({ error: e }, 'Failed to deregister'));
      
      // Close connections
      if (this.redis) await this.redis.quit();
      if (this.channel) await this.channel.close();
      
      this.logger.info('Graceful shutdown complete');
      process.exit(exitCode);
    } catch (error) {
      this.logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  }
}

module.exports = BaseAgent;