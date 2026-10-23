import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import db, { initializeDatabase } from '../db/database';
import { authService } from '../services/authService';

describe('FixFlow — Phase 5: Alexa+ Home Services Category Adapter Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userAApplianceId: string;

  let userBToken: string;
  let userBId: string;

  beforeAll(async () => {
    initializeDatabase();

    // Create test user A
    const userA = await authService.register({
      name: 'Alice Homeowner',
      email: `alice.alexaplus.${Date.now()}@example.com`,
      password: 'SecurePassword123!',
    });
    userAToken = userA.token;
    userAId = userA.user.id;

    // Register an appliance for User A
    const appA = db
      .prepare(
        `INSERT INTO appliances (id, name, category, brand, model, serial_number, location, purchase_date, warranty_expiration, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        `app-alexaplus-${Date.now()}`,
        'Alice High-Efficiency Dryer',
        'Laundry',
        'Whirlpool',
        'WGD8127LW',
        'SN-WP-882211',
        'Laundry Room',
        '2024-03-01',
        '2027-03-01',
        userAId
      ) as any;
    userAApplianceId = appA.id;

    // Create test user B
    const userB = await authService.register({
      name: 'Bob Homeowner',
      email: `bob.alexaplus.${Date.now()}@example.com`,
      password: 'SecurePassword456!',
    });
    userBToken = userB.token;
    userBId = userB.user.id;
  });

  // 1. Discovery & Manifest
  describe('1. Discovery & Add-on Manifest', () => {
    it('GET /api/alexa-plus/v1/health should return supported operations and simulation disclosure', async () => {
      const res = await request(app).get('/api/alexa-plus/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.namespace).toBe('com.amazon.alexa.homeservices.v1');
      expect(res.body.category).toBe('home_services');
      expect(res.body.supportedOperations).toContain('GetDiagnostics');
      expect(res.body.supportedOperations).toContain('CreateBooking');
      expect(res.body.simulationDisclosure.isSimulation).toBe(true);
    });

    it('GET /api/alexa-plus/v1/manifest should serve official Category SDK add-on manifest', async () => {
      const res = await request(app).get('/api/alexa-plus/v1/manifest');
      expect(res.status).toBe(200);
      expect(res.body.namespace).toBe('com.amazon.alexa.homeservices.v1');
      expect(res.body.category).toBe('home_services');
      expect(res.body.schemaVersion).toBe('2025-11-25');
    });

    it('POST Discover should return auto-match discovery strategy and capability notice', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'Discover',
            messageId: 'msg-disc-001',
            payloadVersion: '1.0',
          },
          payload: {},
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('DiscoverResponse');
      expect(res.body.payload.discoveryStrategy).toBe('AUTO_MATCH');
      expect(res.body.payload.supportedCategories).toContain('Kitchen');
      expect(res.body.payload.supportedCategories).toContain('Laundry');
    });
  });

  // 2. Diagnostics, Warranty, and Safety Interceptor
  describe('2. Diagnostics, Warranty & Safety Interceptor', () => {
    it('POST GetDiagnostics should return verified warranty countdown and repair passport summary for authorized appliance', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'GetDiagnostics',
            messageId: 'msg-diag-001',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            symptomDescription: 'Dryer makes a mild squeaking noise when rotating',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('GetDiagnosticsResponse');
      expect(res.body.payload.appliance.brand).toBe('Whirlpool');
      expect(res.body.payload.warranty.isActive).toBe(true);
      expect(res.body.payload.canProceedWithBooking).toBe(true);
    });

    it('POST GetDiagnostics should immediately intercept gas leak and halt booking', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'GetDiagnostics',
            messageId: 'msg-hazard-001',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            symptomDescription: 'I smell a strong natural gas odor and rotten eggs near the dryer',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('SafetyHaltResponse');
      expect(res.body.payload.isHazardous).toBe(true);
      expect(res.body.payload.severity).toBe('CRITICAL');
      expect(res.body.payload.canProceedWithBooking).toBe(false);
      expect(res.body.payload.actionRequired).toMatch(/Evacuate|gas utility|911/i);
    });

    it('POST GetDiagnostics should reject User B attempting to diagnose User A private appliance', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'GetDiagnostics',
            messageId: 'msg-diag-unauth',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('APPLIANCE_NOT_FOUND');
    });
  });

  // 3. Scheduling Availability & CheckAvailability
  describe('3. Scheduling Availability', () => {
    it('POST CheckAvailability should return scheduled time slots for service booking', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CheckAvailability',
            messageId: 'msg-avail-001',
            payloadVersion: '1.0',
          },
          payload: {
            postalCode: '98101',
            serviceType: 'appliance_repair',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('CheckAvailabilityResponse');
      expect(Array.isArray(res.body.payload.availableSlots)).toBe(true);
      expect(res.body.payload.availableSlots.length).toBeGreaterThan(0);
      expect(res.body.payload.isSimulated).toBe(true);
    });
  });

  // 4. Two-Step Mutation Confirmation for Booking & Dispatch
  describe('4. Two-Step Confirmation & Booking Creation', () => {
    let confirmationToken: string;
    let createdBookingId: string;

    it('Step 1: POST CreateBooking without confirmation token returns proposal and single-use token', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-book-step1',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'Drum belt squealing on startup',
            priority: 'medium',
            slotId: 'slot-sample-1',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ConfirmationRequiredResponse');
      expect(res.body.payload.status).toBe('CONFIRMATION_REQUIRED');
      expect(res.body.payload.confirmationToken).toMatch(/^cfrm_/);
      expect(res.body.payload.proposal.applianceName).toBe('Alice High-Efficiency Dryer');
      expect(res.body.payload.proposal.disclaimer).toMatch(/simulated/i);

      confirmationToken = res.body.payload.confirmationToken;
    });

    it('Step 2: Rejects CreateBooking if arguments were tampered with after proposal was issued', async () => {
      // 1. Generate legitimate proposal
      const prepRes = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-book-tamper-prep',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'Drum belt squealing on startup',
            priority: 'medium',
            slotId: 'slot-sample-1',
          },
        });

      const token = prepRes.body.payload.confirmationToken;

      // 2. Attempt to use token with tampered arguments
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-book-tampered',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'TAMPERED ISSUE DESCRIPTION',
            priority: 'urgent',
            slotId: 'slot-sample-1',
            confirmationToken: token,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('INVALID_CONFIRMATION_TOKEN');
    });

    it('Step 2: Successfully executes CreateBooking when valid confirmation token is provided with matching arguments', async () => {
      // Generate a fresh token
      const prepRes = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-book-fresh',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'Drum belt squealing on startup',
            priority: 'medium',
            slotId: 'slot-sample-1',
          },
        });

      const freshToken = prepRes.body.payload.confirmationToken;

      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-book-step2',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'Drum belt squealing on startup',
            priority: 'medium',
            slotId: 'slot-sample-1',
            confirmationToken: freshToken,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('CreateBookingResponse');
      expect(res.body.payload.status).toBe('CONFIRMED');
      expect(res.body.payload.bookingId).toBeDefined();
      expect(res.body.payload.contractorDispatch.isSimulated).toBe(true);
      expect(res.body.payload.contractorDispatch.status).toBe('pending');

      createdBookingId = res.body.payload.bookingId;
    });

    it('POST GetBookingStatus returns live status and dispatch updates for authorized owner', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'GetBookingStatus',
            messageId: 'msg-status-001',
            payloadVersion: '1.0',
          },
          payload: {
            bookingId: createdBookingId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('GetBookingStatusResponse');
      expect(res.body.payload.status).toBe('open');
      expect(res.body.payload.dispatch.isSimulated).toBe(true);
      expect(res.body.payload.dispatch.status).toBe('pending');
    });

    it('Cross-User Denial: User B cannot view User A booking status', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'GetBookingStatus',
            messageId: 'msg-status-cross',
            payloadVersion: '1.0',
          },
          payload: {
            bookingId: createdBookingId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('BOOKING_NOT_FOUND');
    });

    it('POST CancelBooking safely cancels dispatch and closes case for authorized owner', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CancelBooking',
            messageId: 'msg-cancel-001',
            payloadVersion: '1.0',
          },
          payload: {
            bookingId: createdBookingId,
            cancellationReason: 'Fixed the belt manually',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('CancelBookingResponse');
      expect(res.body.payload.status).toBe('CANCELLED');
      expect(res.body.payload.isSimulated).toBe(true);
    });
  });

  // 5. Security & Boundary Checks
  describe('5. Security & Boundary Checks', () => {
    it('Rejects requests with invalid or unsupported namespace', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .send({
          header: {
            namespace: 'com.amazon.alexa.unsupported.v1',
            name: 'Discover',
            messageId: 'msg-invalid-ns',
            payloadVersion: '1.0',
          },
          payload: {},
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('INVALID_NAMESPACE');
    });

    it('Rejects requests missing required header properties with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .send({
          payload: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('INVALID_REQUEST');
    });

    it('Unauthenticated guest cannot create bookings without account linking', async () => {
      const res = await request(app)
        .post('/api/alexa-plus/v1/action')
        .send({
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'CreateBooking',
            messageId: 'msg-guest-book',
            payloadVersion: '1.0',
          },
          payload: {
            applianceId: userAApplianceId,
            issueDescription: 'Guest booking attempt',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.header.name).toBe('ErrorResponse');
      expect(res.body.payload.errorCode).toBe('AUTHENTICATION_REQUIRED');
    });
  });
});
