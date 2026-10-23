import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import db, { initializeDatabase } from '../db/database';
import { hashToken } from '../services/authService';

beforeAll(() => {
  initializeDatabase();
  db.exec('DELETE FROM user_sessions;');
  db.exec("DELETE FROM users WHERE email LIKE '%@example.com';");
});

describe('Production Authentication & Guest Access API Tests', () => {
  let userACookie: string;
  let userAToken: string;
  let userAId: string;
  let userAApplianceId: string;

  let userBCookie: string;
  let userBToken: string;
  let userBId: string;

  const testUserA = {
    name: 'Sarah Connor',
    email: 'sarah.connor@example.com',
    password: 'SecurePassword123!',
  };

  const testUserB = {
    name: 'John Connor',
    email: 'john.connor@example.com',
    password: 'DifferentPassword456!',
  };

  describe('1. Unauthenticated Session Checks & Guest Access', () => {
    it('GET /api/auth/session should return authenticated: false when no session exists', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.user).toBeNull();
    });

    it('Guest mode: GET /api/appliances should return sample appliances without requiring login', async () => {
      const res = await request(app).get('/api/appliances');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // All sample appliances have user_id = 'sample' or null
      for (const app of res.body.data) {
        expect(['sample', null, undefined]).toContain(app.user_id);
      }
    });

    it('Guest mode: GET /api/dashboard/summary should return sample workspace statistics', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.data.counts).toBeDefined();
      expect(res.body.data.is_sample_workspace).toBe(true);
    });

    it('Mutations: POST /api/appliances should return 401 when x-enforce-auth is set without session', async () => {
      const res = await request(app)
        .post('/api/appliances')
        .send({
          name: 'Unauthorized Stove',
          category: 'Kitchen',
          brand: 'Bosch',
          model: 'HGI8056UC',
        })
        .set('x-enforce-auth', 'true');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/i);
    });
  });

  describe('2. Account Registration Flow', () => {
    it('Rejects registration with invalid email or short password', async () => {
      const resBadEmail = await request(app).post('/api/auth/register').send({
        name: 'Test Person',
        email: 'invalid-email',
        password: 'Password123!',
      });
      expect(resBadEmail.status).toBe(400);
      expect(resBadEmail.body.error).toMatch(/valid email/i);

      const resShortPw = await request(app).post('/api/auth/register').send({
        name: 'Test Person',
        email: 'test@example.com',
        password: 'short',
      });
      expect(resShortPw.status).toBe(400);
      expect(resShortPw.body.error).toMatch(/at least 8 characters/i);
    });

    it('Successfully registers User A and issues HttpOnly cookie and session', async () => {
      const res = await request(app).post('/api/auth/register').send(testUserA);
      expect(res.status).toBe(201);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(testUserA.name);
      expect(res.body.user.email).toBe(testUserA.email);
      expect(res.body.token).toBeDefined();

      userAId = res.body.user.id;
      userAToken = res.body.token;

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookieStr = cookies.find((c: string) => c.startsWith('fixflow_session='));
      expect(sessionCookieStr).toBeDefined();
      expect(sessionCookieStr).toContain('HttpOnly');
      expect(sessionCookieStr).toContain('SameSite=Lax');

      userACookie = sessionCookieStr.split(';')[0];
    });

    it('Database stores bcrypt password hash, never plaintext password', () => {
      const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(testUserA.email) as any;
      expect(row).toBeDefined();
      expect(row.password_hash).not.toBe(testUserA.password);
      expect(row.password_hash).toMatch(/^\$2[aby]\$\d+\$/); // Standard bcrypt prefix
    });

    it('Rejects duplicate registration with same email address', async () => {
      const res = await request(app).post('/api/auth/register').send(testUserA);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('3. Account Sign-In Flow', () => {
    it('Rejects login with invalid password or unregistered email', async () => {
      const resWrongPw = await request(app).post('/api/auth/login').send({
        email: testUserA.email,
        password: 'WrongPassword123!',
      });
      expect(resWrongPw.status).toBe(401);
      expect(resWrongPw.body.error).toMatch(/invalid email or password/i);

      const resNoUser = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });
      expect(resNoUser.status).toBe(401);
      expect(resNoUser.body.error).toMatch(/invalid email or password/i);
    });

    it('Registers User B to test cross-user isolation', async () => {
      const res = await request(app).post('/api/auth/register').send(testUserB);
      expect(res.status).toBe(201);
      userBId = res.body.user.id;
      userBToken = res.body.token;
      const cookies = res.headers['set-cookie'];
      userBCookie = cookies.find((c: string) => c.startsWith('fixflow_session=')).split(';')[0];
    });

    it('Signs in User A successfully with verified credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testUserA.email,
        password: testUserA.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.email).toBe(testUserA.email);
    });
  });

  describe('4. Session Validation and Token Hashing', () => {
    it('GET /api/auth/session validates session via HttpOnly cookie', async () => {
      const res = await request(app).get('/api/auth/session').set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.id).toBe(userAId);
    });

    it('GET /api/auth/session validates session via Bearer authorization header', async () => {
      const res = await request(app).get('/api/auth/session').set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.name).toBe(testUserA.name);
    });

    it('Database stores SHA-256 hash of session token, not plain token', () => {
      const expectedHash = hashToken(userAToken);
      const row = db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(expectedHash) as any;
      expect(row).toBeDefined();
      expect(row.user_id).toBe(userAId);
      expect(row.token_hash).not.toBe(userAToken);
    });
  });

  describe('5. Cross-User Data Isolation & Ownership', () => {
    it('User A registers a private appliance', async () => {
      const res = await request(app)
        .post('/api/appliances')
        .set('Cookie', userACookie)
        .send({
          name: "Sarah's Induction Cooktop",
          category: 'Kitchen',
          brand: 'Miele',
          model: 'KM-6365',
          serial_number: 'SN-SARAH-9988',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      userAApplianceId = res.body.data.id;
    });

    it('User A can see their own appliance in their inventory', async () => {
      const res = await request(app).get('/api/appliances').set('Cookie', userACookie);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((a: any) => a.id);
      expect(ids).toContain(userAApplianceId);
    });

    it('User B CANNOT see User A private appliance in their inventory', async () => {
      const res = await request(app).get('/api/appliances').set('Cookie', userBCookie);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((a: any) => a.id);
      expect(ids).not.toContain(userAApplianceId);
    });

    it('User B cannot retrieve User A private appliance by direct ID (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/appliances/${userAApplianceId}`)
        .set('Cookie', userBCookie);
      expect(res.status).toBe(404);
    });

    it('User B cannot create a repair ticket on User A private appliance (returns 403)', async () => {
      const res = await request(app)
        .post('/api/repairs')
        .set('Cookie', userBCookie)
        .send({
          appliance_id: userAApplianceId,
          issue_description: 'Attempting unauthorized repair reporting on User A appliance',
          priority: 'high',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('6. Sign-Out & Session Invalidation', () => {
    it('POST /api/auth/logout invalidates session and clears cookie', async () => {
      const res = await request(app).post('/api/auth/logout').set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);

      // Verify session deleted from database
      const expectedHash = hashToken(userAToken);
      const row = db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(expectedHash);
      expect(row).toBeUndefined();

      // Subsequent session check is unauthenticated
      const checkRes = await request(app).get('/api/auth/session').set('Cookie', userACookie);
      expect(checkRes.body.authenticated).toBe(false);
    });
  });
});
