const WebSocket = require('ws');

class SEOLinkBuilderAgent {
  constructor() {
    this.id = 'agent-seo-link-builder';
    this.status = 'initializing';
    this.capabilities = {
      analysis: [
        'backlink-profile-analysis',
        'competitor-backlink-research',
        'link-quality-assessment',
        'anchor-text-distribution',
        'toxic-link-detection'
      ],
      discovery: [
        'opportunity-identification',
        'guest-post-prospects',
        'resource-page-opportunities',
        'broken-link-building',
        'brand-mention-tracking'
      ],
      outreach: [
        'contact-discovery',
        'email-template-generation',
        'relationship-tracking',
        'follow-up-automation'
      ]
    };
    this.ws = null;
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:9092';
  }

  async initialize() {
    console.log(`[${this.id}] Initializing SEO Link Builder Agent...`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(`[${this.id}] Ready for link building tasks`);
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
        type: 'seo-link-builder',
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
          case 'link-analysis':
            await this.analyzeBacklinks(message.params);
            break;
          case 'find-opportunities':
            await this.findOpportunities(message.params);
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
      taskId: `link-${Date.now()}`,
      type: task.type,
      opportunities_found: Math.floor(Math.random() * 50) + 10,
      high_quality_prospects: Math.floor(Math.random() * 10) + 5,
      estimated_domain_rating: Math.floor(Math.random() * 30) + 60,
      outreach_templates: 3
    };
    
    this.sendResult(result);
  }

  async analyzeBacklinks(params) {
    const analysis = {
      total_backlinks: Math.floor(Math.random() * 1000) + 100,
      referring_domains: Math.floor(Math.random() * 200) + 50,
      domain_rating: Math.floor(Math.random() * 40) + 40,
      toxic_links: Math.floor(Math.random() * 10),
      follow_ratio: Math.random() * 0.3 + 0.6,
      anchor_distribution: {
        branded: 35,
        exact_match: 15,
        partial_match: 25,
        generic: 20,
        naked_url: 5
      }
    };
    
    this.sendResult({
      taskId: `backlink-analysis-${Date.now()}`,
      analysis
    });
  }

  async findOpportunities(params) {
    const opportunities = [
      {
        type: 'guest-post',
        domain: 'example-blog.com',
        domain_rating: 75,
        relevance: 'high',
        contact_found: true
      },
      {
        type: 'resource-page',
        domain: 'industry-resource.org',
        domain_rating: 82,
        relevance: 'medium',
        contact_found: false
      },
      {
        type: 'broken-link',
        domain: 'competitor-site.com',
        domain_rating: 68,
        relevance: 'high',
        broken_url: '/old-resource'
      }
    ];
    
    this.sendResult({
      taskId: `opportunities-${Date.now()}`,
      opportunities,
      total: opportunities.length
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

const agent = new SEOLinkBuilderAgent();
agent.initialize().catch(console.error);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = SEOLinkBuilderAgent;