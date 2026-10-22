import { Router, Request, Response } from 'express';
import * as repairService from '../services/repairService';

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', (_req: Request, res: Response) => {
  const summary = repairService.getDashboardSummary();
  res.json({ data: summary });
});

export default router;
