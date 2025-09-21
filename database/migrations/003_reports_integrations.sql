-- Migration: 003_reports_integrations.sql
-- Description: Create reports, integrations, and API keys tables
-- Created: 2025-09-21
-- =============================================================================

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

-- =============================================================================
-- UPDATE TRIGGERS
-- =============================================================================

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INDEXES
-- =============================================================================

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

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE reports IS 'Generated SEO reports';
COMMENT ON TABLE integrations IS 'Third-party service integrations';
COMMENT ON TABLE api_keys IS 'API access keys';
COMMENT ON TABLE notifications IS 'User notifications';