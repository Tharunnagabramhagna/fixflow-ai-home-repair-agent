import { v4 as uuidv4 } from 'uuid';
import { Database as DatabaseType } from 'better-sqlite3';
import db from '../db/database';
import * as repairService from './repairService';

export type DispatchStatus = 'pending' | 'dispatched' | 'en_route' | 'arrived' | 'completed' | 'cancelled';

export interface ContractorDispatch {
  id: string;
  case_id: string;
  user_id: string;
  contractor_name: string;
  company_name: string;
  phone_number: string;
  vehicle_info: string | null;
  estimated_arrival_minutes: number | null;
  status: DispatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface DispatchEvent {
  id: string;
  dispatch_id: string;
  case_id: string;
  status: DispatchStatus;
  message: string;
  actor: string;
  created_at: string;
}

export interface DispatchDetail extends ContractorDispatch {
  events: DispatchEvent[];
  appliance_name?: string;
  issue_description?: string;
  is_simulated: boolean;
}

// Strict valid state transitions
export const VALID_DISPATCH_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  pending: ['dispatched', 'cancelled'],
  dispatched: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['completed'],
  completed: [],
  cancelled: [],
};

// Simulated contractors pool
const SIMULATED_CONTRACTORS = [
  {
    name: 'Mike Vance',
    company: 'Apex Home Appliance Care',
    phone: '(555) 019-2834',
    vehicle: 'White Ford Transit Van (#4)',
    initialEta: 25,
  },
  {
    name: 'Elena Rostova',
    company: 'FixFlow Certified Specialists',
    phone: '(555) 014-9921',
    vehicle: 'Blue Mercedes Sprinter (#12)',
    initialEta: 20,
  },
  {
    name: 'David Miller',
    company: 'Metro Pro HVAC & Repair',
    phone: '(555) 018-7742',
    vehicle: 'Silver Chevy Express (#7)',
    initialEta: 30,
  },
];

type DispatchListener = (event: { type: string; caseId: string; dispatch: DispatchDetail }) => void;
const dispatchSubscribers = new Map<string, Set<DispatchListener>>();

