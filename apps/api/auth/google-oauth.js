/**
 * Google OAuth Integration for Ultimate SEO Platform
 * Handles Google OAuth 2.0 authentication and Google Workspace integration
 */

const { google } = require('googleapis');
const { SecurityUtils } = require('./auth.utils');

/**
 * Google OAuth Service Class
 * Handles Google authentication and API integration
 */
class GoogleOAuthService {
  constructor(authService, logger) {
    this.authService = authService;
    this.logger = logger;
    
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    // Configure scopes for Google Workspace access
    this.scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly'
    ];

    // Validate required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      this.logger?.warn('Google OAuth not configured. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }
  }

  /**
   * Generate Google OAuth authorization URL
   * @param {Object} options - OAuth options
   * @returns {string} Authorization URL
   */
  getAuthUrl(options = {}) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Google OAuth not configured');
    }

    const state = SecurityUtils.generateSecureToken();
    
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scopes,
      state: state,
      ...options
    });

    return { url, state };
  }

  /**
   * Handle Google OAuth callback
   * @param {string} code - Authorization code from Google
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<Object>} User data and tokens
   */
  async handleCallback(code, state, expectedState) {
    try {
      // Verify state parameter for CSRF protection
      if (state !== expectedState) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: googleUser } = await oauth2.userinfo.get();

      if (!googleUser.email) {
        throw new Error('Email not provided by Google');
      }

      // Check if user already exists
      let user = await this.findOrCreateUser(googleUser, tokens);

      return {
        success: true,
        user,
        isNewUser: user.isNewUser || false
      };

    } catch (error) {
      this.logger?.error('Google OAuth callback failed', { 
        error: error.message,
        code: code ? 'present' : 'missing'
      });
      throw error;
    }
  }

  /**
   * Find existing user or create new one from Google data
   * @param {Object} googleUser - Google user data
   * @param {Object} tokens - Google tokens
   * @returns {Promise<Object>} User data
   */
  async findOrCreateUser(googleUser, tokens) {
    const client = await this.authService.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user exists by email
      let userResult = await client.query(
        'SELECT * FROM auth.users WHERE email = $1',
        [googleUser.email.toLowerCase()]
      );

      let user;
      let isNewUser = false;

      if (userResult.rows.length > 0) {
        // Update existing user with Google data
        user = userResult.rows[0];
        
        await client.query(
          `UPDATE auth.users 
           SET google_id = $1, google_tokens = $2, email_verified = true, 
               full_name = COALESCE(full_name, $3), avatar_url = COALESCE(avatar_url, $4)
           WHERE id = $5`,
          [
            googleUser.id,
            JSON.stringify(tokens),
            googleUser.name,
            googleUser.picture,
            user.id
          ]
        );

        this.logger?.info('Existing user updated with Google data', { 
          userId: user.id,
          email: user.email
        });

      } else {
        // Create new user with Google data
        isNewUser = true;

        // Get or create default organization
        let orgResult = await client.query(
          'SELECT id FROM auth.organizations WHERE slug = $1',
          ['demo']
        );

        if (orgResult.rows.length === 0) {
          // Create default organization if it doesn't exist
          orgResult = await client.query(
            `INSERT INTO auth.organizations (name, slug, subscription_tier) 
             VALUES ($1, $2, $3) RETURNING id`,
            ['Demo Organization', 'demo', 'trial']
          );
        }

        const organizationId = orgResult.rows[0].id;

        // Create new user
        userResult = await client.query(
          `INSERT INTO auth.users 
           (organization_id, email, full_name, avatar_url, google_id, google_tokens, 
            email_verified, role) 
           VALUES ($1, $2, $3, $4, $5, $6, true, $7) 
           RETURNING *`,
          [
            organizationId,
            googleUser.email.toLowerCase(),
            googleUser.name,
            googleUser.picture,
            googleUser.id,
            JSON.stringify(tokens),
            'admin' // First user becomes admin
          ]
        );

        user = userResult.rows[0];

        this.logger?.info('New user created from Google OAuth', { 
          userId: user.id,
          email: user.email,
          organizationId
        });
      }

      await client.query('COMMIT');

      return {
        ...user,
        isNewUser,
        googleData: {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          verified_email: googleUser.verified_email
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('User creation/update failed', { 
        error: error.message,
        email: googleUser.email
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refresh Google tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Refreshed tokens
   */
  async refreshGoogleTokens(userId) {
    try {
      // Get user's current tokens
      const userResult = await this.authService.db.query(
        'SELECT google_tokens FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].google_tokens) {
        throw new Error('User not found or no Google tokens');
      }

      const currentTokens = userResult.rows[0].google_tokens;
      
      if (!currentTokens.refresh_token) {
        throw new Error('No refresh token available');
      }

      // Set current tokens and refresh
      this.oauth2Client.setCredentials(currentTokens);
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update tokens in database
      await this.authService.db.query(
        'UPDATE auth.users SET google_tokens = $1 WHERE id = $2',
        [JSON.stringify(credentials), userId]
      );

      this.logger?.info('Google tokens refreshed', { userId });

      return credentials;

    } catch (error) {
      this.logger?.error('Google token refresh failed', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get Google Analytics data for a user
   * @param {string} userId - User ID
   * @param {string} viewId - Google Analytics view ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalyticsData(userId, viewId, options = {}) {
    try {
      const tokens = await this.refreshGoogleTokens(userId);
      this.oauth2Client.setCredentials(tokens);

      const analytics = google.analyticsreporting({ version: 'v4', auth: this.oauth2Client });

      const {
        startDate = '30daysAgo',
        endDate = 'today',
        metrics = ['ga:sessions', 'ga:users', 'ga:pageviews'],
        dimensions = ['ga:date']
      } = options;

      const response = await analytics.reports.batchGet({
        requestBody: {
          reportRequests: [{
            viewId: viewId,
            dateRanges: [{ startDate, endDate }],
            metrics: metrics.map(metric => ({ expression: metric })),
            dimensions: dimensions.map(dimension => ({ name: dimension }))
          }]
        }
      });

      this.logger?.info('Google Analytics data retrieved', { 
        userId,
        viewId,
        rowCount: response.data.reports[0]?.data?.rows?.length || 0
      });

      return response.data;

    } catch (error) {
      this.logger?.error('Google Analytics fetch failed', { 
        error: error.message,
        userId,
        viewId
      });
      throw error;
    }
  }

  /**
   * Get Google Search Console data for a user
   * @param {string} userId - User ID
   * @param {string} siteUrl - Search Console site URL
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search Console data
   */
  async getSearchConsoleData(userId, siteUrl, options = {}) {
    try {
      const tokens = await this.refreshGoogleTokens(userId);
      this.oauth2Client.setCredentials(tokens);

      const searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });

      const {
        startDate = '2023-01-01',
        endDate = new Date().toISOString().split('T')[0],
        dimensions = ['query'],
        rowLimit = 1000
      } = options;

      const response = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow: 0
        }
      });

      this.logger?.info('Google Search Console data retrieved', { 
        userId,
        siteUrl,
        rowCount: response.data.rows?.length || 0
      });

      return response.data;

    } catch (error) {
      this.logger?.error('Google Search Console fetch failed', { 
        error: error.message,
        userId,
        siteUrl
      });
      throw error;
    }
  }

  /**
   * Verify Google Search Console site ownership
   * @param {string} userId - User ID
   * @param {string} siteUrl - Site URL to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifySearchConsoleSite(userId, siteUrl) {
    try {
      const tokens = await this.refreshGoogleTokens(userId);
      this.oauth2Client.setCredentials(tokens);

      const searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });

      // List sites to check if already verified
      const sitesResponse = await searchconsole.sites.list();
      const sites = sitesResponse.data.siteEntry || [];
      
      const existingSite = sites.find(site => site.siteUrl === siteUrl);
      
      if (existingSite) {
        return {
          verified: existingSite.permissionLevel === 'siteOwner' || existingSite.permissionLevel === 'siteFullUser',
          permissionLevel: existingSite.permissionLevel,
          siteUrl: existingSite.siteUrl
        };
      }

      // If not found, try to add the site
      try {
        await searchconsole.sites.add({
          siteUrl: siteUrl
        });

        // Check verification status
        const verificationResponse = await searchconsole.sites.get({
          siteUrl: siteUrl
        });

        return {
          verified: true,
          permissionLevel: verificationResponse.data.permissionLevel,
          siteUrl: verificationResponse.data.siteUrl
        };

      } catch (addError) {
        // Site addition failed, likely not verified
        return {
          verified: false,
          error: addError.message,
          siteUrl: siteUrl
        };
      }

    } catch (error) {
      this.logger?.error('Search Console verification failed', { 
        error: error.message,
        userId,
        siteUrl
      });
      throw error;
    }
  }

  /**
   * Revoke Google tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Revocation result
   */
  async revokeGoogleTokens(userId) {
    try {
      // Get user's current tokens
      const userResult = await this.authService.db.query(
        'SELECT google_tokens FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].google_tokens) {
        throw new Error('User not found or no Google tokens');
      }

      const tokens = userResult.rows[0].google_tokens;
      
      // Revoke tokens with Google
      this.oauth2Client.setCredentials(tokens);
      await this.oauth2Client.revokeToken(tokens.access_token);

      // Clear tokens from database
      await this.authService.db.query(
        'UPDATE auth.users SET google_tokens = NULL, google_id = NULL WHERE id = $1',
        [userId]
      );

      this.logger?.info('Google tokens revoked', { userId });

      return {
        success: true,
        message: 'Google access revoked successfully'
      };

    } catch (error) {
      this.logger?.error('Google token revocation failed', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Check if user has valid Google tokens
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Token validity
   */
  async hasValidGoogleTokens(userId) {
    try {
      const userResult = await this.authService.db.query(
        'SELECT google_tokens FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].google_tokens) {
        return false;
      }

      const tokens = userResult.rows[0].google_tokens;
      
      // Check if tokens are expired
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        // Try to refresh tokens
        try {
          await this.refreshGoogleTokens(userId);
          return true;
        } catch (error) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger?.error('Google token validation failed', { 
        error: error.message,
        userId
      });
      return false;
    }
  }
}

/**
 * Google OAuth Controller Class
 * HTTP endpoints for Google OAuth integration
 */
class GoogleOAuthController {
  constructor(googleOAuthService, authService, logger) {
    this.googleOAuthService = googleOAuthService;
    this.authService = authService;
    this.logger = logger;
  }

  /**
   * Initiate Google OAuth flow
   * GET /auth/google
   */
  initiateGoogleAuth = (req, res) => {
    try {
      const { url, state } = this.googleOAuthService.getAuthUrl();
      
      // Store state in session or cookie for verification
      res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600000 // 10 minutes
      });

      res.json({
        success: true,
        authUrl: url,
        state: state
      });

    } catch (error) {
      this.logger?.error('Google auth initiation failed', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'OAuth Setup Failed',
        message: 'Could not initiate Google authentication'
      });
    }
  };

  /**
   * Handle Google OAuth callback
   * POST /auth/google/callback
   */
  handleGoogleCallback = async (req, res) => {
    try {
      const { code, state } = req.body;
      const expectedState = req.cookies.oauth_state;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Missing Code',
          message: 'Authorization code is required'
        });
      }

      const result = await this.googleOAuthService.handleCallback(code, state, expectedState);

      // Clear state cookie
      res.clearCookie('oauth_state');

      // Generate JWT tokens for the user
      const tokenPayload = {
        user_id: result.user.id,
        organization_id: result.user.organization_id,
        email: result.user.email,
        role: result.user.role,
        permissions: result.user.permissions || []
      };

      const tokens = this.authService.tokenManager.generateTokenPair(tokenPayload);

      // Create session
      const sessionData = await this.authService.createSession(result.user.id, tokens, {
        ipAddress: SecurityUtils.getClientIP(req),
        userAgent: req.headers['user-agent'] || 'Unknown'
      });

      res.json({
        success: true,
        message: result.isNewUser ? 'Account created successfully' : 'Login successful',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.full_name,
            role: result.user.role,
            emailVerified: result.user.email_verified,
            isNewUser: result.isNewUser
          },
          tokens,
          sessionId: sessionData.id
        }
      });

    } catch (error) {
      this.logger?.error('Google callback failed', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'OAuth Callback Failed',
        message: error.message
      });
    }
  };

  /**
   * Get Google Analytics data
   * GET /auth/google/analytics/:viewId
   */
  getAnalyticsData = async (req, res) => {
    try {
      const { viewId } = req.params;
      const options = req.query;

      const data = await this.googleOAuthService.getAnalyticsData(
        req.user.id,
        viewId,
        options
      );

      res.json({
        success: true,
        data: data
      });

    } catch (error) {
      this.logger?.error('Analytics data fetch failed', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Analytics Fetch Failed',
        message: 'Could not retrieve Google Analytics data'
      });
    }
  };

  /**
   * Get Search Console data
   * GET /auth/google/search-console/:siteUrl
   */
  getSearchConsoleData = async (req, res) => {
    try {
      const { siteUrl } = req.params;
      const options = req.query;

      const data = await this.googleOAuthService.getSearchConsoleData(
        req.user.id,
        decodeURIComponent(siteUrl),
        options
      );

      res.json({
        success: true,
        data: data
      });

    } catch (error) {
      this.logger?.error('Search Console data fetch failed', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Search Console Fetch Failed',
        message: 'Could not retrieve Google Search Console data'
      });
    }
  };

  /**
   * Revoke Google access
   * DELETE /auth/google/revoke
   */
  revokeGoogleAccess = async (req, res) => {
    try {
      const result = await this.googleOAuthService.revokeGoogleTokens(req.user.id);

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      this.logger?.error('Google access revocation failed', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Revocation Failed',
        message: 'Could not revoke Google access'
      });
    }
  };
}

module.exports = {
  GoogleOAuthService,
  GoogleOAuthController
};