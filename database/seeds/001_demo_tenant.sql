-- Seed Data: 001_demo_tenant.sql
-- Description: Create demo tenant and users for testing
-- Created: 2025-09-21
-- =============================================================================

-- Insert demo tenant
INSERT INTO tenants (
    id,
    name,
    slug,
    domain,
    subscription_plan,
    subscription_status,
    billing_email,
    settings,
    limits,
    is_active,
    trial_ends_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'Demo SEO Agency',
    'demo-seo-agency',
    'demoseo.com',
    'professional',
    'active',
    'billing@demoseo.com',
    '{"timezone": "UTC", "currency": "USD", "notification_preferences": {"email": true, "browser": true}}',
    '{"keywords": 500, "reports": 50, "users": 10, "websites": 20}',
    true,
    NOW() + INTERVAL '30 days'
);

-- Insert demo users
INSERT INTO users (
    id,
    tenant_id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    permissions,
    is_active,
    email_verified_at,
    settings
) VALUES
(
    '223e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    'admin@demoseo.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLF/M6Ug1.m1JGO', -- password: admin123
    'John',
    'Smith',
    'admin',
    '["manage_users", "manage_websites", "manage_keywords", "view_reports", "manage_integrations"]',
    true,
    NOW(),
    '{"dashboard_layout": "default", "email_notifications": true, "timezone": "UTC"}'
),
(
    '323e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    'manager@demoseo.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLF/M6Ug1.m1JGO', -- password: manager123
    'Sarah',
    'Johnson',
    'manager',
    '["manage_websites", "manage_keywords", "view_reports"]',
    true,
    NOW(),
    '{"dashboard_layout": "compact", "email_notifications": true, "timezone": "EST"}'
),
(
    '423e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    'analyst@demoseo.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLF/M6Ug1.m1JGO', -- password: analyst123
    'Mike',
    'Davis',
    'user',
    '["view_keywords", "view_reports"]',
    true,
    NOW(),
    '{"dashboard_layout": "detailed", "email_notifications": false, "timezone": "PST"}'
);

-- Insert demo websites
INSERT INTO websites (
    id,
    tenant_id,
    user_id,
    name,
    url,
    domain,
    description,
    industry,
    target_location,
    language,
    settings,
    is_active
) VALUES
(
    '523e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'E-commerce Fashion Store',
    'https://fashionstore.com',
    'fashionstore.com',
    'Online fashion retailer specializing in trendy clothing and accessories',
    'Fashion & Retail',
    'United States',
    'en',
    '{"google_analytics_id": "GA-123456789", "google_search_console_verified": true, "crawl_frequency": "daily"}',
    true
),
(
    '623e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Tech Blog',
    'https://techblog.net',
    'techblog.net',
    'Technology news and reviews blog',
    'Technology',
    'Global',
    'en',
    '{"google_analytics_id": "GA-987654321", "google_search_console_verified": false, "crawl_frequency": "weekly"}',
    true
),
(
    '723e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Local Restaurant',
    'https://localrestaurant.com',
    'localrestaurant.com',
    'Family-owned Italian restaurant in downtown',
    'Food & Dining',
    'New York, NY',
    'en',
    '{"google_analytics_id": "GA-456789123", "google_search_console_verified": true, "crawl_frequency": "weekly"}',
    true
);

-- Set tenant context for subsequent operations
SELECT set_tenant_context('123e4567-e89b-12d3-a456-426614174000');

-- Insert demo API key
INSERT INTO api_keys (
    id,
    tenant_id,
    user_id,
    name,
    key_hash,
    key_prefix,
    permissions,
    rate_limit,
    is_active,
    expires_at
) VALUES (
    '823e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'Production API Key',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLF/M6Ug1.m1JGO',
    'seo_prod_',
    '["read_keywords", "read_rankings", "read_reports", "write_keywords"]',
    5000,
    true,
    NOW() + INTERVAL '1 year'
);

-- Insert demo notifications
INSERT INTO notifications (
    tenant_id,
    user_id,
    title,
    message,
    type,
    data,
    is_read
) VALUES
(
    '123e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'Welcome to Ultimate SEO Platform',
    'Your account has been successfully created. Start by adding your first website and keywords to track.',
    'welcome',
    '{"action_url": "/websites/new"}',
    false
),
(
    '123e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Keyword Ranking Update',
    'Your keyword "fashion trends 2025" has improved by 5 positions!',
    'ranking_improvement',
    '{"keyword": "fashion trends 2025", "old_position": 15, "new_position": 10, "website": "fashionstore.com"}',
    false
),
(
    '123e4567-e89b-12d3-a456-426614174000',
    '423e4567-e89b-12d3-a456-426614174000',
    'Weekly Report Ready',
    'Your weekly SEO report for Tech Blog is now available for download.',
    'report',
    '{"report_id": "rep_123", "website": "techblog.net", "download_url": "/reports/rep_123/download"}',
    false
);