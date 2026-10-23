import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createMcpApp } from '../server.js';
import { FixFlowBackendClient } from '../backendClient.js';
import { FixFlowMcpClient } from '../client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FixFlow Phase 2 — Real MCP Server Hardened Integration Tests', () => {
  let backendServer: http.Server;
  let backendUrl: string;
  let mcpServerInstance: http.Server;
  let mcpUrl: string;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let sampleApplianceId: string;
  let userAPrivateApplianceId: string;
  let userAPrivateCaseId: string;
  let isolatedDbPath: string;

  beforeAll(async () => {
    // 1. Setup isolated database path
    const dataDir = path.resolve(__dirname, '..', '..', '..', 'database', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    isolatedDbPath = path.join(dataDir, 'test-mcp-hardened.db');
    if (fs.existsSync(isolatedDbPath)) {
      try { fs.unlinkSync(isolatedDbPath); } catch {}
    }

    process.env.DATABASE_PATH = isolatedDbPath;
    process.env.NODE_ENV = 'test';
    process.env.ENFORCE_TEST_AUTH = 'true';

    // 2. Initialize database and seed demo data
    const dbModule = await import('../../../backend/dist/db/database.js');
    const seedModule = await import('../../../backend/dist/db/seed.js');
    dbModule.initializeDatabase();
    seedModule.seedDatabase();

    // 3. Start Backend Express Server on dynamic port
    const backendAppModule = await import('../../../backend/dist/app.js');
    const backendApp = (backendAppModule.default || backendAppModule) as any;

    await new Promise<void>((resolve) => {
      backendServer = http.createServer(backendApp).listen(0, '127.0.0.1', () => {
        const addr = backendServer.address() as { port: number };
        backendUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 4. Start MCP Server with Streamable HTTP on dynamic port
    const backendClient = new FixFlowBackendClient(backendUrl);
    const { app: mcpApp } = createMcpApp(backendClient);

    await new Promise<void>((resolve) => {
      mcpServerInstance = http.createServer(mcpApp).listen(0, '127.0.0.1', () => {
        const addr = mcpServerInstance.address() as { port: number };
        mcpUrl = `http://127.0.0.1:${addr.port}/mcp`;
        resolve();
      });
    });

    // 5. Register User A (Alice Homeowner)
    const regResA = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Homeowner',
        email: 'alice.homeowner@example.com',
        password: 'Password123!',
      }),
    });
    const regDataA = (await regResA.json()) as any;
    userAToken = regDataA.token;
    userAId = regDataA.user.id;

    // 6. Register User B (Bob Neighbor)
    const regResB = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Neighbor',
        email: 'bob.neighbor@example.com',
        password: 'Password123!',
      }),
    });
    const regDataB = (await regResB.json()) as any;
    userBToken = regDataB.token;
    userBId = regDataB.user.id;

    // 7. Retrieve a sample catalog appliance ID
    const sampleAppsRes = await fetch(`${backendUrl}/api/appliances`);
    const sampleAppsData = (await sampleAppsRes.json()) as any;
    sampleApplianceId = sampleAppsData.data[0].id;

    // 8. Create a private appliance for User A
    const appARes = await fetch(`${backendUrl}/api/appliances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        name: 'Alice Espresso Machine',
        category: 'Kitchen',
        brand: 'Breville',
        model: 'BES870XL',
        serial_number: 'SN-ALICE-9988',
        location: 'Private Kitchen Island',
      }),
    });
    const appAData = (await appARes.json()) as any;
    userAPrivateApplianceId = appAData.data.id;

    // 9. Create a private repair case for User A
    const caseARes = await fetch(`${backendUrl}/api/repairs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Alice private case: steam wand pressure is fluctuating.',
        priority: 'medium',
      }),
    });
    const caseAData = (await caseARes.json()) as any;
    userAPrivateCaseId = caseAData.data.id;
  });

  afterAll(async () => {
    if (mcpServerInstance) {
      if ('closeAllConnections' in mcpServerInstance) {
        (mcpServerInstance as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => mcpServerInstance.close(() => resolve()));
    }
    if (backendServer) {
      if ('closeAllConnections' in backendServer) {
        (backendServer as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => backendServer.close(() => resolve()));
    }
    if (isolatedDbPath && fs.existsSync(isolatedDbPath)) {
      try { fs.unlinkSync(isolatedDbPath); } catch {}
      try { fs.unlinkSync(`${isolatedDbPath}-wal`); } catch {}
      try { fs.unlinkSync(`${isolatedDbPath}-shm`); } catch {}
    }
  });

  describe('1. MCP Protocol Compatibility & Streamable HTTP', () => {
    it('negotiates MCP protocol version 2025-11-25 and receives session ID', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await client.connect();

      expect(client.sessionId).toBeDefined();
      expect(typeof client.sessionId).toBe('string');
      expect(client.sessionId!.length).toBeGreaterThan(10);

      // Verify server health endpoint reports correct spec version
      const healthRes = await fetch(`${mcpUrl.replace(/\/mcp$/, '')}/health`);
      const health = await healthRes.json() as any;
      expect(health.status).toBe('ok');
      expect(health.specVersion).toBe('2025-11-25');
      expect(health.transport).toBe('Streamable HTTP');

      await client.close();
    });

    it('discovers all 7 required tools with validated schemas via tools/list', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await client.connect();

      const toolsList = await client.listTools();
      const toolNames = toolsList.tools.map((t) => t.name);

      expect(toolNames).toContain('search_appliances');
      expect(toolNames).toContain('get_repair_passport');
      expect(toolNames).toContain('check_warranty');
      expect(toolNames).toContain('list_repair_cases');
      expect(toolNames).toContain('get_repair_case');
      expect(toolNames).toContain('create_repair_case');
      expect(toolNames).toContain('add_repair_note');
      expect(toolNames.length).toBe(7);

      const createTool = toolsList.tools.find((t) => t.name === 'create_repair_case');
      expect(createTool?.inputSchema?.properties).toHaveProperty('confirmation_token');
      expect(createTool?.inputSchema?.properties).toHaveProperty('issue_description');

      await client.close();
    });
  });

  describe('2. Read-Only Tools & Guest vs Authenticated Scoping', () => {
    it('search_appliances returns sample appliances for unauthenticated guest', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await client.connect();

      const result = await client.searchAppliances({});
      expect(result.status).toBe('success');
      expect(result.count).toBeGreaterThanOrEqual(5);
      // Ensure Alice's private appliance is NOT exposed in guest search
      const hasPrivateApp = result.appliances.some((a: any) => a.id === userAPrivateApplianceId);
      expect(hasPrivateApp).toBe(false);

      await client.close();
    });

    it('search_appliances returns private appliances when authenticated as User A', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await client.connect();

      const result = await client.searchAppliances({});
      expect(result.status).toBe('success');
      const foundPrivate = result.appliances.find((a: any) => a.id === userAPrivateApplianceId);
      expect(foundPrivate).toBeDefined();
      expect(foundPrivate.name).toBe('Alice Espresso Machine');

      await client.close();
    });

    it('get_repair_passport allows guest to view sample appliance passport', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await client.connect();

      const result = await client.getRepairPassport({ appliance_id: sampleApplianceId });
      expect(result.status).toBe('success');
      expect(result.appliance.id).toBe(sampleApplianceId);

      await client.close();
    });

    it('check_warranty correctly computes warranty status and days remaining', async () => {
      const client = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await client.connect();

      const result = await client.checkWarranty({ appliance_id: sampleApplianceId });
      expect(result.status).toBe('success');
      expect(result.warranty).toBeDefined();
      expect(result.warranty.appliance_id).toBe(sampleApplianceId);
      expect(typeof result.warranty.is_active).toBe('boolean');

      await client.close();
    });

    it('list_repair_cases lists sample cases for guest and private cases for User A', async () => {
      // Guest: sees demo cases
      const guestClient = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await guestClient.connect();
      const guestCases = await guestClient.listRepairCases();
      expect(guestCases.cases.some((c: any) => c.id === userAPrivateCaseId)).toBe(false);
      await guestClient.close();

      // User A: sees Alice's private cases
      const aliceClient = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await aliceClient.connect();
      const aliceCases = await aliceClient.listRepairCases();
      expect(aliceCases.cases.some((c: any) => c.id === userAPrivateCaseId)).toBe(true);
      await aliceClient.close();
    });
  });

  describe('3. Cross-User Privacy & Impersonation Prevention', () => {
    it('rejects User B attempting to view User A private passport', async () => {
      const clientB = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userBToken });
      await clientB.connect();

      const result = await clientB.callTool('get_repair_passport', {
        appliance_id: userAPrivateApplianceId,
      });

      expect(result.isError).toBe(true);
      const parsed = clientB.parseResult(result);
      expect(parsed.statusCode).toBe(404);

      await clientB.close();
    });

    it('rejects User B attempting to view User A private repair case', async () => {
      const clientB = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userBToken });
      await clientB.connect();

      const result = await clientB.callTool('get_repair_case', {
        case_id: userAPrivateCaseId,
      });

      expect(result.isError).toBe(true);
      const parsed = clientB.parseResult(result);
      expect(parsed.statusCode).toBe(404);

      await clientB.close();
    });

    it('rejects guest attempting to view User A private appliance passport', async () => {
      const guestClient = new FixFlowMcpClient({ serverUrl: mcpUrl });
      await guestClient.connect();

      const result = await guestClient.callTool('get_repair_passport', {
        appliance_id: userAPrivateApplianceId,
      });

      expect(result.isError).toBe(true);
      const parsed = guestClient.parseResult(result);
      expect(parsed.statusCode).toBe(404);

      await guestClient.close();
    });

    it('rejects User B attempting to create repair case on User A private appliance', async () => {
      const clientB = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userBToken });
      await clientB.connect();

      const result = await clientB.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Unauthorized trespass attempt by Bob on Alice appliance.',
        priority: 'urgent',
      });

      expect(result.isError).toBe(true);
      expect([403, 404]).toContain(result.parsed.statusCode);

      await clientB.close();
    });

    it('rejects User B attempting to add repair note to User A private repair case', async () => {
      const clientB = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userBToken });
      await clientB.connect();

      const result = await clientB.addRepairNote({
        case_id: userAPrivateCaseId,
        note: 'Unauthorized note injection by Bob.',
      });

      expect(result.isError).toBe(true);
      expect([403, 404]).toContain(result.parsed.statusCode);

      await clientB.close();
    });

    it('detects and rejects caller impersonation when tool token differs from connection token', async () => {
      // Connect as User A via HTTP header, but attempt to pass User B token in tool argument
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      const result = await clientA.callTool('search_appliances', {
        session_token: userBToken,
      });

      expect(result.isError).toBe(true);
      const parsed = clientA.parseResult(result);
      expect(parsed.statusCode).toBe(403);
      expect(parsed.message).toContain('Impersonation attempt detected');

      await clientA.close();
    });
  });

  describe('4. Hardened Two-Step Confirmation Token Workflow', () => {
    let createdToken: string;
    let newlyCreatedCaseId: string;

    it('Step 1: create_repair_case without confirmation_token returns proposal & single-use token', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      const res = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Steam wand pressure valve is clogged with milk residue.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
      });

      expect(res.isError).toBeFalsy();
      expect(res.parsed.status).toBe('confirmation_required');
      expect(res.parsed.action).toBe('create_repair_case');
      expect(res.parsed.confirmation_token).toBeDefined();
      expect(res.parsed.confirmation_token.startsWith('cfrm_')).toBe(true);
      expect(res.parsed.proposal.appliance_id).toBe(userAPrivateApplianceId);
      expect(res.parsed.proposal.appliance_name).toBe('Alice Espresso Machine');

      createdToken = res.parsed.confirmation_token;

      await clientA.close();
    });

    it('rejects case creation with invalid or fabricated confirmation token', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      const res = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Steam wand pressure valve is clogged with milk residue.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
        confirmation_token: 'cfrm_fake_fabricated_token_1234567890',
      });

      expect(res.isError).toBe(true);
      expect(res.parsed.error_type).toBe('confirmation_failed');
      expect(res.parsed.message).toContain('Confirmation token not found');

      await clientA.close();
    });

    it('rejects confirmation token if arguments were tampered with after proposal', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      // Submit with altered issue description
      const res = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'TAMPERED: Altered issue description not matching original proposal.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
        confirmation_token: createdToken,
      });

      expect(res.isError).toBe(true);
      expect(res.parsed.error_type).toBe('confirmation_failed');
      expect(res.parsed.message).toContain('Tamper detected');

      await clientA.close();
    });

    it('Step 2: executes case creation when valid confirmation token is provided with matching arguments', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      // Submit with a fresh proposal and matching parameters
      const step1 = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Steam wand pressure valve is clogged with milk residue.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
      });
      const validToken = step1.parsed.confirmation_token;

      const step2 = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Steam wand pressure valve is clogged with milk residue.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
        confirmation_token: validToken,
      });

      expect(step2.isError).toBeFalsy();
      expect(step2.parsed.status).toBe('success');
      expect(step2.parsed.case.id).toBeDefined();
      expect(step2.parsed.case.status).toBe('open');

      newlyCreatedCaseId = step2.parsed.case.id;

      // Single-use check: Attempting to reuse the same token must fail
      const reuse = await clientA.createRepairCase({
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Steam wand pressure valve is clogged with milk residue.',
        priority: 'high',
        appointment_date: '2026-11-10',
        appointment_notes: 'Available weekday mornings.',
        confirmation_token: validToken,
      });
      expect(reuse.isError).toBe(true);
      expect(reuse.parsed.error_type).toBe('confirmation_failed');

      await clientA.close();
    });

    it('verifies newly created case is immediately visible via backend API', async () => {
      const res = await fetch(`${backendUrl}/api/repairs/${newlyCreatedCaseId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.data.id).toBe(newlyCreatedCaseId);
      expect(data.data.status).toBe('open');
      expect(data.data.issue_description).toContain('Steam wand pressure valve');
    });

    it('Two-step confirmation flow for add_repair_note with single-use token', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      // Step 1: Proposal
      const step1 = await clientA.addRepairNote({
        case_id: newlyCreatedCaseId,
        note: 'De-scaled boiler with citric acid solution; water hardness measured at 3 GPG.',
      });
      expect(step1.parsed.status).toBe('confirmation_required');
      expect(step1.parsed.confirmation_token).toBeDefined();

      const noteToken = step1.parsed.confirmation_token;

      // Step 2: Confirmation
      const step2 = await clientA.addRepairNote({
        case_id: newlyCreatedCaseId,
        note: 'De-scaled boiler with citric acid solution; water hardness measured at 3 GPG.',
        confirmation_token: noteToken,
      });
      expect(step2.isError).toBeFalsy();
      expect(step2.parsed.status).toBe('success');

      // Verify note in events
      const events = step2.parsed.case.events || [];
      const addedEvent = events.find((e: any) => e.event_type === 'note_added');
      expect(addedEvent).toBeDefined();
      expect(addedEvent.description).toContain('citric acid solution');

      // Single-use check: reusing noteToken must fail
      const reuse = await clientA.addRepairNote({
        case_id: newlyCreatedCaseId,
        note: 'De-scaled boiler with citric acid solution; water hardness measured at 3 GPG.',
        confirmation_token: noteToken,
      });
      expect(reuse.isError).toBe(true);

      await clientA.close();
    });
  });

  describe('5. Error Handling & Backend Failure Resilience', () => {
    it('rejects short issue description under 10 characters', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      const res = await clientA.callTool('create_repair_case', {
        appliance_id: userAPrivateApplianceId,
        issue_description: 'Too short',
      });
      expect(res.isError).toBe(true);

      await clientA.close();
    });

    it('returns structured 404 for non-existent appliance', async () => {
      const clientA = new FixFlowMcpClient({ serverUrl: mcpUrl, sessionToken: userAToken });
      await clientA.connect();

      const res = await clientA.callTool('create_repair_case', {
        appliance_id: 'non-existent-appliance-99999999',
        issue_description: 'Valid issue description for non-existent appliance.',
      });
      expect(res.isError).toBe(true);
      const parsed = clientA.parseResult(res);
      expect(parsed.statusCode).toBe(404);

      await clientA.close();
    });

    it('returns structured 503 error when backend is unreachable without crashing session', async () => {
      const deadClient = new FixFlowBackendClient('http://127.0.0.1:59998');
      const { app: deadMcpApp } = createMcpApp(deadClient);

      let deadServer: http.Server;
      let deadMcpUrl: string;

      await new Promise<void>((resolve) => {
        deadServer = http.createServer(deadMcpApp).listen(0, '127.0.0.1', () => {
          const addr = deadServer.address() as { port: number };
          deadMcpUrl = `http://127.0.0.1:${addr.port}/mcp`;
          resolve();
        });
      });

      const client = new FixFlowMcpClient({ serverUrl: deadMcpUrl });
      await client.connect();

      const res = await client.callTool('search_appliances', {});
      expect(res.isError).toBe(true);
      const parsed = client.parseResult(res);
      expect(parsed.statusCode).toBe(503);

      await client.close();
      await new Promise<void>((resolve) => deadServer.close(() => resolve()));
    });
  });
});
