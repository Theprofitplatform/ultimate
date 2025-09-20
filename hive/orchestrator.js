#!/usr/bin/env node

/**
 * Hive Orchestrator
 * Coordinates all agents and manages workflow execution
 */

const Redis = require('redis');
const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class HiveOrchestrator {
  constructor() {
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
    console.log('[Orchestrator] Initializing Hive system...');
    
    // Load configuration
    await this.loadConfig();
    
    // Connect to Redis
    await this.connectRedis();
    
    // Setup Express server
    this.setupServer();
    
    // Setup WebSocket server
    this.setupWebSocket();
    
    // Subscribe to channels
    await this.subscribeToChannels();
    
    // Start server
    this.startServer();
    
    console.log('[Orchestrator] Hive system initialized successfully');
  }

  async loadConfig() {
    const configPath = path.join(__dirname, 'hive.config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    this.config = JSON.parse(configData);
  }

  async connectRedis() {
    this.redis = Redis.createClient({
      host: 'localhost',
      port: 6379
    });
    
    await this.redis.connect();
    console.log('[Orchestrator] Connected to Redis');
  }

  setupServer() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'dashboard')));
    
    // API Routes
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'active',
        agents: Array.from(this.agents.values()),
        activeTasks: this.tasks.size,
        workflows: Array.from(this.workflows.keys())
      });
    });
    
    this.app.post('/api/task', async (req, res) => {
      const task = await this.createTask(req.body);
      res.json({ taskId: task.id, status: 'queued' });
    });
    
    this.app.post('/api/workflow', async (req, res) => {
      const workflow = await this.startWorkflow(req.body.type, req.body.params);
      res.json({ workflowId: workflow.id, status: 'started' });
    });
    
    this.app.get('/api/agents', (req, res) => {
      res.json(Array.from(this.agents.values()));
    });
    
    this.app.get('/api/tasks/:id', (req, res) => {
      const task = this.tasks.get(req.params.id);
      res.json(task || { error: 'Task not found' });
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: 9092 });
    
    this.wss.on('connection', (ws) => {
      console.log('[Orchestrator] WebSocket client connected');
      
      ws.on('message', async (message) => {
        const data = JSON.parse(message);
        await this.handleWebSocketMessage(ws, data);
      });
      
      ws.on('close', () => {
        console.log('[Orchestrator] WebSocket client disconnected');
      });
    });
  }

  async handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Client subscribes to updates
        this.subscribeClient(ws, data.channels);
        break;
      case 'task':
        // Client submits a task
        const task = await this.createTask(data.payload);
        ws.send(JSON.stringify({ type: 'task-created', taskId: task.id }));
        break;
      case 'status':
        // Client requests status
        ws.send(JSON.stringify({
          type: 'status',
          data: {
            agents: Array.from(this.agents.values()),
            tasks: Array.from(this.tasks.values())
          }
        }));
        break;
    }
  }

  async subscribeToChannels() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    // Agent status updates
    await subscriber.subscribe('hive:status', (message) => {
      const status = JSON.parse(message);
      this.updateAgentStatus(status);
    });
    
    // Task logs
    await subscriber.subscribe('hive:logs', (message) => {
      const log = JSON.parse(message);
      this.handleTaskLog(log);
    });
    
    // Alerts
    await subscriber.subscribe('hive:alerts', (message) => {
      const alert = JSON.parse(message);
      this.handleAlert(alert);
    });
  }

  updateAgentStatus(status) {
    this.agents.set(status.agentId, {
      id: status.agentId,
      status: status.status,
      lastSeen: status.timestamp,
      capabilities: status.capabilities
    });
    
    // Broadcast to WebSocket clients
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
      }
    }
    
    // Broadcast to WebSocket clients
    this.broadcast({
      type: 'task-log',
      data: log
    });
  }

  handleAlert(alert) {
    console.error('[Orchestrator] Alert received:', alert);
    
    // Update task status if related to a task
    if (alert.taskId) {
      const task = this.tasks.get(alert.taskId);
      if (task) {
        task.status = 'failed';
        task.error = alert.error;
      }
    }
    
    // Broadcast to WebSocket clients
    this.broadcast({
      type: 'alert',
      data: alert
    });
    
    // Send notification (email/webhook)
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
    
    // Publish to appropriate agent channel
    const channel = `hive:tasks:${params.agent}`;
    await this.redis.publish(channel, JSON.stringify(task));
    
    console.log(`[Orchestrator] Task ${task.id} created for ${params.agent}`);
    
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
    
    // Execute workflow phases
    for (const phase of workflowConfig.phases) {
      console.log(`[Orchestrator] Starting workflow phase: ${phase.name}`);
      
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
      
      // Wait for phase completion if not parallel
      if (!phase.parallel) {
        await this.waitForTasks(phaseTasks.map(t => t.id));
      }
    }
    
    console.log(`[Orchestrator] Workflow ${workflow.id} started`);
    
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
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  async sendNotification(alert) {
    // Send to configured webhook
    if (this.config.monitoring?.alerting?.webhook) {
      try {
        const response = await fetch(this.config.monitoring.alerting.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
        
        if (!response.ok) {
          console.error('[Orchestrator] Failed to send webhook notification');
        }
      } catch (error) {
        console.error('[Orchestrator] Error sending notification:', error);
      }
    }
  }

  startServer() {
    this.app.listen(this.port, () => {
      console.log(`[Orchestrator] HTTP server running on port ${this.port}`);
      console.log(`[Orchestrator] WebSocket server running on port 8081`);
      console.log(`[Orchestrator] Dashboard available at http://localhost:${this.port}`);
    });
  }

  async shutdown() {
    console.log('[Orchestrator] Shutting down...');
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
    }
    
    process.exit(0);
  }
}

// Initialize orchestrator
const orchestrator = new HiveOrchestrator();
orchestrator.initialize().catch(console.error);

// Handle shutdown signals
process.on('SIGINT', () => orchestrator.shutdown());
process.on('SIGTERM', () => orchestrator.shutdown());