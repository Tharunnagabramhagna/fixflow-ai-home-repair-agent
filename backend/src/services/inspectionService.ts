import { v4 as uuidv4 } from 'uuid';
import { Database as DatabaseType } from 'better-sqlite3';
import db from '../db/database';
import * as applianceService from './applianceService';
import * as repairService from './repairService';
import {
  validateImageBuffer,
  saveInspectionImage,
  deleteInspectionFile,
  checkUploadRateLimit,
} from './imageService';
import {
  multimodalService,
  MultimodalAnalysisResult,
} from './multimodalService';
import { confirmationManager } from './confirmationManager';

export interface VisualInspectionRecord {
  id: string;
  user_id: string;
  appliance_id: string | null;
  case_id: string | null;
  filename: string;
  original_filename: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_size: number;
  width: number | null;
  height: number | null;
  storage_path: string;
  user_description: string | null;
  analysis_json: string;
  status: 'completed' | 'failed' | 'processing';
  error_message: string | null;
  has_hazard: number;
  applied_to_record: number;
  created_at: string;
  updated_at: string;
}

export interface VisualInspectionDetail extends Omit<VisualInspectionRecord, 'analysis_json'> {
  analysis: MultimodalAnalysisResult;
  appliance_name?: string;
}

export interface CreateInspectionOptions {
  userId: string;
  imageBuffer: Buffer;
  originalFilename: string;
  declaredMimeType?: string;
  userDescription?: string;
  applianceId?: string;
  caseId?: string;
  ipAddress?: string;
}

