import crypto from 'crypto';
import db from '../db/database';
import { Database as DatabaseType } from 'better-sqlite3';

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

export const DEMO_USER: AuthUser = {
  id: 'demo-user-alex',
  name: 'Alex Carter',
  email: 'alex.carter@gmail.com',
  role: 'homeowner',
};

// 7 days in milliseconds
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class AuthService {
  createDemoSession(targetDb: DatabaseType = db): { session: UserSession; token: string } {
    const token = generateToken();
    const token_hash = hashToken(token);
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

    const stmt = targetDb.prepare(`
      INSERT INTO user_sessions (id, token_hash, user_id, user_name, user_email, role, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);

    stmt.run(id, token_hash, DEMO_USER.id, DEMO_USER.name, DEMO_USER.email, DEMO_USER.role, expiresAt);

    const session: UserSession = {
      id,
      token_hash,
      user_id: DEMO_USER.id,
      user_name: DEMO_USER.name,
      user_email: DEMO_USER.email,
      role: DEMO_USER.role,
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

      return {
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          role: row.role,
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

  cleanExpiredSessions(targetDb: DatabaseType = db): number {
    try {
      const result = targetDb.prepare("DELETE FROM user_sessions WHERE datetime(expires_at) <= datetime('now')").run();
      return result.changes;
    } catch {
      return 0;
    }
  }
}

export const authService = new AuthService();
