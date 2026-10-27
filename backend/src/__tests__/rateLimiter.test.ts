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

describe('FixFlow AI & Multimodal Rate Limiting Security Hardening', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  afterEach(() => {
    resetRateLimits();
  });

  describe('1. Proxy Trust, req.ip Resolution, and Anti-Spoofing Defenses', () => {
    it('should safely extract client IP from Express req.ip when configured with trust proxy 1', async () => {
      const testApp = express();
      testApp.set('trust proxy', 1);
      testApp.get('/test-ip', (req: Request, res: Response) => {
        res.json({ clientIp: extractClientIp(req) });
      });

      const res = await supertest(testApp)
        .get('/test-ip')
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(200);
      expect(res.body.clientIp).toBe('203.0.113.195');
    });

    it('should discard client-forged upstream IPs in X-Forwarded-For and rely only on trusted proxy ingress hop', async () => {
      const testApp = express();
      testApp.set('trust proxy', 1);
      testApp.get('/test-forged', (req: Request, res: Response) => {
        res.json({ clientIp: extractClientIp(req) });
      });

      // Malicious client prepends forged IP '1.1.1.1' before trusted ingress appends '203.0.113.195'
      const res = await supertest(testApp)
        .get('/test-forged')
        .set('X-Forwarded-For', '1.1.1.1, 203.0.113.195');

      expect(res.status).toBe(200);
      // Express trust proxy: 1 correctly evaluates the 1st hop from the socket, discarding forged '1.1.1.1'
      expect(res.body.clientIp).toBe('203.0.113.195');
    });

    it('should prevent an attacker from evading rate limits by rotating forged X-Forwarded-For addresses', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.set('trust proxy', 1);
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 2,
          message: 'Rate limit exceeded.',
        },
        customStore
      );

      testApp.post('/test-spoof-evasion', limiter, (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Attacker sends forged IP A with real proxy hop 203.0.113.50
      const r1 = await supertest(testApp)
        .post('/test-spoof-evasion')
        .set('X-Forwarded-For', '10.99.1.1, 203.0.113.50');
      expect(r1.status).toBe(200);

      // Attacker rotates forged IP B with real proxy hop 203.0.113.50
      const r2 = await supertest(testApp)
        .post('/test-spoof-evasion')
        .set('X-Forwarded-For', '10.99.2.2, 203.0.113.50');
      expect(r2.status).toBe(200);

      // Attacker rotates forged IP C with real proxy hop 203.0.113.50 -> must still be blocked (HTTP 429)!
      const r3 = await supertest(testApp)
        .post('/test-spoof-evasion')
        .set('X-Forwarded-For', '10.99.3.3, 203.0.113.50');
      expect(r3.status).toBe(429);
      expect(r3.body.error).toBe('Rate limit exceeded.');
    });

    it('should completely ignore arbitrary client-supplied CF-Connecting-IP, X-Vercel-Forwarded-For, and X-Real-IP headers', async () => {
      const testApp = express();
      testApp.set('trust proxy', 1);
      testApp.get('/test-provider-headers', (req: Request, res: Response) => {
        res.json({ clientIp: extractClientIp(req) });
      });

      // Client sends spoofed provider headers directly to the backend
      const res = await supertest(testApp)
        .get('/test-provider-headers')
        .set('CF-Connecting-IP', '1.2.3.4')
        .set('X-Vercel-Forwarded-For', '5.6.7.8')
        .set('X-Real-IP', '9.10.11.12')
        .set('X-Forwarded-For', '203.0.113.77');

      expect(res.status).toBe(200);
      // The rate limiter must ignore unverified provider headers and strictly evaluate req.ip
      expect(res.body.clientIp).toBe('203.0.113.77');
    });

    it('should reject forged Vercel headers on direct requests and prevent attackers from setting arbitrary identities', async () => {
      const testApp = express();
      testApp.set('trust proxy', 1);
      testApp.get('/test-forged-vercel', (req: Request, res: Response) => {
        res.json({ clientIp: extractClientIp(req) });
      });

      // Attacker attempts to forge all Vercel headers directly against the public backend
      const res = await supertest(testApp)
        .get('/test-forged-vercel')
        .set('X-Vercel-Id', 'bom1::fake-trace-id')
        .set('X-Forwarded-Host', 'fixflow-ai-home-repair-agent-two.vercel.app')
        .set('X-Vercel-Forwarded-For', '10.99.1.1')
        .set('X-Forwarded-For', '203.0.113.88');

      expect(res.status).toBe(200);
      // Pattern match alone is NOT trusted; must strictly fall back to verified req.ip (203.0.113.88)
      expect(res.body.clientIp).toBe('203.0.113.88');
    });

    it('should prevent an attacker from bypassing rate limits by rotating forged X-Vercel-Forwarded-For headers', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.set('trust proxy', 1);
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 2,
          message: 'Rate limit exceeded.',
        },
        customStore
      );

      testApp.post('/test-vercel-spoof-evasion', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Attacker sends forged IP 1
      const r1 = await supertest(testApp)
        .post('/test-vercel-spoof-evasion')
        .set('X-Vercel-Id', 'bom1::fake-1')
        .set('X-Forwarded-Host', 'fixflow-ai-home-repair-agent-two.vercel.app')
        .set('X-Vercel-Forwarded-For', '10.99.1.1')
        .set('X-Forwarded-For', '203.0.113.99');
      expect(r1.status).toBe(200);

      // Attacker rotates to forged IP 2 from same network connection
      const r2 = await supertest(testApp)
        .post('/test-vercel-spoof-evasion')
        .set('X-Vercel-Id', 'bom1::fake-2')
        .set('X-Forwarded-Host', 'fixflow-ai-home-repair-agent-two.vercel.app')
        .set('X-Vercel-Forwarded-For', '10.99.2.2')
        .set('X-Forwarded-For', '203.0.113.99');
      expect(r2.status).toBe(200);

      // Attacker rotates to forged IP 3 from same connection -> MUST BE BLOCKED (HTTP 429)
      const r3 = await supertest(testApp)
        .post('/test-vercel-spoof-evasion')
        .set('X-Vercel-Id', 'bom1::fake-3')
        .set('X-Forwarded-Host', 'fixflow-ai-home-repair-agent-two.vercel.app')
        .set('X-Vercel-Forwarded-For', '10.99.3.3')
        .set('X-Forwarded-For', '203.0.113.99');
      expect(r3.status).toBe(429);
      expect(r3.body.error).toBe('Rate limit exceeded.');
    });

    it('should support authenticated trusted proxy handoff when a valid server-to-server secret is verified', async () => {
      const originalSecret = process.env.TRUSTED_PROXY_SECRET;
      process.env.TRUSTED_PROXY_SECRET = 'secure-production-proxy-token-xyz';

      try {
        const testApp = express();
        testApp.set('trust proxy', 1);
        testApp.get('/test-trusted-proxy', (req: Request, res: Response) => {
          res.json({ clientIp: extractClientIp(req) });
        });

        // 1. Authenticated proxy request with valid secret -> trusts forwarded client IP
        const validRes = await supertest(testApp)
          .get('/test-trusted-proxy')
          .set('X-Trusted-Proxy-Secret', 'secure-production-proxy-token-xyz')
          .set('X-Forwarded-For', '198.51.100.42, 76.76.21.21');
        expect(validRes.status).toBe(200);
        expect(validRes.body.clientIp).toBe('198.51.100.42');

        // 2. Unauthenticated request with invalid secret -> rejects forwarded IP and falls back to req.ip
        const invalidRes = await supertest(testApp)
          .get('/test-trusted-proxy')
          .set('X-Trusted-Proxy-Secret', 'wrong-invalid-secret')
          .set('X-Forwarded-For', '198.51.100.42, 76.76.21.21');
        expect(invalidRes.status).toBe(200);
        expect(invalidRes.body.clientIp).toBe('76.76.21.21');

        // 3. Request with mismatched secret length -> safely rejects via constant-time comparison
        const mismatchRes = await supertest(testApp)
          .get('/test-trusted-proxy')
          .set('X-Trusted-Proxy-Secret', 'short')
          .set('X-Forwarded-For', '198.51.100.42, 76.76.21.21');
        expect(mismatchRes.status).toBe(200);
        expect(mismatchRes.body.clientIp).toBe('76.76.21.21');
      } finally {
        if (originalSecret !== undefined) {
          process.env.TRUSTED_PROXY_SECRET = originalSecret;
        } else {
          delete process.env.TRUSTED_PROXY_SECRET;
        }
      }
    });

    it('should fall back to socket remoteAddress on direct connections without proxy headers', () => {
      const mockReq = {
        ip: '',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      expect(extractClientIp(mockReq)).toBe('127.0.0.1');
    });
  });

  describe('2. Custom Rate Limiter Mechanics (Normal Requests, Exhaustion, Recovery)', () => {
    it('should return rate limit headers on normal requests', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.set('trust proxy', 1);
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
      testApp.set('trust proxy', 1);
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
      testApp.set('trust proxy', 1);
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
      testApp.set('trust proxy', 1);
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 1,
        },
        customStore
      );

      testApp.post(
        '/test-auth',
        (req: any, _res, next) => {
          const userId = req.headers['x-user-id'];
          if (userId) {
            req.user = { id: userId, name: 'Test', email: 'test@example.com' };
          }
          next();
        },
        limiter,
        (_req: Request, res: Response) => {
          res.json({ ok: true });
        }
      );

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
      testApp.set('trust proxy', 1);
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

    it('should prevent an unauthenticated client from bypassing limits by supplying forged session tokens or user headers', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.set('trust proxy', 1);
      const customStore = new MemoryRateLimitStore();
      const limiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 1,
        },
        customStore
      );

      // optionalAuth rejects invalid tokens; rate limiter keys by req.user?.id or extractClientIp
      testApp.post(
        '/test-guest-security',
        (req: any, _res, next) => {
          // Simulate auth middleware: forged token does not map to valid user in DB
          if (req.headers.authorization === 'Bearer valid-user-token') {
            req.user = { id: 'legit-user-1', name: 'Legit', email: 'legit@example.com' };
          }
          next();
        },
        limiter,
        (_req: Request, res: Response) => {
          res.json({ ok: true });
        }
      );

      // Caller makes 1st request as guest -> OK
      const r1 = await supertest(testApp)
        .post('/test-guest-security')
        .set('X-Forwarded-For', '203.0.113.150');
      expect(r1.status).toBe(200);

      // Caller tries to bypass limit by sending forged session token -> must STILL be blocked (HTTP 429)!
      const r2 = await supertest(testApp)
        .post('/test-guest-security')
        .set('Authorization', 'Bearer forged-invalid-token')
        .set('Cookie', 'fixflow_session=forged-fake-session')
        .set('X-Forwarded-For', '203.0.113.150');
      expect(r2.status).toBe(429);
      expect(r2.body.error).toContain('Rate limit exceeded');

      // Caller tries to bypass limit by sending forged X-User-Id header -> must STILL be blocked (HTTP 429)!
      const r3 = await supertest(testApp)
        .post('/test-guest-security')
        .set('X-User-Id', 'attacker-chosen-id')
        .set('X-Forwarded-For', '203.0.113.150');
      expect(r3.status).toBe(429);
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
