import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../app';
import { initializeDatabase } from '../db/database';
import { authService } from '../services/authService';
import * as applianceService from '../services/applianceService';
import * as repairService from '../services/repairService';
import { confirmationManager } from '../services/confirmationManager';
import {
  validateImageBuffer,
  detectMagicBytes,
  stripJpegExif,
  sanitizeClientFilename,
  INSPECTIONS_UPLOADS_DIR,
} from '../services/imageService';
import { multimodalService } from '../services/multimodalService';
import { inspectionService } from '../services/inspectionService';

// Helpers to construct minimal valid binary test images
function createMinimalJpeg(width = 100, height = 100): Buffer {
  // SOI (2 bytes) + APP0 (16 bytes) + SOF0 (17 bytes) + EOI (2 bytes)
  const buf = Buffer.alloc(40);
  let pos = 0;
  // SOI
  buf[pos++] = 0xFF; buf[pos++] = 0xD8;
  // APP0
  buf[pos++] = 0xFF; buf[pos++] = 0xE0;
  buf.writeUInt16BE(16, pos); pos += 2;
  buf.write('JFIF\0', pos, 'ascii'); pos += 5;
  buf[pos++] = 1; buf[pos++] = 1; buf[pos++] = 0;
  buf.writeUInt16BE(1, pos); pos += 2;
  buf.writeUInt16BE(1, pos); pos += 2;
  buf[pos++] = 0; buf[pos++] = 0;
  // SOF0 (0xFF 0xC0)
  buf[pos++] = 0xFF; buf[pos++] = 0xC0;
  buf.writeUInt16BE(15, pos); pos += 2; // length = 15
  buf[pos++] = 8; // precision 8 bits
  buf.writeUInt16BE(height, pos); pos += 2;
  buf.writeUInt16BE(width, pos); pos += 2;
  buf[pos++] = 3; // 3 color components
  buf[pos++] = 1; buf[pos++] = 0x11; buf[pos++] = 0;
  // EOI
  buf[pos++] = 0xFF; buf[pos++] = 0xD9;
  return buf.subarray(0, pos);
}

function createMinimalPng(width = 80, height = 60): Buffer {
  const buf = Buffer.alloc(33);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(buf, 0);
  // IHDR chunk length 13
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 2; // color type RGB
  buf[26] = 0; // compression
  buf[27] = 0; // filter
  buf[28] = 0; // interlace
  buf.writeUInt32BE(0, 29); // CRC dummy
  return buf;
}

function createMinimalWebp(width = 64, height = 64): Buffer {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4); // file size - 8
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  buf.writeUInt32LE(12, 16); // chunk size
  // VP8 keyframe start code
  buf[20] = 0; buf[21] = 0; buf[22] = 0;
  buf[23] = 0x9D; buf[24] = 0x01; buf[25] = 0x2A;
  buf.writeUInt16LE(width & 0x3FFF, 26);
  buf.writeUInt16LE(height & 0x3FFF, 28);
  return buf;
}

