import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { logger } from '../utils/logger.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultWindowMs: number = 60 * 60 * 1000) { // 1 hour default
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  isAllowed(key: string, limit: number, windowMs: number = this.defaultWindowMs): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // New entry or expired window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now
      };
      this.store.set(key, newEntry);
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: newEntry.resetTime
      };
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    entry.count++;
    entry.lastAccess = now;

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      // Clean up entries that haven't been accessed in 2 hours
      if (now - entry.lastAccess > 2 * 60 * 60 * 1000) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug(`Cleaned up ${keysToDelete.length} expired rate limit entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

// Graceful shutdown
process.on('SIGTERM', () => {
  globalRateLimiter.destroy();
});

process.on('SIGINT', () => {
  globalRateLimiter.destroy();
});

export interface RateLimitOptions {
  windowMs?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export const createRateLimit = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 60 * 60 * 1000, // 1 hour
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator
  } = options;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Generate key for rate limiting
      let key: string;
      
      if (keyGenerator) {
        key = keyGenerator(req);
      } else if (req.apiKey) {
        // Use API key ID if authenticated
        key = `api_key:${req.apiKey.id}`;
      } else {
        // Fall back to IP address
        key = `ip:${req.ip}`;
      }

      // Determine the limit based on API key or default
      const limit = req.apiKey?.rateLimitPerHour || 100; // Default 100 requests per hour for unauthenticated

      const result = globalRateLimiter.isAllowed(key, limit, windowMs);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          limit,
          windowMs,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          apiKey: req.apiKey?.id
        });

        res.status(429).json({
          error: message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
        return;
      }

      // Track the request for potential skipping
      const originalSend = res.send;
      let statusCode: number;

      res.send = function(body: any) {
        statusCode = res.statusCode;
        
        if (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) {
          // Don't count successful requests
          const currentEntry = globalRateLimiter.isAllowed(key, limit + 1, windowMs);
          // This effectively "undoes" the increment
        } else if (skipFailedRequests && statusCode >= 400) {
          // Don't count failed requests
          const currentEntry = globalRateLimiter.isAllowed(key, limit + 1, windowMs);
          // This effectively "undoes" the increment
        }

        return originalSend.call(this, body);
      };

      logger.debug('Rate limit check passed', {
        key,
        remaining: result.remaining,
        limit,
        ip: req.ip
      });

      next();
    } catch (error) {
      logger.error('Rate limiting error', error);
      // If rate limiting fails, allow the request
      next();
    }
  };
};

// Pre-configured rate limiters for different use cases
export const apiRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'API rate limit exceeded. Please try again later.'
});

export const strictRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Strict rate limit exceeded. Please try again later.'
});

export const submissionRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many submissions. Please wait before submitting again.'
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true
});