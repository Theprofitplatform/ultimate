/**
 * Keywords Test Fixtures
 * Mock data for keyword-related tests
 */

const keywords = {
  // Valid keyword data
  validKeyword: {
    keyword: 'seo optimization',
    search_volume: 5000,
    keyword_difficulty: 45,
    cpc: 2.50,
    competition_level: 'medium',
    location: 'united-states',
    language: 'en',
    device: 'desktop'
  },

  // High volume keyword
  highVolumeKeyword: {
    keyword: 'digital marketing',
    search_volume: 50000,
    keyword_difficulty: 85,
    cpc: 15.75,
    competition_level: 'high',
    location: 'global',
    language: 'en',
    device: 'desktop'
  },

  // Low competition keyword
  lowCompetitionKeyword: {
    keyword: 'local seo tips',
    search_volume: 800,
    keyword_difficulty: 25,
    cpc: 1.20,
    competition_level: 'low',
    location: 'united-states',
    language: 'en',
    device: 'mobile'
  },

  // Long tail keyword
  longTailKeyword: {
    keyword: 'how to optimize website for search engines in 2024',
    search_volume: 150,
    keyword_difficulty: 20,
    cpc: 3.80,
    competition_level: 'low',
    location: 'global',
    language: 'en',
    device: 'desktop'
  },

  // Non-English keyword
  nonEnglishKeyword: {
    keyword: 'optimización seo',
    search_volume: 2000,
    keyword_difficulty: 40,
    cpc: 1.50,
    competition_level: 'medium',
    location: 'spain',
    language: 'es',
    device: 'desktop'
  },

  // Invalid keyword data
  invalidKeyword: {
    keyword: '', // Empty keyword
    search_volume: -100, // Negative volume
    keyword_difficulty: 150, // Over 100
    cpc: -5.00, // Negative CPC
    competition_level: 'invalid', // Invalid level
    location: null,
    language: null,
    device: null
  },

  // SQL injection keyword
  sqlInjectionKeyword: {
    keyword: "'; DROP TABLE keywords; --",
    search_volume: 1000,
    keyword_difficulty: 50,
    cpc: 2.00,
    competition_level: 'medium',
    location: 'global',
    language: 'en',
    device: 'desktop'
  },

  // Very long keyword
  longKeyword: {
    keyword: 'a'.repeat(500) + ' extremely long keyword for testing purposes',
    search_volume: 10,
    keyword_difficulty: 10,
    cpc: 0.50,
    competition_level: 'low',
    location: 'global',
    language: 'en',
    device: 'desktop'
  }
};

