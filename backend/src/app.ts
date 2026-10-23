import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import appliancesRouter from './routes/appliances';
import repairsRouter from './routes/repairs';
import dashboardRouter from './routes/dashboard';
import { requireAuth } from './middleware/auth';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

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

// Protected Homeowner Routes (require active session)
app.use('/api/appliances', requireAuth, appliancesRouter);
app.use('/api/repairs', requireAuth, repairsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

// Centralized error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

export default app;
