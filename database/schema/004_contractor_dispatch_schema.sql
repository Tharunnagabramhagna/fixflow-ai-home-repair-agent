-- FixFlow Database Schema: 004_contractor_dispatch_schema.sql
-- Contractor Dispatch Simulation and Live Event Streaming Schema

CREATE TABLE IF NOT EXISTS contractor_dispatches (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  contractor_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  vehicle_info TEXT,
  estimated_arrival_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'dispatched', 'en_route', 'arrived', 'completed', 'cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dispatched_at TEXT,
  en_route_at TEXT,
  arrived_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (case_id) REFERENCES repair_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contractor_dispatches_case ON contractor_dispatches(case_id);
CREATE INDEX IF NOT EXISTS idx_contractor_dispatches_user ON contractor_dispatches(user_id);
CREATE INDEX IF NOT EXISTS idx_contractor_dispatches_status ON contractor_dispatches(status);

CREATE TABLE IF NOT EXISTS dispatch_events (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dispatch_id) REFERENCES contractor_dispatches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_dispatch ON dispatch_events(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_events_case ON dispatch_events(case_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_events_created ON dispatch_events(created_at);
