-- Migration: 005_views_functions.sql
-- Description: Create views and utility functions
-- Created: 2025-09-21
-- =============================================================================

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

-- Function to soft delete a record
CREATE OR REPLACE FUNCTION soft_delete_record(table_name text, record_uuid uuid)
RETURNS boolean AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', table_name)
    USING record_uuid;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to restore a soft deleted record
CREATE OR REPLACE FUNCTION restore_record(table_name text, record_uuid uuid)
RETURNS boolean AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name)
    USING record_uuid;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION set_tenant_context(uuid) IS 'Sets the current tenant context for RLS policies';
COMMENT ON FUNCTION set_user_context(uuid) IS 'Sets the current user context for audit logging';
COMMENT ON FUNCTION get_tenant_limits(uuid) IS 'Retrieves tenant subscription limits';
COMMENT ON FUNCTION check_tenant_usage(uuid) IS 'Checks current tenant resource usage';
COMMENT ON FUNCTION soft_delete_record(text, uuid) IS 'Soft deletes a record by setting deleted_at timestamp';
COMMENT ON FUNCTION restore_record(text, uuid) IS 'Restores a soft deleted record by clearing deleted_at';

COMMENT ON VIEW current_keyword_rankings IS 'Latest ranking data for all keywords';
COMMENT ON VIEW keyword_performance_summary IS 'Aggregated keyword performance metrics';