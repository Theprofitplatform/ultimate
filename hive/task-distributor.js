#!/usr/bin/env node

/**
 * Hive Task Distributor
 * Intelligent task distribution and load balancing
 */

const Redis = require('redis');
const { performance } = require('perf_hooks');

class TaskDistributor {
  constructor() {
    this.redis = null;
    this.agentLoads = new Map();
    this.taskQueue = [];
    this.taskHistory = new Map();
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageCompletionTime: 0
    };
  }

  async initialize() {
    console.log('[TaskDistributor] Initializing...');
    
    // Connect to Redis
    this.redis = Redis.createClient({
      host: 'localhost',
      port: 6379
    });
    
    await this.redis.connect();
    
    // Subscribe to task events
    await this.subscribeToEvents();
    
    // Start load balancer
    this.startLoadBalancer();
    
    // Start metrics collector
    this.startMetricsCollector();
    
    console.log('[TaskDistributor] Initialized successfully');
  }

  async subscribeToEvents() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    // New task requests
    await subscriber.subscribe('hive:task-request', async (message) => {
      const request = JSON.parse(message);
      await this.handleTaskRequest(request);
    });
    
    // Agent capacity updates
    await subscriber.subscribe('hive:agent-capacity', (message) => {
      const update = JSON.parse(message);
      this.updateAgentCapacity(update);
    });
    
    // Task completion events
    await subscriber.subscribe('hive:task-complete', (message) => {
      const completion = JSON.parse(message);
      this.handleTaskCompletion(completion);
    });
  }

  async handleTaskRequest(request) {
    console.log(`[TaskDistributor] Received task request: ${request.type}`);
    
    const task = {
      id: request.id,
      type: request.type,
      params: request.params,
      priority: request.priority || 'normal',
      requiredCapabilities: request.requiredCapabilities || [],
      estimatedDuration: this.estimateTaskDuration(request.type),
      requestedAt: Date.now()
    };
    
    // Find best agent for task
    const agent = await this.findBestAgent(task);
    
    if (agent) {
      await this.assignTask(task, agent);
    } else {
      // Queue task if no agent available
      this.queueTask(task);
    }
  }

  async findBestAgent(task) {
    // Get all available agents
    const agents = await this.getAvailableAgents();
    
    // Filter agents by required capabilities
    const capableAgents = agents.filter(agent => 
      this.hasRequiredCapabilities(agent, task.requiredCapabilities)
    );
    
    if (capableAgents.length === 0) {
      return null;
    }
    
    // Score agents based on multiple factors
    const scoredAgents = capableAgents.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, task)
    }));
    
    // Sort by score (higher is better)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    return scoredAgents[0]?.agent;
  }

  calculateAgentScore(agent, task) {
    let score = 100;
    
    // Factor 1: Current load (lower is better)
    const load = this.agentLoads.get(agent.id) || 0;
    score -= load * 10;
    
    // Factor 2: Specialization match
    if (agent.specialization?.includes(task.type)) {
      score += 20;
    }
    
    // Factor 3: Historical performance
    const history = this.getAgentHistory(agent.id, task.type);
    if (history) {
      score += history.successRate * 10;
      score -= history.averageTime / 1000; // Penalty for slow completion
    }
    
    // Factor 4: Priority boost
    if (task.priority === 'high') {
      score += 15;
    } else if (task.priority === 'low') {
      score -= 10;
    }
    
    return score;
  }

  hasRequiredCapabilities(agent, requiredCapabilities) {
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }
    
    const agentCapabilities = agent.capabilities || {};
    
    return requiredCapabilities.every(req => {
      // Check if agent has the capability category
      for (const [category, capabilities] of Object.entries(agentCapabilities)) {
        if (Array.isArray(capabilities) && capabilities.includes(req)) {
          return true;
        }
      }
      return false;
    });
  }

  async assignTask(task, agent) {
    console.log(`[TaskDistributor] Assigning task ${task.id} to agent ${agent.id}`);
    
    // Update agent load
    const currentLoad = this.agentLoads.get(agent.id) || 0;
    this.agentLoads.set(agent.id, currentLoad + 1);
    
    // Record assignment
    task.assignedTo = agent.id;
    task.assignedAt = Date.now();
    
    // Store task in history
    this.taskHistory.set(task.id, task);
    
    // Publish to agent's task channel
    const channel = `hive:tasks:${agent.type}`;
    await this.redis.publish(channel, JSON.stringify(task));
    
    // Update metrics
    this.metrics.totalTasks++;
    
    // Broadcast assignment
    await this.redis.publish('hive:task-assigned', JSON.stringify({
      taskId: task.id,
      agentId: agent.id,
      timestamp: new Date().toISOString()
    }));
  }

  queueTask(task) {
    console.log(`[TaskDistributor] Queueing task ${task.id} (no available agents)`);
    
    // Add to priority queue
    if (task.priority === 'high') {
      this.taskQueue.unshift(task);
    } else {
      this.taskQueue.push(task);
    }
    
    // Set timeout for task reassignment
    setTimeout(() => this.processQueuedTasks(), 5000);
  }

  async processQueuedTasks() {
    if (this.taskQueue.length === 0) {
      return;
    }
    
    console.log(`[TaskDistributor] Processing ${this.taskQueue.length} queued tasks`);
    
    const processedTasks = [];
    
    for (const task of this.taskQueue) {
      const agent = await this.findBestAgent(task);
      
      if (agent) {
        await this.assignTask(task, agent);
        processedTasks.push(task);
      }
    }
    
    // Remove processed tasks from queue
    this.taskQueue = this.taskQueue.filter(t => !processedTasks.includes(t));
  }

  handleTaskCompletion(completion) {
    const task = this.taskHistory.get(completion.taskId);
    
    if (!task) {
      return;
    }
    
    // Update agent load
    const currentLoad = this.agentLoads.get(task.assignedTo) || 1;
    this.agentLoads.set(task.assignedTo, Math.max(0, currentLoad - 1));
    
    // Update metrics
    if (completion.status === 'completed') {
      this.metrics.completedTasks++;
    } else {
      this.metrics.failedTasks++;
    }
    
    // Calculate completion time
    const completionTime = Date.now() - task.assignedAt;
    this.updateAverageCompletionTime(completionTime);
    
    // Update agent history
    this.updateAgentHistory(task.assignedTo, task.type, completion.status, completionTime);
    
    // Process queued tasks
    this.processQueuedTasks();
  }

  updateAgentCapacity(update) {
    const { agentId, capacity } = update;
    
    // Store capacity information
    if (!this.agentCapacities) {
      this.agentCapacities = new Map();
    }
    
    this.agentCapacities.set(agentId, capacity);
    
    // Process queued tasks if capacity increased
    if (capacity > (this.agentLoads.get(agentId) || 0)) {
      this.processQueuedTasks();
    }
  }

  updateAverageCompletionTime(newTime) {
    const total = this.metrics.completedTasks + this.metrics.failedTasks;
    
    if (total === 0) {
      this.metrics.averageCompletionTime = newTime;
    } else {
      this.metrics.averageCompletionTime = 
        (this.metrics.averageCompletionTime * (total - 1) + newTime) / total;
    }
  }

  updateAgentHistory(agentId, taskType, status, completionTime) {
    if (!this.agentHistories) {
      this.agentHistories = new Map();
    }
    
    const key = `${agentId}:${taskType}`;
    let history = this.agentHistories.get(key);
    
    if (!history) {
      history = {
        totalTasks: 0,
        successfulTasks: 0,
        totalTime: 0,
        successRate: 0,
        averageTime: 0
      };
    }
    
    history.totalTasks++;
    history.totalTime += completionTime;
    
    if (status === 'completed') {
      history.successfulTasks++;
    }
    
    history.successRate = history.successfulTasks / history.totalTasks;
    history.averageTime = history.totalTime / history.totalTasks;
    
    this.agentHistories.set(key, history);
  }

  getAgentHistory(agentId, taskType) {
    if (!this.agentHistories) {
      return null;
    }
    
    const key = `${agentId}:${taskType}`;
    return this.agentHistories.get(key);
  }

  async getAvailableAgents() {
    // Get agent status from Redis
    const agentData = await this.redis.get('hive:agents:status');
    
    if (!agentData) {
      return [];
    }
    
    const agents = JSON.parse(agentData);
    
    // Filter for available agents
    return agents.filter(agent => 
      agent.status === 'ready' || agent.status === 'idle'
    );
  }

  estimateTaskDuration(taskType) {
    // Estimate based on historical data
    const estimates = {
      'create-component': 30000,      // 30 seconds
      'setup-dashboard': 60000,        // 1 minute
      'implement-sse': 45000,          // 45 seconds
      'run-tests': 120000,             // 2 minutes
      'database-migration': 90000,     // 1.5 minutes
      'deploy': 180000,                // 3 minutes
      'default': 60000                 // 1 minute default
    };
    
    return estimates[taskType] || estimates.default;
  }

  startLoadBalancer() {
    setInterval(() => {
      this.rebalanceTasks();
    }, 30000); // Rebalance every 30 seconds
  }

  async rebalanceTasks() {
    // Get current load distribution
    const loads = Array.from(this.agentLoads.entries());
    
    if (loads.length < 2) {
      return; // Need at least 2 agents to rebalance
    }
    
    // Calculate average load
    const totalLoad = loads.reduce((sum, [, load]) => sum + load, 0);
    const avgLoad = totalLoad / loads.length;
    
    // Find overloaded and underloaded agents
    const overloaded = loads.filter(([, load]) => load > avgLoad * 1.5);
    const underloaded = loads.filter(([, load]) => load < avgLoad * 0.5);
    
    if (overloaded.length > 0 && underloaded.length > 0) {
      console.log('[TaskDistributor] Rebalancing tasks...');
      // Implement task migration logic here if needed
    }
  }

  startMetricsCollector() {
    setInterval(async () => {
      // Publish metrics
      await this.redis.publish('hive:metrics', JSON.stringify({
        type: 'task-distributor',
        metrics: this.metrics,
        agentLoads: Array.from(this.agentLoads.entries()),
        queueLength: this.taskQueue.length,
        timestamp: new Date().toISOString()
      }));
    }, 10000); // Every 10 seconds
  }

  async shutdown() {
    console.log('[TaskDistributor] Shutting down...');
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    process.exit(0);
  }
}

// Initialize distributor
const distributor = new TaskDistributor();
distributor.initialize().catch(console.error);

// Handle shutdown
process.on('SIGINT', () => distributor.shutdown());
process.on('SIGTERM', () => distributor.shutdown());