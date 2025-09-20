#!/usr/bin/env node

const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class TaskScheduler extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.pubClient = null;
        this.subClient = null;
        this.priorityQueues = {
            critical: 'hive:queue:critical',
            high: 'hive:queue:high',
            normal: 'hive:queue:normal',
            low: 'hive:queue:low'
        };
        this.taskDependencies = new Map();
        this.taskMetrics = new Map();
        this.scheduledTasks = new Map();
    }

    async initialize() {
        // Create Redis clients
        this.client = redis.createClient({
            socket: { host: 'localhost', port: 6379 },
            retry_strategy: (options) => Math.min(options.attempt * 100, 3000)
        });

        this.pubClient = this.client.duplicate();
        this.subClient = this.client.duplicate();

        // Connect all clients
        await Promise.all([
            this.client.connect(),
            this.pubClient.connect(),
            this.subClient.connect()
        ]);

        // Subscribe to task events
        await this.subClient.subscribe('task:completed', (message) => {
            this.handleTaskCompleted(JSON.parse(message));
        });

        await this.subClient.subscribe('task:failed', (message) => {
            this.handleTaskFailed(JSON.parse(message));
        });

        console.log('[TaskScheduler] Initialized with priority queues and dependency management');
    }

    // Schedule a task with priority and optional dependencies
    async scheduleTask(task, options = {}) {
        const {
            priority = 'normal',
            dependencies = [],
            delay = 0,
            retries = 3,
            timeout = 300000,
            cron = null
        } = options;

        const taskId = task.id || uuidv4();
        const enhancedTask = {
            ...task,
            id: taskId,
            priority,
            dependencies,
            retries,
            timeout,
            scheduledAt: Date.now(),
            status: 'pending',
            attempts: 0
        };

        // Store task metadata
        await this.client.hSet('hive:tasks', taskId, JSON.stringify(enhancedTask));

        // Handle cron scheduling
        if (cron) {
            this.scheduledTasks.set(taskId, {
                cron,
                task: enhancedTask,
                nextRun: this.calculateNextRun(cron)
            });
            return { taskId, scheduled: true, cron };
        }

        // Handle delayed execution
        if (delay > 0) {
            setTimeout(() => this.enqueueTask(enhancedTask), delay);
            return { taskId, delayed: true, delay };
        }

        // Handle dependencies
        if (dependencies.length > 0) {
            this.taskDependencies.set(taskId, {
                task: enhancedTask,
                waiting: new Set(dependencies),
                completed: new Set()
            });
            return { taskId, waitingFor: dependencies };
        }

        // Enqueue immediately
        await this.enqueueTask(enhancedTask);
        return { taskId, queued: true, priority };
    }

    // Enqueue task based on priority
    async enqueueTask(task) {
        const queue = this.priorityQueues[task.priority] || this.priorityQueues.normal;
        
        // Add to priority queue
        await this.client.lPush(queue, JSON.stringify(task));
        
        // Publish task event
        await this.pubClient.publish(`hive:${task.agent}:tasks`, JSON.stringify(task));
        
        // Track metrics
        this.updateMetrics('enqueued', task);
        
        console.log(`[TaskScheduler] Task ${task.id} enqueued with ${task.priority} priority`);
    }

    // Get next task for agent based on priority
    async getNextTask(agentId, capabilities = []) {
        // Check priority queues in order
        for (const priority of ['critical', 'high', 'normal', 'low']) {
            const queue = this.priorityQueues[priority];
            
            // Try to get a task from this priority level
            const taskData = await this.client.rPop(queue);
            
            if (taskData) {
                const task = JSON.parse(taskData);
                
                // Check if agent can handle this task
                if (this.canAgentHandleTask(task, capabilities)) {
                    // Mark task as assigned
                    task.assignedTo = agentId;
                    task.startedAt = Date.now();
                    task.status = 'in_progress';
                    
                    await this.client.hSet('hive:tasks', task.id, JSON.stringify(task));
                    
                    this.updateMetrics('assigned', task);
                    return task;
                } else {
                    // Re-queue task if agent can't handle it
                    await this.client.lPush(queue, taskData);
                }
            }
        }
        
        return null;
    }

    // Check if agent has required capabilities
    canAgentHandleTask(task, capabilities) {
        if (!task.requiredCapabilities) return true;
        
        return task.requiredCapabilities.every(cap => 
            capabilities.includes(cap)
        );
    }

    // Handle task completion
    async handleTaskCompleted(event) {
        const { taskId, result } = event;
        
        // Update task status
        const taskData = await this.client.hGet('hive:tasks', taskId);
        if (taskData) {
            const task = JSON.parse(taskData);
            task.status = 'completed';
            task.completedAt = Date.now();
            task.result = result;
            
            await this.client.hSet('hive:tasks', taskId, JSON.stringify(task));
            
            // Update metrics
            this.updateMetrics('completed', task);
            
            // Check for dependent tasks
            await this.processDependentTasks(taskId);
        }
    }

    // Handle task failure
    async handleTaskFailed(event) {
        const { taskId, error } = event;
        
        const taskData = await this.client.hGet('hive:tasks', taskId);
        if (taskData) {
            const task = JSON.parse(taskData);
            task.attempts++;
            
            if (task.attempts < task.retries) {
                // Retry with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, task.attempts), 30000);
                task.status = 'retrying';
                
                await this.client.hSet('hive:tasks', taskId, JSON.stringify(task));
                
                setTimeout(() => this.enqueueTask(task), delay);
                console.log(`[TaskScheduler] Retrying task ${taskId} (attempt ${task.attempts}/${task.retries})`);
            } else {
                // Mark as failed
                task.status = 'failed';
                task.failedAt = Date.now();
                task.error = error;
                
                await this.client.hSet('hive:tasks', taskId, JSON.stringify(task));
                
                // Update metrics
                this.updateMetrics('failed', task);
                
                // Notify dependent tasks
                await this.handleDependencyFailure(taskId);
            }
        }
    }

    // Process tasks waiting for dependencies
    async processDependentTasks(completedTaskId) {
        for (const [taskId, deps] of this.taskDependencies.entries()) {
            if (deps.waiting.has(completedTaskId)) {
                deps.waiting.delete(completedTaskId);
                deps.completed.add(completedTaskId);
                
                // If all dependencies satisfied, enqueue task
                if (deps.waiting.size === 0) {
                    await this.enqueueTask(deps.task);
                    this.taskDependencies.delete(taskId);
                    console.log(`[TaskScheduler] Dependencies satisfied for task ${taskId}`);
                }
            }
        }
    }

    // Handle failure of a dependency
    async handleDependencyFailure(failedTaskId) {
        for (const [taskId, deps] of this.taskDependencies.entries()) {
            if (deps.waiting.has(failedTaskId)) {
                // Cancel dependent task
                const task = deps.task;
                task.status = 'cancelled';
                task.cancelReason = `Dependency ${failedTaskId} failed`;
                
                await this.client.hSet('hive:tasks', taskId, JSON.stringify(task));
                this.taskDependencies.delete(taskId);
                
                console.log(`[TaskScheduler] Task ${taskId} cancelled due to dependency failure`);
            }
        }
    }

    // Update performance metrics
    updateMetrics(event, task) {
        const agentId = task.assignedTo || task.agent;
        
        if (!this.taskMetrics.has(agentId)) {
            this.taskMetrics.set(agentId, {
                enqueued: 0,
                assigned: 0,
                completed: 0,
                failed: 0,
                totalTime: 0,
                avgTime: 0
            });
        }
        
        const metrics = this.taskMetrics.get(agentId);
        metrics[event]++;
        
        if (event === 'completed' && task.startedAt) {
            const duration = task.completedAt - task.startedAt;
            metrics.totalTime += duration;
            metrics.avgTime = metrics.totalTime / metrics.completed;
        }
        
        this.emit('metrics:updated', { agentId, metrics });
    }

    // Get performance metrics
    getMetrics(agentId = null) {
        if (agentId) {
            return this.taskMetrics.get(agentId) || {};
        }
        
        // Return all metrics
        const allMetrics = {};
        for (const [id, metrics] of this.taskMetrics.entries()) {
            allMetrics[id] = metrics;
        }
        return allMetrics;
    }

    // Get queue statistics
    async getQueueStats() {
        const stats = {};
        
        for (const [priority, queue] of Object.entries(this.priorityQueues)) {
            const length = await this.client.lLen(queue);
            stats[priority] = length;
        }
        
        return stats;
    }

    // Calculate next run time for cron expression (simplified)
    calculateNextRun(cron) {
        // This is a simplified implementation
        // In production, use a library like node-cron
        const parts = cron.split(' ');
        const now = new Date();
        
        if (parts[0] === '*/5') {
            // Every 5 minutes
            return new Date(now.getTime() + 5 * 60 * 1000);
        } else if (parts[0] === '0' && parts[1] === '*/1') {
            // Every hour
            return new Date(now.getTime() + 60 * 60 * 1000);
        }
        
        // Default to 1 hour
        return new Date(now.getTime() + 60 * 60 * 1000);
    }

    // Process scheduled tasks
    async processScheduledTasks() {
        const now = Date.now();
        
        for (const [taskId, scheduled] of this.scheduledTasks.entries()) {
            if (scheduled.nextRun.getTime() <= now) {
                // Time to run this task
                await this.enqueueTask(scheduled.task);
                
                // Calculate next run
                scheduled.nextRun = this.calculateNextRun(scheduled.cron);
            }
        }
    }

    // Start scheduler daemon
    startScheduler() {
        // Process scheduled tasks every minute
        setInterval(() => this.processScheduledTasks(), 60000);
        
        console.log('[TaskScheduler] Scheduler daemon started');
    }

    // Cleanup
    async cleanup() {
        await this.client.quit();
        await this.pubClient.quit();
        await this.subClient.quit();
    }
}

// Export for use in orchestrator
module.exports = TaskScheduler;

// Run standalone if executed directly
if (require.main === module) {
    const scheduler = new TaskScheduler();
    
    scheduler.initialize().then(() => {
        scheduler.startScheduler();
        
        // Example usage
        scheduler.scheduleTask({
            type: 'build',
            agent: 'devops',
            params: { project: 'api' }
        }, {
            priority: 'high',
            dependencies: [],
            retries: 3
        });
        
        console.log('[TaskScheduler] Running as standalone service');
    }).catch(console.error);
    
    process.on('SIGINT', async () => {
        await scheduler.cleanup();
        process.exit(0);
    });
}