/**
 * Auth Service for Ultimate SEO Platform
 * Business logic for authentication, user management, and session handling
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { TokenManager, PasswordManager, SecurityUtils } = require('./auth.utils');
const JWTService = require('./jwt.service');

/**
 * Authentication Service Class
 * Handles all authentication-related business logic
 */
class AuthService {
  constructor(dbPool, logger, jwtService = null) {
    this.db = dbPool;
    this.logger = logger;
    this.tokenManager = new TokenManager();
    this.jwtService = jwtService || new JWTService(logger);
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {Object} organizationData - Organization data (optional)
   * @returns {Promise<Object>} Registration result
   */
  async register(userData, organizationData = null) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Validate input
      const { email, password, fullName, role = 'admin' } = userData;
      
      if (!SecurityUtils.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }

      const passwordValidation = PasswordManager.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists with this email address');
      }

      // Handle organization
      let organizationId;
      
      if (organizationData) {
        // Create new organization
        const orgResult = await client.query(
          `INSERT INTO auth.organizations (name, slug, domain, subscription_tier) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          [
            organizationData.name,
            organizationData.slug || organizationData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            organizationData.domain,
            organizationData.subscriptionTier || 'trial'
          ]
        );
        organizationId = orgResult.rows[0].id;
      } else {
        // Use default organization (for demo purposes)
        const defaultOrg = await client.query(
          'SELECT id FROM auth.organizations WHERE slug = $1',
          ['demo']
        );
        
        if (defaultOrg.rows.length === 0) {
          throw new Error('Default organization not found. Please contact administrator.');
        }
        
        organizationId = defaultOrg.rows[0].id;
      }

      // Hash password
      const passwordHash = await PasswordManager.hashPassword(password);

      // Create user
      const userResult = await client.query(
        `INSERT INTO auth.users 
         (organization_id, email, password_hash, full_name, role, email_verified) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, email, full_name, role, created_at`,
        [organizationId, email.toLowerCase(), passwordHash, fullName, role, false]
      );

      const newUser = userResult.rows[0];

      await client.query('COMMIT');

      this.logger?.info('User registered successfully', { 
        userId: newUser.id, 
        email: newUser.email,
        organizationId 
      });

      // Generate email verification token
      const verificationToken = this.tokenManager.generateEmailVerificationToken({
        user_id: newUser.id,
        email: newUser.email
      });

      return {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
          emailVerified: false,
          createdAt: newUser.created_at
        },
        organizationId,
        verificationToken
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('Registration failed', { error: error.message, email: userData.email });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Authenticate user login
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} loginInfo - Additional login information (IP, user agent)
   * @returns {Promise<Object>} Authentication result
   */
  async login(email, password, loginInfo = {}) {
    try {
      // Get user with organization data
      const userResult = await this.db.query(
        `SELECT u.*, o.name as organization_name, o.slug as organization_slug,
                o.subscription_tier, o.is_active as org_active
         FROM auth.users u
         JOIN auth.organizations o ON u.organization_id = o.id
         WHERE u.email = $1 AND u.is_active = true AND o.is_active = true`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userResult.rows[0];

      // Verify password
      if (!user.password_hash) {
        throw new Error('Password not set. Please use social login or reset password.');
      }

      const isPasswordValid = await PasswordManager.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Check if organization subscription is active
      if (user.subscription_tier !== 'free' && user.subscription_expires_at && 
          new Date(user.subscription_expires_at) < new Date()) {
        throw new Error('Organization subscription has expired');
      }

      // Generate tokens using enhanced JWT service if available
      const tokenPayload = {
        user_id: user.id,
        organization_id: user.organization_id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      };

      const tokens = this.jwtService ?
        await this.jwtService.generateTokenPair(tokenPayload, {
          userAgent: loginInfo.userAgent,
          ipAddress: loginInfo.ipAddress
        }) :
        this.tokenManager.generateTokenPair(tokenPayload);

      // Create session
      const sessionData = await this.createSession(user.id, tokens, loginInfo);

      // Update last login
      await this.db.query(
        'UPDATE auth.users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      this.logger?.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email,
        organizationId: user.organization_id,
        ip: loginInfo.ipAddress
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          permissions: user.permissions || [],
          emailVerified: user.email_verified,
          organization: {
            id: user.organization_id,
            name: user.organization_name,
            slug: user.organization_slug,
            subscriptionTier: user.subscription_tier
          }
        },
        tokens,
        session: sessionData
      };

    } catch (error) {
      this.logger?.error('Login failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @param {Object} sessionInfo - Session information
   * @returns {Promise<Object>} New access token
   */
  async refreshToken(refreshToken, sessionInfo = {}) {
    try {
      // Verify refresh token
      const decoded = this.tokenManager.verifyToken(refreshToken, 'refresh');

      // Check if session exists and is valid
      const sessionResult = await this.db.query(
        `SELECT s.*, u.email, u.full_name, u.role, u.permissions, u.organization_id,
                o.name as organization_name, o.slug as organization_slug, o.subscription_tier
         FROM auth.sessions s
         JOIN auth.users u ON s.user_id = u.id
         JOIN auth.organizations o ON u.organization_id = o.id
         WHERE s.refresh_token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP 
               AND u.is_active = true AND o.is_active = true`,
        [crypto.createHash('sha256').update(refreshToken).digest('hex')]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const session = sessionResult.rows[0];

      // Generate new access token
      const tokenPayload = {
        user_id: session.user_id,
        organization_id: session.organization_id,
        email: session.email,
        role: session.role,
        permissions: session.permissions || []
      };

      const newAccessToken = this.tokenManager.generateAccessToken(tokenPayload);

      this.logger?.info('Token refreshed successfully', { 
        userId: session.user_id,
        sessionId: session.id 
      });

      return {
        success: true,
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
      };

    } catch (error) {
      this.logger?.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Logout user and invalidate session
   * @param {string} sessionId - Session ID to invalidate
   * @param {string} userId - User ID for verification
   * @returns {Promise<Object>} Logout result
   */
  async logout(sessionId, userId) {
    try {
      const result = await this.db.query(
        'DELETE FROM auth.sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Session not found');
      }

      this.logger?.info('User logged out successfully', { userId, sessionId });

      return {
        success: true,
        message: 'Logged out successfully'
      };

    } catch (error) {
      this.logger?.error('Logout failed', { error: error.message, userId, sessionId });
      throw error;
    }
  }

  /**
   * Verify email address
   * @param {string} verificationToken - Email verification token
   * @returns {Promise<Object>} Verification result
   */
  async verifyEmail(verificationToken) {
    try {
      const decoded = this.tokenManager.verifyToken(verificationToken, 'email_verification');

      const result = await this.db.query(
        'UPDATE auth.users SET email_verified = true WHERE id = $1 AND email = $2',
        [decoded.user_id, decoded.email]
      );

      if (result.rowCount === 0) {
        throw new Error('User not found or email already verified');
      }

      this.logger?.info('Email verified successfully', { userId: decoded.user_id });

      return {
        success: true,
        message: 'Email verified successfully'
      };

    } catch (error) {
      this.logger?.error('Email verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initiate password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Password reset result
   */
  async initiatePasswordReset(email) {
    try {
      const userResult = await this.db.query(
        'SELECT id, email, full_name FROM auth.users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );

      // Always return success to prevent email enumeration
      if (userResult.rows.length === 0) {
        this.logger?.warn('Password reset attempted for non-existent email', { email });
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      const user = userResult.rows[0];

      // Generate password reset token
      const resetToken = this.tokenManager.generatePasswordResetToken({
        user_id: user.id,
        email: user.email
      });

      this.logger?.info('Password reset initiated', { userId: user.id });

      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        resetToken, // In production, this would be sent via email
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name
        }
      };

    } catch (error) {
      this.logger?.error('Password reset initiation failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Password reset result
   */
  async resetPassword(resetToken, newPassword) {
    try {
      const decoded = this.tokenManager.verifyToken(resetToken, 'password_reset');

      // Validate new password
      const passwordValidation = PasswordManager.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash new password
      const passwordHash = await PasswordManager.hashPassword(newPassword);

      // Update password and invalidate all sessions
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        const updateResult = await client.query(
          'UPDATE auth.users SET password_hash = $1 WHERE id = $2 AND email = $3',
          [passwordHash, decoded.user_id, decoded.email]
        );

        if (updateResult.rowCount === 0) {
          throw new Error('User not found');
        }

        // Invalidate all existing sessions for this user
        await client.query(
          'DELETE FROM auth.sessions WHERE user_id = $1',
          [decoded.user_id]
        );

        await client.query('COMMIT');

        this.logger?.info('Password reset successfully', { userId: decoded.user_id });

        return {
          success: true,
          message: 'Password reset successfully. Please login with your new password.'
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      this.logger?.error('Password reset failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Change user password (authenticated)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Password change result
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get current user
      const userResult = await this.db.query(
        'SELECT password_hash FROM auth.users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Verify current password
      const isCurrentPasswordValid = await PasswordManager.verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const passwordValidation = PasswordManager.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash new password
      const passwordHash = await PasswordManager.hashPassword(newPassword);

      // Update password
      await this.db.query(
        'UPDATE auth.users SET password_hash = $1 WHERE id = $2',
        [passwordHash, userId]
      );

      this.logger?.info('Password changed successfully', { userId });

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      this.logger?.error('Password change failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create user session
   * @param {string} userId - User ID
   * @param {Object} tokens - Token pair
   * @param {Object} sessionInfo - Session information
   * @returns {Promise<Object>} Session data
   */
  async createSession(userId, tokens, sessionInfo = {}) {
    const sessionId = uuidv4();
    const tokenHash = crypto.createHash('sha256').update(tokens.accessToken).digest('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = this.tokenManager.getTokenExpiration(tokens.refreshToken);

    await this.db.query(
      `INSERT INTO auth.sessions 
       (id, user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        userId,
        tokenHash,
        refreshTokenHash,
        sessionInfo.ipAddress,
        sessionInfo.userAgent,
        expiresAt
      ]
    );

    return {
      id: sessionId,
      expiresAt
    };
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    try {
      const result = await this.db.query(
        `SELECT u.id, u.email, u.full_name, u.avatar_url, u.role, u.permissions,
                u.email_verified, u.last_login_at, u.created_at,
                o.id as organization_id, o.name as organization_name, 
                o.slug as organization_slug, o.subscription_tier
         FROM auth.users u
         JOIN auth.organizations o ON u.organization_id = o.id
         WHERE u.id = $1 AND u.is_active = true`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        permissions: user.permissions || [],
        emailVerified: user.email_verified,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        organization: {
          id: user.organization_id,
          name: user.organization_name,
          slug: user.organization_slug,
          subscriptionTier: user.subscription_tier
        }
      };

    } catch (error) {
      this.logger?.error('Get user profile failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated profile
   */
  async updateUserProfile(userId, profileData) {
    try {
      const { fullName, avatarUrl } = profileData;
      
      const result = await this.db.query(
        `UPDATE auth.users 
         SET full_name = COALESCE($2, full_name), 
             avatar_url = COALESCE($3, avatar_url)
         WHERE id = $1 AND is_active = true
         RETURNING id, email, full_name, avatar_url, role`,
        [userId, fullName, avatarUrl]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      this.logger?.info('User profile updated', { userId });

      return result.rows[0];

    } catch (error) {
      this.logger?.error('Update user profile failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Validate session
   * @param {string} sessionId - Session ID
   * @param {string} tokenHash - Token hash
   * @returns {Promise<Object>} Session validation result
   */
  async validateSession(sessionId, tokenHash) {
    try {
      const result = await this.db.query(
        `SELECT s.*, u.id as user_id, u.email, u.role, u.permissions, u.organization_id
         FROM auth.sessions s
         JOIN auth.users u ON s.user_id = u.id
         WHERE s.id = $1 AND s.token_hash = $2 AND s.expires_at > CURRENT_TIMESTAMP
               AND u.is_active = true`,
        [sessionId, tokenHash]
      );

      return result.rows.length > 0 ? result.rows[0] : null;

    } catch (error) {
      this.logger?.error('Session validation failed', { error: error.message, sessionId });
      return null;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.db.query(
        'DELETE FROM auth.sessions WHERE expires_at < CURRENT_TIMESTAMP'
      );

      this.logger?.info('Expired sessions cleaned up', { count: result.rowCount });

      return result.rowCount;

    } catch (error) {
      this.logger?.error('Session cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Generate API key for user
   * @param {Object} keyData - API key data
   * @returns {Promise<Object>} API key result
   */
  async generateApiKey(keyData) {
    try {
      const {
        name,
        permissions = [],
        userId,
        organizationId,
        expiresIn = '365d'
      } = keyData;

      // Generate API key
      const apiKey = SecurityUtils.generateApiKey('ak_');
      const keyHash = SecurityUtils.hashApiKey(apiKey);
      const keyId = uuidv4();

      // Calculate expiry date
      const expiresAt = new Date();
      const duration = this.parseExpiry(expiresIn);
      expiresAt.setTime(expiresAt.getTime() + duration);

      // Store API key in database
      const result = await this.db.query(
        `INSERT INTO auth.api_keys
         (id, name, key_hash, user_id, organization_id, permissions, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING id, name, permissions, expires_at, created_at`,
        [keyId, name, keyHash, userId, organizationId, JSON.stringify(permissions), expiresAt]
      );

      this.logger?.info('API key generated', {
        keyId,
        userId,
        organizationId,
        name
      });

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        key: apiKey, // Only return the actual key on creation
        permissions: result.rows[0].permissions,
        expiresAt: result.rows[0].expires_at,
        createdAt: result.rows[0].created_at
      };

    } catch (error) {
      this.logger?.error('API key generation failed', {
        error: error.message,
        userId: keyData.userId
      });
      throw error;
    }
  }

  /**
   * Get user's API keys
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of API keys
   */
  async getUserApiKeys(userId) {
    try {
      const result = await this.db.query(
        `SELECT id, name, permissions, expires_at, created_at, last_used_at, is_active
         FROM auth.api_keys
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(key => ({
        ...key,
        key: '***' + key.id.substring(key.id.length - 4), // Masked key
        permissions: key.permissions || []
      }));

    } catch (error) {
      this.logger?.error('Failed to get user API keys', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Revoke API key
   * @param {string} keyId - API key ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async revokeApiKey(keyId, userId) {
    try {
      const result = await this.db.query(
        'UPDATE auth.api_keys SET is_active = false WHERE id = $1 AND user_id = $2',
        [keyId, userId]
      );

      if (result.rowCount === 0) {
        return false;
      }

      this.logger?.info('API key revoked', { keyId, userId });
      return true;

    } catch (error) {
      this.logger?.error('API key revocation failed', {
        error: error.message,
        keyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get user sessions from database
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of sessions
   */
  async getUserSessions(userId) {
    try {
      const result = await this.db.query(
        `SELECT id, ip_address, user_agent, created_at, expires_at
         FROM auth.sessions
         WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isActive: true
      }));

    } catch (error) {
      this.logger?.error('Failed to get user sessions', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Revoke all user sessions
   * @param {string} userId - User ID
   * @param {string} excludeSessionId - Session to exclude
   * @returns {Promise<number>} Number of revoked sessions
   */
  async revokeAllUserSessions(userId, excludeSessionId = null) {
    try {
      let query = 'DELETE FROM auth.sessions WHERE user_id = $1';
      const params = [userId];

      if (excludeSessionId) {
        query += ' AND id != $2';
        params.push(excludeSessionId);
      }

      const result = await this.db.query(query, params);

      this.logger?.info('All user sessions revoked', {
        userId,
        revokedCount: result.rowCount,
        excludedSession: excludeSessionId
      });

      return result.rowCount;

    } catch (error) {
      this.logger?.error('Failed to revoke all user sessions', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get session statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(userId) {
    try {
      const [sessionResult, loginResult] = await Promise.all([
        this.db.query(
          'SELECT COUNT(*) as active_sessions FROM auth.sessions WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP',
          [userId]
        ),
        this.db.query(
          'SELECT last_login_at, created_at FROM auth.users WHERE id = $1',
          [userId]
        )
      ]);

      const user = loginResult.rows[0];

      return {
        userId,
        activeSessions: parseInt(sessionResult.rows[0].active_sessions),
        lastLoginAt: user?.last_login_at,
        memberSince: user?.created_at
      };

    } catch (error) {
      this.logger?.error('Failed to get session stats', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Parse expiry string to milliseconds
   * @param {string} expiry - Expiry string (e.g., '15m', '7d')
   * @returns {number} Milliseconds
   * @private
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
}

module.exports = AuthService;