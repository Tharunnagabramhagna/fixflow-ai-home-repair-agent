# FixFlow — AI-Powered Home Repair Management

> **Amazon Developers Hackathon — Alexa+ Track**

FixFlow helps homeowners manage household appliance repairs. A user can register appliances, describe faults in natural language, view persistent repair history via **Digital Repair Passports**, prepare service requests, and track cases from diagnosis through completion.

---

## Architecture Overview

FixFlow is organized into cleanly decoupled directories separating user interface, API services, database management, and maintenance tooling:

```
FixFlow/
├── frontend/                     # React 19, Vite, Tailwind CSS, TypeScript UI
│   ├── src/
│   │   ├── api/                  # Typed REST API client
│   │   ├── components/           # UI components (SummaryCards, ApplianceCard, Header, Sidebar)
│   │   ├── views/                # Overview, My Appliances, Repair Cases, Repair History, Settings
│   │   └── types/                # Shared TypeScript data models
│   └── vite.config.ts            # Vite build configuration with /api proxy
├── backend/                      # Node.js, Express, TypeScript, SQLite REST API
│   ├── src/
│   │   ├── db/                   # SQLite connection (WAL mode) and seed service
│   │   ├── routes/               # Express API routers (appliances, repairs, dashboard)
│   │   ├── services/             # Atomic business services (repairService, applianceService)
│   │   ├── validators.ts         # Zod request validation schemas
│   │   ├── __tests__/            # Automated Vitest test suites (seed, workflow, api)
│   │   └── app.ts                # Express application setup
│   ├── package.json              # Backend dependencies and scripts
│   └── vitest.config.ts          # Test runner configuration
├── database/                     # Authoritative database assets & persistence
│   ├── backups/                  # Verified cold backups (*.db, git-ignored)
│   ├── data/                     # Active runtime SQLite files (fixflow.db, git-ignored)
│   ├── schema/                   # Authoritative versioned SQL migrations (001_initial_schema.sql)
│   ├── seeds/                    # Seed entrypoints delegating to production seed service
│   └── scripts/                  # Database maintenance & verified backup runner
├── docs/                         # Verification audit reports and responsive screenshots
│   └── audit-screenshots/        # Desktop, Laptop, Tablet, and Mobile UI screenshots
├── scripts/                      # Cross-project maintenance utilities (create_verified_backup.js)
├── .env.example                  # Environment configuration template
├── package.json                  # Root monorepo scripts
└── README.md
```

---

## Prerequisites

- **Node.js**: v20+ (tested with v26.7.0)
- **npm**: v10+ (tested with 11.17.0)
- **Git**: v2.40+

---

## Quickstart & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tharunnagabramhagna/fixflow-ai-home-repair-agent.git
   cd fixflow-ai-home-repair-agent
   ```

2. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   ```

3. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

---

## Running the Application

### Development Mode (Both Services)

Run the backend server and frontend client in separate terminal windows:

```bash
# Terminal 1 — Backend API (starts on http://localhost:3001)
npm run dev:backend

# Terminal 2 — Frontend Client (starts on http://localhost:5173)
npm run dev:frontend
```

Open your browser at **`http://localhost:5173`**. The Vite frontend automatically proxies `/api` calls to the backend on `localhost:3001`.

*(Backwards-compatible aliases `npm run dev:server` and `npm run dev:client` are also supported).*

### Production Build

Compile TypeScript and build the production bundles for both services:

```bash
npm run build
```
Or individually:
```bash
npm run build:backend
npm run build:frontend
```

---

## Automated Testing Suite

Run the complete Vitest automated test suite:

```bash
npm test
# or: npm run test:backend
```

