import { Router, Request, Response } from 'express';
import { authService, SESSION_DURATION_MS } from '../services/authService';
import { extractSessionToken } from '../middleware/auth';

const router = Router();

// GET /api/auth/session — Check current session validity
router.get('/session', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (!token) {
    return res.json({ authenticated: false, user: null });
  }

  const session = authService.getSessionByToken(token);
  if (!session) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: session.user,
    expires_at: session.expires_at,
  });
});

// POST /api/auth/demo-login — Enter as Demo Homeowner (Alex Carter)
router.post('/demo-login', (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const demoExplicitlyEnabled = process.env.ENABLE_DEMO_LOGIN === 'true';

  if (isProduction && !demoExplicitlyEnabled) {
    return res.status(403).json({ error: 'Demo login is disabled in production environment.' });
  }

  const { session, token } = authService.createDemoSession();

  // Set HttpOnly cookie
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeSeconds = Math.floor(SESSION_DURATION_MS / 1000);
  const cookieFlags = [
    `fixflow_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isSecure) {
    cookieFlags.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieFlags.join('; '));

  return res.status(200).json({
    authenticated: true,
    user: {
      id: session.user_id,
      name: session.user_name,
      email: session.user_email,
      role: session.role,
    },
    token, // Provided for programmatic clients / API testing
  });
});

// POST /api/auth/logout — Invalidate server session and clear cookie
router.post('/logout', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    authService.deleteSession(token);
  }

  // Clear session cookie with Max-Age=0
  res.setHeader(
    'Set-Cookie',
    'fixflow_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  return res.json({ authenticated: false, message: 'Logged out successfully' });
});

export default router;
