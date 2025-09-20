-- Ultimate SEO Platform Database Schema
-- PostgreSQL Database Setup

-- Create database (run as superuser)
-- CREATE DATABASE ultimate_seo;
-- \c ultimate_seo;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS seo;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS hive;

-- =====================================================
-- AUTH SCHEMA - Authentication and Authorization
-- =====================================================

-- Organizations (Tenants)
CREATE TABLE auth.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES auth.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '[]',
    google_id VARCHAR(255) UNIQUE,
    google_tokens JSONB,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys
CREATE TABLE auth.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES auth.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CORE SCHEMA - Core Business Objects
-- =====================================================

-- Projects
CREATE TABLE core.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES auth.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    google_analytics_id VARCHAR(100),
    google_search_console_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members
CREATE TABLE core.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    permissions JSONB DEFAULT '[]',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- =====================================================
-- SEO SCHEMA - SEO Management
-- =====================================================

-- Keywords
CREATE TABLE seo.keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    keyword VARCHAR(500) NOT NULL,
    search_volume INTEGER,
    difficulty DECIMAL(5,2),
    cpc DECIMAL(10,2),
    competition VARCHAR(20),
    intent VARCHAR(50),
    tags TEXT[],
    parent_keyword_id UUID REFERENCES seo.keywords(id),
    is_tracked BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Keyword Rankings (Partitioned by date)
CREATE TABLE seo.keyword_rankings (
    id UUID DEFAULT uuid_generate_v4(),
    keyword_id UUID REFERENCES seo.keywords(id) ON DELETE CASCADE,
    position INTEGER,
    url TEXT,
    featured_snippet BOOLEAN DEFAULT false,
    search_engine VARCHAR(50) DEFAULT 'google',
    location VARCHAR(100) DEFAULT 'US',
    device VARCHAR(20) DEFAULT 'desktop',
    tracked_at DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, tracked_at)
) PARTITION BY RANGE (tracked_at);

-- Create partitions for the last 3 months and next month
CREATE TABLE seo.keyword_rankings_2025_06 PARTITION OF seo.keyword_rankings
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE seo.keyword_rankings_2025_07 PARTITION OF seo.keyword_rankings
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE seo.keyword_rankings_2025_08 PARTITION OF seo.keyword_rankings
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE seo.keyword_rankings_2025_09 PARTITION OF seo.keyword_rankings
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE seo.keyword_rankings_2025_10 PARTITION OF seo.keyword_rankings
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Backlinks
CREATE TABLE seo.backlinks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    anchor_text TEXT,
    domain_authority INTEGER,
    page_authority INTEGER,
    spam_score DECIMAL(5,2),
    link_type VARCHAR(50),
    is_follow BOOLEAN DEFAULT true,
    first_seen DATE,
    last_seen DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitors
CREATE TABLE seo.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    organic_traffic BIGINT,
    keywords_count INTEGER,
    backlinks_count INTEGER,
    domain_authority INTEGER,
    tracking_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Optimization
CREATE TABLE seo.content_optimization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    meta_description TEXT,
    h1_tags TEXT[],
    word_count INTEGER,
    readability_score DECIMAL(5,2),
    keyword_density JSONB,
    recommendations JSONB,
    score DECIMAL(5,2),
    analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ANALYTICS SCHEMA - Traffic and Performance
-- =====================================================

-- Traffic Metrics (Partitioned by date)
CREATE TABLE analytics.traffic_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    organic_traffic INTEGER DEFAULT 0,
    paid_traffic INTEGER DEFAULT 0,
    direct_traffic INTEGER DEFAULT 0,
    referral_traffic INTEGER DEFAULT 0,
    social_traffic INTEGER DEFAULT 0,
    total_traffic INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2),
    avg_session_duration INTEGER,
    pages_per_session DECIMAL(5,2),
    conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

-- Create partitions
CREATE TABLE analytics.traffic_metrics_2025_q3 PARTITION OF analytics.traffic_metrics
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE analytics.traffic_metrics_2025_q4 PARTITION OF analytics.traffic_metrics
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Page Metrics
CREATE TABLE analytics.page_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    avg_time_on_page INTEGER,
    bounce_rate DECIMAL(5,2),
    exit_rate DECIMAL(5,2),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE analytics.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    template_id UUID,
    configuration JSONB DEFAULT '{}',
    data JSONB,
    generated_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    recipients TEXT[],
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- HIVE SCHEMA - Multi-Agent System
-- =====================================================

