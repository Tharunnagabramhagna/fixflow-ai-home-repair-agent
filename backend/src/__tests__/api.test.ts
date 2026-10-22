import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import db, { initializeDatabase } from '../db/database';
import { seedDatabase } from '../db/seed';

beforeAll(() => {
  initializeDatabase();
  // Clean test tables to ensure complete test isolation
  db.exec('DELETE FROM warranty_documents; DELETE FROM repair_events; DELETE FROM repair_cases; DELETE FROM appliances;');
  seedDatabase();
});

describe('FixFlow API Integration Tests', () => {
  describe('Test Isolation & Database Safety', () => {
    it('should use an isolated test database file', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(db.name).toContain('test-fixflow.db');
      expect(db.name).not.toMatch(/[\\/]fixflow\.db$/);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('FixFlow API');
    });
  });

  describe('Appliances API', () => {
    it('GET /api/appliances should return appliances array with seeded data', async () => {
      const res = await request(app).get('/api/appliances');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(5);
    });

    it('POST /api/appliances should create a new appliance when valid', async () => {
      const newAppliance = {
        name: 'Smart Microwave Oven',
        category: 'Kitchen',
        brand: 'Panasonic',
        model: 'NN-SN966S',
        serial_number: 'SN-MW-9912',
        purchase_date: '2024-02-15',
        warranty_expiration: '2026-02-15',
        location: 'Kitchen Counter',
        notes: 'Inverter microwave with sensor cook',
      };

      const res = await request(app).post('/api/appliances').send(newAppliance);
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(newAppliance.name);
      expect(res.body.data.brand).toBe('Panasonic');
    });

    it('POST /api/appliances should return 400 validation error if required fields are missing', async () => {
      const invalidAppliance = {
        category: 'Kitchen',
        // missing name, brand, model
      };

      const res = await request(app).post('/api/appliances').send(invalidAppliance);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('GET /api/appliances/:id should return appliance details for existing ID', async () => {
      const res = await request(app).get('/api/appliances/demo-app-001');
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('demo-app-001');
      expect(res.body.data.name).toBe('Kitchen Refrigerator');
    });

    it('GET /api/appliances/:id should return 404 for non-existent ID', async () => {
      const res = await request(app).get('/api/appliances/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Appliance not found');
    });

    it('GET /api/appliances/:id/history should return cases, events, and warranty documents', async () => {
      const res = await request(app).get('/api/appliances/demo-app-001/history');
      expect(res.status).toBe(200);
      expect(res.body.data.appliance).toBeDefined();
      expect(Array.isArray(res.body.data.cases)).toBe(true);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.documents[0].filename).toBe('samsung_rf28_warranty_certificate.pdf');
    });
  });

  describe('Repairs API', () => {
    let createdCaseId: string;

    it('GET /api/repairs should return repair cases list', async () => {
      const res = await request(app).get('/api/repairs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    it('GET /api/repairs?status=scheduled should filter cases by status', async () => {
      const res = await request(app).get('/api/repairs?status=scheduled');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((c: any) => {
        expect(c.status).toBe('scheduled');
      });
    });

    it('POST /api/repairs should create a new repair case linked to an appliance', async () => {
      const newCase = {
        appliance_id: 'demo-app-004',
        issue_description: 'Dishwasher not draining completely after the normal wash cycle.',
        priority: 'high',
      };

      const res = await request(app).post('/api/repairs').send(newCase);
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('open');
      expect(res.body.data.appliance_id).toBe('demo-app-004');
      createdCaseId = res.body.data.id;
    });

    it('POST /api/repairs should return 400 if issue_description is too short', async () => {
      const res = await request(app).post('/api/repairs').send({
        appliance_id: 'demo-app-004',
        issue_description: 'broken', // under 10 chars
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('POST /api/repairs should return 404 if appliance_id does not exist', async () => {
      const res = await request(app).post('/api/repairs').send({
        appliance_id: 'non-existent-app-id',
        issue_description: 'Valid issue description for testing non-existent appliance.',
        priority: 'low',
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Appliance not found');
    });

    it('GET /api/repairs/:id should return repair case and its event timeline', async () => {
      const res = await request(app).get(`/api/repairs/${createdCaseId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdCaseId);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.events[0].event_type).toBe('created');
    });

    it('PATCH /api/repairs/:id/status should update status and create an event', async () => {
      const res = await request(app)
        .patch(`/api/repairs/${createdCaseId}/status`)
        .send({
          status: 'diagnosed',
          resolution_notes: 'Filter blockage detected in bottom drain.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('diagnosed');

      // Verify event was logged
      const caseRes = await request(app).get(`/api/repairs/${createdCaseId}`);
      const events = caseRes.body.data.events;
      const statusEvent = events.find((e: any) => e.event_type === 'status_change');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.old_value).toBe('open');
      expect(statusEvent.new_value).toBe('diagnosed');
    });

    it('PATCH /api/repairs/:id/status should reject invalid transitions', async () => {
      // From diagnosed, cannot jump directly to resolved without going through in_progress/closed
      const res = await request(app)
        .patch(`/api/repairs/${createdCaseId}/status`)
        .send({
          status: 'resolved',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });
  });

  describe('Dashboard Summary API', () => {
    it('GET /api/dashboard/summary should return aggregated counts and recent events', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.data.counts).toBeDefined();
      expect(typeof res.body.data.counts.total_appliances).toBe('number');
      expect(typeof res.body.data.counts.open_repairs).toBe('number');
      expect(typeof res.body.data.counts.scheduled_visits).toBe('number');
      expect(typeof res.body.data.counts.resolved_cases).toBe('number');
      expect(Array.isArray(res.body.data.recent_events)).toBe(true);
      expect(Array.isArray(res.body.data.upcoming_appointments)).toBe(true);
    });
  });
});
