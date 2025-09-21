/**
 * JWT Service for Ultimate SEO Platform
 * Dedicated service for JWT token management with Redis caching and advanced features
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Redis = require('redis');

/**
 * JWT Service Class
 * Advanced JWT token management with Redis caching, token blacklisting, and device tracking
 */
class JWTService {
  constructor(logger, redisConfig = null) {
    this.logger = logger;

    // JWT Configuration
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.issuer = process.env.JWT_ISSUER || 'ultimate-seo';
    this.audience = process.env.JWT_AUDIENCE || 'ultimate-seo-api';

    // Validate required secrets
    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets not configured. Check JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
    }

    // Initialize Redis client for token management
    this.redisClient = null;
    if (redisConfig || process.env.REDIS_URL) {
      this.initializeRedis(redisConfig);
    }

    // Token algorithm and options
    this.algorithm = 'HS256';
    this.tokenTypes = {
      ACCESS: 'access',
      REFRESH: 'refresh',
      EMAIL_VERIFICATION: 'email_verification',
      PASSWORD_RESET: 'password_reset',
      API_KEY: 'api_key'
    };
  }

  /**
   * Initialize Redis connection for token caching and blacklisting
   * @param {Object} config - Redis configuration
   */
  async initializeRedis(config = null) {
    try {
      const redisUrl = config?.url || process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = Redis.createClient({
        url: redisUrl,
        ...config
      });

      this.redisClient.on('error', (error) => {
        this.logger?.error('Redis connection error', { error: error.message });
      });

      this.redisClient.on('connect', () => {
        this.logger?.info('Redis connected for JWT service');
      });

      await this.redisClient.connect();

      // Test Redis connection
      await this.redisClient.ping();
      this.logger?.info('Redis client initialized for JWT service');

    } catch (error) {
      this.logger?.warn('Redis initialization failed, falling back to memory-only mode', {
        error: error.message
      });
      this.redisClient = null;
    }
  }

  /**
   * Generate access token with enhanced security features
   * @param {Object} payload - User data to encode
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Token data
   */
  async generateAccessToken(payload, options = {}) {
    const tokenId = uuidv4();
    const deviceFingerprint = this.generateDeviceFingerprint(options.userAgent, options.ipAddress);

    const tokenPayload = {
      ...payload,
      type: this.tokenTypes.ACCESS,
      jti: tokenId,
      iat: Math.floor(Date.now() / 1000),
      device: deviceFingerprint,
      scope: options.scope || 'full_access'
    };

    const token = jwt.sign(tokenPayload, this.accessTokenSecret, {
      algorithm: this.algorithm,
      expiresIn: options.expiresIn || this.accessTokenExpiry,
      issuer: this.issuer,
      audience: this.audience
    });

    // Cache token metadata in Redis
    if (this.redisClient) {
      try {
        const tokenData = {
          userId: payload.user_id,
          organizationId: payload.organization_id,
          deviceFingerprint,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + this.parseExpiry(this.accessTokenExpiry)).toISOString()
        };

        await this.redisClient.setEx(
          `jwt:access:${tokenId}`,
          this.parseExpiry(this.accessTokenExpiry) / 1000,
          JSON.stringify(tokenData)
        );
      } catch (error) {
        this.logger?.warn('Failed to cache access token in Redis', { error: error.message });
      }
    }

    return {
      token,
      tokenId,
      type: 'Bearer',
      expiresIn: this.accessTokenExpiry,
      scope: tokenPayload.scope
    };
  }

  /**
   * Generate refresh token with device binding
   * @param {Object} payload - User data to encode
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Token data
   */
  async generateRefreshToken(payload, options = {}) {
    const tokenId = uuidv4();
    const deviceFingerprint = this.generateDeviceFingerprint(options.userAgent, options.ipAddress);

    const tokenPayload = {
      user_id: payload.user_id,
      organization_id: payload.organization_id,
      type: this.tokenTypes.REFRESH,
      jti: tokenId,
      iat: Math.floor(Date.now() / 1000),
      device: deviceFingerprint
    };

    const token = jwt.sign(tokenPayload, this.refreshTokenSecret, {
      algorithm: this.algorithm,
      expiresIn: options.expiresIn || this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience
    });

    // Cache refresh token metadata in Redis
    if (this.redisClient) {
      try {
        const tokenData = {
          userId: payload.user_id,
          organizationId: payload.organization_id,
          deviceFingerprint,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)).toISOString(),
          isActive: true
        };

        await this.redisClient.setEx(
          `jwt:refresh:${tokenId}`,
          this.parseExpiry(this.refreshTokenExpiry) / 1000,
          JSON.stringify(tokenData)
        );
      } catch (error) {
        this.logger?.warn('Failed to cache refresh token in Redis', { error: error.message });
      }
    }

    return {
      token,
      tokenId,
      expiresIn: this.refreshTokenExpiry
    };
  }

  /**
   * Generate complete token pair with device tracking
   * @param {Object} payload - User data to encode
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Token pair
   */
  async generateTokenPair(payload, options = {}) {
    const [accessTokenData, refreshTokenData] = await Promise.all([
      this.generateAccessToken(payload, options),
      this.generateRefreshToken(payload, options)
    ]);

    return {
      accessToken: accessTokenData.token,
      refreshToken: refreshTokenData.token,
      tokenType: 'Bearer',
      expiresIn: accessTokenData.expiresIn,
      scope: accessTokenData.scope,
      tokenIds: {
        access: accessTokenData.tokenId,
        refresh: refreshTokenData.tokenId
      }
    };
  }

  /**
   * Verify JWT token with enhanced security checks
   * @param {string} token - JWT token to verify
   * @param {string} type - Token type
   * @param {Object} context - Request context for additional validation
   * @returns {Promise<Object>} Decoded payload
   */
  async verifyToken(token, type = this.tokenTypes.ACCESS, context = {}) {
    try {
      const secret = type === this.tokenTypes.REFRESH ? this.refreshTokenSecret : this.accessTokenSecret;

      // First verify JWT signature and basic claims
      const decoded = jwt.verify(token, secret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience
      });

      // Verify token type matches expected
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify device fingerprint if provided
      if (context.userAgent && context.ipAddress && decoded.device) {
        const currentFingerprint = this.generateDeviceFingerprint(context.userAgent, context.ipAddress);
        if (decoded.device !== currentFingerprint) {
          this.logger?.warn('Device fingerprint mismatch', {
            tokenId: decoded.jti,
            userId: decoded.user_id,
            expected: decoded.device,
            actual: currentFingerprint
          });
          // Note: In production, you might want to be more strict about this
        }
      }

      // Verify token exists in cache (if Redis is available)
      if (this.redisClient && decoded.jti) {
        const cachedData = await this.getTokenFromCache(decoded.jti, type);
        if (!cachedData) {
          throw new Error('Token not found in cache');
        }

        // Check if token is still active
        if (type === this.tokenTypes.REFRESH && !cachedData.isActive) {
          throw new Error('Refresh token has been deactivated');
        }
      }

      return decoded;

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      }
      throw error;
    }
  }

  /**
   * Generate email verification token
   * @param {Object} payload - User data to encode
   * @returns {string} JWT token
   */
  generateEmailVerificationToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: this.tokenTypes.EMAIL_VERIFICATION,
        jti: uuidv4()
      },
      this.accessTokenSecret,
      {
        algorithm: this.algorithm,
        expiresIn: '24h',
        issuer: this.issuer
      }
    );
  }

  /**
   * Generate password reset token
   * @param {Object} payload - User data to encode
   * @returns {string} JWT token
   */
  generatePasswordResetToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: this.tokenTypes.PASSWORD_RESET,
        jti: uuidv4()
      },
      this.accessTokenSecret,
      {
        algorithm: this.algorithm,
        expiresIn: '1h',
        issuer: this.issuer
      }
    );
  }

  /**
   * Generate API key token for machine-to-machine authentication
   * @param {Object} payload - API key data
   * @param {Object} options - Token options
   * @returns {string} JWT token
   */
  generateApiKeyToken(payload, options = {}) {
    return jwt.sign(
      {
        ...payload,
        type: this.tokenTypes.API_KEY,
        jti: uuidv4(),
        iat: Math.floor(Date.now() / 1000)
      },
      this.accessTokenSecret,
      {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || '365d',
        issuer: this.issuer,
        audience: this.audience
      }
    );
  }

  /**
   * Blacklist a token (revoke it)
   * @param {string} tokenId - Token ID (jti claim)
   * @param {number} expirySeconds - How long to keep in blacklist
   * @returns {Promise<boolean>} Success status
   */
  async blacklistToken(tokenId, expirySeconds = 86400) {
    if (!this.redisClient) {
      this.logger?.warn('Cannot blacklist token: Redis not available');
      return false;
    }

    try {
      await this.redisClient.setEx(`jwt:blacklist:${tokenId}`, expirySeconds, 'true');
      this.logger?.info('Token blacklisted', { tokenId });
      return true;
    } catch (error) {
      this.logger?.error('Failed to blacklist token', { error: error.message, tokenId });
      return false;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param {string} tokenId - Token ID (jti claim)
   * @returns {Promise<boolean>} Blacklist status
   */
  async isTokenBlacklisted(tokenId) {
    if (!this.redisClient || !tokenId) {
      return false;
    }

    try {
      const result = await this.redisClient.get(`jwt:blacklist:${tokenId}`);
      return result === 'true';
    } catch (error) {
      this.logger?.error('Failed to check token blacklist status', { error: error.message, tokenId });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async revokeAllUserTokens(userId) {
    if (!this.redisClient) {
      this.logger?.warn('Cannot revoke user tokens: Redis not available');
      return false;
    }

    try {
      // Find all tokens for the user
      const accessTokenKeys = await this.redisClient.keys(`jwt:access:*`);
      const refreshTokenKeys = await this.redisClient.keys(`jwt:refresh:*`);

      const tokensToRevoke = [];

      // Check access tokens
      for (const key of accessTokenKeys) {
        const tokenData = await this.redisClient.get(key);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          if (parsed.userId === userId) {
            const tokenId = key.split(':')[2];
            tokensToRevoke.push(tokenId);
          }
        }
      }

      // Check refresh tokens
      for (const key of refreshTokenKeys) {
        const tokenData = await this.redisClient.get(key);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          if (parsed.userId === userId) {
            const tokenId = key.split(':')[2];
            tokensToRevoke.push(tokenId);
          }
        }
      }

      // Blacklist all found tokens
      const blacklistPromises = tokensToRevoke.map(tokenId =>
        this.blacklistToken(tokenId, 86400 * 7) // 7 days
      );

      await Promise.all(blacklistPromises);

      this.logger?.info('All user tokens revoked', { userId, tokenCount: tokensToRevoke.length });
      return true;

    } catch (error) {
      this.logger?.error('Failed to revoke user tokens', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Get token data from cache
   * @param {string} tokenId - Token ID
   * @param {string} type - Token type
   * @returns {Promise<Object|null>} Token data
   */
  async getTokenFromCache(tokenId, type) {
    if (!this.redisClient) {
      return null;
    }

    try {
      const key = `jwt:${type}:${tokenId}`;
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger?.error('Failed to get token from cache', { error: error.message, tokenId });
      return null;
    }
  }

  /**
   * Get token expiration date
   * @param {string} token - JWT token
   * @returns {Date} Expiration date
   */
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return new Date(decoded.exp * 1000);
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Decode token without verification (for inspection)
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Generate device fingerprint for security
   * @param {string} userAgent - User agent string
   * @param {string} ipAddress - IP address
   * @returns {string} Device fingerprint
   */
  generateDeviceFingerprint(userAgent = '', ipAddress = '') {
    const data = `${userAgent}|${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Parse expiry string to milliseconds
   * @param {string} expiry - Expiry string (e.g., '15m', '7d')
   * @returns {number} Milliseconds
   */
  parseExpiry(expiry) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = expiry.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error('Invalid expiry format');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Clean up expired tokens from cache
   * @returns {Promise<number>} Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    if (!this.redisClient) {
      return 0;
    }

    try {
      const keys = await this.redisClient.keys('jwt:*');
      let cleanedCount = 0;

      for (const key of keys) {
        if (key.includes('blacklist')) continue; // Skip blacklist entries

        const ttl = await this.redisClient.ttl(key);
        if (ttl === -1) { // No expiry set, check if token is expired
          const data = await this.redisClient.get(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (new Date(parsed.expiresAt) < new Date()) {
              await this.redisClient.del(key);
              cleanedCount++;
            }
          }
        }
      }

      this.logger?.info('Token cleanup completed', { cleanedCount });
      return cleanedCount;

    } catch (error) {
      this.logger?.error('Token cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Get token statistics
   * @returns {Promise<Object>} Token statistics
   */
  async getTokenStats() {
    if (!this.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      const [accessKeys, refreshKeys, blacklistKeys] = await Promise.all([
        this.redisClient.keys('jwt:access:*'),
        this.redisClient.keys('jwt:refresh:*'),
        this.redisClient.keys('jwt:blacklist:*')
      ]);

      return {
        activeAccessTokens: accessKeys.length,
        activeRefreshTokens: refreshKeys.length,
        blacklistedTokens: blacklistKeys.length,
        totalTokens: accessKeys.length + refreshKeys.length
      };

    } catch (error) {
      this.logger?.error('Failed to get token stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger?.info('JWT service Redis connection closed');
    }
  }
}

module.exports = JWTService;