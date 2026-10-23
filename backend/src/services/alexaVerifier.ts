import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';

// In-memory certificate cache (URL -> { certPem, validTo })
const certCache = new Map<string, { certPem: string; expiresAt: number }>();

export interface AlexaVerifiedRequest extends Request {
  rawBody?: Buffer;
}

const TIMESTAMP_TOLERANCE_MS = 150 * 1000; // 150 seconds tolerance per Alexa spec

/**
 * Validates the Amazon Echo Certificate URL per Alexa Skills Kit security spec.
 */
export function validateSignatureCertChainUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'echo-api.amazon.com') return false;
    if (parsed.port && parsed.port !== '443') return false;
    if (!parsed.pathname.startsWith('/echo.api/')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates request timestamp freshness (must be within 150 seconds).
 */
export function validateTimestampFreshness(timestampStr: string, toleranceMs = TIMESTAMP_TOLERANCE_MS): boolean {
  if (!timestampStr) return false;
  const requestTime = new Date(timestampStr).getTime();
  if (isNaN(requestTime)) return false;

  const now = Date.now();
  const diff = Math.abs(now - requestTime);
  return diff <= toleranceMs;
}

/**
 * Fetches and caches X.509 certificate PEM from validated Amazon URL.
 */
function fetchCertificate(certUrl: string): Promise<string> {
  const cached = certCache.get(certUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.certPem);
  }

  return new Promise((resolve, reject) => {
    https.get(certUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch certificate: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Cache cert for 1 hour
        certCache.set(certUrl, {
          certPem: data,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Verifies cryptographic RSA signature against raw request body
 */
export function verifySignature(certPem: string, signatureB64: string, rawBody: Buffer): boolean {
  try {
    const signature = Buffer.from(signatureB64, 'base64');
    
    // Try SHA-256 first, fallback to SHA-1 (both allowed in ASK specs)
    try {
      const verifier256 = crypto.createVerify('RSA-SHA256');
      verifier256.update(rawBody);
      if (verifier256.verify(certPem, signature)) return true;
    } catch {}

    const verifier1 = crypto.createVerify('RSA-SHA1');
    verifier1.update(rawBody);
    return verifier1.verify(certPem, signature);
  } catch (err) {
    console.error('[AlexaVerifier] Signature verification error:', err);
    return false;
  }
}

/**
 * Express middleware for Alexa request verification.
 */
export async function alexaVerificationMiddleware(
  req: AlexaVerifiedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow bypassing signature verification in tests or local dev when explicitly configured
  const shouldVerifySignature =
    process.env.ALEXA_VERIFY_SIGNATURE === 'true' ||
    (process.env.ALEXA_VERIFY_SIGNATURE !== 'false' && process.env.NODE_ENV === 'production');

  const certUrl = req.headers['signaturecertchainurl'] as string | undefined;
  const signature = req.headers['signature'] as string | undefined;

  // If in test/dev and no signature header is provided, check timestamp if present and allow through
  if (!shouldVerifySignature && !certUrl && !signature) {
    if (req.body?.request?.timestamp) {
      if (!validateTimestampFreshness(req.body.request.timestamp)) {
        res.status(400).json({ error: 'Request timestamp is stale or invalid.' });
        return;
      }
    }
    return next();
  }

  // Enforce required signature headers
  if (!certUrl || !signature) {
    res.status(400).json({
      error: 'Missing required Alexa verification headers (SignatureCertChainUrl or Signature).',
    });
    return;
  }

  // 1. Verify URL structure
  if (!validateSignatureCertChainUrl(certUrl)) {
    res.status(400).json({
      error: 'Invalid SignatureCertChainUrl. Must be https://echo-api.amazon.com/echo.api/...',
    });
    return;
  }

  // 2. Verify timestamp freshness
  const timestamp = req.body?.request?.timestamp;
  if (!timestamp || !validateTimestampFreshness(timestamp)) {
    res.status(400).json({
      error: 'Request timestamp is stale or exceeds the 150-second tolerance window.',
    });
    return;
  }

  // 3. Verify cryptographic signature
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  try {
    const certPem = await fetchCertificate(certUrl);
    const valid = verifySignature(certPem, signature, rawBody);
    if (!valid) {
      res.status(400).json({ error: 'Alexa request signature verification failed.' });
      return;
    }
    next();
  } catch (err: any) {
    res.status(400).json({
      error: `Certificate validation error: ${err.message || 'Verification failed'}`,
    });
  }
}
