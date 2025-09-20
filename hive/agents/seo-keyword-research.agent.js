const WebSocket = require('ws');
const axios = require('axios');

class SEOKeywordResearchAgent {
  constructor() {
    this.id = 'agent-seo-keyword-research';
    this.status = 'initializing';
    this.capabilities = {
      research: [
        'keyword-discovery',
        'search-volume-analysis',
        'keyword-difficulty-assessment',
        'long-tail-keyword-generation',
        'competitor-keyword-analysis',
        'keyword-clustering',
        'search-intent-classification',
        'seasonal-trend-analysis'
      ],
      sources: [
        'google-suggest',
        'related-searches',
        'people-also-ask',
        'competitor-analysis',
        'search-console-data'
      ],
      analysis: [
        'keyword-gap-analysis',
        'keyword-cannibalization-check',
        'keyword-opportunity-scoring',
        'semantic-keyword-mapping'
      ]
    };
    
    this.keywordDatabase = new Map();
    this.researchQueue = [];
    this.ws = null;
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:9092';
  }

  async initialize() {
    console.log(`[${this.id}] Initializing SEO Keyword Research Agent...`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(`[${this.id}] Ready for keyword research tasks`);
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
        type: 'seo-keyword-research',
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
          case 'research-request':
            await this.handleResearchRequest(message);
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
    
    switch (task.type) {
      case 'keyword-discovery':
        return await this.discoverKeywords(task.params);
      case 'analyze-competition':
        return await this.analyzeCompetitorKeywords(task.params);
      case 'find-long-tail':
        return await this.findLongTailKeywords(task.params);
      case 'keyword-clustering':
        return await this.clusterKeywords(task.params);
      case 'search-intent':
        return await this.classifySearchIntent(task.params);
      default:
        console.log(`[${this.id}] Unknown task type: ${task.type}`);
    }
  }

  async discoverKeywords(params) {
    const { seedKeyword, market = 'US', language = 'en' } = params;
    console.log(`[${this.id}] Discovering keywords for: ${seedKeyword}`);
    
    const keywords = [];
    
    // Simulate keyword discovery with realistic SEO data
    const variations = [
      { keyword: seedKeyword, volume: 10000, difficulty: 65, cpc: 2.5 },
      { keyword: `best ${seedKeyword}`, volume: 5000, difficulty: 45, cpc: 3.2 },
      { keyword: `${seedKeyword} guide`, volume: 3000, difficulty: 35, cpc: 1.8 },
      { keyword: `how to ${seedKeyword}`, volume: 8000, difficulty: 40, cpc: 2.1 },
      { keyword: `${seedKeyword} tips`, volume: 4500, difficulty: 38, cpc: 1.9 },
      { keyword: `${seedKeyword} tools`, volume: 6000, difficulty: 55, cpc: 4.5 },
      { keyword: `${seedKeyword} software`, volume: 4000, difficulty: 60, cpc: 5.2 },
      { keyword: `${seedKeyword} services`, volume: 3500, difficulty: 50, cpc: 6.8 },
      { keyword: `free ${seedKeyword}`, volume: 12000, difficulty: 70, cpc: 0.8 },
      { keyword: `${seedKeyword} tutorial`, volume: 2500, difficulty: 30, cpc: 1.2 }
    ];
    
    // Add search intent and trend data
    variations.forEach(kw => {
      keywords.push({
        ...kw,
        intent: this.detectIntent(kw.keyword),
        trend: this.generateTrend(),
        serp_features: this.detectSERPFeatures(kw.keyword),
        opportunity_score: this.calculateOpportunity(kw.volume, kw.difficulty)
      });
    });
    
    // Store in database
    keywords.forEach(kw => {
      this.keywordDatabase.set(kw.keyword, kw);
    });
    
    const result = {
      taskId: `kw-${Date.now()}`,
      seedKeyword,
      discovered: keywords.length,
      keywords: keywords.sort((a, b) => b.opportunity_score - a.opportunity_score),
      clusters: this.autoCluster(keywords),
      recommendations: this.generateRecommendations(keywords)
    };
    
    this.sendResult(result);
    return result;
  }

  async analyzeCompetitorKeywords(params) {
    const { competitor, limit = 50 } = params;
    console.log(`[${this.id}] Analyzing competitor keywords for: ${competitor}`);
    
    // Simulate competitor keyword analysis
    const competitorKeywords = [
      { keyword: 'seo optimization services', position: 3, traffic: 2500, value: 5000 },
      { keyword: 'digital marketing agency', position: 5, traffic: 1800, value: 7200 },
      { keyword: 'content marketing strategy', position: 2, traffic: 3200, value: 4800 },
      { keyword: 'link building services', position: 7, traffic: 900, value: 3600 },
      { keyword: 'technical seo audit', position: 4, traffic: 1500, value: 6000 }
    ];
    
    const gaps = competitorKeywords.map(kw => ({
      ...kw,
      gap_type: 'missing',  // missing, weak, strong
      difficulty: Math.floor(Math.random() * 100),
      opportunity: this.calculateOpportunity(kw.traffic, 50)
    }));
    
    const result = {
      taskId: `comp-${Date.now()}`,
      competitor,
      total_keywords: competitorKeywords.length,
      keyword_gaps: gaps,
      top_opportunities: gaps.slice(0, 10),
      estimated_traffic_gain: gaps.reduce((sum, kw) => sum + kw.traffic, 0)
    };
    
    this.sendResult(result);
    return result;
  }

  async findLongTailKeywords(params) {
    const { seedKeyword, minWords = 3 } = params;
    console.log(`[${this.id}] Finding long-tail keywords for: ${seedKeyword}`);
    
    const longTailVariations = [
      `${seedKeyword} for beginners step by step`,
      `how to ${seedKeyword} without experience`,
      `best ${seedKeyword} tools for small business`,
      `${seedKeyword} vs alternatives comparison`,
      `complete guide to ${seedKeyword} 2024`,
      `${seedKeyword} tips and tricks for professionals`,
      `common ${seedKeyword} mistakes to avoid`,
      `${seedKeyword} best practices checklist`
    ];
    
    const longTailKeywords = longTailVariations.map(kw => ({
      keyword: kw,
      words: kw.split(' ').length,
      volume: Math.floor(Math.random() * 1000) + 100,
      difficulty: Math.floor(Math.random() * 40) + 10,
      intent: this.detectIntent(kw),
      competition: 'low',
      opportunity_score: Math.floor(Math.random() * 40) + 60
    }));
    
    const result = {
      taskId: `lt-${Date.now()}`,
      seedKeyword,
      long_tail_count: longTailKeywords.length,
      keywords: longTailKeywords,
      avg_difficulty: Math.round(longTailKeywords.reduce((sum, kw) => sum + kw.difficulty, 0) / longTailKeywords.length),
      total_search_volume: longTailKeywords.reduce((sum, kw) => sum + kw.volume, 0)
    };
    
    this.sendResult(result);
    return result;
  }

  async clusterKeywords(params) {
    const { keywords } = params;
    console.log(`[${this.id}] Clustering ${keywords.length} keywords`);
    
    const clusters = {
      informational: [],
      commercial: [],
      transactional: [],
      navigational: [],
      comparison: []
    };
    
    keywords.forEach(kw => {
      const intent = this.detectIntent(kw);
      if (clusters[intent]) {
        clusters[intent].push(kw);
      }
    });
    
    // Create topic clusters
    const topicClusters = [
      {
        topic: 'Getting Started',
        keywords: keywords.filter(kw => kw.includes('beginner') || kw.includes('guide')),
        pillar_content: 'Complete Beginner\'s Guide'
      },
      {
        topic: 'Tools & Software',
        keywords: keywords.filter(kw => kw.includes('tool') || kw.includes('software')),
        pillar_content: 'Best Tools Comparison'
      },
      {
        topic: 'Services',
        keywords: keywords.filter(kw => kw.includes('service') || kw.includes('agency')),
        pillar_content: 'Service Selection Guide'
      }
    ];
    
    const result = {
      taskId: `cluster-${Date.now()}`,
      total_keywords: keywords.length,
      intent_clusters: clusters,
      topic_clusters: topicClusters,
      content_strategy: this.generateContentStrategy(topicClusters)
    };
    
    this.sendResult(result);
    return result;
  }

  async classifySearchIntent(params) {
    const { keyword } = params;
    const intent = this.detectIntent(keyword);
    
    const result = {
      taskId: `intent-${Date.now()}`,
      keyword,
      primary_intent: intent,
      confidence: 0.85,
      content_recommendations: this.getContentRecommendations(intent),
      serp_features_expected: this.detectSERPFeatures(keyword)
    };
    
    this.sendResult(result);
    return result;
  }

  detectIntent(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    
    if (lowerKeyword.includes('how') || lowerKeyword.includes('what') || lowerKeyword.includes('guide')) {
      return 'informational';
    }
    if (lowerKeyword.includes('best') || lowerKeyword.includes('review') || lowerKeyword.includes('top')) {
      return 'commercial';
    }
    if (lowerKeyword.includes('buy') || lowerKeyword.includes('price') || lowerKeyword.includes('cheap')) {
      return 'transactional';
    }
    if (lowerKeyword.includes('vs') || lowerKeyword.includes('compare') || lowerKeyword.includes('alternative')) {
      return 'comparison';
    }
    
    return 'informational';
  }

  detectSERPFeatures(keyword) {
    const features = [];
    const lower = keyword.toLowerCase();
    
    if (lower.includes('how') || lower.includes('what')) {
      features.push('featured_snippet', 'people_also_ask');
    }
    if (lower.includes('near me') || lower.includes('local')) {
      features.push('local_pack', 'maps');
    }
    if (lower.includes('buy') || lower.includes('shop')) {
      features.push('shopping_results', 'product_ads');
    }
    if (lower.includes('video') || lower.includes('tutorial')) {
      features.push('video_carousel');
    }
    
    return features;
  }

  generateTrend() {
    return {
      direction: Math.random() > 0.5 ? 'up' : 'stable',
      change_percent: Math.floor(Math.random() * 30),
      seasonality: Math.random() > 0.7 ? 'high' : 'low'
    };
  }

  calculateOpportunity(volume, difficulty) {
    // Higher volume and lower difficulty = higher opportunity
    const volumeScore = Math.min(volume / 100, 100);
    const difficultyScore = 100 - difficulty;
    return Math.round((volumeScore + difficultyScore) / 2);
  }

  autoCluster(keywords) {
    const clusters = {};
    
    keywords.forEach(kw => {
      const mainTerm = kw.keyword.split(' ')[0];
      if (!clusters[mainTerm]) {
        clusters[mainTerm] = [];
      }
      clusters[mainTerm].push(kw);
    });
    
    return Object.entries(clusters).map(([term, kws]) => ({
      main_term: term,
      keywords: kws,
      total_volume: kws.reduce((sum, k) => sum + k.volume, 0),
      avg_difficulty: Math.round(kws.reduce((sum, k) => sum + k.difficulty, 0) / kws.length)
    }));
  }

  generateRecommendations(keywords) {
    const recommendations = [];
    
    const highVolumeLowDiff = keywords.filter(k => k.volume > 5000 && k.difficulty < 40);
    if (highVolumeLowDiff.length > 0) {
      recommendations.push({
        type: 'quick-wins',
        message: `Target ${highVolumeLowDiff.length} high-volume, low-difficulty keywords for quick wins`,
        keywords: highVolumeLowDiff.slice(0, 3)
      });
    }
    
    const longTail = keywords.filter(k => k.keyword.split(' ').length >= 4);
    if (longTail.length > 0) {
      recommendations.push({
        type: 'long-tail',
        message: `Focus on ${longTail.length} long-tail keywords for easier ranking`,
        keywords: longTail.slice(0, 3)
      });
    }
    
    return recommendations;
  }

  getContentRecommendations(intent) {
    const recommendations = {
      informational: [
        'Create comprehensive guides',
        'Add FAQ sections',
        'Include step-by-step tutorials',
        'Use schema markup for better snippets'
      ],
      commercial: [
        'Create comparison tables',
        'Add user reviews and ratings',
        'Include pros and cons lists',
        'Show pricing information clearly'
      ],
      transactional: [
        'Optimize product pages',
        'Add clear CTAs',
        'Include trust signals',
        'Streamline checkout process'
      ],
      comparison: [
        'Create detailed comparison charts',
        'Include side-by-side features',
        'Add verdict/recommendation',
        'Use comparison schema markup'
      ]
    };
    
    return recommendations[intent] || recommendations.informational;
  }

  generateContentStrategy(clusters) {
    return clusters.map(cluster => ({
      pillar_page: cluster.pillar_content,
      supporting_content: cluster.keywords.slice(0, 5).map(kw => ({
        title: `Article about ${kw}`,
        target_keyword: kw,
        word_count: 1500 + Math.floor(Math.random() * 1000),
        internal_links: 3
      })),
      estimated_traffic: cluster.keywords.reduce((sum, kw) => sum + (kw.volume || 0), 0) * 0.1
    }));
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
      console.log(`[${this.id}] Sent result for task: ${result.taskId}`);
    }
  }