The backend test suite runs **98 automated tests across 8 test suites** (plus **22 automated tests** in `mcp-server`, for a total of **120 tests**):
1. **`multimodal.test.ts` (15 tests)**: Magic-byte inspection, dimensions, size limits, EXIF sanitization, directory traversal defense, rate-limiting, safety interceptor, multimodal analysis, passport confirmation, and ownership enforcement.
2. **`alexa.test.ts` (12 tests)**: ASK signature verification, timestamp freshness validation, supported intents, error handling, and secret redaction.
3. **`dispatch.test.ts` (7 tests)**: Dispatch lifecycle, state transitions, ownership access checks, and SSE live stream updates.
4. **`assistant.test.ts` (11 tests)**: Conversational diagnostics, tool calling, two-step confirmation manager, and safety hazard interception.
5. **`auth.test.ts` (20 tests)**: User registration, bcrypt password hashing, login, session tokens, sign-out invalidation, guest read access, and cross-user data isolation.
6. **`api.test.ts` (17 tests)**: Health probe, appliance CRUD, validation failures (HTTP 400), non-existent entity 404 guards, repair tickets, status updates, and dashboard summary aggregations.
7. **`seed.test.ts` (6 tests)**: Real production seed idempotency, clean initial seed, duplicate prevention, partial warranty doc restoration, transactional rollback on error, and SQL schema file compatibility.
8. **`workflow.test.ts` (10 tests)**: Atomicity of case and event creation, valid status lifecycle transitions, invalid transition rejection, terminal closed state lock, and deterministic event ordering.

### Complete Database Isolation in Tests
All mutation-based tests run against isolated in-memory or dedicated temporary databases (`test-fixflow.db`). The development database (`database/data/fixflow.db`) is never touched or modified during test execution.

---

## Database Management & Verified Backups

The backend uses **`better-sqlite3`** with:
- **Write-Ahead Logging (WAL mode)** for high concurrent performance.
- **Foreign key constraints** enforced on all connections (`PRAGMA foreign_keys = ON`).
- **Configurable database path**: Controlled via `DATABASE_PATH` environment variable (defaults to `database/data/fixflow.db`).

### Verified Cold Backup Engine
To create a crash-safe, WAL-checkpointed backup verified with `integrity_check`, `foreign_key_check`, and exact snapshot record counts:

```bash
npm run db:backup
```

The backup engine:
1. Flushes WAL frames into the main database file (`PRAGMA wal_checkpoint(TRUNCATE)`).
2. Captures source record counts.
3. Performs a native SQLite backup into `database/backups/fixflow-backup-<TIMESTAMP>.db`.
4. Opens the backup in read-only mode and verifies:
   - File exists and opens cleanly.
   - `PRAGMA integrity_check = ok`.
   - `PRAGMA foreign_key_check = 0 violations`.
   - All required tables exist.
   - Every table count matches the source snapshot.
5. Exits with code 0 on verified PASS, or labels as `*-unverified.db` and exits with code 1 on failure.

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Live service health check, version, and timestamp |
| `GET` | `/api/appliances` | List all registered household appliances |
| `POST` | `/api/appliances` | Register an appliance (validated via Zod) |
| `GET` | `/api/appliances/:id` | Get single appliance details |
| `GET` | `/api/appliances/:id/history` | Get appliance repair history, events, and warranty documents |
| `GET` | `/api/repairs` | List repair cases (supports `?status=` and `?appliance_id=`) |
| `POST` | `/api/repairs` | Create a new repair ticket (validates appliance foreign key) |
| `GET` | `/api/repairs/:id` | Get repair case details and audit event timeline |
| `PATCH` | `/api/repairs/:id/status` | Update case status (validates state transitions & logs event) |
| `GET` | `/api/dashboard/summary` | Aggregated counts (active, open, scheduled, resolved), recent events, and appointments |
| `POST` | `/api/assistant/chat` | AI repair assistant conversational diagnostics & tool calling |
| `POST` | `/api/assistant/confirm` | Two-step homeowner confirmation execution |
| `GET` | `/api/repairs/:id/dispatch` | Current contractor dispatch status and event timeline |
| `POST` | `/api/repairs/:id/dispatch/advance` | Advance simulated contractor lifecycle |
| `POST` | `/api/repairs/:id/dispatch/cancel` | Cancel contractor dispatch |
| `GET` | `/api/repairs/:id/dispatch/stream` | Server-Sent Events (SSE) live dispatch update stream |
| `GET` | `/api/alexa` | Alexa Skills Kit endpoint discovery and supported intents |
| `POST` | `/api/alexa` | Official Alexa Skills Kit webhook with request signature verification |
| `POST` | `/api/inspections/analyze` | Upload image for multimodal AI diagnosis, rating plate extraction & hazard detection |
| `GET` | `/api/inspections` | List visual inspections for authenticated user |
| `GET` | `/api/inspections/:id` | Get inspection analysis details |
| `GET` | `/api/inspections/:id/image` | Securely stream inspection photograph |
| `DELETE` | `/api/inspections/:id` | Delete inspection record and image file from storage |
| `POST` | `/api/inspections/:id/apply` | Apply confirmed extracted brand/model to Digital Repair Passport |

