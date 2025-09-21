-- Ultimate SEO Platform Database Schema
-- Multi-tenant SaaS Architecture with PostgreSQL
-- Created: 2025-09-21
-- Version: 1.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- =============================================================================
-- AUDIT AND UTILITY FUNCTIONS
-- =============================================================================

-- Audit logging function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs(
            tenant_id, table_name, operation, record_id,
            new_values, user_id, created_at
        ) VALUES (
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
            TG_TABLE_NAME, TG_OP, NEW.id,
            row_to_json(NEW),
            COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs(
            tenant_id, table_name, operation, record_id,
            old_values, new_values, user_id, created_at
        ) VALUES (
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
            TG_TABLE_NAME, TG_OP, NEW.id,
            row_to_json(OLD), row_to_json(NEW),
            COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs(
            tenant_id, table_name, operation, record_id,
            old_values, user_id, created_at
        ) VALUES (
            COALESCE(OLD.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
            TG_TABLE_NAME, TG_OP, OLD.id,
            row_to_json(OLD),
            COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
            NOW()
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

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

-- Keywords table
CREATE TABLE keywords (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    keyword varchar(255) NOT NULL,
    search_volume integer DEFAULT 0,
    competition_level varchar(20) DEFAULT 'unknown',
    difficulty_score integer,
    target_url varchar(500),
    is_tracked boolean DEFAULT true,
    tags varchar(255)[],
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone,
    UNIQUE(tenant_id, website_id, keyword)
);

-- Keyword rankings table
CREATE TABLE keyword_rankings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    keyword_id uuid NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    search_engine varchar(50) NOT NULL DEFAULT 'google',
    location varchar(100),
    device varchar(20) DEFAULT 'desktop',
    position integer,
    url varchar(500),
    featured_snippet boolean DEFAULT false,
    local_pack_position integer,
    previous_position integer,
    change_from_previous integer,
    recorded_at timestamp with time zone DEFAULT NOW(),
    created_at timestamp with time zone DEFAULT NOW()
);

-- Competitors table
CREATE TABLE competitors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    domain varchar(255) NOT NULL,
    url varchar(500),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone,
    UNIQUE(tenant_id, website_id, domain)
);

-- Competitor rankings table
CREATE TABLE competitor_rankings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    keyword_id uuid NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    search_engine varchar(50) NOT NULL DEFAULT 'google',
    location varchar(100),
    device varchar(20) DEFAULT 'desktop',
    position integer,
    url varchar(500),
    recorded_at timestamp with time zone DEFAULT NOW(),
    created_at timestamp with time zone DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    type varchar(50) NOT NULL,
    parameters jsonb DEFAULT '{}',
    data jsonb,
    status varchar(20) DEFAULT 'pending',
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    file_path varchar(500),
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone
);

-- Integrations table
CREATE TABLE integrations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    type varchar(50) NOT NULL,
    provider varchar(100) NOT NULL,
    config jsonb DEFAULT '{}',
    credentials jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    last_sync_at timestamp with time zone,
    sync_status varchar(20) DEFAULT 'idle',
    error_message text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone
);

-- API keys table
CREATE TABLE api_keys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    key_hash varchar(255) NOT NULL UNIQUE,
    key_prefix varchar(20) NOT NULL,
    permissions jsonb DEFAULT '[]',
    rate_limit integer DEFAULT 1000,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    deleted_at timestamp with time zone
);

-- Notifications table
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    type varchar(50) NOT NULL DEFAULT 'info',
    data jsonb DEFAULT '{}',
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,
    table_name varchar(100) NOT NULL,
    operation varchar(10) NOT NULL,
    record_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
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

-- Keyword indexes
CREATE INDEX idx_keywords_tenant_id ON keywords(tenant_id);
CREATE INDEX idx_keywords_website_id ON keywords(website_id);
CREATE INDEX idx_keywords_keyword ON keywords(keyword);
CREATE INDEX idx_keywords_keyword_trgm ON keywords USING gin(keyword gin_trgm_ops);
CREATE INDEX idx_keywords_tracked ON keywords(is_tracked) WHERE is_tracked = true;

-- Ranking indexes
CREATE INDEX idx_keyword_rankings_tenant_id ON keyword_rankings(tenant_id);
CREATE INDEX idx_keyword_rankings_keyword_id ON keyword_rankings(keyword_id);
CREATE INDEX idx_keyword_rankings_recorded_at ON keyword_rankings(recorded_at);
CREATE INDEX idx_keyword_rankings_position ON keyword_rankings(position);
CREATE INDEX idx_keyword_rankings_search_engine ON keyword_rankings(search_engine);

-- Competitor indexes
CREATE INDEX idx_competitors_tenant_id ON competitors(tenant_id);
CREATE INDEX idx_competitors_website_id ON competitors(website_id);
CREATE INDEX idx_competitors_domain ON competitors(domain);

