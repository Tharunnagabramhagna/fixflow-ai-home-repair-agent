import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initializeDatabase } from './db/database';
import { seedDatabase } from './db/seed';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database schema and seed reproducible demo data safely
try {
  initializeDatabase();
  seedDatabase();
} catch (err: any) {
  console.error('[Startup Fatal Error] Database initialization or seed failed:', err?.message || err);
  process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
  console.log(`FixFlow API Server listening on ${HOST}:${PORT} (environment: ${process.env.NODE_ENV || 'development'})`);
  console.log('Health check endpoint available at /api/health');
});

server.on('error', (err: any) => {
  console.error('[Startup Fatal Error] Server failed to bind port:', err?.message || err);
  process.exit(1);
});
