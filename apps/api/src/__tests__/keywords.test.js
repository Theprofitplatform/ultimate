const request = require('supertest');
const express = require('express');
const keywordsRouter = require('../routes/Keywords.route');

// Mock the dependencies
jest.mock('../services/keywords.service');
jest.mock('../middleware/auth');

const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuthMiddleware = (req, res, next) => {
  req.user = {
    id: 'test-user-id',
    tenant_id: 'test-tenant-id',
    email: 'test@example.com'
  };
  next();
};

// Replace auth middleware with mock
jest.doMock('../middleware/auth', () => ({
  authMiddleware: mockAuthMiddleware
}));

app.use(keywordsRouter);

describe('Keywords API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/keywords', () => {
    it('should return keywords list with pagination', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      mockKeywordsService.getKeywords.mockResolvedValue({
        data: [
          {
            id: '1',
            keyword: 'seo tools',
            search_volume: 5000,
            keyword_difficulty: 45,
            cpc: 2.50
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false
        }
      });

      const response = await request(app)
        .get('/api/keywords')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle filtering parameters', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      mockKeywordsService.getKeywords.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false
        }
      });

      await request(app)
        .get('/api/keywords')
        .query({
          keyword: 'seo',
          search_volume_min: 1000,
          difficulty_max: 50
        })
        .expect(200);

      expect(mockKeywordsService.getKeywords).toHaveBeenCalledWith(
        'test-tenant-id',
        expect.objectContaining({
          keyword: 'seo',
          search_volume_min: 1000,
          difficulty_max: 50
        })
      );
    });
  });

  describe('POST /api/keywords', () => {
    it('should create a new keyword', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const newKeyword = {
        id: '1',
        keyword: 'new seo tool',
        search_volume: 3000,
        keyword_difficulty: 30,
        cpc: 1.75
      };

      mockKeywordsService.createKeyword.mockResolvedValue(newKeyword);

      const response = await request(app)
        .post('/api/keywords')
        .send({
          keyword: 'new seo tool',
          search_volume: 3000,
          keyword_difficulty: 30,
          cpc: 1.75
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newKeyword);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/keywords')
        .send({
          search_volume: 3000
          // Missing required 'keyword' field
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/keywords/bulk', () => {
    it('should bulk create keywords', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const bulkResults = [
        { success: true, data: { id: '1', keyword: 'keyword1' } },
        { success: true, data: { id: '2', keyword: 'keyword2' } }
      ];

      mockKeywordsService.bulkCreateKeywords.mockResolvedValue(bulkResults);

      const response = await request(app)
        .post('/api/keywords/bulk')
        .send({
          keywords: [
            { keyword: 'keyword1', search_volume: 1000 },
            { keyword: 'keyword2', search_volume: 2000 }
          ]
        })
        .expect(207);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_processed).toBe(2);
      expect(response.body.data.successful).toBe(2);
    });
  });

  describe('GET /api/keywords/:id', () => {
    it('should return a specific keyword', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const keyword = {
        id: '1',
        keyword: 'seo tools',
        search_volume: 5000,
        keyword_difficulty: 45
      };

      mockKeywordsService.getKeywordById.mockResolvedValue(keyword);

      const response = await request(app)
        .get('/api/keywords/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(keyword);
    });

    it('should return 404 for non-existent keyword', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      mockKeywordsService.getKeywordById.mockRejectedValue(
        new Error('Keyword not found')
      );

      await request(app)
        .get('/api/keywords/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });
  });

  describe('PUT /api/keywords/:id', () => {
    it('should update a keyword', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const updatedKeyword = {
        id: '1',
        keyword: 'updated seo tools',
        search_volume: 6000,
        keyword_difficulty: 50
      };

      mockKeywordsService.updateKeyword.mockResolvedValue(updatedKeyword);

      const response = await request(app)
        .put('/api/keywords/550e8400-e29b-41d4-a716-446655440000')
        .send({
          keyword: 'updated seo tools',
          search_volume: 6000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedKeyword);
    });
  });

  describe('DELETE /api/keywords/:id', () => {
    it('should soft delete a keyword', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      mockKeywordsService.deleteKeyword.mockResolvedValue({
        success: true,
        message: 'Keyword deleted successfully'
      });

      const response = await request(app)
        .delete('/api/keywords/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });
  });

  describe('POST /api/keywords/analyze', () => {
    it('should analyze keywords', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const analysisResult = {
        total_analyzed: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            keyword: 'seo tools',
            success: true,
            analysis: { search_volume: 5000, difficulty: 45 }
          }
        ]
      };

      mockKeywordsService.analyzeKeywords.mockResolvedValue(analysisResult);

      const response = await request(app)
        .post('/api/keywords/analyze')
        .send({
          keywords: ['seo tools', 'keyword research'],
          location: 'US',
          language: 'en'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(analysisResult);
    });
  });

  describe('GET /api/keywords/suggestions', () => {
    it('should return keyword suggestions', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const suggestions = {
        seed_keyword: 'seo',
        suggestions: [
          { keyword: 'seo tools', source: 'database', frequency: 5 },
          { keyword: 'seo tips', source: 'external', frequency: null }
        ],
        total_found: 2
      };

      mockKeywordsService.getKeywordSuggestions.mockResolvedValue(suggestions);

      const response = await request(app)
        .get('/api/keywords/suggestions')
        .query({ seed_keyword: 'seo' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(suggestions);
    });
  });

  describe('GET /api/keywords/analytics', () => {
    it('should return keyword analytics', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      const analytics = {
        total_keywords: 100,
        avg_search_volume: 2500,
        avg_difficulty: 45,
        avg_cpc: 2.25,
        ranking_distribution: {
          top_3: 10,
          top_10: 25,
          tracked: 75,
          untracked: 25
        }
      };

      mockKeywordsService.getAnalytics.mockResolvedValue(analytics);

      const response = await request(app)
        .get('/api/keywords/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_keywords).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockKeywordsService = require('../services/keywords.service');
      mockKeywordsService.getKeywords.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/keywords')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve keywords');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/keywords')
        .send({
          keyword: '', // Empty keyword should fail validation
          search_volume: -1 // Negative value should fail validation
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });
  });
});