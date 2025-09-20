#!/usr/bin/env node

const redis = require('redis');
const express = require('express');
const WebSocket = require('ws');

class PerformanceAnalytics {
    constructor() {
        this.client = null;
        this.metrics = new Map();
        this.aggregatedMetrics = {
            hourly: new Map(),
            daily: new Map(),
            weekly: new Map()
        };
        this.alerts = [];
        this.thresholds = {
            errorRate: 0.05,
            avgResponseTime: 5000,
            taskBacklog: 100,
            agentUtilization: 0.9
        };
    }

    async initialize() {
        this.client = redis.createClient({
            socket: { host: 'localhost', port: 6379 }
        });
        
        await this.client.connect();
        
        // Subscribe to metric events
        const subscriber = this.client.duplicate();
        await subscriber.connect();
        
        await subscriber.subscribe('metrics:task', (message) => {
            this.processTaskMetric(JSON.parse(message));
        });
        
        await subscriber.subscribe('metrics:agent', (message) => {
            this.processAgentMetric(JSON.parse(message));
        });
        
        await subscriber.subscribe('metrics:system', (message) => {
            this.processSystemMetric(JSON.parse(message));
        });
        
        console.log('[PerformanceAnalytics] Initialized analytics engine');
    }

    // Process task completion metrics
    processTaskMetric(metric) {
        const { taskId, agent, type, startTime, endTime, status, error } = metric;
        
        const duration = endTime - startTime;
        const timestamp = new Date(endTime);
        const hour = timestamp.getHours();
        const day = timestamp.toDateString();
        
        // Update agent metrics
        if (!this.metrics.has(agent)) {
            this.metrics.set(agent, {
                tasksCompleted: 0,
                tasksFailed: 0,
                totalDuration: 0,
                avgDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                errorRate: 0,
                taskTypes: new Map(),
                hourlyDistribution: new Array(24).fill(0)
            });
        }
        
        const agentMetrics = this.metrics.get(agent);
        
        if (status === 'completed') {
            agentMetrics.tasksCompleted++;
            agentMetrics.totalDuration += duration;
            agentMetrics.avgDuration = agentMetrics.totalDuration / agentMetrics.tasksCompleted;
            agentMetrics.minDuration = Math.min(agentMetrics.minDuration, duration);
            agentMetrics.maxDuration = Math.max(agentMetrics.maxDuration, duration);
            agentMetrics.hourlyDistribution[hour]++;
            
            // Track task types
            const typeCount = agentMetrics.taskTypes.get(type) || 0;
            agentMetrics.taskTypes.set(type, typeCount + 1);
        } else {
            agentMetrics.tasksFailed++;
        }
        
        // Calculate error rate
        const totalTasks = agentMetrics.tasksCompleted + agentMetrics.tasksFailed;
        agentMetrics.errorRate = agentMetrics.tasksFailed / totalTasks;
        
        // Check for alerts
        this.checkAlerts(agent, agentMetrics);
        
        // Update aggregated metrics
        this.updateAggregatedMetrics(agent, metric);
    }

    // Process agent performance metrics
    processAgentMetric(metric) {
        const { agentId, cpu, memory, activeTasks, queueLength, timestamp } = metric;
        
        if (!this.metrics.has(agentId)) {
            this.metrics.set(agentId, {
                cpuHistory: [],
                memoryHistory: [],
                utilizationHistory: []
            });
        }
        
        const agentMetrics = this.metrics.get(agentId);
        
        // Keep last 100 data points
        agentMetrics.cpuHistory.push({ value: cpu, timestamp });
        agentMetrics.memoryHistory.push({ value: memory, timestamp });
        
        if (agentMetrics.cpuHistory.length > 100) {
            agentMetrics.cpuHistory.shift();
            agentMetrics.memoryHistory.shift();
        }
        
        // Calculate utilization
        const utilization = activeTasks / (activeTasks + queueLength || 1);
        agentMetrics.utilizationHistory.push({ value: utilization, timestamp });
        
        if (agentMetrics.utilizationHistory.length > 100) {
            agentMetrics.utilizationHistory.shift();
        }
    }

