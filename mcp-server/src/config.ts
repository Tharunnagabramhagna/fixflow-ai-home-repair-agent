import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  host: string;
  port: number;
  backendUrl: string;
  mcpPath: string;
  serverName: string;
  serverVersion: string;
  nodeEnv: string;
}

export const config: ServerConfig = {
  host: process.env.MCP_HOST || '127.0.0.1',
  port: parseInt(process.env.MCP_PORT || '3002', 10),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  mcpPath: process.env.MCP_PATH || '/mcp',
  serverName: 'fixflow-mcp-server',
  serverVersion: '1.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
};
