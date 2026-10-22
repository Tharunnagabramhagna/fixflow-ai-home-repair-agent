import { v4 as uuidv4 } from 'uuid';
import { Database as DatabaseType } from 'better-sqlite3';
import db from '../db/database';
import type { CreateRepairCaseInput, UpdateRepairStatusInput } from '../validators';

export interface RepairCase {
  id: string;
  appliance_id: string;
  issue_description: string;
  priority: string;
  status: string;
  appointment_date: string | null;
  appointment_notes: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairEvent {
  id: string;
  case_id: string;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['diagnosed', 'scheduled', 'in_progress', 'closed'],
  diagnosed: ['scheduled', 'in_progress', 'closed'],
  scheduled: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export function getAllRepairCases(
  filters?: { status?: string; appliance_id?: string },
  targetDb?: DatabaseType
): (RepairCase & { appliance_name?: string })[] {
  const activeDb = targetDb || db;
  let query = `
    SELECT rc.*, a.name as appliance_name
    FROM repair_cases rc
    JOIN appliances a ON a.id = rc.appliance_id
  `;
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters?.status) {
    conditions.push('rc.status = ?');
    params.push(filters.status);
  }
  if (filters?.appliance_id) {
    conditions.push('rc.appliance_id = ?');
    params.push(filters.appliance_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY rc.created_at DESC';

  return activeDb.prepare(query).all(...params) as (RepairCase & { appliance_name?: string })[];
}

export function getRepairCaseById(
  id: string,
  targetDb?: DatabaseType
): (RepairCase & { appliance_name?: string; events?: RepairEvent[] }) | undefined {
  const activeDb = targetDb || db;
  const repairCase = activeDb.prepare(`
    SELECT rc.*, a.name as appliance_name
    FROM repair_cases rc
    JOIN appliances a ON a.id = rc.appliance_id
    WHERE rc.id = ?
  `).get(id) as (RepairCase & { appliance_name?: string }) | undefined;

  if (!repairCase) return undefined;

  const events = activeDb.prepare(`
    SELECT * FROM repair_events WHERE case_id = ? ORDER BY created_at ASC, rowid ASC
  `).all(id) as RepairEvent[];

  return { ...repairCase, events };
}

export function createRepairCase(input: CreateRepairCaseInput, targetDb?: DatabaseType): RepairCase {
  const activeDb = targetDb || db;
  const appliance = activeDb.prepare('SELECT id FROM appliances WHERE id = ?').get(input.appliance_id);
  if (!appliance) {
    const error = new Error('Appliance not found');
    (error as any).status = 404;
    throw error;
  }

  const id = uuidv4();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const createCaseAndEvent = activeDb.transaction(() => {
    activeDb.prepare(`
      INSERT INTO repair_cases (id, appliance_id, issue_description, priority, status, appointment_date, appointment_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      id,
      input.appliance_id,
      input.issue_description,
      input.priority,
      input.appointment_date || null,
      input.appointment_notes || null,
      now,
      now
    );

    activeDb.prepare(`
      INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
      VALUES (?, ?, 'created', ?, NULL, NULL, ?)
    `).run(uuidv4(), id, `Case opened: ${input.issue_description.substring(0, 100)}`, now);
  });

  createCaseAndEvent();

  return getRepairCaseById(id, activeDb) as RepairCase;
}

export function updateRepairStatus(
  id: string,
  input: UpdateRepairStatusInput,
  targetDb?: DatabaseType
): RepairCase {
  const activeDb = targetDb || db;
  const existing = activeDb.prepare('SELECT * FROM repair_cases WHERE id = ?').get(id) as RepairCase | undefined;

  if (!existing) {
    throw new Error('Repair case not found');
  }

  const allowedStatuses = VALID_TRANSITIONS[existing.status];
  if (!allowedStatuses || !allowedStatuses.includes(input.status)) {
    throw new Error(`Cannot transition from '${existing.status}' to '${input.status}'. Allowed: ${allowedStatuses?.join(', ') || 'none'}`);
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const updateCaseAndEvent = activeDb.transaction(() => {
    activeDb.prepare(`
      UPDATE repair_cases
      SET status = ?, resolution_notes = COALESCE(?, resolution_notes),
          appointment_date = COALESCE(?, appointment_date),
          appointment_notes = COALESCE(?, appointment_notes),
          updated_at = ?
      WHERE id = ?
    `).run(
      input.status,
      input.resolution_notes || null,
      input.appointment_date || null,
      input.appointment_notes || null,
      now,
      id
    );

    const eventType = input.status === 'resolved' ? 'resolved' :
                      input.status === 'closed' ? 'closed' : 'status_change';

    const description = input.resolution_notes
      ? `Status changed to ${input.status}: ${input.resolution_notes.substring(0, 200)}`
      : `Status changed to ${input.status}`;

    activeDb.prepare(`
      INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), id, eventType, description, existing.status, input.status, now);
  });

  updateCaseAndEvent();

  return getRepairCaseById(id, activeDb) as RepairCase;
}

export function getDashboardSummary(targetDb?: DatabaseType) {
  const activeDb = targetDb || db;
  const totalAppliances = (activeDb.prepare('SELECT COUNT(*) as count FROM appliances').get() as { count: number }).count;
  const activeRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases WHERE status IN ('open', 'diagnosed', 'scheduled', 'in_progress')").get() as { count: number }).count;
  const openRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases WHERE status IN ('open', 'diagnosed', 'in_progress')").get() as { count: number }).count;
  const scheduledVisits = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases WHERE status = 'scheduled'").get() as { count: number }).count;
  const resolvedCases = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases WHERE status IN ('resolved', 'closed')").get() as { count: number }).count;
  const totalCases = (activeDb.prepare('SELECT COUNT(*) as count FROM repair_cases').get() as { count: number }).count;

  const recentEvents = activeDb.prepare(`
    SELECT re.*, rc.appliance_id, a.name as appliance_name
    FROM repair_events re
    JOIN repair_cases rc ON rc.id = re.case_id
    JOIN appliances a ON a.id = rc.appliance_id
    ORDER BY re.created_at DESC, re.rowid DESC
    LIMIT 10
  `).all();

  const upcomingAppointments = activeDb.prepare(`
    SELECT rc.*, a.name as appliance_name
    FROM repair_cases rc
    JOIN appliances a ON a.id = rc.appliance_id
    WHERE rc.status = 'scheduled' AND rc.appointment_date IS NOT NULL
    ORDER BY rc.appointment_date ASC
    LIMIT 5
  `).all();

  return {
    counts: {
      total_appliances: totalAppliances,
      active_repairs: activeRepairs,
      open_repairs: openRepairs,
      scheduled_visits: scheduledVisits,
      resolved_cases: resolvedCases,
      total_cases: totalCases,
    },
    recent_events: recentEvents,
    upcoming_appointments: upcomingAppointments,
  };
}
