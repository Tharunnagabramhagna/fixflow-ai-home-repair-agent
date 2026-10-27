# FixFlow — Production Backend Deployment Guide (Render + Vercel)

This guide documents the production deployment of the FixFlow backend API on **Render** (the active production backend host) and its integration with the frontend deployed on **Vercel** (`https://fixflow-ai-home-repair-agent-two.vercel.app`). **Railway** remains fully supported and documented as a drop-in alternative backend target.

---

## 1. Architecture Overview

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     Homeowner Browser Client    │           │    Amazon Alexa / Voice Client  │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │ HTTPS                                       │ HTTPS POST
                 ▼                                             ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│       Vercel Edge Network       │           │     Official ASK Webhook        │
│   (React 19 / Vite Frontend)    │           │     POST /api/alexa             │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │ /api/* rewrite                              │
                 ▼                                             │
┌──────────────────────────────────────────────────────────────▼────────────────┐
│                         Railway Node.js Service                                │
│                  Express / TypeScript REST API (:PORT)                         │
│   - Strict CORS origin allowlist driven by CORS_ORIGIN                         │
│   - SameSite=Lax HttpOnly session cookies via Vercel proxy                     │
│   - Model Context Protocol (MCP) Streamable HTTP endpoints                     │
│   - Multimodal AI Diagnostics & Rating Plate OCR                               │
│   - Stateful Contractor Dispatch Simulation                                    │
└────────────────────────────────┬───────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    Railway Persistent Volume (/data)                          │
│   - /data/fixflow.db                (SQLite WAL database, foreign keys on)    │
│   - /data/uploads/inspections/      (Sanitized homeowner diagnostic photos)   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key Production Decisions:
1. **Active Host (Render):** Production traffic is served by Render at `https://fixflow-ai-home-repair-agent.onrender.com`.
2. **Reverse Proxy (Vercel):** The frontend at `https://fixflow-ai-home-repair-agent-two.vercel.app` routes `/api/*` requests through edge rewrites to Render, ensuring seamless same-origin cookie delivery without third-party cookie restrictions.
3. **Proxy Trust:** Configured via `app.set('trust proxy', true)` to accurately resolve client IP addresses through Vercel Edge, Cloudflare, and Render reverse proxies.
4. **Rate Limiting Protection:** Configurable sliding-window rate limiters defend `/api/assistant` (20 req/min) and `/api/inspections` (10 req/min) against denial of service and LLM cost spikes.
5. **Persistent Storage:** SQLite database and uploaded inspection photos reside on a persistent volume mount (`DATA_DIR=/data`).
6. **Alternative Target (Railway):** Railway remains fully documented and supported as a drop-in deployment target with persistent volume mount `/data`.

---

## 2. Railway Service Configuration

### 2.1 Repository & Service Setup
1. Log in to [Railway](https://railway.app/) and create a new project.
2. Select **Deploy from GitHub repo** and choose `fixflow-ai-home-repair-agent`.
3. Set the service settings:
   - **Root Directory:** `/` (repository root)
   - **Build Command:** `npm run build:backend`
   - **Start Command:** `npm start`

> [!IMPORTANT]
> Do NOT set Root Directory to `backend`. The server requires repository-root access at runtime to execute SQL migrations from `database/schema/` and read category manifests like `alexa-plus-addon.json`.

### 2.2 Persistent Volume Setup
1. In the Railway service dashboard, navigate to **Volumes** (or right-click the canvas and select **Add Volume**).
2. Connect the volume to the FixFlow backend service.
3. Configure the mount path:
   - **Mount Path:** `/data`
   - **Volume Size:** 1 GB (or higher depending on expected image upload volume)

---

## 3. Environment Variables Reference

Configure the following variables in the Railway service **Variables** tab:

### Required Variables

| Variable Name | Production Value | Purpose / Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations, disables verbose logging, and enforces strict CORS. |
| `PORT` | *(Leave unset)* | Railway automatically injects `PORT`. Express listens on this port. |
| `HOST` | `0.0.0.0` | Binds Express to all public interfaces inside the container. |
| `DATA_DIR` | `/data` | Directs SQLite database files (`fixflow.db`, `-wal`, `-shm`) to the persistent volume. |
| `INSPECTIONS_UPLOADS_DIR` | `/data/uploads/inspections` | Directs uploaded inspection images to private storage on the persistent volume. |
| `CORS_ORIGIN` | `https://<YOUR-APP>.vercel.app` | Comma-separated list of approved browser origins allowed to access the backend. |
| `SESSION_SECRET` | *(64-character hex string)* | Secret key for signing session tokens and internal security operations. |

> [!WARNING]
> **Do NOT configure `DATABASE_PATH` in production.**  
> If `DATABASE_PATH` is set to a relative path like `./database/data/fixflow.db`, it will override `DATA_DIR` and place the database on ephemeral container storage, causing data loss on restarts.

### Optional AI Provider Configuration

| Variable Name | Recommended Value | Purpose / Description |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | `gemini` | AI provider for repair assistant diagnostics (`gemini`, `openai`, `anthropic`, or `simulator`). |
| `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API key (recommended: Tier-1 pay-as-you-go key). |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Multimodal and diagnostic model. |
| `OPENAI_API_KEY` | `sk-...` | Optional: OpenAI API key (if `LLM_PROVIDER=openai`). |
| `OPENAI_MODEL` | `gpt-4o-mini` | Optional: OpenAI model identifier. |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Optional: Anthropic Claude API key (if `LLM_PROVIDER=anthropic`). |
| `ALEXA_VERIFY_SIGNATURE` | `true` | Enforces cryptographic ASK certificate chain and RSA signature verification. |

---

## 4. Health Check & Networking

Configure the Railway deployment health check:
- **Path:** `/api/health`
- **Port:** *(matches service port)*
- **Timeout:** 100 seconds
- **Interval:** 30 seconds

### Verification Command:
```bash
curl -s -i https://<your-railway-domain>.up.railway.app/api/health
```
Expected output:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok","service":"FixFlow API","version":"1.0.0","timestamp":"..."}
```

---

## 5. Vercel Connection Setup (Reverse Proxy)

Because the frontend is deployed on Vercel, the recommended architecture routes all `/api/*` requests through a Vercel edge rewrite. This ensures the frontend and backend appear same-origin to the browser.

### 5.1 Vercel Rewrite Configuration
`vercel.json` is configured in the repository (both at the root and in `frontend/vercel.json` to support whichever Vercel Root Directory setting is used):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api",
      "destination": "https://fixflow-ai-home-repair-agent.onrender.com/api"
    },
    {
      "source": "/api/:path*",
      "destination": "https://fixflow-ai-home-repair-agent.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

*For Render backend: `destination` points to `https://fixflow-ai-home-repair-agent.onrender.com/api/:path*`.*
*For Railway backend: `destination` points to `https://<YOUR-RAILWAY-DOMAIN>.up.railway.app/api/:path*`.*

### 5.2 Why this preserves full security:
1. **Cookie Preservation:** When a user registers or logs in, the backend issues a `fixflow_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure`). Because the browser initiated the request to `https://<YOUR-APP>.vercel.app/api/auth/login`, the cookie is stored directly under the Vercel domain.
2. **Zero Storage Token Leaks:** The frontend does not need to store auth tokens in `localStorage` or `sessionStorage`.
3. **No AI Secrets on Client:** All AI credentials (`GEMINI_API_KEY`, etc.) remain exclusively on Railway.

---

## 6. End-to-End Post-Deployment Verification

Execute the following checklist once Railway is running:

### Step 1: Verify Public Health & Connectivity
```bash
# Verify Railway direct health check
curl -s https://<your-railway-domain>.up.railway.app/api/health

# Verify Vercel proxy rewrite
curl -s https://<your-vercel-domain>.vercel.app/api/health
```

### Step 2: Verify Strict CORS Origin Protection
```bash
# 1. Unapproved browser origin must be rejected with HTTP 403:
curl -i -X POST https://<your-railway-domain>.up.railway.app/api/auth/session \
  -H "Origin: https://unauthorized-malicious-site.com" \
  -H "Content-Type: application/json"

# 2. Approved Vercel origin must be accepted with credentials allowed:
curl -i https://<your-railway-domain>.up.railway.app/api/health \
  -H "Origin: https://<your-vercel-domain>.vercel.app"

# 3. Legitimate tool/CLI request with NO Origin header must succeed:
curl -i https://<your-railway-domain>.up.railway.app/api/health
```

### Step 3: Verify Persistent Storage Across Redeploys
1. Open the deployed frontend on Vercel (`https://<your-vercel-domain>.vercel.app`).
2. Sign in or register a new account (e.g. `test-homeowner@example.com`).
3. Register a new household appliance (e.g. "Kitchen Dishwasher - Bosch SHPM88Z75N").
4. In Railway, click **Redeploy** on the backend service (simulating a container restart).
5. Once the redeploy completes, refresh the Vercel frontend.
6. **Pass Criterion:** The session remains valid and the newly registered appliance appears under **My Appliances** without data loss.

### Step 4: Verify Idempotent Startup in Railway Logs
Open **View Logs** in the Railway service dashboard and verify:
```
[seed] Demo data already exists, skipping seed.
FixFlow API Server listening on 0.0.0.0:xxxx (environment: production)
Health check endpoint available at /api/health
```
Confirm that no startup errors or credential exposures occurred.

---

## 7. Manual Deployment Action Summary

| Step | Platform | Action |
| :--- | :--- | :--- |
| **1** | Railway | Create project from GitHub repository `fixflow-ai-home-repair-agent`. |
| **2** | Railway | Set Build Command: `npm run build:backend` and Start Command: `npm start`. |
| **3** | Railway | Add Persistent Volume with Mount Path `/data`. |
| **4** | Railway | Add Environment Variables (`NODE_ENV=production`, `DATA_DIR=/data`, `INSPECTIONS_UPLOADS_DIR=/data/uploads/inspections`, `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`, `SESSION_SECRET=...`). |
| **5** | Railway | Generate Domain in Service > Settings > Networking (e.g. `fixflow-backend.up.railway.app`). |
| **6** | Vercel | Add rewrite rule in `vercel.json` pointing `/api/:path*` to the Railway domain. |
| **7** | Browser | Complete live test journey: sign in, create repair ticket, verify dispatch status. |
