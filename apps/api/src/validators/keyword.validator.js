const { body, query, param } = require('express-validator');

class KeywordValidator {
  // Validation for creating a single keyword
  static createKeyword() {
    return [
      body('keyword')
        .notEmpty()
        .withMessage('Keyword is required')
        .isLength({ min: 1, max: 255 })
        .withMessage('Keyword must be between 1 and 255 characters')
        .trim(),

      body('search_volume')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Search volume must be a non-negative integer'),

      body('keyword_difficulty')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Keyword difficulty must be between 0 and 100'),

      body('cpc')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('CPC must be a non-negative number'),

      body('competition_level')
        .optional()
        .isIn(['low', 'medium', 'high', 'unknown'])
        .withMessage('Competition level must be low, medium, high, or unknown'),

      body('trend_data')
        .optional()
        .isObject()
        .withMessage('Trend data must be an object'),

      body('related_keywords')
        .optional()
        .isArray()
        .withMessage('Related keywords must be an array'),

      body('related_keywords.*')
        .optional()
        .isString()
        .isLength({ max: 255 })
        .withMessage('Each related keyword must be a string with max 255 characters'),

      body('serp_features')
        .optional()
        .isArray()
        .withMessage('SERP features must be an array'),

      body('serp_features.*')
        .optional()
        .isString()
        .isIn([
          'featured_snippet', 'people_also_ask', 'local_pack',
          'shopping_results', 'image_pack', 'video_results',
          'news_results', 'knowledge_panel', 'site_links'
        ])
        .withMessage('Invalid SERP feature'),

      body('location')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Location must be a string with max 100 characters'),

      body('language')
        .optional()
        .isString()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language must be a valid language code'),

      body('device')
        .optional()
        .isIn(['desktop', 'mobile', 'tablet'])
        .withMessage('Device must be desktop, mobile, or tablet')
    ];
  }

  // Validation for bulk keyword creation
  static bulkCreateKeywords() {
    return [
      body('keywords')
        .isArray({ min: 1, max: 1000 })
        .withMessage('Keywords must be an array with 1-1000 items'),

      body('keywords.*.keyword')
        .notEmpty()
        .withMessage('Each keyword is required')
        .isLength({ min: 1, max: 255 })
        .withMessage('Each keyword must be between 1 and 255 characters')
        .trim(),

      body('keywords.*.search_volume')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Search volume must be a non-negative integer'),

      body('keywords.*.keyword_difficulty')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Keyword difficulty must be between 0 and 100'),

      body('keywords.*.cpc')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('CPC must be a non-negative number'),

      body('keywords.*.competition_level')
        .optional()
        .isIn(['low', 'medium', 'high', 'unknown'])
        .withMessage('Competition level must be low, medium, high, or unknown')
    ];
  }

  // Validation for updating a keyword
  static updateKeyword() {
    return [
      param('id')
        .isUUID()
        .withMessage('Invalid keyword ID format'),

      body('keyword')
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage('Keyword must be between 1 and 255 characters')
        .trim(),

      body('search_volume')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Search volume must be a non-negative integer'),

      body('keyword_difficulty')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Keyword difficulty must be between 0 and 100'),

      body('cpc')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('CPC must be a non-negative number'),

      body('competition_level')
        .optional()
        .isIn(['low', 'medium', 'high', 'unknown'])
        .withMessage('Competition level must be low, medium, high, or unknown'),

      body('current_position')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Current position must be a positive integer'),

      body('best_position')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Best position must be a positive integer'),

      body('worst_position')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Worst position must be a positive integer'),

      body('analysis_status')
        .optional()
        .isIn(['pending', 'analyzing', 'completed', 'failed'])
        .withMessage('Analysis status must be pending, analyzing, completed, or failed')
    ];
  }

  // Validation for keyword listing/filtering
  static listKeywords() {
    return [
      query('keyword')
        .optional()
        .isString()
        .isLength({ max: 255 })
        .withMessage('Keyword filter must be a string with max 255 characters'),

      query('search_volume_min')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Minimum search volume must be a non-negative integer'),

      query('search_volume_max')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Maximum search volume must be a non-negative integer'),

      query('difficulty_min')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Minimum difficulty must be between 0 and 100'),

      query('difficulty_max')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Maximum difficulty must be between 0 and 100'),

      query('competition_level')
        .optional()
        .isIn(['low', 'medium', 'high', 'unknown'])
        .withMessage('Competition level must be low, medium, high, or unknown'),

      query('location')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Location must be a string with max 100 characters'),

      query('language')
        .optional()
        .isString()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language must be a valid language code'),

      query('device')
        .optional()
        .isIn(['desktop', 'mobile', 'tablet'])
        .withMessage('Device must be desktop, mobile, or tablet'),

      query('sort_by')
        .optional()
        .isIn([
          'keyword', 'search_volume', 'keyword_difficulty', 'cpc',
          'created_at', 'updated_at', 'current_position'
        ])
        .withMessage('Invalid sort field'),

      query('sort_order')
        .optional()
        .isIn(['ASC', 'DESC'])
        .withMessage('Sort order must be ASC or DESC'),

      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

      query('include_deleted')
        .optional()
        .isBoolean()
        .withMessage('Include deleted must be a boolean')
    ];
  }

