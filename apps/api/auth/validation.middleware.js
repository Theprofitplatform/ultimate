/**
 * Validation Middleware for Ultimate SEO Platform
 * Comprehensive input validation, sanitization, and error handling
 */

const { body, param, query, validationResult } = require('express-validator');
const { SecurityUtils } = require('./auth.utils');

/**
 * Validation Error Handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid input data provided',
      details: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * User Registration Validation
 */
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address is required (max 254 characters)')
    .custom(async (email) => {
      // Additional email validation
      if (email.includes('+')) {
        // Allow but log plus addressing
        console.log('Plus addressing detected:', email);
      }
      return true;
    }),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, lowercase letter, number, and special character'),

  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 100 })),

  body('organizationName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization name must be between 2 and 100 characters')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 100 })),

  body('acceptTerms')
    .optional()
    .isBoolean()
    .withMessage('Accept terms must be a boolean'),

  body('marketingConsent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),

  handleValidationErrors
];

/**
 * User Login Validation
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address is required'),

  body('password')
    .notEmpty()
    .isLength({ max: 128 })
    .withMessage('Password is required (max 128 characters)'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean'),

  body('deviceName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Device name must be less than 100 characters')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 100 })),

  handleValidationErrors
];

/**
 * Token Refresh Validation
 */
const validateTokenRefresh = [
  body('refreshToken')
    .optional()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Refresh token must be a valid string'),

  handleValidationErrors
];

/**
 * Email Verification Validation
 */
const validateEmailVerification = [
  body('token')
    .notEmpty()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Verification token is required'),

  handleValidationErrors
];

/**
 * Password Reset Request Validation
 */
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address is required'),

  handleValidationErrors
];

/**
 * Password Reset Validation
 */
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Reset token is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, lowercase letter, number, and special character'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Password Change Validation
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .isLength({ max: 128 })
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, lowercase letter, number, and special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Profile Update Validation
 */
const validateProfileUpdate = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 100 })),

  body('avatarUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .isLength({ max: 2048 })
    .withMessage('Avatar URL must be a valid HTTP/HTTPS URL (max 2048 characters)'),

  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Timezone must be a valid string (max 50 characters)'),

  body('language')
    .optional()
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language must be a valid language code'),

  handleValidationErrors
];

/**
 * API Key Generation Validation
 */
const validateApiKeyGeneration = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('API key name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('API key name can only contain letters, numbers, spaces, hyphens, and underscores')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 100 })),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .customSanitizer((value) => SecurityUtils.sanitizeInput(value, { maxLength: 500 })),

  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      if (permissions && permissions.length > 50) {
        throw new Error('Maximum 50 permissions allowed');
      }
      return true;
    }),

  body('permissions.*')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Each permission must be a valid string'),

  body('expiresIn')
    .optional()
    .matches(/^(\d+)([smhd])$/)
    .withMessage('Expires in must be in format like "30d", "12h", "60m"'),

  handleValidationErrors
];

/**
 * Session ID Validation
 */
const validateSessionId = [
  param('sessionId')
    .isUUID(4)
    .withMessage('Session ID must be a valid UUID'),

  handleValidationErrors
];

/**
 * User ID Validation
 */
const validateUserId = [
  param('userId')
    .isUUID(4)
    .withMessage('User ID must be a valid UUID'),

  handleValidationErrors
];

/**
 * Google OAuth Callback Validation
 */
const validateGoogleCallback = [
  body('code')
    .notEmpty()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Authorization code is required'),

  body('state')
    .optional()
    .isString()
    .isLength({ max: 256 })
    .withMessage('State parameter must be a valid string'),

  body('scope')
    .optional()
    .isString()
    .isLength({ max: 1024 })
    .withMessage('Scope parameter must be a valid string'),

  handleValidationErrors
];

/**
 * Google Analytics Query Validation
 */
const validateAnalyticsQuery = [
  param('viewId')
    .notEmpty()
    .isString()
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('View ID must be a valid identifier'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      const startDate = req.query.startDate;
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('metrics')
    .optional()
    .isString()
    .customSanitizer((value) => {
      // Split metrics by comma and validate each
      return value.split(',').map(m => m.trim()).filter(m => m.length > 0);
    }),

  query('dimensions')
    .optional()
    .isString()
    .customSanitizer((value) => {
      // Split dimensions by comma and validate each
      return value.split(',').map(d => d.trim()).filter(d => d.length > 0);
    }),

  handleValidationErrors
];

/**
 * Search Console Query Validation
 */
const validateSearchConsoleQuery = [
  param('siteUrl')
    .notEmpty()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Site URL is required')
    .customSanitizer((value) => decodeURIComponent(value))
    .custom((siteUrl) => {
      try {
        new URL(siteUrl);
        return true;
      } catch {
        throw new Error('Site URL must be a valid URL');
      }
    }),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)'),

  query('dimensions')
    .optional()
    .isArray()
    .withMessage('Dimensions must be an array'),

  query('rowLimit')
    .optional()
    .isInt({ min: 1, max: 25000 })
    .withMessage('Row limit must be between 1 and 25,000'),

  handleValidationErrors
];

/**
 * Rate Limiting Headers Validation
 */
const validateRateLimitHeaders = (req, res, next) => {
  const rateLimitHeaders = {
    'X-RateLimit-Limit': req.rateLimit?.limit,
    'X-RateLimit-Remaining': req.rateLimit?.remaining,
    'X-RateLimit-Reset': req.rateLimit?.resetTime
  };

  // Add rate limit headers to response
  Object.entries(rateLimitHeaders).forEach(([header, value]) => {
    if (value !== undefined) {
      res.setHeader(header, value);
    }
  });

  next();
};

/**
 * Content Security Policy Validation
 */
const validateCSP = (req, res, next) => {
  // Set Content Security Policy headers
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.theprofitplatform.com.au https://accounts.google.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
};

/**
 * Input Sanitization Middleware
 */
const sanitizeInputs = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = SecurityUtils.sanitizeInput(value, { maxLength: 10000 });
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * File Upload Validation (for avatar uploads)
 */
const validateFileUpload = (fieldName, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFiles = 1
  } = options;

  return (req, res, next) => {
    if (!req.files || !req.files[fieldName]) {
      return next();
    }

    const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];

    if (files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: `Maximum ${maxFiles} file(s) allowed`
      });
    }

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
        });
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `File type must be one of: ${allowedTypes.join(', ')}`
        });
      }

      // Check for malicious files (basic check)
      if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid file name'
        });
      }
    }

    next();
  };
};

module.exports = {
  // Validation functions
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
  validateEmailVerification,
  validatePasswordResetRequest,
  validatePasswordReset,
  validatePasswordChange,
  validateProfileUpdate,
  validateApiKeyGeneration,
  validateSessionId,
  validateUserId,
  validateGoogleCallback,
  validateAnalyticsQuery,
  validateSearchConsoleQuery,

  // Utility functions
  handleValidationErrors,
  validateRateLimitHeaders,
  validateCSP,
  sanitizeInputs,
  validateFileUpload
};