/**
 * External API Mocks
 * Mock implementations for external services used in testing
 */

// Mock Google OAuth
const mockGoogleOAuth = {
  OAuth2: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue({
      token: 'mock-google-token'
    }),
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        email: 'google-user@example.com',
        name: 'Google User',
        picture: 'https://example.com/avatar.jpg'
      })
    })
  }))
};

// Mock Redis client
const mockRedis = {
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    off: jest.fn()
  })
};

// Mock nodemailer
const mockNodemailer = {
  createTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      accepted: ['recipient@example.com'],
      rejected: []
    }),
    verify: jest.fn().mockResolvedValue(true)
  })
};

// Mock keyword research APIs (SEMrush, Ahrefs, etc.)
const mockKeywordAPI = {
  // Mock SEMrush API response
  semrush: {
    getKeywordData: jest.fn().mockResolvedValue({
      keyword: 'test keyword',
      search_volume: 5000,
      keyword_difficulty: 45,
      cpc: 2.50,
      competition: 'medium',
      trend: [100, 110, 105, 120, 115, 130, 125, 140, 135, 150, 145, 160]
    }),

    getKeywordSuggestions: jest.fn().mockResolvedValue([
      'test keyword tips',
      'test keyword guide',
      'best test keyword',
      'test keyword 2024'
    ]),

    getSerpData: jest.fn().mockResolvedValue({
      organic_results: [
        {
          position: 1,
          url: 'https://example1.com',
          title: 'Best Test Keyword Guide',
          domain: 'example1.com'
        },
        {
          position: 2,
          url: 'https://example2.com',
          title: 'Test Keyword Tips and Tricks',
          domain: 'example2.com'
        }
      ],
      paid_results: [
        {
          position: 1,
          url: 'https://ads-example.com',
          title: 'Test Keyword - Premium Service'
        }
      ],
      serp_features: ['featured_snippet', 'people_also_ask']
    })
  },

  // Mock Ahrefs API response
  ahrefs: {
    getKeywordData: jest.fn().mockResolvedValue({
      keyword: 'test keyword',
      search_volume: 4800,
      keyword_difficulty: 48,
      cpc: 2.75,
      clicks: 3200,
      parent_topic: 'keyword research'
    }),

    getBacklinkData: jest.fn().mockResolvedValue({
      referring_domains: 150,
      backlinks: 1250,
      domain_rating: 65
    })
  },

  // Mock Google Keyword Planner API
  googleKeywordPlanner: {
    getKeywordIdeas: jest.fn().mockResolvedValue({
      results: [
        {
          text: 'test keyword',
          search_volume: 5200,
          competition: 'MEDIUM',
          high_top_of_page_bid: 3.20,
          low_top_of_page_bid: 1.80
        }
      ]
    }),

    getSearchVolumeData: jest.fn().mockResolvedValue({
      monthly_search_volumes: [
        { month: 'JANUARY', year: 2024, monthly_searches: 4800 },
        { month: 'FEBRUARY', year: 2024, monthly_searches: 5200 },
        { month: 'MARCH', year: 2024, monthly_searches: 5600 }
      ]
    })
  }
};

// Mock Analytics APIs
const mockAnalyticsAPI = {
  googleAnalytics: {
    getPageViews: jest.fn().mockResolvedValue({
      rows: [
        ['2024-01-01', '1000'],
        ['2024-01-02', '1100'],
        ['2024-01-03', '950']
      ]
    }),

    getTopPages: jest.fn().mockResolvedValue({
      rows: [
        ['/blog/seo-tips', '5000'],
        ['/services/seo', '3200'],
        ['/about', '1800']
      ]
    })
  },

  googleSearchConsole: {
    getSearchAnalytics: jest.fn().mockResolvedValue({
      rows: [
        {
          keys: ['test keyword'],
          clicks: 150,
          impressions: 2000,
          ctr: 0.075,
          position: 5.2
        }
      ]
    }),

    getTopQueries: jest.fn().mockResolvedValue({
      rows: [
        { query: 'seo optimization', clicks: 300, impressions: 4000 },
        { query: 'keyword research', clicks: 250, impressions: 3500 }
      ]
    })
  }
};