    // Process system-wide metrics
    processSystemMetric(metric) {
        const { totalAgents, totalTasks, queueDepth, timestamp } = metric;
        
        if (!this.metrics.has('system')) {
            this.metrics.set('system', {
                throughputHistory: [],
                queueDepthHistory: [],
                agentCountHistory: []
            });
        }
        
        const systemMetrics = this.metrics.get('system');
        
        systemMetrics.queueDepthHistory.push({ value: queueDepth, timestamp });
        systemMetrics.agentCountHistory.push({ value: totalAgents, timestamp });
        
        // Keep last 100 data points
        if (systemMetrics.queueDepthHistory.length > 100) {
            systemMetrics.queueDepthHistory.shift();
            systemMetrics.agentCountHistory.shift();
        }
    }

    // Update aggregated metrics for reporting
    updateAggregatedMetrics(agent, metric) {
        const timestamp = new Date(metric.endTime);
        const hour = `${timestamp.toDateString()}-${timestamp.getHours()}`;
        const day = timestamp.toDateString();
        const week = this.getWeekNumber(timestamp);
        
        // Update hourly metrics
        if (!this.aggregatedMetrics.hourly.has(hour)) {
            this.aggregatedMetrics.hourly.set(hour, {
                tasks: 0,
                errors: 0,
                totalDuration: 0
            });
        }
        
        const hourlyMetric = this.aggregatedMetrics.hourly.get(hour);
        hourlyMetric.tasks++;
        if (metric.status === 'failed') hourlyMetric.errors++;
        hourlyMetric.totalDuration += (metric.endTime - metric.startTime);
        
        // Similar updates for daily and weekly
        // ... (similar pattern for daily and weekly aggregation)
    }

