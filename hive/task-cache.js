#!/usr/bin/env node

const redis = require('redis');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class TaskCache {
    constructor() {
        this.client = null;
        this.cacheConfig = {
            ttl: 3600, // 1 hour default TTL
            maxSize: 1024 * 1024 * 10, // 10MB max size per cache entry
            compressionThreshold: 1024, // Compress if > 1KB
            namespace: 'hive:cache',
            strategies: {
                'api-response': { ttl: 3600, compress: true },
                'database-query': { ttl: 1800, compress: true },
                'computation': { ttl: 7200, compress: false },
                'file-generation': { ttl: 86400, compress: true }
            }
        };
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0,
            compressionSaved: 0
        };
    }

    async initialize() {
        this.client = redis.createClient({
            socket: { host: 'localhost', port: 6379 }
        });
        
        await this.client.connect();
        
        // Set up cache invalidation listener
        const subscriber = this.client.duplicate();
        await subscriber.connect();
        
        await subscriber.subscribe('cache:invalidate', async (message) => {
            const { pattern } = JSON.parse(message);
            await this.invalidate(pattern);
        });
        
        console.log('[TaskCache] Distributed cache initialized');
    }

    // Generate cache key based on task parameters
    generateKey(taskType, params, agentId = null) {
        const baseKey = {
            type: taskType,
            params: this.normalizeParams(params)
        };
        
        if (agentId) {
            baseKey.agent = agentId;
        }
        
        const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify(baseKey))
            .digest('hex')
            .substring(0, 16);
        
        return `${this.cacheConfig.namespace}:${taskType}:${hash}`;
    }

    // Normalize parameters for consistent hashing
    normalizeParams(params) {
        if (!params) return {};
        
        // Sort object keys for consistent hashing
        const sorted = {};
        Object.keys(params).sort().forEach(key => {
            sorted[key] = params[key];
        });
        
        return sorted;
    }

    // Get cached result
    async get(taskType, params, agentId = null) {
        const key = this.generateKey(taskType, params, agentId);
        
        try {
            const cached = await this.client.get(key);
            
            if (!cached) {
                this.stats.misses++;
                return null;
            }
            
            this.stats.hits++;
            
            // Parse cached data
            const data = JSON.parse(cached);
            
            // Check if data is compressed
            if (data.compressed) {
                const buffer = Buffer.from(data.value, 'base64');
                const decompressed = await gunzip(buffer);
                data.value = JSON.parse(decompressed.toString());
            }
            
            // Update access time for LRU
            await this.client.expire(key, this.getCacheTTL(taskType));
            
            return {
                value: data.value,
                metadata: data.metadata,
                cachedAt: data.timestamp,
                key
            };
        } catch (error) {
            console.error(`[TaskCache] Error retrieving cache: ${error.message}`);
            return null;
        }
    }

    // Set cache entry
    async set(taskType, params, value, metadata = {}, agentId = null) {
        const key = this.generateKey(taskType, params, agentId);
        const ttl = this.getCacheTTL(taskType);
        
        try {
            let cacheData = {
                value,
                metadata: {
                    ...metadata,
                    taskType,
                    agentId,
                    size: JSON.stringify(value).length
                },
                timestamp: Date.now(),
                compressed: false
            };
            
            // Compress if needed
            const valueString = JSON.stringify(value);
            if (valueString.length > this.cacheConfig.compressionThreshold) {
                const compressed = await gzip(valueString);
                const compressionRatio = compressed.length / valueString.length;
                
                if (compressionRatio < 0.9) {
                    cacheData.value = compressed.toString('base64');
                    cacheData.compressed = true;
                    cacheData.metadata.compressionRatio = compressionRatio;
                    this.stats.compressionSaved += valueString.length - compressed.length;
                }
            }
            
            // Check size limit
            const finalSize = JSON.stringify(cacheData).length;
            if (finalSize > this.cacheConfig.maxSize) {
                console.warn(`[TaskCache] Cache entry too large (${finalSize} bytes), skipping`);
                return false;
            }
            
            // Set with TTL
            await this.client.setEx(key, ttl, JSON.stringify(cacheData));
            
            this.stats.writes++;
            
            // Publish cache update event
            await this.client.publish('cache:updated', JSON.stringify({
                key,
                taskType,
                size: finalSize,
                ttl
            }));
            
            return true;
        } catch (error) {
            console.error(`[TaskCache] Error setting cache: ${error.message}`);
            return false;
        }
    }

    // Invalidate cache entries
    async invalidate(pattern) {
        try {
            const keys = await this.client.keys(`${this.cacheConfig.namespace}:${pattern}*`);
            
            if (keys.length > 0) {
                await this.client.del(keys);
                this.stats.evictions += keys.length;
                
                console.log(`[TaskCache] Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
            }
            
            return keys.length;
        } catch (error) {
            console.error(`[TaskCache] Error invalidating cache: ${error.message}`);
            return 0;
        }
    }

    // Get cache TTL based on task type
    getCacheTTL(taskType) {
        const strategy = this.cacheConfig.strategies[taskType];
        return strategy ? strategy.ttl : this.cacheConfig.ttl;
    }

    // Warm up cache with common queries
    async warmUp(tasks) {
        console.log(`[TaskCache] Warming up cache with ${tasks.length} tasks`);
        
        let warmed = 0;
        for (const task of tasks) {
            const { type, params, result } = task;
            
            if (result) {
                const success = await this.set(type, params, result);
                if (success) warmed++;
            }
        }
        
        console.log(`[TaskCache] Cache warmed with ${warmed} entries`);
        return warmed;
    }

    // Get cache statistics
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            compressionSavedMB: (this.stats.compressionSaved / 1024 / 1024).toFixed(2)
        };
    }

    // Get cache size info
    async getCacheInfo() {
        try {
            const keys = await this.client.keys(`${this.cacheConfig.namespace}:*`);
            const info = {
                totalEntries: keys.length,
                byType: {},
                totalSize: 0,
                oldestEntry: null,
                newestEntry: null
            };
            
            for (const key of keys) {
                const data = await this.client.get(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    const taskType = parsed.metadata?.taskType || 'unknown';
                    
                    if (!info.byType[taskType]) {
                        info.byType[taskType] = { count: 0, size: 0 };
                    }
                    
                    info.byType[taskType].count++;
                    info.byType[taskType].size += data.length;
                    info.totalSize += data.length;
                    
                    // Track oldest and newest
                    if (!info.oldestEntry || parsed.timestamp < info.oldestEntry.timestamp) {
                        info.oldestEntry = { key, timestamp: parsed.timestamp };
                    }
                    if (!info.newestEntry || parsed.timestamp > info.newestEntry.timestamp) {
                        info.newestEntry = { key, timestamp: parsed.timestamp };
                    }
                }
            }
            
            info.totalSizeMB = (info.totalSize / 1024 / 1024).toFixed(2);
            
            return info;
        } catch (error) {
            console.error(`[TaskCache] Error getting cache info: ${error.message}`);
            return null;
        }
    }

    // Clear all cache
    async clear() {
        try {
            const keys = await this.client.keys(`${this.cacheConfig.namespace}:*`);
            
            if (keys.length > 0) {
                await this.client.del(keys);
                console.log(`[TaskCache] Cleared ${keys.length} cache entries`);
            }
            
            // Reset stats
            this.stats = {
                hits: 0,
                misses: 0,
                writes: 0,
                evictions: 0,
                compressionSaved: 0
            };
            
            return keys.length;
        } catch (error) {
            console.error(`[TaskCache] Error clearing cache: ${error.message}`);
            return 0;
        }
    }

    // Middleware for Express to auto-cache API responses
    expressMiddleware() {
        return async (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }
            
            const cacheKey = `api-response:${req.path}:${JSON.stringify(req.query)}`;
            const cached = await this.get('api-response', { path: req.path, query: req.query });
            
            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', cached.key);
                return res.json(cached.value);
            }
            
            // Store original send
            const originalSend = res.json;
            
            // Override json method
            res.json = async (data) => {
                // Cache the response
                await this.set('api-response', { path: req.path, query: req.query }, data);
                
                res.set('X-Cache', 'MISS');
                originalSend.call(res, data);
            };
            
            next();
        };
    }

    async cleanup() {
        await this.client.quit();
    }
}

module.exports = TaskCache;

// Run standalone cache server if executed directly
if (require.main === module) {
    const express = require('express');
    const cache = new TaskCache();
    
    cache.initialize().then(() => {
        const app = express();
        app.use(express.json());
        
        // Cache management endpoints
        app.get('/cache/stats', (req, res) => {
            res.json(cache.getStats());
        });
        
        app.get('/cache/info', async (req, res) => {
            const info = await cache.getCacheInfo();
            res.json(info);
        });
        
        app.delete('/cache/invalidate', async (req, res) => {
            const { pattern } = req.query;
            const count = await cache.invalidate(pattern || '*');
            res.json({ invalidated: count });
        });
        
        app.delete('/cache/clear', async (req, res) => {
            const count = await cache.clear();
            res.json({ cleared: count });
        });
        
        app.post('/cache/warmup', async (req, res) => {
            const { tasks } = req.body;
            const count = await cache.warmUp(tasks || []);
            res.json({ warmed: count });
        });
        
        const port = 9095;
        app.listen(port, () => {
            console.log(`[TaskCache] Cache server running on port ${port}`);
            console.log('Endpoints:');
            console.log('  GET  /cache/stats');
            console.log('  GET  /cache/info');
            console.log('  DELETE /cache/invalidate?pattern=xxx');
            console.log('  DELETE /cache/clear');
            console.log('  POST /cache/warmup');
        });
    }).catch(console.error);
    
    process.on('SIGINT', async () => {
        await cache.cleanup();
        process.exit(0);
    });
}