// Mock SERP tracking APIs
const mockSerpAPI = {
  serpstack: {
    getSearchResults: jest.fn().mockResolvedValue({
      organic_results: [
        {
          position: 1,
          title: 'Best SEO Guide 2024',
          link: 'https://example.com/seo-guide',
          snippet: 'Complete guide to SEO optimization...'
        }
      ],
      ads: [
        {
          position: 1,
          title: 'Professional SEO Services',
          link: 'https://seo-agency.com'
        }
      ]
    })
  },

  brightdata: {
    scrapeSerp: jest.fn().mockResolvedValue({
      results: [
        {
          rank: 1,
          url: 'https://top-result.com',
          title: 'Top Result for Test Keyword'
        }
      ]
    })
  }
};

// Mock social media APIs
const mockSocialAPI = {
  twitter: {
    getTrends: jest.fn().mockResolvedValue([
      { name: '#SEO', volume: 50000 },
      { name: '#DigitalMarketing', volume: 35000 }
    ])
  },

  facebook: {
    getAudienceInsights: jest.fn().mockResolvedValue({
      audience_size: 1000000,
      demographics: {
        age: { '25-34': 0.4, '35-44': 0.3, '45-54': 0.2 }
      }
    })
  }
};

// Mock file storage APIs
const mockStorageAPI = {
  aws: {
    s3: {
      upload: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.csv',
        Bucket: 'test-bucket',
        Key: 'test-file.csv'
      }),

      getSignedUrl: jest.fn().mockReturnValue(
        'https://test-bucket.s3.amazonaws.com/signed-url'
      )
    }
  },

  googleCloud: {
    storage: {
      upload: jest.fn().mockResolvedValue([{
        name: 'test-file.csv',
        bucket: 'test-bucket'
      }])
    }
  }
};

// Mock webhook and notification services
const mockWebhookAPI = {
  slack: {
    sendMessage: jest.fn().mockResolvedValue({
      ok: true,
      ts: '1234567890.123456'
    })
  },

  discord: {
    sendWebhook: jest.fn().mockResolvedValue({
      id: 'webhook-message-id'
    })
  },

  zapier: {
    triggerZap: jest.fn().mockResolvedValue({
      status: 'success',
      request_id: 'zap-request-123'
    })
  }
};

// Mock payment processing
const mockPaymentAPI = {
  stripe: {
    charges: {
      create: jest.fn().mockResolvedValue({
        id: 'ch_test_123456',
        amount: 2500,
        currency: 'usd',
        status: 'succeeded'
      })
    },

    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_test_123456',
        status: 'active',
        current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000
      })
    }
  },

  paypal: {
    payment: {
      create: jest.fn().mockResolvedValue({
        id: 'PAY-123456789',
        state: 'approved'
      })
    }
  }
};

// Export all mocks
module.exports = {
  mockGoogleOAuth,
  mockRedis,
  mockNodemailer,
  mockKeywordAPI,
  mockAnalyticsAPI,
  mockSerpAPI,
  mockSocialAPI,
  mockStorageAPI,
  mockWebhookAPI,
  mockPaymentAPI,

  // Helper function to setup all mocks
  setupAllMocks: () => {
    // Mock external dependencies
    jest.mock('googleapis', () => ({
      google: {
        auth: {
          OAuth2: mockGoogleOAuth.OAuth2
        }
      }
    }));

    jest.mock('ioredis', () => mockRedis.createClient);
    jest.mock('nodemailer', () => mockNodemailer);

    // Mock process.env for tests
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'test-password';
  },

  // Helper to reset all mocks
  resetAllMocks: () => {
    jest.clearAllMocks();

    // Reset specific mocks that need it
    Object.values(mockKeywordAPI).forEach(api => {
      Object.values(api).forEach(method => {
        if (typeof method.mockReset === 'function') {
          method.mockReset();
        }
      });
    });
  },

  // Helper to create custom mock responses
  createMockResponse: (service, method, response) => {
    if (mockKeywordAPI[service] && mockKeywordAPI[service][method]) {
      mockKeywordAPI[service][method].mockResolvedValue(response);
    }
  },

  // Helper to simulate API errors
  simulateAPIError: (service, method, error = new Error('API Error')) => {
    if (mockKeywordAPI[service] && mockKeywordAPI[service][method]) {
      mockKeywordAPI[service][method].mockRejectedValue(error);
    }
  }
};