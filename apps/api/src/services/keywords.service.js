const KeywordModel = require('../models/keyword.model');
const { Pool } = require('pg');

class KeywordsService {
  constructor() {
    // Initialize database connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.keywordModel = new KeywordModel(this.pool);
    this.cache = null; // Will be initialized with Redis if available

    // Initialize database tables
    this.initializeDatabase();
  }

  // Initialize Redis cache if available
  async initializeCache() {
    try {
      if (process.env.REDIS_URL) {
        const Redis = require('ioredis');
        this.cache = new Redis(process.env.REDIS_URL);

        this.cache.on('error', (err) => {
          console.warn('Redis connection error:', err.message);
          this.cache = null; // Disable caching on error
        });

        this.cache.on('connect', () => {
          console.log('Redis cache connected successfully');
        });
      }
    } catch (error) {
      console.warn('Redis not available, running without cache:', error.message);
      this.cache = null;
    }
  }

  async initializeDatabase() {
    try {
      await this.keywordModel.initializeTable();
      await this.initializeCache();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  // Cache helper methods
  async getCached(key) {
    if (!this.cache) return null;
    try {
      const cached = await this.cache.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  async setCache(key, value, ttl = 3600) {
    if (!this.cache) return;
    try {
      await this.cache.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }

  async invalidateCache(pattern) {
    if (!this.cache) return;
    try {
      const keys = await this.cache.keys(pattern);
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error.message);
    }
  }

  // Create a single keyword
  async createKeyword(tenant_id, keywordData) {
    try {
      // Add tenant_id to keyword data
      const data = { ...keywordData, tenant_id };

      // Check if keyword already exists for this tenant
      const existing = await this.findKeywordByName(
        tenant_id,
        data.keyword,
        data.location || 'global',
        data.language || 'en',
        data.device || 'desktop'
      );

      if (existing) {
        throw new Error('Keyword already exists for this location, language, and device combination');
      }

      const keyword = await this.keywordModel.create(data);

      // Invalidate relevant caches
      await this.invalidateCache(`keywords:${tenant_id}:*`);
      await this.invalidateCache(`analytics:${tenant_id}:*`);

      return keyword;
    } catch (error) {
      throw new Error(`Failed to create keyword: ${error.message}`);
    }
  }

  // Bulk create keywords
  async bulkCreateKeywords(tenant_id, keywordsData) {
    try {
      // Add tenant_id to all keywords
      const dataWithTenant = keywordsData.map(data => ({
        ...data,
        tenant_id
      }));

      const results = await this.keywordModel.bulkCreate(dataWithTenant);

      // Invalidate relevant caches
      await this.invalidateCache(`keywords:${tenant_id}:*`);
      await this.invalidateCache(`analytics:${tenant_id}:*`);

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk create keywords: ${error.message}`);
    }
  }

  // Get keywords with filtering and pagination
  async getKeywords(tenant_id, options = {}) {
    try {
      // Create cache key based on options
      const cacheKey = `keywords:${tenant_id}:${JSON.stringify(options)}`;

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.keywordModel.findMany({
        ...options,
        tenant_id
      });

      // Cache the result for 30 minutes
      await this.setCache(cacheKey, result, 1800);

      return result;
    } catch (error) {
      throw new Error(`Failed to get keywords: ${error.message}`);
    }
  }

  // Get a single keyword by ID
  async getKeywordById(tenant_id, keywordId) {
    try {
      const cacheKey = `keyword:${tenant_id}:${keywordId}`;

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      const keyword = await this.keywordModel.findById(keywordId, tenant_id);

      if (!keyword) {
        throw new Error('Keyword not found');
      }

      // Cache the result for 1 hour
      await this.setCache(cacheKey, keyword, 3600);

      return keyword;
    } catch (error) {
      throw new Error(`Failed to get keyword: ${error.message}`);
    }
  }

  // Update a keyword
  async updateKeyword(tenant_id, keywordId, updateData) {
    try {
      const keyword = await this.keywordModel.update(keywordId, tenant_id, updateData);

      if (!keyword) {
        throw new Error('Keyword not found or no changes made');
      }

      // Invalidate relevant caches
      await this.invalidateCache(`keyword:${tenant_id}:${keywordId}`);
      await this.invalidateCache(`keywords:${tenant_id}:*`);
      await this.invalidateCache(`analytics:${tenant_id}:*`);

      return keyword;
    } catch (error) {
      throw new Error(`Failed to update keyword: ${error.message}`);
    }
  }

  // Soft delete a keyword
  async deleteKeyword(tenant_id, keywordId) {
    try {
      const result = await this.keywordModel.softDelete(keywordId, tenant_id);

      if (!result) {
        throw new Error('Keyword not found');
      }

      // Invalidate relevant caches
      await this.invalidateCache(`keyword:${tenant_id}:${keywordId}`);
      await this.invalidateCache(`keywords:${tenant_id}:*`);
      await this.invalidateCache(`analytics:${tenant_id}:*`);

      return { success: true, message: 'Keyword deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete keyword: ${error.message}`);
    }
  }

  // Analyze keywords for competition and opportunities
  async analyzeKeywords(tenant_id, analysisData) {
    try {
      const {
        keywords,
        location = 'global',
        language = 'en',
        device = 'desktop',
        include_serp_analysis = true,
        include_competition_analysis = true
      } = analysisData;

      const results = [];

      for (const keyword of keywords) {
        try {
          // This would integrate with external APIs like SEMrush, Ahrefs, etc.
          const analysis = await this.performKeywordAnalysis(
            keyword,
            location,
            language,
            device,
            include_serp_analysis,
            include_competition_analysis
          );

          results.push({
            keyword,
            success: true,
            analysis
          });

          // Save or update the keyword in database if it doesn't exist
          try {
            await this.createKeyword(tenant_id, {
              keyword,
              location,
              language,
              device,
              ...analysis.metrics
            });
          } catch (createError) {
            // Keyword might already exist, try to update it
            const existing = await this.findKeywordByName(tenant_id, keyword, location, language, device);
            if (existing) {
              await this.updateKeyword(tenant_id, existing.id, {
                ...analysis.metrics,
                last_analyzed: new Date(),
                analysis_status: 'completed'
              });
            }
          }

        } catch (analysisError) {
          results.push({
            keyword,
            success: false,
            error: analysisError.message
          });
        }
      }

      return {
        total_analyzed: keywords.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };

    } catch (error) {
      throw new Error(`Failed to analyze keywords: ${error.message}`);
    }
  }

  // Mock keyword analysis (would integrate with real APIs)
  async performKeywordAnalysis(keyword, location, language, device, includeSERP, includeCompetition) {
    // This is a mock implementation
    // In production, this would call external APIs like:
    // - Google Keyword Planner API
    // - SEMrush API
    // - Ahrefs API
    // - DataForSEO API

    const mockAnalysis = {
      metrics: {
        search_volume: Math.floor(Math.random() * 10000) + 100,
        keyword_difficulty: Math.floor(Math.random() * 100),
        cpc: Math.round((Math.random() * 5 + 0.1) * 100) / 100,
        competition_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        trend_data: {
          last_12_months: Array.from({ length: 12 }, () => Math.floor(Math.random() * 100)),
          trend_direction: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)]
        },
        related_keywords: [
          `${keyword} tips`,
          `${keyword} guide`,
          `best ${keyword}`,
          `${keyword} 2024`
        ],
        serp_features: []
      },
      serp_analysis: null,
      competition_analysis: null
    };

    if (includeSERP) {
      mockAnalysis.serp_features = [
        'featured_snippet',
        'people_also_ask',
        'local_pack'
      ].filter(() => Math.random() > 0.5);

      mockAnalysis.serp_analysis = {
        total_results: Math.floor(Math.random() * 10000000) + 100000,
        paid_results_count: Math.floor(Math.random() * 10),
        organic_results_analyzed: 10,
        average_word_count: Math.floor(Math.random() * 2000) + 500,
        average_domain_authority: Math.floor(Math.random() * 100)
      };
    }

    if (includeCompetition) {
      mockAnalysis.competition_analysis = {
        top_competitors: [
          'example1.com',
          'example2.com',
          'example3.com'
        ],
        content_gaps: [
          `${keyword} tutorial`,
          `${keyword} comparison`,
          `${keyword} review`
        ],
        opportunity_score: Math.floor(Math.random() * 100)
      };
    }

    return mockAnalysis;
  }

  // Add ranking data for a keyword
  async addKeywordRanking(tenant_id, keywordId, rankingData) {
    try {
      // Verify keyword belongs to tenant
      const keyword = await this.getKeywordById(tenant_id, keywordId);
      if (!keyword) {
        throw new Error('Keyword not found');
      }

      const ranking = await this.keywordModel.addRanking(keywordId, {
        ...rankingData,
        check_date: rankingData.check_date || new Date().toISOString().split('T')[0]
      });

      // Update keyword with current position and best/worst positions
      const updateData = {
        current_position: rankingData.position,
        last_analyzed: new Date()
      };

      if (!keyword.best_position || rankingData.position < keyword.best_position) {
        updateData.best_position = rankingData.position;
      }

      if (!keyword.worst_position || rankingData.position > keyword.worst_position) {
        updateData.worst_position = rankingData.position;
      }

      await this.updateKeyword(tenant_id, keywordId, updateData);

      // Invalidate caches
      await this.invalidateCache(`keyword:${tenant_id}:${keywordId}`);
      await this.invalidateCache(`rankings:${tenant_id}:${keywordId}:*`);

      return ranking;
    } catch (error) {
      throw new Error(`Failed to add ranking: ${error.message}`);
    }
  }

  // Get ranking history for a keyword
  async getKeywordRankings(tenant_id, keywordId, days = 30) {
    try {
      const cacheKey = `rankings:${tenant_id}:${keywordId}:${days}`;

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      const rankings = await this.keywordModel.getRankingHistory(keywordId, tenant_id, days);

      // Cache the result for 1 hour
      await this.setCache(cacheKey, rankings, 3600);

      return rankings;
    } catch (error) {
      throw new Error(`Failed to get keyword rankings: ${error.message}`);
    }
  }

  // Export keywords data
  async exportKeywords(tenant_id, exportOptions) {
    try {
      const {
        format = 'csv',
        filters = {},
        fields = [
          'keyword', 'search_volume', 'keyword_difficulty', 'cpc',
          'competition_level', 'current_position', 'location',
          'language', 'device', 'created_at'
        ]
      } = exportOptions;

      // Get all keywords based on filters
      const result = await this.getKeywords(tenant_id, {
        ...filters,
        limit: 10000, // Large limit for export
        page: 1
      });

      const keywords = result.data;

      if (format === 'json') {
        return {
          format: 'json',
          data: keywords.map(keyword => {
            const exported = {};
            fields.forEach(field => {
              if (keyword[field] !== undefined) {
                exported[field] = keyword[field];
              }
            });
            return exported;
          })
        };
      }

      if (format === 'csv') {
        const csv = this.convertToCSV(keywords, fields);
        return {
          format: 'csv',
          data: csv,
          filename: `keywords_export_${new Date().toISOString().split('T')[0]}.csv`
        };
      }

      if (format === 'excel') {
        // In a real implementation, you'd use a library like xlsx
        const csv = this.convertToCSV(keywords, fields);
        return {
          format: 'excel',
          data: csv, // For now, return CSV data
          filename: `keywords_export_${new Date().toISOString().split('T')[0]}.xlsx`
        };
      }

      throw new Error('Unsupported export format');

    } catch (error) {
      throw new Error(`Failed to export keywords: ${error.message}`);
    }
  }

  // Convert data to CSV format
  convertToCSV(data, fields) {
    if (!data.length) return '';

    const headers = fields.join(',');
    const rows = data.map(item => {
      return fields.map(field => {
        let value = item[field];
        if (value === null || value === undefined) {
          value = '';
        } else if (typeof value === 'object') {
          value = JSON.stringify(value);
        } else if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  // Get keyword suggestions
  async getKeywordSuggestions(tenant_id, seedKeyword, options = {}) {
    try {
      const { limit = 50 } = options;
      const cacheKey = `suggestions:${tenant_id}:${seedKeyword}:${limit}`;

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      // Get suggestions from database
      const dbSuggestions = await this.keywordModel.getKeywordSuggestions(
        seedKeyword,
        tenant_id,
        Math.floor(limit / 2)
      );

      // In production, you'd also call external APIs for more suggestions
      const externalSuggestions = await this.getExternalKeywordSuggestions(
        seedKeyword,
        Math.ceil(limit / 2)
      );

      const allSuggestions = [
        ...dbSuggestions.map(s => ({ keyword: s.suggestion, source: 'database', frequency: s.frequency })),
        ...externalSuggestions.map(s => ({ keyword: s, source: 'external', frequency: null }))
      ];

      // Remove duplicates and limit results
      const uniqueSuggestions = [];
      const seen = new Set();

      for (const suggestion of allSuggestions) {
        if (!seen.has(suggestion.keyword) && uniqueSuggestions.length < limit) {
          seen.add(suggestion.keyword);
          uniqueSuggestions.push(suggestion);
        }
      }

      const result = {
        seed_keyword: seedKeyword,
        suggestions: uniqueSuggestions,
        total_found: uniqueSuggestions.length
      };

      // Cache the result for 6 hours
      await this.setCache(cacheKey, result, 21600);

      return result;

    } catch (error) {
      throw new Error(`Failed to get keyword suggestions: ${error.message}`);
    }
  }

  // Mock external keyword suggestions (would integrate with real APIs)
  async getExternalKeywordSuggestions(seedKeyword, limit) {
    // Mock suggestions - in production, integrate with:
    // - Google Autocomplete API
    // - Google Keyword Planner
    // - Ubersuggest API
    // - KeywordTool.io API

    const variations = [
      `${seedKeyword} tips`,
      `${seedKeyword} guide`,
      `${seedKeyword} tutorial`,
      `${seedKeyword} 2024`,
      `best ${seedKeyword}`,
      `${seedKeyword} review`,
      `${seedKeyword} comparison`,
      `${seedKeyword} vs`,
      `how to ${seedKeyword}`,
      `${seedKeyword} free`,
      `${seedKeyword} online`,
      `${seedKeyword} tool`,
      `${seedKeyword} software`,
      `${seedKeyword} app`,
      `${seedKeyword} service`
    ];

    return variations.slice(0, limit);
  }

  // Find keyword by name (helper method)
  async findKeywordByName(tenant_id, keyword, location, language, device) {
    try {
      const result = await this.keywordModel.findMany({
        tenant_id,
        keyword,
        location,
        language,
        device,
        limit: 1,
        page: 1
      });

      return result.data.length > 0 ? result.data[0] : null;
    } catch (error) {
      return null;
    }
  }

  // Get analytics and statistics
  async getAnalytics(tenant_id, dateRange = 30) {
    try {
      const cacheKey = `analytics:${tenant_id}:${dateRange}`;

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      const analytics = await this.keywordModel.getAnalytics(tenant_id, dateRange);

      // Add some calculated metrics
      const enrichedAnalytics = {
        ...analytics,
        avg_search_volume: Math.round(parseFloat(analytics.avg_search_volume) || 0),
        avg_difficulty: Math.round(parseFloat(analytics.avg_difficulty) || 0),
        avg_cpc: Math.round((parseFloat(analytics.avg_cpc) || 0) * 100) / 100,
        ranking_distribution: {
          top_3: parseInt(analytics.top_3_rankings),
          top_10: parseInt(analytics.top_10_rankings),
          tracked: parseInt(analytics.tracked_rankings),
          untracked: parseInt(analytics.total_keywords) - parseInt(analytics.tracked_rankings)
        },
        performance_metrics: {
          visibility_score: this.calculateVisibilityScore(analytics),
          opportunity_score: this.calculateOpportunityScore(analytics)
        }
      };

      // Cache the result for 2 hours
      await this.setCache(cacheKey, enrichedAnalytics, 7200);

      return enrichedAnalytics;

    } catch (error) {
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  }

  // Calculate visibility score based on rankings
  calculateVisibilityScore(analytics) {
    const totalKeywords = parseInt(analytics.total_keywords);
    const trackedKeywords = parseInt(analytics.tracked_rankings);
    const top3Rankings = parseInt(analytics.top_3_rankings);
    const top10Rankings = parseInt(analytics.top_10_rankings);

    if (totalKeywords === 0 || trackedKeywords === 0) return 0;

    const top3Weight = 0.6;
    const top10Weight = 0.3;
    const trackedWeight = 0.1;

    const score = (
      (top3Rankings / trackedKeywords) * top3Weight +
      (top10Rankings / trackedKeywords) * top10Weight +
      (trackedKeywords / totalKeywords) * trackedWeight
    ) * 100;

    return Math.round(score);
  }

  // Calculate opportunity score
  calculateOpportunityScore(analytics) {
    const avgDifficulty = parseFloat(analytics.avg_difficulty) || 0;
    const avgSearchVolume = parseFloat(analytics.avg_search_volume) || 0;
    const trackedPercentage = (parseInt(analytics.tracked_rankings) / parseInt(analytics.total_keywords)) * 100;

    // Lower difficulty + higher search volume + more tracking = higher opportunity
    const difficultyScore = (100 - avgDifficulty) / 100;
    const volumeScore = Math.min(avgSearchVolume / 10000, 1); // Normalize to max 10k volume
    const trackingScore = trackedPercentage / 100;

    const score = (difficultyScore * 0.4 + volumeScore * 0.4 + trackingScore * 0.2) * 100;

    return Math.round(score);
  }

  // Cleanup method
  async cleanup() {
    try {
      if (this.cache) {
        await this.cache.disconnect();
      }
      await this.pool.end();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new KeywordsService();