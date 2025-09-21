/**
 * Database Configuration for Ultimate SEO Platform
 * Multi-tenant PostgreSQL setup with migration support
 */

const fs = require('fs');
const path = require('path');

// Default configuration
const defaultConfig = {
  // Database connection settings
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'ultimate_seo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
    }
  },

  // Migration settings
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    tableName: 'schema_migrations',
    schemaName: 'public'
  },

  // Seed settings
  seeds: {
    directory: path.join(__dirname, 'seeds')
  },

  // Environment-specific overrides
  development: {
    database: {
      name: process.env.DB_NAME || 'ultimate_seo_dev',
      logging: true,
      debug: true
    }
  },

  test: {
    database: {
      name: process.env.DB_NAME || 'ultimate_seo_test',
      logging: false,
      debug: false
    }
  },

  production: {
    database: {
      ssl: { rejectUnauthorized: false },
      logging: false,
      debug: false,
      pool: {
        min: 5,
        max: 50,
        idle: 20000,
        acquire: 120000,
      }
    }
  }
};

/**
 * Get configuration for current environment
 */
function getConfig(environment = process.env.NODE_ENV || 'development') {
  const baseConfig = { ...defaultConfig };
  const envConfig = defaultConfig[environment] || {};

  // Deep merge environment-specific config
  return {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      ...envConfig.database
    },
    migrations: {
      ...baseConfig.migrations,
      ...envConfig.migrations
    },
    seeds: {
      ...baseConfig.seeds,
      ...envConfig.seeds
    }
  };
}

/**
 * Get database connection string
 */
function getConnectionString(environment = process.env.NODE_ENV || 'development') {
  const config = getConfig(environment);
  const { host, port, name, user, password } = config.database;

  let connectionString = `postgresql://${user}`;
  if (password) {
    connectionString += `:${password}`;
  }
  connectionString += `@${host}:${port}/${name}`;

  if (config.database.ssl) {
    connectionString += '?sslmode=require';
  }

  return connectionString;
}

/**
 * Get Knex.js configuration
 */
function getKnexConfig(environment = process.env.NODE_ENV || 'development') {
  const config = getConfig(environment);

  return {
    client: 'postgresql',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl
    },
    pool: config.database.pool,
    migrations: {
      directory: config.migrations.directory,
      tableName: config.migrations.tableName,
      schemaName: config.migrations.schemaName
    },
    seeds: {
      directory: config.seeds.directory
    },
    debug: config.database.debug || false
  };
}

/**
 * Validate database configuration
 */
function validateConfig(config) {
  const required = ['host', 'port', 'name', 'user'];
  const missing = required.filter(key => !config.database[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * Test database connection
 */
async function testConnection(environment = process.env.NODE_ENV || 'development') {
  const { Pool } = require('pg');
  const config = getConfig(environment);

  validateConfig(config);

  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    await pool.end();
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Setup tenant context for RLS
 */
async function setTenantContext(client, tenantId, userId = null) {
  try {
    await client.query('SELECT set_tenant_context($1)', [tenantId]);
    if (userId) {
      await client.query('SELECT set_user_context($1)', [userId]);
    }
    return true;
  } catch (error) {
    throw new Error(`Failed to set tenant context: ${error.message}`);
  }
}

/**
 * Clear tenant context
 */
async function clearTenantContext(client) {
  try {
    await client.query('RESET app.current_tenant_id');
    await client.query('RESET app.current_user_id');
    return true;
  } catch (error) {
    throw new Error(`Failed to clear tenant context: ${error.message}`);
  }
}

/**
 * Get migration files in order
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: path.join(migrationsDir, file)
    }));
}

/**
 * Get seed files in order
 */
function getSeedFiles() {
  const seedsDir = path.join(__dirname, 'seeds');

  if (!fs.existsSync(seedsDir)) {
    return [];
  }

  return fs.readdirSync(seedsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: path.join(seedsDir, file)
    }));
}

module.exports = {
  getConfig,
  getConnectionString,
  getKnexConfig,
  validateConfig,
  testConnection,
  setTenantContext,
  clearTenantContext,
  getMigrationFiles,
  getSeedFiles,

  // Environment configurations
  development: getConfig('development'),
  test: getConfig('test'),
  production: getConfig('production')
};