/**
 * Auth Routes for Ultimate SEO Platform
 * Express router configuration for authentication endpoints
 */

const express = require('express');
const { RateLimiter } = require('./auth.utils');
const { AuthMiddleware, PERMISSIONS, ROLES } = require('./auth.middleware');
const {
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
  sanitizeInputs,
  validateCSP
} = require('./validation.middleware');

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
  router.use(validateCSP);
  router.use(sanitizeInputs);
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
    validateRegistration,
    authController.register
  );

  /**
   * User login
   * POST /auth/login
   */
  router.post('/login',
    RateLimiter.authLimiter,
    validateLogin,
    authController.login
  );

  /**
   * Token refresh
   * POST /auth/refresh
   */
  router.post('/refresh',
    validateTokenRefresh,
    authController.refreshToken
  );

  /**
   * Email verification
   * POST /auth/verify-email
   */
  router.post('/verify-email',
    validateEmailVerification,
    authController.verifyEmail
  );

  /**
   * Alternative endpoint for token verification
   * GET /auth/verify
   */
  router.get('/verify',
    authMiddleware.authenticate,
    authController.verifyToken
  );

  /**
   * Forgot password
   * POST /auth/forgot-password
   */
  router.post('/forgot-password',
    RateLimiter.passwordResetLimiter,
    validatePasswordResetRequest,
    authController.forgotPassword
  );

  /**
   * Reset password
   * POST /auth/reset-password
   */
  router.post('/reset-password',
    validatePasswordReset,
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
    validateGoogleCallback,
    googleOAuthController.handleGoogleCallback
  );

  /**
   * Get Google connection status
   * GET /auth/google/status
   */
  router.get('/google/status',
    authMiddleware.optionalAuthenticate,
    googleOAuthController.getGoogleStatus
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
    validateProfileUpdate,
    authController.updateProfile
  );

  /**
   * Change password
   * POST /auth/change-password
   */
  router.post('/change-password',
    authMiddleware.authenticate,
    validatePasswordChange,
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
    validateSessionId,
    authController.revokeSession
  );

  /**
   * Revoke all sessions
   * POST /auth/sessions/revoke-all
   */
  router.post('/sessions/revoke-all',
    authMiddleware.authenticate,
    authController.revokeAllSessions
  );

  /**
   * Get session statistics
   * GET /auth/sessions/stats
   */
  router.get('/sessions/stats',
    authMiddleware.authenticate,
    authController.getSessionStats
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
    validateAnalyticsQuery,
    googleOAuthController.getAnalyticsData
  );

  /**
   * List Google Analytics accounts
   * GET /auth/google/analytics/accounts
   */
  router.get('/google/analytics/accounts',
    authMiddleware.authenticate,
    googleOAuthController.listAnalyticsAccounts
  );

  /**
   * Get Search Console data
   * GET /auth/google/search-console/:siteUrl
   */
  router.get('/google/search-console/:siteUrl',
    authMiddleware.authenticate,
    validateSearchConsoleQuery,
    googleOAuthController.getSearchConsoleData
  );

  /**
   * List Search Console sites
   * GET /auth/google/search-console/sites
   */
  router.get('/google/search-console/sites',
    authMiddleware.authenticate,
    googleOAuthController.listSearchConsoleSites
  );

  /**
   * Verify Search Console site ownership
   * POST /auth/google/search-console/verify
   */
  router.post('/google/search-console/verify',
    authMiddleware.authenticate,
    googleOAuthController.verifySearchConsoleSite
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
  // API KEY MANAGEMENT ROUTES
  // ============================================

  /**
   * Generate API key
   * POST /auth/api-keys
   */
  router.post('/api-keys',
    authMiddleware.authenticate,
    authMiddleware.requirePermission(PERMISSIONS.API_KEY_WRITE),
    validateApiKeyGeneration,
    authController.generateApiKey
  );

  /**
   * List API keys
   * GET /auth/api-keys
   */
  router.get('/api-keys',
    authMiddleware.authenticate,
    authMiddleware.requirePermission(PERMISSIONS.API_KEY_READ),
    authController.listApiKeys
  );

  /**
   * Revoke API key
   * DELETE /auth/api-keys/:keyId
   */
  router.delete('/api-keys/:keyId',
    authMiddleware.authenticate,
    authMiddleware.requirePermission(PERMISSIONS.API_KEY_DELETE),
    validateUserId, // Reuse UUID validation for keyId
    authController.revokeApiKey
  );

  /**
   * Get user permissions
   * GET /auth/permissions
   */
  router.get('/permissions',
    authMiddleware.authenticate,
    authController.getPermissions
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
    validateUserId,
    authMiddleware.requireUserManagement('manage_role'),
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
    validateUserId,
    authMiddleware.requireUserManagement('delete'),
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

  // 404 handler for auth routes
  router.use(authMiddleware.notFoundHandler);

  return router;
}

module.exports = createAuthRoutes;