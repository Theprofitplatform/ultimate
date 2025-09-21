/**
 * Session Management Service for Ultimate SEO Platform
 * Redis-based session management with device tracking and security features
 */

const Redis = require('redis');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Session Service Class
 * Advanced session management with Redis backend
 */
class SessionService {
  constructor(logger, redisConfig = null) {
    this.logger = logger;
    this.redisClient = null;
    this.sessionTTL = parseInt(process.env.SESSION_TTL) || 86400; // 24 hours default
    this.maxSessionsPerUser = parseInt(process.env.MAX_SESSIONS_PER_USER) || 10;

    // Initialize Redis connection
    this.initializeRedis(redisConfig);
  }

  /**
   * Initialize Redis connection
   * @param {Object} config - Redis configuration
   */
  async initializeRedis(config = null) {
    try {
      const redisUrl = config?.url || process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = Redis.createClient({
        url: redisUrl,
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
        ...config
      });

      this.redisClient.on('error', (error) => {
        this.logger?.error('Redis session client error', { error: error.message });
      });

      this.redisClient.on('connect', () => {
        this.logger?.info('Redis session client connected');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger?.info('Redis session client reconnecting');
      });

      await this.redisClient.connect();
      await this.redisClient.ping();

      this.logger?.info('Session Redis client initialized successfully');

    } catch (error) {
      this.logger?.error('Failed to initialize session Redis client', {
        error: error.message
      });
      throw new Error('Session service initialization failed');
    }
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} Session information
   */
  async createSession(sessionData) {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized');
    }

    const {
      userId,
      organizationId,
      email,
      role,
      permissions = [],
      ipAddress,
      userAgent,
      tokenIds = {}
    } = sessionData;

