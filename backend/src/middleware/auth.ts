import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function extractSessionToken(req: Request): string | null {
  // Check Authorization header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check Cookie header (fixflow_session=<token>)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, pair) => {
      const [key, ...val] = pair.trim().split('=');
      if (key) acc[key] = decodeURIComponent(val.join('='));
      return acc;
    }, {} as Record<string, string>);

    if (cookies.fixflow_session) {
      return cookies.fixflow_session;
    }
  }

  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);

  if (token) {
    const session = authService.getSessionByToken(token);
    if (session) {
      req.user = session.user;
      return next();
    }
    res.status(401).json({ error: 'Session expired or invalid. Please sign in.' });
    return;
  }

  // In test environment, allow test bypass only when x-enforce-auth is not requested
  if (process.env.NODE_ENV === 'test' && process.env.ENFORCE_TEST_AUTH !== 'true' && !req.headers['x-enforce-auth']) {
    return next();
  }

  res.status(401).json({ error: 'Authentication required. Please sign in.' });
}
