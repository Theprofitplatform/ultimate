/**
 * Authentication System Unit Tests
 * Testing AuthService and AuthController with comprehensive coverage
 */

const AuthService = require('../../apps/api/auth/auth.service');
const AuthController = require('../../apps/api/auth/auth.controller');
const { SecurityUtils, PasswordManager, TokenManager } = require('../../apps/api/auth/auth.utils');
const JWTService = require('../../apps/api/auth/jwt.service');
const { dbHelper } = require('../helpers/database');
const { users, dbUsers, organizations, sessions, jwtTokens } = require('../fixtures/users');

describe('AuthService', () => {
  let authService;
  let mockPool;
  let mockLogger;

  beforeEach(async () => {
    // Setup database transaction
    mockPool = await dbHelper.startTransaction();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    authService = new AuthService(mockPool, mockLogger);
  });

  afterEach(async () => {
    await dbHelper.rollbackTransaction();
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const userData = users.validUser;
      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        email: userData.email.toLowerCase(),
        fullName: userData.fullName,
        role: userData.role,
        emailVerified: false
      });
      expect(result.user.id).toHaveValidDatabaseId();
      expect(result.organizationId).toHaveValidDatabaseId();
      expect(result.verificationToken).toBeDefined();
    });

    test('should register user with organization', async () => {
      const userData = users.userWithOrg;
      const result = await authService.register(userData, userData.organization);

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email.toLowerCase());
      expect(result.organizationId).toHaveValidDatabaseId();
    });

    test('should reject registration with invalid email', async () => {
      const userData = { ...users.validUser, email: 'invalid-email' };

      await expect(authService.register(userData))
        .rejects.toThrow('Invalid email address');
    });

    test('should reject registration with weak password', async () => {
      const userData = { ...users.validUser, password: '123' };

      await expect(authService.register(userData))
        .rejects.toThrow('Password validation failed');
    });

    test('should reject duplicate email registration', async () => {
      const userData = users.validUser;

      // First registration should succeed
      await authService.register(userData);

      // Second registration should fail
      await expect(authService.register(userData))
        .rejects.toThrow('User already exists with this email address');
    });

    test('should handle database transaction rollback on error', async () => {
      const userData = users.validUser;

      // Mock database error
      const originalQuery = mockPool.query;
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // Email check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Organization
        .mockRejectedValueOnce(new Error('Database error')); // User creation

      await expect(authService.register(userData))
        .rejects.toThrow('Database error');

      // Verify rollback was called
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Registration failed',
        expect.objectContaining({ error: 'Database error' })
      );
    });
  });

  describe('User Login', () => {
    let testUser;

    beforeEach(async () => {
      // Create test user in database
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should login user with valid credentials', async () => {
      const result = await authService.login(
        testUser.email,
        'AdminPassword123!',
        { ipAddress: '127.0.0.1', userAgent: 'Test Browser' }
      );

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        fullName: testUser.full_name,
        role: testUser.role
      });
      expect(result.tokens).toMatchObject({
        accessToken: expect.toBeValidJWT(),
        refreshToken: expect.toBeValidJWT(),
        tokenType: 'Bearer',
        expiresIn: expect.any(String)
      });
      expect(result.session).toMatchObject({
        id: expect.toBeValidUUID(),
        expiresAt: expect.any(Date)
      });
    });

    test('should reject login with invalid email', async () => {
      await expect(authService.login(
        'nonexistent@example.com',
        'ValidPassword123!',
        {}
      )).rejects.toThrow('Invalid email or password');
    });

    test('should reject login with invalid password', async () => {
      await expect(authService.login(
        testUser.email,
        'WrongPassword123!',
        {}
      )).rejects.toThrow('Invalid email or password');
    });

    test('should reject login for inactive user', async () => {
      const inactiveUser = await dbHelper.createTestUser(await dbUsers.inactiveUser());

      await expect(authService.login(
        inactiveUser.email,
        'InactivePassword123!',
        {}
      )).rejects.toThrow('Invalid email or password');
    });

    test('should update last login timestamp', async () => {
      const originalLastLogin = testUser.last_login_at;

      await authService.login(
        testUser.email,
        'AdminPassword123!',
        {}
      );

      // Verify last_login_at was updated
      const updatedUser = await mockPool.query(
        'SELECT last_login_at FROM auth.users WHERE id = $1',
        [testUser.id]
      );

      expect(updatedUser.rows[0].last_login_at).toBeRecentTimestamp();
    });
  });

  describe('Token Refresh', () => {
    let testUser;
    let validTokens;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());

      const loginResult = await authService.login(
        testUser.email,
        'AdminPassword123!',
        { ipAddress: '127.0.0.1', userAgent: 'Test Browser' }
      );

      validTokens = loginResult.tokens;
    });

    test('should refresh access token with valid refresh token', async () => {
      const result = await authService.refreshToken(
        validTokens.refreshToken,
        { ipAddress: '127.0.0.1', userAgent: 'Test Browser' }
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeValidJWT();
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBeDefined();
    });

    test('should reject refresh with invalid token', async () => {
      await expect(authService.refreshToken(
        'invalid.token.here',
        {}
      )).rejects.toThrow('Invalid or expired refresh token');
    });

    test('should reject refresh with expired session', async () => {
      // Create expired session
      const expiredSession = await dbHelper.createTestSession(testUser.id, {
        refresh_token_hash: 'expired-hash',
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });

      const mockRefreshToken = 'expired.refresh.token';

      await expect(authService.refreshToken(mockRefreshToken, {}))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('User Logout', () => {
    let testUser;
    let testSession;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
      testSession = await dbHelper.createTestSession(testUser.id);
    });

    test('should logout user successfully', async () => {
      const result = await authService.logout(testSession.id, testUser.id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');

      // Verify session was deleted
      const sessionCheck = await mockPool.query(
        'SELECT id FROM auth.sessions WHERE id = $1',
        [testSession.id]
      );
      expect(sessionCheck.rows).toHaveLength(0);
    });

    test('should reject logout with invalid session', async () => {
      await expect(authService.logout('invalid-session-id', testUser.id))
        .rejects.toThrow('Session not found');
    });

    test('should reject logout with mismatched user', async () => {
      const otherUser = await dbHelper.createTestUser({
        email: 'other@example.com',
        password_hash: 'hashed-password',
        full_name: 'Other User'
      });

      await expect(authService.logout(testSession.id, otherUser.id))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Email Verification', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.unverifiedUser());
    });

    test('should verify email with valid token', async () => {
      const tokenManager = new TokenManager();
      const verificationToken = tokenManager.generateEmailVerificationToken({
        user_id: testUser.id,
        email: testUser.email
      });

      const result = await authService.verifyEmail(verificationToken);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email verified successfully');

      // Verify user email_verified status was updated
      const userCheck = await mockPool.query(
        'SELECT email_verified FROM auth.users WHERE id = $1',
        [testUser.id]
      );
      expect(userCheck.rows[0].email_verified).toBe(true);
    });

    test('should reject verification with invalid token', async () => {
      await expect(authService.verifyEmail('invalid.token.here'))
        .rejects.toThrow();
    });

    test('should reject verification for non-existent user', async () => {
      const tokenManager = new TokenManager();
      const invalidToken = tokenManager.generateEmailVerificationToken({
        user_id: 99999,
        email: 'nonexistent@example.com'
      });

      await expect(authService.verifyEmail(invalidToken))
        .rejects.toThrow('User not found or email already verified');
    });
  });

  describe('Password Reset', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should initiate password reset for valid email', async () => {
      const result = await authService.initiatePasswordReset(testUser.email);

      expect(result.success).toBe(true);
      expect(result.message).toContain('password reset link has been sent');
      expect(result.resetToken).toBeDefined();
      expect(result.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        fullName: testUser.full_name
      });
    });

    test('should return success for non-existent email (security)', async () => {
      const result = await authService.initiatePasswordReset('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('password reset link has been sent');
      expect(result.resetToken).toBeUndefined();
    });

    test('should reset password with valid token', async () => {
      const resetResult = await authService.initiatePasswordReset(testUser.email);
      const newPassword = 'NewSecurePassword123!';

      const result = await authService.resetPassword(resetResult.resetToken, newPassword);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Password reset successfully');

      // Verify all sessions were invalidated
      const sessionCheck = await mockPool.query(
        'SELECT id FROM auth.sessions WHERE user_id = $1',
        [testUser.id]
      );
      expect(sessionCheck.rows).toHaveLength(0);

      // Verify can login with new password
      const loginResult = await authService.login(testUser.email, newPassword, {});
      expect(loginResult.success).toBe(true);
    });

    test('should reject reset with invalid token', async () => {
      await expect(authService.resetPassword(
        'invalid.token.here',
        'NewPassword123!'
      )).rejects.toThrow();
    });

    test('should reject reset with weak password', async () => {
      const resetResult = await authService.initiatePasswordReset(testUser.email);

      await expect(authService.resetPassword(
        resetResult.resetToken,
        'weak'
      )).rejects.toThrow('Password validation failed');
    });
  });

  describe('Password Change', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should change password with valid current password', async () => {
      const currentPassword = 'AdminPassword123!';
      const newPassword = 'NewSecurePassword456!';

      const result = await authService.changePassword(
        testUser.id,
        currentPassword,
        newPassword
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');

      // Verify can login with new password
      const loginResult = await authService.login(testUser.email, newPassword, {});
      expect(loginResult.success).toBe(true);
    });

    test('should reject change with incorrect current password', async () => {
      await expect(authService.changePassword(
        testUser.id,
        'WrongCurrentPassword!',
        'NewPassword123!'
      )).rejects.toThrow('Current password is incorrect');
    });

    test('should reject change with weak new password', async () => {
      await expect(authService.changePassword(
        testUser.id,
        'AdminPassword123!',
        'weak'
      )).rejects.toThrow('Password validation failed');
    });

    test('should reject change for non-existent user', async () => {
      await expect(authService.changePassword(
        99999,
        'AdminPassword123!',
        'NewPassword123!'
      )).rejects.toThrow('User not found');
    });
  });

  describe('User Profile Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should get user profile', async () => {
      const profile = await authService.getUserProfile(testUser.id);

      expect(profile).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        fullName: testUser.full_name,
        role: testUser.role,
        permissions: expect.any(Array),
        emailVerified: testUser.email_verified,
        organization: expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          slug: expect.any(String)
        })
      });
    });

    test('should update user profile', async () => {
      const updateData = {
        fullName: 'Updated Full Name',
        avatarUrl: 'https://example.com/avatar.jpg'
      };

      const updatedProfile = await authService.updateUserProfile(testUser.id, updateData);

      expect(updatedProfile.full_name).toBe(updateData.fullName);
      expect(updatedProfile.avatar_url).toBe(updateData.avatarUrl);
    });

    test('should reject profile update for non-existent user', async () => {
      await expect(authService.updateUserProfile(99999, { fullName: 'Test' }))
        .rejects.toThrow('User not found');
    });
  });

  describe('Session Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should create session', async () => {
      const tokens = {
        accessToken: 'access.token.here',
        refreshToken: 'refresh.token.here'
      };
      const sessionInfo = {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      const session = await authService.createSession(testUser.id, tokens, sessionInfo);

      expect(session).toMatchObject({
        id: expect.toBeValidUUID(),
        expiresAt: expect.any(Date)
      });
    });

    test('should validate session', async () => {
      const session = await dbHelper.createTestSession(testUser.id);

      const validation = await authService.validateSession(
        session.id,
        session.token_hash
      );

      expect(validation).toMatchObject({
        user_id: testUser.id,
        email: testUser.email,
        role: testUser.role
      });
    });

    test('should return null for invalid session', async () => {
      const validation = await authService.validateSession(
        'invalid-session-id',
        'invalid-token-hash'
      );

      expect(validation).toBeNull();
    });

    test('should get user sessions', async () => {
      await dbHelper.createTestSession(testUser.id);
      await dbHelper.createTestSession(testUser.id);

      const sessions = await authService.getUserSessions(testUser.id);

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        id: expect.toBeValidUUID(),
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
        isActive: true
      });
    });

    test('should revoke all user sessions', async () => {
      const session1 = await dbHelper.createTestSession(testUser.id);
      const session2 = await dbHelper.createTestSession(testUser.id);

      const revokedCount = await authService.revokeAllUserSessions(testUser.id);

      expect(revokedCount).toBe(2);

      // Verify sessions were deleted
      const remainingSessions = await authService.getUserSessions(testUser.id);
      expect(remainingSessions).toHaveLength(0);
    });

    test('should cleanup expired sessions', async () => {
      // Create expired session
      await dbHelper.createTestSession(testUser.id, {
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });

      const cleanedCount = await authService.cleanupExpiredSessions();

      expect(cleanedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('API Key Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await dbHelper.createTestUser(await dbUsers.adminUser());
    });

    test('should generate API key', async () => {
      const keyData = {
        name: 'Test API Key',
        permissions: ['keyword:read', 'keyword:write'],
        userId: testUser.id,
        organizationId: testUser.organization_id
      };

      const apiKey = await authService.generateApiKey(keyData);

      expect(apiKey).toMatchObject({
        id: expect.toBeValidUUID(),
        name: keyData.name,
        key: expect.stringMatching(/^ak_/),
        permissions: keyData.permissions,
        expiresAt: expect.any(Date)
      });
    });

    test('should get user API keys', async () => {
      await authService.generateApiKey({
        name: 'Test Key 1',
        userId: testUser.id,
        organizationId: testUser.organization_id
      });

      const apiKeys = await authService.getUserApiKeys(testUser.id);

      expect(apiKeys).toHaveLength(1);
      expect(apiKeys[0]).toMatchObject({
        name: 'Test Key 1',
        key: expect.stringMatching(/^\*\*\*/), // Masked key
        permissions: expect.any(Array)
      });
    });

    test('should revoke API key', async () => {
      const apiKey = await authService.generateApiKey({
        name: 'Test Key',
        userId: testUser.id,
        organizationId: testUser.organization_id
      });

      const success = await authService.revokeApiKey(apiKey.id, testUser.id);

      expect(success).toBe(true);

      // Verify key is inactive
      const apiKeys = await authService.getUserApiKeys(testUser.id);
      expect(apiKeys).toHaveLength(0);
    });
  });
});

