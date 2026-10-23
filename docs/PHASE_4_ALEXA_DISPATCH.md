# FixFlow Phase 4 — Alexa Voice Integration & Live Contractor Dispatch Simulation

## 1. Overview and Architecture

Phase 4 extends the FixFlow AI Home Repair Agent platform by introducing:
1. **Alexa Voice Integration Layer**: A modular webhook interface compliant with the official Amazon Alexa Skills Kit (ASK) specification, enabling homeowners to diagnose home appliance faults, check warranty coverage, inspect existing repair cases, trigger contractor dispatch, and verbally confirm repair proposals.
2. **Contractor Dispatch Simulation Service**: A stateful dispatch engine modeling the end-to-end contractor lifecycle (`pending` → `dispatched` → `en_route` → `arrived` → `completed` or `cancelled`), associated with vehicles, contact information, real-time arrival estimates (ETA), and audit event histories.
3. **Live Status Updates**: Real-time push updates delivering transition events to the homeowner web dashboard via Server-Sent Events (SSE) with automatic reconnection and polling fallback.
4. **Alexa Voice Simulator Testbed**: A dedicated in-browser developer tool to test speech outputs, reprompts, session attributes, two-step confirmation proposals, and simulated audio playback.

```
+-------------------------------------------------------------------------+
|                           Homeowner Interfaces                          |
|   +-----------------------+     +-----------------------------------+   |
|   |   Amazon Alexa Device |     |   FixFlow Web Dashboard / Mobile   |   |
|   |  (Voice Utterances)   |     | (Dispatch Tracker + Voice Sim)    |   |
|   +-----------+-----------+     +-----------------+-----------------+   |
+---------------|-----------------------------------|---------------------+
                | HTTPS POST (ASK Envelope)         | SSE Stream / REST
                v                                   v
+-------------------------------------------------------------------------+
|                             FixFlow Backend                             |
|                                                                         |
|   +--------------------------+          +---------------------------+   |
|   |   Alexa Verifier         |          |   Dispatch SSE Hub        |   |
|   |  (Timestamp, Cert Chain) |          |  (Live Event Streaming)   |   |
|   +-------------+------------+          +-------------+-------------+   |
|                 |                                     |                 |
|                 v                                     v                 |
|   +--------------------------+          +---------------------------+   |
|   |   Alexa Service          |          |   Dispatch Service        |   |
|   |  (Intent Routing, SSML)  |          | (Transitions, Contractors)|   |
|   +-------------+------------+          +-------------+-------------+   |
|                 |                                     |                 |
|                 +------------------+------------------+                 |
|                                    v                                    |
|   +-----------------------------------------------------------------+   |
|   |  Core Application Services                                      |   |
|   |  - confirmationManager (2-step voice & web mutation security)   |   |
|   |  - repairService (cases, audit logs, appointments)              |   |
|   |  - applianceService (passports, specs, warranties)              |   |
|   |  - llmService (safety hazard interceptor & diagnostics)         |   |
|   +--------------------------------+--------------------------------+   |
|                                    v                                    |
|   +-----------------------------------------------------------------+   |
|   |  SQLite Database (WAL Mode, Foreign Keys Enforced)              |   |
|   |  - contractor_dispatches | dispatch_events                      |   |
|   |  - repair_cases          | repair_events                        |   |
|   |  - appliances            | warranty_documents | user_sessions   |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

---

## 2. Alexa Voice Integration

### 2.1 Supported Request Types
- `LaunchRequest`: Initial invocation ("Alexa, open FixFlow"). Provides a warm, spoken welcome explaining diagnosis, warranty verification, case inspection, and dispatch tracking capabilities.
- `IntentRequest`: Direct invocation of specific application intents.
- `SessionEndedRequest`: Graceful session teardown upon user exit or timeout.

### 2.2 Supported Alexa Intents and Slots
| Intent Name | Sample Utterances | Slots | Description |
| :--- | :--- | :--- | :--- |
| `DiagnoseApplianceIntent` | *"What is wrong with my refrigerator?"*, *"My washer is leaking water from the bottom"* | `Appliance` (AMAZON.Appliance), `Symptom` (AMAZON.SearchQuery) | Identifies symptoms, inspects safety hazards, and delivers concise spoken troubleshooting guidance (under 4 sentences). Prompts for clarification if slots are missing. |
| `CheckWarrantyIntent` | *"Is my dishwasher still covered under warranty?"*, *"Check refrigerator warranty"* | `Appliance` (AMAZON.Appliance) | Evaluates warranty status, days remaining, and expiration date against Digital Repair Passports in the database. |
| `ReviewCaseIntent` / `GetCaseStatusIntent` | *"What is the status of my repair case?"*, *"Check my open tickets"* | `CaseNumber`, `Appliance` | Summarizes current case status, scheduled appointments, and reported faults. |
| `CheckDispatchStatusIntent` | *"Where is my repair technician?"*, *"Check contractor dispatch status"* | `CaseNumber`, `Appliance` | Reports simulated contractor assignment, technician name, company, vehicle, and real-time arrival estimate (ETA). |
| `RequestRepairIntent` | *"Please file a repair ticket for my refrigerator"*, *"Schedule service for my washer"* | `Appliance`, `Symptom` | Prepares a proposed repair case and generates a single-use confirmation token. Spoken prompt: *"I have prepared a repair ticket for your [Appliance] regarding [Symptom]. Would you like me to confirm and schedule this now?"* |
| `AMAZON.YesIntent` | *"Yes"*, *"Confirm"*, *"Please schedule"* | None | Confirms pending repair proposal from session attributes. Validates single-use token, creates the repair case, and queues a simulated contractor dispatch. |
| `AMAZON.NoIntent` | *"No"*, *"Cancel"*, *"Never mind"* | None | Discards pending proposal and gracefully cancels the ticket creation. |
| `AMAZON.HelpIntent` | *"Help"*, *"What can you do?"* | None | Explains available voice commands and examples. |
| `AMAZON.StopIntent` / `AMAZON.CancelIntent` | *"Stop"*, *"Exit"*, *"Cancel"* | None | Speaks polite farewell and sets `shouldEndSession: true`. |
| `AMAZON.FallbackIntent` | *"Something else"* | None | Helpful fallback when speech is not understood. |

### 2.3 Endpoint and Request Security
- **Route**: `POST /api/alexa`
- **Request Verification Middleware (`alexaVerifier.ts`)**:
  1. **Signature Certificate Chain URL**: Validates that `SignatureCertChainUrl` header uses `https:`, host is `echo-api.amazon.com`, port is 443, and path starts with `/echo.api/`.
  2. **Timestamp Freshness**: Verifies `request.timestamp` is within 150 seconds tolerance of server clock to prevent replay attacks.
  3. **Cryptographic RSA Signature**: Extracts the raw request body buffer (`req.rawBody`) before JSON parsing and validates the base64-encoded `Signature` against the X.509 certificate public key.
  4. **Test & Dev Bypass Mode**: Setting `ALEXA_VERIFY_SIGNATURE=false` in local development or test runners allows testing simulated Alexa envelopes without live Amazon cert downloading.
- **Account Linking & Session Scoping**:
  - If `session.user.accessToken` is provided, the backend hashes the token and resolves the registered FixFlow user session in SQLite.
  - If unlinked, queries are scoped to sample demo appliances. When an unlinked user attempts mutations, the assistant prompts them to link their FixFlow account in the Alexa app.

---

## 3. Voice Safety and Two-Step Mutation Confirmation

The Alexa voice integration strictly preserves the two-step confirmation policy established in earlier phases:

1. **Explicit Verbal Confirmation**: State-changing actions (`create_repair_case`, `dispatch_contractor`) are NEVER executed silently from voice.
2. **Single-Use Cryptographic Tokens**:
   - `RequestRepairIntent` issues a unique token (`cfrm_*`) with canonical argument hashing and 5-minute TTL.
   - The token is stored in the Alexa session attributes.
   - When the user answers `AMAZON.YesIntent`, the token is consumed. Re-playing or speaking "Yes" a second time is rejected with: *"That confirmation request has expired or was already completed."*
3. **No Voice PIN Compromise**: Authentication relies on Alexa Account Linking (OAuth 2.0 bearer session tokens) rather than an insecure 4-digit voice PIN spoken aloud.
4. **Critical Hazard Interceptor**:
   - If user describes burning smells, electrical sparks, gas leaks, or flooding, `detectSafetyHazard` halts DIY recommendations immediately.
   - Spoken response: *"CRITICAL SAFETY ALERT: Please evacuate immediately if you smell gas or turn off the circuit breaker. Do not attempt any DIY repair."*

---

## 4. Contractor Dispatch Simulation

### 4.1 State Machine & Allowed Transitions
```
   +-----------+
   |  pending  +-----------------------+
   +-----+-----+                       |
         |                             |
         v                             |
   +-----------+                       |
   |dispatched +-----------------+     |
   +-----+-----+                 |     |
         |                       |     |
         v                       v     v
   +-----------+            +-------------+
   | en_route  +----------->+  cancelled  |  (Terminal)
   +-----+-----+            +-------------+
         |
         v
   +-----------+
   |  arrived  |  (Syncs repair case -> 'in_progress')
   +-----+-----+
         |
         v
   +-----------+
   | completed |  (Syncs repair case -> 'resolved')
   +-----------+  (Terminal)
