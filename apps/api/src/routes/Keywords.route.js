const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const keywordsController = require('../controllers/keywords.controller');
const KeywordValidator = require('../validators/keyword.validator');

// Import the legacy controller for backward compatibility
const { KeywordsController } = require('../controllers/Keywords');

// Middleware for tenant isolation (to be created)
const tenantMiddleware = (req, res, next) => {
  // This middleware ensures tenant isolation
  // In a real implementation, extract tenant_id from JWT token or request headers
  if (!req.user || (!req.user.tenant_id && !req.user.id)) {
    return res.status(401).json({
      success: false,
      error: 'Tenant identification required'
    });
  }
  next();
};

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  console.error('Keywords API Error:', error);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.message
    });
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      message: 'Keyword already exists'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

// GET /api/keywords - List keywords with pagination and filtering
router.get(
  '/api/keywords',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.listKeywords(),
  KeywordValidator.validateSearchVolumeRange,
  KeywordValidator.validateDifficultyRange,
  keywordsController.getKeywords
);

// POST /api/keywords - Create a single keyword
router.post(
  '/api/keywords',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.createKeyword(),
  keywordsController.createKeyword
);

// POST /api/keywords/bulk - Bulk create keywords
router.post(
  '/api/keywords/bulk',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.bulkCreateKeywords(),
  keywordsController.bulkCreateKeywords
);

// GET /api/keywords/suggestions - Get keyword suggestions (before :id route)
router.get(
  '/api/keywords/suggestions',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.getKeywordSuggestions(),
  keywordsController.getKeywordSuggestions
);

// GET /api/keywords/analytics - Get analytics and statistics
router.get(
  '/api/keywords/analytics',
  authMiddleware,
  tenantMiddleware,
  keywordsController.getAnalytics
);

// POST /api/keywords/analyze - Analyze keywords for competition and opportunities
router.post(
  '/api/keywords/analyze',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.analyzeKeywords(),
  keywordsController.analyzeKeywords
);

// POST /api/keywords/export - Export keywords to CSV/Excel/JSON
router.post(
  '/api/keywords/export',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.exportKeywords(),
  keywordsController.exportKeywords
);

// GET /api/keywords/:id - Get a single keyword
router.get(
  '/api/keywords/:id',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.validateId(),
  keywordsController.getKeywordById
);

// PUT /api/keywords/:id - Update a keyword
router.put(
  '/api/keywords/:id',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.updateKeyword(),
  keywordsController.updateKeyword
);

// DELETE /api/keywords/:id - Soft delete a keyword
router.delete(
  '/api/keywords/:id',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.validateId(),
  keywordsController.deleteKeyword
);

// GET /api/keywords/:id/rankings - Get ranking history for a keyword
router.get(
  '/api/keywords/:id/rankings',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.validateId(),
  keywordsController.getKeywordRankings
);

// POST /api/keywords/:id/rankings - Add ranking data for a keyword
router.post(
  '/api/keywords/:id/rankings',
  authMiddleware,
  tenantMiddleware,
  KeywordValidator.addRanking(),
  keywordsController.addKeywordRanking
);

// Legacy route for backward compatibility
router.get(
  '/api/keywords/legacy',
  authMiddleware,
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await KeywordsController.handle(req.body, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
router.use(errorHandler);

module.exports = router;