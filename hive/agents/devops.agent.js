#!/usr/bin/env node

const Redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../logger');

class DevOpsAgent {
  constructor() {
    this.agentId = 'agent-devops';
    this.logger = new Logger('agent-devops');
    this.status = 'idle';
    this.currentTask = null;
    this.redis = null;
    this.capabilities = {
      containers: ['Docker', 'docker-compose'],
      cicd: ['GitHub Actions', 'Jenkins', 'GitLab CI'],
      servers: ['Nginx', 'Apache', 'PM2'],
      monitoring: ['Prometheus', 'Grafana', 'ELK'],
      cloud: ['AWS', 'GCP', 'Azure']
    };
  }

  async initialize() {
    try {
      this.redis = Redis.createClient({
        host: 'localhost',
        port: 6379
      });

      await this.redis.connect();
      this.logger.info('DevOps Agent initialized');
      
      await this.subscribeToTasks();
      await this.reportStatus('ready');
    } catch (error) {
      this.logger.error('Failed to initialize', error);
      process.exit(1);
    }
  }

  async subscribeToTasks() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe('hive:tasks:devops', async (message) => {
      const task = JSON.parse(message);
      await this.handleTask(task);
    });
    
    this.logger.info('Subscribed to devops tasks');
  }

  async handleTask(task) {
    this.logger.info(`Received task: ${task.type}`, { taskId: task.id });
    this.currentTask = task;
    this.status = 'working';
    
    try {
      switch (task.type) {
        case 'create-dockerfile':
          await this.createDockerfile(task.params);
          break;
        case 'setup-nginx':
          await this.setupNginx(task.params);
          break;
        case 'create-pipeline':
          await this.createPipeline(task.params);
          break;
        case 'deploy-service':
          await this.deployService(task.params);
          break;
        case 'setup-monitoring':
          await this.setupMonitoring(task.params);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      await this.reportTaskComplete(task);
    } catch (error) {
      await this.reportTaskError(task, error);
    }
    
    this.currentTask = null;
    this.status = 'idle';
  }

  async createDockerfile(params) {
    const { service, baseImage, ports } = params;
    const dockerPath = '/home/avi/projects/ultimate/docker';
    
    await fs.mkdir(dockerPath, { recursive: true });
    
    const dockerfile = `FROM ${baseImage || 'node:18-alpine'}

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

${ports ? ports.map(p => `EXPOSE ${p}`).join('\n') : 'EXPOSE 3000'}

USER node

CMD ["npm", "start"]`;

    await fs.writeFile(path.join(dockerPath, `Dockerfile.${service}`), dockerfile);
    
    const dockerCompose = `version: '3.8'

services:
  ${service}:
    build:
      context: .
      dockerfile: Dockerfile.${service}
    ports:
      ${ports ? ports.map(p => `- "${p}:${p}"`).join('\n      ') : '- "3000:3000"'}
    environment:
      NODE_ENV: production
    restart: unless-stopped`;

    await fs.writeFile(path.join(dockerPath, `docker-compose.${service}.yml`), dockerCompose);
    
    this.logger.info(`Docker configuration created for ${service}`);
  }

  async setupNginx(params) {
    const { domain, upstream, ssl } = params;
    const nginxPath = '/home/avi/projects/ultimate/nginx';
    
    await fs.mkdir(nginxPath, { recursive: true });
    
    const nginxConfig = `server {
    listen 80;
    server_name ${domain};
    ${ssl ? 'return 301 https://$server_name$request_uri;' : ''}

    ${ssl ? '' : `location / {
        proxy_pass http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }`}
}

${ssl ? `server {
    listen 443 ssl http2;
    server_name ${domain};
    
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    
    location / {
        proxy_pass http://${upstream};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}` : ''}`;

    await fs.writeFile(path.join(nginxPath, `${domain}.conf`), nginxConfig);
    
    this.logger.info(`Nginx configuration created for ${domain}`);
  }

  async createPipeline(params) {
    const { type, stages } = params;
    const pipelinePath = '/home/avi/projects/ultimate/.github/workflows';
    
    await fs.mkdir(pipelinePath, { recursive: true });
    
    const pipelineConfig = `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          echo "Deploying to production"`;

    await fs.writeFile(path.join(pipelinePath, 'pipeline.yml'), pipelineConfig);
    
    this.logger.info('CI/CD pipeline created');
  }

  async deployService(params) {
    const { service, environment } = params;
    const deployPath = '/home/avi/projects/ultimate/deployments';
    
    await fs.mkdir(deployPath, { recursive: true });
    
    const deployScript = `#!/bin/bash
set -e

echo "Deploying ${service} to ${environment}"

# Build application
npm run build

# Run tests
npm test

# Build Docker image
docker build -t ${service}:latest .

# Deploy
docker-compose -f docker-compose.${environment}.yml up -d

echo "Deployment complete"`;

    await fs.writeFile(path.join(deployPath, `deploy-${service}.sh`), deployScript);
    await fs.chmod(path.join(deployPath, `deploy-${service}.sh`), 0o755);
    
    this.logger.info(`Deployment script created for ${service}`);
  }

  async setupMonitoring(params) {
    const { type, metrics } = params;
    const monitoringPath = '/home/avi/projects/ultimate/monitoring';
    
    await fs.mkdir(monitoringPath, { recursive: true });
    
    const prometheusConfig = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
  
  - job_name: 'application'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'`;

    await fs.writeFile(path.join(monitoringPath, 'prometheus.yml'), prometheusConfig);
    
    this.logger.info('Monitoring configuration created');
  }

  async reportStatus(status) {
    await this.redis.publish('hive:status', JSON.stringify({
      agentId: this.agentId,
      status,
      timestamp: new Date().toISOString(),
      capabilities: this.capabilities
    }));
  }

  async reportTaskComplete(task) {
    await this.redis.publish('hive:logs', JSON.stringify({
      agentId: this.agentId,
      taskId: task.id,
      status: 'completed',
      timestamp: new Date().toISOString()
    }));
    
    this.logger.info(`Task completed: ${task.id}`);
  }

  async reportTaskError(task, error) {
    await this.redis.publish('hive:alerts', JSON.stringify({
      agentId: this.agentId,
      taskId: task.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    this.logger.error(`Task failed: ${task.id}`, error);
  }

  async shutdown() {
    this.logger.info('Shutting down devops agent...');
    if (this.redis) {
      await this.redis.quit();
    }
    this.logger.close();
    process.exit(0);
  }
}

const agent = new DevOpsAgent();
agent.initialize().catch(console.error);

process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());