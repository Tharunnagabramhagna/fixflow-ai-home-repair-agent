import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import db, { initializeDatabase } from '../db/database';
import { hashToken, DEMO_USER } from '../services/authService';

beforeAll(() => {
  initializeDatabase();
  db.exec('DELETE FROM user_sessions;');
});

describe('Authentication & Session Management API Tests', () => {
  let sessionCookie: string;
  let sessionToken: string;

  describe('1. Unauthenticated Session Checks', () => {
    it('GET /api/auth/session should return authenticated: false when no session exists', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.user).toBeNull();
    });

    it('Protected endpoints should return 401 when x-enforce-auth is set without credentials', async () => {
      const resAppliances = await request(app)
        .get('/api/appliances')
        .set('x-enforce-auth', 'true');
      expect(resAppliances.status).toBe(401);
      expect(resAppliances.body.error).toMatch(/Authentication required/i);

      const resRepairs = await request(app)
        .get('/api/repairs')
        .set('x-enforce-auth', 'true');
      expect(resRepairs.status).toBe(401);

      const resDashboard = await request(app)
        .get('/api/dashboard/summary')
        .set('x-enforce-auth', 'true');
      expect(resDashboard.status).toBe(401);
    });
  });

  describe('2. Demo Login & Session Creation', () => {
    it('POST /api/auth/demo-login should issue session and set HttpOnly cookie', async () => {
      const res = await request(app).post('/api/auth/demo-login');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(DEMO_USER.name);
      expect(res.body.user.email).toBe(DEMO_USER.email);
      expect(res.body.token).toBeDefined();

      sessionToken = res.body.token;

      // Check Set-Cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookieStr = cookies.find((c: string) => c.startsWith('fixflow_session='));
      expect(sessionCookieStr).toBeDefined();
      expect(sessionCookieStr).toContain('HttpOnly');
      expect(sessionCookieStr).toContain('SameSite=Lax');

      sessionCookie = sessionCookieStr.split(';')[0];
    });

    it('Database should store only the SHA-256 hash of the session token, not plain token', () => {
      const expectedHash = hashToken(sessionToken);
      const row = db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(expectedHash) as any;
      expect(row).toBeDefined();
      expect(row.user_email).toBe(DEMO_USER.email);
      expect(row.token_hash).toBe(expectedHash);
      expect(row.token_hash).not.toBe(sessionToken);
    });
  });

  describe('3. Authenticated Session Validation', () => {
    it('GET /api/auth/session should return authenticated: true when cookie is sent', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', sessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(DEMO_USER.email);
    });

    it('GET /api/auth/session should return authenticated: true when Bearer token is sent', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.name).toBe(DEMO_USER.name);
    });

    it('Protected endpoints should allow access when valid session cookie is provided', async () => {
      const res = await request(app)
        .get('/api/appliances')
        .set('Cookie', sessionCookie)
        .set('x-enforce-auth', 'true');
      expect(res.status).toBe(200);
    });
  });

  describe('4. Invalid and Expired Sessions', () => {
    it('GET /api/auth/session with a forged or invalid token should return authenticated: false', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', 'fixflow_session=invalid-forged-token-12345');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.user).toBeNull();
    });

    it('Expired session in database should be detected and rejected', async () => {
      // Create an expired session in DB directly
      const expiredToken = 'expired-test-token-abcdef';
      const expiredHash = hashToken(expiredToken);
      const pastDate = new Date(Date.now() - 1000 * 60).toISOString(); // 1 minute ago

      db.prepare(`
        INSERT INTO user_sessions (id, token_hash, user_id, user_name, user_email, role, created_at, expires_at)
        VALUES ('expired-session-id', ?, 'test-user', 'Expired User', 'expired@test.com', 'homeowner', datetime('now'), ?)
      `).run(expiredHash, pastDate);

      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);

      // Verify the expired session was purged
      const row = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get('expired-session-id');
      expect(row).toBeUndefined();
    });
  });

  describe('5. Logout and Session Invalidation', () => {
    it('POST /api/auth/logout should invalidate session and clear cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);

      // Check that Set-Cookie expires the cookie immediately
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies.find((c: string) => c.startsWith('fixflow_session='));
      expect(clearedCookie).toContain('Max-Age=0');

      // Verify token hash is no longer in database
      const expectedHash = hashToken(sessionToken);
      const row = db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(expectedHash);
      expect(row).toBeUndefined();
    });

    it('Subsequent checks after logout should return unauthenticated and 401 on protected routes', async () => {
      const resSession = await request(app)
        .get('/api/auth/session')
        .set('Cookie', sessionCookie);
      expect(resSession.body.authenticated).toBe(false);

      const resProtected = await request(app)
        .get('/api/appliances')
        .set('Cookie', sessionCookie)
        .set('x-enforce-auth', 'true');
      expect(resProtected.status).toBe(401);
    });
  });
});
