#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');
const redis = require('redis');
const fs = require('fs').promises;
const path = require('path');

class AgentScaler {
    constructor() {
        this.client = null;
        this.agents = new Map();
        this.metrics = {
            cpu: [],
            memory: [],
            queueLength: [],
            responseTime: []
        };
        this.scalingRules = {
            cpuThreshold: 80,
            memoryThreshold: 85,
            queueThreshold: 50,
            responseTimeThreshold: 5000,
            scaleUpCooldown: 60000,
            scaleDownCooldown: 300000
        };
        this.lastScaleAction = {
            up: 0,
            down: 0
        };
    }

    async initialize() {
        this.client = redis.createClient({
            socket: { host: 'localhost', port: 6379 }
        });
        
        await this.client.connect();
        
        // Load existing agents
        await this.loadAgentConfiguration();
        
        console.log('[AgentScaler] Initialized with auto-scaling capabilities');
    }

    async loadAgentConfiguration() {
        const configPath = path.join(__dirname, 'hive.config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        
        for (const agent of config.agents) {
            this.agents.set(agent.id, {
                ...agent,
                instances: [],
                minInstances: agent.minInstances || 1,
                maxInstances: agent.maxInstances || 5,
                currentInstances: 0
            });
        }
    }

    // Collect system metrics
    async collectMetrics() {
        const cpuUsage = this.getCPUUsage();
        const memoryUsage = this.getMemoryUsage();
        const queueLength = await this.getQueueLength();
        const avgResponseTime = await this.getAverageResponseTime();
        
        // Store metrics (keep last 10 data points)
        this.metrics.cpu.push(cpuUsage);
        this.metrics.memory.push(memoryUsage);
        this.metrics.queueLength.push(queueLength);
        this.metrics.responseTime.push(avgResponseTime);
        
        Object.keys(this.metrics).forEach(key => {
            if (this.metrics[key].length > 10) {
                this.metrics[key].shift();
            }
        });
        
        return {
            cpu: cpuUsage,
            memory: memoryUsage,
            queue: queueLength,
            responseTime: avgResponseTime
        };
    }

    getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        return 100 - ~~(100 * totalIdle / totalTick);
    }

    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        return Math.round((1 - free / total) * 100);
    }

    async getQueueLength() {
        const queues = ['critical', 'high', 'normal', 'low'];
        let totalLength = 0;
        
        for (const priority of queues) {
            const length = await this.client.lLen(`hive:queue:${priority}`);
            totalLength += length;
        }
        
        return totalLength;
    }

    async getAverageResponseTime() {
        // Get average task completion time from last 10 tasks
        const tasks = await this.client.hGetAll('hive:tasks');
        const completedTasks = Object.values(tasks)
            .map(t => JSON.parse(t))
            .filter(t => t.status === 'completed' && t.completedAt)
            .sort((a, b) => b.completedAt - a.completedAt)
            .slice(0, 10);
        
        if (completedTasks.length === 0) return 0;
        
        const totalTime = completedTasks.reduce((sum, task) => {
            return sum + (task.completedAt - task.startedAt);
        }, 0);
        
        return Math.round(totalTime / completedTasks.length);
    }

    // Analyze metrics and make scaling decisions
    async analyzeAndScale() {
        const currentMetrics = await this.collectMetrics();
        const now = Date.now();
        
        console.log(`[AgentScaler] Metrics - CPU: ${currentMetrics.cpu}%, Memory: ${currentMetrics.memory}%, Queue: ${currentMetrics.queue}, Response: ${currentMetrics.responseTime}ms`);
        
        // Check if we need to scale up
        if (this.shouldScaleUp(currentMetrics)) {
            if (now - this.lastScaleAction.up > this.scalingRules.scaleUpCooldown) {
                await this.scaleUp();
                this.lastScaleAction.up = now;
            }
        }
        
        // Check if we need to scale down
        else if (this.shouldScaleDown(currentMetrics)) {
            if (now - this.lastScaleAction.down > this.scalingRules.scaleDownCooldown) {
                await this.scaleDown();
                this.lastScaleAction.down = now;
            }
        }
    }

    shouldScaleUp(metrics) {
        // Scale up if any threshold is exceeded
        return (
            metrics.cpu > this.scalingRules.cpuThreshold ||
            metrics.memory > this.scalingRules.memoryThreshold ||
            metrics.queue > this.scalingRules.queueThreshold ||
            metrics.responseTime > this.scalingRules.responseTimeThreshold
        );
    }

    shouldScaleDown(metrics) {
        // Scale down if all metrics are well below thresholds
        return (
            metrics.cpu < this.scalingRules.cpuThreshold * 0.5 &&
            metrics.memory < this.scalingRules.memoryThreshold * 0.5 &&
            metrics.queue < this.scalingRules.queueThreshold * 0.3 &&
            metrics.responseTime < this.scalingRules.responseTimeThreshold * 0.5
        );
    }

    async scaleUp() {
        // Find agent type with highest load
        const agentToScale = await this.selectAgentToScale();
        
        if (!agentToScale) {
            console.log('[AgentScaler] No agents available for scaling up');
            return;
        }
        
        const agent = this.agents.get(agentToScale);
        
        if (agent.currentInstances >= agent.maxInstances) {
            console.log(`[AgentScaler] Agent ${agentToScale} already at max instances (${agent.maxInstances})`);
            return;
        }
        
        // Spawn new agent instance
        const instance = await this.spawnAgent(agent);
        
        if (instance) {
            agent.instances.push(instance);
            agent.currentInstances++;
            
            console.log(`[AgentScaler] Scaled up ${agentToScale} to ${agent.currentInstances} instances`);
            
            // Notify orchestrator
            await this.client.publish('hive:scaling', JSON.stringify({
                action: 'scale_up',
                agent: agentToScale,
                instances: agent.currentInstances
            }));
        }
    }

    async scaleDown() {
        // Find agent with lowest load and multiple instances
        const agentToScale = await this.selectAgentToScaleDown();
        
        if (!agentToScale) {
            console.log('[AgentScaler] No agents available for scaling down');
            return;
        }
        
        const agent = this.agents.get(agentToScale);
        
        if (agent.currentInstances <= agent.minInstances) {
            console.log(`[AgentScaler] Agent ${agentToScale} already at min instances (${agent.minInstances})`);
            return;
        }
        
        // Gracefully shutdown an instance
        const instance = agent.instances.pop();
        
        if (instance) {
            await this.gracefulShutdown(instance);
            agent.currentInstances--;
            
            console.log(`[AgentScaler] Scaled down ${agentToScale} to ${agent.currentInstances} instances`);
            
            // Notify orchestrator
            await this.client.publish('hive:scaling', JSON.stringify({
                action: 'scale_down',
                agent: agentToScale,
                instances: agent.currentInstances
            }));
        }
    }

    async selectAgentToScale() {
        // Get queue lengths per agent type
        const agentLoads = new Map();
        
        for (const [agentId, agent] of this.agents.entries()) {
            const queueLength = await this.client.lLen(`hive:${agentId}:queue`);
            agentLoads.set(agentId, queueLength);
        }
        
        // Find agent with highest load
        let maxLoad = 0;
        let selectedAgent = null;
        
        for (const [agentId, load] of agentLoads.entries()) {
            if (load > maxLoad) {
                maxLoad = load;
                selectedAgent = agentId;
            }
        }
        
        return selectedAgent;
    }

    async selectAgentToScaleDown() {
        // Find agent with multiple instances and lowest load
        let selectedAgent = null;
        let minLoad = Infinity;
        
        for (const [agentId, agent] of this.agents.entries()) {
            if (agent.currentInstances > agent.minInstances) {
                const queueLength = await this.client.lLen(`hive:${agentId}:queue`);
                
                if (queueLength < minLoad) {
                    minLoad = queueLength;
                    selectedAgent = agentId;
                }
            }
        }
        
        return selectedAgent;
    }

    async spawnAgent(agent) {
        const scriptPath = path.join(__dirname, 'agents', `${agent.name}.agent.js`);
        
        try {
            const child = spawn('node', [scriptPath], {
                detached: false,
                env: {
                    ...process.env,
                    AGENT_INSTANCE_ID: `${agent.id}-${Date.now()}`,
                    AGENT_SCALING_MODE: 'auto'
                }
            });
            
            child.stdout.on('data', (data) => {
                console.log(`[${agent.id}] ${data.toString().trim()}`);
            });
            
            child.stderr.on('data', (data) => {
                console.error(`[${agent.id}] ERROR: ${data.toString().trim()}`);
            });
            
            child.on('exit', (code) => {
                console.log(`[${agent.id}] Process exited with code ${code}`);
                // Remove from instances array
                const index = agent.instances.indexOf(child);
                if (index > -1) {
                    agent.instances.splice(index, 1);
                    agent.currentInstances--;
                }
            });
            
            return child;
        } catch (error) {
            console.error(`[AgentScaler] Failed to spawn agent: ${error.message}`);
            return null;
        }
    }

    async gracefulShutdown(instance) {
        // Send shutdown signal
        instance.kill('SIGTERM');
        
        // Wait for graceful shutdown (max 10 seconds)
        return new Promise((resolve) => {
            let timeout = setTimeout(() => {
                // Force kill if not shut down gracefully
                instance.kill('SIGKILL');
                resolve();
            }, 10000);
            
            instance.on('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    // Start auto-scaling monitor
    startMonitoring(interval = 30000) {
        setInterval(() => this.analyzeAndScale(), interval);
        console.log(`[AgentScaler] Monitoring started (interval: ${interval}ms)`);
    }

    // Get current scaling status
    getStatus() {
        const status = {
            agents: {},
            metrics: this.getAverageMetrics(),
            lastScaleAction: this.lastScaleAction
        };
        
        for (const [agentId, agent] of this.agents.entries()) {
            status.agents[agentId] = {
                current: agent.currentInstances,
                min: agent.minInstances,
                max: agent.maxInstances
            };
        }
        
        return status;
    }

    getAverageMetrics() {
        const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        
        return {
            cpu: Math.round(avg(this.metrics.cpu)),
            memory: Math.round(avg(this.metrics.memory)),
            queue: Math.round(avg(this.metrics.queueLength)),
            responseTime: Math.round(avg(this.metrics.responseTime))
        };
    }

    async cleanup() {
        // Shutdown all spawned instances
        for (const [_, agent] of this.agents.entries()) {
            for (const instance of agent.instances) {
                await this.gracefulShutdown(instance);
            }
        }
        
        await this.client.quit();
    }
}

module.exports = AgentScaler;

// Run standalone if executed directly
if (require.main === module) {
    const scaler = new AgentScaler();
    
    scaler.initialize().then(() => {
        scaler.startMonitoring();
        
        // API endpoint for status
        const express = require('express');
        const app = express();
        
        app.get('/scaling/status', (req, res) => {
            res.json(scaler.getStatus());
        });
        
        app.listen(9093, () => {
            console.log('[AgentScaler] Status API running on port 9093');
        });
    }).catch(console.error);
    
    process.on('SIGINT', async () => {
        await scaler.cleanup();
        process.exit(0);
    });
}