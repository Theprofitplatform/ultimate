const { Pool } = require('pg');

class KeywordModel {
  constructor(pool) {
    this.pool = pool;
    this.table = 'keywords';
  }

  // Initialize database tables
  async initializeTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        search_volume INTEGER DEFAULT 0,
        keyword_difficulty INTEGER DEFAULT 0,
        cpc DECIMAL(10,2) DEFAULT 0.00,
        competition_level VARCHAR(20) DEFAULT 'unknown',
        trend_data JSONB DEFAULT '{}',
        related_keywords TEXT[] DEFAULT '{}',
        serp_features TEXT[] DEFAULT '{}',
        location VARCHAR(100) DEFAULT 'global',
        language VARCHAR(10) DEFAULT 'en',
        device VARCHAR(20) DEFAULT 'desktop',

        -- Ranking data
        current_position INTEGER DEFAULT NULL,
        best_position INTEGER DEFAULT NULL,
        worst_position INTEGER DEFAULT NULL,

        -- Analysis metadata
        last_analyzed TIMESTAMP DEFAULT NULL,
        analysis_status VARCHAR(20) DEFAULT 'pending',

        -- Soft delete
        is_deleted BOOLEAN DEFAULT FALSE,

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Indexes for performance
        UNIQUE(tenant_id, keyword, location, language, device)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_keywords_tenant_id ON ${this.table}(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON ${this.table}(keyword);
      CREATE INDEX IF NOT EXISTS idx_keywords_search_volume ON ${this.table}(search_volume);
      CREATE INDEX IF NOT EXISTS idx_keywords_difficulty ON ${this.table}(keyword_difficulty);
      CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON ${this.table}(created_at);
      CREATE INDEX IF NOT EXISTS idx_keywords_is_deleted ON ${this.table}(is_deleted);

      -- Create keyword rankings history table
      CREATE TABLE IF NOT EXISTS keyword_rankings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keyword_id UUID NOT NULL REFERENCES ${this.table}(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        url VARCHAR(500),
        page_title TEXT,
        meta_description TEXT,
        featured_snippet BOOLEAN DEFAULT FALSE,
        check_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(keyword_id, check_date)
      );

      CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword_id ON keyword_rankings(keyword_id);
      CREATE INDEX IF NOT EXISTS idx_keyword_rankings_position ON keyword_rankings(position);
      CREATE INDEX IF NOT EXISTS idx_keyword_rankings_check_date ON keyword_rankings(check_date);

      -- Create trigger for updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_keywords_updated_at ON ${this.table};
      CREATE TRIGGER update_keywords_updated_at
        BEFORE UPDATE ON ${this.table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await this.pool.query(createTableQuery);
  }

  // Create a new keyword
  async create(keywordData) {
    const {
      tenant_id,
      keyword,
      search_volume = 0,
      keyword_difficulty = 0,
      cpc = 0.00,
      competition_level = 'unknown',
      trend_data = {},
      related_keywords = [],
      serp_features = [],
      location = 'global',
      language = 'en',
      device = 'desktop'
    } = keywordData;

    const query = `
      INSERT INTO ${this.table} (
        tenant_id, keyword, search_volume, keyword_difficulty, cpc,
        competition_level, trend_data, related_keywords, serp_features,
        location, language, device
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      tenant_id, keyword, search_volume, keyword_difficulty, cpc,
      competition_level, JSON.stringify(trend_data), related_keywords,
      serp_features, location, language, device
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Bulk create keywords
  async bulkCreate(keywordsData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const keywordData of keywordsData) {
        try {
          const result = await this.create(keywordData);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            keyword: keywordData.keyword
          });
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Find keywords with pagination and filtering
  async findMany(options = {}) {
    const {
      tenant_id,
      keyword,
      search_volume_min,
      search_volume_max,
      difficulty_min,
      difficulty_max,
      competition_level,
      location,
      language,
      device,
      sort_by = 'created_at',
      sort_order = 'DESC',
      page = 1,
      limit = 20,
      include_deleted = false
    } = options;

    let whereConditions = ['tenant_id = $1'];
    let queryParams = [tenant_id];
    let paramIndex = 2;

    if (!include_deleted) {
      whereConditions.push('is_deleted = FALSE');
    }

    if (keyword) {
      whereConditions.push(`keyword ILIKE $${paramIndex}`);
      queryParams.push(`%${keyword}%`);
      paramIndex++;
    }

    if (search_volume_min !== undefined) {
      whereConditions.push(`search_volume >= $${paramIndex}`);
      queryParams.push(search_volume_min);
      paramIndex++;
    }

    if (search_volume_max !== undefined) {
      whereConditions.push(`search_volume <= $${paramIndex}`);
      queryParams.push(search_volume_max);
      paramIndex++;
    }

    if (difficulty_min !== undefined) {
      whereConditions.push(`keyword_difficulty >= $${paramIndex}`);
      queryParams.push(difficulty_min);
      paramIndex++;
    }

    if (difficulty_max !== undefined) {
      whereConditions.push(`keyword_difficulty <= $${paramIndex}`);
      queryParams.push(difficulty_max);
      paramIndex++;
    }

    if (competition_level) {
      whereConditions.push(`competition_level = $${paramIndex}`);
      queryParams.push(competition_level);
      paramIndex++;
    }

    if (location) {
      whereConditions.push(`location = $${paramIndex}`);
      queryParams.push(location);
      paramIndex++;
    }

    if (language) {
      whereConditions.push(`language = $${paramIndex}`);
      queryParams.push(language);
      paramIndex++;
    }

    if (device) {
      whereConditions.push(`device = $${paramIndex}`);
      queryParams.push(device);
      paramIndex++;
    }

    const offset = (page - 1) * limit;

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.table}
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countResult = await this.pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM ${this.table}
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, queryParams);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  // Find a single keyword by ID
  async findById(id, tenant_id) {
    const query = `
      SELECT * FROM ${this.table}
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE
    `;
    const result = await this.pool.query(query, [id, tenant_id]);
    return result.rows[0];
  }

  // Update a keyword
  async update(id, tenant_id, updateData) {
    const allowedFields = [
      'keyword', 'search_volume', 'keyword_difficulty', 'cpc',
      'competition_level', 'trend_data', 'related_keywords', 'serp_features',
      'location', 'language', 'device', 'current_position', 'best_position',
      'worst_position', 'last_analyzed', 'analysis_status'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = $${paramIndex}`);

        // Handle JSON fields
        if (['trend_data'].includes(key)) {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id, tenant_id);

    const query = `
      UPDATE ${this.table}
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Soft delete a keyword
  async softDelete(id, tenant_id) {
    const query = `
      UPDATE ${this.table}
      SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE
      RETURNING id
    `;
    const result = await this.pool.query(query, [id, tenant_id]);
    return result.rows[0];
  }

  // Add ranking data
  async addRanking(keywordId, rankingData) {
    const {
      position,
      url,
      page_title,
      meta_description,
      featured_snippet = false,
      check_date
    } = rankingData;

    const query = `
      INSERT INTO keyword_rankings (
        keyword_id, position, url, page_title, meta_description,
        featured_snippet, check_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (keyword_id, check_date)
      DO UPDATE SET
        position = EXCLUDED.position,
        url = EXCLUDED.url,
        page_title = EXCLUDED.page_title,
        meta_description = EXCLUDED.meta_description,
        featured_snippet = EXCLUDED.featured_snippet
      RETURNING *
    `;

    const values = [
      keywordId, position, url, page_title, meta_description,
      featured_snippet, check_date
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Get ranking history for a keyword
  async getRankingHistory(keywordId, tenant_id, days = 30) {
    const query = `
      SELECT kr.*
      FROM keyword_rankings kr
      JOIN ${this.table} k ON kr.keyword_id = k.id
      WHERE k.id = $1 AND k.tenant_id = $2 AND k.is_deleted = FALSE
      AND kr.check_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY kr.check_date DESC
    `;

    const result = await this.pool.query(query, [keywordId, tenant_id]);
    return result.rows;
  }

  // Get keyword suggestions based on seed keywords
  async getKeywordSuggestions(seedKeyword, tenant_id, limit = 50) {
    // This would typically integrate with external APIs like Google Keyword Planner
    // For now, we'll provide a basic implementation using related keywords
    const query = `
      SELECT DISTINCT unnest(related_keywords) as suggestion,
             COUNT(*) as frequency
      FROM ${this.table}
      WHERE tenant_id = $1
      AND is_deleted = FALSE
      AND (keyword ILIKE $2 OR $3 = ANY(related_keywords))
      GROUP BY suggestion
      ORDER BY frequency DESC, suggestion
      LIMIT $4
    `;

    const result = await this.pool.query(query, [
      tenant_id,
      `%${seedKeyword}%`,
      seedKeyword,
      limit
    ]);

    return result.rows;
  }

  // Get analytics/statistics
  async getAnalytics(tenant_id, dateRange = 30) {
    const query = `
      SELECT
        COUNT(*) as total_keywords,
        AVG(search_volume) as avg_search_volume,
        AVG(keyword_difficulty) as avg_difficulty,
        AVG(cpc) as avg_cpc,
        COUNT(CASE WHEN current_position IS NOT NULL THEN 1 END) as tracked_rankings,
        COUNT(CASE WHEN current_position <= 10 THEN 1 END) as top_10_rankings,
        COUNT(CASE WHEN current_position <= 3 THEN 1 END) as top_3_rankings
      FROM ${this.table}
      WHERE tenant_id = $1
      AND is_deleted = FALSE
      AND created_at >= CURRENT_DATE - INTERVAL '${dateRange} days'
    `;

    const result = await this.pool.query(query, [tenant_id]);
    return result.rows[0];
  }
}

module.exports = KeywordModel;