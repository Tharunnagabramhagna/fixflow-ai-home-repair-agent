import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import app from '../app';
import { initializeDatabase } from '../db/database';
import { confirmationManager } from '../services/confirmationManager';
import { dispatchService } from '../services/dispatchService';
import { authService } from '../services/authService';
import * as applianceService from '../services/applianceService';
import * as repairService from '../services/repairService';
import { validateSignatureCertChainUrl, validateTimestampFreshness } from '../services/alexaVerifier';

describe('FixFlow Phase 4 — Alexa Voice Integration Layer Tests', () => {
  let userToken: string;
  let userId: string;
  let userApplianceId: string;
  let userCaseId: string;

  beforeEach(async () => {
    initializeDatabase();
    confirmationManager.clear();

    const reg = await authService.register({
      name: 'Elena Rostova',
      email: `elena_${Date.now()}@example.com`,
      password: 'Password123!',
    });
    userId = reg.user.id;
    userToken = reg.token;

    const appliance = applianceService.createAppliance(
      {
        name: 'Smart Kitchen Refrigerator',
        category: 'Kitchen',
        brand: 'Samsung',
        model: 'RF28R7551SR',
        warranty_expiration: '2027-04-15',
      },
      userId
    );
    userApplianceId = appliance.id;

    const repairCase = repairService.createRepairCase(
      {
        appliance_id: userApplianceId,
        issue_description: 'Ice maker motor jammed and vibrating loudly.',
        priority: 'medium',
      },
      userId
    );
    userCaseId = repairCase.id;
  });

  // 1. GET /api/alexa discovery endpoint
  it('1. Returns valid endpoint discovery metadata with supported intents and safety features', async () => {
    const res = await supertest(app).get('/api/alexa');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.supportedIntents).toContain('DiagnoseApplianceIntent');
    expect(res.body.supportedIntents).toContain('CheckWarrantyIntent');
    expect(res.body.supportedIntents).toContain('CheckDispatchStatusIntent');
    expect(res.body.supportedIntents).toContain('RequestRepairIntent');
    expect(res.body.features).toContain('two_step_voice_mutation_confirmation');
    expect(res.body.features).toContain('critical_hazard_safety_interceptor');
  });

  // 2. LaunchRequest
  it('2. Handles LaunchRequest with voice welcome message and reprompt', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'LaunchRequest',
          requestId: 'amzn1.echo-api.request.launch-001',
          timestamp: new Date().toISOString(),
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.response.outputSpeech.text).toContain('Welcome to FixFlow');
    expect(res.body.response.reprompt.outputSpeech.text).toBeDefined();
    expect(res.body.response.shouldEndSession).toBe(false);
  });

  // 3. AMAZON.HelpIntent and StopIntent
  it('3. Handles AMAZON.HelpIntent and AMAZON.StopIntent properly', async () => {
    const helpRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.help-001',
          timestamp: new Date().toISOString(),
          intent: { name: 'AMAZON.HelpIntent' },
        },
      });

    expect(helpRes.status).toBe(200);
    expect(helpRes.body.response.outputSpeech.text).toContain('With FixFlow, you can say');
    expect(helpRes.body.response.shouldEndSession).toBe(false);

    const stopRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.stop-001',
          timestamp: new Date().toISOString(),
          intent: { name: 'AMAZON.StopIntent' },
        },
      });

    expect(stopRes.status).toBe(200);
    expect(stopRes.body.response.outputSpeech.text).toContain('Goodbye');
    expect(stopRes.body.response.shouldEndSession).toBe(true);
  });

  // 4. DiagnoseApplianceIntent: Standard Diagnosis
  it('4. Provides concise, spoken troubleshooting guidance for appliance symptoms', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.diag-001',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'DiagnoseApplianceIntent',
            slots: {
              Appliance: { name: 'Appliance', value: 'refrigerator' },
              Symptom: { name: 'Symptom', value: 'water leak' },
            },
          },
        },
      });

    expect(res.status).toBe(200);
    const speech = res.body.response.outputSpeech.text;
    expect(speech).toMatch(/water leak|drain hose|water supply valve/i);
    expect(res.body.response.shouldEndSession).toBe(false);
  });

  // 5. DiagnoseApplianceIntent: Missing slots clarify
  it('5. Prompts with clarifying questions when crucial symptom information is missing', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.diag-002',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'DiagnoseApplianceIntent',
            slots: {}, // no slots
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.response.outputSpeech.text).toContain('Which appliance is having a problem');
    expect(res.body.response.reprompt.outputSpeech.text).toBeDefined();
  });

  // 6. Critical Safety Interceptor in Voice
  it('6. Immediately returns emergency guidance when gas leaks or electrical sparks are described', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.hazard-001',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'DiagnoseApplianceIntent',
            slots: {
              Appliance: { name: 'Appliance', value: 'kitchen stove' },
              Symptom: { name: 'Symptom', value: 'I smell a strong gas leak and hearing hissing' },
            },
          },
        },
      });

    expect(res.status).toBe(200);
    const text = res.body.response.outputSpeech.text;
    expect(text).toContain('CRITICAL SAFETY ALERT');
    expect(text).toMatch(/evacuate|circuit breaker|do not attempt diy/i);
  });

  // 7. CheckWarrantyIntent
  it('7. Speaks accurate warranty coverage and expiration details for registered appliance', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-001',
          user: { userId: 'amzn-user-1', accessToken: userToken },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.warr-001',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'CheckWarrantyIntent',
            slots: {
              Appliance: { name: 'Appliance', value: 'refrigerator' },
            },
          },
        },
      });

    expect(res.status).toBe(200);
    const text = res.body.response.outputSpeech.text;
    expect(text).toContain('Samsung');
    expect(text).toContain('2027-04-15');
    expect(text).toContain('warranty');
  });

  // 8. CheckDispatchStatusIntent
  it('8. Speaks live contractor dispatch status, technician, and ETA', async () => {
    // Initiate simulated dispatch for user's case
    dispatchService.initiateDispatch(userCaseId, userId);
    dispatchService.advanceDispatchStatus(userCaseId, userId, 'dispatched');
    dispatchService.advanceDispatchStatus(userCaseId, userId, 'en_route');

    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-002',
          user: { userId: 'amzn-user-1', accessToken: userToken },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.disp-001',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'CheckDispatchStatusIntent',
            slots: {
              CaseNumber: { name: 'CaseNumber', value: userCaseId },
            },
          },
        },
      });

    expect(res.status).toBe(200);
    const text = res.body.response.outputSpeech.text;
    expect(text).toMatch(/en route/i);
    expect(text).toMatch(/Technician|minutes/i);
  });

  // 9. Two-Step Voice Confirmation Workflow (RequestRepairIntent -> AMAZON.YesIntent)
  it('9. Requires explicit spoken confirmation before creating a repair case and queueing dispatch', async () => {
    // Step 1: Request repair
    const prepRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-003',
          user: { userId: 'amzn-user-1', accessToken: userToken },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.req-001',
          timestamp: new Date().toISOString(),
          intent: {
            name: 'RequestRepairIntent',
            slots: {
              Appliance: { name: 'Appliance', value: 'refrigerator' },
              Symptom: { name: 'Symptom', value: 'Compressor clicking and temperature rising' },
            },
          },
        },
      });

    expect(prepRes.status).toBe(200);
    expect(prepRes.body.response.outputSpeech.text).toContain('Would you like me to confirm and schedule this now?');

    // Verify session attribute has pending confirmation token
    const pendingConf = prepRes.body.sessionAttributes.pendingConfirmation;
    expect(pendingConf).toBeDefined();
    expect(pendingConf.token).toMatch(/^cfrm_/);

    // Step 2: Affirmative confirmation (AMAZON.YesIntent)
    const confirmRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-003',
          user: { userId: 'amzn-user-1', accessToken: userToken },
          attributes: {
            pendingConfirmation: pendingConf,
          },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.confirm-001',
          timestamp: new Date().toISOString(),
          intent: { name: 'AMAZON.YesIntent' },
        },
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.response.outputSpeech.text).toContain('confirmed and submitted');
    expect(confirmRes.body.response.outputSpeech.text).toMatch(/technician.*queued/i);
    expect(confirmRes.body.sessionAttributes.pendingConfirmation).toBeUndefined();

    // Verify token cannot be re-used (single-use replay protection)
    const reuseRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-003',
          user: { userId: 'amzn-user-1', accessToken: userToken },
          attributes: {
            pendingConfirmation: pendingConf,
          },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.confirm-002',
          timestamp: new Date().toISOString(),
          intent: { name: 'AMAZON.YesIntent' },
        },
      });

    expect(reuseRes.status).toBe(200);
    expect(reuseRes.body.response.outputSpeech.text).toMatch(/expired or was already completed/i);
  });

  // 10. Rejection of proposal (AMAZON.NoIntent)
  it('10. Discards pending repair proposal when user says No', async () => {
    const cancelRes = await supertest(app)
      .post('/api/alexa')
      .send({
        version: '1.0',
        session: {
          sessionId: 'session-004',
          user: { userId: 'amzn-user-1', accessToken: userToken },
          attributes: {
            pendingConfirmation: {
              token: 'cfrm_sample',
              action: 'create_repair_case',
            },
          },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'amzn1.echo-api.request.no-001',
          timestamp: new Date().toISOString(),
          intent: { name: 'AMAZON.NoIntent' },
        },
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.response.outputSpeech.text).toContain('cancelled');
    expect(cancelRes.body.sessionAttributes.pendingConfirmation).toBeUndefined();
  });

  // 11. Request signature and timestamp verification security
  it('11. Rejects requests with stale timestamps (> 150s) and invalid cert chain URLs', async () => {
    // Stale timestamp (10 minutes in the past)
    const staleTime = new Date(Date.now() - 600 * 1000).toISOString();
    expect(validateTimestampFreshness(staleTime)).toBe(false);

    // Fresh timestamp (5 seconds ago)
    const freshTime = new Date(Date.now() - 5000).toISOString();
    expect(validateTimestampFreshness(freshTime)).toBe(true);

    // Valid Amazon cert chain URL
    expect(
      validateSignatureCertChainUrl('https://echo-api.amazon.com/echo.api/echo-api-cert.pem')
    ).toBe(true);

    // Malicious URL with wrong protocol
    expect(
      validateSignatureCertChainUrl('http://echo-api.amazon.com/echo.api/echo-api-cert.pem')
    ).toBe(false);

    // Malicious URL with wrong domain
    expect(
      validateSignatureCertChainUrl('https://malicious-attacker.com/echo.api/echo-api-cert.pem')
    ).toBe(false);

    // Malicious URL with wrong path
    expect(
      validateSignatureCertChainUrl('https://echo-api.amazon.com/malicious/cert.pem')
    ).toBe(false);
  });

  // 12. Sanitized error handling: Never leak stack traces or secrets
  it('12. Returns sanitized spoken error without leaking stack traces or credentials on malformed input', async () => {
    const res = await supertest(app)
      .post('/api/alexa')
      .send({
        // Malformed body missing request
        version: '1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or missing Alexa request envelope');
    expect(JSON.stringify(res.body)).not.toContain('stack');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});
