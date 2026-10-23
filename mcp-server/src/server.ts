import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FixFlowBackendClient } from './backendClient.js';
import { registerFixFlowTools } from './tools.js';
import { config } from './config.js';

export interface ActiveSession {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
  lastActive: number;
  boundToken?: string;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes session timeout

export function createMcpApp(backendClient?: FixFlowBackendClient) {
  const client = backendClient || new FixFlowBackendClient(config.backendUrl);
  const app = express();

  // 1. CORS with safe origin reflection & exposed session headers
  app.use(
    cors({
      origin: true,
      credentials: true,
      exposedHeaders: ['mcp-session-id', 'content-type'],
      allowedHeaders: ['content-type', 'authorization', 'mcp-session-id', 'accept'],
    })
  );

  // 2. Request body size limit (1MB max to prevent memory exhaustion)
  app.use(express.json({ limit: '1mb' }));

  const sessions = new Map<string, ActiveSession>();

  // Periodic cleanup of stale sessions
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
      if (now - session.lastActive > SESSION_TTL_MS) {
        sessions.delete(sid);
        try {
          session.transport.close();
        } catch {}
      }
    }
  }, 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      return token || undefined;
    }
    return undefined;
  }

  // Helper factory to initialize an McpServer instance bound to a session context
  function createFixFlowMcpServer(getSessionAuthToken?: () => string | undefined): McpServer {
    const server = new McpServer(
      {
        name: config.serverName,
        version: config.serverVersion,
      },
      {
        instructions:
          'FixFlow MCP Server: Provides external AI assistants with authenticated access to appliance records, Digital Repair Passports, warranty verification, and repair lifecycle management. Always check warranty status and appliance records before creating a repair case. Consequential actions require explicit two-step user confirmation with single-use confirmation tokens. Never execute writes without user approval.',
      }
    );

    registerFixFlowTools(server, client, getSessionAuthToken);
    return server;
  }

  // Health and discovery endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'FixFlow MCP Server',
      version: config.serverVersion,
      transport: 'Streamable HTTP',
      specVersion: '2025-11-25',
      mcpEndpoint: config.mcpPath,
      activeSessions: sessions.size,
      timestamp: new Date().toISOString(),
    });
  });

  // Streamable HTTP endpoint: Handles initialization, messages, SSE streaming, and session teardown
  app.all(config.mcpPath, async (req: Request, res: Response) => {
    const rawSessionId = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const requestToken = extractBearerToken(req);

    // 1. Existing Session request
    if (sessionId && sessions.has(sessionId)) {
      const activeSession = sessions.get(sessionId)!;

      // Check session expiry
      if (Date.now() - activeSession.lastActive > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        try {
          activeSession.transport.close();
        } catch {}
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: `MCP Session '${sessionId}' has expired due to inactivity.` },
          id: null,
        });
        return;
      }

      activeSession.lastActive = Date.now();

      // If a Bearer token is provided on this subsequent request, bind/verify it
      if (requestToken) {
        if (activeSession.boundToken && activeSession.boundToken !== requestToken) {
          res.status(403).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Forbidden: Cannot change authenticated identity within an active session.' },
            id: null,
          });
          return;
        }
        activeSession.boundToken = requestToken;
      }

      try {
        await activeSession.transport.handleRequest(req, res, req.body);
      } catch (err: any) {
        console.error(`[MCP] Error handling request for session ${sessionId}:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error handling MCP request' },
            id: null,
          });
        }
      }
      return;
    }

    // 2. New Session Initialization (POST request without Mcp-Session-Id header)
    if (!sessionId && req.method === 'POST') {
      let activeSessionRef: ActiveSession;

      const server = createFixFlowMcpServer(() => activeSessionRef?.boundToken);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          activeSessionRef = {
            sessionId: sid,
            transport,
            server,
            createdAt: Date.now(),
            lastActive: Date.now(),
            boundToken: requestToken,
          };
          sessions.set(sid, activeSessionRef);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          sessions.delete(sid);
        }
      };

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err: any) {
        console.error('[MCP] Error initializing new session:', err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error initializing MCP session' },
            id: null,
          });
        }
      }
      return;
    }

    // 3. Stale, expired, or invalid session ID
    if (sessionId && !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: `MCP Session '${sessionId}' not found or expired.` },
        id: null,
      });
      return;
    }

    // 4. Invalid invocation (e.g. GET without session ID)
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid MCP request: missing session ID or invalid HTTP method.' },
      id: null,
    });
  });

  return { app, sessions, createFixFlowMcpServer, cleanupInterval };
}