-- Competitor ranking indexes
CREATE INDEX idx_competitor_rankings_tenant_id ON competitor_rankings(tenant_id);
CREATE INDEX idx_competitor_rankings_competitor_id ON competitor_rankings(competitor_id);
CREATE INDEX idx_competitor_rankings_keyword_id ON competitor_rankings(keyword_id);
CREATE INDEX idx_competitor_rankings_recorded_at ON competitor_rankings(recorded_at);

-- Report indexes
CREATE INDEX idx_reports_tenant_id ON reports(tenant_id);
CREATE INDEX idx_reports_website_id ON reports(website_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_scheduled_at ON reports(scheduled_at);

-- Integration indexes
CREATE INDEX idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_active ON integrations(is_active) WHERE is_active = true;

-- API key indexes
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Notification indexes
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Audit log indexes
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_websites_updated_at
    BEFORE UPDATE ON websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at
    BEFORE UPDATE ON competitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_websites_trigger
    AFTER INSERT OR UPDATE OR DELETE ON websites
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_keywords_trigger
    AFTER INSERT OR UPDATE OR DELETE ON keywords
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_integrations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON integrations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on tenant-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_websites ON websites
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_keywords ON keywords
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_keyword_rankings ON keyword_rankings
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_competitors ON competitors
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_competitor_rankings ON competitor_rankings
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_reports ON reports
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_integrations ON integrations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_api_keys ON api_keys
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_notifications ON notifications
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Current keyword rankings view
CREATE VIEW current_keyword_rankings AS
SELECT DISTINCT ON (kr.keyword_id, kr.search_engine, kr.location, kr.device)
    kr.*,
    k.keyword,
    w.name as website_name,
    w.domain as website_domain
FROM keyword_rankings kr
JOIN keywords k ON kr.keyword_id = k.id
JOIN websites w ON k.website_id = w.id
ORDER BY kr.keyword_id, kr.search_engine, kr.location, kr.device, kr.recorded_at DESC;

-- Keyword performance summary view
CREATE VIEW keyword_performance_summary AS
SELECT
    k.id,
    k.tenant_id,
    k.website_id,
    k.keyword,
    k.search_volume,
    k.difficulty_score,
    AVG(kr.position) as avg_position,
    MIN(kr.position) as best_position,
    MAX(kr.position) as worst_position,
    COUNT(kr.id) as total_rankings,
    MAX(kr.recorded_at) as last_recorded_at
FROM keywords k
LEFT JOIN keyword_rankings kr ON k.id = kr.keyword_id
WHERE k.deleted_at IS NULL
GROUP BY k.id, k.tenant_id, k.website_id, k.keyword, k.search_volume, k.difficulty_score;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid uuid)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Function to set user context
CREATE OR REPLACE FUNCTION set_user_context(user_uuid uuid)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant limits
CREATE OR REPLACE FUNCTION get_tenant_limits(tenant_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    tenant_limits jsonb;
BEGIN
    SELECT limits INTO tenant_limits
    FROM tenants
    WHERE id = tenant_uuid AND deleted_at IS NULL;

    RETURN COALESCE(tenant_limits, '{"keywords": 100, "reports": 10, "users": 5}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to check tenant usage
CREATE OR REPLACE FUNCTION check_tenant_usage(tenant_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    keyword_count integer;
    user_count integer;
    report_count integer;
    result jsonb;
BEGIN
    -- Count active keywords
    SELECT COUNT(*) INTO keyword_count
    FROM keywords
    WHERE tenant_id = tenant_uuid AND deleted_at IS NULL;

    -- Count active users
    SELECT COUNT(*) INTO user_count
    FROM users
    WHERE tenant_id = tenant_uuid AND deleted_at IS NULL;

    -- Count reports from last 30 days
    SELECT COUNT(*) INTO report_count
    FROM reports
    WHERE tenant_id = tenant_uuid
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '30 days';

    result := jsonb_build_object(
        'keywords', keyword_count,
        'users', user_count,
        'reports', report_count
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenants IS 'Root table for multi-tenant architecture';
COMMENT ON TABLE users IS 'User accounts with tenant isolation';
COMMENT ON TABLE websites IS 'Websites being tracked for SEO';
COMMENT ON TABLE keywords IS 'Keywords being monitored';
COMMENT ON TABLE keyword_rankings IS 'Historical keyword position data';
COMMENT ON TABLE competitors IS 'Competitor websites';
COMMENT ON TABLE competitor_rankings IS 'Competitor keyword positions';
COMMENT ON TABLE reports IS 'Generated SEO reports';
COMMENT ON TABLE integrations IS 'Third-party service integrations';
COMMENT ON TABLE api_keys IS 'API access keys';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE audit_logs IS 'System audit trail';

COMMENT ON FUNCTION audit_trigger_function() IS 'Automatically logs all changes to audited tables';
COMMENT ON FUNCTION update_updated_at_column() IS 'Updates the updated_at timestamp on row changes';
COMMENT ON FUNCTION set_tenant_context(uuid) IS 'Sets the current tenant context for RLS policies';
COMMENT ON FUNCTION set_user_context(uuid) IS 'Sets the current user context for audit logging';