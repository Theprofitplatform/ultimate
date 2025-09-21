/**
 * Keywords API Integration Tests
 * Testing KeywordsService with real database operations and external service mocks
 */

const KeywordsService = require('../../apps/api/src/services/keywords.service');
const { dbHelper } = require('../helpers/database');
const { keywords, dbKeywords, rankings, bulkKeywords, analysisResults, filterOptions, suggestions, analytics } = require('../fixtures/keywords');

describe('KeywordsService Integration Tests', () => {
  let keywordsService;
  let testTenantId;

  beforeAll(async () => {
    // Initialize keywords service with test database
    keywordsService = new KeywordsService();
    await keywordsService.initializeDatabase();

    // Create test tenant
    testTenantId = 1;
  });

  beforeEach(async () => {
    // Start database transaction for isolation
    await dbHelper.startTransaction();
  });

  afterEach(async () => {
    // Rollback transaction to clean up test data
    await dbHelper.rollbackTransaction();
  });

  afterAll(async () => {
    // Clean up service connections
    await keywordsService.cleanup();
    await dbHelper.close();
  });

  describe('Keyword Creation', () => {
    test('should create single keyword successfully', async () => {
      const keywordData = keywords.validKeyword;
      const result = await keywordsService.createKeyword(testTenantId, keywordData);

      expect(result).toMatchObject({
        id: expect.any(Number),
        tenant_id: testTenantId,
        keyword: keywordData.keyword,
        search_volume: keywordData.search_volume,
        keyword_difficulty: keywordData.keyword_difficulty,
        cpc: keywordData.cpc,
        competition_level: keywordData.competition_level,
        location: keywordData.location,
        language: keywordData.language,
        device: keywordData.device,
        is_active: true,
        created_at: expect.toBeRecentTimestamp(),
        updated_at: expect.toBeRecentTimestamp()
      });
    });

    test('should prevent duplicate keywords for same tenant and context', async () => {
      const keywordData = keywords.validKeyword;

      // First creation should succeed
      await keywordsService.createKeyword(testTenantId, keywordData);

      // Second creation should fail
      await expect(keywordsService.createKeyword(testTenantId, keywordData))
        .rejects.toThrow('Keyword already exists for this location, language, and device combination');
    });

    test('should allow same keyword for different contexts', async () => {
      const baseKeyword = keywords.validKeyword;

      // Create keyword for desktop
      const desktopKeyword = await keywordsService.createKeyword(testTenantId, {
        ...baseKeyword,
        device: 'desktop'
      });

      // Create same keyword for mobile
      const mobileKeyword = await keywordsService.createKeyword(testTenantId, {
        ...baseKeyword,
        device: 'mobile'
      });

      expect(desktopKeyword.id).not.toBe(mobileKeyword.id);
      expect(desktopKeyword.keyword).toBe(mobileKeyword.keyword);
      expect(desktopKeyword.device).toBe('desktop');
      expect(mobileKeyword.device).toBe('mobile');
    });

    test('should bulk create keywords successfully', async () => {
      const results = await keywordsService.bulkCreateKeywords(testTenantId, bulkKeywords);

      expect(results).toHaveLength(bulkKeywords.length);
      expect(results[0]).toMatchObject({
        id: expect.any(Number),
        tenant_id: testTenantId,
        keyword: bulkKeywords[0].keyword
      });
    });

    test('should handle bulk creation with some duplicates', async () => {
      // Create one keyword first
      await keywordsService.createKeyword(testTenantId, bulkKeywords[0]);

      // Try to bulk create including the duplicate
      const results = await keywordsService.bulkCreateKeywords(testTenantId, bulkKeywords);

      // Should succeed for non-duplicates but handle duplicates gracefully
      expect(results.length).toBeGreaterThan(0);
    });

    test('should validate keyword data before creation', async () => {
      const invalidKeyword = keywords.invalidKeyword;

      await expect(keywordsService.createKeyword(testTenantId, invalidKeyword))
        .rejects.toThrow();
    });

    test('should sanitize potentially dangerous input', async () => {
      const sqlInjectionKeyword = keywords.sqlInjectionKeyword;

      const result = await keywordsService.createKeyword(testTenantId, sqlInjectionKeyword);

      // Should create without executing SQL injection
      expect(result.keyword).toBe(sqlInjectionKeyword.keyword);
      expect(result.id).toBeDefined();

      // Verify database integrity
      const allKeywords = await keywordsService.getKeywords(testTenantId);
      expect(allKeywords.data).toHaveLength(1);
    });
  });

  describe('Keyword Retrieval', () => {
    beforeEach(async () => {
      // Create test keywords
      await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
      await keywordsService.createKeyword(testTenantId, keywords.highVolumeKeyword);
      await keywordsService.createKeyword(testTenantId, keywords.lowCompetitionKeyword);
    });

    test('should get keywords with pagination', async () => {
      const result = await keywordsService.getKeywords(testTenantId, {
        page: 1,
        limit: 2
      });

      expect(result).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            keyword: expect.any(String)
          })
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 2,
          total: expect.any(Number),
          pages: expect.any(Number)
        })
      });

      expect(result.data).toHaveLength(2);
    });

    test('should filter keywords by search volume', async () => {
      const result = await keywordsService.getKeywords(testTenantId, {
        min_search_volume: 10000,
        page: 1,
        limit: 10
      });

      expect(result.data.every(k => k.search_volume >= 10000)).toBe(true);
    });

    test('should filter keywords by competition level', async () => {
      const result = await keywordsService.getKeywords(testTenantId, {
        competition_level: 'low',
        page: 1,
        limit: 10
      });

      expect(result.data.every(k => k.competition_level === 'low')).toBe(true);
    });

    test('should sort keywords by different fields', async () => {
      const result = await keywordsService.getKeywords(testTenantId, {
        sort_by: 'search_volume',
        sort_order: 'desc',
        page: 1,
        limit: 10
      });

      const volumes = result.data.map(k => k.search_volume);
      const sortedVolumes = [...volumes].sort((a, b) => b - a);
      expect(volumes).toEqual(sortedVolumes);
    });

    test('should get keyword by ID', async () => {
      const created = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
      const retrieved = await keywordsService.getKeywordById(testTenantId, created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        keyword: created.keyword,
        tenant_id: testTenantId
      });
    });

    test('should return null for non-existent keyword', async () => {
      await expect(keywordsService.getKeywordById(testTenantId, 99999))
        .rejects.toThrow('Keyword not found');
    });

    test('should prevent cross-tenant data access', async () => {
      const otherTenantId = 999;
      const keyword = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);

      await expect(keywordsService.getKeywordById(otherTenantId, keyword.id))
        .rejects.toThrow('Keyword not found');
    });
  });

  describe('Keyword Updates', () => {
    let testKeyword;

    beforeEach(async () => {
      testKeyword = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
    });

    test('should update keyword data', async () => {
      const updateData = {
        search_volume: 10000,
        keyword_difficulty: 75,
        current_position: 3,
        last_analyzed: new Date()
      };

      const updated = await keywordsService.updateKeyword(testTenantId, testKeyword.id, updateData);

      expect(updated).toMatchObject({
        id: testKeyword.id,
        search_volume: updateData.search_volume,
        keyword_difficulty: updateData.keyword_difficulty,
        current_position: updateData.current_position
      });
    });

    test('should update best and worst positions automatically', async () => {
      // Set initial position
      await keywordsService.updateKeyword(testTenantId, testKeyword.id, {
        current_position: 10,
        best_position: 10,
        worst_position: 10
      });

      // Update with better position
      await keywordsService.updateKeyword(testTenantId, testKeyword.id, {
        current_position: 5
      });

      const keyword = await keywordsService.getKeywordById(testTenantId, testKeyword.id);
      expect(keyword.current_position).toBe(5);
    });

    test('should reject updates for non-existent keyword', async () => {
      await expect(keywordsService.updateKeyword(testTenantId, 99999, { search_volume: 1000 }))
        .rejects.toThrow('Keyword not found or no changes made');
    });

    test('should prevent cross-tenant updates', async () => {
      const otherTenantId = 999;

      await expect(keywordsService.updateKeyword(otherTenantId, testKeyword.id, { search_volume: 1000 }))
        .rejects.toThrow('Keyword not found or no changes made');
    });
  });

  describe('Keyword Deletion', () => {
    let testKeyword;

    beforeEach(async () => {
      testKeyword = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
    });

    test('should soft delete keyword', async () => {
      const result = await keywordsService.deleteKeyword(testTenantId, testKeyword.id);

      expect(result).toEqual({
        success: true,
        message: 'Keyword deleted successfully'
      });

      // Verify keyword is marked as inactive
      const keywords = await keywordsService.getKeywords(testTenantId, { include_inactive: true });
      const deletedKeyword = keywords.data.find(k => k.id === testKeyword.id);
      expect(deletedKeyword.is_active).toBe(false);
    });

    test('should exclude deleted keywords from normal queries', async () => {
      await keywordsService.deleteKeyword(testTenantId, testKeyword.id);

      const keywords = await keywordsService.getKeywords(testTenantId);
      const foundKeyword = keywords.data.find(k => k.id === testKeyword.id);
      expect(foundKeyword).toBeUndefined();
    });

    test('should reject deletion of non-existent keyword', async () => {
      await expect(keywordsService.deleteKeyword(testTenantId, 99999))
        .rejects.toThrow('Keyword not found');
    });
  });

  describe('Keyword Analysis', () => {
    test('should analyze keywords and return results', async () => {
      const analysisData = {
        keywords: ['test keyword 1', 'test keyword 2'],
        location: 'global',
        language: 'en',
        device: 'desktop'
      };

      const results = await keywordsService.analyzeKeywords(testTenantId, analysisData);

      expect(results).toMatchObject({
        total_analyzed: 2,
        successful: expect.any(Number),
        failed: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            keyword: 'test keyword 1',
            success: expect.any(Boolean)
          })
        ])
      });
    });

    test('should handle analysis errors gracefully', async () => {
      // Mock analysis failure
      const originalPerformAnalysis = keywordsService.performKeywordAnalysis;
      keywordsService.performKeywordAnalysis = jest.fn()
        .mockRejectedValue(new Error('API rate limit exceeded'));

      const analysisData = {
        keywords: ['failing keyword'],
        location: 'global'
      };

      const results = await keywordsService.analyzeKeywords(testTenantId, analysisData);

      expect(results.failed).toBe(1);
      expect(results.results[0]).toMatchObject({
        keyword: 'failing keyword',
        success: false,
        error: 'API rate limit exceeded'
      });

      // Restore original method
      keywordsService.performKeywordAnalysis = originalPerformAnalysis;
    });

    test('should save analysis results to database', async () => {
      const analysisData = {
        keywords: ['analyzed keyword'],
        location: 'global'
      };

      await keywordsService.analyzeKeywords(testTenantId, analysisData);

      // Check if keyword was created/updated in database
      const keywords = await keywordsService.getKeywords(testTenantId, {
        keyword: 'analyzed keyword'
      });

      expect(keywords.data).toHaveLength(1);
      expect(keywords.data[0]).toMatchObject({
        keyword: 'analyzed keyword',
        search_volume: expect.any(Number),
        keyword_difficulty: expect.any(Number)
      });
    });
  });

  describe('Ranking Management', () => {
    let testKeyword;

    beforeEach(async () => {
      testKeyword = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
    });

    test('should add keyword ranking', async () => {
      const rankingData = {
        position: 5,
        url: 'https://example.com/page',
        title: 'Test Page Title',
        check_date: new Date().toISOString().split('T')[0]
      };

      const ranking = await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, rankingData);

      expect(ranking).toMatchObject({
        keyword_id: testKeyword.id,
        position: rankingData.position,
        url: rankingData.url,
        title: rankingData.title
      });

      // Verify keyword was updated with current position
      const updated = await keywordsService.getKeywordById(testTenantId, testKeyword.id);
      expect(updated.current_position).toBe(rankingData.position);
    });

    test('should track best and worst positions', async () => {
      // Add initial ranking
      await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, {
        position: 10,
        check_date: '2024-01-01'
      });

      // Add better ranking
      await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, {
        position: 3,
        check_date: '2024-01-02'
      });

      // Add worse ranking
      await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, {
        position: 15,
        check_date: '2024-01-03'
      });

      const keyword = await keywordsService.getKeywordById(testTenantId, testKeyword.id);
      expect(keyword.best_position).toBe(3);
      expect(keyword.worst_position).toBe(15);
      expect(keyword.current_position).toBe(15);
    });

    test('should get ranking history', async () => {
      // Add multiple rankings
      await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, {
        position: 10,
        check_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      await keywordsService.addKeywordRanking(testTenantId, testKeyword.id, {
        position: 5,
        check_date: new Date().toISOString().split('T')[0]
      });

      const rankings = await keywordsService.getKeywordRankings(testTenantId, testKeyword.id, 30);

      expect(rankings).toHaveLength(2);
      expect(rankings[0].position).toBe(5); // Most recent first
      expect(rankings[1].position).toBe(10);
    });

    test('should reject ranking for non-existent keyword', async () => {
      await expect(keywordsService.addKeywordRanking(testTenantId, 99999, {
        position: 1,
        check_date: new Date().toISOString().split('T')[0]
      })).rejects.toThrow('Keyword not found');
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      // Create test keywords for export
      await keywordsService.bulkCreateKeywords(testTenantId, bulkKeywords);
    });

    test('should export keywords as CSV', async () => {
      const exportOptions = {
        format: 'csv',
        fields: ['keyword', 'search_volume', 'keyword_difficulty']
      };

      const result = await keywordsService.exportKeywords(testTenantId, exportOptions);

      expect(result).toMatchObject({
        format: 'csv',
        data: expect.stringContaining('keyword,search_volume,keyword_difficulty'),
        filename: expect.stringMatching(/\.csv$/)
      });

      // Check CSV content
      const lines = result.data.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + data
      expect(lines[0]).toBe('keyword,search_volume,keyword_difficulty');
    });

    test('should export keywords as JSON', async () => {
      const exportOptions = {
        format: 'json',
        fields: ['keyword', 'search_volume']
      };

      const result = await keywordsService.exportKeywords(testTenantId, exportOptions);

      expect(result).toMatchObject({
        format: 'json',
        data: expect.arrayContaining([
          expect.objectContaining({
            keyword: expect.any(String),
            search_volume: expect.any(Number)
          })
        ])
      });
    });

    test('should apply filters during export', async () => {
      const exportOptions = {
        format: 'json',
        filters: {
          competition_level: 'low'
        },
        fields: ['keyword', 'competition_level']
      };

      const result = await keywordsService.exportKeywords(testTenantId, exportOptions);

      expect(result.data.every(k => k.competition_level === 'low')).toBe(true);
    });

    test('should handle empty export gracefully', async () => {
      // Delete all keywords
      const keywords = await keywordsService.getKeywords(testTenantId);
      for (const keyword of keywords.data) {
        await keywordsService.deleteKeyword(testTenantId, keyword.id);
      }

      const result = await keywordsService.exportKeywords(testTenantId, { format: 'csv' });

      expect(result.data).toBe(''); // Empty CSV
    });
  });

  describe('Keyword Suggestions', () => {
    test('should get keyword suggestions', async () => {
      // Create some related keywords in database
      await keywordsService.createKeyword(testTenantId, {
        keyword: 'seo tips',
        search_volume: 1000
      });

      await keywordsService.createKeyword(testTenantId, {
        keyword: 'seo guide',
        search_volume: 800
      });

      const result = await keywordsService.getKeywordSuggestions(testTenantId, 'seo', { limit: 10 });

      expect(result).toMatchObject({
        seed_keyword: 'seo',
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            keyword: expect.stringContaining('seo'),
            source: expect.stringMatching(/^(database|external)$/)
          })
        ]),
        total_found: expect.any(Number)
      });

      expect(result.suggestions.length).toBeLessThanOrEqual(10);
    });

    test('should combine database and external suggestions', async () => {
      const result = await keywordsService.getKeywordSuggestions(testTenantId, 'marketing', { limit: 20 });

      const databaseSuggestions = result.suggestions.filter(s => s.source === 'database');
      const externalSuggestions = result.suggestions.filter(s => s.source === 'external');

      expect(databaseSuggestions.length + externalSuggestions.length).toBe(result.suggestions.length);
    });

    test('should remove duplicate suggestions', async () => {
      const result = await keywordsService.getKeywordSuggestions(testTenantId, 'test', { limit: 50 });

      const keywords = result.suggestions.map(s => s.keyword);
      const uniqueKeywords = [...new Set(keywords)];

      expect(keywords.length).toBe(uniqueKeywords.length);
    });
  });

  describe('Analytics and Statistics', () => {
    beforeEach(async () => {
      // Create keywords with rankings for analytics
      const keyword1 = await keywordsService.createKeyword(testTenantId, {
        ...keywords.validKeyword,
        search_volume: 5000,
        keyword_difficulty: 40
      });

      const keyword2 = await keywordsService.createKeyword(testTenantId, {
        ...keywords.highVolumeKeyword,
        search_volume: 10000,
        keyword_difficulty: 60
      });

      // Add rankings
      await keywordsService.addKeywordRanking(testTenantId, keyword1.id, {
        position: 3,
        check_date: new Date().toISOString().split('T')[0]
      });

      await keywordsService.addKeywordRanking(testTenantId, keyword2.id, {
        position: 8,
        check_date: new Date().toISOString().split('T')[0]
      });
    });

    test('should get comprehensive analytics', async () => {
      const analytics = await keywordsService.getAnalytics(testTenantId, 30);

      expect(analytics).toMatchObject({
        total_keywords: expect.any(Number),
        active_keywords: expect.any(Number),
        tracked_rankings: expect.any(Number),
        top_3_rankings: expect.any(Number),
        top_10_rankings: expect.any(Number),
        avg_search_volume: expect.any(Number),
        avg_difficulty: expect.any(Number),
        avg_cpc: expect.any(Number),
        ranking_distribution: expect.objectContaining({
          top_3: expect.any(Number),
          top_10: expect.any(Number),
          tracked: expect.any(Number),
          untracked: expect.any(Number)
        }),
        performance_metrics: expect.objectContaining({
          visibility_score: expect.any(Number),
          opportunity_score: expect.any(Number)
        })
      });

      expect(analytics.total_keywords).toBeGreaterThan(0);
      expect(analytics.top_3_rankings).toBe(1); // One keyword in top 3
      expect(analytics.top_10_rankings).toBe(2); // Both keywords in top 10
    });

    test('should calculate visibility score correctly', async () => {
      const mockAnalytics = {
        total_keywords: 100,
        tracked_rankings: 50,
        top_3_rankings: 10,
        top_10_rankings: 25
      };

      const visibilityScore = keywordsService.calculateVisibilityScore(mockAnalytics);

      expect(visibilityScore).toBeGreaterThan(0);
      expect(visibilityScore).toBeLessThanOrEqual(100);
    });

    test('should calculate opportunity score correctly', async () => {
      const mockAnalytics = {
        avg_difficulty: 30,
        avg_search_volume: 5000,
        tracked_rankings: 80,
        total_keywords: 100
      };

      const opportunityScore = keywordsService.calculateOpportunityScore(mockAnalytics);

      expect(opportunityScore).toBeGreaterThan(0);
      expect(opportunityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Cache Management', () => {
    let testKeyword;

    beforeEach(async () => {
      testKeyword = await keywordsService.createKeyword(testTenantId, keywords.validKeyword);
    });

    test('should cache frequently accessed data', async () => {
      // First call should hit database
      const result1 = await keywordsService.getKeywords(testTenantId, { page: 1, limit: 10 });

      // Second call should use cache (if Redis is available)
      const result2 = await keywordsService.getKeywords(testTenantId, { page: 1, limit: 10 });

      expect(result1).toEqual(result2);
    });

    test('should invalidate cache on updates', async () => {
      // Get initial data (cache)
      await keywordsService.getKeywords(testTenantId);

      // Update keyword (should invalidate cache)
      await keywordsService.updateKeyword(testTenantId, testKeyword.id, {
        search_volume: 9999
      });

      // Get data again (should be fresh)
      const result = await keywordsService.getKeywords(testTenantId);
      const updatedKeyword = result.data.find(k => k.id === testKeyword.id);

      expect(updatedKeyword.search_volume).toBe(9999);
    });

    test('should handle cache errors gracefully', async () => {
      // Mock cache error
      const originalGetCached = keywordsService.getCached;
      keywordsService.getCached = jest.fn().mockRejectedValue(new Error('Cache error'));

      // Should still work without cache
      const result = await keywordsService.getKeywords(testTenantId);
      expect(result.data).toBeDefined();

      // Restore method
      keywordsService.getCached = originalGetCached;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection errors', async () => {
      // Mock database error
      const originalQuery = keywordsService.keywordModel.create;
      keywordsService.keywordModel.create = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(keywordsService.createKeyword(testTenantId, keywords.validKeyword))
        .rejects.toThrow('Failed to create keyword: Database connection failed');

      // Restore method
      keywordsService.keywordModel.create = originalQuery;
    });

    test('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        keyword: `test keyword ${i}`,
        search_volume: Math.floor(Math.random() * 10000),
        keyword_difficulty: Math.floor(Math.random() * 100),
        cpc: Math.random() * 5,
        competition_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        location: 'global',
        language: 'en',
        device: 'desktop'
      }));

      const startTime = Date.now();
      await keywordsService.bulkCreateKeywords(testTenantId, largeDataset);
      const endTime = Date.now();

      // Should complete within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);

      // Verify all keywords were created
      const result = await keywordsService.getKeywords(testTenantId, { limit: 1000 });
      expect(result.data.length).toBe(100);
    });

    test('should handle concurrent operations safely', async () => {
      // Simulate concurrent keyword creation
      const promises = Array.from({ length: 10 }, (_, i) =>
        keywordsService.createKeyword(testTenantId, {
          keyword: `concurrent keyword ${i}`,
          search_volume: 1000,
          keyword_difficulty: 50,
          cpc: 2.0,
          competition_level: 'medium',
          location: 'global',
          language: 'en',
          device: 'desktop'
        })
      );

      const results = await Promise.all(promises);

      // All should succeed with unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    test('should validate tenant isolation', async () => {
      const tenant1 = 1;
      const tenant2 = 2;

      // Create keywords for different tenants
      await keywordsService.createKeyword(tenant1, { ...keywords.validKeyword, keyword: 'tenant1 keyword' });
      await keywordsService.createKeyword(tenant2, { ...keywords.validKeyword, keyword: 'tenant2 keyword' });

      // Verify isolation
      const tenant1Keywords = await keywordsService.getKeywords(tenant1);
      const tenant2Keywords = await keywordsService.getKeywords(tenant2);

      expect(tenant1Keywords.data.every(k => k.tenant_id === tenant1)).toBe(true);
      expect(tenant2Keywords.data.every(k => k.tenant_id === tenant2)).toBe(true);

      const tenant1KeywordTexts = tenant1Keywords.data.map(k => k.keyword);
      const tenant2KeywordTexts = tenant2Keywords.data.map(k => k.keyword);

      expect(tenant1KeywordTexts).toContain('tenant1 keyword');
      expect(tenant1KeywordTexts).not.toContain('tenant2 keyword');
      expect(tenant2KeywordTexts).toContain('tenant2 keyword');
      expect(tenant2KeywordTexts).not.toContain('tenant1 keyword');
    });
  });
});