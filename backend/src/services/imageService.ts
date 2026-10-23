import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  width?: number;
  height?: number;
  fileSize?: number;
  sanitizedBuffer?: Buffer;
}

export interface SaveImageOptions {
  buffer: Buffer;
  originalFilename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  targetDir?: string;
}

export interface SavedImageInfo {
  filename: string;
  originalFilename: string;
  storagePath: string;
  fileSize: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

// Configurable constants
export const MAX_IMAGE_SIZE_BYTES = parseInt(process.env.MAX_IMAGE_SIZE_BYTES || '', 10) || 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_DIMENSION = parseInt(process.env.MAX_IMAGE_DIMENSION || '', 10) || 8192; // 8192px

const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '..', '..', '..', 'database', 'uploads', 'inspections');
export const INSPECTIONS_UPLOADS_DIR = process.env.INSPECTIONS_UPLOADS_DIR || DEFAULT_UPLOADS_DIR;

// In-memory rate limiter per IP / User: max 20 uploads per 60 seconds
const uploadRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkUploadRateLimit(key: string, maxRequests = 20, windowMs = 60 * 1000): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = uploadRateLimits.get(key);

  if (!record || now > record.resetAt) {
    uploadRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true };
}

/**
 * Detect actual MIME type and validate magic byte signatures
 */
export function detectMagicBytes(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buf || buf.length < 12) return null;

  // Reject known dangerous/executable signatures
  // Windows MZ header (0x4D, 0x5A)
  if (buf[0] === 0x4D && buf[1] === 0x5A) return null;
  // Linux ELF header (0x7F, 0x45, 0x4C, 0x46)
  if (buf[0] === 0x7F && buf[1] === 0x45 && buf[2] === 0x4C && buf[3] === 0x46) return null;
  // Shell script '#!'
  if (buf[0] === 0x23 && buf[1] === 0x21) return null;
  // HTML / XML tag start
  const firstChars = buf.subarray(0, 10).toString('utf-8').toLowerCase();
  if (firstChars.includes('<html') || firstChars.includes('<script') || firstChars.includes('<?php')) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4E &&
    buf[3] === 0x47 &&
    buf[4] === 0x0D &&
    buf[5] === 0x0A &&
    buf[6] === 0x1A &&
    buf[7] === 0x0A
  ) {
    return 'image/png';
  }

  // 3. WebP: 'RIFF' ... 'WEBP'
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50  // WEBP
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Extract dimensions from PNG buffer
 */
function extractPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // In PNG, IHDR chunk is located at byte offset 12
  const chunkType = buf.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/**
 * Extract dimensions from JPEG buffer by scanning frame markers
 */
function extractJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2; // skip 0xFF 0xD8
  const len = buf.length;

  while (offset < len) {
    if (buf[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = buf[offset + 1];
    offset += 2;

    // Standalone markers without length: SOI (0xD8), EOI (0xD9), RST (0xD0-0xD7)
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue;
    }

    if (offset + 2 > len) return null;
    const segmentLength = buf.readUInt16BE(offset);

    // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) contain image height and width
    if (
      marker === 0xC0 || marker === 0xC1 || marker === 0xC2 ||
      marker === 0xC3 || marker === 0xC5 || marker === 0xC6 ||
      marker === 0xC7 || marker === 0xC9 || marker === 0xCA ||
      marker === 0xCB || marker === 0xCD || marker === 0xCE || marker === 0xCF
    ) {
      if (offset + 7 > len) return null;
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

/**
 * Extract dimensions from WebP buffer (VP8, VP8L, VP8X)
 */
function extractWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunkType = buf.subarray(12, 16).toString('ascii');

  if (chunkType === 'VP8 ') {
    // Lossy VP8
    if (buf.length < 30) return null;
    // Check start code 0x9D 0x01 0x2A
    if (buf[23] === 0x9D && buf[24] === 0x01 && buf[25] === 0x2A) {
      const width = buf.readUInt16LE(26) & 0x3FFF;
      const height = buf.readUInt16LE(28) & 0x3FFF;
      return { width, height };
    }
  } else if (chunkType === 'VP8L') {
    // Lossless VP8L
    if (buf.length < 25) return null;
    if (buf[20] === 0x2F) {
      const b1 = buf[21];
      const b2 = buf[22];
      const b3 = buf[23];
      const b4 = buf[24];
      const width = 1 + (((b2 & 0x3F) << 8) | b1);
      const height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
      return { width, height };
    }
  } else if (chunkType === 'VP8X') {
    // Extended VP8X
    if (buf.length < 30) return null;
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }

  return null;
}

/**
 * Strip EXIF (APP1 0xFFE1) segments from JPEG buffer to remove GPS coordinates & camera metadata
 */
export function stripJpegExif(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) {
    return buf;
  }

  const chunks: Buffer[] = [buf.subarray(0, 2)]; // 0xFF, 0xD8 (SOI)
  let offset = 2;
  const len = buf.length;

  while (offset < len) {
    if (buf[offset] !== 0xFF) {
      chunks.push(buf.subarray(offset));
      break;
    }

    const marker = buf[offset + 1];

    // EOI marker
    if (marker === 0xD9) {
      chunks.push(buf.subarray(offset));
      break;
    }

    // Standalone markers
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    // SOS (Start of Scan) - all following data is entropy coded scan data until EOI
    if (marker === 0xDA) {
      chunks.push(buf.subarray(offset));
      break;
    }

    if (offset + 4 > len) {
      chunks.push(buf.subarray(offset));
      break;
    }

    const segmentLen = buf.readUInt16BE(offset + 2);
    const segmentTotal = 2 + segmentLen;

    // Check if this is APP1 marker (0xFFE1, EXIF / XMP metadata)
    if (marker === 0xE1) {
      // Check if header starts with 'Exif'
      if (offset + 8 <= len) {
        const header = buf.subarray(offset + 4, offset + 8).toString('ascii');
        if (header === 'Exif') {
          // Skip this segment entirely (strips GPS and device EXIF metadata)
          offset += segmentTotal;
          continue;
        }
      }
    }

    chunks.push(buf.subarray(offset, offset + segmentTotal));
    offset += segmentTotal;
  }

  return Buffer.concat(chunks);
}

/**
 * Validates image buffer content, format, dimensions, and size
 */
export function validateImageBuffer(
  buf: Buffer,
  declaredMimeType?: string
): ImageValidationResult {
  if (!buf || buf.length === 0) {
    return { valid: false, error: 'Empty file provided. Please upload a valid image file.' };
  }

  if (buf.length > MAX_IMAGE_SIZE_BYTES) {
    const maxMb = (MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds the allowed limit of ${maxMb}MB. Please compress or resize the image before uploading.`,
    };
  }

  // 1. Magic bytes validation
  const detectedMime = detectMagicBytes(buf);
  if (!detectedMime) {
    return {
      valid: false,
      error: 'Unsupported or malformed image format. Only JPEG, PNG, and WebP images are supported.',
    };
  }

  // 2. Cross-check with declared MIME if provided
  if (declaredMimeType) {
    const normDeclared = declaredMimeType.toLowerCase().trim();
    const expectedDeclared = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
    ];
    if (!expectedDeclared.includes(normDeclared)) {
      return {
        valid: false,
        error: `Declared content-type '${declaredMimeType}' is unsupported. Only JPEG, PNG, and WebP are accepted.`,
      };
    }

    // Verify consistency
    if (detectedMime === 'image/jpeg' && normDeclared !== 'image/jpeg' && normDeclared !== 'image/jpg') {
      return { valid: false, error: 'File signature does not match declared MIME type.' };
    }
    if (detectedMime === 'image/png' && normDeclared !== 'image/png') {
      return { valid: false, error: 'File signature does not match declared MIME type.' };
    }
    if (detectedMime === 'image/webp' && normDeclared !== 'image/webp') {
      return { valid: false, error: 'File signature does not match declared MIME type.' };
    }
  }

  // 3. Extract and validate dimensions
  let dimensions: { width: number; height: number } | null = null;
  if (detectedMime === 'image/png') {
    dimensions = extractPngDimensions(buf);
  } else if (detectedMime === 'image/jpeg') {
    dimensions = extractJpegDimensions(buf);
  } else if (detectedMime === 'image/webp') {
    dimensions = extractWebpDimensions(buf);
  }

  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      valid: false,
      error: 'Corrupted or malformed image binary. Unable to read image dimensions.',
    };
  }

  if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${dimensions.width}x${dimensions.height}) exceed the maximum permitted size of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px.`,
    };
  }

  // 4. Strip EXIF metadata for JPEG
  let sanitizedBuffer = buf;
  if (detectedMime === 'image/jpeg') {
    try {
      sanitizedBuffer = stripJpegExif(buf);
    } catch {
      sanitizedBuffer = buf;
    }
  }

  return {
    valid: true,
    mimeType: detectedMime,
    width: dimensions.width,
    height: dimensions.height,
    fileSize: sanitizedBuffer.length,
    sanitizedBuffer,
  };
}

/**
 * Sanitize client filename to prevent path traversal
 */
export function sanitizeClientFilename(original: string): string {
  if (!original) return 'appliance_photo.jpg';
  // Normalize Windows backslashes and strip paths, null bytes, quotes
  const normalized = original.replace(/\\/g, '/');
  const basename = path.basename(normalized).replace(/[\x00\r\n\t]/g, '');
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.substring(0, 100) || 'appliance_photo.jpg';
}

/**
 * Save validated image buffer to private storage directory
 */
export function saveInspectionImage(options: SaveImageOptions): SavedImageInfo {
  const targetDir = options.targetDir || INSPECTIONS_UPLOADS_DIR;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  }

  const ext = options.mimeType === 'image/png' ? 'png' : options.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const serverFilename = `insp-${uuidv4()}.${ext}`;
  const storagePath = path.join(targetDir, serverFilename);

  fs.writeFileSync(storagePath, options.buffer, { mode: 0o600 });

  const originalSanitized = sanitizeClientFilename(options.originalFilename);

  let width = 0;
  let height = 0;
  if (options.mimeType === 'image/png') {
    const d = extractPngDimensions(options.buffer);
    if (d) { width = d.width; height = d.height; }
  } else if (options.mimeType === 'image/jpeg') {
    const d = extractJpegDimensions(options.buffer);
    if (d) { width = d.width; height = d.height; }
  } else if (options.mimeType === 'image/webp') {
    const d = extractWebpDimensions(options.buffer);
    if (d) { width = d.width; height = d.height; }
  }

  return {
    filename: serverFilename,
    originalFilename: originalSanitized,
    storagePath,
    fileSize: options.buffer.length,
    mimeType: options.mimeType,
    width,
    height,
  };
}

/**
 * Delete inspection file safely from storage
 */
export function deleteInspectionFile(storagePath: string): boolean {
  try {
    if (storagePath && fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
      return true;
    }
  } catch (err) {
    console.error('[ImageService] Failed to delete file:', storagePath, err);
  }
  return false;
}
