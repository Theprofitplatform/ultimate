-- Migration: 004_audit_security.sql
-- Description: Create audit logging and security features
-- Created: 2025-09-21
-- =============================================================================

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
-- AUDIT FUNCTION
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

-- =============================================================================
-- AUDIT TRIGGERS
-- =============================================================================

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
-- INDEXES
-- =============================================================================

-- Audit log indexes
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE audit_logs IS 'System audit trail';
COMMENT ON FUNCTION audit_trigger_function() IS 'Automatically logs all changes to audited tables';