-- Agent Registry
CREATE TABLE hive.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    capabilities TEXT[],
    status VARCHAR(50) DEFAULT 'offline',
    version VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMP,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE hive.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID,
    type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5,
    payload JSONB,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Workflows
CREATE TABLE hive.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    configuration JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    project_id UUID REFERENCES core.projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Agent Communications
CREATE TABLE hive.communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_agent VARCHAR(255),
    to_agent VARCHAR(255),
    message_type VARCHAR(50),
    payload JSONB,
    response JSONB,
    latency_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Auth indexes
CREATE INDEX idx_users_organization ON auth.users(organization_id);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_sessions_user ON auth.sessions(user_id);
CREATE INDEX idx_sessions_token ON auth.sessions(token_hash);
CREATE INDEX idx_api_keys_org ON auth.api_keys(organization_id);

-- Core indexes
CREATE INDEX idx_projects_org ON core.projects(organization_id);
CREATE INDEX idx_team_members_project ON core.team_members(project_id);
CREATE INDEX idx_team_members_user ON core.team_members(user_id);

-- SEO indexes
CREATE INDEX idx_keywords_project ON seo.keywords(project_id);
CREATE INDEX idx_keywords_tracked ON seo.keywords(is_tracked);
CREATE INDEX idx_rankings_keyword ON seo.keyword_rankings(keyword_id);
CREATE INDEX idx_rankings_date ON seo.keyword_rankings(tracked_at);
CREATE INDEX idx_backlinks_project ON seo.backlinks(project_id);
CREATE INDEX idx_backlinks_domain ON seo.backlinks(source_url);
CREATE INDEX idx_competitors_project ON seo.competitors(project_id);
CREATE INDEX idx_content_project ON seo.content_optimization(project_id);
CREATE INDEX idx_content_url ON seo.content_optimization(url);

-- Analytics indexes
CREATE INDEX idx_traffic_project_date ON analytics.traffic_metrics(project_id, date);
CREATE INDEX idx_page_metrics_project ON analytics.page_metrics(project_id);
CREATE INDEX idx_page_metrics_url ON analytics.page_metrics(url);
CREATE INDEX idx_reports_project ON analytics.reports(project_id);

-- Hive indexes
CREATE INDEX idx_agents_status ON hive.agents(status);
CREATE INDEX idx_tasks_workflow ON hive.tasks(workflow_id);
CREATE INDEX idx_tasks_status ON hive.tasks(status);
CREATE INDEX idx_tasks_assigned ON hive.tasks(assigned_to);
CREATE INDEX idx_workflows_project ON hive.workflows(project_id);
CREATE INDEX idx_workflows_status ON hive.workflows(status);
CREATE INDEX idx_communications_from ON hive.communications(from_agent);
CREATE INDEX idx_communications_to ON hive.communications(to_agent);

-- Full text search indexes
CREATE INDEX idx_keywords_search ON seo.keywords USING gin(to_tsvector('english', keyword));
CREATE INDEX idx_content_title_search ON seo.content_optimization USING gin(to_tsvector('english', title));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON auth.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON core.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON seo.keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_backlinks_updated_at BEFORE UPDATE ON seo.backlinks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_competitors_updated_at BEFORE UPDATE ON seo.competitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON seo.content_optimization
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON analytics.reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE auth.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo.keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo.backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo.content_optimization ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.traffic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.page_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.reports ENABLE ROW LEVEL SECURITY;

-- Create application user role
CREATE ROLE app_user;

-- Grant permissions
GRANT USAGE ON SCHEMA auth, core, seo, analytics, hive TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA auth, core, seo, analytics, hive TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth, core, seo, analytics, hive TO app_user;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default organization
INSERT INTO auth.organizations (name, slug, subscription_tier) 
VALUES ('Demo Organization', 'demo', 'trial');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically create partitions
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    end_date := start_date + INTERVAL '1 month';
    
    -- Create partition for keyword_rankings
    partition_name := 'seo.keyword_rankings_' || TO_CHAR(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF seo.keyword_rankings FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
    
    -- Create partition for traffic_metrics
    partition_name := 'analytics.traffic_metrics_' || TO_CHAR(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics.traffic_metrics FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (run monthly)
-- This would typically be done via pg_cron or external scheduler