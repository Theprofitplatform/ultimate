/**
 * Auth Routes for Ultimate SEO Platform
 * Express router configuration for authentication endpoints
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const { RateLimiter } = require('./auth.utils');
const { AuthMiddleware, PERMISSIONS, ROLES } = require('./auth.middleware');

/**
 * Create authentication routes
 * @param {AuthService} authService - Authentication service instance
 * @param {AuthController} authController - Authentication controller instance
 * @param {GoogleOAuthController} googleOAuthController - Google OAuth controller instance
 * @param {Object} logger - Logger instance
 * @returns {express.Router} Configured router
 */
function createAuthRoutes(authService, authController, googleOAuthController, logger) {
  const router = express.Router();
  const authMiddleware = new AuthMiddleware(authService, logger);

  // Apply security middleware
  router.use(authMiddleware.securityHeaders);
  router.use(authMiddleware.requestLogger);

  // ============================================
  // PUBLIC ROUTES (No authentication required)
  // ============================================

  /**
   * Health check endpoint
   * GET /auth/health
   */
  router.get('/health', authController.healthCheck);

  /**
   * User registration
   * POST /auth/register
   */
  router.post('/register',
    RateLimiter.registrationLimiter,
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
      body('fullName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
      body('organizationName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Organization name must be between 2 and 100 characters')
    ],
    authController.register
  );

  /**
   * User login
   * POST /auth/login
   */
  router.post('/login',
    RateLimiter.authLimiter,
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .notEmpty()
        .withMessage('Password is required'),
      body('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean')
    ],
    authController.login
  );

  /**
   * Token refresh
   * POST /auth/refresh
   */
  router.post('/refresh',
    [
      body('refreshToken')
        .optional()
        .isString()
        .withMessage('Refresh token must be a string')
    ],
    authController.refreshToken
  );

  /**
   * Email verification
   * POST /auth/verify-email
   */
  router.post('/verify-email',
    [
      body('token')
        .notEmpty()
        .withMessage('Verification token is required')
    ],
    authController.verifyEmail
  );

  /**
   * Forgot password
   * POST /auth/forgot-password
   */
  router.post('/forgot-password',
    RateLimiter.passwordResetLimiter,
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
    ],
    authController.forgotPassword
  );

  /**
   * Reset password
   * POST /auth/reset-password
   */
  router.post('/reset-password',
    [
      body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
      body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
    ],
    authController.resetPassword
  );

  // ============================================
  // GOOGLE OAUTH ROUTES
  // ============================================

  /**
   * Initiate Google OAuth
   * GET /auth/google
   */
  router.get('/google', googleOAuthController.initiateGoogleAuth);

  /**
   * Google OAuth callback
   * POST /auth/google/callback
   */
  router.post('/google/callback',
    [
      body('code')
        .notEmpty()
        .withMessage('Authorization code is required'),
      body('state')
        .optional()
        .isString()
        .withMessage('State must be a string')
    ],
    googleOAuthController.handleGoogleCallback
  );

  // ============================================
  // PROTECTED ROUTES (Authentication required)
  // ============================================

  /**
   * User logout
   * POST /auth/logout
   */
  router.post('/logout',
    authMiddleware.authenticate,
    authController.logout
  );

  /**
   * Get authentication status
   * GET /auth/me
   */
  router.get('/me',
    authMiddleware.optionalAuthenticate,
    authController.getAuthStatus
  );

  /**
   * Get user profile
   * GET /auth/profile
   */
  router.get('/profile',
    authMiddleware.authenticate,
    authController.getProfile
  );

  /**
   * Update user profile
   * PUT /auth/profile
   */
  router.put('/profile',
    authMiddleware.authenticate,
    [
      body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
      body('avatarUrl')
        .optional()
        .isURL()
        .withMessage('Avatar URL must be a valid URL')
    ],
    authController.updateProfile
  );

  /**
   * Change password
   * POST /auth/change-password
   */
  router.post('/change-password',
    authMiddleware.authenticate,
    [
      body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
      body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
    ],
    authController.changePassword
  );

  /**
   * Resend email verification
   * POST /auth/resend-verification
   */
  router.post('/resend-verification',
    authMiddleware.authenticate,
    authController.resendVerification
  );

  /**
   * Get user sessions
   * GET /auth/sessions
   */
  router.get('/sessions',
    authMiddleware.authenticate,
    authController.getSessions
  );

  /**
   * Revoke specific session
   * DELETE /auth/sessions/:sessionId
   */
  router.delete('/sessions/:sessionId',
    authMiddleware.authenticate,
    [
      param('sessionId')
        .isUUID()
        .withMessage('Session ID must be a valid UUID')
    ],
    authController.revokeSession
  );

  // ============================================
  // GOOGLE INTEGRATION ROUTES (Authenticated)
  // ============================================

  /**
   * Get Google Analytics data
   * GET /auth/google/analytics/:viewId
   */
  router.get('/google/analytics/:viewId',
    authMiddleware.authenticate,
    [
      param('viewId')
        .notEmpty()
        .withMessage('View ID is required'),
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format'),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format')
    ],
    googleOAuthController.getAnalyticsData
  );

  /**
   * Get Search Console data
   * GET /auth/google/search-console/:siteUrl
   */
  router.get('/google/search-console/:siteUrl',
    authMiddleware.authenticate,
    [
      param('siteUrl')
        .notEmpty()
        .withMessage('Site URL is required'),
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format'),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format')
    ],
    googleOAuthController.getSearchConsoleData
  );

  /**
   * Revoke Google access
   * DELETE /auth/google/revoke
   */
  router.delete('/google/revoke',
    authMiddleware.authenticate,
    googleOAuthController.revokeGoogleAccess
  );

  // ============================================
  // ADMIN ROUTES (Admin access required)
  // ============================================

  /**
   * Admin routes group
   */
  const adminRouter = express.Router();

  // Apply admin authentication
  adminRouter.use(authMiddleware.authenticate);
  adminRouter.use(authMiddleware.requireRole([ROLES.ADMIN]));

  /**
   * Get all users in organization
   * GET /auth/admin/users
   */
  adminRouter.get('/users',
    authMiddleware.requireOrganization,
    // This would need to be implemented in the controller
    (req, res) => {
      res.status(501).json({
        success: false,
        error: 'Not Implemented',
        message: 'Admin user management not yet implemented'
      });
    }
  );

  /**
   * Update user role
   * PUT /auth/admin/users/:userId/role
   */
  adminRouter.put('/users/:userId/role',
    authMiddleware.requireOrganization,
    [
      param('userId')
        .isUUID()
        .withMessage('User ID must be a valid UUID'),
      body('role')
        .isIn([ROLES.ADMIN, ROLES.MANAGER, ROLES.MEMBER, ROLES.VIEWER])
        .withMessage('Invalid role specified')
    ],
    // This would need to be implemented in the controller
    (req, res) => {
      res.status(501).json({
        success: false,
        error: 'Not Implemented',
        message: 'Admin user role management not yet implemented'
      });
    }
  );

  /**
   * Deactivate user
   * DELETE /auth/admin/users/:userId
   */
  adminRouter.delete('/users/:userId',
    authMiddleware.requireOrganization,
    [
      param('userId')
        .isUUID()
        .withMessage('User ID must be a valid UUID')
    ],
    // This would need to be implemented in the controller
    (req, res) => {
      res.status(501).json({
        success: false,
        error: 'Not Implemented',
        message: 'Admin user deactivation not yet implemented'
      });
    }
  );

  // Mount admin routes
  router.use('/admin', adminRouter);

  // ============================================
  // ERROR HANDLING
  // ============================================

  // Validation error handler
  router.use((req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid input data',
        details: errors.array()
      });
    }
    
    next();
  });

  // Apply error handling middleware
  router.use(authMiddleware.errorHandler);

  return router;
}

module.exports = createAuthRoutes;