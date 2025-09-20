/**
 * Auth Utilities for Ultimate SEO Platform
 * Provides JWT token generation/validation, password hashing, and security utilities
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Configuration constants
const JWT_ALGORITHM = 'HS256';
const SALT_ROUNDS = 12;
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset'
};

/**
 * JWT Token Management
 */
class TokenManager {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets not configured. Check JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
    }
  }

  /**
   * Generate JWT access token
   * @param {Object} payload - User data to encode
   * @param {Object} options - Additional options
   * @returns {string} JWT token
   */
  generateAccessToken(payload, options = {}) {
    const defaultPayload = {
      type: TOKEN_TYPES.ACCESS,
      iat: Math.floor(Date.now() / 1000),
      jti: uuidv4()
    };

    return jwt.sign(
      { ...defaultPayload, ...payload },
      this.accessTokenSecret,
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: options.expiresIn || this.accessTokenExpiry,
        issuer: process.env.JWT_ISSUER || 'ultimate-seo',
        audience: process.env.JWT_AUDIENCE || 'ultimate-seo-api'
      }
    );
  }

  /**
   * Generate JWT refresh token
   * @param {Object} payload - User data to encode
   * @param {Object} options - Additional options
   * @returns {string} JWT token
   */
  generateRefreshToken(payload, options = {}) {
    const defaultPayload = {
      type: TOKEN_TYPES.REFRESH,
      iat: Math.floor(Date.now() / 1000),
      jti: uuidv4()
    };

    return jwt.sign(
      { ...defaultPayload, ...payload },
      this.refreshTokenSecret,
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: options.expiresIn || this.refreshTokenExpiry,
        issuer: process.env.JWT_ISSUER || 'ultimate-seo',
        audience: process.env.JWT_AUDIENCE || 'ultimate-seo-api'
      }
    );
  }

  /**
   * Generate email verification token
   * @param {Object} payload - User data to encode
   * @returns {string} JWT token
   */
  generateEmailVerificationToken(payload) {
    return jwt.sign(
      { ...payload, type: TOKEN_TYPES.EMAIL_VERIFICATION },
      this.accessTokenSecret,
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: '24h',
        issuer: process.env.JWT_ISSUER || 'ultimate-seo'
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
      { ...payload, type: TOKEN_TYPES.PASSWORD_RESET },
      this.accessTokenSecret,
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
        issuer: process.env.JWT_ISSUER || 'ultimate-seo'
      }
    );
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token to verify
   * @param {string} type - Token type (access/refresh)
   * @returns {Object} Decoded payload
   */
  verifyToken(token, type = TOKEN_TYPES.ACCESS) {
    try {
      const secret = type === TOKEN_TYPES.REFRESH ? this.refreshTokenSecret : this.accessTokenSecret;
      
      const decoded = jwt.verify(token, secret, {
        algorithms: [JWT_ALGORITHM],
        issuer: process.env.JWT_ISSUER || 'ultimate-seo',
        audience: process.env.JWT_AUDIENCE || 'ultimate-seo-api'
      });

      // Verify token type matches expected
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
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
   * Generate token pair (access + refresh)
   * @param {Object} payload - User data to encode
   * @returns {Object} Token pair
   */
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({ 
      user_id: payload.user_id, 
      organization_id: payload.organization_id 
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiry
    };
  }
}

/**
 * Password Security Utilities
 */
class PasswordManager {
  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Verification result
   */
  static async verifyPassword(password, hash) {
    if (!password || !hash) {
      return false;
    }

    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password) {
    const result = {
      isValid: true,
      errors: [],
      score: 0
    };

    if (!password) {
      result.isValid = false;
      result.errors.push('Password is required');
      return result;
    }

    // Length check
    if (password.length < 8) {
      result.isValid = false;
      result.errors.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      result.score += 2;
    } else {
      result.score += 1;
    }

    // Complexity checks
    if (!/[a-z]/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one lowercase letter');
    } else {
      result.score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one uppercase letter');
    } else {
      result.score += 1;
    }

    if (!/\d/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one number');
    } else {
      result.score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      result.errors.push('Password should contain at least one special character');
    } else {
      result.score += 2;
    }

    // Common password check
    const commonPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      result.isValid = false;
      result.errors.push('Password is too common');
    }

    return result;
  }

  /**
   * Generate secure random password
   * @param {number} length - Password length (default: 16)
   * @returns {string} Generated password
   */
  static generateSecurePassword(length = 16) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + special;
    let password = '';

    // Ensure at least one character from each set
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining length
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

/**
 * Security Utilities
 */
class SecurityUtils {
  /**
   * Generate cryptographically secure random string
   * @param {number} length - String length
   * @returns {string} Random string
   */
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   * @param {string} prefix - Optional prefix (default: 'usr_')
   * @returns {string} API key
   */
  static generateApiKey(prefix = 'usr_') {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}${random}`;
  }

  /**
   * Hash API key for storage
   * @param {string} apiKey - API key to hash
   * @returns {string} Hashed API key
   */
  static hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Sanitize user input
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized input
   */
  static sanitizeInput(input, options = {}) {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // HTML encode if specified
    if (options.htmlEncode) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Maximum length
    if (options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Validation result
   */
  static isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Extract client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} IP address
   */
  static getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  /**
   * Generate secure session ID
   * @returns {string} Session ID
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Rate Limiting Configurations
 */
class RateLimiter {
  /**
   * Auth endpoint rate limiter
   */
  static authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return SecurityUtils.getClientIP(req);
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many authentication attempts, please try again later.',
        retryAfter: Math.round(req.rateLimit.msBeforeNext / 1000)
      });
    }
  });

  /**
   * General API rate limiter
   */
  static apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many API requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });

  /**
   * Password reset rate limiter
   */
  static passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset attempts, please try again later.'
  });

  /**
   * Registration rate limiter
   */
  static registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: 'Too many registration attempts, please try again later.'
  });
}

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://theprofitplatform.com.au',
      'https://test.theprofitplatform.com.au',
      'https://dashboard.theprofitplatform.com.au'
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID', 'X-API-Key']
};

// Export all utilities
module.exports = {
  TokenManager,
  PasswordManager,
  SecurityUtils,
  RateLimiter,
  corsOptions,
  TOKEN_TYPES
};