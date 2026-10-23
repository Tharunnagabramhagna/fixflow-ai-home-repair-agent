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
  user_id?: string | null;
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

function resolveUserAndDb(
  userOrDb?: string | DatabaseType | null,
  targetDb?: DatabaseType
): { userId: string | null; activeDb: DatabaseType } {
  if (typeof userOrDb === 'string') {
    return { userId: userOrDb, activeDb: targetDb || db };
  }
  if (userOrDb && typeof userOrDb === 'object' && 'prepare' in userOrDb) {
    return { userId: null, activeDb: userOrDb as DatabaseType };
  }
  return { userId: null, activeDb: targetDb || db };
}

export function getAllRepairCases(
  filters?: { status?: string; appliance_id?: string; user_id?: string | null },
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

  // Scoping: If user is authenticated, query their owned cases/appliances
  if (filters?.user_id && filters.user_id !== 'sample') {
    conditions.push('(rc.user_id = ? OR a.user_id = ?)');
    params.push(filters.user_id, filters.user_id);
  } else if (filters?.user_id === 'sample') {
    conditions.push("(rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL)");
  }

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
  userIdOrDb?: string | DatabaseType | null,
  targetDb?: DatabaseType
): (RepairCase & { appliance_name?: string; events?: RepairEvent[] }) | undefined {
  const { userId, activeDb } = resolveUserAndDb(userIdOrDb, targetDb);
  const repairCase = activeDb.prepare(`
    SELECT rc.*, a.name as appliance_name, a.user_id as appliance_user_id
    FROM repair_cases rc
    JOIN appliances a ON a.id = rc.appliance_id
    WHERE rc.id = ?
  `).get(id) as (RepairCase & { appliance_name?: string; appliance_user_id?: string | null }) | undefined;

  if (!repairCase) return undefined;

  // Check ownership
  const isSample =
    repairCase.user_id === 'sample' ||
    repairCase.appliance_user_id === 'sample' ||
    repairCase.appliance_user_id === null ||
    repairCase.appliance_user_id === undefined;

  if (!isSample && userId) {
    if (repairCase.user_id !== userId && repairCase.appliance_user_id !== userId) {
      return undefined;
    }
  }

  const events = activeDb.prepare(`
    SELECT * FROM repair_events WHERE case_id = ? ORDER BY created_at ASC, rowid ASC
  `).all(id) as RepairEvent[];

  return { ...repairCase, events };
}

