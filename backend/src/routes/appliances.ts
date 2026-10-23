import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createApplianceSchema } from '../validators';
import * as applianceService from '../services/applianceService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/appliances — Returns user's appliances if authenticated, or sample appliances for guest exploration
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || null;
  const appliances = applianceService.getAllAppliances(userId);
  res.json({ data: appliances });
});

// POST /api/appliances — Register a new appliance (requires authentication)
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = createApplianceSchema.parse(req.body);
    const userId = req.user?.id || 'sample';
    const appliance = applianceService.createAppliance(input, userId);
    res.status(201).json({ data: appliance });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    next(err);
  }
});

// GET /api/appliances/:id — Get details of a sample appliance or owned private appliance
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user?.id || null;
  const appliance = applianceService.getApplianceById(id, userId);
  if (!appliance) {
    res.status(404).json({ error: 'Appliance not found' });
    return;
  }
  res.json({ data: appliance });
});

// GET /api/appliances/:id/history — Get Digital Repair Passport history
router.get('/:id/history', (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user?.id || null;
  const history = applianceService.getApplianceHistory(id, userId);
  if (!history) {
    res.status(404).json({ error: 'Appliance not found' });
    return;
  }
  res.json({ data: history });
});

export default router;
