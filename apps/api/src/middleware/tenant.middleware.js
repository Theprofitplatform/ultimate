/**
 * Tenant Isolation Middleware
 * Ensures proper tenant isolation for multi-tenant SaaS applications
 */

class TenantMiddleware {
  // Middleware for tenant isolation
  static requireTenant(req, res, next) {
    try {
      // Extract tenant information from various sources
      const tenant_id = TenantMiddleware.extractTenantId(req);

      if (!tenant_id) {
        return res.status(401).json({
          success: false,
          error: 'Tenant identification required',
          message: 'Valid tenant ID must be provided'
        });
      }

      // Add tenant_id to user object for easy access
      if (req.user) {
        req.user.tenant_id = tenant_id;
      }

      // Add tenant_id to request for direct access
      req.tenant_id = tenant_id;

      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Tenant validation failed',
        message: 'Unable to validate tenant information'
      });
    }
  }

  // Extract tenant ID from various sources
  static extractTenantId(req) {
    // Priority order for tenant ID extraction:
    // 1. JWT token payload (tenant_id field)
    // 2. Request headers (x-tenant-id)
    // 3. User ID as fallback (for single-tenant per user scenarios)
    // 4. Query parameter (tenant_id)

    // From JWT token
    if (req.user?.tenant_id) {
      return req.user.tenant_id;
    }

    // From headers
    if (req.headers['x-tenant-id']) {
      return req.headers['x-tenant-id'];
    }

    // From user ID (fallback for single-tenant scenarios)
    if (req.user?.id) {
      return req.user.id;
    }

    // From query parameters (least secure, use with caution)
    if (req.query.tenant_id) {
      return req.query.tenant_id;
    }

    return null;
  }

  // Middleware to validate tenant access permissions
  static validateTenantAccess(allowedRoles = []) {
    return (req, res, next) => {
      try {
        const tenant_id = req.tenant_id || TenantMiddleware.extractTenantId(req);
        const userRole = req.user?.role;

        if (!tenant_id) {
          return res.status(401).json({
            success: false,
            error: 'Tenant access denied',
            message: 'Tenant identification required for access'
          });
        }

        // Check if user has required role for tenant operations
        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: `Required role: ${allowedRoles.join(' or ')}`
          });
        }

        // Additional tenant-specific validations can be added here
        // Example: Check if user belongs to the tenant
        if (req.user?.tenant_id && req.user.tenant_id !== tenant_id) {
          return res.status(403).json({
            success: false,
            error: 'Tenant access denied',
            message: 'User does not belong to the specified tenant'
          });
        }

        next();
      } catch (error) {
        console.error('Tenant access validation error:', error);
        res.status(500).json({
          success: false,
          error: 'Tenant access validation failed',
          message: 'Unable to validate tenant access permissions'
        });
      }
    };
  }

  // Middleware to add tenant context to database queries
  static addTenantContext(req, res, next) {
    try {
      const tenant_id = req.tenant_id || TenantMiddleware.extractTenantId(req);

      if (tenant_id) {
        // Add tenant context to request for database operations
        req.dbContext = {
          tenant_id,
          user_id: req.user?.id,
          timestamp: new Date()
        };
      }

      next();
    } catch (error) {
      console.error('Tenant context error:', error);
      next(); // Continue without context rather than failing
    }
  }

  // Middleware for tenant-specific rate limiting
  static tenantRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 1000, // per tenant per window
      message = 'Tenant rate limit exceeded'
    } = options;

    // This would integrate with Redis or in-memory store
    const rateLimitStore = new Map();

    return (req, res, next) => {
      try {
        const tenant_id = req.tenant_id || TenantMiddleware.extractTenantId(req);

        if (!tenant_id) {
          return next(); // Skip rate limiting if no tenant
        }

        const now = Date.now();
        const windowStart = now - windowMs;
        const key = `rate_limit:${tenant_id}`;

        // Get or initialize tenant rate limit data
        let tenantData = rateLimitStore.get(key) || {
          requests: [],
          resetTime: now + windowMs
        };

        // Clean old requests outside the window
        tenantData.requests = tenantData.requests.filter(
          timestamp => timestamp > windowStart
        );

        // Check if limit exceeded
        if (tenantData.requests.length >= maxRequests) {
          const resetTimeSeconds = Math.ceil((tenantData.resetTime - now) / 1000);

          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message,
            retry_after: resetTimeSeconds,
            limit: maxRequests,
            window_ms: windowMs
          });
        }

        // Add current request
        tenantData.requests.push(now);
        rateLimitStore.set(key, tenantData);

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': maxRequests - tenantData.requests.length,
          'X-RateLimit-Reset': Math.ceil(tenantData.resetTime / 1000)
        });

        next();
      } catch (error) {
        console.error('Tenant rate limit error:', error);
        next(); // Continue without rate limiting rather than failing
      }
    };
  }

  // Middleware to log tenant-specific activities
  static tenantActivityLogger(req, res, next) {
    try {
      const tenant_id = req.tenant_id || TenantMiddleware.extractTenantId(req);

      if (tenant_id) {
        const logData = {
          tenant_id,
          user_id: req.user?.id,
          method: req.method,
          path: req.path,
          ip: req.ip,
          user_agent: req.get('User-Agent'),
          timestamp: new Date()
        };

        // Log tenant activity (integrate with your logging system)
        console.log('Tenant Activity:', JSON.stringify(logData));

        // You could also store this in a database or send to analytics
        // await activityLogger.log(logData);
      }

      next();
    } catch (error) {
      console.error('Tenant activity logging error:', error);
      next(); // Continue without logging rather than failing
    }
  }
}

module.exports = TenantMiddleware;