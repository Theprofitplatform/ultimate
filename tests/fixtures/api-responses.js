/**
 * API Response Fixtures
 * Mock API responses for testing external service integrations
 */

const apiResponses = {
  // Google OAuth responses
  googleOAuth: {
    successfulLogin: {
      access_token: 'mock-google-access-token',
      refresh_token: 'mock-google-refresh-token',
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      token_type: 'Bearer',
      expires_in: 3600
    },

    userProfile: {
      id: '123456789',
      email: 'google-user@example.com',
      verified_email: true,
      name: 'Google Test User',
      given_name: 'Google',
      family_name: 'User',
      picture: 'https://lh3.googleusercontent.com/a-/test-image',
      locale: 'en'
    },

    tokenError: {
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.'
    }
  },

  // SEMrush API responses
  semrush: {
    keywordOverview: {
      keyword: 'digital marketing',
      search_volume: 49500,
      keyword_difficulty: 85,
      cpc: 15.75,
      competition: 0.87,
      number_of_results: 2830000000,
      trend: [
        { month: '202301', search_volume: 45000 },
        { month: '202302', search_volume: 47000 },
        { month: '202303', search_volume: 49500 }
      ]
    },

    keywordSuggestions: {
      total_results: 1250,
      results: [
        {
          keyword: 'digital marketing strategy',
          search_volume: 8100,
          keyword_difficulty: 75,
          cpc: 12.50
        },
        {
          keyword: 'digital marketing agency',
          search_volume: 6600,
          keyword_difficulty: 82,
          cpc: 18.25
        },
        {
          keyword: 'digital marketing course',
          search_volume: 5400,
          keyword_difficulty: 65,
          cpc: 8.75
        }
      ]
    },

    serpResults: {
      keyword: 'seo tools',
      location: 'US',
      results: [
        {
          position: 1,
          type: 'organic',
          title: 'Best SEO Tools for 2024',
          url: 'https://example-seo.com/tools',
          domain: 'example-seo.com',
          snippet: 'Discover the top SEO tools used by professionals...'
        },
        {
          position: 2,
          type: 'organic',
          title: 'Free SEO Tools That Actually Work',
          url: 'https://another-seo.com/free-tools',
          domain: 'another-seo.com',
          snippet: 'Complete list of free SEO tools for keyword research...'
        }
      ],
      serp_features: [
        'featured_snippet',
        'people_also_ask',
        'related_searches'
      ]
    },

    rateLimitError: {
      error: {
        code: 429,
        message: 'Too Many Requests',
        details: 'API rate limit exceeded. Try again in 60 seconds.'
      }
    }
  },

  // Google Search Console responses
  googleSearchConsole: {
    searchAnalytics: {
      rows: [
        {
          keys: ['seo optimization'],
          clicks: 245,
          impressions: 3200,
          ctr: 0.0765625,
          position: 4.2
        },
        {
          keys: ['keyword research'],
          clicks: 189,
          impressions: 2850,
          ctr: 0.0663157,
          position: 5.8
        },
        {
          keys: ['seo tools'],
          clicks: 156,
          impressions: 2100,
          ctr: 0.0742857,
          position: 6.1
        }
      ],
      responseAggregationType: 'byQuery'
    },

    pages: {
      rows: [
        {
          keys: ['https://example.com/seo-guide'],
          clicks: 1250,
          impressions: 15600,
          ctr: 0.0801282,
          position: 3.8
        },
        {
          keys: ['https://example.com/keyword-tools'],
          clicks: 890,
          impressions: 12400,
          ctr: 0.0717741,
          position: 4.5
        }
      ]
    },

    authError: {
      error: {
        code: 401,
        message: 'Request is missing required authentication credential.',
        status: 'UNAUTHENTICATED'
      }
    }
  },

  // Google Analytics responses
  googleAnalytics: {
    realtimeUsers: {
      totals: [{ values: ['42'] }],
      rows: [
        { dimensions: ['United States'], metrics: [{ values: ['28'] }] },
        { dimensions: ['Canada'], metrics: [{ values: ['8'] }] },
        { dimensions: ['United Kingdom'], metrics: [{ values: ['6'] }] }
      ]
    },

    pageviews: {
      reports: [{
        data: {
          rows: [
            {
              dimensions: ['2024-01-01'],
              metrics: [{ values: ['1250', '850'] }]
            },
            {
              dimensions: ['2024-01-02'],
              metrics: [{ values: ['1180', '920'] }]
            }
          ],
          totals: [{ values: ['2430', '1770'] }]
        }
      }]
    },

    topPages: {
      reports: [{
        data: {
          rows: [
            {
              dimensions: ['/blog/seo-optimization-guide'],
              metrics: [{ values: ['5200', '312'] }]
            },
            {
              dimensions: ['/tools/keyword-research'],
              metrics: [{ values: ['3800', '245'] }]
            },
            {
              dimensions: ['/services/seo-audit'],
              metrics: [{ values: ['2100', '156'] }]
            }
          ]
        }
      }]
    }
  },

  // Ahrefs API responses
  ahrefs: {
    keywordData: {
      keywords: [
        {
          keyword: 'content marketing',
          volume: 18100,
          difficulty: 72,
          cpc: 8.50,
          parent_topic: 'digital marketing',
          traffic_potential: 25000
        }
      ]
    },

    backlinks: {
      backlinks: [
        {
          url_from: 'https://authority-site.com/marketing-guide',
          url_to: 'https://example.com/seo-tips',
          anchor: 'seo optimization',
          domain_rating: 78,
          first_seen: '2024-01-15'
        },
        {
          url_from: 'https://blog-site.com/seo-resources',
          url_to: 'https://example.com/keyword-tools',
          anchor: 'keyword research tools',
          domain_rating: 65,
          first_seen: '2024-01-20'
        }
      ],
      stats: {
        backlinks: 1250,
        referring_domains: 180,
        domain_rating: 62
      }
    },

    competitorAnalysis: {
      competitors: [
        {
          domain: 'competitor1.com',
          domain_rating: 85,
          organic_traffic: 125000,
          common_keywords: 245
        },
        {
          domain: 'competitor2.com',
          domain_rating: 78,
          organic_traffic: 98000,
          common_keywords: 189
        }
      ]
    }
  },

  // SERP API responses
  serpApi: {
    googleSearch: {
      search_metadata: {
        id: 'search_id_123',
        status: 'Success',
        created_at: '2024-01-01T12:00:00Z',
        processed_at: '2024-01-01T12:00:02Z',
        google_url: 'https://www.google.com/search?q=seo+tools'
      },
      organic_results: [
        {
          position: 1,
          title: 'Top 10 SEO Tools for 2024',
          link: 'https://seotools.com/best-tools',
          snippet: 'Comprehensive review of the best SEO tools available...',
          rich_snippet: {
            top: {
              extensions: ['Rating: 4.8', '1,250 reviews']
            }
          }
        },
        {
          position: 2,
          title: 'Free SEO Tools - Complete List',
          link: 'https://freetools.com/seo',
          snippet: 'Discover powerful free SEO tools that deliver results...'
        }
      ],
      ads: [
        {
          position: 1,
          block_position: 'top',
          title: 'Professional SEO Software',
          link: 'https://pro-seo.com',
          snippet: 'Advanced SEO tools for agencies and professionals.'
        }
      ],
      related_questions: [
        {
          question: 'What are the best free SEO tools?',
          snippet: 'Some of the best free SEO tools include...',
          link: 'https://example.com/free-seo-tools'
        }
      ]
    },

    bingSearch: {
      organic_results: [
        {
          position: 1,
          title: 'SEO Tools for Small Business',
          url: 'https://smallbiz-seo.com',
          snippet: 'Affordable SEO tools designed for small businesses...'
        }
      ]
    }
  },

  // Webhook and notification responses
  webhooks: {
    slack: {
      success: {
        ok: true,
        ts: '1640995200.000100',
        channel: 'C1234567890',
        message: {
          text: 'Keyword ranking alert: Your keyword moved up 3 positions!'
        }
      },

      error: {
        ok: false,
        error: 'channel_not_found',
        response_metadata: {
          messages: ['The channel does not exist']
        }
      }
    },

    discord: {
      success: {
        id: '123456789012345678',
        type: 0,
        content: 'SEO Alert: New ranking update available',
        channel_id: '987654321098765432',
        timestamp: '2024-01-01T12:00:00Z'
      }
    },

    email: {
      success: {
        messageId: '<test-message-id@example.com>',
        accepted: ['user@example.com'],
        rejected: [],
        pending: [],
        response: '250 2.0.0 OK  1640995200 - gsmtp'
      },

      bounced: {
        messageId: '<bounced-message-id@example.com>',
        accepted: [],
        rejected: ['invalid@example.com'],
        rejectedErrors: [{
          address: 'invalid@example.com',
          error: 'Recipient address rejected: User unknown'
        }]
      }
    }
  },

  // Payment processing responses
  stripe: {
    paymentSuccess: {
      id: 'pi_test_1234567890',
      object: 'payment_intent',
      amount: 2999,
      currency: 'usd',
      status: 'succeeded',
      client_secret: 'pi_test_1234567890_secret',
      created: 1640995200,
      payment_method: 'pm_test_card'
    },

    subscriptionCreated: {
      id: 'sub_test_1234567890',
      object: 'subscription',
      status: 'active',
      customer: 'cus_test_customer',
      current_period_start: 1640995200,
      current_period_end: 1643673600,
      plan: {
        id: 'plan_test_pro',
        nickname: 'Pro Plan',
        amount: 2999
      }
    },

    paymentFailed: {
      error: {
        code: 'card_declined',
        message: 'Your card was declined.',
        payment_intent: {
          id: 'pi_test_failed',
          status: 'requires_payment_method'
        }
      }
    }
  },

  // Error responses for testing
  errors: {
    rateLimited: {
      error: {
        code: 429,
        message: 'Too Many Requests',
        retry_after: 60
      }
    },

    unauthorized: {
      error: {
        code: 401,
        message: 'Unauthorized',
        description: 'Invalid or expired API key'
      }
    },

    serverError: {
      error: {
        code: 500,
        message: 'Internal Server Error',
        description: 'An unexpected error occurred'
      }
    },

    badRequest: {
      error: {
        code: 400,
        message: 'Bad Request',
        description: 'Invalid request parameters'
      }
    },

    notFound: {
      error: {
        code: 404,
        message: 'Not Found',
        description: 'The requested resource was not found'
      }
    }
  }
};

module.exports = apiResponses;