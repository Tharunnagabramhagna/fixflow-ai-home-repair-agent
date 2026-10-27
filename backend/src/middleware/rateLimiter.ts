import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs?: number | (() => number);
  max?: number | (() => number);
  message?: string;
  requireValidIdentity?: boolean;
  keyGenerator?: (req: AuthenticatedRequest) => string | null;
  skip?: (req: AuthenticatedRequest) => boolean;
}

export function extractClientIp(req: Request): string {
  // 1. Cloudflare connecting IP
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  // 2. Vercel edge forwarded IP
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string' && vercelIp.trim()) {
    return vercelIp.split(',')[0].trim();
  }

  // 3. X-Real-IP
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  // 4. Standard X-Forwarded-For (leftmost is original client)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const first = forwardedFor.split(',')[0].trim();
    if (first) return first;
  }

  // 5. Express req.ip (calculated when trust proxy is active)
  if (req.ip && req.ip.trim()) {
    return req.ip.trim();
  }

  // 6. Underlying socket remote address
  if (req.socket?.remoteAddress && req.socket.remoteAddress.trim()) {
    return req.socket.remoteAddress.trim();
  }

  return '';
}

export class MemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupTimer: any = null;

  constructor(cleanupIntervalMs = 60000) {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
    if (this.cleanupTimer && this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  public get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  public set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

// Global stores for built-in limiters
export const aiChatStore = new MemoryRateLimitStore();
export const multimodalStore = new MemoryRateLimitStore();

export function createRateLimiter(options: RateLimiterOptions = {}, customStore?: MemoryRateLimitStore) {
  const store = customStore || new MemoryRateLimitStore();
  const requireValidIdentity = options.requireValidIdentity !== false;

  const getWindowMs = () =>
    typeof options.windowMs === 'function'
      ? options.windowMs()
      : options.windowMs !== undefined
      ? options.windowMs
      : 60000;

  const getMax = () =>
    typeof options.max === 'function'
      ? options.max()
      : options.max !== undefined
      ? options.max
      : 20;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (options.skip && options.skip(req)) {
      return next();
    }

    // Determine client key:
    // 1. Authenticated user ID (scoped per household account)
    // 2. Client IP address (scoped per network origin for guests)
    let key: string | null = null;
    if (options.keyGenerator) {
      key = options.keyGenerator(req);
    } else if (req.user?.id) {
      key = `user:${req.user.id}`;
    } else {
      const ip = extractClientIp(req);
      if (ip && ip !== 'unknown' && ip !== 'undefined' && ip !== 'null') {
        key = `ip:${ip}`;
      } else if (!requireValidIdentity) {
        key = 'ip:anonymous';
      }
    }

    if (!key) {
      res.status(400).json({
        error: 'Client identity could not be determined. A valid IP address or authenticated session is required.',
      });
      return;
    }

    const now = Date.now();
    const windowMs = getWindowMs();
    const maxRequests = getMax();

    let entry = store.get(key);
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    const resetSeconds = Math.ceil(entry.resetTime / 1000);
    const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    const remaining = Math.max(0, maxRequests - entry.count);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error: options.message || 'Rate limit exceeded. Too many requests, please try again later.',
        retryAfter,
        limit: maxRequests,
        windowSeconds: Math.round(windowMs / 1000),
      });
      return;
    }

    next();
  };
}

// Built-in limiter for conversational AI diagnostics
export const aiChatRateLimiter = createRateLimiter(
  {
    windowMs: () => Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60000,
    max: () => Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 20,
    message: 'Rate limit exceeded. Too many AI diagnostic requests. Please try again shortly.',
  },
  aiChatStore
);

// Built-in limiter for multimodal visual inspections and OCR
export const multimodalRateLimiter = createRateLimiter(
  {
    windowMs: () => Number(process.env.MULTIMODAL_RATE_LIMIT_WINDOW_MS) || 60000,
    max: () => Number(process.env.MULTIMODAL_RATE_LIMIT_MAX_REQUESTS) || 10,
    message: 'Rate limit exceeded. Too many visual inspection requests. Please try again shortly.',
  },
  multimodalStore
);

// Reset helper for test suites
export function resetRateLimits(): void {
  aiChatStore.clear();
  multimodalStore.clear();
}
