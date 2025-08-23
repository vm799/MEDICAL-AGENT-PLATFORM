// backend/src/utils/cache.js
const redis = require('redis');

class CacheManager {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new Map();
    this.maxMemoryItems = 1000;
    this.defaultTTL = 3600; // 1 hour
    
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          retry_delay_on_failure: 1000,
          max_retry_delay: 30000
        });
        
        await this.redisClient.connect();
        console.log('✅ Redis connected');
      } else {
        console.log('⚠️ No Redis URL, using memory cache only');
      }
    } catch (error) {
      console.error('Redis connection failed, falling back to memory:', error);
      this.redisClient = null;
    }
  }

  async get(key) {
    const cacheKey = this.generateKey(key);
    
    // Try Redis first
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn('Redis get error:', error);
      }
    }
    
    // Fallback to memory cache
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult && Date.now() < memoryResult.expiry) {
      return memoryResult.data;
    }
    
    return null;
  }

  async set(key, value, ttl = this.defaultTTL) {
    const cacheKey = this.generateKey(key);
    const serialized = JSON.stringify(value);
    
    // Set in Redis
    if (this.redisClient) {
      try {
        await this.redisClient.setEx(cacheKey, ttl, serialized);
      } catch (error) {
        console.warn('Redis set error:', error);
      }
    }
    
    // Set in memory cache
    this.setMemoryCache(cacheKey, value, ttl);
  }

  setMemoryCache(key, value, ttl) {
    // Clean old entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, {
      data: value,
      expiry: Date.now() + (ttl * 1000)
    });
  }

  generateKey(input) {
    // Create consistent cache key
    return `medical_agent:${Buffer.from(input).toString('base64').substring(0, 32)}`;
  }

  async healthCheck() {
    const health = { memory: 'healthy', redis: 'not_configured' };
    
    health.memory = this.memoryCache.size < this.maxMemoryItems ? 'healthy' : 'full';
    
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        health.redis = 'healthy';
      } catch (error) {
        health.redis = 'error';
      }
    }
    
    return health;
  }
}

module.exports = { CacheManager };