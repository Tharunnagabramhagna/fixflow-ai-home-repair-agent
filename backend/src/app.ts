import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import appliancesRouter from './routes/appliances';
import repairsRouter from './routes/repairs';
import dashboardRouter from './routes/dashboard';
import assistantRouter from './routes/assistant';
import alexaRouter from './routes/alexa';
import inspectionsRouter from './routes/inspections';
import alexaPlusRouter from './routes/alexaPlus';
import { optionalAuth } from './middleware/auth';

const app = express();

// Trust reverse proxy (Railway, Vercel rewrite, Cloudflare)
app.set('trust proxy', 1);

// Helper to parse allowed origins from comma-separated CORS_ORIGIN
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGIN || '';
  return envOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Allow requests with no Origin header (curl, mobile apps, server-to-server,
      // Alexa webhooks, internal proxy requests)
      if (!origin) {
        return callback(null, true);
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const allowedOrigins = getAllowedOrigins();

      // 2. Exact match in configured CORS_ORIGIN allowlist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 3. In development/testing, permit localhost and 127.0.0.1 on any port
      if (!isProduction && LOCALHOST_ORIGIN_REGEX.test(origin)) {
        return callback(null, true);
      }

      // 4. Reject unapproved browser origins in production
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not allowed.`));
    },
    credentials: true,
  })
);

// Save raw request body for cryptographic signature verification (e.g. Alexa Skills Kit)
app.use(
  express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Request logging in non-test environment
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'FixFlow API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes (public)
app.use('/api/auth', authRouter);

// Homeowner & Guest workspace routes (optionalAuth extracts session if present; mutations enforce requireAuth)
app.use('/api/appliances', optionalAuth, appliancesRouter);
app.use('/api/repairs', optionalAuth, repairsRouter);
app.use('/api/dashboard', optionalAuth, dashboardRouter);
app.use('/api/assistant', optionalAuth, assistantRouter);
app.use('/api/alexa', alexaRouter);
app.use('/api/alexa-plus/v1', optionalAuth, alexaPlusRouter);
app.use('/api/alexa-plus', optionalAuth, alexaPlusRouter);
app.use('/api/inspections', optionalAuth, inspectionsRouter);


// Centralized error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message && err.message.startsWith('CORS policy violation')) {
    res.status(403).json({
      error: err.message,
    });
    return;
  }
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

export default app;
