# FixFlow Phase 5 — Multimodal AI Repair Diagnostics & Visual Appliance Inspection

## Overview

FixFlow Phase 5 extends the application from a text-based conversational assistant into a **multimodal visual repair diagnostic system**. Homeowners can upload photographs of household appliances, rating plate stickers, control panel error displays, or visible physical damage. The backend validates binary image integrity, strips private EXIF GPS metadata, executes structured multimodal diagnostic reasoning, and presents verified observations alongside non-invasive troubleshooting steps.

---

## 1. System Architecture & Request Flow

```
                                  +-----------------------------+
                                  |   FixFlow Web Dashboard     |
                                  | (VisualInspectionModal UI)  |
                                  +--------------+--------------+
                                                 |
                   POST /api/inspections/analyze | (base64 JSON or image payload)
                                                 v
                                  +-----------------------------+
                                  |    Express Inspections API  |
                                  |  (routes/inspections.ts)    |
                                  +--------------+--------------+
                                                 |
                               +-----------------+-----------------+
                               |                                   |
                               v                                   v
               +-------------------------------+   +-------------------------------+
               |     Image Validation Layer    |   |     Rate Limiter & Auth       |
               |     (services/imageService)   |   |   (20 req/min, optionalAuth)  |
               +---------------+---------------+   +-------------------------------+
                               |
                               | (Magic bytes, dimensions, EXIF strip)
                               v
               +-------------------------------+
               |   Private File Storage        |
               | (database/uploads/inspections)|
               +---------------+---------------+
                               |
                               v
               +-------------------------------+
               |    Multimodal AI Service      |
               | (services/multimodalService)  |
               +---------------+---------------+
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
+-----------------+   +-----------------+   +-----------------+
|  Google Gemini  |   |  OpenAI GPT-4o  |   | Deterministic   |
| 2.0/1.5 Flash   |   |     Vision      |   | Test Simulator  |
+-----------------+   +-----------------+   +-----------------+
         |                     |                     |
         +---------------------+---------------------+
                               |
                               v
               +-------------------------------+
               |  Structured Diagnostic JSON   |
               |  Observations vs Inferences   |
               +---------------+---------------+
                               |
                               v
               +-------------------------------+
               |  SQLite: visual_inspections   |
               |   Audit Note in repair_cases  |
               +-------------------------------+
```

---

## 2. Image Validation & Privacy Security

All incoming image uploads are validated directly against their binary contents rather than trusting user-supplied filenames or declared MIME types:

1. **Magic Byte Signature Inspection**:
   - **JPEG**: Evaluates `0xFF 0xD8 0xFF` start of image.
   - **PNG**: Evaluates 8-byte chunk `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`.
   - **WebP**: Evaluates `RIFF....WEBP` header signature.
   - **Malicious Header Rejection**: Rejects Windows executable (`MZ`), Linux ELF (`\x7fELF`), shell scripts (`#!`), and disguised HTML scripts (`<html`, `<script`).
2. **Dimension Constraints**:
   - Parses `IHDR` chunks (PNG), `SOF0/SOF2` markers (JPEG), or `VP8/VP8L/VP8X` chunks (WebP).
   - Rejects corrupted or truncated binary streams (`width <= 0 || height <= 0`).
   - Enforces configurable maximum dimensions (default: **8192 x 8192 px**).
3. **File Size & Rate Limits**:
   - Maximum file size: **10 MB** (configured via `MAX_IMAGE_SIZE_BYTES`).
   - Rate limiting: Maximum **20 uploads per minute** per user / IP address to prevent denial of service.
4. **EXIF Metadata Stripping**:
   - Automatically parses JPEG APP1 segments (`0xFFE1`) and strips embedded Exif markers.
   - Eliminates GPS coordinates, camera serial numbers, and device timestamps before writing to storage.
5. **Private Storage & Path Traversal Prevention**:
   - Files are stored in `database/uploads/inspections/` outside publicly accessible web roots.
   - Server-side filenames are cryptographically generated UUIDs (`insp-${uuidv4()}.[ext]`).
   - Client filenames are sanitized against path traversal (`../`, null bytes, control characters).
   - Images are served solely through the authenticated endpoint `GET /api/inspections/:id/image` with strict ownership checks.

---

## 3. Multimodal AI Analysis & Structured Schema

Multimodal analysis returns a validated JSON object adhering to `MultimodalAnalysisResult`:

```typescript
export interface MultimodalAnalysisResult {
  applianceType: string | null;
  brand: string | null;
  modelNumber: string | null;
  modelConfidence: 'high' | 'medium' | 'low' | 'unverified';
  visibleErrorCodes: string[];
  observations: string[];
  possibleCauses: string[];
  recommendedNextSteps: string[];
  safetyWarnings: string[];
  confidence: 'high' | 'medium' | 'low';
  requiresProfessionalInspection: boolean;
  evidenceNotes: {
    visualFindings: string[];
    inferredHypotheses: string[];
    unreadableDetails: string[];
  };
  disclaimer: string;
}
```

