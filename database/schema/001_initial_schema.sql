-- FixFlow Database Schema: 001_initial_schema.sql
-- SQLite schema for household appliances, repair cases, repair events, and warranty documents

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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

CREATE INDEX IF NOT EXISTS idx_repair_cases_appliance ON repair_cases(appliance_id);
CREATE INDEX IF NOT EXISTS idx_repair_cases_status ON repair_cases(status);
CREATE INDEX IF NOT EXISTS idx_repair_events_case ON repair_events(case_id);
CREATE INDEX IF NOT EXISTS idx_repair_events_created ON repair_events(created_at);
CREATE INDEX IF NOT EXISTS idx_warranty_docs_appliance ON warranty_documents(appliance_id);