  // Validation for keyword analysis
  static analyzeKeywords() {
    return [
      body('keywords')
        .isArray({ min: 1, max: 100 })
        .withMessage('Keywords must be an array with 1-100 items'),

      body('keywords.*')
        .isString()
        .isLength({ min: 1, max: 255 })
        .withMessage('Each keyword must be a string between 1 and 255 characters'),

      body('location')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Location must be a string with max 100 characters'),

      body('language')
        .optional()
        .isString()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language must be a valid language code'),

      body('device')
        .optional()
        .isIn(['desktop', 'mobile', 'tablet'])
        .withMessage('Device must be desktop, mobile, or tablet'),

      body('include_serp_analysis')
        .optional()
        .isBoolean()
        .withMessage('Include SERP analysis must be a boolean'),

      body('include_competition_analysis')
        .optional()
        .isBoolean()
        .withMessage('Include competition analysis must be a boolean')
    ];
  }

  // Validation for adding ranking data
  static addRanking() {
    return [
      param('id')
        .isUUID()
        .withMessage('Invalid keyword ID format'),

      body('position')
        .isInt({ min: 1 })
        .withMessage('Position must be a positive integer'),

      body('url')
        .optional()
        .isURL()
        .withMessage('URL must be a valid URL'),

      body('page_title')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Page title must be a string with max 500 characters'),

      body('meta_description')
        .optional()
        .isString()
        .isLength({ max: 1000 })
        .withMessage('Meta description must be a string with max 1000 characters'),

      body('featured_snippet')
        .optional()
        .isBoolean()
        .withMessage('Featured snippet must be a boolean'),

      body('check_date')
        .optional()
        .isISO8601()
        .withMessage('Check date must be a valid ISO 8601 date')
    ];
  }

  // Validation for export functionality
  static exportKeywords() {
    return [
      body('format')
        .isIn(['csv', 'excel', 'json'])
        .withMessage('Format must be csv, excel, or json'),

      body('filters')
        .optional()
        .isObject()
        .withMessage('Filters must be an object'),

      body('fields')
        .optional()
        .isArray()
        .withMessage('Fields must be an array'),

      body('fields.*')
        .optional()
        .isString()
        .isIn([
          'keyword', 'search_volume', 'keyword_difficulty', 'cpc',
          'competition_level', 'current_position', 'best_position',
          'worst_position', 'location', 'language', 'device',
          'created_at', 'updated_at'
        ])
        .withMessage('Invalid field name')
    ];
  }

  // Validation for keyword suggestions
  static getKeywordSuggestions() {
    return [
      query('seed_keyword')
        .notEmpty()
        .withMessage('Seed keyword is required')
        .isLength({ min: 1, max: 255 })
        .withMessage('Seed keyword must be between 1 and 255 characters'),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),

      query('location')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Location must be a string with max 100 characters'),

      query('language')
        .optional()
        .isString()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language must be a valid language code')
    ];
  }

  // Validation for ID parameter
  static validateId() {
    return [
      param('id')
        .isUUID()
        .withMessage('Invalid keyword ID format')
    ];
  }

  // Custom validation to check search volume range
  static validateSearchVolumeRange(req, res, next) {
    const { search_volume_min, search_volume_max } = req.query;

    if (search_volume_min && search_volume_max) {
      const min = parseInt(search_volume_min);
      const max = parseInt(search_volume_max);

      if (min > max) {
        return res.status(400).json({
          success: false,
          error: 'Minimum search volume cannot be greater than maximum search volume'
        });
      }
    }

    next();
  }

  // Custom validation to check difficulty range
  static validateDifficultyRange(req, res, next) {
    const { difficulty_min, difficulty_max } = req.query;

    if (difficulty_min && difficulty_max) {
      const min = parseInt(difficulty_min);
      const max = parseInt(difficulty_max);

      if (min > max) {
        return res.status(400).json({
          success: false,
          error: 'Minimum difficulty cannot be greater than maximum difficulty'
        });
      }
    }

    next();
  }
}

module.exports = KeywordValidator;