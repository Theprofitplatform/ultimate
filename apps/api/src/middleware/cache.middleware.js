/**
 * Cache Middleware for Keywords API
 * Provides Redis-based caching with fallback to in-memory cache
 */

class CacheMiddleware {
  constructor() {
    this.redis = null;
    this.memoryCache = new Map();
    this.maxMemoryCacheSize = 1000;
    this.initializeCache();
  }

  async initializeCache() {
    try {
      if (process.env.REDIS_URL) {
        const Redis = require('ioredis');
        this.redis = new Redis(process.env.REDIS_URL);

        this.redis.on('error', (err) => {
          console.warn('Redis cache error:', err.message);
          this.redis = null; // Fallback to memory cache
        });

        this.redis.on('connect', () => {
          console.log('Redis cache connected successfully');
        });
      }
    } catch (error) {
      console.warn('Redis not available, using memory cache:', error.message);
      this.redis = null;
    }
  }

  // Generate cache key with tenant isolation
  generateCacheKey(tenant_id, endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');

    return `keywords:${tenant_id}:${endpoint}:${sortedParams}`;
  }

  // Get from cache
  async get(key) {
    try {
      if (this.redis) {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
      } else {
        // Memory cache fallback
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.data;
        } else if (cached) {
          this.memoryCache.delete(key);
        }
        return null;
      }
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  // Set cache with TTL
  async set(key, value, ttl = 3600) {
    try {
      if (this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        // Memory cache fallback with size limit
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
          // Remove oldest entries
          const entries = Array.from(this.memoryCache.entries());
          entries.slice(0, Math.floor(this.maxMemoryCacheSize * 0.1)).forEach(([k]) => {
            this.memoryCache.delete(k);
          });
        }

        this.memoryCache.set(key, {
          data: value,
          expiry: Date.now() + (ttl * 1000)
        });
      }
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }

  // Invalidate cache patterns
  async invalidate(pattern) {
    try {
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        // Memory cache pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error.message);
    }
  }

  // Middleware for caching GET requests
  cacheGet(options = {}) {
    const {
      ttl = 3600, // 1 hour default
      varyBy = ['query'], // Cache by query parameters
      skipCache = false
    } = options;

    return async (req, res, next) => {
      try {
        if (skipCache || req.method !== 'GET') {
          return next();
        }

        const tenant_id = req.tenant_id || req.user?.tenant_id || req.user?.id;
        if (!tenant_id) {
          return next(); // Skip caching if no tenant
        }

        // Build cache key based on varyBy options
        const cacheParams = {};
        if (varyBy.includes('query')) {
          Object.assign(cacheParams, req.query);
        }
        if (varyBy.includes('params')) {
          Object.assign(cacheParams, req.params);
        }

        const cacheKey = this.generateCacheKey(
          tenant_id,
          req.route.path || req.path,
          cacheParams
        );

        // Try to get from cache
        const cached = await this.get(cacheKey);
        if (cached) {
          // Add cache hit header
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
          return res.json(cached);
        }

        // Cache miss - intercept response
        const originalJson = res.json;
        res.json = async (data) => {
          // Only cache successful responses
          if (res.statusCode === 200 && data.success) {
            await this.set(cacheKey, data, ttl);
          }

          // Add cache miss header
          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey);

          // Call original json method
          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        console.warn('Cache middleware error:', error.message);
        next(); // Continue without caching
      }
    };
  }

  // Middleware for invalidating cache on mutations
  invalidateOnMutation(patterns = []) {
    return async (req, res, next) => {
      try {
        const tenant_id = req.tenant_id || req.user?.tenant_id || req.user?.id;
        if (!tenant_id || !['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
          return next();
        }

        // Hook into response to invalidate cache after successful mutation
        const originalJson = res.json;
        res.json = async (data) => {
          // Only invalidate on successful mutations
          if ((res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 207) && data.success) {
            // Default patterns if none provided
            const invalidationPatterns = patterns.length > 0 ? patterns : [
              `keywords:${tenant_id}:*`,
              `analytics:${tenant_id}:*`,
              `suggestions:${tenant_id}:*`
            ];

            // Invalidate cache patterns
            for (const pattern of invalidationPatterns) {
              await this.invalidate(pattern);
            }
          }

          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        console.warn('Cache invalidation middleware error:', error.message);
        next(); // Continue without cache invalidation
      }
    };
  }

  // Cleanup method
  async cleanup() {
    try {
      if (this.redis) {
        await this.redis.disconnect();
      }
      this.memoryCache.clear();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}

// Export singleton instance
module.exports = new CacheMiddleware();