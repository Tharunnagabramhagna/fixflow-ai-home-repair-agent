import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initializeDatabase } from './db/database';
import { seedDatabase } from './db/seed';

const PORT = process.env.PORT || 3001;

// Initialize database schema and seed reproducible demo data
initializeDatabase();
seedDatabase();

app.listen(PORT, () => {
  console.log(`FixFlow API Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
