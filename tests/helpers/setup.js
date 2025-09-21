/**
 * Jest Setup File
 * Global test configuration and utilities
 */

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Extend Jest matchers
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toHaveValidDatabaseId(received) {
    const pass = received && (typeof received === 'string' || typeof received === 'number') && received.toString().length > 0;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid database ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid database ID`,
        pass: false,
      };
    }
  },

  toBeRecentTimestamp(received, withinSeconds = 60) {
    const receivedTime = new Date(received);
    const now = new Date();
    const diffSeconds = Math.abs((now - receivedTime) / 1000);
    const pass = diffSeconds <= withinSeconds;

    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${withinSeconds} seconds of now`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${withinSeconds} seconds of now (was ${diffSeconds}s ago)`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random test data
  generateRandomString: (length = 10) => {
    return Math.random().toString(36).substring(2, length + 2);
  },

  generateRandomEmail: () => {
    return `test.${Math.random().toString(36).substring(7)}@example.com`;
  },

  generateRandomPassword: () => {
    return `TestPass${Math.random().toString(36).substring(2)}!`;
  },

  // Cleanup helpers
  cleanupTestData: async (pool, tablePatterns = ['test_*']) => {
    if (!pool) return;

    try {
      for (const pattern of tablePatterns) {
        const result = await pool.query(`
          SELECT tablename FROM pg_tables
          WHERE tablename LIKE $1 AND schemaname = 'public'
        `, [pattern]);

        for (const row of result.rows) {
          await pool.query(`TRUNCATE TABLE ${row.tablename} RESTART IDENTITY CASCADE`);
        }
      }
    } catch (error) {
      console.warn('Test cleanup error:', error.message);
    }
  }
};

// Console setup for tests
const originalConsole = { ...console };

// Suppress console output in tests unless DEBUG is set
if (!process.env.DEBUG) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Restore console for debugging when needed
global.enableTestConsole = () => {
  Object.assign(console, originalConsole);
};

// Mock external services by default
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});