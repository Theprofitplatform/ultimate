/**
 * Database Test Helpers
 * Utilities for database testing with transaction rollback
 */

const { Pool } = require('pg');

class DatabaseTestHelper {
  constructor() {
    this.pool = null;
    this.client = null;
    this.inTransaction = false;
  }

  /**
   * Get or create database pool
   */
  getPool() {
    if (global.__IN_MEMORY_TEST__) {
      return global.__TEST_DB_POOL__;
    }

    if (!this.pool) {
      this.pool = global.__TEST_DB_POOL__ || new Pool({
        connectionString: process.env.TEST_DATABASE_URL ||
          'postgresql://postgres:password@localhost:5432/ultimate_test',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    return this.pool;
  }

  /**
   * Start a database transaction for test isolation
   */
  async startTransaction() {
    if (global.__IN_MEMORY_TEST__) {
      return global.__TEST_DB_POOL__;
    }

    if (this.inTransaction) {
      throw new Error('Transaction already started');
    }

    this.client = await this.getPool().connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;

    return this.client;
  }

  /**
   * Rollback transaction (automatically called after each test)
   */
  async rollbackTransaction() {
    if (global.__IN_MEMORY_TEST__) {
      // Reset in-memory data
      global.__TEST_DATA__ = {
        organizations: [],
        users: [],
        sessions: [],
        keywords: [],
        rankings: []
      };
      return;
    }

    if (!this.inTransaction || !this.client) {
      return;
    }

    try {
      await this.client.query('ROLLBACK');
      this.client.release();
    } catch (error) {
      console.warn('Error rolling back transaction:', error.message);
    } finally {
      this.client = null;
      this.inTransaction = false;
    }
  }

  /**
   * Execute query within transaction
   */
  async query(text, params = []) {
    if (global.__IN_MEMORY_TEST__) {
      return this.mockQuery(text, params);
    }

    const client = this.client || this.getPool();
    return client.query(text, params);
  }

  /**
   * Mock query for in-memory testing
   */
  mockQuery(text, params = []) {
    const sql = text.toLowerCase().trim();

    // Mock different SQL operations
    if (sql.startsWith('select')) {
      return { rows: [], rowCount: 0 };
    } else if (sql.startsWith('insert')) {
      return {
        rows: [{ id: Math.floor(Math.random() * 1000) + 1 }],
        rowCount: 1
      };
    } else if (sql.startsWith('update')) {
      return { rows: [], rowCount: 1 };
    } else if (sql.startsWith('delete')) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  /**
   * Create test organization
   */
  async createTestOrganization(data = {}) {
    const orgData = {
      name: data.name || 'Test Organization',
      slug: data.slug || `test-org-${Date.now()}`,
      domain: data.domain || 'test.example.com',
      subscription_tier: data.subscription_tier || 'trial',
      ...data
    };

    const result = await this.query(`
      INSERT INTO auth.organizations (name, slug, domain, subscription_tier)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [orgData.name, orgData.slug, orgData.domain, orgData.subscription_tier]);

    return result.rows[0];
  }

  /**
   * Create test user
   */
  async createTestUser(data = {}) {
    // Create organization if not provided
    let organizationId = data.organization_id;
    if (!organizationId) {
      const org = await this.createTestOrganization();
      organizationId = org.id;
    }

    const userData = {
      email: data.email || `test.${Date.now()}@example.com`,
      password_hash: data.password_hash || '$2b$10$testhashedpassword',
      full_name: data.full_name || 'Test User',
      role: data.role || 'user',
      permissions: data.permissions || [],
      email_verified: data.email_verified || false,
      ...data,
      organization_id: organizationId
    };

    const result = await this.query(`
      INSERT INTO auth.users
      (organization_id, email, password_hash, full_name, role, permissions, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userData.organization_id,
      userData.email,
      userData.password_hash,
      userData.full_name,
      userData.role,
      JSON.stringify(userData.permissions),
      userData.email_verified
    ]);

    return result.rows[0];
  }

  /**
   * Create test session
   */
  async createTestSession(userId, data = {}) {
    const sessionData = {
      id: data.id || require('uuid').v4(),
      user_id: userId,
      token_hash: data.token_hash || 'test-token-hash',
      refresh_token_hash: data.refresh_token_hash || 'test-refresh-hash',
      ip_address: data.ip_address || '127.0.0.1',
      user_agent: data.user_agent || 'Test User Agent',
      expires_at: data.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...data
    };

    const result = await this.query(`
      INSERT INTO auth.sessions
      (id, user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      sessionData.id,
      sessionData.user_id,
      sessionData.token_hash,
      sessionData.refresh_token_hash,
      sessionData.ip_address,
      sessionData.user_agent,
      sessionData.expires_at
    ]);

    return result.rows[0];
  }

  /**
   * Create test keyword
   */
  async createTestKeyword(tenantId, data = {}) {
    const keywordData = {
      tenant_id: tenantId,
      keyword: data.keyword || `test keyword ${Date.now()}`,
      search_volume: data.search_volume || Math.floor(Math.random() * 10000),
      keyword_difficulty: data.keyword_difficulty || Math.floor(Math.random() * 100),
      cpc: data.cpc || Math.round(Math.random() * 5 * 100) / 100,
      competition_level: data.competition_level || 'medium',
      location: data.location || 'global',
      language: data.language || 'en',
      device: data.device || 'desktop',
      ...data
    };

    const result = await this.query(`
      INSERT INTO keywords
      (tenant_id, keyword, search_volume, keyword_difficulty, cpc, competition_level, location, language, device)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      keywordData.tenant_id,
      keywordData.keyword,
      keywordData.search_volume,
      keywordData.keyword_difficulty,
      keywordData.cpc,
      keywordData.competition_level,
      keywordData.location,
      keywordData.language,
      keywordData.device
    ]);

    return result.rows[0];
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    if (global.__IN_MEMORY_TEST__) {
      global.__TEST_DATA__ = {
        organizations: [],
        users: [],
        sessions: [],
        keywords: [],
        rankings: []
      };
      return;
    }

    // This will be handled by transaction rollback
    await this.rollbackTransaction();
  }

  /**
   * Close database connections
   */
  async close() {
    await this.rollbackTransaction();

    if (this.pool && !global.__TEST_DB_POOL__) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Create singleton instance
const dbHelper = new DatabaseTestHelper();

module.exports = {
  DatabaseTestHelper,
  dbHelper
};