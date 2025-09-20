#!/usr/bin/env node

const Redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../logger');

class TestingAgent {
  constructor() {
    this.agentId = 'agent-testing';
    this.logger = new Logger('agent-testing');
    this.status = 'idle';
    this.currentTask = null;
    this.redis = null;
    this.capabilities = {
      unit: ['Jest', 'Mocha', 'Vitest'],
      e2e: ['Playwright', 'Cypress', 'Puppeteer'],
      performance: ['k6', 'JMeter', 'Artillery'],
      security: ['OWASP ZAP', 'Snyk', 'npm audit'],
      coverage: ['Istanbul', 'c8', 'nyc']
    };
  }

  async initialize() {
    try {
      this.redis = Redis.createClient({
        host: 'localhost',
        port: 6379
      });

      await this.redis.connect();
      this.logger.info('Testing Agent initialized');
      
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
    
    await subscriber.subscribe('hive:tasks:testing', async (message) => {
      const task = JSON.parse(message);
      await this.handleTask(task);
    });
    
    this.logger.info('Subscribed to testing tasks');
  }

  async handleTask(task) {
    this.logger.info(`Received task: ${task.type}`, { taskId: task.id });
    this.currentTask = task;
    this.status = 'working';
    
    try {
      switch (task.type) {
        case 'create-unit-test':
          await this.createUnitTest(task.params);
          break;
        case 'create-e2e-test':
          await this.createE2ETest(task.params);
          break;
        case 'run-tests':
          await this.runTests(task.params);
          break;
        case 'performance-test':
          await this.performanceTest(task.params);
          break;
        case 'security-scan':
          await this.securityScan(task.params);
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

  async createUnitTest(params) {
    const { component, type } = params;
    const testPath = '/home/avi/projects/ultimate/tests/unit';
    
    await fs.mkdir(testPath, { recursive: true });
    
    const testCode = `import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ${component} } from '../../src/${type}/${component}';

describe('${component}', () => {
  let instance;
  
  beforeEach(() => {
    instance = new ${component}();
    jest.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should create instance successfully', () => {
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(${component});
    });
  });
  
  describe('methods', () => {
    it('should handle valid input', async () => {
      const result = await instance.process({ data: 'test' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    
    it('should handle invalid input', async () => {
      await expect(instance.process(null)).rejects.toThrow();
    });
    
    it('should handle edge cases', async () => {
      const result = await instance.process({ data: '' });
      expect(result.data).toBe('');
    });
  });
  
  describe('error handling', () => {
    it('should throw on missing required fields', async () => {
      await expect(instance.process({})).rejects.toThrow('Required field missing');
    });
    
    it('should handle network errors gracefully', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      const result = await instance.process({ data: 'test' });
      expect(result.error).toBeDefined();
    });
  });
});`;

    await fs.writeFile(path.join(testPath, `${component}.test.js`), testCode);
    
    this.logger.info(`Unit test created for ${component}`);
  }

  async createE2ETest(params) {
    const { feature, scenarios } = params;
    const e2ePath = '/home/avi/projects/ultimate/tests/e2e';
    
    await fs.mkdir(e2ePath, { recursive: true });
    
    const e2eCode = `import { test, expect } from '@playwright/test';

test.describe('${feature}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });
  
  ${scenarios.map(scenario => `
  test('${scenario.name}', async ({ page }) => {
    // ${scenario.description}
    ${scenario.steps.map(step => `
    await page.${step.action}('${step.selector}'${step.value ? `, '${step.value}'` : ''});
    ${step.assertion ? `await expect(page.locator('${step.assertion.selector}')).${step.assertion.method}('${step.assertion.value}');` : ''}`).join('')}
  });`).join('')}
  
  test('should handle errors gracefully', async ({ page }) => {
    await page.route('**/api/**', route => route.abort());
    await page.goto('http://localhost:3000');
    await expect(page.locator('.error-message')).toBeVisible();
  });
});`;

    await fs.writeFile(path.join(e2ePath, `${feature}.spec.js`), e2eCode);
    
    this.logger.info(`E2E test created for ${feature}`);
  }

  async runTests(params) {
    const { type, coverage } = params;
    
    return new Promise((resolve, reject) => {
      const command = coverage 
        ? `npm test -- --coverage`
        : `npm test`;
      
      exec(command, { cwd: '/home/avi/projects/ultimate' }, (error, stdout, stderr) => {
        if (error && !stdout.includes('passed')) {
          this.logger.error('Tests failed', error);
          reject(error);
        } else {
          this.logger.info('Tests completed', { stdout });
          resolve(stdout);
        }
      });
    });
  }

  async performanceTest(params) {
    const { endpoint, vus, duration } = params;
    const perfPath = '/home/avi/projects/ultimate/tests/performance';
    
    await fs.mkdir(perfPath, { recursive: true });
    
    const k6Script = `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${vus || 10},
  duration: '${duration || '30s'}',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  const res = http.get('${endpoint}');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}`;

    await fs.writeFile(path.join(perfPath, 'load-test.js'), k6Script);
    
    this.logger.info('Performance test script created');
  }

  async securityScan(params) {
    const { type, target } = params;
    
    return new Promise((resolve, reject) => {
      let command;
      
      switch (type) {
        case 'dependencies':
          command = 'npm audit --json';
          break;
        case 'code':
          command = 'npx snyk test --json';
          break;
        default:
          command = 'npm audit';
      }
      
      exec(command, { cwd: '/home/avi/projects/ultimate' }, (error, stdout, stderr) => {
        const report = {
          type,
          target,
          timestamp: new Date().toISOString(),
          results: stdout
        };
        
        this.logger.info('Security scan completed', { type });
        resolve(report);
      });
    });
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
    this.logger.info('Shutting down testing agent...');
    if (this.redis) {
      await this.redis.quit();
    }
    this.logger.close();
    process.exit(0);
  }
}

const agent = new TestingAgent();
agent.initialize().catch(console.error);

process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());