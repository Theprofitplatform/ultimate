/**
 * End-to-End User Flow Tests
 * Testing complete user journeys through the Ultimate SEO Platform
 */

const request = require('supertest');
const express = require('express');
const AuthService = require('../../apps/api/auth/auth.service');
const AuthController = require('../../apps/api/auth/auth.controller');
const KeywordsService = require('../../apps/api/src/services/keywords.service');
const { dbHelper } = require('../helpers/database');
const { users, organizations } = require('../fixtures/users');
const { keywords } = require('../fixtures/keywords');

// Mock Express app for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock authentication middleware
  app.use('/api/auth/*', (req, res, next) => {
    if (req.path === '/register' || req.path === '/login' || req.path === '/health') {
      return next();
    }

    if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      if (token === 'valid-test-token') {
        req.user = {
          id: 1,
          email: 'test@example.com',
          organization_id: 1,
          role: 'admin',
          sessionId: 'test-session-id'
        };
      }
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  });

  return app;
}

describe('End-to-End User Flows', () => {
  let app;
  let authService;
  let authController;
  let keywordsService;
  let testDb;

  beforeAll(async () => {
    // Setup test database
    testDb = await dbHelper.startTransaction();

    // Initialize services
    authService = new AuthService(testDb, console);
    authController = new AuthController(authService, console);
    keywordsService = new KeywordsService();

    // Create test app
    app = createTestApp();

    // Mount auth routes
    app.post('/api/auth/register', authController.register);
    app.post('/api/auth/login', authController.login);
    app.post('/api/auth/logout', authController.logout);
    app.get('/api/auth/profile', authController.getProfile);
    app.put('/api/auth/profile', authController.updateProfile);
    app.post('/api/auth/change-password', authController.changePassword);
    app.get('/api/auth/health', authController.healthCheck);

    // Mock keyword routes
    app.get('/api/keywords', async (req, res) => {
      try {
        const result = await keywordsService.getKeywords(req.user.organization_id, req.query);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/api/keywords', async (req, res) => {
      try {
        const result = await keywordsService.createKeyword(req.user.organization_id, req.body);
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    });

    app.post('/api/keywords/analyze', async (req, res) => {
      try {
        const result = await keywordsService.analyzeKeywords(req.user.organization_id, req.body);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  afterAll(async () => {
    await dbHelper.rollbackTransaction();
    await dbHelper.close();
    if (keywordsService) {
      await keywordsService.cleanup();
    }
  });

  describe('User Registration and Authentication Flow', () => {
    test('should complete full user registration and login flow', async () => {
      const userData = {
        email: 'e2e-test@example.com',
        password: 'SecurePassword123!',
        fullName: 'E2E Test User',
        organizationName: 'E2E Test Company'
      };

      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            email: userData.email.toLowerCase(),
            fullName: userData.fullName,
            emailVerified: false
          },
          organizationId: expect.any(Number),
          emailVerificationRequired: true
        }
      });

      // Step 2: Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            email: userData.email.toLowerCase(),
            fullName: userData.fullName
          },
          tokens: {
            accessToken: expect.any(String),
            tokenType: 'Bearer',
            expiresIn: expect.any(String)
          },
          sessionId: expect.any(String)
        }
      });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // Step 3: Access protected profile endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer valid-test-token`)
        .expect(200);

      expect(profileResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          email: expect.any(String),
          fullName: expect.any(String),
          organization: expect.objectContaining({
            name: expect.any(String)
          })
        })
      });

      // Step 4: Update profile
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer valid-test-token`)
        .send({
          fullName: 'Updated E2E Test User'
        })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: expect.objectContaining({
          full_name: 'Updated E2E Test User'
        })
      });

      // Step 5: Change password
      const passwordResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer valid-test-token`)
        .send({
          currentPassword: userData.password,
          newPassword: 'NewSecurePassword456!'
        })
        .expect(200);

      expect(passwordResponse.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      });

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer valid-test-token`)
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    test('should handle authentication errors appropriately', async () => {
      // Invalid credentials
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      // Missing token
      await request(app)
        .get('/api/auth/profile')
        .expect(401);

      // Invalid token
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should validate input data properly', async () => {
      // Invalid email format
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          fullName: 'Test User'
        })
        .expect(400);

      // Weak password
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          fullName: 'Test User'
        })
        .expect(400);

      // Missing required fields
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
        })
        .expect(400);
    });
  });

  describe('Keywords Management Flow', () => {
    beforeEach(async () => {
      // Setup authenticated user context
      await dbHelper.createTestUser({
        id: 1,
        organization_id: 1,
        email: 'keywords-test@example.com',
        password_hash: 'hashed-password',
        full_name: 'Keywords Test User'
      });
    });

    test('should complete full keyword management workflow', async () => {
      // Step 1: Create a new keyword
      const keywordData = {
        keyword: 'e2e test keyword',
        search_volume: 5000,
        keyword_difficulty: 45,
        cpc: 2.50,
        competition_level: 'medium',
        location: 'global',
        language: 'en',
        device: 'desktop'
      };

      const createResponse = await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send(keywordData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(Number),
          keyword: keywordData.keyword,
          search_volume: keywordData.search_volume,
          tenant_id: 1
        }
      });

      const keywordId = createResponse.body.data.id;

      // Step 2: Retrieve keywords list
      const listResponse = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(listResponse.body).toMatchObject({
        success: true,
        data: {
          data: expect.arrayContaining([
            expect.objectContaining({
              id: keywordId,
              keyword: keywordData.keyword
            })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: expect.any(Number)
          })
        }
      });

      // Step 3: Filter keywords
      const filterResponse = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .query({
          keyword: 'e2e test',
          min_search_volume: 1000,
          competition_level: 'medium'
        })
        .expect(200);

      expect(filterResponse.body.data.data).toHaveLength(1);
      expect(filterResponse.body.data.data[0].keyword).toContain('e2e test');

      // Step 4: Analyze keywords
      const analysisResponse = await request(app)
        .post('/api/keywords/analyze')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          keywords: ['analysis test keyword 1', 'analysis test keyword 2'],
          location: 'global',
          language: 'en',
          device: 'desktop'
        })
        .expect(200);

      expect(analysisResponse.body).toMatchObject({
        success: true,
        data: {
          total_analyzed: 2,
          successful: expect.any(Number),
          failed: expect.any(Number),
          results: expect.arrayContaining([
            expect.objectContaining({
              keyword: expect.any(String),
              success: expect.any(Boolean)
            })
          ])
        }
      });

      // Step 5: Verify analyzed keywords were saved
      const afterAnalysisResponse = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .query({ keyword: 'analysis test' })
        .expect(200);

      expect(afterAnalysisResponse.body.data.data.length).toBeGreaterThan(0);
    });

    test('should handle keyword creation errors', async () => {
      // Duplicate keyword
      const keywordData = keywords.validKeyword;

      // Create first keyword
      await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send(keywordData)
        .expect(201);

      // Try to create duplicate
      await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send(keywordData)
        .expect(400);

      // Invalid keyword data
      await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          keyword: '', // Empty keyword
          search_volume: -100 // Invalid volume
        })
        .expect(400);
    });

    test('should maintain data isolation between tenants', async () => {
      // Create keyword for first tenant
      await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          keyword: 'tenant 1 keyword',
          search_volume: 1000
        })
        .expect(201);

      // Verify tenant 1 can see their keywords
      const tenant1Response = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);

      const tenant1Keywords = tenant1Response.body.data.data;
      expect(tenant1Keywords.some(k => k.keyword === 'tenant 1 keyword')).toBe(true);
      expect(tenant1Keywords.every(k => k.tenant_id === 1)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle server errors gracefully', async () => {
      // Mock server error by breaking database connection
      const originalQuery = testDb.query;
      testDb.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(users.validUser)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });

      // Restore database
      testDb.query = originalQuery;
    });

    test('should handle malformed requests', async () => {
      // Invalid JSON
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle rate limiting scenarios', async () => {
      // Simulate multiple rapid requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong-password'
          })
      );

      const responses = await Promise.all(promises);

      // All should return 401 (not rate limited in this test, but structure is ready)
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    test('should handle concurrent operations safely', async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'concurrent@example.com',
          password: 'Password123!',
          fullName: 'Concurrent User'
        })
        .expect(201);

      // Simulate concurrent keyword creation
      const keywordPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/keywords')
          .set('Authorization', 'Bearer valid-test-token')
          .send({
            keyword: `concurrent keyword ${i}`,
            search_volume: 1000 + i,
            competition_level: 'medium'
          })
      );

      const responses = await Promise.all(keywordPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all keywords were created
      const listResponse = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .query({ keyword: 'concurrent keyword' })
        .expect(200);

      expect(listResponse.body.data.data).toHaveLength(5);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle reasonable load efficiently', async () => {
      const startTime = Date.now();

      // Simulate 50 concurrent requests
      const promises = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/auth/health')
          .expect(200)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should handle large payload efficiently', async () => {
      // Create large keyword analysis request
      const largeKeywordList = Array.from({ length: 100 }, (_, i) => `large test keyword ${i}`);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/keywords/analyze')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          keywords: largeKeywordList,
          location: 'global'
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.total_analyzed).toBe(100);
      // Should complete within 30 seconds for 100 keywords
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Integration Points', () => {
    test('should maintain consistency across service boundaries', async () => {
      // Register user through auth service
      const userData = {
        email: 'integration@example.com',
        password: 'IntegrationPassword123!',
        fullName: 'Integration Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const organizationId = registerResponse.body.data.organizationId;

      // Create keyword through keywords service
      const keywordResponse = await request(app)
        .post('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          keyword: 'integration test keyword',
          search_volume: 2000
        })
        .expect(201);

      // Verify data consistency
      expect(keywordResponse.body.data.tenant_id).toBe(organizationId);

      // Verify through profile endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);

      expect(profileResponse.body.data.organization.id).toBe(organizationId);
    });

    test('should handle cross-service failures gracefully', async () => {
      // Mock keywords service failure
      const originalGetKeywords = keywordsService.getKeywords;
      keywordsService.getKeywords = jest.fn().mockRejectedValue(new Error('Keywords service unavailable'));

      const response = await request(app)
        .get('/api/keywords')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Keywords service unavailable'
      });

      // Restore service
      keywordsService.getKeywords = originalGetKeywords;
    });
  });
});