// Database keyword fixtures
const dbKeywords = {
  activeKeyword: {
    id: 1,
    tenant_id: 1,
    keyword: 'active test keyword',
    search_volume: 3000,
    keyword_difficulty: 60,
    cpc: 4.25,
    competition_level: 'medium',
    current_position: 5,
    best_position: 3,
    worst_position: 15,
    location: 'global',
    language: 'en',
    device: 'desktop',
    trend_data: {
      last_12_months: [100, 120, 110, 130, 125, 140, 135, 150, 145, 160, 155, 170],
      trend_direction: 'up'
    },
    serp_features: ['featured_snippet', 'people_also_ask'],
    last_analyzed: new Date(),
    analysis_status: 'completed',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },

  inactiveKeyword: {
    id: 2,
    tenant_id: 1,
    keyword: 'inactive test keyword',
    search_volume: 1500,
    keyword_difficulty: 30,
    cpc: 1.75,
    competition_level: 'low',
    current_position: null,
    best_position: null,
    worst_position: null,
    location: 'global',
    language: 'en',
    device: 'desktop',
    trend_data: null,
    serp_features: [],
    last_analyzed: null,
    analysis_status: 'pending',
    is_active: false,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },

  pendingKeyword: {
    id: 3,
    tenant_id: 1,
    keyword: 'pending analysis keyword',
    search_volume: 0,
    keyword_difficulty: 0,
    cpc: 0.00,
    competition_level: 'unknown',
    current_position: null,
    best_position: null,
    worst_position: null,
    location: 'global',
    language: 'en',
    device: 'desktop',
    trend_data: null,
    serp_features: [],
    last_analyzed: null,
    analysis_status: 'pending',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
};

// Keyword rankings fixtures
const rankings = {
  currentRanking: {
    id: 1,
    keyword_id: 1,
    position: 5,
    url: 'https://example.com/page1',
    title: 'Test Page Title for SEO',
    check_date: new Date().toISOString().split('T')[0],
    created_at: new Date()
  },

  historicalRanking: {
    id: 2,
    keyword_id: 1,
    position: 8,
    url: 'https://example.com/page1',
    title: 'Test Page Title for SEO',
    check_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },

  improvedRanking: {
    id: 3,
    keyword_id: 1,
    position: 3,
    url: 'https://example.com/page1',
    title: 'Improved Test Page Title for SEO',
    check_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
};

// Bulk keyword data
const bulkKeywords = [
  {
    keyword: 'bulk keyword 1',
    search_volume: 1000,
    keyword_difficulty: 30,
    cpc: 2.00,
    competition_level: 'low',
    location: 'global',
    language: 'en',
    device: 'desktop'
  },
  {
    keyword: 'bulk keyword 2',
    search_volume: 2000,
    keyword_difficulty: 50,
    cpc: 3.50,
    competition_level: 'medium',
    location: 'global',
    language: 'en',
    device: 'mobile'
  },
  {
    keyword: 'bulk keyword 3',
    search_volume: 3000,
    keyword_difficulty: 70,
    cpc: 5.00,
    competition_level: 'high',
    location: 'united-states',
    language: 'en',
    device: 'desktop'
  }
];

// Analysis results fixtures
const analysisResults = {
  successfulAnalysis: {
    keyword: 'test keyword',
    success: true,
    analysis: {
      metrics: {
        search_volume: 5000,
        keyword_difficulty: 45,
        cpc: 2.50,
        competition_level: 'medium',
        trend_data: {
          last_12_months: [80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135],
          trend_direction: 'up'
        },
        related_keywords: [
          'test keyword tips',
          'test keyword guide',
          'best test keyword',
          'test keyword 2024'
        ],
        serp_features: ['featured_snippet', 'people_also_ask']
      },
      serp_analysis: {
        total_results: 1500000,
        paid_results_count: 4,
        organic_results_analyzed: 10,
        average_word_count: 1200,
        average_domain_authority: 65
      },
      competition_analysis: {
        top_competitors: [
          'competitor1.com',
          'competitor2.com',
          'competitor3.com'
        ],
        content_gaps: [
          'test keyword tutorial',
          'test keyword comparison',
          'test keyword review'
        ],
        opportunity_score: 75
      }
    }
  },

  failedAnalysis: {
    keyword: 'failed keyword',
    success: false,
    error: 'API rate limit exceeded'
  }
};

// Filter options for testing
const filterOptions = {
  basic: {
    page: 1,
    limit: 10
  },

  withFilters: {
    keyword: 'seo',
    location: 'global',
    language: 'en',
    device: 'desktop',
    competition_level: 'medium',
    min_search_volume: 1000,
    max_keyword_difficulty: 50,
    page: 1,
    limit: 20
  },

  sorting: {
    sort_by: 'search_volume',
    sort_order: 'desc',
    page: 1,
    limit: 10
  },

  pagination: {
    page: 2,
    limit: 5
  }
};

// Export options
const exportOptions = {
  csv: {
    format: 'csv',
    fields: ['keyword', 'search_volume', 'keyword_difficulty', 'cpc', 'competition_level'],
    filters: {}
  },

  json: {
    format: 'json',
    fields: ['keyword', 'search_volume', 'keyword_difficulty', 'cpc', 'current_position'],
    filters: { is_active: true }
  },

  excel: {
    format: 'excel',
    fields: ['keyword', 'search_volume', 'keyword_difficulty', 'cpc', 'competition_level', 'current_position'],
    filters: { min_search_volume: 500 }
  }
};

// Keyword suggestions
const suggestions = {
  seed: 'digital marketing',
  suggestions: [
    { keyword: 'digital marketing tips', source: 'database', frequency: 150 },
    { keyword: 'digital marketing guide', source: 'external', frequency: null },
    { keyword: 'digital marketing tutorial', source: 'external', frequency: null },
    { keyword: 'digital marketing 2024', source: 'database', frequency: 89 },
    { keyword: 'best digital marketing', source: 'external', frequency: null }
  ],
  total_found: 5
};

// Analytics data
const analytics = {
  basic: {
    total_keywords: 150,
    active_keywords: 140,
    tracked_rankings: 85,
    top_3_rankings: 25,
    top_10_rankings: 50,
    avg_search_volume: 2500,
    avg_difficulty: 45,
    avg_cpc: 3.25,
    total_search_volume: 375000
  },

  enriched: {
    total_keywords: 150,
    active_keywords: 140,
    tracked_rankings: 85,
    top_3_rankings: 25,
    top_10_rankings: 50,
    avg_search_volume: 2500,
    avg_difficulty: 45,
    avg_cpc: 3.25,
    total_search_volume: 375000,
    ranking_distribution: {
      top_3: 25,
      top_10: 50,
      tracked: 85,
      untracked: 65
    },
    performance_metrics: {
      visibility_score: 68,
      opportunity_score: 72
    }
  }
};

module.exports = {
  keywords,
  dbKeywords,
  rankings,
  bulkKeywords,
  analysisResults,
  filterOptions,
  exportOptions,
  suggestions,
  analytics
};