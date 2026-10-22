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
│   │   ├── views/                # Overview, My Appliances, Repair Cases, Repair History, Settings, System Health
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

The test suite runs **31 automated tests across 3 test suites**:
1. **`api.test.ts` (17 tests)**: Health probe, appliance CRUD, validation failures (HTTP 400), non-existent entity 404 guards, repair tickets, status updates, and dashboard summary aggregations.
2. **`seed.test.ts` (6 tests)**: Real production seed idempotency, clean initial seed, duplicate prevention, partial warranty doc restoration, transactional rollback on error, and SQL schema file compatibility.
3. **`workflow.test.ts` (8 tests)**: Atomicity of case and event creation, valid status lifecycle transitions, invalid transition rejection, terminal closed state lock, and deterministic event ordering.

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

---

## Signature Feature: The Digital Repair Passport

Each registered appliance has a persistent **Digital Repair Passport**:
- **Device Specifications**: Brand, model, serial number, and household location.
- **Warranty Status**: Real-time evaluation of active vs. expired manufacturer warranty.
- **Warranty Documents**: Attached document metadata (e.g., certificates, user manuals).
- **Chronological Repair History**: Deterministic audit trail of reported faults, technician diagnoses, scheduled service dates, and final resolutions.
- Accessible directly from appliance cards or case views.

---

## Current Status & Boundaries (Phase 1)

- **Phase 0 (Complete)**: Repository setup, Git safety configuration, and `.gitignore` secrets protection.
- **Phase 1 (Complete & Verified)**:
  - Clean monorepo directory restructuring (`frontend/`, `backend/`, `database/`, `docs/`, `scripts/`).
  - Persistent SQLite storage (`database/data/fixflow.db`) with WAL mode, foreign keys, and cold backup verification.
  - Validated Express REST API with centralized error handling.
  - Automated test suite (31 tests) testing real production seed and repair services against isolated test databases.
  - Refined React frontend with Digital Repair Passports, responsive summary cards, global search, mobile navigation drawer, and dedicated System Health diagnostics.
  - **Truthful Prototype Boundaries**:
    - The FixFlow Assistant in the UI is currently a **Local Rule-Based Triage Preview** matching homeowner symptoms to inventory items.
    - No live Amazon Bedrock foundation models or Alexa voice skills are connected in Phase 1.
    - External technician booking is simulated via internal database state transitions; no live external booking APIs are invoked.
- **Phase 2 (Upcoming)**: Official Model Context Protocol (MCP) TypeScript SDK layer exposing appliance triage and ticket creation tools to AI agents.
- **Phase 3 (Upcoming)**: Alexa+ voice interaction layer via Alexa Skills Kit and Amazon Bedrock for conversational diagnosis.

---

## License

This project was created for the Amazon Developers Hackathon — Alexa+ Track.
