import { Router, Response } from 'express';
import * as repairService from '../services/repairService';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/summary — Summary statistics for homeowner or guest sample workspace
router.get('/summary', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || null;
  const summary = repairService.getDashboardSummary(userId);
  res.json({ data: summary });
});

export default router;
