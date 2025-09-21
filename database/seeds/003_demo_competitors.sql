-- Seed Data: 003_demo_competitors.sql
-- Description: Create demo competitors and integrations for testing
-- Created: 2025-09-21
-- =============================================================================

-- Set tenant context
SELECT set_tenant_context('123e4567-e89b-12d3-a456-426614174000');

-- Insert demo competitors for Fashion Store
INSERT INTO competitors (
    id,
    tenant_id,
    website_id,
    name,
    domain,
    url,
    is_active
) VALUES
(
    'j23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'Fashion Forward',
    'fashionforward.com',
    'https://fashionforward.com',
    true
),
(
    'k23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'Style Central',
    'stylecentral.com',
    'https://stylecentral.com',
    true
),
(
    'l23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'Trendy Boutique',
    'trendyboutique.com',
    'https://trendyboutique.com',
    true
);

-- Insert demo competitors for Tech Blog
INSERT INTO competitors (
    id,
    tenant_id,
    website_id,
    name,
    domain,
    url,
    is_active
) VALUES
(
    'm23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'TechCrunch',
    'techcrunch.com',
    'https://techcrunch.com',
    true
),
(
    'n23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'Ars Technica',
    'arstechnica.com',
    'https://arstechnica.com',
    true
),
(
    'o23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'The Verge',
    'theverge.com',
    'https://theverge.com',
    true
);

-- Insert demo competitors for Local Restaurant
INSERT INTO competitors (
    id,
    tenant_id,
    website_id,
    name,
    domain,
    url,
    is_active
) VALUES
(
    'p23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    'Little Italy Restaurant',
    'littleitalynyc.com',
    'https://littleitalynyc.com',
    true
),
(
    'q23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    'Mario\'s Pizzeria',
    'mariospizzanyc.com',
    'https://mariospizzanyc.com',
    true
);

-- Insert competitor rankings
INSERT INTO competitor_rankings (
    tenant_id,
    competitor_id,
    keyword_id,
    search_engine,
    location,
    device,
    position,
    url,
    recorded_at
) VALUES
-- Fashion competitors
('123e4567-e89b-12d3-a456-426614174000', 'j23e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 8, 'https://fashionforward.com/trends', NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'k23e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 3, 'https://stylecentral.com/fashion-trends', NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'l23e4567-e89b-12d3-a456-426614174000', 'a23e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 15, 'https://trendyboutique.com/designer-dresses', NOW() - INTERVAL '1 day'),

-- Tech competitors
('123e4567-e89b-12d3-a456-426614174000', 'm23e4567-e89b-12d3-a456-426614174000', 'd23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 2, 'https://techcrunch.com/ai-trends', NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'n23e4567-e89b-12d3-a456-426614174000', 'e23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 5, 'https://arstechnica.com/programming', NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'o23e4567-e89b-12d3-a456-426614174000', 'f23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 12, 'https://theverge.com/cloud', NOW() - INTERVAL '1 day'),

-- Restaurant competitors
('123e4567-e89b-12d3-a456-426614174000', 'p23e4567-e89b-12d3-a456-426614174000', 'g23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 2, 'https://littleitalynyc.com', NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'q23e4567-e89b-12d3-a456-426614174000', 'h23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 7, 'https://mariospizzanyc.com/pasta', NOW() - INTERVAL '1 day');

-- Insert demo integrations
INSERT INTO integrations (
    id,
    tenant_id,
    user_id,
    name,
    type,
    provider,
    config,
    credentials,
    is_active,
    last_sync_at,
    sync_status
) VALUES
(
    'r23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'Google Search Console',
    'search_console',
    'google',
    '{"auto_sync": true, "sync_frequency": "daily", "fetch_queries": true, "fetch_pages": true}',
    '{"access_token": "encrypted_token_123", "refresh_token": "encrypted_refresh_123", "expires_at": "2025-12-31T23:59:59Z"}',
    true,
    NOW() - INTERVAL '2 hours',
    'completed'
),
(
    's23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'Google Analytics',
    'analytics',
    'google',
    '{"auto_sync": true, "sync_frequency": "daily", "fetch_organic_traffic": true, "fetch_conversion_data": true}',
    '{"access_token": "encrypted_token_456", "refresh_token": "encrypted_refresh_456", "expires_at": "2025-12-31T23:59:59Z"}',
    true,
    NOW() - INTERVAL '3 hours',
    'completed'
),
(
    't23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'SEMrush Integration',
    'keyword_research',
    'semrush',
    '{"auto_sync": false, "fetch_keyword_data": true, "fetch_competitor_data": true}',
    '{"api_key": "encrypted_semrush_key_789"}',
    true,
    NOW() - INTERVAL '1 day',
    'completed'
),
(
    'u23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Ahrefs Backlink Monitor',
    'backlinks',
    'ahrefs',
    '{"auto_sync": true, "sync_frequency": "weekly", "fetch_new_backlinks": true, "fetch_lost_backlinks": true}',
    '{"api_key": "encrypted_ahrefs_key_101"}',
    false,
    NOW() - INTERVAL '7 days',
    'error'
);

-- Insert demo reports
INSERT INTO reports (
    id,
    tenant_id,
    website_id,
    user_id,
    name,
    type,
    parameters,
    data,
    status,
    scheduled_at,
    completed_at,
    file_path,
    is_public
) VALUES
(
    'v23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    '223e4567-e89b-12d3-a456-426614174000',
    'Monthly Fashion Store SEO Report',
    'monthly_seo',
    '{"date_range": "last_30_days", "include_keywords": true, "include_rankings": true, "include_competitors": true}',
    '{"total_keywords": 25, "avg_position": 18.5, "total_traffic": 12500, "keyword_improvements": 8, "keyword_declines": 3}',
    'completed',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 hours',
    '/reports/fashion_store_monthly_2025_09.pdf',
    false
),
(
    'w23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Tech Blog Weekly Performance',
    'weekly_performance',
    '{"date_range": "last_7_days", "include_traffic": true, "include_rankings": true}',
    '{"total_keywords": 15, "avg_position": 22.3, "total_traffic": 8750, "featured_snippets": 2}',
    'completed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '2 hours',
    '/reports/tech_blog_weekly_2025_09_15.pdf',
    true
),
(
    'x23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    '323e4567-e89b-12d3-a456-426614174000',
    'Restaurant Local SEO Report',
    'local_seo',
    '{"date_range": "last_30_days", "include_local_rankings": true, "include_reviews": true}',
    NULL,
    'pending',
    NOW() + INTERVAL '2 hours',
    NULL,
    NULL,
    false
);