---

## Signature Features

1. **Digital Repair Passport**:
   - Device specifications, real-time warranty evaluation, document storage, and chronological fault/resolution audit trails.
2. **AI Repair Assistant & MCP Tools (Phase 3)**:
   - Natural language appliance diagnosis, clarifying questions, safety hazard interceptor, and structured tool calling.
   - Two-step confirmation tokens (`cfrm_*`) protecting all mutations with argument binding and single-use replay protection.
3. **Alexa Voice Integration & Contractor Dispatch Simulation (Phase 4)**:
   - Voice intents for appliance diagnosis, warranty lookups, case reviews, dispatch tracking, and verbal two-step confirmation.
   - ASK request signature and timestamp freshness verification.
   - Live contractor dispatch simulation (`pending` → `dispatched` → `en_route` → `arrived` → `completed`) with real-time Server-Sent Events (SSE) push streaming.
   - In-browser Alexa Voice Assistant Simulator testbed.
4. **Multimodal AI Diagnostics & Visual Appliance Inspection (Phase 5)**:
   - Homeowner photo upload (JPEG, PNG, WebP) with strict binary magic-byte inspection, dimension limits (max 8192x8192), 10MB ceiling, and automated EXIF/GPS metadata stripping.
   - Structured visual diagnostics clearly separating physical observations from inferred hypotheses, reading error codes & rating plates with calibrated confidence.
   - Built-in Safety Interceptor for gas leaks, electrical arcing/fire, and water near electrical components.
   - Two-step confirmation flow before updating Digital Repair Passports with extracted specifications.
   - AI Assistant MCP tool `get_visual_inspections` allowing the conversational agent to reference visual evidence.
   - Interactive UI modal with drag-and-drop, sample testbed presets, side-by-side verification, and direct repair case linking.

---

## Project Status

- **Phase 1 (Complete & Verified)**: Core monorepo architecture, SQLite WAL database, REST API, Digital Repair Passports, and verified cold backups.
- **Phase 2 (Complete & Verified)**: Official Model Context Protocol (MCP) server running Streamable HTTP with 7 repair tools and guest vs authenticated privacy scoping.
- **Phase 3 (Complete & Verified)**: Conversational AI Repair Assistant with structured MCP tool calling, Gemini/OpenAI/Claude multi-provider support, and critical safety hazard interceptors.
- **Phase 4 (Complete & Verified)**: Alexa Voice Integration layer (`/api/alexa`) with ASK request verification, verbal two-step confirmation, stateful contractor dispatch simulation, and real-time SSE streaming.
- **Phase 5 (Complete & Verified)**: Multimodal AI repair diagnostics, visual appliance inspection, rating plate OCR extraction, EXIF metadata sanitization, and passport record updates.

---

## License

This project was created for the Amazon Developers Hackathon — Alexa+ Track.
