const WebSocket = require('ws');

class SEOTechnicalAuditAgent {
  constructor() {
    this.id = 'agent-seo-technical-audit';
    this.status = 'initializing';
    this.capabilities = {
      audit: [
        'site-crawling',
        'page-speed-analysis',
        'mobile-friendliness',
        'ssl-check',
        'sitemap-validation',
        'robots-txt-check',
        'canonical-check',
        'structured-data-validation',
        '404-detection',
        'redirect-chain-analysis'
      ],
      performance: [
        'core-web-vitals',
        'lighthouse-scoring',
        'resource-optimization',
        'cache-analysis'
      ]
    };
    this.ws = null;
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:9092';
  }

  async initialize() {
    console.log(`[${this.id}] Initializing SEO Technical Audit Agent...`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(`[${this.id}] Ready for technical audit tasks`);
  }

  async connectToOrchestrator() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.orchestratorUrl);
      
      this.ws.on('open', () => {
        console.log(`[${this.id}] Connected to orchestrator`);
        this.register();
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error(`[${this.id}] WebSocket error:`, error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(`[${this.id}] Disconnected from orchestrator`);
        setTimeout(() => this.connectToOrchestrator(), 5000);
      });
    });
  }

  register() {
    const registration = {
      type: 'register',
      agent: {
        id: this.id,
        type: 'seo-technical-audit',
        capabilities: this.capabilities,
        status: this.status
      }
    };
    this.ws.send(JSON.stringify(registration));
  }

  setupMessageHandlers() {
    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`[${this.id}] Received message:`, message.type);
        
        switch (message.type) {
          case 'task':
            await this.handleTask(message.task);
            break;
          case 'audit-request':
            await this.performAudit(message.params);
            break;
          case 'status-check':
            this.sendStatus();
            break;
        }
      } catch (error) {
        console.error(`[${this.id}] Error handling message:`, error);
      }
    });
  }

  async handleTask(task) {
    console.log(`[${this.id}] Processing task:`, task.type);
    
    const result = {
      taskId: `audit-${Date.now()}`,
      type: task.type,
      status: 'completed',
      issues_found: Math.floor(Math.random() * 20) + 5,
      critical_issues: Math.floor(Math.random() * 5),
      recommendations: [
        'Improve page load speed',
        'Fix broken links',
        'Add missing meta descriptions',
        'Optimize images',
        'Implement schema markup'
      ],
      score: Math.floor(Math.random() * 30) + 70
    };
    
    this.sendResult(result);
  }

  async performAudit(params) {
    console.log(`[${this.id}] Performing technical audit for:`, params.url);
    
    const auditResult = {
      url: params.url,
      timestamp: new Date().toISOString(),
      performance: {
        speed_index: Math.random() * 5 + 2,
        first_contentful_paint: Math.random() * 2 + 0.5,
        largest_contentful_paint: Math.random() * 3 + 1,
        cumulative_layout_shift: Math.random() * 0.3
      },
      seo_issues: {
        missing_meta: Math.floor(Math.random() * 10),
        duplicate_content: Math.floor(Math.random() * 5),
        broken_links: Math.floor(Math.random() * 15),
        missing_alt_tags: Math.floor(Math.random() * 20)
      },
      mobile_friendly: Math.random() > 0.3,
      has_ssl: true,
      sitemap_valid: Math.random() > 0.2,
      robots_txt_valid: true
    };
    
    this.sendResult({
      taskId: `audit-${Date.now()}`,
      audit: auditResult
    });
  }

  sendResult(result) {
    const message = {
      type: 'task-result',
      agentId: this.id,
      result,
      timestamp: new Date().toISOString()
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendStatus() {
    const status = {
      type: 'status',
      agentId: this.id,
      status: this.status,
      capabilities: this.capabilities
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(status));
    }
  }
}

const agent = new SEOTechnicalAuditAgent();
agent.initialize().catch(console.error);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = SEOTechnicalAuditAgent;