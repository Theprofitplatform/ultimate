# Ultimate SEO Platform Database

This directory contains the complete database schema, migrations, and seed data for the Ultimate SEO Platform - a multi-tenant SaaS application built with PostgreSQL.

## 🏗️ Architecture Overview

### Multi-Tenant Design
- **Row-Level Security (RLS)**: Ensures complete tenant isolation at the database level
- **Tenant Context**: Uses PostgreSQL session variables for tenant identification
- **Soft Deletes**: All user data supports soft deletion with `deleted_at` timestamps
- **Audit Logging**: Comprehensive audit trail for all data changes

### Key Features
- UUID primary keys for better security and scalability
- JSONB columns for flexible settings and metadata
- Comprehensive indexing for optimal performance
- Automatic timestamp management with triggers
- Utility functions for common operations

## 📁 Directory Structure

```
database/
├── schema.sql              # Complete database schema
├── config.js              # Database configuration and utilities
├── migrate.js             # Migration runner and CLI tool
├── migrations/            # Schema migration files
│   ├── 001_initial_schema.sql
│   ├── 002_seo_tables.sql
│   ├── 003_reports_integrations.sql
│   ├── 004_audit_security.sql
│   └── 005_views_functions.sql
├── seeds/                 # Demo data for testing
│   ├── 001_demo_tenant.sql
│   ├── 002_demo_keywords.sql
│   └── 003_demo_competitors.sql
└── README.md             # This file
```

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the project root:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ultimate_seo
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# Pool Configuration
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE=10000
DB_POOL_ACQUIRE=60000

# Environment
NODE_ENV=development
```

### 2. Database Setup

```bash
# Test database connection
node database/migrate.js test

# Run all migrations
node database/migrate.js migrate

# Load demo data
node database/migrate.js seed

# Or do both at once
node database/migrate.js setup
```

### 3. Migration Commands

```bash
# Check migration status
node database/migrate.js status

# Reset database (caution: destructive)
node database/migrate.js reset

# Show help
node database/migrate.js help
```

## 🗃️ Database Schema

### Core Tables

#### `tenants`
Root table for multi-tenant architecture. Each tenant represents a customer organization.

```sql
-- Key columns
id              uuid PRIMARY KEY
name            varchar(255)
slug            varchar(100) UNIQUE
subscription_plan varchar(50)
limits          jsonb
```

#### `users`
User accounts with tenant isolation and role-based permissions.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
email           varchar(255)
role            varchar(50)
permissions     jsonb
```

#### `websites`
Websites being tracked for SEO performance.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
name            varchar(255)
domain          varchar(255)
settings        jsonb
```

#### `keywords`
Keywords being monitored for ranking performance.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
website_id      uuid REFERENCES websites(id)
keyword         varchar(255)
search_volume   integer
difficulty_score integer
```

#### `keyword_rankings`
Historical keyword position data with search engine and device breakdown.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
keyword_id      uuid REFERENCES keywords(id)
position        integer
search_engine   varchar(50)
device          varchar(20)
recorded_at     timestamp with time zone
```

### Security & Audit Tables

#### `audit_logs`
Comprehensive audit trail for all data changes.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid
table_name      varchar(100)
operation       varchar(10)
old_values      jsonb
new_values      jsonb
user_id         uuid
```

### Integration Tables

#### `integrations`
Third-party service integrations (Google Analytics, Search Console, etc.).

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
name            varchar(100)
type            varchar(50)
provider        varchar(100)
credentials     jsonb (encrypted)
```

#### `api_keys`
API access keys for programmatic access.

```sql
-- Key columns
id              uuid PRIMARY KEY
tenant_id       uuid REFERENCES tenants(id)
key_hash        varchar(255) UNIQUE
permissions     jsonb
rate_limit      integer
```

## 🔒 Security Features

### Row-Level Security (RLS)
All tenant-specific tables have RLS policies that automatically filter data based on the current tenant context:

```sql
-- Set tenant context before queries
SELECT set_tenant_context('tenant-uuid-here');

