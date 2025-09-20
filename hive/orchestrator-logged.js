#!/usr/bin/env node

const Redis = require('redis');
const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('./logger');

class HiveOrchestrator {
  constructor() {
    this.logger = new Logger('orchestrator');
    this.config = null;
    this.redis = null;
    this.agents = new Map();
    this.tasks = new Map();
    this.workflows = new Map();
    this.app = express();
    this.wss = null;
    this.port = 9090;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Hive system...');
      
      await this.loadConfig();
      await this.connectRedis();
      this.setupServer();
      this.setupWebSocket();
      await this.subscribeToChannels();
      this.startServer();
      
      this.logger.info('Hive system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Hive system', error);
      process.exit(1);
    }
  }

  async loadConfig() {
    try {
      const configPath = path.join(__dirname, 'hive.config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.logger.info('Configuration loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw error;
    }
  }

  async connectRedis() {
    try {
      this.redis = Redis.createClient({
        host: 'localhost',
        port: 6379,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            this.logger.error('Redis connection refused', options.error);
            return new Error('Redis server is not running');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });
      
      this.redis.on('error', (error) => {
        this.logger.error('Redis error', error);
      });
      
      this.redis.on('ready', () => {
        this.logger.info('Connected to Redis');
      });
      
      this.redis.on('reconnecting', () => {
        this.logger.warn('Reconnecting to Redis...');
      });
      
      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  setupServer() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'dashboard')));
    
    this.app.use((req, res, next) => {
      this.logger.debug(`HTTP ${req.method} ${req.path}`, { 
        ip: req.ip, 
        query: req.query 
      });
      next();
    });
    
    this.app.get('/api/status', (req, res) => {
      const status = {
        status: 'active',
        agents: Array.from(this.agents.values()),
        activeTasks: this.tasks.size,
        workflows: Array.from(this.workflows.keys())
      };
      res.json(status);
      this.logger.debug('Status requested', status);
    });
    
    this.app.post('/api/task', async (req, res) => {
      try {
        const task = await this.createTask(req.body);
        res.json({ taskId: task.id, status: 'queued' });
        this.logger.info('Task created', { taskId: task.id, type: task.type });
      } catch (error) {
        this.logger.error('Failed to create task', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.app.post('/api/workflow', async (req, res) => {
      try {
        const workflow = await this.startWorkflow(req.body.type, req.body.params);
        res.json({ workflowId: workflow.id, status: 'started' });
        this.logger.info('Workflow started', { workflowId: workflow.id, type: req.body.type });
      } catch (error) {
        this.logger.error('Failed to start workflow', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.app.get('/api/agents', (req, res) => {
      res.json(Array.from(this.agents.values()));
    });
    
    this.app.get('/api/tasks/:id', (req, res) => {
      const task = this.tasks.get(req.params.id);
      res.json(task || { error: 'Task not found' });
    });
    
    this.logger.info('Express server configured');
  }

  setupWebSocket() {
    try {
      this.wss = new WebSocket.Server({ port: 9092 });
      
      this.wss.on('connection', (ws) => {
        this.logger.info('WebSocket client connected');
        
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message);
            await this.handleWebSocketMessage(ws, data);
          } catch (error) {
            this.logger.error('Failed to handle WebSocket message', error);
          }
        });
        
        ws.on('close', () => {
          this.logger.info('WebSocket client disconnected');
        });
        
        ws.on('error', (error) => {
          this.logger.error('WebSocket error', error);
        });
      });
      
      this.logger.info('WebSocket server configured on port 9092');
    } catch (error) {
      this.logger.error('Failed to setup WebSocket', error);
      throw error;
    }
  }

  async handleWebSocketMessage(ws, data) {
    this.logger.debug('WebSocket message received', { type: data.type });
    
    try {
      switch (data.type) {
        case 'subscribe':
          this.subscribeClient(ws, data.channels);
          break;
        case 'task':
          const task = await this.createTask(data.payload);
          ws.send(JSON.stringify({ type: 'task-created', taskId: task.id }));
          break;
        case 'status':
          ws.send(JSON.stringify({
            type: 'status',
            data: {
              agents: Array.from(this.agents.values()),
              tasks: Array.from(this.tasks.values())
            }
          }));
          break;
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message', error, { type: data.type });
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  async subscribeToChannels() {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe('hive:status', (message) => {
        try {
          const status = JSON.parse(message);
          this.updateAgentStatus(status);
        } catch (error) {
          this.logger.error('Failed to parse status message', error);
        }
      });
      
      await subscriber.subscribe('hive:logs', (message) => {
        try {
          const log = JSON.parse(message);
          this.handleTaskLog(log);
        } catch (error) {
          this.logger.error('Failed to parse log message', error);
        }
      });
      
      await subscriber.subscribe('hive:alerts', (message) => {
        try {
          const alert = JSON.parse(message);
          this.handleAlert(alert);
        } catch (error) {
          this.logger.error('Failed to parse alert message', error);
        }
      });
      
      this.logger.info('Subscribed to Redis channels');
    } catch (error) {
      this.logger.error('Failed to subscribe to channels', error);
      throw error;
    }
  }

  updateAgentStatus(status) {
    this.agents.set(status.agentId, {
      id: status.agentId,
      status: status.status,
      lastSeen: status.timestamp,
      capabilities: status.capabilities
    });
    
    this.logger.debug('Agent status updated', { agentId: status.agentId, status: status.status });
    
    this.broadcast({
      type: 'agent-status',
      data: status
    });
  }

  handleTaskLog(log) {
    const task = this.tasks.get(log.taskId);
    if (task) {
      task.logs = task.logs || [];
      task.logs.push(log);
      
      if (log.status === 'completed') {
        task.status = 'completed';
        task.completedAt = log.timestamp;
        this.logger.info('Task completed', { taskId: log.taskId });
      }
    }
    
    this.broadcast({
      type: 'task-log',
      data: log
    });
  }

  handleAlert(alert) {
    this.logger.warn('Alert received', alert);
    
    if (alert.taskId) {
      const task = this.tasks.get(alert.taskId);
      if (task) {
        task.status = 'failed';
        task.error = alert.error;
      }
    }
    
    this.broadcast({
      type: 'alert',
      data: alert
    });
    
    this.sendNotification(alert);
  }

  async createTask(params) {
    const task = {
      id: uuidv4(),
      type: params.type,
      params: params.params,
      agent: params.agent,
      priority: params.priority || 'normal',
      status: 'queued',
      createdAt: new Date().toISOString()
    };
    
    this.tasks.set(task.id, task);
    
    const channel = `hive:tasks:${params.agent}`;
    await this.redis.publish(channel, JSON.stringify(task));
    
    this.logger.info('Task created and published', { 
      taskId: task.id, 
      type: params.type, 
      agent: params.agent 
    });
    
    return task;
  }

  async startWorkflow(type, params) {
    const workflowConfig = this.config.workflows[type];
    if (!workflowConfig) {
      throw new Error(`Unknown workflow type: ${type}`);
    }
    
    const workflow = {
      id: uuidv4(),
      type,
      params,
      phases: [],
      status: 'running',
      startedAt: new Date().toISOString()
    };
    
    this.workflows.set(workflow.id, workflow);
    this.logger.info('Workflow initialized', { workflowId: workflow.id, type });
    
    for (const phase of workflowConfig.phases) {
      this.logger.info('Starting workflow phase', { 
        workflowId: workflow.id, 
        phase: phase.name 
      });
      
      const phaseTasks = [];
      
      for (const agentType of phase.agents) {
        const task = await this.createTask({
          type: `${type}-${phase.name}`,
          agent: agentType,
          params: { ...params, phase: phase.name }
        });
        
        phaseTasks.push(task);
      }
      
      workflow.phases.push({
        name: phase.name,
        tasks: phaseTasks,
        parallel: phase.parallel
      });
      
      if (!phase.parallel) {
        await this.waitForTasks(phaseTasks.map(t => t.id));
      }
    }
    
    this.logger.info('Workflow started successfully', { workflowId: workflow.id });
    
    return workflow;
  }

  async waitForTasks(taskIds) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const allCompleted = taskIds.every(id => {
          const task = this.tasks.get(id);
          return task && (task.status === 'completed' || task.status === 'failed');
        });
        
        if (allCompleted) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  broadcast(message) {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(message));
          } catch (error) {
            this.logger.error('Failed to broadcast message', error);
          }
        }
      });
    }
  }

  async sendNotification(alert) {
    if (this.config.monitoring?.alerting?.webhook) {
      try {
        const response = await fetch(this.config.monitoring.alerting.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
        
        if (!response.ok) {
          this.logger.error('Failed to send webhook notification', null, { 
            status: response.status 
          });
        }
      } catch (error) {
        this.logger.error('Error sending notification', error);
      }
    }
  }

  startServer() {
    this.app.listen(this.port, () => {
      this.logger.info(`HTTP server running on port ${this.port}`);
      this.logger.info(`WebSocket server running on port 9092`);
      this.logger.info(`Dashboard available at http://localhost:${this.port}`);
    });
  }

  async shutdown() {
    this.logger.info('Shutting down orchestrator...');
    
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    this.logger.info('Orchestrator shutdown complete');
    this.logger.close();
    
    process.exit(0);
  }
}

const orchestrator = new HiveOrchestrator();

orchestrator.initialize().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('SIGINT', () => orchestrator.shutdown());
process.on('SIGTERM', () => orchestrator.shutdown());
process.on('uncaughtException', (error) => {
  orchestrator.logger.error('Uncaught exception', error);
  orchestrator.shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  orchestrator.logger.error('Unhandled rejection', reason, { promise });
  orchestrator.shutdown();
});