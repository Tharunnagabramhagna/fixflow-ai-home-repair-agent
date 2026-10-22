import { v4 as uuidv4 } from 'uuid';
import { Database as DatabaseType } from 'better-sqlite3';
import db from '../db/database';
import type { CreateApplianceInput } from '../validators';

export interface Appliance {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_expiration: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getAllAppliances(targetDb?: DatabaseType): Appliance[] {
  const activeDb = targetDb || db;
  return activeDb.prepare('SELECT * FROM appliances ORDER BY created_at DESC').all() as Appliance[];
}

export function getApplianceById(id: string, targetDb?: DatabaseType): Appliance | undefined {
  const activeDb = targetDb || db;
  return activeDb.prepare('SELECT * FROM appliances WHERE id = ?').get(id) as Appliance | undefined;
}

export function createAppliance(input: CreateApplianceInput, targetDb?: DatabaseType): Appliance {
  const activeDb = targetDb || db;
  const id = uuidv4();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  activeDb.prepare(`
    INSERT INTO appliances (id, name, category, brand, model, serial_number, purchase_date, warranty_expiration, location, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.category,
    input.brand,
    input.model,
    input.serial_number || null,
    input.purchase_date || null,
    input.warranty_expiration || null,
    input.location || null,
    input.notes || null,
    now,
    now
  );

  return getApplianceById(id, activeDb) as Appliance;
}

export function getApplianceHistory(applianceId: string, targetDb?: DatabaseType) {
  const activeDb = targetDb || db;
  // Get all repair cases and their events for an appliance
  const cases = activeDb.prepare(`
    SELECT rc.*, a.name as appliance_name
    FROM repair_cases rc
    JOIN appliances a ON a.id = rc.appliance_id
    WHERE rc.appliance_id = ?
    ORDER BY rc.created_at DESC
  `).all(applianceId);

  const events = activeDb.prepare(`
    SELECT re.*
    FROM repair_events re
    JOIN repair_cases rc ON rc.id = re.case_id
    WHERE rc.appliance_id = ?
    ORDER BY re.created_at DESC, re.rowid DESC
  `).all(applianceId);

  const documents = activeDb.prepare(`
    SELECT *
    FROM warranty_documents
    WHERE appliance_id = ?
    ORDER BY uploaded_at DESC
  `).all(applianceId);

  return { cases, events, documents };
}