export class InspectionService {
  /**
   * Process an image upload and perform multimodal AI diagnostic analysis
   */
  async createInspection(
    options: CreateInspectionOptions,
    targetDb?: DatabaseType
  ): Promise<VisualInspectionDetail> {
    const activeDb = targetDb || db;
    const userId = options.userId || 'sample';

    // 1. Rate limit check (keyed by userId or IP)
    const rateKey = options.ipAddress || userId;
    const rateCheck = checkUploadRateLimit(rateKey, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      const err: any = new Error(
        `Upload rate limit exceeded. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before uploading another image.`
      );
      err.status = 429;
      throw err;
    }

    // 2. Validate appliance access if applianceId is specified
    let applianceContext: any = undefined;
    if (options.applianceId) {
      const app = applianceService.getApplianceById(options.applianceId, userId, activeDb);
      if (!app) {
        const err: any = new Error('Specified appliance not found or access denied');
        err.status = 404;
        throw err;
      }
      applianceContext = {
        name: app.name,
        brand: app.brand,
        model: app.model,
        category: app.category,
      };
    }

    // 3. Validate repair case access if caseId is specified
    if (options.caseId) {
      const repairCase = repairService.getRepairCaseById(options.caseId, userId, activeDb);
      if (!repairCase) {
        const err: any = new Error('Specified repair case not found or access denied');
        err.status = 404;
        throw err;
      }
      if (!options.applianceId) {
        options.applianceId = repairCase.appliance_id;
      }
    }

    // 4. Validate image binary buffer (magic bytes, dimensions, size, EXIF stripping)
    const validation = validateImageBuffer(options.imageBuffer, options.declaredMimeType);
    if (!validation.valid || !validation.mimeType || !validation.sanitizedBuffer) {
      const err: any = new Error(validation.error || 'Invalid image file provided.');
      err.status = 400;
      throw err;
    }

    // 5. Save sanitized image to private storage
    const saved = saveInspectionImage({
      buffer: validation.sanitizedBuffer,
      originalFilename: options.originalFilename,
      mimeType: validation.mimeType,
    });

    const inspectionId = `insp-${uuidv4()}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      // 6. Run multimodal analysis
      const analysisResult = await multimodalService.analyze({
        imageBuffer: validation.sanitizedBuffer,
        mimeType: validation.mimeType,
        userDescription: options.userDescription,
        applianceContext,
      });

      const hasHazard = analysisResult.safetyWarnings.length > 0 || analysisResult.requiresProfessionalInspection ? 1 : 0;
      const analysisJson = JSON.stringify(analysisResult);

      activeDb.prepare(`
        INSERT INTO visual_inspections (
          id, user_id, appliance_id, case_id, filename, original_filename,
          mime_type, file_size, width, height, storage_path, user_description,
          analysis_json, status, error_message, has_hazard, applied_to_record,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', null, ?, 0, ?, ?)
      `).run(
        inspectionId,
        userId,
        options.applianceId || null,
        options.caseId || null,
        saved.filename,
        saved.originalFilename,
        saved.mimeType,
        saved.fileSize,
        saved.width,
        saved.height,
        saved.storagePath,
        options.userDescription || null,
        analysisJson,
        hasHazard,
        now,
        now
      );

      // If associated with a repair case, add an audit note about the visual inspection
      if (options.caseId) {
        try {
          const findingsSummary = analysisResult.observations.slice(0, 2).join('; ');
          repairService.addRepairNote(
            options.caseId,
            `[Visual AI Inspection] Image uploaded (${saved.originalFilename}). Findings: ${findingsSummary || 'Visual review completed.'}`,
            userId,
            activeDb
          );
        } catch {}
      }

      return {
        id: inspectionId,
        user_id: userId,
        appliance_id: options.applianceId || null,
        case_id: options.caseId || null,
        filename: saved.filename,
        original_filename: saved.originalFilename,
        mime_type: saved.mimeType,
        file_size: saved.fileSize,
        width: saved.width,
        height: saved.height,
        storage_path: saved.storagePath,
        user_description: options.userDescription || null,
        status: 'completed',
        error_message: null,
        has_hazard: hasHazard,
        applied_to_record: 0,
        created_at: now,
        updated_at: now,
        analysis: analysisResult,
      };
    } catch (err: any) {
      // Clean up orphaned image file if analysis or database insertion failed
      deleteInspectionFile(saved.storagePath);
      throw err;
    }
  }

  /**
   * Retrieve an inspection record by ID with ownership enforcement
   */
  getInspectionById(
    id: string,
    userId?: string | null,
    targetDb?: DatabaseType
  ): VisualInspectionDetail | null {
    const activeDb = targetDb || db;
    const effectiveUser = userId || 'sample';

    const row = activeDb.prepare(
      'SELECT * FROM visual_inspections WHERE id = ?'
    ).get(id) as VisualInspectionRecord | undefined;

    if (!row) {
      return null;
    }

    // Ownership check (guests can only view sample inspections)
    if (row.user_id !== effectiveUser && row.user_id !== 'sample') {
      return null;
    }

    let parsedAnalysis: MultimodalAnalysisResult;
    try {
      parsedAnalysis = JSON.parse(row.analysis_json);
    } catch {
      parsedAnalysis = {
        applianceType: null,
        brand: null,
        modelNumber: null,
        modelConfidence: 'unverified',
        visibleErrorCodes: [],
        observations: [],
        possibleCauses: [],
        recommendedNextSteps: [],
        safetyWarnings: [],
        confidence: 'low',
        requiresProfessionalInspection: false,
        evidenceNotes: { visualFindings: [], inferredHypotheses: [], unreadableDetails: [] },
        disclaimer: '',
      };
    }

    let applianceName: string | undefined;
    if (row.appliance_id) {
      const app = activeDb.prepare('SELECT name FROM appliances WHERE id = ?').get(row.appliance_id) as any;
      if (app) applianceName = app.name;
    }

    const { analysis_json, ...rest } = row;
    return {
      ...rest,
      analysis: parsedAnalysis,
      appliance_name: applianceName,
    };
  }

  /**
   * List inspections for the authorized user, optionally filtered by applianceId or caseId
   */
  listInspections(
    options: {
      userId?: string | null;
      applianceId?: string;
      caseId?: string;
    },
    targetDb?: DatabaseType
  ): VisualInspectionDetail[] {
    const activeDb = targetDb || db;
    const effectiveUser = options.userId || 'sample';

    let query = 'SELECT * FROM visual_inspections WHERE (user_id = ? OR user_id = \'sample\')';
    const params: any[] = [effectiveUser];

    if (options.applianceId) {
      query += ' AND appliance_id = ?';
      params.push(options.applianceId);
    }

    if (options.caseId) {
      query += ' AND case_id = ?';
      params.push(options.caseId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = activeDb.prepare(query).all(...params) as VisualInspectionRecord[];

    return rows.map((row) => {
      let analysis: MultimodalAnalysisResult;
      try {
        analysis = JSON.parse(row.analysis_json);
      } catch {
        analysis = {} as any;
      }
      const { analysis_json, ...rest } = row;
      return {
        ...rest,
        analysis,
      };
    });
  }

  /**
   * Delete visual inspection record and associated image file safely
   */
  deleteInspection(
    id: string,
    userId: string,
    targetDb?: DatabaseType
  ): boolean {
    const activeDb = targetDb || db;
    const inspection = this.getInspectionById(id, userId, activeDb);

    if (!inspection) {
      const err: any = new Error('Inspection not found or access denied');
      err.status = 404;
      throw err;
    }

    // Delete image file from private storage
    deleteInspectionFile(inspection.storage_path);

    // Delete database record
    activeDb.prepare('DELETE FROM visual_inspections WHERE id = ?').run(id);
    return true;
  }

  /**
   * Apply extracted inspection findings (brand, model, error codes) to appliance record
   * using two-step confirmation token
   */
  applyInspectionData(
    id: string,
    userId: string,
    confirmationToken?: string,
    overrides?: { brand?: string; modelNumber?: string; addAuditNote?: boolean },
    targetDb?: DatabaseType
  ): {
    proposalRequired?: boolean;
    token?: string;
    proposal?: any;
    success?: boolean;
    appliance?: any;
  } {
    const activeDb = targetDb || db;
    const inspection = this.getInspectionById(id, userId, activeDb);

    if (!inspection) {
      const err: any = new Error('Inspection not found or access denied');
      err.status = 404;
      throw err;
    }

    if (!inspection.appliance_id) {
      const err: any = new Error('Inspection is not associated with an appliance');
      err.status = 400;
      throw err;
    }

    const appliance = applianceService.getApplianceById(inspection.appliance_id, userId, activeDb);
    if (!appliance) {
      const err: any = new Error('Appliance not found or access denied');
      err.status = 404;
      throw err;
    }

    const targetBrand = overrides?.brand !== undefined ? overrides.brand : inspection.analysis.brand || appliance.brand;
    const targetModel = overrides?.modelNumber !== undefined ? overrides.modelNumber : inspection.analysis.modelNumber || appliance.model;

    const actionArgs = {
      inspectionId: id,
      applianceId: inspection.appliance_id,
      brand: targetBrand,
      model: targetModel,
    };

    // Step 1: If no confirmation token provided, return proposal
    if (!confirmationToken) {
      const proposalDetails = {
        inspectionId: id,
        applianceName: appliance.name,
        currentBrand: appliance.brand,
        newBrand: targetBrand,
        currentModel: appliance.model,
        newModel: targetModel,
        detectedErrorCodes: inspection.analysis.visibleErrorCodes,
      };

      const proposal = confirmationManager.createProposal({
        action: 'apply_inspection_data',
        userId,
        applianceId: inspection.appliance_id,
        arguments: actionArgs,
        details: proposalDetails,
      });

      return {
        proposalRequired: true,
        token: proposal.token,
        proposal: proposalDetails,
      };
    }

    // Step 2: Verify and consume single-use token
    const verification = confirmationManager.verifyAndConsume({
      token: confirmationToken,
      action: 'apply_inspection_data',
      userId,
      applianceId: inspection.appliance_id,
      arguments: actionArgs,
    });

    if (!verification.valid) {
      const err: any = new Error(`Confirmation token verification failed: ${verification.reason}`);
      err.status = 400;
      throw err;
    }

    // Update appliance passport
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    activeDb.prepare(`
      UPDATE appliances
      SET brand = ?, model = ?, updated_at = ?
      WHERE id = ?
    `).run(targetBrand, targetModel, now, appliance.id);

    // Mark inspection as applied
    activeDb.prepare(`
      UPDATE visual_inspections
      SET applied_to_record = 1, updated_at = ?
      WHERE id = ?
    `).run(now, id);

    // If case is associated or audit note requested, record audit event
    if (inspection.case_id) {
      try {
        repairService.addRepairNote(
          inspection.case_id,
          `[Passport Updated via Visual AI] Model updated to '${targetModel}', Brand updated to '${targetBrand}' from inspection ${inspection.id}.`,
          userId,
          activeDb
        );
      } catch {}
    }

    const updatedAppliance = applianceService.getApplianceById(appliance.id, userId, activeDb);

    return {
      success: true,
      appliance: updatedAppliance,
    };
  }
}

export const inspectionService = new InspectionService();
