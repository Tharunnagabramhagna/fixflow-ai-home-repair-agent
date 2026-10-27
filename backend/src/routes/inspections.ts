import { Router, Response, NextFunction } from 'express';
import fs from 'fs';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { inspectionService } from '../services/inspectionService';
import { analyzeInspectionSchema, applyInspectionSchema } from '../validators';
import { extractClientIp, multimodalRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /api/inspections/analyze & POST /api/multimodal/analyze — Upload and analyze appliance photograph
const handleAnalyze = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = analyzeInspectionSchema.parse(req.body);
    const userId = req.user?.id || 'sample';

    // Strip data URL scheme prefix if present (e.g. data:image/jpeg;base64,...)
    let base64Clean = input.imageBase64;
    let declaredMime = input.mimeType;

    const dataUrlMatch = input.imageBase64.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      declaredMime = declaredMime || dataUrlMatch[1];
      base64Clean = dataUrlMatch[2];
    }

    const imageBuffer = Buffer.from(base64Clean, 'base64');

    const ipAddress = extractClientIp(req) || 'unknown';

    const inspection = await inspectionService.createInspection({
      userId,
      imageBuffer,
      originalFilename: input.filename || 'appliance_photo.jpg',
      declaredMimeType: declaredMime,
      userDescription: input.description,
      applianceId: input.applianceId,
      caseId: input.caseId,
      ipAddress,
    });

    res.status(201).json({ data: inspection });
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
};

router.post('/analyze', multimodalRateLimiter, handleAnalyze);
router.post('/', multimodalRateLimiter, handleAnalyze);

// GET /api/inspections — List inspections for authorized user
router.get('/', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'sample';
    const applianceId = typeof req.query.appliance_id === 'string' ? req.query.appliance_id : undefined;
    const caseId = typeof req.query.case_id === 'string' ? req.query.case_id : undefined;

    const inspections = inspectionService.listInspections({
      userId,
      applianceId,
      caseId,
    });

    res.json({ data: inspections });
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections/:id — Get details of a single visual inspection
router.get('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';

    const inspection = inspectionService.getInspectionById(id, userId);
    if (!inspection) {
      res.status(404).json({ error: 'Visual inspection not found or access denied.' });
      return;
    }

    res.json({ data: inspection });
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections/:id/image — Secure image streaming endpoint with ownership check
router.get('/:id/image', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';

    const inspection = inspectionService.getInspectionById(id, userId);
    if (!inspection) {
      res.status(404).json({ error: 'Image not found or access denied.' });
      return;
    }

    if (!fs.existsSync(inspection.storage_path)) {
      res.status(404).json({ error: 'Image file not found on server storage.' });
      return;
    }

    res.setHeader('Content-Type', inspection.mime_type);
    res.setHeader('Content-Length', inspection.file_size);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(inspection.storage_path);
    stream.on('error', (err) => {
      console.error('[ImageStream] Error reading stream:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream image file.' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inspections/:id — Delete inspection record and associated private file
router.delete('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';

    inspectionService.deleteInspection(id, userId);
    res.json({ success: true, message: 'Inspection and stored image deleted successfully.' });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/inspections/:id/apply — Confirm and apply extracted findings to appliance passport
router.post('/:id/apply', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id || 'sample';
    const input = applyInspectionSchema.parse(req.body);

    const result = inspectionService.applyInspectionData(
      id,
      userId,
      input.confirmationToken,
      {
        brand: input.brand,
        modelNumber: input.modelNumber,
        addAuditNote: true,
      }
    );

    if (result.proposalRequired) {
      res.status(200).json({
        confirmationRequired: true,
        token: result.token,
        proposal: result.proposal,
        message: 'Please review and confirm updating the appliance passport with extracted visual data.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.appliance,
      message: 'Appliance record successfully updated with verified visual inspection findings.',
    });
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

export default router;
