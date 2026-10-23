import { Router, Request, Response } from 'express';
import { authService, SESSION_DURATION_MS } from '../services/authService';
import { extractSessionToken } from '../middleware/auth';

const router = Router();

function setSessionCookie(res: Response, req: Request, token: string): void {
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
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'fixflow_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
}

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

// POST /api/auth/register — Register a new homeowner account
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body || {};
    const { user, token } = await authService.register({ name, email, password });

    setSessionCookie(res, req, token);

    return res.status(201).json({
      authenticated: true,
      user,
      token,
      message: 'Account created successfully',
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      error: err.message || 'Registration failed. Please check your information and try again.',
    });
  }
});

// POST /api/auth/login — Authenticate with email & password
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const { user, token } = await authService.login({ email, password });

    setSessionCookie(res, req, token);

    return res.status(200).json({
      authenticated: true,
      user,
      token,
      message: 'Signed in successfully',
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({
      error: err.message || 'Invalid email or password.',
    });
  }
});

// POST /api/auth/logout — Invalidate server session and clear cookie
router.post('/logout', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    authService.deleteSession(token);
  }

  clearSessionCookie(res);
  return res.json({ authenticated: false, message: 'Logged out successfully' });
});

export default router;
