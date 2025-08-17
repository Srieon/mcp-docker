import { RateLimitInfo, RateLimitError } from '../types.js';
import { config } from '../config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limiter to handle API request limits
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests?: number, windowMs?: number) {
    this.maxRequests = maxRequests || config.dockerhub.rateLimit;
    this.windowMs = (windowMs || config.dockerhub.rateLimitWindow) * 1000; // Convert to milliseconds
  }

  /**
   * Check if a request is allowed for the given key
   */
  isAllowed(key: string = 'default'): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now >= entry.resetTime) {
      // Reset or initialize the entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get current rate limit info for a key
   */
  getInfo(key: string = 'default'): RateLimitInfo {
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        remaining: this.maxRequests - 1,
        reset: now + this.windowMs,
        limit: this.maxRequests,
      };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      reset: entry.resetTime,
      limit: this.maxRequests,
    };
  }

  /**
   * Wait until the rate limit resets for a key
   */
  async waitForReset(key: string = 'default'): Promise<void> {
    const info = this.getInfo(key);
    
    if (info.remaining > 0) {
      return;
    }

    const waitTime = info.reset - Date.now();
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Attempt to make a request with automatic rate limiting
   */
  async execute<T>(
    fn: () => Promise<T>,
    key: string = 'default',
    throwOnLimit: boolean = false
  ): Promise<T> {
    if (!this.isAllowed(key)) {
      if (throwOnLimit) {
        const info = this.getInfo(key);
        throw new RateLimitError(
          `Rate limit exceeded. Try again at ${new Date(info.reset).toISOString()}`,
          info.reset
        );
      }

      // Wait for rate limit to reset
      await this.waitForReset(key);
    }

    return await fn();
  }

  /**
   * Update rate limit info from API response headers
   */
  updateFromHeaders(headers: Record<string, string>, key: string = 'default'): void {
    const limit = parseInt(headers['x-ratelimit-limit'] || headers['ratelimit-limit'] || '0', 10);
    const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['ratelimit-remaining'] || '0', 10);
    const reset = parseInt(headers['x-ratelimit-reset'] || headers['ratelimit-reset'] || '0', 10);

    if (limit > 0) {
      this.maxRequests = limit;
    }

    if (reset > 0) {
      const resetTime = reset * 1000; // Convert to milliseconds
      const count = limit - remaining;
      
      this.limits.set(key, {
        count: Math.max(0, count),
        resetTime,
      });
    }
  }

  /**
   * Clear rate limit data for a key
   */
  clear(key: string = 'default'): void {
    this.limits.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.limits.clear();
  }

  /**
   * Get all current rate limit entries (for debugging)
   */
  getAllLimits(): Record<string, RateLimitEntry> {
    const result: Record<string, RateLimitEntry> = {};
    for (const [key, entry] of this.limits.entries()) {
      result[key] = { ...entry };
    }
    return result;
  }
}

// Export singleton instance for Docker Hub API
export const dockerHubRateLimiter = new RateLimiter();