```

- **Valid Transitions**:
  - `pending` → `dispatched`, `cancelled`
  - `dispatched` → `en_route`, `cancelled`
  - `en_route` → `arrived`, `cancelled`
  - `arrived` → `completed`
  - `completed` → None (terminal)
  - `cancelled` → None (terminal)
- **Backward and invalid transitions** (e.g. `arrived` → `pending` or `completed` → `dispatched`) are rejected with `HTTP 400 Bad Request`.

### 4.2 Simulated Data Attributes
- **Contractors Pool**: Realistic simulated service companies (e.g., *Apex Home Appliance Care - Mike Vance*, *FixFlow Certified Specialists - Elena Rostova*).
- **Vehicles**: White Ford Transit (#4), Blue Mercedes Sprinter (#12).
- **Arrival Estimates**: Dynamically calculated (25 mins on dispatch → 15 mins en route → 0 on arrival).
- **Audit Events**: Recorded in `dispatch_events` table with timestamps.

### 4.3 REST & Streaming Endpoints
- `GET /api/repairs/:id/dispatch`: Retrieves current dispatch details and chronological event history.
- `POST /api/repairs/:id/dispatch/initiate`: Queues simulated dispatch for a repair case.
- `POST /api/repairs/:id/dispatch/advance`: Advances simulation to next valid state or specified `targetStatus`.
- `POST /api/repairs/:id/dispatch/cancel`: Safely cancels active dispatch.
- `GET /api/repairs/:id/dispatch/stream`: Server-Sent Events (SSE) live update stream.

---

## 5. Live Status Updates (SSE & Polling Fallback)

- **SSE Transport**: The endpoint `GET /api/repairs/:id/dispatch/stream` maintains an open HTTP connection with `Content-Type: text/event-stream`.
- **Heartbeat**: Emits `: ping\n\n` comments every 15 seconds to prevent intermediate proxy timeout.
- **Initial Snapshot**: Immediately emits `{ type: 'initial_state', dispatch }` on connect.
- **Broadcast Events**: When a transition occurs, the server-side pub/sub broadcaster notifies active listeners for that case ID with `{ type: 'dispatch_status_changed', dispatch }`.
- **Cleanup**: On connection close (`req.on('close')`), interval timers are cleared and listener callbacks are removed, preventing memory leaks.
- **Frontend Fallback**: The React `DispatchTracker` component falls back to periodic polling if the browser or network environment does not support persistent SSE connections.

---

## 6. Database Schema Migration

The migration is defined in `database/schema/004_contractor_dispatch_schema.sql` and applied safely during `initializeDatabase()`:

```sql
CREATE TABLE IF NOT EXISTS contractor_dispatches (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  contractor_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  vehicle_info TEXT,
  estimated_arrival_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'dispatched', 'en_route', 'arrived', 'completed', 'cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dispatched_at TEXT,
  en_route_at TEXT,
  arrived_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (case_id) REFERENCES repair_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dispatch_events (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dispatch_id) REFERENCES contractor_dispatches(id) ON DELETE CASCADE
);
```

---

## 7. Local Testing and Development

### Running Automated Tests
```bash
# Run all 83 backend integration tests (including Alexa & Dispatch test suites)
npm --prefix backend test

