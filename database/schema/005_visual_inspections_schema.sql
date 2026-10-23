-- FixFlow Database Schema: 005_visual_inspections_schema.sql
-- Multimodal AI Repair Diagnostics & Visual Inspection Schema

CREATE TABLE IF NOT EXISTS visual_inspections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  appliance_id TEXT,
  case_id TEXT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  storage_path TEXT NOT NULL,
  user_description TEXT,
  analysis_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'failed', 'processing')),
  error_message TEXT,
  has_hazard INTEGER NOT NULL DEFAULT 0 CHECK(has_hazard IN (0, 1)),
  applied_to_record INTEGER NOT NULL DEFAULT 0 CHECK(applied_to_record IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE SET NULL,
  FOREIGN KEY (case_id) REFERENCES repair_cases(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_visual_inspections_user ON visual_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_inspections_appliance ON visual_inspections(appliance_id);
CREATE INDEX IF NOT EXISTS idx_visual_inspections_case ON visual_inspections(case_id);
CREATE INDEX IF NOT EXISTS idx_visual_inspections_created ON visual_inspections(created_at);
CREATE INDEX IF NOT EXISTS idx_visual_inspections_hazard ON visual_inspections(has_hazard);
