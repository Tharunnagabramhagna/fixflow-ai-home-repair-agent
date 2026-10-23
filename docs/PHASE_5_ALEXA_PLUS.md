# Phase 5: Official Alexa+ Integration Guide & Architecture

> **Amazon Developers Hackathon — Alexa+ Track**  
> **Vertical:** Home Services Category (`com.amazon.alexa.homeservices.v1`)  
> **Status:** Implementation Complete & Validated Locally; Remote Amazon Cloud Certification Blocked Pending Gated Preview Partner Access.

---

## 1. Overview & Official Integration Approach

The **Alexa+ for Builders** platform introduces agentic AI capabilities and structured Category SDKs for conversational and multimodal assistants. FixFlow operates in the **Home Services** category, supporting appliance fault triage, warranty lookup, Digital Repair Passports, and contractor dispatch.

### Two Supported Integration Routes:

1. **Category Action Add-on (SPI-based)**:
   - Connects backend endpoints to Alexa+ using the Service Provider Interface (SPI) namespace: `com.amazon.alexa.homeservices.v1`.
   - Handles structured operations: `Discover`, `GetDiagnostics`, `CheckAvailability`, `CreateBooking`, `GetBookingStatus`, and `CancelBooking`.
   - FixFlow implements this via [`alexaPlusAdapter.ts`](file:///home/reoo/fixflow-ai-home-repair-agent/backend/src/services/alexaPlusAdapter.ts) and [`routes/alexaPlus.ts`](file:///home/reoo/fixflow-ai-home-repair-agent/backend/src/routes/alexaPlus.ts).

2. **Category MCP Add-on (Model Context Protocol)**:
   - Connects FixFlow's existing Streamable HTTP Model Context Protocol (MCP) server directly to Alexa+'s agentic reasoning runtime.
   - Alexa+ acts as an MCP client over Streamable HTTP (`specVersion: 2025-11-25`), dynamically executing FixFlow's 8 registered repair tools (`search_appliances`, `get_repair_passport`, `check_warranty`, `list_repair_cases`, `create_repair_case`, `add_repair_note`, `get_visual_inspections`, `dispatch_contractor`).
   - FixFlow exposes this via [`alexa-plus-addon.json`](file:///home/reoo/fixflow-ai-home-repair-agent/alexa-plus-addon.json) with MCP Apps extensions for interactive UI cards.

---

## 2. Eligibility & Regional Prerequisites

### Developer Account Requirements
- **Alexa+ for Builders Hub Access:** Access to the Alexa+ developer preview is gated by Amazon. Partners must be accepted into the Alexa+ Developer Preview / Developer Hub program.
- **Supported Region:** Currently restricted to **`en-US`** (United States developer accounts, devices, and locales).
- **Amazon Developer Tools:**
  - `ask-cli` v3+ or `alexa-ai` CLI.
  - AWS account for production Lambda hosting or verified TLS 1.2+ HTTPS endpoint.

### Current Local Environment Status:
- **Local Adapter:** **100% Implemented & Tested** (16 automated tests passing in `alexaPlus.test.ts`).
- **Remote Cloud Certification:** **NOT DEPLOYED** (Blocked on Amazon developer preview invitation, official Skill ID assignment, and public HTTPS tunnel configuration).

---

## 3. Architecture & Service Mappings

```
┌─────────────────────────────────────────────────────────────────┐
│                    Amazon Alexa+ Cloud                          │
│        (Category SDK / Home Services Agentic Runtime)           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS (OAuth 2.1 Bearer)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              FixFlow Alexa+ Adapter Layer                       │
│    POST /api/alexa-plus/v1/action | GET /api/alexa-plus/v1/manifest │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│   Appliance & Repair Core     │ │     Contractor Dispatch       │
│  - applianceService           │ │  - dispatchService            │
│  - repairService              │ │  - confirmationManager        │
│  - Digital Repair Passport    │ │  - State machine & SSE events │
└───────────────────────────────┘ └───────────────────────────────┘
```

### Supported SPI Operations

| Operation Name | FixFlow Service Mapping | Behavior & Safeguards |
| :--- | :--- | :--- |
| `Discover` | Internal capabilities registry | Exposes `AUTO_MATCH` strategy, categories (Kitchen, Laundry, HVAC), and simulation disclosures. |
| `GetDiagnostics` | `applianceService`, `detectSafetyHazard` | Checks for gas leaks or electrical arcing (halts booking if hazardous); returns warranty countdown and passport history. |
| `CheckAvailability` | Dynamic scheduling slot generator | Returns 3-day window of available morning and afternoon slots with simulated certified partners. |
| `CreateBooking` | `confirmationManager`, `repairService`, `dispatchService` | **Two-step confirmation required**. Step 1 returns `cfrm_*` token. Step 2 validates token and arguments, creates case, and queues dispatch. |
| `GetBookingStatus` | `repairService`, `dispatchService` | Enforces ownership; returns live case and dispatch status (`pending` → `dispatched` → `en_route` → `arrived` → `completed`). |
| `CancelBooking` | `dispatchService.advanceDispatchStatus` | Cancels contractor dispatch and marks repair case as closed. |

---

## 4. Authentication, Privacy & Account Linking

### OAuth 2.1 Account Linking Flow
1. Alexa+ initiates standard Authorization Code Grant with PKCE to FixFlow's OAuth endpoint:
   - Authorization URL: `https://<DOMAIN>/api/auth/oauth/authorize`
   - Token URL: `https://<DOMAIN>/api/auth/oauth/token`
   - Scopes: `appliances:read`, `repairs:read`, `repairs:write`
2. All incoming requests to `/api/alexa-plus/v1/action` must include `Authorization: Bearer <token>`.
3. FixFlow's `resolveUser` hashes the token (`SHA-256`) and looks up the active session in `user_sessions`.
4. If unauthenticated or token is expired, mutating operations are rejected with `AUTHENTICATION_REQUIRED`.
5. Voice session IDs are **never** treated as proof of identity. Cross-user access is strictly blocked (`BOOKING_NOT_FOUND` / `APPLIANCE_NOT_FOUND`).

---

## 5. Simulated Contractor Dispatch Disclosure

To strictly prevent misleading homeowners or hackathon judges:

- All dispatch payloads explicitly include `"isSimulated": true`.
- Manifest disclosures state:
  > *"FixFlow contractor dispatch and scheduling are simulated demonstrations for the Amazon Developers Hackathon Alexa+ Track. No live financial charges or commercial dispatches are placed."*
- Service names use demo identifiers (e.g. `Metro Pro HVAC & Repair`, `HomeServe Certified Technicians`).

---

## 6. Local Testing & Verification

### Running Automated Alexa+ Tests:
```bash
# Run the 16 automated integration tests:
./mcp-server/node_modules/.bin/vitest run --root backend src/__tests__/alexaPlus.test.ts
```

### Manual Curl Testing Against Local Daemon:

#### 1. Discovery
```bash
curl -s -X POST http://localhost:3001/api/alexa-plus/v1/action \
  -H "Content-Type: application/json" \
  -d '{
    "header": {
      "namespace": "com.amazon.alexa.homeservices.v1",
      "name": "Discover",
      "messageId": "msg-001",
      "payloadVersion": "1.0"
    },
    "payload": {}
  }'
```

#### 2. Get Diagnostics (With Critical Safety Interceptor)
```bash
curl -s -X POST http://localhost:3001/api/alexa-plus/v1/action \
  -H "Content-Type: application/json" \
  -d '{
    "header": {
      "namespace": "com.amazon.alexa.homeservices.v1",
      "name": "GetDiagnostics",
      "messageId": "msg-002",
      "payloadVersion": "1.0"
    },
    "payload": {
      "applianceId": "demo-app-001",
      "symptomDescription": "I smell natural gas leaking near my water heater"
    }
  }'
```
*Returns `SafetyHaltResponse` with `canProceedWithBooking: false` and evacuation instructions.*

#### 3. Two-Step Booking Flow (Step 1: Proposal)
```bash
curl -s -X POST http://localhost:3001/api/alexa-plus/v1/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HOMEOWNER_TOKEN>" \
  -d '{
    "header": {
      "namespace": "com.amazon.alexa.homeservices.v1",
      "name": "CreateBooking",
      "messageId": "msg-003",
      "payloadVersion": "1.0"
    },
    "payload": {
      "applianceId": "<APPLIANCE_ID>",
      "issueDescription": "Washer drum belt squealing"
    }
  }'
```
*Returns `status: "CONFIRMATION_REQUIRED"` with `cfrm_*` token.*

---

## 7. Verified vs. Unverified Status

| Area | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **SPI Interface & Schemas** | **VERIFIED** | 16 / 16 tests passing in `backend/src/__tests__/alexaPlus.test.ts`. |
| **Two-Step Confirmation** | **VERIFIED** | Rejects tampered payloads; enforces token verification before persistence. |
| **Safety Interceptor** | **VERIFIED** | Halts booking immediately when gas or electrical hazards are described. |
| **Cross-User Data Isolation** | **VERIFIED** | User B receives `BOOKING_NOT_FOUND` when querying User A's booking. |
| **Category Add-on Manifest** | **VERIFIED** | Exposes valid `alexa-plus-addon.json` at `/api/alexa-plus/v1/manifest`. |
| **Preservation of ASK & MCP** | **VERIFIED** | ASK webhook (`/api/alexa`) and MCP server (`/mcp`) pass all regression tests. |
| **Remote Amazon Cloud Certification** | **NOT VERIFIED** | Requires public HTTPS URL (AWS/Cloudflare) and Amazon Developer Console skill registration. |

---

## 8. Remaining Blockers for Production Deployment

1. **Amazon Developer Preview Partner Invitation:** Access to the official Alexa+ for Builders Hub and CLI tooling is gated by Amazon.
2. **Public HTTPS Endpoint:** The local server (`localhost:3001`) must be exposed via Cloudflare Tunnel or AWS API Gateway to accept webhooks from Amazon's cloud.
3. **Skill Registration:** An official `amzn1.ask.skill.*` Skill ID must be created in the developer console.
