-- Migration: 002_seo_tables.sql
-- Description: Create SEO-related tables (keywords, rankings, competitors)
-- Created: 2025-09-21
-- =============================================================================

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

-- =============================================================================
-- UPDATE TRIGGERS
-- =============================================================================

CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at
    BEFORE UPDATE ON competitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INDEXES
-- =============================================================================

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

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE keywords IS 'Keywords being monitored';
COMMENT ON TABLE keyword_rankings IS 'Historical keyword position data';
COMMENT ON TABLE competitors IS 'Competitor websites';
COMMENT ON TABLE competitor_rankings IS 'Competitor keyword positions';