export class DispatchService {
  /**
   * Subscribe to real-time dispatch updates for SSE
   */
  subscribe(caseId: string, listener: DispatchListener): () => void {
    if (!dispatchSubscribers.has(caseId)) {
      dispatchSubscribers.set(caseId, new Set());
    }
    const set = dispatchSubscribers.get(caseId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        dispatchSubscribers.delete(caseId);
      }
    };
  }

  /**
   * Broadcast an update to all active SSE listeners for a case
   */
  broadcast(caseId: string, dispatch: DispatchDetail, type = 'dispatch_update'): void {
    const listeners = dispatchSubscribers.get(caseId);
    if (listeners && listeners.size > 0) {
      for (const listener of listeners) {
        try {
          listener({ type, caseId, dispatch });
        } catch (err) {
          console.error('[DispatchService] Listener error:', err);
        }
      }
    }
  }

  /**
   * Retrieve dispatch record and its event history for a repair case with ownership check
   */
  getDispatchByCaseId(
    caseId: string,
    userId?: string | null,
    targetDb?: DatabaseType
  ): DispatchDetail | null {
    const activeDb = targetDb || db;

    // 1. Verify case existence and ownership
    const repairCase = repairService.getRepairCaseById(caseId, userId, activeDb);
    if (!repairCase) {
      return null;
    }

    const row = activeDb.prepare(
      'SELECT * FROM contractor_dispatches WHERE case_id = ?'
    ).get(caseId) as ContractorDispatch | undefined;

    if (!row) {
      return null;
    }

    const events = activeDb.prepare(
      'SELECT * FROM dispatch_events WHERE dispatch_id = ? ORDER BY created_at ASC'
    ).all(row.id) as DispatchEvent[];

    return {
      ...row,
      events,
      appliance_name: repairCase.appliance_name,
      issue_description: repairCase.issue_description,
      is_simulated: true,
    };
  }

  /**
   * Initiate a simulated contractor dispatch for a repair case
   */
  initiateDispatch(
    caseId: string,
    userId: string,
    notes?: string,
    targetDb?: DatabaseType
  ): DispatchDetail {
    const activeDb = targetDb || db;

    // 1. Verify repair case existence and access
    const repairCase = repairService.getRepairCaseById(caseId, userId, activeDb);
    if (!repairCase) {
      const err: any = new Error('Repair case not found or access denied');
      err.status = 404;
      throw err;
    }

    // Check if dispatch already exists
    const existing = activeDb.prepare(
      'SELECT * FROM contractor_dispatches WHERE case_id = ?'
    ).get(caseId) as ContractorDispatch | undefined;

    if (existing) {
      if (existing.status !== 'cancelled') {
        const err: any = new Error(`Dispatch already exists in status '${existing.status}'`);
        err.status = 409;
        throw err;
      }
    }

    // Pick simulated contractor
    const contractor = SIMULATED_CONTRACTORS[Math.floor(Math.random() * SIMULATED_CONTRACTORS.length)];
    const dispatchId = `disp-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = activeDb.transaction(() => {
      // If previous cancelled dispatch existed, delete or archive it
      if (existing) {
        activeDb.prepare('DELETE FROM dispatch_events WHERE dispatch_id = ?').run(existing.id);
        activeDb.prepare('DELETE FROM contractor_dispatches WHERE id = ?').run(existing.id);
      }

      activeDb.prepare(`
        INSERT INTO contractor_dispatches (
          id, case_id, user_id, contractor_name, company_name, phone_number,
          vehicle_info, estimated_arrival_minutes, status, notes,
          created_at, updated_at, dispatched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `).run(
        dispatchId,
        caseId,
        userId,
        contractor.name,
        contractor.company,
        contractor.phone,
        contractor.vehicle,
        contractor.initialEta,
        notes || 'Simulated dispatch request queued by FixFlow Assistant',
        now,
        now,
        null
      );

      // Record initial event
      const eventId = `devt-${uuidv4().substring(0, 8)}`;
      activeDb.prepare(`
        INSERT INTO dispatch_events (
          id, dispatch_id, case_id, status, message, actor, created_at
        ) VALUES (?, ?, ?, 'pending', ?, 'system', ?)
      `).run(
        eventId,
        dispatchId,
        caseId,
        `Contractor dispatch requested. Awaiting technician assignment.`,
        now
      );

      // Update repair case audit event
      try {
        repairService.addRepairNote(
          caseId,
          `[Simulated Dispatch] Contractor dispatch requested. Awaiting technician assignment.`,
          userId,
          activeDb
        );
      } catch {}

      return this.getDispatchByCaseId(caseId, userId, activeDb)!;
    })();

    this.broadcast(caseId, result, 'dispatch_created');
    return result;
  }

  /**
   * Advance simulated dispatch to next state or specified target state
   */
  advanceDispatchStatus(
    caseId: string,
    userId: string,
    targetStatus?: DispatchStatus,
    customMessage?: string,
    targetDb?: DatabaseType
  ): DispatchDetail {
    const activeDb = targetDb || db;

    // Verify ownership
    const repairCase = repairService.getRepairCaseById(caseId, userId, activeDb);
    if (!repairCase) {
      const err: any = new Error('Repair case not found or access denied');
      err.status = 404;
      throw err;
    }

    const current = activeDb.prepare(
      'SELECT * FROM contractor_dispatches WHERE case_id = ?'
    ).get(caseId) as ContractorDispatch | undefined;

    if (!current) {
      const err: any = new Error('No active dispatch found for this repair case');
      err.status = 404;
      throw err;
    }

    const validNextStates = VALID_DISPATCH_TRANSITIONS[current.status];
    if (validNextStates.length === 0) {
      const err: any = new Error(`Cannot advance dispatch from terminal status '${current.status}'`);
      err.status = 400;
      throw err;
    }

    // Determine next state
    let nextState: DispatchStatus;
    if (targetStatus) {
      if (!validNextStates.includes(targetStatus)) {
        const err: any = new Error(
          `Invalid dispatch transition from '${current.status}' to '${targetStatus}'. Allowed: ${validNextStates.join(', ')}`
        );
        err.status = 400;
        throw err;
      }
      nextState = targetStatus;
    } else {
      // Default to the first progressive non-cancelled status
      nextState = validNextStates.find((s) => s !== 'cancelled') || validNextStates[0];
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Update specific timestamp columns
    let timestampCol = '';
    let etaUpdate = current.estimated_arrival_minutes;
    let defaultMsg = '';

    switch (nextState) {
      case 'dispatched':
        timestampCol = ', dispatched_at = ?';
        etaUpdate = 25;
        defaultMsg = `Contractor ${current.contractor_name} (${current.company_name}) has been dispatched.`;
        break;
      case 'en_route':
        timestampCol = ', en_route_at = ?';
        etaUpdate = 15;
        defaultMsg = `Technician ${current.contractor_name} is en route in ${current.vehicle_info || 'service vehicle'}. Estimated arrival in 15 minutes.`;
        break;
      case 'arrived':
        timestampCol = ', arrived_at = ?';
        etaUpdate = 0;
        defaultMsg = `Technician ${current.contractor_name} has arrived at the property. Diagnostic inspection underway.`;
        break;
      case 'completed':
        timestampCol = ', completed_at = ?';
        etaUpdate = 0;
        defaultMsg = `Service complete. Technician ${current.contractor_name} resolved the reported issue.`;
        break;
      case 'cancelled':
        timestampCol = ', cancelled_at = ?';
        etaUpdate = null;
        defaultMsg = `Contractor dispatch was cancelled.`;
        break;
    }

    const message = customMessage || defaultMsg;

    const result = activeDb.transaction(() => {
      // 1. Update dispatch record
      const updateQuery = `
        UPDATE contractor_dispatches
        SET status = ?, estimated_arrival_minutes = ?, updated_at = ? ${timestampCol}
        WHERE id = ?
      `;
      activeDb.prepare(updateQuery).run(nextState, etaUpdate, now, now, current.id);

      // 2. Insert dispatch event
      const eventId = `devt-${uuidv4().substring(0, 8)}`;
      activeDb.prepare(`
        INSERT INTO dispatch_events (
          id, dispatch_id, case_id, status, message, actor, created_at
        ) VALUES (?, ?, ?, ?, ?, 'system', ?)
      `).run(eventId, current.id, caseId, nextState, message, now);

      // 3. Keep repair_case status in sync
      if (nextState === 'arrived' && ['open', 'diagnosed', 'scheduled'].includes(repairCase.status)) {
        try {
          repairService.updateRepairStatus(
            caseId,
            { status: 'in_progress' },
            userId,
            activeDb
          );
        } catch {}
      } else if (nextState === 'completed' && repairCase.status !== 'resolved' && repairCase.status !== 'closed') {
        try {
          repairService.updateRepairStatus(
            caseId,
            {
              status: 'resolved',
              resolution_notes: `Resolved during simulated contractor visit by ${current.contractor_name} (${current.company_name}).`,
            },
            userId,
            activeDb
          );
        } catch {}
      }

      // Add audit note to case
      try {
        repairService.addRepairNote(
          caseId,
          `[Simulated Dispatch Update] Status changed from '${current.status}' to '${nextState}'. ${message}`,
          userId,
          activeDb
        );
      } catch {}

      return this.getDispatchByCaseId(caseId, userId, activeDb)!;
    })();

    this.broadcast(caseId, result, 'dispatch_status_changed');
    return result;
  }

  /**
   * Safely cancel an active contractor dispatch
   */
  cancelDispatch(
    caseId: string,
    userId: string,
    reason?: string,
    targetDb?: DatabaseType
  ): DispatchDetail {
    return this.advanceDispatchStatus(
      caseId,
      userId,
      'cancelled',
      reason ? `Dispatch cancelled: ${reason}` : 'Homeowner cancelled contractor dispatch request.',
      targetDb
    );
  }
}

export const dispatchService = new DispatchService();
