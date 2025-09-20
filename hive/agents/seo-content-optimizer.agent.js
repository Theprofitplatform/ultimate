const WebSocket = require('ws');
const natural = require('natural');

class SEOContentOptimizerAgent {
  constructor() {
    this.id = 'agent-seo-content-optimizer';
    this.status = 'initializing';
    this.capabilities = {
      analysis: [
        'content-scoring',
        'readability-analysis',
        'keyword-density-check',
        'semantic-analysis',
        'content-gap-identification',
        'title-optimization',
        'meta-description-optimization',
        'heading-structure-analysis',
        'internal-linking-suggestions'
      ],
      optimization: [
        'content-rewriting',
        'keyword-placement',
        'content-length-optimization',
        'schema-markup-generation',
        'image-alt-text-optimization',
        'url-slug-optimization',
        'content-freshness-check'
      ],
      content_types: [
        'blog-posts',
        'landing-pages',
        'product-pages',
        'category-pages',
        'pillar-content',
        'faq-sections'
      ]
    };
    
    this.contentDatabase = new Map();
    this.optimizationQueue = [];
    this.ws = null;
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:9092';
    
    // NLP tools
    this.tokenizer = new natural.WordTokenizer();
    this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  }

  async initialize() {
    console.log(`[${this.id}] Initializing SEO Content Optimizer Agent...`);
    await this.connectToOrchestrator();
    this.setupMessageHandlers();
    this.status = 'ready';
    console.log(`[${this.id}] Ready for content optimization tasks`);
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
        type: 'seo-content-optimizer',
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
          case 'optimize-request':
            await this.handleOptimizationRequest(message);
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
      case 'analyze-content':
        return await this.analyzeContent(task.params);
      case 'optimize-content':
        return await this.optimizeContent(task.params);
      case 'generate-meta':
        return await this.generateMetaTags(task.params);
      case 'content-scoring':
        return await this.scoreContent(task.params);
      case 'heading-analysis':
        return await this.analyzeHeadingStructure(task.params);
      default:
        console.log(`[${this.id}] Unknown task type: ${task.type}`);
    }
  }

  async analyzeContent(params) {
    const { content, targetKeywords, url } = params;
    console.log(`[${this.id}] Analyzing content for optimization`);
    
    // Tokenize and analyze content
    const tokens = this.tokenizer.tokenize(content.toLowerCase());
    const wordCount = tokens.length;
    const sentenceCount = content.split(/[.!?]+/).length;
    const paragraphCount = content.split(/\n\n+/).length;
    
    // Calculate readability scores
    const readability = this.calculateReadability(content);
    
    // Keyword analysis
    const keywordAnalysis = this.analyzeKeywords(content, targetKeywords);
    
    // Content structure analysis
    const structureAnalysis = this.analyzeStructure(content);
    
    // SEO scoring
    const seoScore = this.calculateSEOScore({
      wordCount,
      readability,
      keywordAnalysis,
      structureAnalysis
    });
    
    const result = {
      taskId: `content-${Date.now()}`,
      url,
      metrics: {
        word_count: wordCount,
        sentence_count: sentenceCount,
        paragraph_count: paragraphCount,
        reading_time: Math.ceil(wordCount / 200) + ' minutes'
      },
      readability,
      keyword_analysis: keywordAnalysis,
      structure: structureAnalysis,
      seo_score: seoScore,
      recommendations: this.generateRecommendations({
        wordCount,
        readability,
        keywordAnalysis,
        structureAnalysis
      })
    };
    
    this.sendResult(result);
    return result;
  }

  async optimizeContent(params) {
    const { content, targetKeywords, contentType = 'blog-post' } = params;
    console.log(`[${this.id}] Optimizing content for ${contentType}`);
    
    let optimizedContent = content;
    
    // Optimize title
    const title = this.extractTitle(content);
    const optimizedTitle = this.optimizeTitle(title, targetKeywords[0]);
    
    // Optimize headings
    const headings = this.extractHeadings(content);
    const optimizedHeadings = this.optimizeHeadings(headings, targetKeywords);
    
    // Optimize keyword placement
    optimizedContent = this.optimizeKeywordPlacement(content, targetKeywords);
    
    // Add semantic keywords
    const semanticKeywords = this.generateSemanticKeywords(targetKeywords);
    optimizedContent = this.addSemanticKeywords(optimizedContent, semanticKeywords);
    
    // Optimize content length
    const targetLength = this.getTargetLength(contentType);
    if (optimizedContent.split(' ').length < targetLength) {
      optimizedContent = this.expandContent(optimizedContent, targetLength);
    }
    
    // Generate schema markup
    const schema = this.generateSchemaMarkup({
      title: optimizedTitle,
      content: optimizedContent,
      type: contentType
    });
    
    const result = {
      taskId: `optimize-${Date.now()}`,
      original_length: content.split(' ').length,
      optimized_length: optimizedContent.split(' ').length,
      optimized_title: optimizedTitle,
      optimized_headings: optimizedHeadings,
      semantic_keywords: semanticKeywords,
      schema_markup: schema,
      content_snippet: optimizedContent.substring(0, 500) + '...',
      improvements: this.listImprovements(content, optimizedContent)
    };
    
    this.sendResult(result);
    return result;
  }

  async generateMetaTags(params) {
    const { title, content, targetKeywords } = params;
    console.log(`[${this.id}] Generating optimized meta tags`);
    
    // Generate title tag
    const titleTag = this.generateTitleTag(title, targetKeywords[0]);
    
    // Generate meta description
    const metaDescription = this.generateMetaDescription(content, targetKeywords);
    
    // Generate Open Graph tags
    const ogTags = this.generateOpenGraphTags({
      title: titleTag,
      description: metaDescription,
      content
    });
    
    // Generate Twitter Card tags
    const twitterTags = this.generateTwitterCardTags({
      title: titleTag,
      description: metaDescription
    });
    
    // Generate canonical URL
    const canonical = params.url || '';
    
    const result = {
      taskId: `meta-${Date.now()}`,
      title_tag: titleTag,
      meta_description: metaDescription,
      open_graph: ogTags,
      twitter_card: twitterTags,
      canonical_url: canonical,
      structured_data: this.generateStructuredData(params)
    };
    
    this.sendResult(result);
    return result;
  }

  async scoreContent(params) {
    const { content, targetKeywords, competitors = [] } = params;
    console.log(`[${this.id}] Scoring content for SEO`);
    
    const scores = {
      content_quality: this.scoreContentQuality(content),
      keyword_optimization: this.scoreKeywordOptimization(content, targetKeywords),
      technical_seo: this.scoreTechnicalSEO(content),
      user_experience: this.scoreUserExperience(content),
      competitive_edge: this.scoreCompetitiveEdge(content, competitors)
    };
    
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
    
    const result = {
      taskId: `score-${Date.now()}`,
      overall_score: Math.round(totalScore),
      scores,
      grade: this.getGrade(totalScore),
      strengths: this.identifyStrengths(scores),
      weaknesses: this.identifyWeaknesses(scores),
      action_items: this.generateActionItems(scores)
    };
    
    this.sendResult(result);
    return result;
  }

  async analyzeHeadingStructure(params) {
    const { content } = params;
    console.log(`[${this.id}] Analyzing heading structure`);
    
    const headings = this.extractAllHeadings(content);
    const hierarchy = this.buildHeadingHierarchy(headings);
    const issues = this.identifyHeadingIssues(hierarchy);
    
    const result = {
      taskId: `heading-${Date.now()}`,
      heading_count: headings.length,
      hierarchy,
      issues,
      recommendations: this.generateHeadingRecommendations(hierarchy, issues),
      optimized_structure: this.generateOptimalHeadingStructure(content)
    };
    
    this.sendResult(result);
    return result;
  }

  // Helper methods
  calculateReadability(content) {
    const sentences = content.split(/[.!?]+/);
    const words = content.split(/\s+/);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);
    
    // Flesch Reading Ease
    const flesch = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
    
    // Flesch-Kincaid Grade Level
    const fkGrade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
    
    return {
      flesch_reading_ease: Math.round(flesch),
      flesch_kincaid_grade: Math.round(fkGrade),
      interpretation: this.interpretReadability(flesch),
      recommended_grade: '8-10'
    };
  }

  countSyllables(word) {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = ['a', 'e', 'i', 'o', 'u', 'y'].includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  }

  interpretReadability(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }

  analyzeKeywords(content, targetKeywords) {
    const lowerContent = content.toLowerCase();
    const analysis = {};
    
    targetKeywords.forEach(keyword => {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = lowerContent.match(regex) || [];
      const density = (matches.length / content.split(' ').length) * 100;
      
      analysis[keyword] = {
        count: matches.length,
        density: density.toFixed(2) + '%',
        optimal_density: '1-2%',
        status: density > 3 ? 'over-optimized' : density < 0.5 ? 'under-optimized' : 'good',
        positions: this.findKeywordPositions(content, keyword)
      };
    });
    
    return analysis;
  }

  findKeywordPositions(content, keyword) {
    const positions = [];
    const sections = ['title', 'first-100-words', 'headings', 'body', 'conclusion'];
    
    // Check title
    if (content.substring(0, 100).toLowerCase().includes(keyword.toLowerCase())) {
      positions.push('title');
    }
    
    // Check first 100 words
    if (content.substring(0, 500).toLowerCase().includes(keyword.toLowerCase())) {
      positions.push('first-100-words');
    }
    
    // Check last paragraph
    if (content.substring(content.length - 500).toLowerCase().includes(keyword.toLowerCase())) {
      positions.push('conclusion');
    }
    
    return positions;
  }

  analyzeStructure(content) {
    return {
      has_introduction: content.length > 100,
      has_conclusion: content.includes('conclusion') || content.includes('summary'),
      paragraph_count: content.split(/\n\n+/).length,
      avg_paragraph_length: Math.round(content.split(' ').length / content.split(/\n\n+/).length),
      has_lists: content.includes('•') || content.includes('1.') || content.includes('-'),
      has_images: content.includes('<img') || content.includes('!['),
      internal_links: (content.match(/\[.*?\]\(.*?\)/g) || []).length,
      external_links: (content.match(/https?:\/\//g) || []).length
    };
  }

  calculateSEOScore(data) {
    let score = 50; // Base score
    
    // Word count scoring
    if (data.wordCount >= 1500) score += 10;
    else if (data.wordCount >= 1000) score += 5;
    
    // Readability scoring
    if (data.readability.flesch_reading_ease >= 60) score += 10;
    
    // Keyword optimization
    Object.values(data.keywordAnalysis).forEach(kw => {
      if (kw.status === 'good') score += 5;
    });
    
    // Structure scoring
    if (data.structureAnalysis.has_introduction) score += 5;
    if (data.structureAnalysis.has_conclusion) score += 5;
    if (data.structureAnalysis.has_lists) score += 5;
    if (data.structureAnalysis.internal_links > 3) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  generateRecommendations(data) {
    const recommendations = [];
    
    if (data.wordCount < 1000) {
      recommendations.push({
        priority: 'high',
        category: 'content-length',
        message: 'Increase content length to at least 1000 words for better SEO',
        impact: 'high'
      });
    }
    
    if (data.readability.flesch_reading_ease < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'readability',
        message: 'Simplify sentences and use shorter words to improve readability',
        impact: 'medium'
      });
    }
    
    Object.entries(data.keywordAnalysis).forEach(([keyword, analysis]) => {
      if (analysis.status === 'under-optimized') {
        recommendations.push({
          priority: 'high',
          category: 'keyword-optimization',
          message: `Increase usage of "${keyword}" - currently at ${analysis.density}`,
          impact: 'high'
        });
      }
    });
    
    if (!data.structureAnalysis.has_lists) {
      recommendations.push({
        priority: 'low',
        category: 'formatting',
        message: 'Add bullet points or numbered lists to improve scannability',
        impact: 'low'
      });
    }
    
    return recommendations;
  }

  optimizeTitle(title, mainKeyword) {
    let optimized = title;
    
    // Ensure main keyword is in title
    if (!title.toLowerCase().includes(mainKeyword.toLowerCase())) {
      optimized = `${mainKeyword}: ${title}`;
    }
    
    // Optimize length (50-60 characters)
    if (optimized.length > 60) {
      optimized = optimized.substring(0, 57) + '...';
    }
    
    // Add power words if space allows
    const powerWords = ['Ultimate', 'Complete', 'Best', 'Essential', 'Proven'];
    if (optimized.length < 50) {
      const randomPowerWord = powerWords[Math.floor(Math.random() * powerWords.length)];
      optimized = `${randomPowerWord} ${optimized}`;
    }
    
    return optimized;
  }

  generateMetaDescription(content, keywords) {
    const firstParagraph = content.split('\n')[0];
    let description = firstParagraph.substring(0, 150);
    
    // Ensure primary keyword is included
    if (!description.toLowerCase().includes(keywords[0].toLowerCase())) {
      description = `${keywords[0]} - ${description}`;
    }
    
    // Add call to action
    const ctas = ['Learn more', 'Discover how', 'Find out', 'Get started'];
    const cta = ctas[Math.floor(Math.random() * ctas.length)];
    
    if (description.length < 140) {
      description += ` ${cta} today.`;
    }
    
    // Ensure proper length (150-160 characters)
    if (description.length > 160) {
      description = description.substring(0, 157) + '...';
    }
    
    return description;
  }

  generateSemanticKeywords(primaryKeywords) {
    const semanticMap = {
      'seo': ['search engine optimization', 'organic traffic', 'serp', 'ranking'],
      'keyword': ['search terms', 'queries', 'keyphrases', 'search volume'],
      'content': ['articles', 'blog posts', 'web pages', 'copy'],
      'optimization': ['improve', 'enhance', 'boost', 'increase'],
      'marketing': ['digital marketing', 'online marketing', 'promotion', 'advertising']
    };
    
    const semantic = [];
    primaryKeywords.forEach(keyword => {
      const words = keyword.toLowerCase().split(' ');
      words.forEach(word => {
        if (semanticMap[word]) {
          semantic.push(...semanticMap[word]);
        }
      });
    });
    
    return [...new Set(semantic)].slice(0, 10);
  }

  getTargetLength(contentType) {
    const lengths = {
      'blog-post': 1500,
      'landing-page': 800,
      'product-page': 500,
      'category-page': 300,
      'pillar-content': 3000,
      'faq-section': 1000
    };
    
    return lengths[contentType] || 1000;
  }

  extractTitle(content) {
    const lines = content.split('\n');
    return lines[0].replace(/^#\s*/, '');
  }

  extractHeadings(content) {
    const headingRegex = /^#{1,6}\s+(.+)$/gm;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1]);
    }
    
    return headings;
  }

  optimizeKeywordPlacement(content, keywords) {
    let optimized = content;
    
    keywords.forEach(keyword => {
      // Ensure keyword appears in first 100 words
      const first100 = optimized.substring(0, 500);
      if (!first100.toLowerCase().includes(keyword.toLowerCase())) {
        const firstSentenceEnd = first100.indexOf('.');
        if (firstSentenceEnd > 0) {
          optimized = optimized.substring(0, firstSentenceEnd) + 
                     ` The ${keyword} is important.` + 
                     optimized.substring(firstSentenceEnd);
        }
      }
    });
    
    return optimized;
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
      queueLength: this.optimizationQueue.length
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(status));
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
const agent = new SEOContentOptimizerAgent();
agent.initialize().catch(console.error);

// Handle shutdown signals
process.on('SIGTERM', () => agent.shutdown());
process.on('SIGINT', () => agent.shutdown());

module.exports = SEOContentOptimizerAgent;