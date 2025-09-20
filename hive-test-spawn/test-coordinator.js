#!/usr/bin/env node

/**
 * Test Spawn Coordinator
 * Central coordination system for the Hive test spawn
 */

const ClaudeFlow = require('./claude-flow');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class TestCoordinator extends ClaudeFlow {
  constructor() {
    super({
      nodeId: 'test-coordinator',
      namespace: 'hive-test',
      capabilities: [
        'task-distribution',
        'agent-monitoring', 
        'consensus-coordination',
        'workflow-management',
        'resource-allocation'
      ]
    });
    
    this.config = null;
    this.agents = new Map();
    this.workflows = new Map();
    this.tasks = new Map();
    this.testResults = new Map();
    this.app = express();
    this.wss = null;
    this.isSpawnActive = false;
    
    this.setupEventHandlers();
  }

  async initialize() {
    console.log('[TestCoordinator] Initializing test spawn coordinator...');
    
    // Load configuration
    await this.loadConfig();
    
    // Initialize claude-flow
    await super.initialize();
    
    // Setup HTTP server
    this.setupHTTPServer();
    
    // Setup WebSocket server
    this.setupWebSocketServer();
    
    // Setup message handlers
    this.setupMessageHandlers();
    
    console.log('[TestCoordinator] Test coordinator initialized');
    
    return this;
  }

  async loadConfig() {
    const configPath = path.join(__dirname, 'test-spawn.config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    this.config = JSON.parse(configData);
  }

  setupEventHandlers() {
    this.on('ready', () => {
      console.log('[TestCoordinator] Coordinator ready for spawn activation');
    });
    
    this.on('agent-joined', (agentInfo) => {
      console.log(`[TestCoordinator] Agent joined: ${agentInfo.id}`);
      this.agents.set(agentInfo.id, {
        ...agentInfo,
        status: 'online',
        joinedAt: Date.now()
      });
      
      this.broadcast({
        type: 'agent-status-update',
        agent: agentInfo,
        status: 'online'
      });
    });
    
    this.on('agent-left', (agentId) => {
      console.log(`[TestCoordinator] Agent left: ${agentId}`);
      if (this.agents.has(agentId)) {
        this.agents.get(agentId).status = 'offline';
        this.broadcast({
          type: 'agent-status-update',
          agentId,
          status: 'offline'
        });
      }
    });
    
    this.on('workflow-completed', (workflowId, results) => {
      console.log(`[TestCoordinator] Workflow completed: ${workflowId}`);
      this.testResults.set(workflowId, {
        ...results,
        completedAt: Date.now()
      });
    });
  }

  setupHTTPServer() {
    this.app.use(express.json());
    
    // API Routes
    this.app.get('/api/spawn/status', (req, res) => {
      res.json({
        spawnId: this.config.spawn.id,
        active: this.isSpawnActive,
        agents: Array.from(this.agents.values()),
        workflows: Array.from(this.workflows.keys()),
        metrics: this.getMetrics()
      });
    });
    
    this.app.post('/api/spawn/activate', async (req, res) => {
      try {
        await this.activateSpawn();
        res.json({ status: 'activated', spawnId: this.config.spawn.id });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.app.post('/api/spawn/deactivate', async (req, res) => {
      try {
        await this.deactivateSpawn();
        res.json({ status: 'deactivated', spawnId: this.config.spawn.id });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.app.post('/api/workflow/start', async (req, res) => {
      try {
        const { workflowType } = req.body;
        const workflow = await this.startTestWorkflow(workflowType);
        res.json({ workflowId: workflow.id, status: 'started' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.app.get('/api/workflow/:id/status', (req, res) => {
      const workflow = this.workflows.get(req.params.id);
      if (workflow) {
        res.json(workflow);
      } else {
        res.status(404).json({ error: 'Workflow not found' });
      }
    });
    
    this.app.get('/api/test/results', (req, res) => {
      res.json(Array.from(this.testResults.values()));
    });
    
    // Start server
    const port = this.config.coordinator.port || 9093;
    this.app.listen(port, () => {
      console.log(`[TestCoordinator] HTTP server listening on port ${port}`);
    });
  }

  setupWebSocketServer() {
    const wsPort = this.config.coordinator.wsPort || 9094;
    this.wss = new WebSocket.Server({ port: wsPort });
    
    this.wss.on('connection', (ws) => {
      console.log('[TestCoordinator] WebSocket client connected');
      
      // Send current status
      ws.send(JSON.stringify({
        type: 'spawn-status',
        data: {
          spawnId: this.config.spawn.id,
          active: this.isSpawnActive,
          agents: Array.from(this.agents.values()),
          workflows: Array.from(this.workflows.keys())
        }
      }));
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message
          }));
        }
      });
    });
    
    console.log(`[TestCoordinator] WebSocket server listening on port ${wsPort}`);
  }

  async handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Client subscribes to updates
        break;
        
      case 'activate-spawn':
        await this.activateSpawn();
        ws.send(JSON.stringify({ type: 'spawn-activated' }));
        break;
        
      case 'start-workflow':
        const workflow = await this.startTestWorkflow(data.workflowType);
        ws.send(JSON.stringify({ 
          type: 'workflow-started', 
          workflowId: workflow.id 
        }));
        break;
        
      case 'get-agents':
        ws.send(JSON.stringify({
          type: 'agents-list',
          agents: Array.from(this.agents.values())
        }));
        break;
    }
  }

  setupMessageHandlers() {
    // Handle agent registration
    this.on('request', async (message) => {
      if (message.payload.type === 'agent-registration') {
        const agentInfo = message.payload.data;
        this.emit('agent-joined', agentInfo);
        
        await this.respond(message.id, message.from, {
          type: 'registration-success',
          coordinatorId: this.nodeId,
          spawnId: this.config.spawn.id
        });
      }
      
      if (message.payload.type === 'capability-query') {
        const capabilities = await this.getNodeCapabilities(message.from);
        await this.respond(message.id, message.from, {
          type: 'capability-response',
          capabilities
        });
      }
    });
    
    // Handle direct messages
    this.on('direct-message', (message) => {
      console.log(`[TestCoordinator] Direct message from ${message.from}:`, message.payload);
    });
    
    // Handle consensus proposals
    this.on('consensus-proposal', async (message) => {
      console.log(`[TestCoordinator] Consensus proposal from ${message.from}:`, message.payload);
      
      // Automatically vote 'yes' for test proposals
      setTimeout(() => {
        this.vote(message.id, 'yes');
      }, 1000);
    });
  }

  async activateSpawn() {
    console.log('[TestCoordinator] Activating test spawn...');
    
    this.isSpawnActive = true;
    
    // Broadcast spawn activation
    await this.broadcast({
      type: 'spawn-activated',
      spawnId: this.config.spawn.id,
      timestamp: Date.now()
    });
    
    // Wait for agents to join
    console.log('[TestCoordinator] Waiting for agents to join...');
    await this.waitForAgents();
    
    console.log('[TestCoordinator] Test spawn activated successfully');
    
    // Notify WebSocket clients
    this.broadcastToWebSocketClients({
      type: 'spawn-activated',
      agents: Array.from(this.agents.values())
    });
  }

  async waitForAgents(timeout = 30000) {
    const expectedAgents = Object.keys(this.config.agents).filter(id => id !== 'coordinator');
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const joinedAgents = Array.from(this.agents.keys()).filter(id => id !== this.nodeId);
      
      if (joinedAgents.length >= expectedAgents.length) {
        console.log('[TestCoordinator] All expected agents joined');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.warn('[TestCoordinator] Timeout waiting for all agents to join');
    return false;
  }

  async startTestWorkflow(workflowType) {
    const workflowConfig = this.config.testWorkflows[workflowType];
    if (!workflowConfig) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }
    
    const workflow = {
      id: uuidv4(),
      type: workflowType,
      config: workflowConfig,
      status: 'running',
      phases: [],
      startedAt: Date.now()
    };
    
    this.workflows.set(workflow.id, workflow);
    
    console.log(`[TestCoordinator] Starting test workflow: ${workflowType}`);
    
    // Execute workflow phases
    for (const phase of workflowConfig.phases) {
      console.log(`[TestCoordinator] Starting phase: ${phase.name}`);
      
      const phaseResult = await this.executePhase(workflow.id, phase);
      
      workflow.phases.push({
        name: phase.name,
        result: phaseResult,
        completedAt: Date.now()
      });
      
      if (!phaseResult.success && !phase.continueOnFailure) {
        workflow.status = 'failed';
        workflow.failedAt = Date.now();
        break;
      }
    }
    
    if (workflow.status === 'running') {
      workflow.status = 'completed';
      workflow.completedAt = Date.now();
    }
    
    this.emit('workflow-completed', workflow.id, workflow);
    
    return workflow;
  }

  async executePhase(workflowId, phase) {
    const tasks = [];
    
    for (const agentId of phase.agents) {
      for (const taskType of phase.tasks) {
        const task = {
          id: uuidv4(),
          workflowId,
          phase: phase.name,
          type: taskType,
          agentId,
          status: 'pending',
          createdAt: Date.now()
        };
        
        tasks.push(task);
        this.tasks.set(task.id, task);
      }
    }
    
    // Send tasks to agents
    const taskPromises = tasks.map(task => this.sendTaskToAgent(task));
    
    if (phase.parallel) {
      // Wait for all tasks to complete in parallel
      await Promise.all(taskPromises);
    } else {
      // Execute tasks sequentially
      for (const taskPromise of taskPromises) {
        await taskPromise;
      }
    }
    
    // Check results
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const failedTasks = tasks.filter(task => task.status === 'failed');
    
    return {
      success: failedTasks.length === 0,
      completed: completedTasks.length,
      failed: failedTasks.length,
      tasks: tasks
    };
  }

  async sendTaskToAgent(task) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        task.status = 'timeout';
        task.completedAt = Date.now();
        resolve(task);
      }, 60000);
      
      try {
        const response = await this.request(task.agentId, {
          type: 'execute-task',
          task: task
        });
        
        clearTimeout(timeout);
        task.status = response.success ? 'completed' : 'failed';
        task.result = response;
        task.completedAt = Date.now();
        resolve(task);
      } catch (error) {
        clearTimeout(timeout);
        task.status = 'error';
        task.error = error.message;
        task.completedAt = Date.now();
        resolve(task);
      }
    });
  }

  async deactivateSpawn() {
    console.log('[TestCoordinator] Deactivating test spawn...');
    
    this.isSpawnActive = false;
    
    // Broadcast spawn deactivation
    await this.broadcast({
      type: 'spawn-deactivated',
      spawnId: this.config.spawn.id,
      timestamp: Date.now()
    });
    
    console.log('[TestCoordinator] Test spawn deactivated');
    
    // Notify WebSocket clients
    this.broadcastToWebSocketClients({
      type: 'spawn-deactivated'
    });
  }

  broadcastToWebSocketClients(message) {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  generateSpawnReport() {
    const agents = Array.from(this.agents.values());
    const workflows = Array.from(this.workflows.values());
    const onlineAgents = agents.filter(a => a.status === 'online');
    
    return {
      spawnId: this.config.spawn.id,
      status: this.isSpawnActive ? 'active' : 'inactive',
      timestamp: Date.now(),
      
      agents: {
        total: agents.length,
        online: onlineAgents.length,
        offline: agents.length - onlineAgents.length,
        list: agents
      },
      
      workflows: {
        total: workflows.length,
        completed: workflows.filter(w => w.status === 'completed').length,
        failed: workflows.filter(w => w.status === 'failed').length,
        running: workflows.filter(w => w.status === 'running').length,
        list: workflows
      },
      
      communication: this.getMetrics(),
      
      testResults: Array.from(this.testResults.values())
    };
  }

  async shutdown() {
    console.log('[TestCoordinator] Shutting down test coordinator...');
    
    await this.deactivateSpawn();
    
    if (this.wss) {
      this.wss.close();
    }
    
    await super.shutdown();
  }
}

// Export for use in other modules
module.exports = TestCoordinator;

// Run coordinator if this file is executed directly
if (require.main === module) {
  const coordinator = new TestCoordinator();
  coordinator.initialize().catch(console.error);
  
  // Handle shutdown signals
  process.on('SIGINT', () => coordinator.shutdown());
  process.on('SIGTERM', () => coordinator.shutdown());
}