import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db/database';
import { Database as DatabaseType } from 'better-sqlite3';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  token_hash: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// 7 days in milliseconds
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export class AuthService {
  async register(
    input: RegisterInput,
    targetDb: DatabaseType = db
  ): Promise<{ user: AuthUser; session: UserSession; token: string }> {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!name || name.length < 2) {
      const err = new Error('Full name must be at least 2 characters.');
      (err as any).statusCode = 400;
      throw err;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      const err = new Error('Please enter a valid email address.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!password || password.length < 8) {
      const err = new Error('Password must be at least 8 characters long.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Check duplicate email
    const existing = targetDb.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (existing) {
      const err = new Error('An account with this email address already exists. Please sign in instead.');
      (err as any).statusCode = 409;
      throw err;
    }

    const id = crypto.randomUUID();
    const password_hash = await hashPassword(password);
    const now = new Date().toISOString();

    targetDb.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'homeowner', ?, ?)
    `).run(id, name, email, password_hash, now, now);

    const user: AuthUser = {
      id,
      name,
      email,
      role: 'homeowner',
    };

    const { session, token } = this.createSessionForUser(user, targetDb);
    return { user, session, token };
  }

  async login(
    input: LoginInput,
    targetDb: DatabaseType = db
  ): Promise<{ user: AuthUser; session: UserSession; token: string }> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      const err = new Error('Please enter both email and password.');
      (err as any).statusCode = 400;
      throw err;
    }

    const row = targetDb.prepare(`
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ? COLLATE NOCASE
    `).get(email) as any;

    if (!row) {
      const err = new Error('Invalid email or password.');
      (err as any).statusCode = 401;
      throw err;
    }

    const match = await verifyPassword(password, row.password_hash);
    if (!match) {
      const err = new Error('Invalid email or password.');
      (err as any).statusCode = 401;
      throw err;
    }

    const user: AuthUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role || 'homeowner',
    };

    const { session, token } = this.createSessionForUser(user, targetDb);
    return { user, session, token };
  }

  createSessionForUser(
    user: AuthUser,
    targetDb: DatabaseType = db
  ): { session: UserSession; token: string } {
    const token = generateToken();
    const token_hash = hashToken(token);
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

    targetDb.prepare(`
      INSERT INTO user_sessions (id, token_hash, user_id, user_name, user_email, role, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(id, token_hash, user.id, user.name, user.email, user.role, expiresAt);

    const session: UserSession = {
      id,
      token_hash,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: user.role,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    };

    return { session, token };
  }

  getSessionByToken(token: string, targetDb: DatabaseType = db): { user: AuthUser; expires_at: string } | null {
    if (!token) return null;
    const token_hash = hashToken(token);

    try {
      const row = targetDb.prepare(`
        SELECT id, token_hash, user_id, user_name, user_email, role, created_at, expires_at
        FROM user_sessions
        WHERE token_hash = ?
      `).get(token_hash) as UserSession | undefined;

      if (!row) return null;

      // Check expiration
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        targetDb.prepare('DELETE FROM user_sessions WHERE id = ?').run(row.id);
        return null;
      }

      // Check if user still exists in users table to reflect updated profile info
      const userRecord = targetDb.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(row.user_id) as any;

      return {
        user: {
          id: userRecord?.id || row.user_id,
          name: userRecord?.name || row.user_name,
          email: userRecord?.email || row.user_email,
          role: userRecord?.role || row.role || 'homeowner',
        },
        expires_at: row.expires_at,
      };
    } catch {
      return null;
    }
  }

  deleteSession(token: string, targetDb: DatabaseType = db): boolean {
    if (!token) return false;
    const token_hash = hashToken(token);
    try {
      const result = targetDb.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(token_hash);
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  purgeExpiredSessions(targetDb: DatabaseType = db): number {
    try {
      const result = targetDb.prepare("DELETE FROM user_sessions WHERE expires_at <= datetime('now')").run();
      return result.changes;
    } catch {
      return 0;
    }
  }
}

export const authService = new AuthService();
export default authService;
