import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { alexaPlusAdapter, AlexaPlusRequestPayload } from '../services/alexaPlusAdapter';

const router = Router();

// GET /api/alexa-plus/v1/health — Endpoint health check & supported operations
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'FixFlow Alexa+ Home Services Category Adapter',
    version: '1.0.0',
    namespace: 'com.amazon.alexa.homeservices.v1',
    category: 'home_services',
    supportedOperations: [
      'Discover',
      'GetDiagnostics',
      'CheckAvailability',
      'CreateBooking',
      'GetBookingStatus',
      'CancelBooking',
    ],
    mcpIntegration: {
      enabled: true,
      protocol: 'streamable-http',
      version: '2025-11-25',
      endpoint: '/mcp',
    },
    simulationDisclosure: {
      isSimulation: true,
      notice: 'FixFlow contractor dispatch and scheduling are simulated demonstrations for the Amazon Developers Hackathon Alexa+ Track.',
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/alexa-plus/v1/manifest — Serves official Alexa+ Category Add-on manifest
router.get('/manifest', (_req: Request, res: Response) => {
  const manifestPath = path.resolve(__dirname, '../../../alexa-plus-addon.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      res.json(manifest);
      return;
    } catch {
      // Fall through to default manifest payload below
    }
  }

  res.json({
    schemaVersion: '2025-11-25',
    addOnId: 'com.amazon.alexa.homeservices.fixflow',
    namespace: 'com.amazon.alexa.homeservices.v1',
    category: 'home_services',
    name: 'FixFlow Home Repair & Diagnostics',
  });
});

// POST /api/alexa-plus/v1/action — Handles SPI requests
router.post('/action', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const envelope = req.body as AlexaPlusRequestPayload;

    if (!envelope || !envelope.header || !envelope.header.namespace || !envelope.header.name) {
      res.status(400).json({
        header: {
          namespace: 'com.amazon.alexa.homeservices.v1',
          name: 'ErrorResponse',
          messageId: envelope?.header?.messageId || 'unknown',
          payloadVersion: '1.0',
        },
        payload: {
          errorCode: 'INVALID_REQUEST',
          description: 'Request envelope missing required header (namespace, name, messageId).',
        },
      });
      return;
    }

    // Resolve authenticated user from Bearer token or session
    const authHeader = req.headers.authorization;
    const userContext = alexaPlusAdapter.resolveUser(authHeader);

    // If session cookie is present and no Bearer token was passed, check req.user from optionalAuth
    if (userContext.isGuest && (req as any).user) {
      const u = (req as any).user;
      userContext.userId = u.id;
      userContext.userName = u.name || 'Homeowner';
      userContext.isGuest = false;
    }

    const response = await alexaPlusAdapter.handleOperation(envelope, userContext);
    res.json(response);
  } catch (err: any) {
    console.error('[AlexaPlusRouter] Unhandled error:', err);
    res.status(500).json({
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'ErrorResponse',
        messageId: req.body?.header?.messageId || 'unknown',
        payloadVersion: '1.0',
      },
      payload: {
        errorCode: 'INTERNAL_ERROR',
        description: 'An unexpected internal error occurred while processing the Alexa+ request.',
      },
    });
  }
});

export default router;
