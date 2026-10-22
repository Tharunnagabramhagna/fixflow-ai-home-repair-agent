import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import appliancesRouter from './routes/appliances';
import repairsRouter from './routes/repairs';
import dashboardRouter from './routes/dashboard';

const app = express();

app.use(cors());
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

// Routes
app.use('/api/appliances', appliancesRouter);
app.use('/api/repairs', repairsRouter);
app.use('/api/dashboard', dashboardRouter);

// Centralized error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

export default app;
