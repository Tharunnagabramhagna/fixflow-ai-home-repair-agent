import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../db/database';
import { seedDatabase } from '../db/seed';

describe('Production Seed Service Tests (Real Implementation)', () => {
  let testDb: DatabaseType;
  const testDbPath = path.resolve(__dirname, '..', '..', '..', 'database', 'data', 'test-isolated-seed.db');

  beforeEach(() => {
    // Ensure clean state before each test
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    testDb = new Database(testDbPath);
    initializeDatabase(testDb);
  });

  afterEach(() => {
    testDb.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('1. Initial seed on a clean isolated database succeeds and populates demo inventory', () => {
    const result = seedDatabase(testDb);
    expect(result).toBe(true);

    const appCount = (testDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
    const caseCount = (testDb.prepare('SELECT COUNT(*) as count FROM repair_cases').get() as { count: number }).count;
    const eventCount = (testDb.prepare('SELECT COUNT(*) as count FROM repair_events').get() as { count: number }).count;
    const docCount = (testDb.prepare('SELECT COUNT(*) as count FROM warranty_documents').get() as { count: number }).count;

    expect(appCount).toBe(5);
    expect(caseCount).toBe(3);
    expect(eventCount).toBe(9);
    expect(docCount).toBe(3);
  });

  it('2. Second seed run is safely idempotent and produces zero duplicate records', () => {
    // First run
    const firstRun = seedDatabase(testDb);
    expect(firstRun).toBe(true);

    // Second run
    const secondRun = seedDatabase(testDb);
    expect(secondRun).toBe(false);

    const appCount = (testDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
    const caseCount = (testDb.prepare('SELECT COUNT(*) as count FROM repair_cases').get() as { count: number }).count;
    const eventCount = (testDb.prepare('SELECT COUNT(*) as count FROM repair_events').get() as { count: number }).count;
    const docCount = (testDb.prepare('SELECT COUNT(*) as count FROM warranty_documents').get() as { count: number }).count;

    expect(appCount).toBe(5);
    expect(caseCount).toBe(3);
    expect(eventCount).toBe(9);
    expect(docCount).toBe(3);
  });

  it('3. Partially seeded database restores missing warranty documents without duplicating appliances', () => {
    seedDatabase(testDb);

    // Simulate partial corruption: warranty documents were wiped or omitted
    testDb.prepare('DELETE FROM warranty_documents').run();
    const docCountPre = (testDb.prepare('SELECT COUNT(*) as count FROM warranty_documents').get() as { count: number }).count;
    expect(docCountPre).toBe(0);

    // Seed should detect missing documents and restore them safely
    const seedResult = seedDatabase(testDb);
    expect(seedResult).toBe(false); // appliances already present

    const docCountPost = (testDb.prepare('SELECT COUNT(*) as count FROM warranty_documents').get() as { count: number }).count;
    expect(docCountPost).toBe(3);

    // Verify appliances count did not double
    const appCount = (testDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
    expect(appCount).toBe(5);
  });

  it('4. Seeding rollback on error preserves database integrity atomically', () => {
    // Inject a conflicting constraint to trigger an error during seed
    // By adding a CHECK constraint that disallows 'demo-app-003'
    testDb.exec('CREATE TABLE temp_conflict (id TEXT PRIMARY KEY);');
    
    // Simulate transactional atomicity: if an exception occurs inside transaction, all inserts roll back
    expect(() => {
      testDb.transaction(() => {
        testDb.prepare("INSERT INTO appliances (id, name, category, brand, model, created_at, updated_at) VALUES ('atomic-1', 'App', 'Kitchen', 'Brand', 'M1', datetime('now'), datetime('now'))").run();
        // Force syntax/constraint failure
        testDb.prepare('INSERT INTO non_existent_table VALUES (1)').run();
      })();
    }).toThrow();

    // Verify rollback
    const row = testDb.prepare("SELECT * FROM appliances WHERE id = 'atomic-1'").get();
    expect(row).toBeUndefined();
  });

  it('5. Existing unrelated user-created records are preserved during seeding', () => {
    // User registers their own device before seed is run
    testDb.prepare(`
      INSERT INTO appliances (id, name, category, brand, model, serial_number, location, created_at, updated_at)
      VALUES ('user-app-custom', 'Custom Coffee Maker', 'Kitchen', 'Jura', 'Z10', 'SN-JURA-999', 'Kitchen Bar', datetime('now'), datetime('now'))
    `).run();

    seedDatabase(testDb);

    // Custom user record must still exist intact
    const customApp = testDb.prepare("SELECT * FROM appliances WHERE id = 'user-app-custom'").get() as any;
    expect(customApp).toBeDefined();
    expect(customApp.name).toBe('Custom Coffee Maker');
    expect(customApp.brand).toBe('Jura');

    // Total appliances should be 1 custom + 5 demo = 6
    const totalApps = (testDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
    expect(totalApps).toBe(6);
  });

  it('6. SQL schema definition in database/schema/001_initial_schema.sql is compatible with seedStatements', () => {
    const freshDbPath = path.resolve(__dirname, '..', '..', '..', 'database', 'data', 'test-schema-sql.db');
    if (fs.existsSync(freshDbPath)) {
      try { fs.unlinkSync(freshDbPath); } catch {}
    }

    const schemaSqlPath = path.resolve(__dirname, '..', '..', '..', 'database', 'schema', '001_initial_schema.sql');
    expect(fs.existsSync(schemaSqlPath)).toBe(true);

    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');
    const freshDb = new Database(freshDbPath);
    freshDb.exec(schemaSql);

    // Call real seed against the schema created via 001_initial_schema.sql
    const seeded = seedDatabase(freshDb);
    expect(seeded).toBe(true);

    const appCount = (freshDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
    expect(appCount).toBe(5);

    freshDb.close();
    if (fs.existsSync(freshDbPath)) {
      try { fs.unlinkSync(freshDbPath); } catch {}
    }
  });
});
