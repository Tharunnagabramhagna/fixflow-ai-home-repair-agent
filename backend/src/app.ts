import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import appliancesRouter from './routes/appliances';
import repairsRouter from './routes/repairs';
import dashboardRouter from './routes/dashboard';
import assistantRouter from './routes/assistant';
import alexaRouter from './routes/alexa';
import { optionalAuth } from './middleware/auth';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

// Save raw request body for cryptographic signature verification (e.g. Alexa Skills Kit)
app.use(
  express.json({
    limit: '2mb',
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


// Centralized error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

export default app;
