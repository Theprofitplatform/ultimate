const WebSocket = require('ws');

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
    console.log(`[${this.id}] Initializing SEO SERP Analyzer Agent...`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(`[${this.id}] Ready for SERP analysis tasks`);
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
        console.log(`[${this.id}] Received message:`, message.type);
        
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
        console.error(`[${this.id}] Error handling message:`, error);
      }
    });
  }

  async handleTask(task) {
    console.log(`[${this.id}] Processing task:`, task.type);
    
    const result = {
      taskId: `serp-${Date.now()}`,
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
      taskId: `serp-analysis-${Date.now()}`,
      analysis
    });
  }

  async trackRankings(params) {
    const rankings = params.keywords.map(keyword => ({
      keyword,
      current_position: Math.floor(Math.random() * 50) + 1,
      previous_position: Math.floor(Math.random() * 50) + 1,
      change: Math.floor(Math.random() * 10) - 5,
      url: `https://example.com/${keyword.replace(/\s+/g, '-')}`,
      search_volume: Math.floor(Math.random() * 5000) + 500,
      difficulty: Math.floor(Math.random() * 100)
    }));
    
    this.sendResult({
      taskId: `rankings-${Date.now()}`,
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

module.exports = SEOSerpAnalyzerAgent;