### Core Diagnostic Principles
1. **Separation of Observations from Inferences**:
   - `visualFindings`: Physical, directly visible attributes (e.g. *"Control console displays error code E15"*, *"Water droplets pooled around base inlet valve"*).
   - `inferredHypotheses`: Plausible mechanical conclusions (e.g. *"Internal float switch triggered due to water in overflow tray"*).
2. **Handling Blur & Uncertainty**:
   - When a rating label is blurry or obscured, `modelNumber` is set to `null` and `modelConfidence` is marked `'unverified'`. The model explicitly notes illegibility in `unreadableDetails`.
   - Never hallucinates serial numbers, model tags, or error codes.
3. **No False Mechanical Certainty**:
   - A photograph cannot prove that an internal solenoid or compressor coil has failed. Calibrated probabilistic language is strictly enforced.

---

## 4. Safety Interceptor & Hazard Prioritization

Visual inspection incorporates FixFlow's safety interceptor. When hazards are detected (e.g., active sparking, scorch marks near wiring, gas odors, or water pooling near electrical plugs):
- `requiresProfessionalInspection` is set to `true`.
- Prominent `safetyWarnings` are injected at the top of the report.
- The UI renders a flashing red emergency alert banner instructing the homeowner to de-energize the breaker or shut off gas supply immediately and avoid DIY disassembly.

---

## 5. Record Integration & Two-Step Confirmation

Extracted data can be linked to appliance passports and repair cases:
1. **Associated Inspections**:
   - Linked to `appliance_id` and optional `case_id`.
   - Cross-user authorization strictly verified; users cannot access or delete other users' inspections.
2. **Two-Step Passport Update**:
   - Updating an appliance record (brand, model) with extracted inspection data requires two-step confirmation.
   - Step 1: `POST /api/inspections/:id/apply` without token returns a proposal and single-use `cfrm_*` token (5-minute TTL).
   - Step 2: Providing the confirmation token with matching arguments executes the database update and marks `applied_to_record = 1`.
3. **AI Assistant Integration**:
   - Homeowners can click **"Discuss with AI Assistant"** to pre-populate conversational troubleshooting with verified inspection findings.
   - Tool `get_visual_inspections` allows the assistant to query past visual analyses during chat.

---

## 6. API Reference

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/inspections/analyze` | `POST` | Optional/User | Uploads and analyzes an appliance photo (base64 payload). |
| `/api/inspections` | `GET` | Optional/User | Lists inspections for current user (supports `?appliance_id=&case_id=`). |
| `/api/inspections/:id` | `GET` | Optional/User | Retrieves structured inspection details with ownership check. |
| `/api/inspections/:id/image` | `GET` | Optional/User | Streams sanitized image file with security headers (`nosniff`, `private`). |
| `/api/inspections/:id` | `DELETE` | User | Deletes inspection record and removes physical image file from storage. |
| `/api/inspections/:id/apply` | `POST` | User | Two-step confirmation endpoint to update appliance passport with findings. |

---

## 7. Environment Configuration

```bash
# Maximum permitted image size in bytes (default: 10485760 = 10MB)
MAX_IMAGE_SIZE_BYTES=10485760

# Maximum permitted image width/height (default: 8192px)
MAX_IMAGE_DIMENSION=8192

# Storage location for visual inspection photos
INSPECTIONS_UPLOADS_DIR=database/uploads/inspections

# AI Provider selection: 'simulator' (default/test), 'gemini', 'openai'
LLM_PROVIDER=simulator

# External API Keys (optional for live production multimodal calls)
GEMINI_API_KEY=
OPENAI_API_KEY=
```

---

## 8. Local Testing Instructions

### Run Backend Tests (including Multimodal Suite)
```bash
./mcp-server/node_modules/.bin/vitest run --root backend --no-file-parallelism
```

### Run Monorepo Build Check
```bash
npm run build
```

### Manual Testing in Frontend
1. Open dashboard at `http://localhost:5173`.
2. In the navigation sidebar, click **Visual Diagnostics** or click **Visual AI Scan** on the Assistant tab.
3. Use the quick test presets (e.g. *Dishwasher E15 Code*, *Fridge Water Leak*, or *Electrical Sparks Hazard*) or drag and drop an appliance image.
4. Click **Run Visual AI Diagnostics**.
5. Inspect the generated visual observations, inferred causes, and rating plate information.
6. Click **Apply to Passport** to test the two-step confirmation workflow.
7. Click **Discuss with AI Assistant** to transition into conversational troubleshooting.