  sendStatus() {
    const status = {
      type: 'status',
      agentId: this.id,
      status: this.status,
      capabilities: this.capabilities,
      queueLength: this.researchQueue.length,
      keywordsInDatabase: this.keywordDatabase.size
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(status));
    }
  }

  async handleResearchRequest(message) {
    const { request } = message;
    console.log(`[${this.id}] Processing research request:`, request.type);
    
    switch (request.type) {
      case 'bulk-research':
        const results = [];
        for (const keyword of request.keywords) {
          const result = await this.discoverKeywords({ seedKeyword: keyword });
          results.push(result);
        }
        this.sendResult({ type: 'bulk-research', results });
        break;
        
      case 'competitive-analysis':
        const analysis = await this.analyzeCompetitorKeywords(request.params);
        this.sendResult(analysis);
        break;
        
      default:
        console.log(`[${this.id}] Unknown research type:`, request.type);
    }
  }

  async shutdown() {
    console.log(`[${this.id}] Shutting down...`);
    this.status = 'shutting-down';
    
    if (this.ws) {
      this.ws.close();
    }
    
    console.log(`[${this.id}] Shutdown complete`);
    process.exit(0);
  }
}

// Initialize and start the agent
const agent = new SEOKeywordResearchAgent();
agent.initialize().catch(console.error);

// Handle shutdown signals
process.on('SIGTERM', () => agent.shutdown());
process.on('SIGINT', () => agent.shutdown());

module.exports = SEOKeywordResearchAgent;