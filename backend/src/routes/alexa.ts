import { Router, Response, NextFunction } from 'express';
import { alexaService, AlexaRequestEnvelope } from '../services/alexaService';
import { alexaVerificationMiddleware, AlexaVerifiedRequest } from '../services/alexaVerifier';

const router = Router();

// GET /api/alexa — Endpoint discovery & integration health status
router.get('/', (_req, res: Response) => {
  res.json({
    status: 'ok',
    service: 'FixFlow Alexa Voice Integration Layer',
    supportedIntents: [
      'DiagnoseApplianceIntent',
      'CheckWarrantyIntent',
      'ReviewCaseIntent',
      'GetCaseStatusIntent',
      'CheckDispatchStatusIntent',
      'RequestRepairIntent',
      'AMAZON.YesIntent',
      'AMAZON.NoIntent',
      'AMAZON.HelpIntent',
      'AMAZON.StopIntent',
      'AMAZON.CancelIntent',
      'AMAZON.FallbackIntent',
    ],
    supportedRequests: ['LaunchRequest', 'IntentRequest', 'SessionEndedRequest'],
    features: [
      'two_step_voice_mutation_confirmation',
      'critical_hazard_safety_interceptor',
      'live_contractor_dispatch_voice_tracking',
      'ask_signature_and_timestamp_verification',
    ],
    timestamp: new Date().toISOString(),
  });
});

// POST /api/alexa — Official Alexa Skills Kit webhook endpoint
router.post(
  '/',
  alexaVerificationMiddleware,
  async (req: AlexaVerifiedRequest, res: Response, _next: NextFunction) => {
    try {
      const envelope = req.body as AlexaRequestEnvelope;

      // Basic payload validation
      if (!envelope || !envelope.request || !envelope.request.type) {
        res.status(400).json({ error: 'Invalid or missing Alexa request envelope.' });
        return;
      }

      const response = await alexaService.handleRequest(envelope);
      res.json(response);
    } catch (err: any) {
      console.error('[AlexaRoute] Handler error:', err);
      // Clean, user-facing Alexa response without leaking stack traces or internal diagnostics
      res.status(200).json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'I encountered an unexpected issue while processing your request. Please try again or check the FixFlow web dashboard.',
          },
          shouldEndSession: false,
        },
      });
    }
  }
);

export default router;