    // Check for performance alerts
    checkAlerts(agent, metrics) {
        const alerts = [];
        
        // Check error rate
        if (metrics.errorRate > this.thresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                severity: 'high',
                agent,
                message: `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds threshold`,
                value: metrics.errorRate,
                threshold: this.thresholds.errorRate
            });
        }
        
        // Check response time
        if (metrics.avgDuration > this.thresholds.avgResponseTime) {
            alerts.push({
                type: 'response_time',
                severity: 'medium',
                agent,
                message: `Average response time ${metrics.avgDuration}ms exceeds threshold`,
                value: metrics.avgDuration,
                threshold: this.thresholds.avgResponseTime
            });
        }
        
        // Store and broadcast alerts
        for (const alert of alerts) {
            this.alerts.push({ ...alert, timestamp: Date.now() });
            this.broadcastAlert(alert);
        }
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }
    }

    // Broadcast alert via Redis pub/sub
    async broadcastAlert(alert) {
        await this.client.publish('hive:alerts', JSON.stringify(alert));
    }

    // Get performance report
    getPerformanceReport(agentId = null, timeRange = 'hour') {
        const report = {
            timestamp: Date.now(),
            timeRange,
            summary: {},
            agents: {},
            alerts: this.alerts.slice(-10)
        };
        
        // Calculate summary metrics
        let totalTasks = 0;
        let totalErrors = 0;
        let totalDuration = 0;
        
        for (const [id, metrics] of this.metrics.entries()) {
            if (id === 'system') continue;
            if (agentId && id !== agentId) continue;
            
            totalTasks += metrics.tasksCompleted || 0;
            totalErrors += metrics.tasksFailed || 0;
            totalDuration += metrics.totalDuration || 0;
            
            report.agents[id] = {
                tasksCompleted: metrics.tasksCompleted || 0,
                tasksFailed: metrics.tasksFailed || 0,
                errorRate: metrics.errorRate || 0,
                avgDuration: metrics.avgDuration || 0,
                minDuration: metrics.minDuration === Infinity ? 0 : metrics.minDuration,
                maxDuration: metrics.maxDuration || 0,
                taskTypes: Array.from(metrics.taskTypes || new Map()),
                hourlyDistribution: metrics.hourlyDistribution || []
            };
        }
        
        report.summary = {
            totalTasks,
            totalErrors,
            overallErrorRate: totalTasks > 0 ? totalErrors / totalTasks : 0,
            avgDuration: totalTasks > 0 ? totalDuration / totalTasks : 0,
            activeAgents: Object.keys(report.agents).length
        };
        
        return report;
    }

    // Get time-series data for charts
    getTimeSeriesData(metric, agentId = null, points = 50) {
        const data = [];
        
        if (agentId && this.metrics.has(agentId)) {
            const agentMetrics = this.metrics.get(agentId);
            
            switch (metric) {
                case 'cpu':
                    data.push(...(agentMetrics.cpuHistory || []).slice(-points));
                    break;
                case 'memory':
                    data.push(...(agentMetrics.memoryHistory || []).slice(-points));
                    break;
                case 'utilization':
                    data.push(...(agentMetrics.utilizationHistory || []).slice(-points));
                    break;
            }
        } else if (metric === 'throughput' || metric === 'queueDepth') {
            const systemMetrics = this.metrics.get('system');
            if (systemMetrics) {
                const history = metric === 'throughput' 
                    ? systemMetrics.throughputHistory 
                    : systemMetrics.queueDepthHistory;
                data.push(...(history || []).slice(-points));
            }
        }
        
        return data;
    }

    // Get agent comparison data
    getAgentComparison() {
        const comparison = [];
        
        for (const [agentId, metrics] of this.metrics.entries()) {
            if (agentId === 'system') continue;
            
            comparison.push({
                agent: agentId,
                tasksCompleted: metrics.tasksCompleted || 0,
                errorRate: metrics.errorRate || 0,
                avgDuration: metrics.avgDuration || 0,
                efficiency: this.calculateEfficiency(metrics)
            });
        }
        
        return comparison.sort((a, b) => b.efficiency - a.efficiency);
    }

    // Calculate agent efficiency score
    calculateEfficiency(metrics) {
        const completionRate = metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed || 1);
        const speedScore = Math.max(0, 1 - (metrics.avgDuration / this.thresholds.avgResponseTime));
        
        return (completionRate * 0.7 + speedScore * 0.3) * 100;
    }

    // Get week number for aggregation
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    // Start analytics API server
    startAPIServer(port = 9094) {
        const app = express();
        app.use(express.json());
        
        // Performance report endpoint
        app.get('/analytics/report', (req, res) => {
            const { agent, range } = req.query;
            res.json(this.getPerformanceReport(agent, range));
        });
        
        // Time series data endpoint
        app.get('/analytics/timeseries/:metric', (req, res) => {
            const { metric } = req.params;
            const { agent, points } = req.query;
            res.json(this.getTimeSeriesData(metric, agent, parseInt(points) || 50));
        });
        
        // Agent comparison endpoint
        app.get('/analytics/comparison', (req, res) => {
            res.json(this.getAgentComparison());
        });
        
        // Alerts endpoint
        app.get('/analytics/alerts', (req, res) => {
            const limit = parseInt(req.query.limit) || 20;
            res.json(this.alerts.slice(-limit));
        });
        
        // WebSocket for real-time updates
        const server = app.listen(port, () => {
            console.log(`[PerformanceAnalytics] API server running on port ${port}`);
        });
        
        const wss = new WebSocket.Server({ server, path: '/analytics/ws' });
        
        wss.on('connection', (ws) => {
            console.log('[PerformanceAnalytics] WebSocket client connected');
            
            // Send initial data
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.getPerformanceReport()
            }));
            
            // Set up real-time updates
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'update',
                        data: this.getPerformanceReport()
                    }));
                }
            }, 5000);
            
            ws.on('close', () => {
                clearInterval(interval);
            });
        });
    }

    async cleanup() {
        await this.client.quit();
    }
}

module.exports = PerformanceAnalytics;

// Run standalone if executed directly
if (require.main === module) {
    const analytics = new PerformanceAnalytics();
    
    analytics.initialize().then(() => {
        analytics.startAPIServer();
        
        console.log('[PerformanceAnalytics] Analytics engine running');
        console.log('API endpoints:');
        console.log('  - http://localhost:9094/analytics/report');
        console.log('  - http://localhost:9094/analytics/timeseries/:metric');
        console.log('  - http://localhost:9094/analytics/comparison');
        console.log('  - http://localhost:9094/analytics/alerts');
        console.log('  - ws://localhost:9094/analytics/ws');
    }).catch(console.error);
    
    process.on('SIGINT', async () => {
        await analytics.cleanup();
        process.exit(0);
    });
}