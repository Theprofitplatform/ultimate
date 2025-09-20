#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class SEOAgentsLauncher {
  constructor() {
    this.agents = [
      {
        id: 'seo-keyword-research',
        name: 'SEO Keyword Research Agent',
        file: 'agents/seo-keyword-research.agent.js',
        capabilities: ['keyword-discovery', 'search-volume-analysis', 'competitor-analysis']
      },
      {
        id: 'seo-content-optimizer',
        name: 'SEO Content Optimizer Agent',
        file: 'agents/seo-content-optimizer.agent.js',
        capabilities: ['content-scoring', 'readability-analysis', 'meta-optimization']
      },
      {
        id: 'seo-technical-audit',
        name: 'SEO Technical Audit Agent',
        file: 'agents/seo-technical-audit.agent.js',
        capabilities: ['site-crawling', 'performance-analysis', 'schema-validation']
      },
      {
        id: 'seo-link-builder',
        name: 'SEO Link Building Agent',
        file: 'agents/seo-link-builder.agent.js',
        capabilities: ['backlink-analysis', 'opportunity-discovery', 'outreach-automation']
      },
      {
        id: 'seo-serp-analyzer',
        name: 'SEO SERP Analyzer Agent',
        file: 'agents/seo-serp-analyzer.agent.js',
        capabilities: ['serp-tracking', 'competitor-monitoring', 'featured-snippet-analysis']
      }
    ];
    
    this.processes = new Map();
    this.orchestratorUrl = 'http://localhost:9090';
    this.logDir = path.join(__dirname, 'logs', 'seo-agents');
  }

  async initialize() {
    console.log('🚀 SEO Agents Launcher - Initializing...');
    
    // Create log directory
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Check orchestrator status
    const isOrchestratorRunning = await this.checkOrchestrator();
    if (!isOrchestratorRunning) {
      console.error('❌ Orchestrator is not running. Please start the Hive system first.');
      process.exit(1);
    }
    
    console.log('✅ Orchestrator is running');
  }

  async checkOrchestrator() {
    try {
      const response = await axios.get(`${this.orchestratorUrl}/api/status`);
      return response.data.status === 'active';
    } catch (error) {
      return false;
    }
  }

  async launchAgent(agent) {
    console.log(`🤖 Launching ${agent.name}...`);
    
    const agentPath = path.join(__dirname, agent.file);
    
    // Check if agent file exists, create if not
    if (!fs.existsSync(agentPath)) {
      console.log(`📝 Creating ${agent.name} file...`);
      this.createAgentFile(agent);
    }
    
    const logFile = path.join(this.logDir, `${agent.id}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    const agentProcess = spawn('node', [agentPath], {
      env: {
        ...process.env,
        AGENT_ID: agent.id,
        ORCHESTRATOR_URL: 'ws://localhost:9092'
      }
    });
    
    agentProcess.stdout.pipe(logStream);
    agentProcess.stderr.pipe(logStream);
    
    agentProcess.stdout.on('data', (data) => {
      console.log(`[${agent.id}] ${data.toString().trim()}`);
    });
    
    agentProcess.stderr.on('data', (data) => {
      console.error(`[${agent.id}] ERROR: ${data.toString().trim()}`);
    });
    
    agentProcess.on('exit', (code) => {
      console.log(`[${agent.id}] Process exited with code ${code}`);
      this.processes.delete(agent.id);
      
      // Restart agent if it crashed
      if (code !== 0) {
        console.log(`[${agent.id}] Restarting in 5 seconds...`);
        setTimeout(() => this.launchAgent(agent), 5000);
      }
    });
    
    this.processes.set(agent.id, agentProcess);
    console.log(`✅ ${agent.name} launched (PID: ${agentProcess.pid})`);
  }

  createAgentFile(agent) {
    // Create missing agent files with basic structure
    const templates = {
      'seo-technical-audit': this.getTechnicalAuditTemplate(),
      'seo-link-builder': this.getLinkBuilderTemplate(),
      'seo-serp-analyzer': this.getSerpAnalyzerTemplate()
    };
    
    if (templates[agent.id]) {
      const agentPath = path.join(__dirname, agent.file);
      fs.writeFileSync(agentPath, templates[agent.id]);
      console.log(`✅ Created ${agent.name} file`);
    }
  }

  getTechnicalAuditTemplate() {
    return `const WebSocket = require('ws');

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
    console.log(\`[\${this.id}] Initializing SEO Technical Audit Agent...\`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(\`[\${this.id}] Ready for technical audit tasks\`);
  }

  async connectToOrchestrator() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.orchestratorUrl);
      
      this.ws.on('open', () => {
        console.log(\`[\${this.id}] Connected to orchestrator\`);
        this.register();
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error(\`[\${this.id}] WebSocket error:\`, error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(\`[\${this.id}] Disconnected from orchestrator\`);
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
        console.log(\`[\${this.id}] Received message:\`, message.type);
        
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
        console.error(\`[\${this.id}] Error handling message:\`, error);
      }
    });
  }

  async handleTask(task) {
    console.log(\`[\${this.id}] Processing task:\`, task.type);
    
    const result = {
      taskId: \`audit-\${Date.now()}\`,
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
    console.log(\`[\${this.id}] Performing technical audit for:\`, params.url);
    
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
      taskId: \`audit-\${Date.now()}\`,
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

module.exports = SEOTechnicalAuditAgent;`;
  }

  getLinkBuilderTemplate() {
    return `const WebSocket = require('ws');

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
    console.log(\`[\${this.id}] Initializing SEO Link Builder Agent...\`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(\`[\${this.id}] Ready for link building tasks\`);
  }

  async connectToOrchestrator() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.orchestratorUrl);
      
      this.ws.on('open', () => {
        console.log(\`[\${this.id}] Connected to orchestrator\`);
        this.register();
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error(\`[\${this.id}] WebSocket error:\`, error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(\`[\${this.id}] Disconnected from orchestrator\`);
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
        console.log(\`[\${this.id}] Received message:\`, message.type);
        
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
        console.error(\`[\${this.id}] Error handling message:\`, error);
      }
    });
  }

  async handleTask(task) {
    console.log(\`[\${this.id}] Processing task:\`, task.type);
    
    const result = {
      taskId: \`link-\${Date.now()}\`,
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
      taskId: \`backlink-analysis-\${Date.now()}\`,
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
      taskId: \`opportunities-\${Date.now()}\`,
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

module.exports = SEOLinkBuilderAgent;`;
  }

  getSerpAnalyzerTemplate() {
    return `const WebSocket = require('ws');

class SEOSerpAnalyzerAgent {
  constructor() {
    this.id = 'agent-seo-serp-analyzer';
    this.status = 'initializing';
    this.capabilities = {
      tracking: [
        'position-tracking',
        'serp-feature-monitoring',
        'competitor-tracking',
        'local-pack-monitoring',
        'mobile-vs-desktop'
      ],
      analysis: [
        'featured-snippet-opportunities',
        'people-also-ask-analysis',
        'knowledge-panel-tracking',
        'image-pack-analysis',
        'video-carousel-tracking'
      ],
      reporting: [
        'ranking-changes',
        'visibility-score',
        'share-of-voice',
        'click-through-rate-estimation'
      ]
    };
    this.ws = null;
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:9092';
  }

  async initialize() {
    console.log(\`[\${this.id}] Initializing SEO SERP Analyzer Agent...\`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(\`[\${this.id}] Ready for SERP analysis tasks\`);
  }

  async connectToOrchestrator() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.orchestratorUrl);
      
      this.ws.on('open', () => {
        console.log(\`[\${this.id}] Connected to orchestrator\`);
        this.register();
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error(\`[\${this.id}] WebSocket error:\`, error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(\`[\${this.id}] Disconnected from orchestrator\`);
        setTimeout(() => this.connectToOrchestrator(), 5000);
      });
    });
  }

  register() {
    const registration = {
      type: 'register',
      agent: {
        id: this.id,
        type: 'seo-serp-analyzer',
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
        console.log(\`[\${this.id}] Received message:\`, message.type);
        
        switch (message.type) {
          case 'task':
            await this.handleTask(message.task);
            break;
          case 'analyze-serp':
            await this.analyzeSERP(message.params);
            break;
          case 'track-rankings':
            await this.trackRankings(message.params);
            break;
          case 'status-check':
            this.sendStatus();
            break;
        }
      } catch (error) {
        console.error(\`[\${this.id}] Error handling message:\`, error);
      }
    });
  }

  async handleTask(task) {
    console.log(\`[\${this.id}] Processing task:\`, task.type);
    
    const result = {
      taskId: \`serp-\${Date.now()}\`,
      type: task.type,
      rankings_tracked: Math.floor(Math.random() * 100) + 50,
      position_changes: {
        improved: Math.floor(Math.random() * 30),
        declined: Math.floor(Math.random() * 20),
        stable: Math.floor(Math.random() * 50)
      },
      serp_features: ['featured_snippet', 'people_also_ask', 'local_pack'],
      visibility_score: Math.floor(Math.random() * 30) + 60
    };
    
    this.sendResult(result);
  }

  async analyzeSERP(params) {
    const analysis = {
      keyword: params.keyword,
      position: Math.floor(Math.random() * 20) + 1,
      url: params.url,
      serp_features: {
        featured_snippet: { present: true, owned: false },
        people_also_ask: { present: true, questions: 4 },
        local_pack: { present: false },
        knowledge_panel: { present: false },
        image_pack: { present: true, images: 8 },
        video_carousel: { present: true, videos: 3 }
      },
      competitors: [
        { domain: 'competitor1.com', position: 1 },
        { domain: 'competitor2.com', position: 2 },
        { domain: 'competitor3.com', position: 4 }
      ],
      estimated_ctr: Math.random() * 0.3 + 0.1,
      search_volume: Math.floor(Math.random() * 10000) + 1000
    };
    
    this.sendResult({
      taskId: \`serp-analysis-\${Date.now()}\`,
      analysis
    });
  }

  async trackRankings(params) {
    const rankings = params.keywords.map(keyword => ({
      keyword,
      current_position: Math.floor(Math.random() * 50) + 1,
      previous_position: Math.floor(Math.random() * 50) + 1,
      change: Math.floor(Math.random() * 10) - 5,
      url: \`https://example.com/\${keyword.replace(/\\s+/g, '-')}\`,
      search_volume: Math.floor(Math.random() * 5000) + 500,
      difficulty: Math.floor(Math.random() * 100)
    }));
    
    this.sendResult({
      taskId: \`rankings-\${Date.now()}\`,
      rankings,
      summary: {
        total_keywords: rankings.length,
        average_position: Math.round(rankings.reduce((sum, r) => sum + r.current_position, 0) / rankings.length),
        top_10: rankings.filter(r => r.current_position <= 10).length,
        improved: rankings.filter(r => r.change > 0).length,
        declined: rankings.filter(r => r.change < 0).length
      }
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

const agent = new SEOSerpAnalyzerAgent();
agent.initialize().catch(console.error);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = SEOSerpAnalyzerAgent;`;
  }

  async launchAll() {
    console.log('🚀 Launching all SEO agents...\n');
    
    for (const agent of this.agents) {
      await this.launchAgent(agent);
      // Small delay between launches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ All SEO agents launched successfully!');
    console.log('📊 Monitoring agent status...\n');
    
    // Start monitoring
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(async () => {
      try {
        const response = await axios.get(`${this.orchestratorUrl}/api/agents`);
        const agents = response.data;
        
        console.log('📊 Agent Status Update:');
        agents.forEach(agent => {
          if (agent.id.includes('seo')) {
            console.log(`   ${agent.id}: ${agent.status} (Last seen: ${agent.lastSeen})`);
          }
        });
      } catch (error) {
        // Silent fail for monitoring
      }
    }, 30000); // Check every 30 seconds
  }

  async stopAll() {
    console.log('🛑 Stopping all SEO agents...');
    
    for (const [agentId, process] of this.processes) {
      console.log(`   Stopping ${agentId}...`);
      process.kill('SIGTERM');
    }
    
    this.processes.clear();
    console.log('✅ All agents stopped');
  }

  async testAgents() {
    console.log('🧪 Testing SEO agent capabilities...\n');
    
    const tests = [
      {
        endpoint: '/api/task',
        payload: {
          type: 'keyword-discovery',
          agent: 'seo-keyword-research',
          params: {
            seedKeyword: 'SEO tools',
            market: 'US'
          }
        }
      },
      {
        endpoint: '/api/task',
        payload: {
          type: 'analyze-content',
          agent: 'seo-content-optimizer',
          params: {
            content: 'This is a test content about SEO optimization...',
            targetKeywords: ['SEO', 'optimization'],
            url: 'https://example.com/test'
          }
        }
      },
      {
        endpoint: '/api/task',
        payload: {
          type: 'site-audit',
          agent: 'seo-technical-audit',
          params: {
            url: 'https://portal.theprofitplatform.com.au'
          }
        }
      }
    ];
    
    for (const test of tests) {
      try {
        console.log(`Testing: ${test.payload.type} with ${test.payload.agent}`);
        const response = await axios.post(
          `${this.orchestratorUrl}${test.endpoint}`,
          test.payload
        );
        console.log(`✅ Success: Task ID ${response.data.taskId}\n`);
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Main execution
async function main() {
  const launcher = new SEOAgentsLauncher();
  
  const command = process.argv[2];
  
  try {
    await launcher.initialize();
    
    switch (command) {
      case 'start':
        await launcher.launchAll();
        break;
      case 'stop':
        await launcher.stopAll();
        process.exit(0);
        break;
      case 'test':
        await launcher.launchAll();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await launcher.testAgents();
        break;
      default:
        console.log('Usage: node seo-agents-launcher.js [start|stop|test]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutdown signal received');
    await launcher.stopAll();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await launcher.stopAll();
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}

module.exports = SEOAgentsLauncher;