export function createRepairCase(
  input: CreateRepairCaseInput,
  userIdOrDb?: string | DatabaseType,
  targetDb?: DatabaseType
): RepairCase {
  let userId = 'sample';
  let activeDb: DatabaseType;

  if (typeof userIdOrDb === 'string') {
    userId = userIdOrDb;
    activeDb = targetDb || db;
  } else if (userIdOrDb && typeof userIdOrDb === 'object' && 'prepare' in userIdOrDb) {
    activeDb = userIdOrDb as DatabaseType;
  } else {
    activeDb = targetDb || db;
  }

  const appliance = activeDb.prepare('SELECT id, user_id FROM appliances WHERE id = ?').get(input.appliance_id) as any;
  if (!appliance) {
    const error = new Error('Appliance not found');
    (error as any).status = 404;
    throw error;
  }

  // If user is authenticated, ensure they do not create cases on other users' private appliances
  if (userId !== 'sample' && appliance.user_id && appliance.user_id !== 'sample' && appliance.user_id !== userId) {
    const error = new Error('Access denied: You cannot create a repair case for an appliance you do not own.');
    (error as any).status = 403;
    throw error;
  }

  const id = uuidv4();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const createCaseAndEvent = activeDb.transaction(() => {
    activeDb.prepare(`
      INSERT INTO repair_cases (id, appliance_id, issue_description, priority, status, appointment_date, appointment_notes, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(
      id,
      input.appliance_id,
      input.issue_description,
      input.priority,
      input.appointment_date || null,
      input.appointment_notes || null,
      userId,
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
  userIdOrDb?: string | DatabaseType | null,
  targetDb?: DatabaseType
): RepairCase {
  const { userId, activeDb } = resolveUserAndDb(userIdOrDb, targetDb);
  const existing = getRepairCaseById(id, userId, activeDb);

  if (!existing) {
    const err = new Error('Repair case not found');
    (err as any).status = 404;
    throw err;
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

export function getDashboardSummary(userIdOrDb?: string | DatabaseType | null, targetDb?: DatabaseType) {
  const { userId, activeDb } = resolveUserAndDb(userIdOrDb, targetDb);
  const isAuthUser = Boolean(userId && userId !== 'sample');

  let totalAppliances = 0;
  let activeRepairs = 0;
  let openRepairs = 0;
  let scheduledVisits = 0;
  let resolvedCases = 0;
  let totalCases = 0;
  let recentEvents: any[] = [];
  let upcomingAppointments: any[] = [];

  if (isAuthUser) {
    totalAppliances = (activeDb.prepare('SELECT COUNT(*) as count FROM appliances WHERE user_id = ?').get(userId) as { count: number }).count;
    activeRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = ? OR a.user_id = ?) AND rc.status IN ('open', 'diagnosed', 'scheduled', 'in_progress')").get(userId, userId) as { count: number }).count;
    openRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = ? OR a.user_id = ?) AND rc.status IN ('open', 'diagnosed', 'in_progress')").get(userId, userId) as { count: number }).count;
    scheduledVisits = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = ? OR a.user_id = ?) AND rc.status = 'scheduled'").get(userId, userId) as { count: number }).count;
    resolvedCases = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = ? OR a.user_id = ?) AND rc.status IN ('resolved', 'closed')").get(userId, userId) as { count: number }).count;
    totalCases = (activeDb.prepare('SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = ? OR a.user_id = ?)').get(userId, userId) as { count: number }).count;

    recentEvents = activeDb.prepare(`
      SELECT re.*, rc.appliance_id, a.name as appliance_name
      FROM repair_events re
      JOIN repair_cases rc ON rc.id = re.case_id
      JOIN appliances a ON a.id = rc.appliance_id
      WHERE (rc.user_id = ? OR a.user_id = ?)
      ORDER BY re.created_at DESC, re.rowid DESC
      LIMIT 10
    `).all(userId, userId);

    upcomingAppointments = activeDb.prepare(`
      SELECT rc.*, a.name as appliance_name
      FROM repair_cases rc
      JOIN appliances a ON a.id = rc.appliance_id
      WHERE (rc.user_id = ? OR a.user_id = ?) AND rc.status = 'scheduled' AND rc.appointment_date IS NOT NULL
      ORDER BY rc.appointment_date ASC
      LIMIT 5
    `).all(userId, userId);
  } else {
    // Guest mode / sample summary
    totalAppliances = (activeDb.prepare("SELECT COUNT(*) as count FROM appliances WHERE user_id = 'sample' OR user_id IS NULL").get() as { count: number }).count;
    activeRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL) AND rc.status IN ('open', 'diagnosed', 'scheduled', 'in_progress')").get() as { count: number }).count;
    openRepairs = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL) AND rc.status IN ('open', 'diagnosed', 'in_progress')").get() as { count: number }).count;
    scheduledVisits = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL) AND rc.status = 'scheduled'").get() as { count: number }).count;
    resolvedCases = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL) AND rc.status IN ('resolved', 'closed')").get() as { count: number }).count;
    totalCases = (activeDb.prepare("SELECT COUNT(*) as count FROM repair_cases rc JOIN appliances a ON a.id = rc.appliance_id WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL)").get() as { count: number }).count;

    recentEvents = activeDb.prepare(`
      SELECT re.*, rc.appliance_id, a.name as appliance_name
      FROM repair_events re
      JOIN repair_cases rc ON rc.id = re.case_id
      JOIN appliances a ON a.id = rc.appliance_id
      WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL)
      ORDER BY re.created_at DESC, re.rowid DESC
      LIMIT 10
    `).all();

    upcomingAppointments = activeDb.prepare(`
      SELECT rc.*, a.name as appliance_name
      FROM repair_cases rc
      JOIN appliances a ON a.id = rc.appliance_id
      WHERE (rc.user_id = 'sample' OR a.user_id = 'sample' OR a.user_id IS NULL) AND rc.status = 'scheduled' AND rc.appointment_date IS NOT NULL
      ORDER BY rc.appointment_date ASC
      LIMIT 5
    `).all();
  }

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
    is_sample_workspace: !isAuthUser,
  };
}