describe('AuthController', () => {
  let authController;
  let mockAuthService;
  let mockLogger;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      verifyEmail: jest.fn(),
      initiatePasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      getUserSessions: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      generateApiKey: jest.fn(),
      getUserApiKeys: jest.fn(),
      revokeApiKey: jest.fn(),
      getSessionStats: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    authController = new AuthController(mockAuthService, mockLogger);

    mockReq = {
      body: {},
      headers: { 'user-agent': 'Test Browser' },
      ip: '127.0.0.1',
      user: null,
      cookies: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
  });

  describe('Registration Endpoint', () => {
    test('should register user successfully', async () => {
      mockReq.body = users.validUser;
      mockAuthService.register.mockResolvedValue({
        success: true,
        user: { id: 1, email: users.validUser.email, emailVerified: false },
        organizationId: 1
      });

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: expect.objectContaining({
          user: expect.any(Object),
          organizationId: 1,
          emailVerificationRequired: true
        })
      });
    });

    test('should reject registration with missing fields', async () => {
      mockReq.body = { email: 'test@example.com' }; // Missing password and fullName

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message: 'Email, password, and full name are required'
      });
    });

    test('should handle duplicate user error', async () => {
      mockReq.body = users.validUser;
      mockAuthService.register.mockRejectedValue(new Error('User already exists with this email address'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User Exists',
        message: 'User already exists with this email address'
      });
    });
  });

  describe('Login Endpoint', () => {
    test('should login user successfully', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password123' };
      const loginResult = {
        success: true,
        user: { id: 1, email: 'test@example.com' },
        tokens: {
          accessToken: 'access.token',
          refreshToken: 'refresh.token',
          tokenType: 'Bearer',
          expiresIn: '15m'
        },
        session: { id: 'session-id' }
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      await authController.login(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: expect.objectContaining({
          user: loginResult.user,
          tokens: expect.objectContaining({
            accessToken: 'access.token',
            tokenType: 'Bearer',
            expiresIn: '15m'
          }),
          sessionId: 'session-id'
        })
      });
    });

    test('should set refresh token cookie when rememberMe is true', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true
      };
      const loginResult = {
        success: true,
        user: { id: 1 },
        tokens: { refreshToken: 'refresh.token' },
        session: { id: 'session-id' }
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      await authController.login(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh.token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict'
        })
      );
    });

    test('should reject login with missing credentials', async () => {
      mockReq.body = { email: 'test@example.com' }; // Missing password

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message: 'Email and password are required'
      });
    });

    test('should handle authentication failure', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong-password' };
      mockAuthService.login.mockRejectedValue(new Error('Invalid email or password'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    });
  });

  describe('Token Refresh Endpoint', () => {
    test('should refresh token successfully', async () => {
      mockReq.body = { refreshToken: 'valid.refresh.token' };
      const refreshResult = {
        success: true,
        accessToken: 'new.access.token',
        tokenType: 'Bearer',
        expiresIn: '15m'
      };

      mockAuthService.refreshToken.mockResolvedValue(refreshResult);

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: refreshResult
      });
    });

    test('should use refresh token from cookie', async () => {
      mockReq.cookies = { refreshToken: 'cookie.refresh.token' };
      const refreshResult = { success: true, accessToken: 'new.token' };

      mockAuthService.refreshToken.mockResolvedValue(refreshResult);

      await authController.refreshToken(mockReq, mockRes);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'cookie.refresh.token',
        expect.any(Object)
      );
    });

    test('should clear cookie on invalid refresh token', async () => {
      mockReq.body = { refreshToken: 'invalid.token' };
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid or expired refresh token'));

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Logout Endpoint', () => {
    test('should logout user successfully', async () => {
      mockReq.user = { sessionId: 'session-id', userId: 1 };
      mockAuthService.logout.mockResolvedValue({
        success: true,
        message: 'Logged out successfully'
      });

      await authController.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    test('should reject logout with invalid session data', async () => {
      mockReq.user = {}; // Missing sessionId and userId

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message: 'Invalid session data'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      mockReq.body = users.validUser;
      mockAuthService.register.mockRejectedValue(new Error('Database connection failed'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Registration Failed',
        message: 'An error occurred during registration'
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockReq.body = users.validUser;
      mockAuthService.register.mockRejectedValue(new Error('Sensitive database error message'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An error occurred during registration'
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize user inputs', async () => {
      mockReq.body = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
        fullName: '  <script>alert("xss")</script>John Doe  '
      };

      mockAuthService.register.mockResolvedValue({
        success: true,
        user: { id: 1 },
        organizationId: 1
      });

      await authController.register(mockReq, mockRes);

      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com', // Lowercase and trimmed
          fullName: expect.not.stringContaining('<script>') // XSS sanitized
        }),
        null
      );
    });
  });
});