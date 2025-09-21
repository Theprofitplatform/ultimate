-- Seed Data: 002_demo_keywords.sql
-- Description: Create demo keywords and rankings for testing
-- Created: 2025-09-21
-- =============================================================================

-- Set tenant context
SELECT set_tenant_context('123e4567-e89b-12d3-a456-426614174000');

-- Insert demo keywords for Fashion Store
INSERT INTO keywords (
    id,
    tenant_id,
    website_id,
    keyword,
    search_volume,
    competition_level,
    difficulty_score,
    target_url,
    is_tracked,
    tags
) VALUES
(
    '923e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'women fashion trends 2025',
    12000,
    'high',
    75,
    'https://fashionstore.com/trends/women',
    true,
    ARRAY['fashion', 'women', 'trends', 'clothing']
),
(
    'a23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'affordable designer dresses',
    8500,
    'medium',
    60,
    'https://fashionstore.com/dresses',
    true,
    ARRAY['fashion', 'dresses', 'designer', 'affordable']
),
(
    'b23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'summer fashion accessories',
    5600,
    'medium',
    55,
    'https://fashionstore.com/accessories/summer',
    true,
    ARRAY['fashion', 'accessories', 'summer']
),
(
    'c23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '523e4567-e89b-12d3-a456-426614174000',
    'sustainable fashion brands',
    15000,
    'high',
    80,
    'https://fashionstore.com/sustainable',
    true,
    ARRAY['fashion', 'sustainable', 'eco-friendly', 'brands']
);

-- Insert demo keywords for Tech Blog
INSERT INTO keywords (
    id,
    tenant_id,
    website_id,
    keyword,
    search_volume,
    competition_level,
    difficulty_score,
    target_url,
    is_tracked,
    tags
) VALUES
(
    'd23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'artificial intelligence trends 2025',
    22000,
    'high',
    85,
    'https://techblog.net/ai-trends-2025',
    true,
    ARRAY['technology', 'ai', 'trends', 'artificial intelligence']
),
(
    'e23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'best programming languages',
    18500,
    'high',
    70,
    'https://techblog.net/programming-languages',
    true,
    ARRAY['technology', 'programming', 'languages', 'coding']
),
(
    'f23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '623e4567-e89b-12d3-a456-426614174000',
    'cloud computing solutions',
    13500,
    'medium',
    65,
    'https://techblog.net/cloud-computing',
    true,
    ARRAY['technology', 'cloud', 'computing', 'solutions']
);

-- Insert demo keywords for Local Restaurant
INSERT INTO keywords (
    id,
    tenant_id,
    website_id,
    keyword,
    search_volume,
    competition_level,
    difficulty_score,
    target_url,
    is_tracked,
    tags
) VALUES
(
    'g23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    'best italian restaurant nyc',
    9500,
    'high',
    75,
    'https://localrestaurant.com',
    true,
    ARRAY['restaurant', 'italian', 'nyc', 'food']
),
(
    'h23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    'authentic pasta downtown',
    4200,
    'medium',
    50,
    'https://localrestaurant.com/menu/pasta',
    true,
    ARRAY['restaurant', 'pasta', 'authentic', 'downtown']
),
(
    'i23e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    '723e4567-e89b-12d3-a456-426614174000',
    'family friendly restaurant nyc',
    7800,
    'medium',
    60,
    'https://localrestaurant.com/family',
    true,
    ARRAY['restaurant', 'family', 'friendly', 'nyc']
);

-- Insert historical keyword rankings
INSERT INTO keyword_rankings (
    tenant_id,
    keyword_id,
    search_engine,
    location,
    device,
    position,
    url,
    featured_snippet,
    previous_position,
    change_from_previous,
    recorded_at
) VALUES
-- Fashion keywords rankings
('123e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 12, 'https://fashionstore.com/trends/women', false, 15, -3, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'mobile', 14, 'https://fashionstore.com/trends/women', false, 16, -2, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'a23e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 8, 'https://fashionstore.com/dresses', false, 9, -1, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'b23e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 25, 'https://fashionstore.com/accessories/summer', false, 28, -3, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'c23e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 45, 'https://fashionstore.com/sustainable', false, 47, -2, NOW() - INTERVAL '1 day'),

-- Tech blog rankings
('123e4567-e89b-12d3-a456-426614174000', 'd23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 6, 'https://techblog.net/ai-trends-2025', true, 8, -2, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'e23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 18, 'https://techblog.net/programming-languages', false, 20, -2, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'f23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 32, 'https://techblog.net/cloud-computing', false, 35, -3, NOW() - INTERVAL '1 day'),

-- Restaurant rankings
('123e4567-e89b-12d3-a456-426614174000', 'g23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 4, 'https://localrestaurant.com', false, 5, -1, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'h23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 11, 'https://localrestaurant.com/menu/pasta', false, 13, -2, NOW() - INTERVAL '1 day'),
('123e4567-e89b-12d3-a456-426614174000', 'i23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 22, 'https://localrestaurant.com/family', false, 24, -2, NOW() - INTERVAL '1 day'),

-- Historical data (7 days ago)
('123e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 15, 'https://fashionstore.com/trends/women', false, 18, -3, NOW() - INTERVAL '7 days'),
('123e4567-e89b-12d3-a456-426614174000', 'd23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 8, 'https://techblog.net/ai-trends-2025', false, 10, -2, NOW() - INTERVAL '7 days'),
('123e4567-e89b-12d3-a456-426614174000', 'g23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 5, 'https://localrestaurant.com', false, 7, -2, NOW() - INTERVAL '7 days'),

-- Historical data (30 days ago)
('123e4567-e89b-12d3-a456-426614174000', '923e4567-e89b-12d3-a456-426614174000', 'google', 'US', 'desktop', 18, 'https://fashionstore.com/trends/women', false, 22, -4, NOW() - INTERVAL '30 days'),
('123e4567-e89b-12d3-a456-426614174000', 'd23e4567-e89b-12d3-a456-426614174000', 'google', 'Global', 'desktop', 10, 'https://techblog.net/ai-trends-2025', false, 12, -2, NOW() - INTERVAL '30 days'),
('123e4567-e89b-12d3-a456-426614174000', 'g23e4567-e89b-12d3-a456-426614174000', 'google', 'New York, NY', 'desktop', 7, 'https://localrestaurant.com', false, 8, -1, NOW() - INTERVAL '30 days');