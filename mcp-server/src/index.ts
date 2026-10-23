import { createMcpApp } from './server.js';
import { config } from './config.js';

const { app } = createMcpApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`FixFlow MCP Server is running on http://${config.host}:${config.port}`);
  console.log(`Streamable HTTP MCP endpoint: http://${config.host}:${config.port}${config.mcpPath}`);
  console.log(`Health check: http://${config.host}:${config.port}/health`);
  console.log(`Connected to FixFlow Backend: ${config.backendUrl}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
