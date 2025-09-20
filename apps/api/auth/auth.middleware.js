/**
 * Auth Middleware for Ultimate SEO Platform
 * JWT validation, RBAC, and security middleware
 */

const crypto = require('crypto');
const { TokenManager, SecurityUtils } = require('./auth.utils');

/**
 * Authentication and Authorization Middleware
 */
class AuthMiddleware {
  constructor(authService, logger) {
    this.authService = authService;
    this.logger = logger;
    this.tokenManager = new TokenManager();
  }

  /**
   * Authenticate JWT token middleware
   * Validates JWT token and loads user context
   */
  authenticate = async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'No valid authentication token provided'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      let decoded;
      try {
        decoded = this.tokenManager.verifyToken(token, 'access');
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: error.message
        });
      }

      // Validate session in database
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = await this.authService.validateSession(decoded.jti, tokenHash);

      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired session'
        });
      }

      // Add user context to request
      req.user = {
        id: session.user_id,
        email: session.email,
        role: session.role,
        permissions: session.permissions || [],
        organizationId: session.organization_id,
        sessionId: session.id
      };

      // Add token info for potential refresh
      req.token = {
        jti: decoded.jti,
        exp: decoded.exp,
        iat: decoded.iat
      };

      next();

    } catch (error) {
      this.logger?.error('Authentication middleware error', { 
        error: error.message,
        ip: SecurityUtils.getClientIP(req)
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Authentication failed'
      });
    }
  };

  /**
   * Optional authentication middleware
   * Sets user context if token is present, but doesn't require it
   */
  optionalAuthenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
      }

      const token = authHeader.substring(7);

      try {
        const decoded = this.tokenManager.verifyToken(token, 'access');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const session = await this.authService.validateSession(decoded.jti, tokenHash);

        if (session) {
          req.user = {
            id: session.user_id,
            email: session.email,
            role: session.role,
            permissions: session.permissions || [],
            organizationId: session.organization_id,
            sessionId: session.id
          };
        } else {
          req.user = null;
        }
      } catch (error) {
        req.user = null;
      }

      next();

    } catch (error) {
      this.logger?.error('Optional authentication middleware error', { 
        error: error.message 
      });
      req.user = null;
      next();
    }
  };

  /**
   * Role-based access control middleware
   * @param {string|Array} allowedRoles - Required role(s)
   * @returns {Function} Middleware function
   */
  requireRole = (allowedRoles) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        this.logger?.warn('Access denied - insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  };

  /**
   * Permission-based access control middleware
   * @param {string|Array} requiredPermissions - Required permission(s)
   * @returns {Function} Middleware function
   */
  requirePermission = (requiredPermissions) => {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission) || 
        userPermissions.includes('*') || // Wildcard permission
        req.user.role === 'admin' // Admin has all permissions
      );

      if (!hasPermission) {
        this.logger?.warn('Access denied - insufficient permissions', {
          userId: req.user.id,
          userPermissions,
          requiredPermissions: permissions,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  };

  /**
   * Organization context middleware
   * Ensures user belongs to the organization in the request
   */
  requireOrganization = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Get organization ID from headers, params, or query
    const orgId = req.headers['x-organization-id'] || 
                  req.params.organizationId || 
                  req.query.organizationId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Organization ID required'
      });
    }

    if (req.user.organizationId !== orgId) {
      this.logger?.warn('Access denied - wrong organization', {
        userId: req.user.id,
        userOrgId: req.user.organizationId,
        requestedOrgId: orgId,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this organization'
      });
    }

    next();
  };

  /**
   * API Key authentication middleware
   * Validates API key from headers
   */
  authenticateApiKey = async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'API key required'
        });
      }

      // Hash the API key for database lookup
      const keyHash = SecurityUtils.hashApiKey(apiKey);

      // Validate API key
      const result = await this.authService.db.query(
        `SELECT ak.*, o.name as organization_name, o.is_active as org_active
         FROM auth.api_keys ak
         JOIN auth.organizations o ON ak.organization_id = o.id
         WHERE ak.key_hash = $1 AND ak.is_active = true 
               AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)
               AND o.is_active = true`,
        [keyHash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired API key'
        });
      }

      const apiKeyData = result.rows[0];

      // Update last used timestamp
      await this.authService.db.query(
        'UPDATE auth.api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [apiKeyData.id]
      );

      // Add API key context to request
      req.apiKey = {
        id: apiKeyData.id,
        name: apiKeyData.name,
        organizationId: apiKeyData.organization_id,
        permissions: apiKeyData.permissions || [],
        rateLimit: apiKeyData.rate_limit
      };

      // Add organization context for compatibility
      req.user = {
        id: null, // API key doesn't have user ID
        role: 'api',
        organizationId: apiKeyData.organization_id,
        permissions: apiKeyData.permissions || []
      };

      next();

    } catch (error) {
      this.logger?.error('API key authentication error', { 
        error: error.message,
        ip: SecurityUtils.getClientIP(req)
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'API key authentication failed'
      });
    }
  };

  /**
   * Email verification required middleware
   */
  requireEmailVerified = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Check if email is verified (this would need to be added to the user context)
    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Email Verification Required',
        message: 'Please verify your email address to access this resource'
      });
    }

    next();
  };

  /**
   * Security headers middleware
   */
  securityHeaders = (req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server info
    res.removeHeader('X-Powered-By');
    
    next();
  };

  /**
   * Request logging middleware
   */
  requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      this.logger?.info('API Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: SecurityUtils.getClientIP(req),
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
        organizationId: req.user?.organizationId
      });
    });

    next();
  };

  /**
   * Error handling middleware
   */
  errorHandler = (error, req, res, next) => {
    this.logger?.error('API Error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      ip: SecurityUtils.getClientIP(req)
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
        details: isDevelopment ? error.details : undefined
      });
    }

    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error.message
      });
    }

    if (error.name === 'ForbiddenError') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message
      });
    }

    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }

    // Default server error
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      stack: isDevelopment ? error.stack : undefined
    });
  };

  /**
   * Not found handler
   */
  notFoundHandler = (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`
    });
  };
}

/**
 * Permission constants for easy reference
 */
const PERMISSIONS = {
  // User management
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Project management
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_DELETE: 'project:delete',

  // SEO data
  SEO_READ: 'seo:read',
  SEO_WRITE: 'seo:write',
  SEO_DELETE: 'seo:delete',

  // Analytics
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_WRITE: 'analytics:write',

  // API keys
  API_KEY_READ: 'api_key:read',
  API_KEY_WRITE: 'api_key:write',
  API_KEY_DELETE: 'api_key:delete',

  // Admin functions
  ADMIN: 'admin:*',
  BILLING: 'billing:*'
};

/**
 * Role constants
 */
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
  API: 'api'
};

module.exports = {
  AuthMiddleware,
  PERMISSIONS,
  ROLES
};