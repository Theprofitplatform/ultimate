const keywordsService = require('../services/keywords.service');
const { validationResult } = require('express-validator');

class KeywordsController {
  constructor() {
    // Bind methods to preserve 'this' context
    this.getKeywords = this.getKeywords.bind(this);
    this.createKeyword = this.createKeyword.bind(this);
    this.bulkCreateKeywords = this.bulkCreateKeywords.bind(this);
    this.getKeywordById = this.getKeywordById.bind(this);
    this.updateKeyword = this.updateKeyword.bind(this);
    this.deleteKeyword = this.deleteKeyword.bind(this);
    this.analyzeKeywords = this.analyzeKeywords.bind(this);
    this.getKeywordRankings = this.getKeywordRankings.bind(this);
    this.addKeywordRanking = this.addKeywordRanking.bind(this);
    this.exportKeywords = this.exportKeywords.bind(this);
    this.getKeywordSuggestions = this.getKeywordSuggestions.bind(this);
    this.getAnalytics = this.getAnalytics.bind(this);
  }

  // Handle validation errors
  handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    return null;
  }

  // Get tenant ID from user (assuming it's set by auth middleware)
  getTenantId(req) {
    return req.user?.tenant_id || req.user?.id; // Fallback to user ID if no tenant_id
  }

  // GET /api/keywords - List keywords with pagination and filtering
  async getKeywords(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const options = {
        keyword: req.query.keyword,
        search_volume_min: req.query.search_volume_min ? parseInt(req.query.search_volume_min) : undefined,
        search_volume_max: req.query.search_volume_max ? parseInt(req.query.search_volume_max) : undefined,
        difficulty_min: req.query.difficulty_min ? parseInt(req.query.difficulty_min) : undefined,
        difficulty_max: req.query.difficulty_max ? parseInt(req.query.difficulty_max) : undefined,
        competition_level: req.query.competition_level,
        location: req.query.location,
        language: req.query.language,
        device: req.query.device,
        sort_by: req.query.sort_by || 'created_at',
        sort_order: req.query.sort_order || 'DESC',
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        include_deleted: req.query.include_deleted === 'true'
      };

      const result = await keywordsService.getKeywords(tenant_id, options);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        filters_applied: Object.keys(req.query).length > 0
      });

    } catch (error) {
      console.error('Get keywords error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve keywords',
        message: error.message
      });
    }
  }

  // POST /api/keywords - Create a single keyword
  async createKeyword(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const keyword = await keywordsService.createKeyword(tenant_id, req.body);

      res.status(201).json({
        success: true,
        data: keyword,
        message: 'Keyword created successfully'
      });

    } catch (error) {
      console.error('Create keyword error:', error);

      const statusCode = error.message.includes('already exists') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to create keyword',
        message: error.message
      });
    }
  }

  // POST /api/keywords/bulk - Bulk create keywords
  async bulkCreateKeywords(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { keywords } = req.body;
      const results = await keywordsService.bulkCreateKeywords(tenant_id, keywords);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(207).json({ // Multi-Status
        success: true,
        data: {
          total_processed: keywords.length,
          successful: successCount,
          failed: failureCount,
          results: results
        },
        message: `Bulk import completed: ${successCount} successful, ${failureCount} failed`
      });

    } catch (error) {
      console.error('Bulk create keywords error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk create keywords',
        message: error.message
      });
    }
  }

  // GET /api/keywords/:id - Get a single keyword
  async getKeywordById(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { id } = req.params;
      const keyword = await keywordsService.getKeywordById(tenant_id, id);

      res.json({
        success: true,
        data: keyword
      });

    } catch (error) {
      console.error('Get keyword by ID error:', error);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to retrieve keyword',
        message: error.message
      });
    }
  }

  // PUT /api/keywords/:id - Update a keyword
  async updateKeyword(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { id } = req.params;
      const keyword = await keywordsService.updateKeyword(tenant_id, id, req.body);

      res.json({
        success: true,
        data: keyword,
        message: 'Keyword updated successfully'
      });

    } catch (error) {
      console.error('Update keyword error:', error);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to update keyword',
        message: error.message
      });
    }
  }

  // DELETE /api/keywords/:id - Soft delete a keyword
  async deleteKeyword(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { id } = req.params;
      const result = await keywordsService.deleteKeyword(tenant_id, id);

      res.json({
        success: true,
        data: result,
        message: 'Keyword deleted successfully'
      });

    } catch (error) {
      console.error('Delete keyword error:', error);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to delete keyword',
        message: error.message
      });
    }
  }

  // POST /api/keywords/analyze - Analyze keywords for competition and opportunities
  async analyzeKeywords(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const analysisResult = await keywordsService.analyzeKeywords(tenant_id, req.body);

      res.json({
        success: true,
        data: analysisResult,
        message: `Analysis completed: ${analysisResult.successful}/${analysisResult.total_analyzed} keywords analyzed successfully`
      });

    } catch (error) {
      console.error('Analyze keywords error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze keywords',
        message: error.message
      });
    }
  }

  // GET /api/keywords/:id/rankings - Get ranking history for a keyword
  async getKeywordRankings(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { id } = req.params;
      const days = req.query.days ? parseInt(req.query.days) : 30;

      const rankings = await keywordsService.getKeywordRankings(tenant_id, id, days);

      res.json({
        success: true,
        data: {
          keyword_id: id,
          period_days: days,
          rankings: rankings,
          total_records: rankings.length
        }
      });

    } catch (error) {
      console.error('Get keyword rankings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve keyword rankings',
        message: error.message
      });
    }
  }

  // POST /api/keywords/:id/rankings - Add ranking data for a keyword
  async addKeywordRanking(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const { id } = req.params;
      const ranking = await keywordsService.addKeywordRanking(tenant_id, id, req.body);

      res.status(201).json({
        success: true,
        data: ranking,
        message: 'Ranking data added successfully'
      });

    } catch (error) {
      console.error('Add keyword ranking error:', error);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to add ranking data',
        message: error.message
      });
    }
  }

  // POST /api/keywords/export - Export keywords to CSV/Excel
  async exportKeywords(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const exportResult = await keywordsService.exportKeywords(tenant_id, req.body);

      if (exportResult.format === 'json') {
        res.json({
          success: true,
          data: exportResult.data,
          format: 'json'
        });
      } else {
        // For CSV and Excel, set appropriate headers
        const contentType = exportResult.format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.send(exportResult.data);
      }

    } catch (error) {
      console.error('Export keywords error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export keywords',
        message: error.message
      });
    }
  }

  // GET /api/keywords/suggestions - Get keyword suggestions
  async getKeywordSuggestions(req, res) {
    try {
      const validationError = this.handleValidationErrors(req, res);
      if (validationError) return validationError;

      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const seedKeyword = req.query.seed_keyword;
      const options = {
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        location: req.query.location,
        language: req.query.language
      };

      const suggestions = await keywordsService.getKeywordSuggestions(tenant_id, seedKeyword, options);

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      console.error('Get keyword suggestions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get keyword suggestions',
        message: error.message
      });
    }
  }

  // GET /api/keywords/analytics - Get keyword analytics and statistics
  async getAnalytics(req, res) {
    try {
      const tenant_id = this.getTenantId(req);
      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant ID not found'
        });
      }

      const dateRange = req.query.days ? parseInt(req.query.days) : 30;
      const analytics = await keywordsService.getAnalytics(tenant_id, dateRange);

      res.json({
        success: true,
        data: {
          period_days: dateRange,
          ...analytics
        }
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        message: error.message
      });
    }
  }

  // Legacy handle method for backward compatibility
  async handle(data, user) {
    // This maintains compatibility with the existing route structure
    return {
      message: 'Keywords endpoint - use specific routes for functionality',
      available_endpoints: [
        'GET /api/keywords - List keywords',
        'POST /api/keywords - Create keyword',
        'POST /api/keywords/bulk - Bulk create',
        'GET /api/keywords/:id - Get keyword',
        'PUT /api/keywords/:id - Update keyword',
        'DELETE /api/keywords/:id - Delete keyword',
        'POST /api/keywords/analyze - Analyze keywords',
        'GET /api/keywords/:id/rankings - Get rankings',
        'POST /api/keywords/export - Export data',
        'GET /api/keywords/suggestions - Get suggestions',
        'GET /api/keywords/analytics - Get analytics'
      ],
      user_id: user?.id,
      data_received: data
    };
  }
}

module.exports = new KeywordsController();