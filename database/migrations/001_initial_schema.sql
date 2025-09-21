-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for Ultimate SEO Platform
-- Created: 2025-09-21
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Tenants table (root level - no tenant_id column)
CREATE TABLE tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(255) NOT NULL,
    slug varchar(100) UNIQUE NOT NULL,
    domain varchar(255),
    subscription_plan varchar(50) NOT NULL DEFAULT 'free',
    subscription_status varchar(20) NOT NULL DEFAULT 'active',
    billing_email varchar(255),
    settings jsonb DEFAULT '{}',
    limits jsonb DEFAULT '{"keywords": 100, "reports": 10, "users": 5}',
    is_active boolean DEFAULT true,
    trial_ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone
);

-- Users table
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    first_name varchar(100),
    last_name varchar(100),
    role varchar(50) NOT NULL DEFAULT 'user',
    permissions jsonb DEFAULT '[]',
    is_active boolean DEFAULT true,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    settings jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone,
    UNIQUE(tenant_id, email)
);

-- User sessions table
CREATE TABLE user_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(255) NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT NOW(),
    revoked_at timestamp with time zone
);

-- Websites table
CREATE TABLE websites (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    url varchar(500) NOT NULL,
    domain varchar(255) NOT NULL,
    description text,
    industry varchar(100),
    target_location varchar(100),
    language varchar(10) DEFAULT 'en',
    settings jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    last_crawled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone
);

-- =============================================================================
-- UPDATE TRIGGERS
-- =============================================================================

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_websites_updated_at
    BEFORE UPDATE ON websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- BASIC INDEXES
-- =============================================================================

-- Tenant indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;

-- User indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Session indexes
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Website indexes
CREATE INDEX idx_websites_tenant_id ON websites(tenant_id);
CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_websites_domain ON websites(domain);
CREATE INDEX idx_websites_active ON websites(is_active) WHERE is_active = true;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenants IS 'Root table for multi-tenant architecture';
COMMENT ON TABLE users IS 'User accounts with tenant isolation';
COMMENT ON TABLE websites IS 'Websites being tracked for SEO';
COMMENT ON FUNCTION update_updated_at_column() IS 'Updates the updated_at timestamp on row changes';