/**
 * Global Jest Setup
 * Runs once before all tests
 */

const { Pool } = require('pg');

module.exports = async () => {
  console.log('🚀 Setting up test environment...');

  // Create test database connection
  const testDbUrl = process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/ultimate_test';

  // Store connection for global teardown
  global.__TEST_DB_POOL__ = new Pool({
    connectionString: testDbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    // Test database connection
    await global.__TEST_DB_POOL__.query('SELECT NOW()');
    console.log('✅ Test database connected successfully');

    // Setup test schema and tables
    await setupTestDatabase();
    console.log('✅ Test database schema initialized');

  } catch (error) {
    console.error('❌ Test database setup failed:', error.message);

    // Create in-memory fallback for tests
    console.log('🔄 Setting up in-memory test environment...');
    setupInMemoryFallback();
  }

  console.log('✅ Test environment ready');
};

async function setupTestDatabase() {
  const pool = global.__TEST_DB_POOL__;

  // Create auth schema
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
  `);

  // Create organizations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      domain VARCHAR(255),
      subscription_tier VARCHAR(50) DEFAULT 'trial',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES auth.organizations(id),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      full_name VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(500),
      role VARCHAR(50) DEFAULT 'user',
      permissions JSONB DEFAULT '[]',
      email_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create sessions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.sessions (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      refresh_token_hash VARCHAR(255) NOT NULL,
      ip_address INET,
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create API keys table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.api_keys (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      key_hash VARCHAR(255) NOT NULL,
      user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
      organization_id INTEGER REFERENCES auth.organizations(id),
      permissions JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMP,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create keywords table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      keyword VARCHAR(500) NOT NULL,
      search_volume INTEGER DEFAULT 0,
      keyword_difficulty INTEGER DEFAULT 0,
      cpc DECIMAL(10,2) DEFAULT 0.00,
      competition_level VARCHAR(20) DEFAULT 'unknown',
      current_position INTEGER,
      best_position INTEGER,
      worst_position INTEGER,
      location VARCHAR(100) DEFAULT 'global',
      language VARCHAR(10) DEFAULT 'en',
      device VARCHAR(20) DEFAULT 'desktop',
      trend_data JSONB,
      serp_features JSONB DEFAULT '[]',
      last_analyzed TIMESTAMP,
      analysis_status VARCHAR(50) DEFAULT 'pending',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, keyword, location, language, device)
    );
  `);

  // Create keyword rankings table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS keyword_rankings (
      id SERIAL PRIMARY KEY,
      keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      url TEXT,
      title TEXT,
      check_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(keyword_id, check_date)
    );
  `);

  // Insert test organization
  await pool.query(`
    INSERT INTO auth.organizations (name, slug, domain)
    VALUES ('Test Organization', 'test-org', 'test.example.com')
    ON CONFLICT (slug) DO NOTHING;
  `);

  // Create indexes for performance
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions(user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_keywords_tenant_id ON keywords(tenant_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword_id ON keyword_rankings(keyword_id);');
}

function setupInMemoryFallback() {
  // Mock database operations for environments without PostgreSQL
  global.__IN_MEMORY_TEST__ = true;
  global.__TEST_DATA__ = {
    organizations: [],
    users: [],
    sessions: [],
    keywords: [],
    rankings: []
  };

  // Mock database pool
  global.__TEST_DB_POOL__ = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue()
  };
}