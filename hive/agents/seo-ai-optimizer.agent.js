#!/usr/bin/env node

/**
 * AI-Powered SEO Optimization Agent
 * Uses Ollama for intelligent content analysis and optimization
 */

const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const { GoogleSearchAPI } = require('../services/google-search');
const { ContentAnalyzer } = require('../services/content-analyzer');

class SEOAIOptimizerAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent-seo-ai-optimizer',
      type: 'seo',
      version: '3.0.0',
      capabilities: {
        ai_analysis: [
          'content-quality-scoring',
          'readability-enhancement',
          'keyword-optimization',
          'semantic-enrichment',
          'competitor-comparison',
          'content-gap-analysis',
          'search-intent-matching'
        ],
        content_generation: [
          'title-generation',
          'meta-description-creation',
          'content-rewriting',
          'schema-markup-generation',
          'faq-generation',
          'outline-creation'
        ],
        technical_seo: [
          'page-speed-analysis',
          'mobile-optimization',
          'structured-data-validation',
          'crawlability-check',
          'indexability-analysis'
        ],
        real_time_analysis: [
          'serp-monitoring',
          'ranking-tracking',
          'competitor-monitoring',
          'trend-detection'
        ]
      }
    });
    
    // SEO-specific services
    this.googleSearch = new GoogleSearchAPI();
    this.contentAnalyzer = new ContentAnalyzer();
    this.tfidf = new natural.TfIdf();
    this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    
    // Cache for expensive operations
    this.serpCache = new Map();
    this.competitorCache = new Map();
    
    // Register task handlers
    this.registerHandlers();
  }
  
  registerHandlers() {
    // Content optimization handlers
    this.registerTaskHandler('optimize-content', this.optimizeContent);
    this.registerTaskHandler('analyze-competitors', this.analyzeCompetitors);
    this.registerTaskHandler('generate-content', this.generateContent);
    this.registerTaskHandler('keyword-research', this.performKeywordResearch);
    this.registerTaskHandler('technical-audit', this.performTechnicalAudit);
    this.registerTaskHandler('serp-analysis', this.analyzeSERP);
    this.registerTaskHandler('content-gap', this.findContentGaps);
    this.registerTaskHandler('schema-generation', this.generateSchema);
  }
  
  async optimizeContent(task) {
    const { url, content, targetKeywords, competitors } = task.params;
    
    this.logger.info({ url, keywords: targetKeywords }, 'Starting content optimization');
    
    try {
      // Step 1: Analyze current content with AI
      const contentAnalysis = await this.analyzeContentWithAI(content, targetKeywords);
      
      // Step 2: Analyze competitor content
      const competitorAnalysis = await this.analyzeCompetitorContent(competitors, targetKeywords);
      
      // Step 3: Identify optimization opportunities
      const opportunities = await this.identifyOpportunities(
        contentAnalysis,
        competitorAnalysis,
        targetKeywords
      );
      
      // Step 4: Generate optimized content
      const optimizedContent = await this.generateOptimizedContent(
        content,
        opportunities,
        targetKeywords
      );
      
      // Step 5: Generate metadata
      const metadata = await this.generateMetadata(optimizedContent, targetKeywords);
      
      // Step 6: Create schema markup
      const schema = await this.createSchemaMarkup(optimizedContent, metadata);
      
      // Step 7: Calculate content score
      const score = await this.calculateContentScore(optimizedContent, targetKeywords);
      
      return {
        optimizedContent,
        metadata,
        schema,
        score,
        opportunities,
        improvements: contentAnalysis.improvements
      };
    } catch (error) {
      this.logger.error({ error, taskId: task.id }, 'Content optimization failed');
      throw error;
    }
  }
  
  async analyzeContentWithAI(content, keywords) {
    const prompt = `
      Analyze this content for SEO optimization:
      
      Content: ${content.substring(0, 2000)}
      Target Keywords: ${keywords.join(', ')}
      
      Provide analysis for:
      1. Keyword density and placement
      2. Content readability score
      3. Semantic relevance to keywords
      4. Missing topics that should be covered
      5. Content structure improvements
      6. User intent alignment
      
      Format response as JSON with scores and specific recommendations.
    `;
    
    const aiResponse = await this.callOllama(prompt);
    
    // Parse AI response and combine with algorithmic analysis
    const readabilityScore = this.calculateReadability(content);
    const keywordDensity = this.calculateKeywordDensity(content, keywords);
    const semanticScore = this.calculateSemanticRelevance(content, keywords);
    
    return {
      aiAnalysis: this.parseAIResponse(aiResponse),
      readability: readabilityScore,
      keywordDensity,
      semanticScore,
      improvements: this.generateImprovements(aiResponse, readabilityScore, keywordDensity)
    };
  }
  
  async analyzeCompetitorContent(competitors, keywords) {
    const analyses = [];
    
    for (const competitor of competitors.slice(0, 5)) {
      const cachedAnalysis = this.competitorCache.get(competitor);
      
      if (cachedAnalysis && Date.now() - cachedAnalysis.timestamp < 3600000) {
        analyses.push(cachedAnalysis.data);
        continue;
      }
      
      try {
        // Fetch competitor content
        const response = await axios.get(competitor, {
          headers: { 'User-Agent': 'SEO-Analyzer-Bot/1.0' },
          timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const competitorContent = $('body').text();
        const title = $('title').text();
        const metaDescription = $('meta[name="description"]').attr('content');
        
        // Analyze with AI
        const prompt = `
          Analyze competitor SEO strategy:
          Title: ${title}
          Meta: ${metaDescription}
          Content preview: ${competitorContent.substring(0, 1000)}
          
          Identify:
          1. Main topics covered
          2. Content structure
          3. Keyword usage patterns
          4. Unique value propositions
          5. Content gaps
        `;
        
        const aiAnalysis = await this.callOllama(prompt);
        
        const analysis = {
          url: competitor,
          title,
          metaDescription,
          wordCount: competitorContent.split(/\s+/).length,
          headings: this.extractHeadings($),
          keywords: this.extractKeywords(competitorContent),
          aiInsights: this.parseAIResponse(aiAnalysis)
        };
        
        // Cache the analysis
        this.competitorCache.set(competitor, {
          timestamp: Date.now(),
          data: analysis
        });
        
        analyses.push(analysis);
      } catch (error) {
        this.logger.warn({ error, competitor }, 'Failed to analyze competitor');
      }
    }
    
    return this.aggregateCompetitorInsights(analyses);
  }
  
  async identifyOpportunities(contentAnalysis, competitorAnalysis, keywords) {
    const prompt = `
      Based on content analysis and competitor insights, identify optimization opportunities:
      
      Current content strengths: ${JSON.stringify(contentAnalysis.aiAnalysis.strengths || [])}
      Current weaknesses: ${JSON.stringify(contentAnalysis.improvements)}
      
      Competitor strengths: ${JSON.stringify(competitorAnalysis.strengths || [])}
      Competitor gaps: ${JSON.stringify(competitorAnalysis.gaps || [])}
      
      Target keywords: ${keywords.join(', ')}
      
      Provide specific, actionable opportunities for:
      1. Content additions
      2. Structure improvements
      3. Keyword optimization
      4. User experience enhancements
      5. Competitive advantages
    `;
    
    const aiResponse = await this.callOllama(prompt);
    const opportunities = this.parseAIResponse(aiResponse);
    
    // Prioritize opportunities
    return this.prioritizeOpportunities(opportunities, keywords);
  }
  
  async generateOptimizedContent(originalContent, opportunities, keywords) {
    const prompt = `
      Rewrite and optimize this content for SEO:
      
      Original: ${originalContent.substring(0, 1500)}
      
      Optimization goals:
      ${opportunities.map(o => `- ${o.description}`).join('\n')}
      
      Target keywords to naturally include: ${keywords.join(', ')}
      
      Requirements:
      1. Maintain factual accuracy
      2. Improve readability
      3. Add semantic variations of keywords
      4. Enhance user value
      5. Optimize for featured snippets
      
      Generate optimized version:
    `;
    
    const optimizedText = await this.callOllama(prompt);
    
    // Post-process the content
    return this.postProcessContent(optimizedText, keywords);
  }
  
  async generateMetadata(content, keywords) {
    const prompt = `
      Generate SEO metadata for this content:
      
      Content summary: ${content.substring(0, 500)}
      Primary keywords: ${keywords.slice(0, 3).join(', ')}
      
      Create:
      1. Title tag (50-60 chars, include primary keyword)
      2. Meta description (150-160 chars, compelling CTA)
      3. H1 heading (clear, keyword-optimized)
      4. OG title and description
      5. Twitter card metadata
      
      Format as JSON.
    `;
    
    const aiResponse = await this.callOllama(prompt);
    const metadata = this.parseAIResponse(aiResponse);
    
    // Validate and adjust metadata
    return this.validateMetadata(metadata, keywords);
  }
  
  async createSchemaMarkup(content, metadata) {
    const prompt = `
      Generate JSON-LD schema markup for:
      
      Title: ${metadata.title}
      Description: ${metadata.description}
      Content type: Article/BlogPost
      
      Include:
      1. Article schema
      2. BreadcrumbList
      3. FAQPage (if applicable)
      4. HowTo (if applicable)
      5. Author and Organization
      
      Return valid JSON-LD.
    `;
    
    const schemaResponse = await this.callOllama(prompt);
    
    try {
      const schema = JSON.parse(schemaResponse);
      return this.validateSchema(schema);
    } catch (error) {
      this.logger.warn('Failed to parse AI-generated schema, using template');
      return this.generateSchemaTemplate(metadata);
    }
  }
  
  async performKeywordResearch(task) {
    const { seed, market, intent } = task.params;
    
    const prompt = `
      Perform keyword research for:
      Seed keyword: ${seed}
      Market: ${market}
      Search intent: ${intent}
      
      Generate:
      1. 20 long-tail variations
      2. Related questions
      3. Semantic variations
      4. Competitor keywords
      5. Trending related terms
      
      Include estimated difficulty (easy/medium/hard) and intent type.
    `;
    
    const aiKeywords = await this.callOllama(prompt);
    
    // Enhance with real data if available
    const serpData = await this.fetchSERPData(seed);
    const relatedSearches = this.extractRelatedSearches(serpData);
    
    return {
      keywords: this.parseKeywordSuggestions(aiKeywords),
      relatedSearches,
      questions: this.extractPeopleAlsoAsk(serpData),
      trends: await this.analyzeTrends(seed)
    };
  }
  
  async performTechnicalAudit(task) {
    const { url } = task.params;
    
    try {
      // Fetch page
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'SEO-Audit-Bot/1.0' },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      // Technical checks
      const audit = {
        performance: await this.checkPageSpeed(url),
        mobile: this.checkMobileOptimization($),
        structured: this.validateStructuredData($),
        crawlability: this.checkCrawlability($, response.headers),
        security: this.checkSecurity(response),
        accessibility: this.checkAccessibility($),
        core_web_vitals: await this.measureCoreWebVitals(url)
      };
      
      // AI-powered recommendations
      const prompt = `
        Technical SEO audit results:
        ${JSON.stringify(audit, null, 2)}
        
        Provide:
        1. Priority issues to fix
        2. Quick wins
        3. Long-term improvements
        4. Implementation guide
        
        Focus on impact and effort required.
      `;
      
      const recommendations = await this.callOllama(prompt);
      
      return {
        audit,
        recommendations: this.parseAIResponse(recommendations),
        score: this.calculateTechnicalScore(audit)
      };
    } catch (error) {
      this.logger.error({ error, url }, 'Technical audit failed');
      throw error;
    }
  }
  
  // Helper methods
  calculateReadability(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    // Flesch Reading Ease
    const flesch = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
    
    return {
      score: Math.max(0, Math.min(100, flesch)),
      grade: this.getGradeLevel(flesch),
      avgSentenceLength: words.length / sentences.length,
      avgSyllablesPerWord: syllables / words.length
    };
  }
  
  calculateKeywordDensity(content, keywords) {
    const words = content.toLowerCase().split(/\s+/);
    const densities = {};
    
    for (const keyword of keywords) {
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      let count = 0;
      
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        if (keywordWords.every((kw, j) => words[i + j] === kw)) {
          count++;
        }
      }
      
      densities[keyword] = {
        count,
        density: (count * keywordWords.length / words.length) * 100
      };
    }
    
    return densities;
  }
  
  calculateSemanticRelevance(content, keywords) {
    this.tfidf.addDocument(content);
    
    const scores = keywords.map(keyword => {
      const terms = keyword.split(/\s+/);
      const termScores = terms.map(term => this.tfidf.tfidf(term, 0));
      return {
        keyword,
        score: termScores.reduce((a, b) => a + b, 0) / terms.length
      };
    });
    
    return scores;
  }
  
  parseAIResponse(response) {
    try {
      // Try to parse as JSON first
      return JSON.parse(response);
    } catch {
      // Fall back to structured text parsing
      const lines = response.split('\n');
      const parsed = {};
      let currentSection = null;
      
      for (const line of lines) {
        if (line.match(/^\d+\.|^-|^\*/)) {
          if (!currentSection) currentSection = 'items';
          if (!parsed[currentSection]) parsed[currentSection] = [];
          parsed[currentSection].push(line.replace(/^[\d+\.\-\*]\s*/, '').trim());
        } else if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            currentSection = key.toLowerCase().replace(/\s+/g, '_');
            parsed[currentSection] = value;
          }
        }
      }
      
      return parsed;
    }
  }
  
  countSyllables(word) {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = /[aeiou]/.test(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) count--;
    
    // Ensure at least 1 syllable
    return Math.max(1, count);
  }
  
  getGradeLevel(fleschScore) {
    if (fleschScore >= 90) return 'Very Easy (5th grade)';
    if (fleschScore >= 80) return 'Easy (6th grade)';
    if (fleschScore >= 70) return 'Fairly Easy (7th grade)';
    if (fleschScore >= 60) return 'Standard (8-9th grade)';
    if (fleschScore >= 50) return 'Fairly Difficult (10-12th grade)';
    if (fleschScore >= 30) return 'Difficult (College)';
    return 'Very Difficult (Graduate)';
  }
  
  async measureCoreWebVitals(url) {
    // Simulate Core Web Vitals measurement
    // In production, use Lighthouse or CrUX API
    return {
      lcp: Math.random() * 2.5 + 0.5, // Largest Contentful Paint
      fid: Math.random() * 100 + 10,   // First Input Delay
      cls: Math.random() * 0.1         // Cumulative Layout Shift
    };
  }
  
  calculateTechnicalScore(audit) {
    const weights = {
      performance: 0.3,
      mobile: 0.2,
      structured: 0.15,
      crawlability: 0.15,
      security: 0.1,
      accessibility: 0.1
    };
    
    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (audit[key] && audit[key].score !== undefined) {
        totalScore += audit[key].score * weight;
      }
    }
    
    return Math.round(totalScore);
  }
}

// Initialize and start the agent
if (require.main === module) {
  const agent = new SEOAIOptimizerAgent();
  agent.initialize().catch(console.error);
}