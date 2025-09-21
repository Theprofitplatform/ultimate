#!/usr/bin/env node

/**
 * Database Migration Runner for Ultimate SEO Platform
 * Handles schema migrations and data seeding
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

class MigrationRunner {
  constructor(environment = process.env.NODE_ENV || 'development') {
    this.environment = environment;
    this.config = config.getConfig(environment);
    this.pool = null;
  }

  /**
   * Initialize database connection pool
   */
  async connect() {
    if (this.pool) return;

    this.pool = new Pool({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.name,
      user: this.config.database.user,
      password: this.config.database.password,
      ssl: this.config.database.ssl,
      ...this.config.database.pool
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      console.log(`✅ Connected to database: ${this.config.database.name}`);
    } catch (error) {
      throw new Error(`❌ Database connection failed: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔌 Database connection closed');
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          execution_time_ms INTEGER,
          checksum VARCHAR(64)
        )
      `);
      console.log('📋 Schema migrations table ready');
    } finally {
      client.release();
    }
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT migration_name FROM schema_migrations ORDER BY id'
      );
      return result.rows.map(row => row.migration_name);
    } finally {
      client.release();
    }
  }

  /**
   * Calculate file checksum
   */
  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(migrationFile) {
    const content = fs.readFileSync(migrationFile.path, 'utf8');
    const checksum = this.calculateChecksum(content);
    const startTime = Date.now();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Execute migration
      await client.query(content);

      // Record migration
      await client.query(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, checksum)
         VALUES ($1, $2, $3)`,
        [migrationFile.name, Date.now() - startTime, checksum]
      );

      await client.query('COMMIT');
      console.log(`✅ Executed migration: ${migrationFile.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`❌ Migration failed (${migrationFile.name}): ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Run pending migrations
   */
  async migrate() {
    console.log('🚀 Starting database migration...');

    await this.connect();
    await this.createMigrationsTable();

    const migrationFiles = config.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file.name)
    );

    if (pendingMigrations.length === 0) {
      console.log('✨ No pending migrations');
      return;
    }

    console.log(`📦 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('🎉 Migration completed successfully');
  }

  /**
   * Rollback last migration
   */
  async rollback() {
    console.log('⏪ Rolling back last migration...');

    await this.connect();

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT migration_name FROM schema_migrations ORDER BY id DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        console.log('ℹ️ No migrations to rollback');
        return;
      }

      const lastMigration = result.rows[0].migration_name;
      console.log(`⚠️ Rollback not implemented for: ${lastMigration}`);
      console.log('💡 Consider creating a down migration or restoring from backup');
    } finally {
      client.release();
    }
  }

  /**
   * Execute seed files
   */
  async seed() {
    console.log('🌱 Starting database seeding...');

    await this.connect();

    const seedFiles = config.getSeedFiles();

    if (seedFiles.length === 0) {
      console.log('ℹ️ No seed files found');
      return;
    }

    console.log(`📦 Found ${seedFiles.length} seed files`);

    for (const seedFile of seedFiles) {
      await this.executeSeedFile(seedFile);
    }

    console.log('🎉 Seeding completed successfully');
  }

  /**
   * Execute a single seed file
   */
  async executeSeedFile(seedFile) {
    const content = fs.readFileSync(seedFile.path, 'utf8');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(content);
      await client.query('COMMIT');
      console.log(`✅ Executed seed: ${seedFile.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.warn(`⚠️ Seed failed (${seedFile.name}): ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   */
  async reset() {
    console.log('🔄 Resetting database...');

    await this.connect();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Drop all tables and functions
      await client.query(`
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
      `);

      await client.query('COMMIT');
      console.log('🗑️ Database reset completed');

      // Re-run migrations
      await this.migrate();
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`❌ Database reset failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Show migration status
   */
  async status() {
    console.log('📊 Migration Status\n');

    await this.connect();

    const migrationFiles = config.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    if (migrationFiles.length === 0) {
      console.log('ℹ️ No migration files found');
      return;
    }

    console.log('Migration Files:');
    migrationFiles.forEach(file => {
      const isExecuted = executedMigrations.includes(file.name);
      const status = isExecuted ? '✅' : '⏳';
      console.log(`  ${status} ${file.name}`);
    });

    const pendingCount = migrationFiles.length - executedMigrations.length;
    console.log(`\n📊 Total: ${migrationFiles.length}, Executed: ${executedMigrations.length}, Pending: ${pendingCount}`);
  }

  /**
   * Test database connection
   */
  async test() {
    console.log('🔍 Testing database connection...');

    try {
      await config.testConnection(this.environment);
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error(`❌ Database connection failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';
  const environment = process.env.NODE_ENV || 'development';

  const runner = new MigrationRunner(environment);

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await runner.migrate();
        break;

      case 'rollback':
      case 'down':
        await runner.rollback();
        break;

      case 'seed':
        await runner.seed();
        break;

      case 'reset':
        await runner.reset();
        break;

      case 'status':
        await runner.status();
        break;

      case 'test':
        await runner.test();
        break;

      case 'setup':
        await runner.migrate();
        await runner.seed();
        break;

      default:
        console.log(`
🛠️  Ultimate SEO Platform Database Migration Tool

Usage: node migrate.js [command]

Commands:
  migrate, up     Run pending migrations
  rollback, down  Rollback last migration (not implemented)
  seed           Run seed files
  reset          Reset database and re-run migrations
  status         Show migration status
  test           Test database connection
  setup          Run migrations and seeds

Environment: ${environment}
Database: ${runner.config.database.name}
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner;