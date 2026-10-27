import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import express, { Request, Response } from 'express';
import app from '../app';
import {
  createRateLimiter,
  extractClientIp,
  resetRateLimits,
  MemoryRateLimitStore,
  aiChatStore,
  multimodalStore,
} from '../middleware/rateLimiter';
import { authService } from '../services/authService';
import { initializeDatabase } from '../db/database';

describe('FixFlow AI & Multimodal Rate Limiting Security Hardening', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  afterEach(() => {
    resetRateLimits();
  });

  describe('1. Client IP Extraction and Proxy Trust', () => {
    it('should correctly prioritize Cloudflare cf-connecting-ip header', () => {
      const mockReq = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-vercel-forwarded-for': '198.51.100.1',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('203.0.113.195');
    });

    it('should correctly extract Vercel edge x-vercel-forwarded-for header', () => {
      const mockReq = {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.42, 10.0.0.2',
          'x-forwarded-for': '10.0.0.2',
        },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('198.51.100.42');
    });

    it('should extract the first client IP in standard x-forwarded-for chain', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.50, 192.168.1.1, 10.0.0.1',
        },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('203.0.113.50');
    });

    it('should fall back to socket remoteAddress if headers are absent', () => {
      const mockReq = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('127.0.0.1');
    });
  });

  describe('2. Custom Rate Limiter Mechanics (Normal Requests, Exhaustion, Recovery)', () => {
    it('should return rate limit headers on normal requests', async () => {
      const testApp = express();
      testApp.use(express.json());
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 3,
        },
        customStore
      );

      testApp.post('/test-endpoint', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      const res1 = await supertest(testApp)
        .post('/test-endpoint')
        .set('X-Forwarded-For', '203.0.113.10');

      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-limit']).toBe('3');
      expect(res1.headers['x-ratelimit-remaining']).toBe('2');
      expect(res1.headers['x-ratelimit-reset']).toBeDefined();

      const res2 = await supertest(testApp)
        .post('/test-endpoint')
        .set('X-Forwarded-For', '203.0.113.10');

      expect(res2.status).toBe(200);
      expect(res2.headers['x-ratelimit-remaining']).toBe('1');
    });

    it('should exhaust the limit and return HTTP 429 with retry information', async () => {
      const testApp = express();
      testApp.use(express.json());
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 2,
          message: 'Rate limit exceeded for test.',
        },
        customStore
      );

      testApp.post('/test-exhaustion', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Request 1: OK
      const r1 = await supertest(testApp)
        .post('/test-exhaustion')
        .set('X-Forwarded-For', '203.0.113.20');
      expect(r1.status).toBe(200);

      // Request 2: OK (reaches max)
      const r2 = await supertest(testApp)
        .post('/test-exhaustion')
        .set('X-Forwarded-For', '203.0.113.20');
      expect(r2.status).toBe(200);

      // Request 3: Exhausted -> 429
      const r3 = await supertest(testApp)
        .post('/test-exhaustion')
        .set('X-Forwarded-For', '203.0.113.20');
      expect(r3.status).toBe(429);
      expect(r3.headers['retry-after']).toBeDefined();
      expect(r3.headers['x-ratelimit-remaining']).toBe('0');
      expect(r3.body.error).toBe('Rate limit exceeded for test.');
      expect(r3.body.retryAfter).toBeGreaterThan(0);
      expect(r3.body.limit).toBe(2);
      expect(r3.body.windowSeconds).toBe(60);
    });

    it('should recover and allow requests after the window expires', async () => {
      const testApp = express();
      testApp.use(express.json());
      const customStore = new MemoryRateLimitStore();
      const shortWindowMs = 200; // 200ms window
      const limiter = createRateLimiter(
        {
          windowMs: shortWindowMs,
          max: 1,
        },
        customStore
      );

      testApp.post('/test-recovery', limiter, (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Request 1: OK
      const r1 = await supertest(testApp)
        .post('/test-recovery')
        .set('X-Forwarded-For', '203.0.113.30');
      expect(r1.status).toBe(200);

      // Request 2 immediately: 429
      const r2 = await supertest(testApp)
        .post('/test-recovery')
        .set('X-Forwarded-For', '203.0.113.30');
      expect(r2.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Request 3 after window expiry: OK again!
      const r3 = await supertest(testApp)
        .post('/test-recovery')
        .set('X-Forwarded-For', '203.0.113.30');
      expect(r3.status).toBe(200);
      expect(r3.body.success).toBe(true);
    });

    it('should reject requests with HTTP 400 when client identity is completely missing or invalid', async () => {
      const testApp = express();
      testApp.use(express.json());
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        requireValidIdentity: true,
      });

      testApp.post('/test-identity', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Explicitly set empty IP headers and mock empty socket address
      const r = await supertest(testApp)
        .post('/test-identity')
        .set('X-Forwarded-For', '')
        .set('X-Real-IP', '');

      // In Supertest, socket address may exist; verify with key generator returning null
      const strictLimiter = createRateLimiter({
        keyGenerator: () => null,
      });
      testApp.post('/test-missing-id', strictLimiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      const strictRes = await supertest(testApp).post('/test-missing-id');
      expect(strictRes.status).toBe(400);
      expect(strictRes.body.error).toContain('Client identity could not be determined');
    });
  });

  describe('3. Per-User and Per-IP Quota Isolation', () => {
    it('should isolate rate limits between different authenticated users', async () => {
      const testApp = express();
      testApp.use(express.json());
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 1,
        },
        customStore
      );

      testApp.post('/test-auth', (req: any, _res, next) => {
        const userId = req.headers['x-user-id'];
        if (userId) {
          req.user = { id: userId, name: 'Test', email: 'test@example.com' };
        }
        next();
      }, limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // User 1 makes 1st request -> OK
      const u1_r1 = await supertest(testApp)
        .post('/test-auth')
        .set('X-User-Id', 'usr-1');
      expect(u1_r1.status).toBe(200);

      // User 1 makes 2nd request -> 429
      const u1_r2 = await supertest(testApp)
        .post('/test-auth')
        .set('X-User-Id', 'usr-1');
      expect(u1_r2.status).toBe(429);

      // User 2 makes 1st request from the same server -> OK (not blocked by User 1)
      const u2_r1 = await supertest(testApp)
        .post('/test-auth')
        .set('X-User-Id', 'usr-2');
      expect(u2_r1.status).toBe(200);
    });

    it('should isolate rate limits between different guest IP addresses', async () => {
      const testApp = express();
      testApp.use(express.json());
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 1,
        },
        customStore
      );

      testApp.post('/test-guest', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Guest from IP 1: OK
      const ip1_r1 = await supertest(testApp)
        .post('/test-guest')
        .set('X-Forwarded-For', '203.0.113.100');
      expect(ip1_r1.status).toBe(200);

      // Guest from IP 1: 429
      const ip1_r2 = await supertest(testApp)
        .post('/test-guest')
        .set('X-Forwarded-For', '203.0.113.100');
      expect(ip1_r2.status).toBe(429);

      // Guest from IP 2: OK (separate quota)
      const ip2_r1 = await supertest(testApp)
        .post('/test-guest')
        .set('X-Forwarded-For', '203.0.113.101');
      expect(ip2_r1.status).toBe(200);
    });
  });

  describe('4. FixFlow Application AI Endpoints Integration & Ordinary Endpoint Availability', () => {
    it('should rate limit AI assistant chat requests and leave health check usable', async () => {
      // Simulate exhausting AI chat limit for IP 203.0.113.200
      aiChatStore.set('ip:203.0.113.200', {
        count: 50,
        resetTime: Date.now() + 60000,
      });

      // AI Chat endpoint should be rate-limited
      const chatRes = await supertest(app)
        .post('/api/assistant/chat')
        .set('X-Forwarded-For', '203.0.113.200')
        .send({
          messages: [{ role: 'user', content: 'Why is my refrigerator buzzing?' }],
        });

      expect(chatRes.status).toBe(429);
      expect(chatRes.body.error).toContain('Rate limit exceeded');
      expect(chatRes.headers['retry-after']).toBeDefined();

      // Canonical alias /api/diagnostics/chat should also be rate-limited
      const aliasRes = await supertest(app)
        .post('/api/diagnostics/chat')
        .set('X-Forwarded-For', '203.0.113.200')
        .send({
          messages: [{ role: 'user', content: 'Why is my refrigerator buzzing?' }],
        });

      expect(aliasRes.status).toBe(429);

      // CRITICAL: Health check endpoint must remain fully usable!
      const healthRes = await supertest(app)
        .get('/api/health')
        .set('X-Forwarded-For', '203.0.113.200');

      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('ok');

      // CRITICAL: Appliances inventory endpoint must remain usable!
      const appliancesRes = await supertest(app)
        .get('/api/appliances')
        .set('X-Forwarded-For', '203.0.113.200');

      expect(appliancesRes.status).toBe(200);
      expect(Array.isArray(appliancesRes.body.data)).toBe(true);
    });

    it('should rate limit multimodal inspection requests and leave repairs endpoint usable', async () => {
      // Simulate exhausting multimodal limit for IP 203.0.113.201
      multimodalStore.set('ip:203.0.113.201', {
        count: 50,
        resetTime: Date.now() + 60000,
      });

      // Multimodal endpoint should be rate-limited
      const inspectRes = await supertest(app)
        .post('/api/inspections/analyze')
        .set('X-Forwarded-For', '203.0.113.201')
        .send({
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        });

      expect(inspectRes.status).toBe(429);
      expect(inspectRes.body.error).toContain('Rate limit exceeded');

      // Canonical alias /api/multimodal/analyze should also be rate-limited
      const aliasRes = await supertest(app)
        .post('/api/multimodal/analyze')
        .set('X-Forwarded-For', '203.0.113.201')
        .send({
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        });

      expect(aliasRes.status).toBe(429);

      // Repairs endpoint remains usable
      const repairsRes = await supertest(app)
        .get('/api/repairs')
        .set('X-Forwarded-For', '203.0.113.201');

      expect(repairsRes.status).toBe(200);
    });
  });
});
