import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { initializeDatabase } from '../db/database';
import { confirmationManager } from '../services/confirmationManager';
import { executeMcpTool } from '../services/mcpToolService';
import { assistantService, detectSafetyHazard } from '../services/llmService';
import { authService } from '../services/authService';
import * as applianceService from '../services/applianceService';

describe('FixFlow Phase 3 — AI Repair Assistant and MCP Diagnostics Tests', () => {
  let testDb: DatabaseType;
  const testDbPath = path.resolve(__dirname, '..', '..', '..', 'database', 'data', 'test-assistant.db');
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userAApplianceId: string;
  let userBApplianceId: string;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    testDb = new Database(testDbPath);
    initializeDatabase(testDb);
    confirmationManager.clear();

    // Register User A
    const regA = await authService.register({
      name: 'Alice Homeowner',
      email: `alice_${Date.now()}@example.com`,
      password: 'Password123!',
    });
    userAId = regA.user.id;
    userAToken = regA.token;

    // Register User B
    const regB = await authService.register({
      name: 'Bob Neighbor',
      email: `bob_${Date.now()}@example.com`,
      password: 'Password123!',
    });
    userBId = regB.user.id;
    userBToken = regB.token;

    // Create private appliance for User A
    const appA = applianceService.createAppliance(
      {
        name: "Alice's Samsung Refrigerator",
        category: 'Kitchen',
        brand: 'Samsung',
        model: 'RF28-PRIVATE',
        serial_number: 'SN-ALICE-1234',
        purchase_date: '2023-01-15',
        warranty_expiration: '2027-01-15',
        location: 'Alice Kitchen',
      },
      userAId
    );
    userAApplianceId = appA.id;

    // Create private appliance for User B
    const appB = applianceService.createAppliance(
      {
        name: "Bob's LG Dryer",
        category: 'Laundry',
        brand: 'LG',
        model: 'DLEX4000',
        serial_number: 'SN-BOB-9999',
        purchase_date: '2021-05-10',
        warranty_expiration: '2022-05-10',
        location: 'Bob Laundry',
      },
      userBId
    );
    userBApplianceId = appB.id;
  });

  afterEach(() => {
    testDb.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    confirmationManager.clear();
    vi.restoreAllMocks();
  });

  // 1. Normal troubleshooting conversations
  it('1. Provides safe, structured troubleshooting guidance for standard appliance symptoms', async () => {
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'My refrigerator is not cooling well and the freezer has frost build up. What should I check?',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.message.content).toBeDefined();
    expect(res.body.data.message.content.length).toBeGreaterThan(20);
    expect(res.body.data.safetyAlert).toBeNull();
  });

  // 2. Clarifying questions and missing information
  it('2. Asks relevant clarifying questions when crucial symptom information is missing', async () => {
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'It is broken and making noise.',
          },
        ],
      });

    expect(res.status).toBe(200);
    const content = res.body.data.message.content;
    // Must ask clarifying questions about which appliance and what kind of noise
    expect(content).toMatch(/which appliance|what symptoms|what kind of sound|clarif/i);
  });

  // 3. Critical Safety & Hazard Interceptor
  it('3. Immediately intercepts electrical hazards and gas leaks with emergency halt instructions', async () => {
    // Test direct detector
    const gasHazard = detectSafetyHazard('I smell a gas leak near the kitchen stove');
    expect(gasHazard).not.toBeNull();
    expect(gasHazard?.severity).toBe('critical');
    expect(gasHazard?.title).toContain('Gas Leak');

    const sparkHazard = detectSafetyHazard('There are sparks flying and a burning smell coming from the wall outlet');
    expect(sparkHazard).not.toBeNull();
    expect(sparkHazard?.severity).toBe('critical');

    // Test API response
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'Smoke is coming from my microwave and there is a burning smell!',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.safetyAlert).toBeDefined();
    expect(res.body.data.safetyAlert.severity).toBe('critical');
    expect(res.body.data.message.content).toMatch(/CRITICAL SAFETY ALERT|fire|breaker|unplug/i);
    // Tools should not be run when active danger is present
    expect(res.body.data.toolsUsed.length).toBe(0);
  });

  // 4. Correct tool selection and arguments
  it('4. Selects correct tool (check_warranty) and valid arguments when user asks for warranty status', async () => {
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({
        messages: [
          {
            role: 'user',
            content: 'Is my refrigerator still covered under warranty?',
          },
        ],
        applianceId: userAApplianceId,
      });

    expect(res.status).toBe(200);
    const toolsUsed = res.body.data.toolsUsed;
    expect(toolsUsed.length).toBeGreaterThan(0);
    expect(toolsUsed.some((t: any) => t.tool === 'check_warranty')).toBe(true);

    const warrantyTool = toolsUsed.find((t: any) => t.tool === 'check_warranty');
    expect(warrantyTool.args.appliance_id).toBe(userAApplianceId);
    expect(warrantyTool.status).toBe('success');
  });

  // 5. Actual backend data returned by tools (never fabricated)
  it('5. Returns verified records from SQLite database and does not invent false warranty status', async () => {
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({
        messages: [
          {
            role: 'user',
            content: 'Check the warranty on my refrigerator',
          },
        ],
        applianceId: userAApplianceId,
      });

    expect(res.status).toBe(200);
    const content = res.body.data.message.content;
    // Verified expiration is 2027-01-15 for User A's fridge
    expect(content).toContain('2027-01-15');
    expect(content).toMatch(/Active Warranty|verified warranty/i);
  });

  // 6. Unauthorized and cross-user requests
  it('6. Rejects User B attempting to inspect User A private appliance passport through assistant', async () => {
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userBToken)}`)
      .send({
        messages: [
          {
            role: 'user',
            content: 'Show me the repair history of this appliance',
          },
        ],
        applianceId: userAApplianceId, // Alice's private fridge
      });

    expect(res.status).toBe(200);
    const toolsUsed = res.body.data.toolsUsed;
    const passportTool = toolsUsed.find((t: any) => t.tool === 'get_repair_passport');
    expect(passportTool).toBeDefined();
    expect(passportTool.status).toBe('error');
    expect(passportTool.error).toMatch(/not found or access denied/i);
  });

  // 7. Guest access restrictions
  it('7. Rejects guest user attempting to create a repair case through the assistant', async () => {
    // Calling without auth cookie
    const res = await supertest(app)
      .post('/api/assistant/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'Please create a repair case for the refrigerator. The compressor is completely dead.',
          },
        ],
        applianceId: 'demo-app-001',
      });

    expect(res.status).toBe(200);
    const toolsUsed = res.body.data.toolsUsed;
    const createTool = toolsUsed.find((t: any) => t.tool === 'create_repair_case');
    expect(createTool).toBeDefined();
    expect(createTool.status).toBe('error');
    expect(createTool.error).toMatch(/Authentication required|Guest users cannot create repair cases/i);
    expect(res.body.data.pendingConfirmation).toBeNull();
  });

  // 8. Explicit confirmation before mutations
  it('8. Requires explicit two-step confirmation token before creating a repair case', async () => {
    // Step 1: Initial user request generates a proposal and single-use confirmation token
    const chatRes = await supertest(app)
      .post('/api/assistant/chat')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({
        messages: [
          {
            role: 'user',
            content: 'Please file a repair case for my refrigerator. The ice maker is jammed and leaking water.',
          },
        ],
        applianceId: userAApplianceId,
      });

    expect(chatRes.status).toBe(200);
    const pending = chatRes.body.data.pendingConfirmation;
    expect(pending).toBeDefined();
    expect(pending.token).toMatch(/^cfrm_/);
    expect(pending.proposal.appliance_id).toBe(userAApplianceId);

    // Step 2: Confirmation execution via /api/assistant/confirm
    const confirmRes = await supertest(app)
      .post('/api/assistant/confirm')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({
        token: pending.token,
        action: 'create_repair_case',
        arguments: {
          appliance_id: userAApplianceId,
          issue_description: pending.proposal.issue_description,
          priority: pending.proposal.priority,
          appointment_date: pending.proposal.appointment_date,
          appointment_notes: pending.proposal.appointment_notes,
        },
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('success');
    expect(confirmRes.body.data.result.repair_case.id).toBeDefined();

    // Verify token cannot be re-used (single-use consumption)
    const reuseRes = await supertest(app)
      .post('/api/assistant/confirm')
      .set('Cookie', `fixflow_session=${encodeURIComponent(userAToken)}`)
      .send({
        token: pending.token,
        action: 'create_repair_case',
        arguments: {
          appliance_id: userAApplianceId,
          issue_description: pending.proposal.issue_description,
          priority: pending.proposal.priority,
        },
      });

    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.error).toMatch(/already consumed|expired|not found/i);
  });

  // 9. Invalid model-generated arguments handling
  it('9. Gracefully catches and rejects invalid model-generated tool arguments without crashing', async () => {
    // Issue description under 10 chars must fail validation
    const invalidResult = await executeMcpTool(
      'create_repair_case',
      {
        appliance_id: userAApplianceId,
        issue_description: 'too short', // < 10 chars
        priority: 'urgent',
      },
      { id: userAId, isGuest: false }
    );

    expect(invalidResult.status).toBe('error');
    expect(invalidResult.statusCode).toBe(400);
    expect(invalidResult.error).toContain('at least 10 characters');

    // Invalid priority enum
    const invalidEnumResult = await executeMcpTool(
      'create_repair_case',
      {
        appliance_id: userAApplianceId,
        issue_description: 'Valid long description of failure',
        priority: 'super-urgent', // invalid enum
      },
      { id: userAId, isGuest: false }
    );

    expect(invalidEnumResult.status).toBe('error');
    expect(invalidEnumResult.statusCode).toBe(400);
  });

  // 10. Model API failures, timeouts, and backend outages resilience
  it('10. Safely recovers from external LLM errors without crashing the service', async () => {
    // Mock callExternalLLM to throw a simulated timeout or connection error
    const spy = vi.spyOn(assistantService as any, 'callExternalLLM').mockRejectedValue(new Error('Gateway Timeout 504'));

    // Force external provider path
    const origKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'mock-key';

    const res = await supertest(app)
      .post('/api/assistant/chat')
      .send({
        messages: [{ role: 'user', content: 'Help me with my fridge' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.message.content).toMatch(/unexpected issue|Gateway Timeout/i);

    if (origKey) process.env.OPENAI_API_KEY = origKey;
    else delete process.env.OPENAI_API_KEY;
    spy.mockRestore();
  });

  // 11. Discovery & Config Endpoint
  it('11. Returns safe discovery config without leaking environment API keys', async () => {
    const res = await supertest(app).get('/api/assistant/config');
    expect(res.status).toBe(200);
    expect(res.body.data.toolsAvailable).toContain('check_warranty');
    expect(res.body.data.toolsAvailable).toContain('create_repair_case');
    // Ensure raw secrets are NEVER leaked in config response
    expect(JSON.stringify(res.body.data)).not.toContain('Password');
    expect(JSON.stringify(res.body.data)).not.toContain('API_KEY');
  });
});