    try {
      const sessionId = uuidv4();
      const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
      const expiresAt = new Date(Date.now() + (this.sessionTTL * 1000));

      const session = {
        id: sessionId,
        userId,
        organizationId,
        email,
        role,
        permissions,
        deviceFingerprint,
        ipAddress,
        userAgent,
        tokenIds,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        isActive: true,
        loginCount: 1
      };

      // Store session in Redis
      await this.redisClient.setEx(
        `session:${sessionId}`,
        this.sessionTTL,
        JSON.stringify(session)
      );

      // Add session to user's session list
      await this.addToUserSessions(userId, sessionId);

      // Enforce max sessions per user
      await this.enforceMaxSessions(userId);

      // Track session statistics
      await this.updateSessionStats(userId, 'create');

      this.logger?.info('Session created successfully', {
        sessionId,
        userId,
        organizationId,
        deviceFingerprint,
        ipAddress
      });

      return {
        sessionId,
        expiresAt,
        deviceFingerprint
      };

    } catch (error) {
      this.logger?.error('Session creation failed', {
        error: error.message,
        userId,
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session data
   */
  async getSession(sessionId) {
    if (!this.redisClient || !sessionId) {
      return null;
    }

    try {
      const sessionData = await this.redisClient.get(`session:${sessionId}`);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);

      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.destroySession(sessionId);
        return null;
      }

      // Update last accessed time
      session.lastAccessedAt = new Date().toISOString();
      await this.redisClient.setEx(
        `session:${sessionId}`,
        this.sessionTTL,
        JSON.stringify(session)
      );

      return session;

    } catch (error) {
      this.logger?.error('Failed to get session', {
        error: error.message,
        sessionId
      });
      return null;
    }
  }

  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success status
   */
  async updateSession(sessionId, updateData) {
    if (!this.redisClient || !sessionId) {
      return false;
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Merge update data
      const updatedSession = {
        ...session,
        ...updateData,
        lastAccessedAt: new Date().toISOString()
      };

      await this.redisClient.setEx(
        `session:${sessionId}`,
        this.sessionTTL,
        JSON.stringify(updatedSession)
      );

      return true;

    } catch (error) {
      this.logger?.error('Failed to update session', {
        error: error.message,
        sessionId
      });
      return false;
    }
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async destroySession(sessionId) {
    if (!this.redisClient || !sessionId) {
      return false;
    }

    try {
      // Get session to extract user ID
      const session = await this.getSession(sessionId);

      // Remove session
      await this.redisClient.del(`session:${sessionId}`);

      if (session) {
        // Remove from user's session list
        await this.removeFromUserSessions(session.userId, sessionId);

        // Update session statistics
        await this.updateSessionStats(session.userId, 'destroy');

        this.logger?.info('Session destroyed successfully', {
          sessionId,
          userId: session.userId
        });
      }

      return true;

    } catch (error) {
      this.logger?.error('Failed to destroy session', {
        error: error.message,
        sessionId
      });
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of sessions
   */
  async getUserSessions(userId) {
    if (!this.redisClient || !userId) {
      return [];
    }

    try {
      const sessionIds = await this.redisClient.sMembers(`user_sessions:${userId}`);
      const sessions = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          // Remove sensitive data for client response
          const sanitizedSession = {
            id: session.id,
            deviceFingerprint: session.deviceFingerprint,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastAccessedAt: session.lastAccessedAt,
            expiresAt: session.expiresAt,
            isActive: session.isActive
          };
          sessions.push(sanitizedSession);
        }
      }

      return sessions.sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt));

    } catch (error) {
      this.logger?.error('Failed to get user sessions', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Destroy all sessions for a user
   * @param {string} userId - User ID
   * @param {string} excludeSessionId - Session ID to exclude (optional)
   * @returns {Promise<number>} Number of sessions destroyed
   */
  async destroyAllUserSessions(userId, excludeSessionId = null) {
    if (!this.redisClient || !userId) {
      return 0;
    }

    try {
      const sessionIds = await this.redisClient.sMembers(`user_sessions:${userId}`);
      let destroyedCount = 0;

      const destroyPromises = sessionIds
        .filter(sessionId => sessionId !== excludeSessionId)
        .map(async (sessionId) => {
          const success = await this.destroySession(sessionId);
          if (success) destroyedCount++;
        });

      await Promise.all(destroyPromises);

      this.logger?.info('All user sessions destroyed', {
        userId,
        destroyedCount,
        excludedSession: excludeSessionId
      });

      return destroyedCount;

    } catch (error) {
      this.logger?.error('Failed to destroy all user sessions', {
        error: error.message,
        userId
      });
      return 0;
    }
  }

  /**
   * Validate session with security checks
   * @param {string} sessionId - Session ID
   * @param {Object} context - Request context
   * @returns {Promise<Object|null>} Session data if valid
   */
  async validateSession(sessionId, context = {}) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Security validations
    if (!session.isActive) {
      this.logger?.warn('Inactive session access attempt', { sessionId });
      return null;
    }

    // Optional: Validate device fingerprint
    if (context.userAgent && context.ipAddress) {
      const currentFingerprint = this.generateDeviceFingerprint(
        context.userAgent,
        context.ipAddress
      );

      if (session.deviceFingerprint !== currentFingerprint) {
        this.logger?.warn('Device fingerprint mismatch', {
          sessionId,
          userId: session.userId,
          expected: session.deviceFingerprint,
          actual: currentFingerprint
        });

        // You might want to be more strict here in production
        // return null;
      }
    }

    // Optional: IP address validation
    if (process.env.STRICT_IP_VALIDATION === 'true' &&
        context.ipAddress &&
        session.ipAddress !== context.ipAddress) {
      this.logger?.warn('IP address change detected', {
        sessionId,
        userId: session.userId,
        originalIP: session.ipAddress,
        currentIP: context.ipAddress
      });

      // In strict mode, destroy session on IP change
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    if (!this.redisClient) {
      return 0;
    }

    try {
      const keys = await this.redisClient.keys('session:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const sessionData = await this.redisClient.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expiresAt) < new Date()) {
            await this.redisClient.del(key);

            // Remove from user sessions list
            if (session.userId) {
              await this.removeFromUserSessions(session.userId, session.id);
            }

            cleanedCount++;
          }
        }
      }

      this.logger?.info('Session cleanup completed', { cleanedCount });
      return cleanedCount;

    } catch (error) {
      this.logger?.error('Session cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Get session statistics
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(userId = null) {
    if (!this.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      if (userId) {
        // User-specific stats
        const userSessionIds = await this.redisClient.sMembers(`user_sessions:${userId}`);
        const activeSessions = [];

        for (const sessionId of userSessionIds) {
          const session = await this.getSession(sessionId);
          if (session) {
            activeSessions.push(session);
          }
        }

        return {
          userId,
          totalSessions: activeSessions.length,
          activeSessions: activeSessions.length,
          lastLoginAt: activeSessions.length > 0 ?
            Math.max(...activeSessions.map(s => new Date(s.createdAt).getTime())) : null,
          devices: [...new Set(activeSessions.map(s => s.deviceFingerprint))].length
        };

      } else {
        // Global stats
        const sessionKeys = await this.redisClient.keys('session:*');
        const userKeys = await this.redisClient.keys('user_sessions:*');

        return {
          totalActiveSessions: sessionKeys.length,
          totalUsers: userKeys.length,
          averageSessionsPerUser: userKeys.length > 0 ?
            Math.round(sessionKeys.length / userKeys.length * 100) / 100 : 0
        };
      }

    } catch (error) {
      this.logger?.error('Failed to get session stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Add session to user's session list
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @private
   */
  async addToUserSessions(userId, sessionId) {
    try {
      await this.redisClient.sAdd(`user_sessions:${userId}`, sessionId);
      await this.redisClient.expire(`user_sessions:${userId}`, this.sessionTTL);
    } catch (error) {
      this.logger?.error('Failed to add session to user list', {
        error: error.message,
        userId,
        sessionId
      });
    }
  }

  /**
   * Remove session from user's session list
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @private
   */
  async removeFromUserSessions(userId, sessionId) {
    try {
      await this.redisClient.sRem(`user_sessions:${userId}`, sessionId);
    } catch (error) {
      this.logger?.error('Failed to remove session from user list', {
        error: error.message,
        userId,
        sessionId
      });
    }
  }

  /**
   * Enforce maximum sessions per user
   * @param {string} userId - User ID
   * @private
   */
  async enforceMaxSessions(userId) {
    try {
      const sessionIds = await this.redisClient.sMembers(`user_sessions:${userId}`);

      if (sessionIds.length > this.maxSessionsPerUser) {
        // Get all sessions with their creation times
        const sessionsWithTime = [];

        for (const sessionId of sessionIds) {
          const session = await this.getSession(sessionId);
          if (session) {
            sessionsWithTime.push({
              id: sessionId,
              createdAt: new Date(session.createdAt)
            });
          }
        }

        // Sort by creation time (oldest first)
        sessionsWithTime.sort((a, b) => a.createdAt - b.createdAt);

        // Remove oldest sessions
        const sessionsToRemove = sessionsWithTime.length - this.maxSessionsPerUser;
        for (let i = 0; i < sessionsToRemove; i++) {
          await this.destroySession(sessionsWithTime[i].id);
        }

        this.logger?.info('Enforced max sessions limit', {
          userId,
          removedSessions: sessionsToRemove,
          maxSessions: this.maxSessionsPerUser
        });
      }

    } catch (error) {
      this.logger?.error('Failed to enforce max sessions', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Update session statistics
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @private
   */
  async updateSessionStats(userId, action) {
    try {
      const statsKey = `session_stats:${userId}`;
      const stats = await this.redisClient.get(statsKey);

      let currentStats = stats ? JSON.parse(stats) : {
        totalLogins: 0,
        lastLoginAt: null,
        createdSessions: 0,
        destroyedSessions: 0
      };

      if (action === 'create') {
        currentStats.totalLogins++;
        currentStats.createdSessions++;
        currentStats.lastLoginAt = new Date().toISOString();
      } else if (action === 'destroy') {
        currentStats.destroyedSessions++;
      }

      await this.redisClient.setEx(statsKey, 86400 * 30, JSON.stringify(currentStats)); // 30 days

    } catch (error) {
      this.logger?.error('Failed to update session stats', {
        error: error.message,
        userId,
        action
      });
    }
  }

  /**
   * Generate device fingerprint
   * @param {string} userAgent - User agent string
   * @param {string} ipAddress - IP address
   * @returns {string} Device fingerprint
   * @private
   */
  generateDeviceFingerprint(userAgent = '', ipAddress = '') {
    const data = `${userAgent}|${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger?.info('Session service Redis connection closed');
    }
  }
}

module.exports = SessionService;