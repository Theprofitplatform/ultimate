/**
 * User Test Fixtures
 * Mock data for user-related tests
 */

const bcrypt = require('bcrypt');

// Generate hashed password for testing
const generatePasswordHash = async (password = 'TestPassword123!') => {
  return await bcrypt.hash(password, 10);
};

const users = {
  // Valid user data
  validUser: {
    email: 'john.doe@example.com',
    password: 'SecurePassword123!',
    fullName: 'John Doe',
    role: 'admin'
  },

  // Another valid user
  validUser2: {
    email: 'jane.smith@example.com',
    password: 'AnotherSecure456!',
    fullName: 'Jane Smith',
    role: 'user'
  },

  // User with organization
  userWithOrg: {
    email: 'org.admin@company.com',
    password: 'OrgPassword789!',
    fullName: 'Organization Admin',
    role: 'admin',
    organization: {
      name: 'Test Company',
      domain: 'company.com',
      subscriptionTier: 'pro'
    }
  },

  // Invalid user data for testing validation
  invalidUser: {
    email: 'invalid-email',
    password: '123', // Too weak
    fullName: '', // Empty name
    role: 'invalid-role'
  },

  // User with missing fields
  incompleteUser: {
    email: 'incomplete@example.com'
    // Missing password and fullName
  },

  // User with special characters
  specialUser: {
    email: 'user+test@sub.domain.com',
    password: 'Special!@#$%^&*()123',
    fullName: 'User with "Special" Characters & Symbols',
    role: 'user'
  },

  // User for SQL injection testing
  sqlInjectionUser: {
    email: "'; DROP TABLE users; --@evil.com",
    password: "password'; DELETE FROM auth.sessions; --",
    fullName: "'; UPDATE users SET role='admin'; --",
    role: 'user'
  },

  // User with very long fields
  longFieldUser: {
    email: 'a'.repeat(250) + '@example.com',
    password: 'LongPassword' + 'x'.repeat(100) + '!',
    fullName: 'Very Long Name ' + 'x'.repeat(200),
    role: 'user'
  }
};

// Database user fixtures (with hashed passwords)
const dbUsers = {
  async adminUser() {
    return {
      id: 1,
      organization_id: 1,
      email: 'admin@example.com',
      password_hash: await generatePasswordHash('AdminPassword123!'),
      full_name: 'Admin User',
      role: 'admin',
      permissions: ['user:read', 'user:write', 'admin:all'],
      email_verified: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  },

  async regularUser() {
    return {
      id: 2,
      organization_id: 1,
      email: 'user@example.com',
      password_hash: await generatePasswordHash('UserPassword123!'),
      full_name: 'Regular User',
      role: 'user',
      permissions: ['keyword:read', 'keyword:write'],
      email_verified: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  },

  async unverifiedUser() {
    return {
      id: 3,
      organization_id: 1,
      email: 'unverified@example.com',
      password_hash: await generatePasswordHash('UnverifiedPassword123!'),
      full_name: 'Unverified User',
      role: 'user',
      permissions: [],
      email_verified: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  },

  async inactiveUser() {
    return {
      id: 4,
      organization_id: 1,
      email: 'inactive@example.com',
      password_hash: await generatePasswordHash('InactivePassword123!'),
      full_name: 'Inactive User',
      role: 'user',
      permissions: [],
      email_verified: true,
      is_active: false,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
};

// Organizations fixtures
const organizations = {
  testOrg: {
    id: 1,
    name: 'Test Organization',
    slug: 'test-org',
    domain: 'test.example.com',
    subscription_tier: 'trial',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },

  proOrg: {
    id: 2,
    name: 'Pro Organization',
    slug: 'pro-org',
    domain: 'pro.example.com',
    subscription_tier: 'pro',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },

  expiredOrg: {
    id: 3,
    name: 'Expired Organization',
    slug: 'expired-org',
    domain: 'expired.example.com',
    subscription_tier: 'pro',
    subscription_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
};

// Session fixtures
const sessions = {
  validSession: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 1,
    token_hash: 'valid-token-hash',
    refresh_token_hash: 'valid-refresh-hash',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 (Test Browser)',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    created_at: new Date()
  },

  expiredSession: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: 1,
    token_hash: 'expired-token-hash',
    refresh_token_hash: 'expired-refresh-hash',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 (Test Browser)',
    expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
  }
};

// JWT tokens for testing
const jwtTokens = {
  validAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJvcmdhbml6YXRpb25faWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNTE2MjM5MDIyfQ.test-signature',

  validRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTUxNjIzOTAyMn0.refresh-signature',

  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE1MTYyMzkwMjJ9.expired-signature',

  invalidToken: 'invalid.token.format',

  malformedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed-payload.signature'
};

// API key fixtures
const apiKeys = {
  validKey: {
    id: '550e8400-e29b-41d4-a716-446655440010',
    name: 'Test API Key',
    key: 'ak_test_1234567890abcdef',
    key_hash: 'hashed-api-key',
    user_id: 1,
    organization_id: 1,
    permissions: ['keyword:read', 'keyword:write'],
    is_active: true,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    created_at: new Date()
  },

  expiredKey: {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Expired API Key',
    key: 'ak_test_expired1234567890',
    key_hash: 'hashed-expired-api-key',
    user_id: 1,
    organization_id: 1,
    permissions: ['keyword:read'],
    is_active: true,
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
};

module.exports = {
  users,
  dbUsers,
  organizations,
  sessions,
  jwtTokens,
  apiKeys,
  generatePasswordHash
};