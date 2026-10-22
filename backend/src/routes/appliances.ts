import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createApplianceSchema } from '../validators';
import * as applianceService from '../services/applianceService';

const router = Router();

// GET /api/appliances
router.get('/', (_req: Request, res: Response) => {
  const appliances = applianceService.getAllAppliances();
  res.json({ data: appliances });
});

// POST /api/appliances
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createApplianceSchema.parse(req.body);
    const appliance = applianceService.createAppliance(input);
    res.status(201).json({ data: appliance });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map(e => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    next(err);
  }
});

// GET /api/appliances/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const appliance = applianceService.getApplianceById(id);
  if (!appliance) {
    res.status(404).json({ error: 'Appliance not found' });
    return;
  }
  res.json({ data: appliance });
});

// GET /api/appliances/:id/history
router.get('/:id/history', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const appliance = applianceService.getApplianceById(id);
  if (!appliance) {
    res.status(404).json({ error: 'Appliance not found' });
    return;
  }
  const history = applianceService.getApplianceHistory(id);
  res.json({ data: { appliance, ...history } });
});

export default router;
