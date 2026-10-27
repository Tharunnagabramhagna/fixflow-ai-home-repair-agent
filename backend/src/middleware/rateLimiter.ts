import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
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

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;

export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Validates whether the incoming request carries an authenticated server-to-server
 * trusted proxy secret (e.g. from an authenticated edge gateway or reverse proxy).
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 * If no secret is configured in the environment (via TRUSTED_PROXY_SECRET or
 * VERCEL_PROXY_SECRET), proxy authentication cannot succeed, and client-supplied
 * forwarded headers are NEVER trusted.
 */
export function verifyTrustedProxySecret(req: Request): boolean {
  const configuredSecret = process.env.TRUSTED_PROXY_SECRET || process.env.VERCEL_PROXY_SECRET;
  if (!configuredSecret || typeof configuredSecret !== 'string' || !configuredSecret.trim()) {
    return false;
  }

  const headers = req.headers || {};
  const rawProvided = headers['x-trusted-proxy-secret'] || headers['x-vercel-proxy-secret'];
  if (!rawProvided || typeof rawProvided !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(configuredSecret.trim(), 'utf8');
  const providedBuffer = Buffer.from(rawProvided.trim(), 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Safely extracts client IP address relying on Express's proxy-addr verified req.ip.
 *
 * Security Model:
 * 1. Default Baseline (Resistance to Spoofing):
 *    In production on Render / Railway, Express evaluates `req.ip` via proxy-addr
 *    under `trust proxy: 1`. Render's load balancer appends the socket IP of the connecting
 *    client to the rightmost position of X-Forwarded-For. Express reads that exact socket IP
 *    and discards any client-supplied upstream addresses.
 *    Client-supplied headers (e.g. CF-Connecting-IP, X-Vercel-Forwarded-For, X-Real-IP,
 *    X-Vercel-Id, or X-Forwarded-Host) are NEVER trusted merely because their values match a pattern.
 *    This completely prevents malicious clients from forging headers to evade rate limits.
 *
 * 2. Authenticated Trusted Proxy Handoff:
 *    If an authenticated server-to-server proxy secret is configured in the environment
 *    (TRUSTED_PROXY_SECRET or VERCEL_PROXY_SECRET) AND verified via timingSafeEqual on
 *    the incoming request, the proxy's forwarded client IP is trusted.
 *
 * 3. Direct Socket Fallback:
 *    Falls back to `req.socket.remoteAddress` for local test servers.
 */
export function extractClientIp(req: Request): string {
  // 1. If authenticated via verified server-to-server secret, trust proxy forwarded IP
  if (verifyTrustedProxySecret(req)) {
    const headers = req.headers || {};
    const forwarded = headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const candidate = forwarded.split(',')[0].trim();
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  // 2. Default baseline: Rely strictly on Express's verified req.ip (determined via proxy-addr & trust proxy 1)
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
