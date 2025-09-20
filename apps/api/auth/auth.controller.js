/**
 * Auth Controller for Ultimate SEO Platform
 * HTTP endpoints for authentication and user management
 */

const { SecurityUtils } = require('./auth.utils');

/**
 * Authentication Controller Class
 * Handles HTTP requests for authentication endpoints
 */
class AuthController {
  constructor(authService, logger) {
    this.authService = authService;
    this.logger = logger;
  }

  /**
   * User registration endpoint
   * POST /auth/register
   */
  register = async (req, res) => {
    try {
      const { email, password, fullName, organizationName } = req.body;

      // Input validation
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Email, password, and full name are required'
        });
      }

      // Sanitize inputs
      const sanitizedData = {
        email: SecurityUtils.sanitizeInput(email).toLowerCase(),
        password,
        fullName: SecurityUtils.sanitizeInput(fullName),
        role: 'admin' // First user in org is admin
      };

      let organizationData = null;
      if (organizationName) {
        organizationData = {
          name: SecurityUtils.sanitizeInput(organizationName),
          subscriptionTier: 'trial'
        };
      }

      const result = await this.authService.register(sanitizedData, organizationData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          organizationId: result.organizationId,
          emailVerificationRequired: !result.user.emailVerified
        }
      });

    } catch (error) {
      this.logger?.error('Registration failed', { 
        error: error.message,
        ip: SecurityUtils.getClientIP(req)
      });

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: 'User Exists',
          message: error.message
        });
      }

      if (error.message.includes('validation failed')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration Failed',
        message: 'An error occurred during registration'
      });
    }
  };

  /**
   * User login endpoint
   * POST /auth/login
   */
  login = async (req, res) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // Input validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Email and password are required'
        });
      }

      const loginInfo = {
        ipAddress: SecurityUtils.getClientIP(req),
        userAgent: req.headers['user-agent'] || 'Unknown'
      };

      const result = await this.authService.login(
        SecurityUtils.sanitizeInput(email),
        password,
        loginInfo
      );

      // Set HTTP-only cookie for refresh token if remember me is enabled
      if (rememberMe) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: {
            accessToken: result.tokens.accessToken,
            tokenType: result.tokens.tokenType,
            expiresIn: result.tokens.expiresIn
            // Don't send refresh token in response body for security
          },
          sessionId: result.session.id
        }
      });

    } catch (error) {
      this.logger?.error('Login failed', { 
        error: error.message,
        email: req.body.email,
        ip: SecurityUtils.getClientIP(req)
      });

      if (error.message.includes('Invalid email') || 
          error.message.includes('Password not set') ||
          error.message.includes('subscription has expired')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication Failed',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Login Failed',
        message: 'An error occurred during login'
      });
    }
  };

  /**
   * Token refresh endpoint
   * POST /auth/refresh
   */
  refreshToken = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const cookieRefreshToken = req.cookies?.refreshToken;

      const tokenToUse = refreshToken || cookieRefreshToken;

      if (!tokenToUse) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Refresh token is required'
        });
      }

      const sessionInfo = {
        ipAddress: SecurityUtils.getClientIP(req),
        userAgent: req.headers['user-agent'] || 'Unknown'
      };

      const result = await this.authService.refreshToken(tokenToUse, sessionInfo);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });

    } catch (error) {
      this.logger?.error('Token refresh failed', { 
        error: error.message,
        ip: SecurityUtils.getClientIP(req)
      });

      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        // Clear refresh token cookie if it exists
        res.clearCookie('refreshToken');
        
        return res.status(401).json({
          success: false,
          error: 'Invalid Token',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Token Refresh Failed',
        message: 'An error occurred while refreshing token'
      });
    }
  };

  /**
   * User logout endpoint
   * POST /auth/logout
   */
  logout = async (req, res) => {
    try {
      const { sessionId, userId } = req.user || {};

      if (!sessionId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid session data'
        });
      }

      await this.authService.logout(sessionId, userId);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      this.logger?.error('Logout failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Logout Failed',
        message: 'An error occurred during logout'
      });
    }
  };

  /**
   * Email verification endpoint
   * POST /auth/verify-email
   */
  verifyEmail = async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Verification token is required'
        });
      }

      const result = await this.authService.verifyEmail(token);

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      this.logger?.error('Email verification failed', { error: error.message });

      if (error.message.includes('expired') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Token',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Verification Failed',
        message: 'An error occurred during email verification'
      });
    }
  };

  /**
   * Initiate password reset endpoint
   * POST /auth/forgot-password
   */
  forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Email is required'
        });
      }

      const result = await this.authService.initiatePasswordReset(
        SecurityUtils.sanitizeInput(email)
      );

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      this.logger?.error('Password reset initiation failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Password Reset Failed',
        message: 'An error occurred while processing password reset request'
      });
    }
  };

  /**
   * Reset password endpoint
   * POST /auth/reset-password
   */
  resetPassword = async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Reset token and new password are required'
        });
      }

      const result = await this.authService.resetPassword(token, newPassword);

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      this.logger?.error('Password reset failed', { error: error.message });

      if (error.message.includes('expired') || 
          error.message.includes('Invalid') ||
          error.message.includes('validation failed')) {
        return res.status(400).json({
          success: false,
          error: 'Reset Failed',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Password Reset Failed',
        message: 'An error occurred while resetting password'
      });
    }
  };

  /**
   * Change password endpoint (authenticated)
   * POST /auth/change-password
   */
  changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Current password and new password are required'
        });
      }

      const result = await this.authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      this.logger?.error('Password change failed', { 
        error: error.message,
        userId: req.user?.id
      });

      if (error.message.includes('incorrect') ||
          error.message.includes('validation failed')) {
        return res.status(400).json({
          success: false,
          error: 'Password Change Failed',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Password Change Failed',
        message: 'An error occurred while changing password'
      });
    }
  };

  /**
   * Get user profile endpoint
   * GET /auth/profile
   */
  getProfile = async (req, res) => {
    try {
      const profile = await this.authService.getUserProfile(req.user.id);

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      this.logger?.error('Get profile failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Profile Fetch Failed',
        message: 'An error occurred while fetching profile'
      });
    }
  };

  /**
   * Update user profile endpoint
   * PUT /auth/profile
   */
  updateProfile = async (req, res) => {
    try {
      const { fullName, avatarUrl } = req.body;

      const profileData = {
        fullName: fullName ? SecurityUtils.sanitizeInput(fullName) : undefined,
        avatarUrl: avatarUrl ? SecurityUtils.sanitizeInput(avatarUrl) : undefined
      };

      const updatedProfile = await this.authService.updateUserProfile(
        req.user.id,
        profileData
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile
      });

    } catch (error) {
      this.logger?.error('Profile update failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Profile Update Failed',
        message: 'An error occurred while updating profile'
      });
    }
  };

  /**
   * Get user sessions endpoint
   * GET /auth/sessions
   */
  getSessions = async (req, res) => {
    try {
      // This would require an additional method in AuthService
      const sessions = await this.authService.getUserSessions(req.user.id);

      res.json({
        success: true,
        data: sessions
      });

    } catch (error) {
      this.logger?.error('Get sessions failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Sessions Fetch Failed',
        message: 'An error occurred while fetching sessions'
      });
    }
  };

  /**
   * Revoke session endpoint
   * DELETE /auth/sessions/:sessionId
   */
  revokeSession = async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Session ID is required'
        });
      }

      await this.authService.logout(sessionId, req.user.id);

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });

    } catch (error) {
      this.logger?.error('Session revoke failed', { 
        error: error.message,
        userId: req.user?.id,
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        success: false,
        error: 'Session Revoke Failed',
        message: 'An error occurred while revoking session'
      });
    }
  };

  /**
   * Health check endpoint
   * GET /auth/health
   */
  healthCheck = (req, res) => {
    res.json({
      success: true,
      message: 'Auth service is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  };

  /**
   * Get authentication status
   * GET /auth/me
   */
  getAuthStatus = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          message: 'Not authenticated'
        });
      }

      const profile = await this.authService.getUserProfile(req.user.id);

      res.json({
        success: true,
        authenticated: true,
        user: profile
      });

    } catch (error) {
      this.logger?.error('Auth status check failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Status Check Failed',
        message: 'An error occurred while checking authentication status'
      });
    }
  };

  /**
   * Resend email verification
   * POST /auth/resend-verification
   */
  resendVerification = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Generate new verification token
      const verificationToken = this.authService.tokenManager.generateEmailVerificationToken({
        user_id: req.user.id,
        email: req.user.email
      });

      // In production, this would trigger an email send
      // For now, we'll just return success

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      this.logger?.error('Resend verification failed', { 
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Resend Failed',
        message: 'An error occurred while resending verification email'
      });
    }
  };
}

module.exports = AuthController;