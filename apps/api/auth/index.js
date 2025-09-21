/**
 * Ultimate SEO Platform Authentication Module
 * Complete authentication system with JWT, OAuth, RBAC, and Redis session management
 */

const { Pool } = require('pg');
const winston = require('winston');
const AuthService = require('./auth.service');
const AuthController = require('./auth.controller');
const { AuthMiddleware } = require('./auth.middleware');
const { GoogleOAuthService, GoogleOAuthController } = require('./google-oauth');
const { RBACService } = require('./rbac');
const JWTService = require('./jwt.service');
const SessionService = require('./session.service');
const createAuthRoutes = require('./auth.routes');

/**
 * Authentication Module Factory
 * Creates and configures all authentication components
 */
class AuthModule {
  constructor(options = {}) {
    this.options = {
      // Database configuration
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'ultimate_seo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ...options.database
      },

      // Redis configuration
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server is down');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        },
        ...options.redis
      },

      // JWT configuration
      jwt: {
        accessTokenSecret: process.env.JWT_ACCESS_SECRET,
        refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: process.env.JWT_ISSUER || 'ultimate-seo',
        audience: process.env.JWT_AUDIENCE || 'ultimate-seo-api',
        ...options.jwt
      },

      // Google OAuth configuration
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        ...options.google
      },

      // Session configuration
      session: {
        ttl: parseInt(process.env.SESSION_TTL) || 86400, // 24 hours
        maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER) || 10,
        ...options.session
      },

      // Logger configuration
      logger: options.logger || this.createDefaultLogger(),

      // Feature flags
      features: {
        useRedis: process.env.USE_REDIS !== 'false',
        useJWTService: process.env.USE_JWT_SERVICE !== 'false',
        useSessionService: process.env.USE_SESSION_SERVICE !== 'false',
        strictSecurity: process.env.STRICT_SECURITY === 'true',
        ...options.features
      }
    };

    // Initialize components
    this.db = null;
    this.logger = this.options.logger;
    this.authService = null;
    this.authController = null;
    this.authMiddleware = null;
    this.googleOAuthService = null;
    this.googleOAuthController = null;
    this.rbacService = null;
    this.jwtService = null;
    this.sessionService = null;
    this.router = null;

    // Validate required configuration
    this.validateConfiguration();
  }

  /**
   * Validate required configuration
   */
  validateConfiguration() {
    const required = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (this.options.features.useRedis && !this.options.redis.url) {
      this.logger.warn('Redis URL not provided, Redis features will be disabled');
      this.options.features.useRedis = false;
    }

    if (!this.options.google.clientId || !this.options.google.clientSecret) {
      this.logger.warn('Google OAuth credentials not provided, Google integration will be disabled');
    }
  }

  /**
   * Create default logger
   */
  createDefaultLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/auth-error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/auth-combined.log'
        })
      ]
    });
  }

  /**
   * Initialize the authentication module
   */
  async initialize() {
    try {
      this.logger.info('Initializing Ultimate SEO Authentication Module...');

      // Initialize database connection
      await this.initializeDatabase();

      // Initialize services
      await this.initializeServices();

      // Initialize controllers
      this.initializeControllers();

      // Initialize middleware
      this.initializeMiddleware();

      // Create routes
      this.createRoutes();

      this.logger.info('Authentication module initialized successfully');

      return this;

    } catch (error) {
      this.logger.error('Failed to initialize authentication module', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    this.logger.info('Initializing database connection...');

    this.db = new Pool(this.options.database);

    // Test database connection
    try {
      const client = await this.db.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error('Database connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize services
   */
  async initializeServices() {
    this.logger.info('Initializing authentication services...');

    // Initialize JWT Service
    if (this.options.features.useJWTService) {
      try {
        this.jwtService = new JWTService(this.logger, this.options.redis);\n        if (this.options.features.useRedis) {\n          await this.jwtService.initializeRedis(this.options.redis);\n        }\n        this.logger.info('JWT service initialized');\n      } catch (error) {\n        this.logger.warn('JWT service initialization failed, falling back to basic token manager', {\n          error: error.message\n        });\n        this.jwtService = null;\n      }\n    }\n\n    // Initialize Session Service\n    if (this.options.features.useSessionService && this.options.features.useRedis) {\n      try {\n        this.sessionService = new SessionService(this.logger, this.options.redis);\n        await this.sessionService.initializeRedis(this.options.redis);\n        this.logger.info('Session service initialized');\n      } catch (error) {\n        this.logger.warn('Session service initialization failed', {\n          error: error.message\n        });\n        this.sessionService = null;\n      }\n    }\n\n    // Initialize Auth Service\n    this.authService = new AuthService(this.db, this.logger, this.jwtService);\n    this.logger.info('Auth service initialized');\n\n    // Initialize RBAC Service\n    this.rbacService = new RBACService(this.db, this.logger);\n    this.logger.info('RBAC service initialized');\n\n    // Initialize Google OAuth Service\n    if (this.options.google.clientId && this.options.google.clientSecret) {\n      this.googleOAuthService = new GoogleOAuthService(this.authService, this.logger);\n      this.logger.info('Google OAuth service initialized');\n    } else {\n      this.logger.warn('Google OAuth service not initialized - missing credentials');\n    }\n  }\n\n  /**\n   * Initialize controllers\n   */\n  initializeControllers() {\n    this.logger.info('Initializing authentication controllers...');\n\n    this.authController = new AuthController(\n      this.authService,\n      this.logger,\n      this.rbacService,\n      this.sessionService\n    );\n\n    if (this.googleOAuthService) {\n      this.googleOAuthController = new GoogleOAuthController(\n        this.googleOAuthService,\n        this.authService,\n        this.logger\n      );\n    }\n\n    this.logger.info('Controllers initialized');\n  }\n\n  /**\n   * Initialize middleware\n   */\n  initializeMiddleware() {\n    this.logger.info('Initializing authentication middleware...');\n\n    this.authMiddleware = new AuthMiddleware(this.authService, this.logger, {\n      jwtService: this.jwtService,\n      sessionService: this.sessionService,\n      rbacService: this.rbacService\n    });\n\n    this.logger.info('Middleware initialized');\n  }\n\n  /**\n   * Create routes\n   */\n  createRoutes() {\n    this.logger.info('Creating authentication routes...');\n\n    this.router = createAuthRoutes(\n      this.authService,\n      this.authController,\n      this.googleOAuthController,\n      this.logger\n    );\n\n    this.logger.info('Routes created');\n  }\n\n  /**\n   * Get the authentication router\n   */\n  getRouter() {\n    if (!this.router) {\n      throw new Error('Authentication module not initialized. Call initialize() first.');\n    }\n    return this.router;\n  }\n\n  /**\n   * Get authentication middleware\n   */\n  getMiddleware() {\n    if (!this.authMiddleware) {\n      throw new Error('Authentication module not initialized. Call initialize() first.');\n    }\n    return this.authMiddleware;\n  }\n\n  /**\n   * Get auth service\n   */\n  getAuthService() {\n    return this.authService;\n  }\n\n  /**\n   * Get RBAC service\n   */\n  getRBACService() {\n    return this.rbacService;\n  }\n\n  /**\n   * Get JWT service\n   */\n  getJWTService() {\n    return this.jwtService;\n  }\n\n  /**\n   * Get session service\n   */\n  getSessionService() {\n    return this.sessionService;\n  }\n\n  /**\n   * Get Google OAuth service\n   */\n  getGoogleOAuthService() {\n    return this.googleOAuthService;\n  }\n\n  /**\n   * Health check\n   */\n  async healthCheck() {\n    const health = {\n      status: 'healthy',\n      timestamp: new Date().toISOString(),\n      services: {},\n      uptime: process.uptime()\n    };\n\n    try {\n      // Check database\n      const client = await this.db.connect();\n      await client.query('SELECT 1');\n      client.release();\n      health.services.database = 'healthy';\n    } catch (error) {\n      health.services.database = 'unhealthy';\n      health.status = 'degraded';\n    }\n\n    // Check Redis (if enabled)\n    if (this.jwtService && this.jwtService.redisClient) {\n      try {\n        await this.jwtService.redisClient.ping();\n        health.services.redis = 'healthy';\n      } catch (error) {\n        health.services.redis = 'unhealthy';\n        health.status = 'degraded';\n      }\n    }\n\n    // Check session service\n    if (this.sessionService && this.sessionService.redisClient) {\n      try {\n        await this.sessionService.redisClient.ping();\n        health.services.sessionRedis = 'healthy';\n      } catch (error) {\n        health.services.sessionRedis = 'unhealthy';\n        health.status = 'degraded';\n      }\n    }\n\n    return health;\n  }\n\n  /**\n   * Get module statistics\n   */\n  async getStats() {\n    const stats = {\n      timestamp: new Date().toISOString(),\n      uptime: process.uptime(),\n      features: this.options.features\n    };\n\n    try {\n      // JWT stats\n      if (this.jwtService) {\n        stats.jwt = await this.jwtService.getTokenStats();\n      }\n\n      // Session stats\n      if (this.sessionService) {\n        stats.sessions = await this.sessionService.getSessionStats();\n      }\n\n      // Database stats\n      const dbStats = await this.db.query(\n        'SELECT COUNT(*) as total_users FROM auth.users WHERE is_active = true'\n      );\n      stats.users = {\n        total: parseInt(dbStats.rows[0].total_users)\n      };\n\n    } catch (error) {\n      this.logger.error('Failed to get module stats', { error: error.message });\n      stats.error = error.message;\n    }\n\n    return stats;\n  }\n\n  /**\n   * Cleanup resources\n   */\n  async close() {\n    this.logger.info('Closing authentication module...');\n\n    try {\n      // Close database connections\n      if (this.db) {\n        await this.db.end();\n        this.logger.info('Database connections closed');\n      }\n\n      // Close JWT service\n      if (this.jwtService) {\n        await this.jwtService.close();\n        this.logger.info('JWT service closed');\n      }\n\n      // Close session service\n      if (this.sessionService) {\n        await this.sessionService.close();\n        this.logger.info('Session service closed');\n      }\n\n      this.logger.info('Authentication module closed successfully');\n\n    } catch (error) {\n      this.logger.error('Error closing authentication module', {\n        error: error.message\n      });\n      throw error;\n    }\n  }\n}\n\n/**\n * Factory function to create and initialize auth module\n */\nasync function createAuthModule(options = {}) {\n  const authModule = new AuthModule(options);\n  await authModule.initialize();\n  return authModule;\n}\n\nmodule.exports = {\n  AuthModule,\n  createAuthModule,\n  AuthService,\n  AuthController,\n  AuthMiddleware,\n  GoogleOAuthService,\n  GoogleOAuthController,\n  RBACService,\n  JWTService,\n  SessionService\n};