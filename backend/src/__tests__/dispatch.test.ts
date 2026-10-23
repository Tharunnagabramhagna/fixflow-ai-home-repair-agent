import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { initializeDatabase } from '../db/database';
import { dispatchService } from '../services/dispatchService';
import { authService } from '../services/authService';
import * as applianceService from '../services/applianceService';
import * as repairService from '../services/repairService';

describe('FixFlow Phase 4 — Contractor Dispatch Simulation Tests', () => {
  let testDb: DatabaseType;
  const testDbPath = path.resolve(__dirname, '..', '..', '..', 'database', 'data', 'test-dispatch.db');
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userACaseId: string;

  beforeEach(async () => {
    initializeDatabase();

    // Register User A & User B
    const regA = await authService.register({
      name: 'Alice Homeowner',
      email: `alice_${Date.now()}@example.com`,
      password: 'Password123!',
    });
    userAId = regA.user.id;
    userAToken = regA.token;

    const regB = await authService.register({
      name: 'Bob Neighbor',
      email: `bob_${Date.now()}@example.com`,
      password: 'Password123!',
    });
    userBId = regB.user.id;
    userBToken = regB.token;

    // Create appliance and repair case for User A
    const appA = applianceService.createAppliance(
      {
        name: "Alice's Bosch Dishwasher",
        category: 'Kitchen',
        brand: 'Bosch',
        model: 'SHPM88Z75N',
      },
      userAId
    );

    const repairCaseA = repairService.createRepairCase(
      {
        appliance_id: appA.id,
        issue_description: 'E15 flood error sensor triggered at bottom pan.',
        priority: 'high',
      },
      userAId
    );
    userACaseId = repairCaseA.id;
  });

  afterEach(() => {
    // cleanup
  });

  // 1. Initial dispatch creation
  it('1. Successfully initiates simulated contractor dispatch for an open repair case', async () => {
    const res = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/initiate`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ notes: 'Please dispatch local technician.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.contractor_name).toBeDefined();
    expect(res.body.data.company_name).toBeDefined();
    expect(res.body.data.is_simulated).toBe(true);
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.events[0].status).toBe('pending');
  });

  // 2. Fetch dispatch details
  it('2. Retrieves current dispatch details and event history', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    const res = await supertest(app)
      .get(`/api/repairs/${userACaseId}/dispatch`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.case_id).toBe(userACaseId);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.estimated_arrival_minutes).toBeGreaterThan(0);
  });

  // 3. Progressive state transitions: pending -> dispatched -> en_route -> arrived -> completed
  it('3. Advances through valid progressive state lifecycle correctly', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    // Step 1: pending -> dispatched
    const res1 = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'dispatched' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('dispatched');
    expect(res1.body.data.dispatched_at).toBeDefined();

    // Step 2: dispatched -> en_route
    const res2 = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'en_route' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('en_route');
    expect(res2.body.data.en_route_at).toBeDefined();
    expect(res2.body.data.estimated_arrival_minutes).toBe(15);

    // Step 3: en_route -> arrived
    const res3 = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'arrived' });

    expect(res3.status).toBe(200);
    expect(res3.body.data.status).toBe('arrived');
    expect(res3.body.data.arrived_at).toBeDefined();

    // Verify repair case status synced to in_progress
    const caseAfterArrived = repairService.getRepairCaseById(userACaseId, userAId);
    expect(caseAfterArrived?.status).toBe('in_progress');

    // Step 4: arrived -> completed
    const res4 = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'completed' });

    expect(res4.status).toBe(200);
    expect(res4.body.data.status).toBe('completed');
    expect(res4.body.data.completed_at).toBeDefined();

    // Verify repair case status synced to resolved
    const caseAfterCompleted = repairService.getRepairCaseById(userACaseId, userAId);
    expect(caseAfterCompleted?.status).toBe('resolved');

    // Verify timeline has 5 recorded events
    expect(res4.body.data.events.length).toBe(5);
  });

  // 4. Rejection of invalid transitions (e.g. backward or skipped)
  it('4. Rejects invalid and backward state transitions on the server', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    // Try jumping straight from pending to completed (invalid)
    const invalidJump = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'completed' });

    expect(invalidJump.status).toBe(400);
    expect(invalidJump.body.error).toMatch(/Invalid dispatch transition/i);

    // Advance to dispatched
    dispatchService.advanceDispatchStatus(userACaseId, userAId, 'dispatched');

    // Try going backward from dispatched to pending (invalid)
    const backwardAttempt = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'pending' });

    expect(backwardAttempt.status).toBe(400);
    expect(backwardAttempt.body.error).toMatch(/Invalid dispatch transition/i);
  });

  // 5. Safe cancellation path
  it('5. Allows safe cancellation from active dispatch states', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    const cancelRes = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/cancel`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ reason: 'Found a way to resolve the leak myself.' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
    expect(cancelRes.body.data.cancelled_at).toBeDefined();

    // Attempting to advance after cancellation must fail
    const advanceAfterCancel = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({ targetStatus: 'en_route' });

    expect(advanceAfterCancel.status).toBe(400);
    expect(advanceAfterCancel.body.error).toMatch(/terminal status 'cancelled'/i);
  });

  // 6. Cross-user access denial and privacy
  it('6. Rejects User B attempting to view, advance, or cancel User A dispatch', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    // User B tries to view User A's dispatch
    const viewRes = await supertest(app)
      .get(`/api/repairs/${userACaseId}/dispatch`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userBToken)}`);

    expect(viewRes.status).toBe(404);

    // User B tries to advance User A's dispatch
    const advanceRes = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/advance`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userBToken)}`)
      .send({ targetStatus: 'dispatched' });

    expect(advanceRes.status).toBe(404);

    // User B tries to cancel User A's dispatch
    const cancelRes = await supertest(app)
      .post(`/api/repairs/${userACaseId}/dispatch/cancel`)
      .set('Cookie', `fixflow_session=${encodeURIComponent(userBToken)}`)
      .send({ reason: 'Malicious cancellation attempt' });

    expect(cancelRes.status).toBe(404);
  });

  // 7. Server-Sent Events (SSE) and Dispatch pub/sub live updates
  it('7. Establishes SSE subscription and broadcasts real-time updates', async () => {
    dispatchService.initiateDispatch(userACaseId, userAId);

    // Test real-time subscriber receives updates
    const receivedEvents: any[] = [];
    const unsubscribe = dispatchService.subscribe(userACaseId, (evt) => {
      receivedEvents.push(evt);
    });

    // Advance state to trigger broadcast
    dispatchService.advanceDispatchStatus(userACaseId, userAId, 'dispatched');
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe('dispatch_status_changed');
    expect(receivedEvents[0].dispatch.status).toBe('dispatched');
    expect(receivedEvents[0].caseId).toBe(userACaseId);

    // Advance again
    dispatchService.advanceDispatchStatus(userACaseId, userAId, 'en_route');
    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[1].dispatch.status).toBe('en_route');

    // Unsubscribe and verify no more events are received
    unsubscribe();
    dispatchService.advanceDispatchStatus(userACaseId, userAId, 'arrived');
    expect(receivedEvents.length).toBe(2); // Still 2, not 3
  });
});