describe('FixFlow Phase 5 — Multimodal AI Diagnostics & Visual Inspection Tests', () => {
  let userA: { token: string; id: string };
  let userB: { token: string; id: string };
  let applianceAId: string;
  let caseAId: string;

  beforeEach(async () => {
    initializeDatabase();
    confirmationManager.clear();

    const regA = await authService.register({
      name: 'Alice Homeowner',
      email: `alice_${Date.now()}_${Math.random()}@example.com`,
      password: 'Password123!',
    });
    userA = { token: regA.token, id: regA.user.id };

    const regB = await authService.register({
      name: 'Bob Neighbor',
      email: `bob_${Date.now()}_${Math.random()}@example.com`,
      password: 'Password123!',
    });
    userB = { token: regB.token, id: regB.user.id };

    const appliance = applianceService.createAppliance(
      {
        name: 'Kitchen Dishwasher',
        category: 'Kitchen',
        brand: 'Bosch',
        model: 'SHPM88Z75N',
        location: 'Kitchen Island',
      },
      userA.id
    );
    applianceAId = appliance.id;

    const repairCase = repairService.createRepairCase(
      {
        appliance_id: applianceAId,
        issue_description: 'Dishwasher stops mid cycle with water in bottom tub.',
        priority: 'high',
      },
      userA.id
    );
    caseAId = repairCase.id;
  });

  describe('1. Image Validation & Binary Security', () => {
    it('accurately identifies JPEG, PNG, and WebP magic byte signatures', () => {
      const jpeg = createMinimalJpeg();
      const png = createMinimalPng();
      const webp = createMinimalWebp();

      expect(detectMagicBytes(jpeg)).toBe('image/jpeg');
      expect(detectMagicBytes(png)).toBe('image/png');
      expect(detectMagicBytes(webp)).toBe('image/webp');
    });

    it('rejects executable headers and text files disguised as images', () => {
      // Windows PE/MZ header
      const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
      expect(detectMagicBytes(exeHeader)).toBeNull();

      // Linux ELF
      const elfHeader = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMagicBytes(elfHeader)).toBeNull();

      // Shell script
      const script = Buffer.from('#!/bin/bash\necho "exploit"', 'utf-8');
      expect(detectMagicBytes(script)).toBeNull();

      // HTML disguised
      const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');
      expect(detectMagicBytes(html)).toBeNull();
    });

    it('validates image dimensions and rejects oversized or corrupt headers', () => {
      const validPng = createMinimalPng(640, 480);
      const res = validateImageBuffer(validPng, 'image/png');
      expect(res.valid).toBe(true);
      expect(res.width).toBe(640);
      expect(res.height).toBe(480);

      // Corrupt PNG (valid 8 bytes signature + incomplete chunk header)
      const corrupt = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
      const resCorrupt = validateImageBuffer(corrupt);
      expect(resCorrupt.valid).toBe(false);
      expect(resCorrupt.error).toContain('Corrupted or malformed');
    });

    it('strips JPEG EXIF metadata to prevent GPS and private device leaking', () => {
      // Create JPEG with APP1 EXIF segment containing fake GPS coordinates
      const baseJpeg = createMinimalJpeg(100, 100);
      const exifPayload = Buffer.from('Exif\0\0GPS_LAT_37_LONG_122', 'ascii');
      const exifLen = exifPayload.length + 2; // length field in JPEG includes its own 2 bytes
      const exifHeader = Buffer.alloc(4);
      exifHeader[0] = 0xFF; exifHeader[1] = 0xE1;
      exifHeader.writeUInt16BE(exifLen, 2);
      const exifSegment = Buffer.concat([exifHeader, exifPayload]);

      const jpegWithExif = Buffer.concat([
        baseJpeg.subarray(0, 2), // SOI
        exifSegment,
        baseJpeg.subarray(2),
      ]);

      expect(jpegWithExif.includes(Buffer.from('GPS_LAT_37_LONG_122'))).toBe(true);
      const sanitized = stripJpegExif(jpegWithExif);
      expect(sanitized.includes(Buffer.from('GPS_LAT_37_LONG_122'))).toBe(false);
      expect(detectMagicBytes(sanitized)).toBe('image/jpeg');
    });

    it('sanitizes client filenames and strips dangerous path traversal sequences', () => {
      expect(sanitizeClientFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeClientFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeClientFilename('cool photo! (1).jpeg')).toBe('cool_photo___1_.jpeg');
      expect(sanitizeClientFilename('')).toBe('appliance_photo.jpg');
    });
  });

  describe('2. Multimodal AI Analysis & Structured Diagnostics', () => {
    it('produces structured diagnostic results separating observations from inferences', async () => {
      const jpeg = createMinimalJpeg(300, 300);
      const result = await multimodalService.analyze({
        imageBuffer: jpeg,
        mimeType: 'image/jpeg',
        userDescription: 'Dishwasher display is flashing error code E15 with water leaking at the base.',
        applianceContext: { name: 'Bosch Dishwasher', brand: 'Bosch', category: 'Dishwasher' },
      });

      expect(result.applianceType).toBe('Dishwasher');
      expect(result.brand).toBe('Bosch');
      expect(result.visibleErrorCodes).toContain('E15');
      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.possibleCauses.length).toBeGreaterThan(0);
      expect(result.recommendedNextSteps.length).toBeGreaterThan(0);
      expect(result.evidenceNotes.visualFindings.length).toBeGreaterThan(0);
      expect(result.evidenceNotes.inferredHypotheses.length).toBeGreaterThan(0);
      expect(result.disclaimer).toBeDefined();
    });

    it('marks model number as unverified when label is reported blurry or unreadable', async () => {
      const jpeg = createMinimalJpeg(200, 200);
      const result = await multimodalService.analyze({
        imageBuffer: jpeg,
        mimeType: 'image/jpeg',
        userDescription: 'Here is the rating label but it is blurry and unreadable.',
      });

      expect(result.modelNumber).toBeNull();
      expect(result.modelConfidence).toBe('unverified');
      expect(result.evidenceNotes.unreadableDetails.some((d) => d.toLowerCase().includes('illegible') || d.toLowerCase().includes('obscured'))).toBe(true);
    });

    it('prioritizes safety hazards and flags professional inspection for electrical sparks and gas', async () => {
      const jpeg = createMinimalJpeg(200, 200);
      const result = await multimodalService.analyze({
        imageBuffer: jpeg,
        mimeType: 'image/jpeg',
        userDescription: 'There are sparks flying and a strong burning smell behind the dryer.',
      });

      expect(result.requiresProfessionalInspection).toBe(true);
      expect(result.safetyWarnings.length).toBeGreaterThan(0);
      expect(result.safetyWarnings.some((w) => w.includes('CRITICAL SAFETY') || w.includes('Fire risk'))).toBe(true);
    });
  });

  describe('3. API Endpoints & Image Upload Workflow', () => {
    it('POST /api/inspections/analyze successfully uploads and analyzes a valid image', async () => {
      const jpeg = createMinimalJpeg(250, 250);
      const base64 = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

      const res = await supertest(app)
        .post('/api/inspections/analyze')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          imageBase64: base64,
          filename: 'dishwasher_error.jpg',
          mimeType: 'image/jpeg',
          description: 'Flashing E15 code and pooling water underneath.',
          applianceId: applianceAId,
          caseId: caseAId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toMatch(/^insp-/);
      expect(res.body.data.appliance_id).toBe(applianceAId);
      expect(res.body.data.case_id).toBe(caseAId);
      expect(res.body.data.analysis.visibleErrorCodes).toContain('E15');
      expect(res.body.data.status).toBe('completed');

      // Verify file exists in private storage
      const storagePath = res.body.data.storage_path;
      expect(fs.existsSync(storagePath)).toBe(true);
    });

    it('rejects upload with mismatched MIME signature or corrupted binary', async () => {
      const fakeJpegBase64 = Buffer.from('NOT A REAL JPEG FILE CONTENT').toString('base64');

      const res = await supertest(app)
        .post('/api/inspections/analyze')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          imageBase64: fakeJpegBase64,
          filename: 'fake.jpg',
          mimeType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported or malformed image format');
    });

    it('GET /api/inspections lists inspections for authorized user and filters by appliance', async () => {
      const jpeg = createMinimalJpeg();
      await inspectionService.createInspection({
        userId: userA.id,
        imageBuffer: jpeg,
        originalFilename: 'test.jpg',
        applianceId: applianceAId,
        userDescription: 'Inspection 1',
      });

      const res = await supertest(app)
        .get(`/api/inspections?appliance_id=${applianceAId}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].appliance_id).toBe(applianceAId);
    });

    it('GET /api/inspections/:id/image streams image with correct content-type header', async () => {
      const png = createMinimalPng(120, 120);
      const inspection = await inspectionService.createInspection({
        userId: userA.id,
        imageBuffer: png,
        originalFilename: 'test_panel.png',
        declaredMimeType: 'image/png',
      });

      const res = await supertest(app)
        .get(`/api/inspections/${inspection.id}/image`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toContain('private');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('enforces cross-user isolation: User B cannot access User A inspection or image', async () => {
      const jpeg = createMinimalJpeg();
      const inspection = await inspectionService.createInspection({
        userId: userA.id,
        imageBuffer: jpeg,
        originalFilename: 'private_leak.jpg',
      });

      // User B tries to get inspection detail
      const resDetail = await supertest(app)
        .get(`/api/inspections/${inspection.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(resDetail.status).toBe(404);

      // User B tries to download image stream
      const resImage = await supertest(app)
        .get(`/api/inspections/${inspection.id}/image`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(resImage.status).toBe(404);

      // User B tries to delete User A's inspection
      const resDelete = await supertest(app)
        .delete(`/api/inspections/${inspection.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(resDelete.status).toBe(404);
    });

    it('DELETE /api/inspections/:id removes DB record and deletes physical file from storage', async () => {
      const jpeg = createMinimalJpeg();
      const inspection = await inspectionService.createInspection({
        userId: userA.id,
        imageBuffer: jpeg,
        originalFilename: 'to_be_deleted.jpg',
      });

      expect(fs.existsSync(inspection.storage_path)).toBe(true);

      const res = await supertest(app)
        .delete(`/api/inspections/${inspection.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Confirm file is unlinked
      expect(fs.existsSync(inspection.storage_path)).toBe(false);

      // Confirm DB record is gone
      const check = inspectionService.getInspectionById(inspection.id, userA.id);
      expect(check).toBeNull();
    });
  });

  describe('4. Record Integration & Two-Step Confirmation', () => {
    it('POST /api/inspections/:id/apply requires confirmation proposal before updating appliance passport', async () => {
      const jpeg = createMinimalJpeg();
      const inspection = await inspectionService.createInspection({
        userId: userA.id,
        imageBuffer: jpeg,
        originalFilename: 'bosch_label.jpg',
        userDescription: 'Rating plate label says Bosch Model SHPM88Z75N',
        applianceId: applianceAId,
      });

      // Step 1: Call without confirmation token -> returns proposal
      const step1Res = await supertest(app)
        .post(`/api/inspections/${inspection.id}/apply`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          brand: 'Bosch Benchmark',
          modelNumber: 'SHPM88Z75N-UPGRADED',
        });

      expect(step1Res.status).toBe(200);
      expect(step1Res.body.confirmationRequired).toBe(true);
      expect(step1Res.body.token).toMatch(/^cfrm_/);
      expect(step1Res.body.proposal.newModel).toBe('SHPM88Z75N-UPGRADED');

      const token = step1Res.body.token;

      // Step 2: Call with valid confirmation token -> executes update
      const step2Res = await supertest(app)
        .post(`/api/inspections/${inspection.id}/apply`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          confirmationToken: token,
          brand: 'Bosch Benchmark',
          modelNumber: 'SHPM88Z75N-UPGRADED',
        });

      expect(step2Res.status).toBe(200);
      expect(step2Res.body.success).toBe(true);
      expect(step2Res.body.data.model).toBe('SHPM88Z75N-UPGRADED');
      expect(step2Res.body.data.brand).toBe('Bosch Benchmark');

      // Verify DB update
      const updatedApp = applianceService.getApplianceById(applianceAId, userA.id);
      expect(updatedApp?.model).toBe('SHPM88Z75N-UPGRADED');

      // Attempting to reuse the single-use token fails
      const reuseRes = await supertest(app)
        .post(`/api/inspections/${inspection.id}/apply`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          confirmationToken: token,
          brand: 'Bosch Benchmark',
          modelNumber: 'SHPM88Z75N-UPGRADED',
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toContain('not found, already consumed, or expired');
    });
  });
});