# Run MCP server integration tests (22 tests)
npm --prefix mcp-server test

# Run frontend build and lint check
npm run build:frontend
npm run lint:frontend

# Run verified database cold backup and integrity check
npm run db:backup
```

### Environment Configuration
Placeholders in `.env` (backend):
```bash
# Server Port
PORT=3001

# Alexa Verification Toggle (set to false for offline test runs)
ALEXA_VERIFY_SIGNATURE=false

# LLM Provider Configuration (optional; simulator used if omitted)
# GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
```

---

## 8. Verification and Deployment Considerations

### Verified in Local Environment
- Full Alexa request envelope handling (`LaunchRequest`, `IntentRequest`, `SessionEndedRequest`).
- Verbal diagnosis with safety hazard interceptor.
- Two-step spoken confirmation with single-use replay protection.
- State progression machine and invalid transition rejection.
- Live SSE stream delivery and event logging.
- Frontend Dispatch Tracker and Alexa Voice Simulator interfaces.
- 100% passing test coverage (83 backend tests + 22 MCP tests).

### Real-Device Deployment Prerequisites (Unverified External Items)
1. **Amazon Developer Account**: Must be registered in the Amazon Developer Console under the Alexa Skills Kit section.
2. **Skill Interaction Model**: The intent schema, sample utterances, and slot types defined in this document must be published to the Alexa Skill Interaction Model.
3. **Public HTTPS Endpoint**: The `/api/alexa` route must be hosted with a valid SSL/TLS certificate issued by an Amazon-approved certificate authority (or tunnelled via tools like ngrok/Cloudflare Tunnel for local testing).
4. **Account Linking**: Must configure OAuth 2.0 authorization and token URLs to point to `/api/auth` to enable real-world Alexa user linking.
