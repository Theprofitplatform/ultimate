/**
 * Jest Configuration for Ultimate SEO Platform
 * Comprehensive testing setup with coverage reporting
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage settings - 80%+ target
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher thresholds for critical components
    '**/auth/**/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '**/keywords.service.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'apps/**/*.js',
    'hive/**/*.js',
    'integrations/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/*.config.js',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/helpers/setup.js'
  ],

  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@auth/(.*)$': '<rootDir>/apps/api/auth/$1',
    '^@api/(.*)$': '<rootDir>/apps/api/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/helpers/global-setup.js',
  globalTeardown: '<rootDir>/tests/helpers/global-teardown.js',

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],

  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Detect open handles
  detectOpenHandles: true,
  forceExit: true,

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest'
};