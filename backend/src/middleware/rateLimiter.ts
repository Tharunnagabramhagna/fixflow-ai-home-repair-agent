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

/**
 * Safely extracts client IP address relying on Express's proxy-addr verified req.ip.
 *
 * In production behind a reverse proxy (Render / Railway), Express evaluates req.ip
 * by inspecting X-Forwarded-For against the configured trusted proxy hop count (1).
 * Arbitrary client-supplied headers (e.g. CF-Connecting-IP, X-Vercel-Forwarded-For,
 * X-Real-IP, or extra prepended X-Forwarded-For entries) are NOT manually trusted,
 * preventing malicious clients from forging headers to evade rate limits.
 */
export function extractClientIp(req: Request): string {
  // 1. Rely on Express's verified req.ip (determined via proxy-addr & trust proxy configuration)
  if (req.ip && typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  // 2. Direct connection socket fallback
  if (req.socket?.remoteAddress && typeof req.socket.remoteAddress === 'string' && req.socket.remoteAddress.trim()) {
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
