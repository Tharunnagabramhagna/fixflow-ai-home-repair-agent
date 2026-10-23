import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  createRepairCaseSchema,
  updateRepairStatusSchema,
  addRepairNoteSchema,
  initiateDispatchSchema,
  advanceDispatchSchema,
  cancelDispatchSchema,
} from '../validators';
import * as repairService from '../services/repairService';
import { dispatchService } from '../services/dispatchService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/repairs — Returns user's cases if authenticated, or sample cases for guest exploration
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { status, appliance_id } = req.query;
  const userId = req.user?.id || null;
  const filters: { status?: string; appliance_id?: string; user_id?: string | null } = {
    user_id: userId,
  };

  if (typeof status === 'string' && status) {
    filters.status = status;
  }
  if (typeof appliance_id === 'string' && appliance_id) {
    filters.appliance_id = appliance_id;
  }

  const cases = repairService.getAllRepairCases(filters);
  res.json({ data: cases });
});

// POST /api/repairs — Submit diagnostic fault report (requires authentication)
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = createRepairCaseSchema.parse(req.body);
    const userId = req.user?.id || 'sample';
    const repairCase = repairService.createRepairCase(input, userId);
    res.status(201).json({ data: repairCase });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status === 404 || err.message === 'Appliance not found') {
      res.status(404).json({ error: 'Appliance not found' });
      return;
    }
    if (err.status === 403) {
      res.status(403).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// GET /api/repairs/:id — Get details of a sample case or owned private case
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user?.id || null;
  const repairCase = repairService.getRepairCaseById(id, userId);
  if (!repairCase) {
    res.status(404).json({ error: 'Repair case not found' });
    return;
  }
  res.json({ data: repairCase });
});

// PATCH /api/repairs/:id/status — Transition repair case status (requires authentication)
router.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || null;
    const input = updateRepairStatusSchema.parse(req.body);
    const updated = repairService.updateRepairStatus(id, input, userId);
    res.json({ data: updated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status === 404 || err.message === 'Repair case not found') {
      res.status(404).json({ error: err.message || 'Repair case not found' });
      return;
    }
    if (err.message && err.message.startsWith('Cannot transition')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/repairs/:id/notes — Add note/audit event to repair case (requires authentication)
router.post('/:id/notes', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || null;
    const input = addRepairNoteSchema.parse(req.body);
    const updated = repairService.addRepairNote(id, input.note, userId);
    res.status(201).json({ data: updated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status === 404 || err.message === 'Repair case not found') {
      res.status(404).json({ error: 'Repair case not found' });
      return;
    }
    if (err.status === 401 || err.status === 403) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// GET /api/repairs/:id/dispatch — Get current contractor dispatch status and event history
router.get('/:id/dispatch', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';
    const dispatch = dispatchService.getDispatchByCaseId(id, userId);

    if (!dispatch) {
      // Check if repair case exists first
      const repairCase = repairService.getRepairCaseById(id, userId);
      if (!repairCase) {
        res.status(404).json({ error: 'Repair case not found' });
        return;
      }
      res.status(404).json({ error: 'No contractor dispatch found for this repair case' });
      return;
    }

    res.json({ data: dispatch });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/repairs/:id/dispatch/initiate — Initiate simulated contractor dispatch
router.post('/:id/dispatch/initiate', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';
    const input = initiateDispatchSchema.parse(req.body);

    const dispatch = dispatchService.initiateDispatch(id, userId, input.notes);
    res.status(201).json({ data: dispatch });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/repairs/:id/dispatch/advance — Advance simulated dispatch state (e.g. pending -> dispatched -> en_route -> arrived -> completed)
router.post('/:id/dispatch/advance', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';
    const input = advanceDispatchSchema.parse(req.body);

    const updated = dispatchService.advanceDispatchStatus(
      id,
      userId,
      input.targetStatus as any,
      input.message
    );
    res.json({ data: updated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/repairs/:id/dispatch/cancel — Cancel active simulated dispatch
router.post('/:id/dispatch/cancel', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';
    const input = cancelDispatchSchema.parse(req.body);

    const cancelled = dispatchService.cancelDispatch(id, userId, input.reason);
    res.json({ data: cancelled });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// GET /api/repairs/:id/dispatch/stream — Server-Sent Events (SSE) live dispatch update stream
router.get('/:id/dispatch/stream', (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user?.id || 'sample';

  // 1. Verify access to repair case
  const repairCase = repairService.getRepairCaseById(id, userId);
  if (!repairCase) {
    res.status(404).json({ error: 'Repair case not found or access denied' });
    return;
  }

  // 2. Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  // Send initial state immediately
  const initialDispatch = dispatchService.getDispatchByCaseId(id, userId);
  res.write(`data: ${JSON.stringify({ type: 'initial_state', caseId: id, dispatch: initialDispatch })}\n\n`);

  // Periodic heartbeat comment (prevents connection drop)
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  // Subscribe to live updates
  const unsubscribe = dispatchService.subscribe(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
