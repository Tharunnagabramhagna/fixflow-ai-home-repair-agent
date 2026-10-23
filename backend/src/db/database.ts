import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Resolve to database/data directory (three levels up from src/db or dist/db)
const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'database', 'data');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In test environment, automatically use an isolated test database to prevent dev data contamination
const defaultDbName = process.env.NODE_ENV === 'test' ? 'test-fixflow.db' : 'fixflow.db';
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, defaultDbName);

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance and enforce foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Path to authoritative schema definition
const SCHEMA_FILE_PATH = path.resolve(__dirname, '..', '..', '..', 'database', 'schema', '001_initial_schema.sql');

const FALLBACK_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS appliances (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT,
    purchase_date TEXT,
    warranty_expiration TEXT,
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS repair_cases (
    id TEXT PRIMARY KEY,
    appliance_id TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'diagnosed', 'scheduled', 'in_progress', 'resolved', 'closed')),
    appointment_date TEXT,
    appointment_notes TEXT,
    resolution_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS repair_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('created', 'status_change', 'note_added', 'appointment_set', 'resolved', 'closed')),
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (case_id) REFERENCES repair_cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS warranty_documents (
    id TEXT PRIMARY KEY,
    appliance_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'homeowner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_repair_cases_appliance ON repair_cases(appliance_id);
  CREATE INDEX IF NOT EXISTS idx_repair_cases_status ON repair_cases(status);
  CREATE INDEX IF NOT EXISTS idx_repair_events_case ON repair_events(case_id);
  CREATE INDEX IF NOT EXISTS idx_repair_events_created ON repair_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_warranty_docs_appliance ON warranty_documents(appliance_id);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
`;

const SESSIONS_SCHEMA_FILE_PATH = path.resolve(__dirname, '..', '..', '..', 'database', 'schema', '002_sessions_schema.sql');

export function initializeDatabase(targetDb?: DatabaseType): void {
  const activeDb = targetDb || db;
  activeDb.pragma('foreign_keys = ON');
  activeDb.pragma('journal_mode = WAL');

  let schemaSql = FALLBACK_SCHEMA_SQL;
  if (fs.existsSync(SCHEMA_FILE_PATH)) {
    schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf-8');
  }

  activeDb.exec(schemaSql);

  // Apply sessions schema migration if exists
  if (fs.existsSync(SESSIONS_SCHEMA_FILE_PATH)) {
    activeDb.exec(fs.readFileSync(SESSIONS_SCHEMA_FILE_PATH, 'utf-8'));
  } else {
    activeDb.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'homeowner',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    `);
  }
}

export default db;
