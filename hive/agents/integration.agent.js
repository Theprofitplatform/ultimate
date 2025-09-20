#!/usr/bin/env node

const Redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../logger');

class IntegrationAgent {
  constructor() {
    this.agentId = 'agent-integration';
    this.logger = new Logger('agent-integration');
    this.status = 'idle';
    this.currentTask = null;
    this.redis = null;
    this.capabilities = {
      oauth: ['Google', 'GitHub', 'Microsoft'],
      apis: ['REST', 'GraphQL', 'SOAP', 'WebSocket'],
      workflows: ['N8N', 'Zapier', 'Make'],
      webhooks: ['Incoming', 'Outgoing', 'Bidirectional'],
      formats: ['JSON', 'XML', 'CSV', 'Protocol Buffers']
    };
  }

  async initialize() {
    try {
      this.redis = Redis.createClient({
        host: 'localhost',
        port: 6379
      });

      await this.redis.connect();
      this.logger.info('Integration Agent initialized');
      
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
    
    await subscriber.subscribe('hive:tasks:integration', async (message) => {
      const task = JSON.parse(message);
      await this.handleTask(task);
    });
    
    this.logger.info('Subscribed to integration tasks');
  }

  async handleTask(task) {
    this.logger.info(`Received task: ${task.type}`, { taskId: task.id });
    this.currentTask = task;
    this.status = 'working';
    
    try {
      switch (task.type) {
        case 'setup-oauth':
          await this.setupOAuth(task.params);
          break;
        case 'create-webhook':
          await this.createWebhook(task.params);
          break;
        case 'setup-n8n':
          await this.setupN8N(task.params);
          break;
        case 'google-integration':
          await this.googleIntegration(task.params);
          break;
        case 'api-connector':
          await this.createAPIConnector(task.params);
          break;
        default:
          this.logger.warn(`Unknown task type: ${task.type}, treating as generic`);
          await this.handleGenericTask(task);
      }
      
      await this.reportTaskComplete(task);
    } catch (error) {
      await this.reportTaskError(task, error);
    }
    
    this.currentTask = null;
    this.status = 'idle';
  }

  async setupOAuth(params) {
    const { provider, scopes } = params;
    const oauthPath = '/home/avi/projects/ultimate/integrations/oauth';
    
    await fs.mkdir(oauthPath, { recursive: true });
    
    const oauthConfig = `const { OAuth2Client } = require('google-auth-library');

class ${provider}OAuth {
  constructor() {
    this.client = new OAuth2Client(
      process.env.${provider.toUpperCase()}_CLIENT_ID,
      process.env.${provider.toUpperCase()}_CLIENT_SECRET,
      process.env.${provider.toUpperCase()}_REDIRECT_URI
    );
    this.scopes = ${JSON.stringify(scopes)};
  }

  generateAuthUrl(state) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state: state,
      prompt: 'consent'
    });
  }

  async getTokens(code) {
    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);
    return tokens;
  }

  async refreshToken(refreshToken) {
    this.client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.client.refreshAccessToken();
    return credentials;
  }
}

module.exports = ${provider}OAuth;`;

    await fs.writeFile(path.join(oauthPath, `${provider.toLowerCase()}.oauth.js`), oauthConfig);
    
    this.logger.info(`OAuth setup complete for ${provider}`);
  }

  async createWebhook(params) {
    const { name, endpoint, events } = params;
    const webhookPath = '/home/avi/projects/ultimate/integrations/webhooks';
    
    await fs.mkdir(webhookPath, { recursive: true });
    
    const webhookCode = `const express = require('express');
const crypto = require('crypto');

class ${name}Webhook {
  constructor() {
    this.router = express.Router();
    this.events = ${JSON.stringify(events)};
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.post('${endpoint}', this.handleWebhook.bind(this));
  }

  verifySignature(payload, signature) {
    const secret = process.env.WEBHOOK_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async handleWebhook(req, res) {
    const signature = req.headers['x-webhook-signature'];
    
    if (!this.verifySignature(JSON.stringify(req.body), signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event = req.body.event;
    if (!this.events.includes(event)) {
      return res.status(400).json({ error: 'Unknown event type' });
    }
    
    await this.processEvent(event, req.body.data);
    res.status(200).json({ received: true });
  }

  async processEvent(event, data) {
    console.log(\`Processing \${event} event\`, data);
    // Process webhook event
  }
}

module.exports = ${name}Webhook;`;

    await fs.writeFile(path.join(webhookPath, `${name.toLowerCase()}.webhook.js`), webhookCode);
    
    this.logger.info(`Webhook created: ${name} at ${endpoint}`);
  }

  async setupN8N(params) {
    const { workflows } = params;
    const n8nPath = '/home/avi/projects/ultimate/integrations/n8n';
    
    await fs.mkdir(n8nPath, { recursive: true });
    
    for (const workflow of workflows) {
      const workflowConfig = {
        name: workflow.name,
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        settings: {
          executionOrder: 'v1'
        }
      };
      
      await fs.writeFile(
        path.join(n8nPath, `${workflow.name.toLowerCase()}.json`),
        JSON.stringify(workflowConfig, null, 2)
      );
    }
    
    this.logger.info(`N8N workflows configured: ${workflows.length}`);
  }

  async googleIntegration(params) {
    const { services } = params;
    const googlePath = '/home/avi/projects/ultimate/integrations/google';
    
    await fs.mkdir(googlePath, { recursive: true });
    
    const googleService = `const { google } = require('googleapis');

class GoogleIntegration {
  constructor(auth) {
    this.auth = auth;
    this.services = {
      ${services.map(s => `${s}: google.${s}({ version: 'v${s === 'sheets' ? 4 : 3}', auth: this.auth })`).join(',\n      ')}
    };
  }

  async getDriveFiles(folderId) {
    const response = await this.services.drive.files.list({
      q: \`'\${folderId}' in parents\`,
      fields: 'files(id, name, mimeType)'
    });
    return response.data.files;
  }

  async readSheet(spreadsheetId, range) {
    const response = await this.services.sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    return response.data.values;
  }

  async updateSheet(spreadsheetId, range, values) {
    const response = await this.services.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    return response.data;
  }
}

module.exports = GoogleIntegration;`;

    await fs.writeFile(path.join(googlePath, 'google.integration.js'), googleService);
    
    this.logger.info(`Google integration setup for services: ${services.join(', ')}`);
  }

  async createAPIConnector(params) {
    const { name, baseUrl, auth } = params;
    const connectorPath = '/home/avi/projects/ultimate/integrations/connectors';
    
    await fs.mkdir(connectorPath, { recursive: true });
    
    const connectorCode = `const axios = require('axios');

class ${name}Connector {
  constructor() {
    this.client = axios.create({
      baseURL: '${baseUrl}',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    ${auth.type === 'bearer' ? `this.client.defaults.headers.common['Authorization'] = \`Bearer \${process.env.${name.toUpperCase()}_TOKEN}\`;` : ''}
    ${auth.type === 'apikey' ? `this.client.defaults.headers.common['${auth.header}'] = process.env.${name.toUpperCase()}_API_KEY;` : ''}
  }

  async get(endpoint, params = {}) {
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  async post(endpoint, data) {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }

  async put(endpoint, data) {
    const response = await this.client.put(endpoint, data);
    return response.data;
  }

  async delete(endpoint) {
    const response = await this.client.delete(endpoint);
    return response.data;
  }
}

module.exports = ${name}Connector;`;

    await fs.writeFile(path.join(connectorPath, `${name.toLowerCase()}.connector.js`), connectorCode);
    
    this.logger.info(`API connector created for ${name}`);
  }

  async handleGenericTask(task) {
    this.logger.info(`Handling generic task for workflow phase: ${task.params?.phase}`);
    
    const integrationPath = '/home/avi/projects/ultimate/integrations';
    await fs.mkdir(integrationPath, { recursive: true });
    
    const taskReport = {
      taskId: task.id,
      type: task.type,
      phase: task.params?.phase,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(integrationPath, `task_${task.id}.json`),
      JSON.stringify(taskReport, null, 2)
    );
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
    this.logger.info('Shutting down integration agent...');
    if (this.redis) {
      await this.redis.quit();
    }
    this.logger.close();
    process.exit(0);
  }
}

const agent = new IntegrationAgent();
agent.initialize().catch(console.error);

process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());