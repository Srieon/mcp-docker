import NodeCache from 'node-cache';
import { CacheEntry } from '../types.js';
import { config } from '../config.js';

/**
 * Cache manager for storing API responses and computed data
 */
export class CacheManager {
  private cache: NodeCache;
  private defaultTTL: number;

  constructor() {
    this.defaultTTL = config.cache.ttlSeconds;
    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      maxKeys: config.cache.maxSize,
      checkperiod: Math.floor(this.defaultTTL / 2),
      useClones: false,
    });

    // Log cache statistics periodically
    if (config.logLevel === 'debug') {
      setInterval(() => {
        const stats = this.cache.getStats();
        console.debug('Cache stats:', stats);
      }, 60000); // Every minute
    }
  }

  /**
   * Get an item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get<CacheEntry<T>>(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired (additional check beyond node-cache)
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.del(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set an item in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const actualTTL = ttl || this.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
    };

    this.cache.set(key, entry, actualTTL);
  }

  /**
   * Check if an item exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete an item from cache
   */
  delete(key: string): void {
    this.cache.del(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    };
  }

  /**
   * Generate a cache key for API requests
   */
  static generateKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(String(params[key]))}`)
      .join('&');
    
    return `${endpoint}${sortedParams ? `?${sortedParams}` : ''}`;
  }

  /**
   * Cache API response with automatic key generation
   */
  cacheApiResponse<T>(endpoint: string, params: Record<string, any>, data: T, ttl?: number): void {
    const key = CacheManager.generateKey(endpoint, params);
    this.set(key, data, ttl);
  }

  /**
   * Get cached API response with automatic key generation
   */
  getCachedApiResponse<T>(endpoint: string, params: Record<string, any> = {}): T | null {
    const key = CacheManager.generateKey(endpoint, params);
    return this.get<T>(key);
  }

  /**
   * Wrap a function with caching
   */
  withCache<T extends any[], R>(
    key: string,
    fn: (...args: T) => Promise<R>,
    ttl?: number
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const cacheKey = `${key}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = this.get<R>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fn(...args);
      this.set(cacheKey, result, ttl);
      
      return result;
    };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
