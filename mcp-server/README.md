# FixFlow MCP Server

FixFlow Model Context Protocol (MCP) server providing external AI assistants with authenticated access to appliance records, Digital Repair Passports, warranty verification, and repair lifecycle management.

## Architecture

- **Protocol**: Model Context Protocol (MCP) Streamable HTTP transport (Protocol Version `2025-11-25`)
- **SDK**: `@modelcontextprotocol/sdk` v1.32.1
- **Backend Mediation**: Communicates with the FixFlow Express backend via authenticated HTTP REST APIs (`http://localhost:3001/api`). Does not connect directly to SQLite or duplicate repair business logic.
- **Port**: Default `3002` (host `127.0.0.1`)

## Endpoints

- **Streamable HTTP MCP Endpoint**: `POST /mcp` (session initialization and JSON-RPC messages), `GET /mcp` (SSE stream), `DELETE /mcp` (session termination)
- **Health Check**: `GET /health`

## Registered Tools

1. `search_appliances`: Search appliances by query text or category filter. Authenticated users see their registered appliances; guests see FixFlow sample catalog appliances.
2. `get_repair_passport`: Retrieve the complete Digital Repair Passport (specifications, repair cases, audit events, warranty documents).
3. `check_warranty`: Evaluate whether warranty is active or expired, calculate days remaining, and list associated warranty documents.
4. `list_repair_cases`: List repair cases with optional status filter or appliance UUID filter.
5. `get_repair_case`: Get detailed information, lifecycle status, scheduling preferences, and audit history for a single repair case.
6. `create_repair_case`: Consequential action. Submit a fault report and create a new repair case. Enforces two-step confirmation (`confirmation_token`), authenticated user permissions, and duplicate detection.
7. `add_repair_note`: Consequential action. Append a diagnostic note to an existing repair case audit trail. Enforces two-step confirmation (`confirmation_token`) and authenticated user ownership.

## Two-Step Confirmation Workflow

For consequential write actions (`create_repair_case`, `add_repair_note`):
1. **Proposal (Step 1)**: Invoking the tool without a `confirmation_token` generates a short-lived (5-minute), cryptographically secure single-use confirmation token bound to the authenticated user, appliance/case ID, and argument hash. No state mutation occurs.
2. **Approval & Execution (Step 2)**: Once the user explicitly approves the proposal, re-invoke the tool with `confirmation_token: '<token>'`. The server validates the token, argument hash, and user binding, consumes the token, and executes the operation through the authenticated backend API.

## Commands

```bash
# Start MCP server in development mode
npm run dev

# Build TypeScript output
npm run build

# Run MCP integration tests
npm test

# Start production server
npm start
```
