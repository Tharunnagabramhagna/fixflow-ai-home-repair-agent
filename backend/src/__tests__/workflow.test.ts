import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../db/database';
import {
  createRepairCase,
  updateRepairStatus,
  getRepairCaseById,
  getAllRepairCases,
  addRepairNote,
} from '../services/repairService';
import { createAppliance } from '../services/applianceService';

describe('Production Repair Workflow Service Tests (Real Implementation)', () => {
  let testDb: DatabaseType;
  const testDbPath = path.resolve(__dirname, '..', '..', '..', 'database', 'data', 'test-isolated-workflow.db');
  let testApplianceId: string;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    testDb = new Database(testDbPath);
    initializeDatabase(testDb);

    // Register a legitimate appliance
    const app = createAppliance(
      {
        name: 'Smart Refrigerator',
        category: 'Kitchen',
        brand: 'Samsung',
        model: 'RF28R7551SR',
        serial_number: 'SN-TEST-1234',
        location: 'Main Kitchen',
      },
      testDb
    );
    testApplianceId = app.id;
  });

  afterEach(() => {
    testDb.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('1. Creating a case and its initial audit event is atomic', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Refrigerator display is flickering and compressor sounds loud.',
        priority: 'high',
      },
      testDb
    );

    expect(created.id).toBeDefined();
    expect(created.status).toBe('open');
    expect(created.priority).toBe('high');

    // Verify case in database
    const caseInDb = testDb.prepare('SELECT * FROM repair_cases WHERE id = ?').get(created.id) as any;
    expect(caseInDb).toBeDefined();
    expect(caseInDb.status).toBe('open');

    // Verify initial event in database
    const events = testDb.prepare('SELECT * FROM repair_events WHERE case_id = ?').all(created.id) as any[];
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('created');
    expect(events[0].description).toContain('Case opened: Refrigerator display is flickering');
  });

  it('2. Updating a case and logging its transition event is atomic', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Ice maker stopped dispensing crushed ice.',
        priority: 'medium',
      },
      testDb
    );

    const updated = updateRepairStatus(
      created.id,
      {
        status: 'diagnosed',
        resolution_notes: 'Auger motor frozen; requires defrosting and solenoid test.',
      },
      testDb
    );

    expect(updated.status).toBe('diagnosed');
    expect(updated.resolution_notes).toContain('Auger motor frozen');

    // Verify event in database
    const events = testDb.prepare('SELECT * FROM repair_events WHERE case_id = ? ORDER BY created_at ASC, rowid ASC').all(created.id) as any[];
    expect(events.length).toBe(2);
    expect(events[1].event_type).toBe('status_change');
    expect(events[1].old_value).toBe('open');
    expect(events[1].new_value).toBe('diagnosed');
    expect(events[1].description).toContain('Status changed to diagnosed');
  });

  it('3. Invalid status transitions are rejected according to transition policy', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Washer vibrates violently during high-speed extraction cycle.',
        priority: 'urgent',
      },
      testDb
    );

    // From 'open', allowed: diagnosed, scheduled, in_progress, closed.
    // 'resolved' is NOT allowed directly from 'open'.
    expect(() => {
      updateRepairStatus(
        created.id,
        {
          status: 'resolved',
          resolution_notes: 'Cannot jump from open directly to resolved.',
        },
        testDb
      );
    }).toThrow(/Cannot transition from 'open' to 'resolved'/);

    // Verify case status remained 'open' and no bogus event was recorded
    const caseInDb = testDb.prepare('SELECT * FROM repair_cases WHERE id = ?').get(created.id) as any;
    expect(caseInDb.status).toBe('open');
    const events = testDb.prepare('SELECT * FROM repair_events WHERE case_id = ?').all(created.id);
    expect(events.length).toBe(1);
  });

  it('4. Closed cases cannot transition to any further status (terminal state)', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Minor squeak on door hinge.',
        priority: 'low',
      },
      testDb
    );

    // Close case
    updateRepairStatus(created.id, { status: 'closed' }, testDb);

    // Attempt to transition closed -> open
    expect(() => {
      updateRepairStatus(created.id, { status: 'open' }, testDb);
    }).toThrow(/Cannot transition from 'closed'/);
  });

  it('5. Valid status transitions work through full lifecycle (open -> diagnosed -> scheduled -> in_progress -> resolved -> closed)', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Full lifecycle test ticket for repair workflow.',
        priority: 'medium',
      },
      testDb
    );

    const s1 = updateRepairStatus(created.id, { status: 'diagnosed', resolution_notes: 'Diagnosed fault.' }, testDb);
    expect(s1.status).toBe('diagnosed');

    const s2 = updateRepairStatus(created.id, { status: 'scheduled', appointment_date: '2026-11-01 10:00:00' }, testDb);
    expect(s2.status).toBe('scheduled');
    expect(s2.appointment_date).toBe('2026-11-01 10:00:00');

    const s3 = updateRepairStatus(created.id, { status: 'in_progress' }, testDb);
    expect(s3.status).toBe('in_progress');

    const s4 = updateRepairStatus(created.id, { status: 'resolved', resolution_notes: 'Replaced thermal fuse.' }, testDb);
    expect(s4.status).toBe('resolved');

    const s5 = updateRepairStatus(created.id, { status: 'closed' }, testDb);
    expect(s5.status).toBe('closed');

    // Verify total events logged = 1 created + 5 transitions = 6 events
    const caseWithEvents = getRepairCaseById(created.id, testDb);
    expect(caseWithEvents?.events?.length).toBe(6);
  });

  it('6. Event ordering is deterministic even when timestamps match exactly', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Simultaneous events test case.',
        priority: 'low',
      },
      testDb
    );

    const sameTimestamp = '2026-10-23 12:00:00';
    // Manually insert three events with the exact same timestamp
    testDb.prepare(`
      INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
      VALUES ('evt-order-1', ?, 'status_change', 'First step', 'open', 'diagnosed', ?)
    `).run(created.id, sameTimestamp);

    testDb.prepare(`
      INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
      VALUES ('evt-order-2', ?, 'status_change', 'Second step', 'diagnosed', 'scheduled', ?)
    `).run(created.id, sameTimestamp);

    testDb.prepare(`
      INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
      VALUES ('evt-order-3', ?, 'status_change', 'Third step', 'scheduled', 'in_progress', ?)
    `).run(created.id, sameTimestamp);

    const result = getRepairCaseById(created.id, testDb);
    const orderEvents = result?.events?.filter((e) => e.created_at === sameTimestamp);
    expect(orderEvents?.length).toBe(3);
    // Secondary rowid sorting guarantees exact deterministic ordering: First step, Second step, Third step
    expect(orderEvents![0].description).toBe('First step');
    expect(orderEvents![1].description).toBe('Second step');
    expect(orderEvents![2].description).toBe('Third step');
  });

  it('7. Throws 404 when appliance does not exist', () => {
    expect(() => {
      createRepairCase(
        {
          appliance_id: 'non-existent-app-id',
          issue_description: 'Valid issue description for testing non-existent appliance.',
          priority: 'low',
        },
        testDb
      );
    }).toThrow(/Appliance not found/);
  });

  it('8. Throws error when updating non-existent repair case', () => {
    expect(() => {
      updateRepairStatus(
        'non-existent-case-id',
        { status: 'diagnosed' },
        testDb
      );
    }).toThrow(/Repair case not found/);
  });

  it('9. Successfully adds a diagnostic note to repair case and logs audit event', () => {
    const created = createRepairCase(
      {
        appliance_id: testApplianceId,
        issue_description: 'Ice maker stopped producing ice cubes.',
        priority: 'medium',
      },
      testDb
    );

    const updated = addRepairNote(
      created.id,
      'Technician checked water inlet valve; solenoid coil resistance is normal.',
      null,
      testDb
    );

    expect(updated.id).toBe(created.id);
    const events = testDb.prepare('SELECT * FROM repair_events WHERE case_id = ? ORDER BY created_at ASC').all(created.id) as any[];
    expect(events.length).toBe(2);
    expect(events[1].event_type).toBe('note_added');
    expect(events[1].description).toContain('solenoid coil resistance');
  });

  it('10. Throws error when adding note to non-existent repair case', () => {
    expect(() => {
      addRepairNote('non-existent-case-id', 'Some note', null, testDb);
    }).toThrow(/Repair case not found/);
  });
});
