import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createRepairCaseSchema, updateRepairStatusSchema } from '../validators';
import * as repairService from '../services/repairService';

const router = Router();

// GET /api/repairs
router.get('/', (req: Request, res: Response) => {
  const { status, appliance_id } = req.query;
  const filters: { status?: string; appliance_id?: string } = {};

  if (typeof status === 'string' && status) {
    filters.status = status;
  }
  if (typeof appliance_id === 'string' && appliance_id) {
    filters.appliance_id = appliance_id;
  }

  const cases = repairService.getAllRepairCases(filters);
  res.json({ data: cases });
});

// POST /api/repairs
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRepairCaseSchema.parse(req.body);
    const repairCase = repairService.createRepairCase(input);
    res.status(201).json({ data: repairCase });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.message === 'Appliance not found') {
      res.status(404).json({ error: 'Appliance not found' });
      return;
    }
    next(err);
  }
});

// GET /api/repairs/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const repairCase = repairService.getRepairCaseById(id);
  if (!repairCase) {
    res.status(404).json({ error: 'Repair case not found' });
    return;
  }
  res.json({ data: repairCase });
});

// PATCH /api/repairs/:id/status
router.patch('/:id/status', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = updateRepairStatusSchema.parse(req.body);
    const updated = repairService.updateRepairStatus(id, input);
    res.json({ data: updated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.message === 'Repair case not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message && err.message.startsWith('Cannot transition')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
