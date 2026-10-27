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

// Regex patterns for validating Vercel Edge rewrite headers
const VERCEL_HOST_REGEX = /^fixflow-ai-home-repair-agent(-[a-z0-9]+)?\.vercel\.app$/i;
const VERCEL_ID_REGEX = /^[a-z0-9]{3,5}::[a-z0-9-]+$/i;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;

export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Safely extracts client IP address across FixFlow's hosting topologies:
 *
 * 1. Vercel Reverse-Proxy Rewrite (Frontend: Vercel -> Backend: Render):
 *    Requests arriving from official FixFlow Vercel deployments carry Vercel edge signatures:
 *    - `x-vercel-id`: Unique edge request ID (e.g. bom1::... or iad1::...)
 *    - `x-forwarded-host`: Official FixFlow Vercel frontend host
 *    - `x-vercel-forwarded-for`: Client IP observed by Vercel edge
 *    When these verified headers are present, the client IP is extracted from
 *    `x-vercel-forwarded-for`, ensuring distinct guest users on Vercel are not
 *    unnecessarily grouped under a shared Vercel egress IP.
 *
 * 2. Direct Render API Endpoint (External tools, Alexa, test clients, direct curl):
 *    Express evaluates `req.ip` using configured proxy trust (1 hop for Render load balancer).
 *    Any arbitrary client-supplied provider headers (CF-Connecting-IP, X-Real-IP,
 *    or unverified X-Vercel-Forwarded-For without matching Vercel trace) are ignored,
 *    and the leftmost forged entries in X-Forwarded-For are discarded by proxy-addr.
 *    This guarantees attackers cannot forge headers to bypass rate limits.
 *
 * 3. Direct socket fallback:
 *    Falls back to `req.socket.remoteAddress` for local test servers.
 */
export function extractClientIp(req: Request): string {
  // 1. Check for genuine Vercel edge rewrite proxy headers
  const headers = req.headers || {};
  const vercelId = headers['x-vercel-id'];
  const forwardedHost = headers['x-forwarded-host'];
  const vercelForwardedFor = headers['x-vercel-forwarded-for'];

  if (
    typeof vercelId === 'string' &&
    VERCEL_ID_REGEX.test(vercelId.trim()) &&
    typeof forwardedHost === 'string' &&
    VERCEL_HOST_REGEX.test(forwardedHost.trim()) &&
    typeof vercelForwardedFor === 'string'
  ) {
    const candidateIp = vercelForwardedFor.split(',')[0].trim();
    if (isValidIp(candidateIp)) {
      return candidateIp;
    }
  }

  // 2. Rely on Express's verified req.ip (determined via proxy-addr & trust proxy configuration)
  if (req.ip && typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  // 3. Direct connection socket fallback
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