-- All subsequent queries will be automatically filtered
SELECT * FROM keywords; -- Only returns current tenant's keywords
```

### Tenant Isolation
- Every tenant-specific table includes a `tenant_id` column
- RLS policies ensure complete data isolation
- Session variables track current tenant and user context

### Audit Logging
- Automatic logging of all INSERT, UPDATE, DELETE operations
- Captures both old and new values for changes
- Tracks user and IP address for each change

### Soft Deletes
- User data is never hard-deleted from the database
- `deleted_at` timestamp marks records as deleted
- Utility functions provided for soft delete operations

## 📊 Performance Optimization

### Indexing Strategy
- Tenant ID indexes on all multi-tenant tables
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., active records only)
- GIN indexes for JSONB columns and full-text search

### Key Indexes
```sql
-- Tenant isolation
CREATE INDEX idx_keywords_tenant_id ON keywords(tenant_id);

-- Query optimization
CREATE INDEX idx_keyword_rankings_recorded_at ON keyword_rankings(recorded_at);

-- Full-text search
CREATE INDEX idx_keywords_keyword_trgm ON keywords USING gin(keyword gin_trgm_ops);

-- Filtered indexes
CREATE INDEX idx_keywords_tracked ON keywords(is_tracked) WHERE is_tracked = true;
```

## 🛠️ Utility Functions

### Context Management
```sql
-- Set tenant context for RLS
SELECT set_tenant_context('tenant-uuid');

-- Set user context for audit logging
SELECT set_user_context('user-uuid');
```

### Tenant Operations
```sql
-- Get tenant limits
SELECT get_tenant_limits('tenant-uuid');

-- Check tenant usage
SELECT check_tenant_usage('tenant-uuid');
```

### Soft Delete Operations
```sql
-- Soft delete a record
SELECT soft_delete_record('keywords', 'keyword-uuid');

-- Restore a soft deleted record
SELECT restore_record('keywords', 'keyword-uuid');
```

## 📈 Views

### `current_keyword_rankings`
Latest ranking data for all keywords with website information.

### `keyword_performance_summary`
Aggregated performance metrics for keywords including average, best, and worst positions.

## 🔧 Configuration

### Database Config (`config.js`)
- Environment-specific settings
- Connection pooling configuration
- Migration and seed file management
- Utility functions for database operations

### Migration Runner (`migrate.js`)
- CLI tool for database management
- Schema migration execution
- Seed data loading
- Database reset functionality

## 🧪 Demo Data

The seed files create a complete demo environment:

### Demo Tenant: "Demo SEO Agency"
- **Users**: Admin, Manager, Analyst with different roles
- **Websites**: Fashion store, Tech blog, Local restaurant
- **Keywords**: 10+ keywords with historical ranking data
- **Competitors**: Competitor websites with ranking data
- **Integrations**: Google Search Console, Analytics, SEMrush, Ahrefs
- **Reports**: Sample reports in various states

### Login Credentials (Demo)
- **Admin**: admin@demoseo.com / admin123
- **Manager**: manager@demoseo.com / manager123
- **Analyst**: analyst@demoseo.com / analyst123

*Note: Passwords are hashed with bcrypt in the database*

## 🚨 Production Considerations

### Security
- Always use SSL connections in production
- Rotate API keys and database passwords regularly
- Monitor audit logs for suspicious activity
- Implement IP whitelisting for administrative access

### Performance
- Configure connection pooling based on expected load
- Monitor slow queries and add indexes as needed
- Consider read replicas for reporting workloads
- Implement query result caching where appropriate

### Backup & Recovery
- Set up automated database backups
- Test backup restoration procedures
- Consider point-in-time recovery requirements
- Document disaster recovery procedures

### Monitoring
- Monitor connection pool usage
- Track query performance metrics
- Set up alerts for database errors
- Monitor tenant usage against limits

## 📚 Additional Resources

- [PostgreSQL Row Level Security Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-Tenant Database Patterns](https://docs.microsoft.com/en-us/azure/sql-database/saas-tenancy-app-design-patterns)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## 🤝 Contributing

When adding new features:

1. Create migration files for schema changes
2. Update this README with new table documentation
3. Add appropriate indexes for new columns
4. Include RLS policies for tenant-specific tables
5. Add seed data for testing new features
6. Update utility functions if needed

## 📝 License

This database schema is part of the Ultimate SEO Platform project.