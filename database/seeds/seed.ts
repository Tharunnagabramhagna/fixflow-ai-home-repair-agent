/**
 * FixFlow — Database Seed Entrypoint
 * 
 * Delegates directly to the authoritative production seed implementation in
 * backend/src/db/seed.ts to eliminate redundant seed logic and ensure a single
 * source of truth.
 */

export { seedDatabase } from '../../backend/src/db/seed';
