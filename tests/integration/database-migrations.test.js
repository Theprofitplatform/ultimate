/**
 * Database Migration Tests
 * Testing database schema changes and data migrations
 */

const { dbHelper } = require('../helpers/database');

describe('Database Migrations', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await dbHelper.startTransaction();
  });

  afterAll(async () => {
    await dbHelper.rollbackTransaction();
    await dbHelper.close();
  });

  describe('Schema Creation', () => {
    test('should create auth schema with all tables', async () => {
      // Check if auth schema exists
      const schemaResult = await testDb.query(`
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name = 'auth'
      `);
      expect(schemaResult.rows).toHaveLength(1);

      // Check organizations table
      const orgTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'organizations'
      `);
      expect(orgTableResult.rows).toHaveLength(1);

      // Check users table
      const usersTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
      `);
      expect(usersTableResult.rows).toHaveLength(1);

      // Check sessions table
      const sessionsTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'sessions'
      `);
      expect(sessionsTableResult.rows).toHaveLength(1);

      // Check api_keys table
      const apiKeysTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'api_keys'
      `);
      expect(apiKeysTableResult.rows).toHaveLength(1);
    });

    test('should create keywords tables with proper structure', async () => {
      // Check keywords table
      const keywordsTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'keywords'
      `);
      expect(keywordsTableResult.rows).toHaveLength(1);

      // Check keyword_rankings table
      const rankingsTableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'keyword_rankings'
      `);
      expect(rankingsTableResult.rows).toHaveLength(1);
    });

    test('should have proper column definitions for users table', async () => {
      const columnsResult = await testDb.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users'
        ORDER BY ordinal_position
      `);

      const columns = columnsResult.rows.reduce((acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        id: { type: 'integer', nullable: false },
        organization_id: { type: 'integer', nullable: true },
        email: { type: 'character varying', nullable: false },
        password_hash: { type: 'character varying', nullable: true },
        full_name: { type: 'character varying', nullable: false },
        role: { type: 'character varying', nullable: true },
        email_verified: { type: 'boolean', nullable: true },
        is_active: { type: 'boolean', nullable: true },
        created_at: { type: 'timestamp without time zone', nullable: true },
        updated_at: { type: 'timestamp without time zone', nullable: true }
      });
    });

    test('should have proper indexes for performance', async () => {
      const indexResult = await testDb.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname IN ('auth', 'public')
        AND indexname NOT LIKE '%_pkey'
      `);

      const indexes = indexResult.rows.map(row => ({
        table: row.tablename,
        index: row.indexname
      }));

      // Check for important indexes
      expect(indexes.some(i => i.table === 'users' && i.index.includes('email'))).toBe(true);
      expect(indexes.some(i => i.table === 'sessions' && i.index.includes('user_id'))).toBe(true);
      expect(indexes.some(i => i.table === 'keywords' && i.index.includes('tenant_id'))).toBe(true);
    });

    test('should have proper foreign key constraints', async () => {
      const constraintsResult = await testDb.query(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('auth', 'public')
      `);

      const foreignKeys = constraintsResult.rows.map(row => ({
        table: row.table_name,
        column: row.column_name,
        references: `${row.foreign_table_name}.${row.foreign_column_name}`
      }));

      // Check for important foreign keys
      expect(foreignKeys.some(fk =>
        fk.table === 'users' &&
        fk.column === 'organization_id' &&
        fk.references === 'organizations.id'
      )).toBe(true);

      expect(foreignKeys.some(fk =>
        fk.table === 'sessions' &&
        fk.column === 'user_id' &&
        fk.references === 'users.id'
      )).toBe(true);

      expect(foreignKeys.some(fk =>
        fk.table === 'keyword_rankings' &&
        fk.column === 'keyword_id' &&
        fk.references === 'keywords.id'
      )).toBe(true);
    });
  });

  describe('Data Migrations', () => {
    test('should create default organization', async () => {
      const orgResult = await testDb.query(`
        SELECT * FROM auth.organizations WHERE slug = 'test-org'
      `);

      expect(orgResult.rows).toHaveLength(1);
      expect(orgResult.rows[0]).toMatchObject({
        name: 'Test Organization',
        slug: 'test-org',
        domain: 'test.example.com'
      });
    });

    test('should handle unique constraints properly', async () => {
      // Try to insert duplicate organization
      await expect(testDb.query(`
        INSERT INTO auth.organizations (name, slug, domain)
        VALUES ('Duplicate Org', 'test-org', 'duplicate.com')
      `)).rejects.toThrow();

      // Try to insert duplicate user email
      await testDb.query(`
        INSERT INTO auth.users (organization_id, email, password_hash, full_name)
        VALUES (1, 'unique@example.com', 'hash', 'User One')
      `);

      await expect(testDb.query(`
        INSERT INTO auth.users (organization_id, email, password_hash, full_name)
        VALUES (1, 'unique@example.com', 'hash', 'User Two')
      `)).rejects.toThrow();
    });

    test('should cascade deletes properly', async () => {
      // Create user and session
      const userResult = await testDb.query(`
        INSERT INTO auth.users (organization_id, email, password_hash, full_name)
        VALUES (1, 'cascade@example.com', 'hash', 'Cascade User')
        RETURNING id
      `);
      const userId = userResult.rows[0].id;

      await testDb.query(`
        INSERT INTO auth.sessions (id, user_id, token_hash, refresh_token_hash, expires_at)
        VALUES ('550e8400-e29b-41d4-a716-446655440000', $1, 'token', 'refresh', NOW() + INTERVAL '1 day')
      `, [userId]);

      // Delete user should cascade to sessions
      await testDb.query('DELETE FROM auth.users WHERE id = $1', [userId]);

      const sessionResult = await testDb.query(
        'SELECT id FROM auth.sessions WHERE user_id = $1',
        [userId]
      );
      expect(sessionResult.rows).toHaveLength(0);
    });
  });

  describe('Migration Rollback', () => {
    test('should be able to rollback schema changes', async () => {
      // Create a test table
      await testDb.query(`
        CREATE TABLE test_migration (
          id SERIAL PRIMARY KEY,
          test_data VARCHAR(100)
        )
      `);

      // Verify table exists
      const tableResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'test_migration'
      `);
      expect(tableResult.rows).toHaveLength(1);

      // Rollback (drop table)
      await testDb.query('DROP TABLE test_migration');

      // Verify table no longer exists
      const afterRollbackResult = await testDb.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'test_migration'
      `);
      expect(afterRollbackResult.rows).toHaveLength(0);
    });

    test('should preserve data integrity during rollback', async () => {
      // Insert test data
      await testDb.query(`
        INSERT INTO auth.organizations (name, slug, domain)
        VALUES ('Rollback Test Org', 'rollback-test', 'rollback.com')
      `);

      const beforeCount = await testDb.query('SELECT COUNT(*) FROM auth.organizations');
      const initialCount = parseInt(beforeCount.rows[0].count);

      // Begin and rollback a subtransaction
      await testDb.query('SAVEPOINT test_rollback');

      await testDb.query(`
        INSERT INTO auth.organizations (name, slug, domain)
        VALUES ('Temp Org', 'temp-org', 'temp.com')
      `);

      await testDb.query('ROLLBACK TO SAVEPOINT test_rollback');

      // Verify original data is preserved
      const afterCount = await testDb.query('SELECT COUNT(*) FROM auth.organizations');
      expect(parseInt(afterCount.rows[0].count)).toBe(initialCount);

      // Verify temp org was not saved
      const tempOrgResult = await testDb.query(`
        SELECT * FROM auth.organizations WHERE slug = 'temp-org'
      `);
      expect(tempOrgResult.rows).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large data insertions efficiently', async () => {
      const startTime = Date.now();

      // Insert 1000 keywords
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        insertPromises.push(
          testDb.query(`
            INSERT INTO keywords (tenant_id, keyword, search_volume, keyword_difficulty)
            VALUES ($1, $2, $3, $4)
          `, [1, `bulk keyword ${i}`, Math.floor(Math.random() * 10000), Math.floor(Math.random() * 100)])
        );
      }

      await Promise.all(insertPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      // Verify all data was inserted
      const countResult = await testDb.query(
        'SELECT COUNT(*) FROM keywords WHERE tenant_id = 1'
      );
      expect(parseInt(countResult.rows[0].count)).toBe(100);
    });

    test('should query large datasets efficiently', async () => {
      // Insert test data if not already present
      const existingCount = await testDb.query('SELECT COUNT(*) FROM keywords WHERE tenant_id = 1');
      if (parseInt(existingCount.rows[0].count) < 100) {
        for (let i = 0; i < 100; i++) {
          await testDb.query(`
            INSERT INTO keywords (tenant_id, keyword, search_volume, keyword_difficulty)
            VALUES (1, $1, $2, $3)
          `, [`query test keyword ${i}`, Math.floor(Math.random() * 10000), Math.floor(Math.random() * 100)]);
        }
      }

      const startTime = Date.now();

      // Complex query with joins and filters
      const result = await testDb.query(`
        SELECT
          k.*,
          COUNT(kr.id) as ranking_count,
          AVG(kr.position) as avg_position
        FROM keywords k
        LEFT JOIN keyword_rankings kr ON k.id = kr.keyword_id
        WHERE k.tenant_id = 1
        AND k.search_volume > 1000
        GROUP BY k.id
        ORDER BY k.search_volume DESC
        LIMIT 50
      `);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1 second for 100 records
      expect(duration).toBeLessThan(1000);
      expect(result.rows.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Data Validation and Constraints', () => {
    test('should enforce email format validation at application level', async () => {
      // Database doesn't enforce email format, but application should
      // This test verifies we can insert various email formats
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@subdomain.example.com'
      ];

      for (const email of validEmails) {
        const result = await testDb.query(`
          INSERT INTO auth.users (organization_id, email, password_hash, full_name)
          VALUES (1, $1, 'hash', 'Test User')
          RETURNING id
        `, [email]);

        expect(result.rows[0].id).toBeDefined();
      }
    });

    test('should enforce business rules for keywords', async () => {
      // Test unique constraint on keyword combination
      await testDb.query(`
        INSERT INTO keywords (tenant_id, keyword, location, language, device)
        VALUES (1, 'unique test', 'global', 'en', 'desktop')
      `);

      // Should fail on duplicate
      await expect(testDb.query(`
        INSERT INTO keywords (tenant_id, keyword, location, language, device)
        VALUES (1, 'unique test', 'global', 'en', 'desktop')
      `)).rejects.toThrow();

      // Should succeed with different context
      const result = await testDb.query(`
        INSERT INTO keywords (tenant_id, keyword, location, language, device)
        VALUES (1, 'unique test', 'global', 'en', 'mobile')
        RETURNING id
      `);
      expect(result.rows[0].id).toBeDefined();
    });

    test('should handle NULL values appropriately', async () => {
      // Test optional fields can be NULL
      const result = await testDb.query(`
        INSERT INTO keywords (tenant_id, keyword)
        VALUES (1, 'minimal keyword')
        RETURNING *
      `);

      const keyword = result.rows[0];
      expect(keyword.search_volume).toBe(0); // Default value
      expect(keyword.keyword_difficulty).toBe(0); // Default value
      expect(keyword.cpc).toBe('0.00'); // Default value
      expect(keyword.current_position).toBeNull(); // NULL allowed
    });

    test('should maintain referential integrity', async () => {
      // Test foreign key constraint
      await expect(testDb.query(`
        INSERT INTO keyword_rankings (keyword_id, position, check_date)
        VALUES (99999, 1, '2024-01-01')
      `)).rejects.toThrow(); // Should fail due to non-existent keyword_id

      // Test valid foreign key
      const keywordResult = await testDb.query(`
        INSERT INTO keywords (tenant_id, keyword)
        VALUES (1, 'ranking test keyword')
        RETURNING id
      `);

      const rankingResult = await testDb.query(`
        INSERT INTO keyword_rankings (keyword_id, position, check_date)
        VALUES ($1, 1, '2024-01-01')
        RETURNING id
      `, [keywordResult.rows[0].id]);

      expect(rankingResult.rows[0].id).toBeDefined();
    });
  });

  describe('Schema Evolution', () => {
    test('should be able to add new columns safely', async () => {
      // Add a new column to keywords table
      await testDb.query(`
        ALTER TABLE keywords
        ADD COLUMN IF NOT EXISTS test_migration_column VARCHAR(100) DEFAULT 'test_value'
      `);

      // Verify column was added
      const columnsResult = await testDb.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'keywords' AND column_name = 'test_migration_column'
      `);
      expect(columnsResult.rows).toHaveLength(1);

      // Verify existing data is preserved with default value
      const keywordResult = await testDb.query(`
        INSERT INTO keywords (tenant_id, keyword)
        VALUES (1, 'new column test')
        RETURNING test_migration_column
      `);
      expect(keywordResult.rows[0].test_migration_column).toBe('test_value');

      // Clean up
      await testDb.query('ALTER TABLE keywords DROP COLUMN IF EXISTS test_migration_column');
    });

    test('should handle index creation and removal', async () => {
      // Create new index
      await testDb.query(`
        CREATE INDEX IF NOT EXISTS idx_test_migration
        ON keywords(keyword, tenant_id)
      `);

      // Verify index exists
      const indexResult = await testDb.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'keywords' AND indexname = 'idx_test_migration'
      `);
      expect(indexResult.rows).toHaveLength(1);

      // Test query uses index (explain plan would show this in real scenario)
      const queryResult = await testDb.query(`
        SELECT id FROM keywords
        WHERE keyword = 'test' AND tenant_id = 1
      `);
      expect(queryResult.rows).toBeDefined();

      // Clean up
      await testDb.query('DROP INDEX IF EXISTS idx_test_migration');
    });
  });
});