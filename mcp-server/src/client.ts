import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface FixFlowClientOptions {
  serverUrl: string | URL;
  clientName?: string;
  clientVersion?: string;
  sessionToken?: string;
}

export class FixFlowMcpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private serverUrl: URL;
  private sessionToken?: string;

  constructor(options: FixFlowClientOptions) {
    this.serverUrl = typeof options.serverUrl === 'string' ? new URL(options.serverUrl) : options.serverUrl;
    this.sessionToken = options.sessionToken;

    const headers: Record<string, string> = {};
    if (this.sessionToken) {
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }

    this.transport = new StreamableHTTPClientTransport(this.serverUrl, {
      requestInit: { headers },
    });

    this.client = new Client({
      name: options.clientName || 'fixflow-mcp-client',
      version: options.clientVersion || '1.0.0',
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  get sessionId(): string | undefined {
    return this.transport.sessionId;
  }

  async listTools() {
    return this.client.listTools();
  }

  async callTool(name: string, args: Record<string, any> = {}) {
    // If a session token is set on the client and not in args, pass it
    const callArgs = { ...args };
    if (this.sessionToken && !callArgs.session_token) {
      callArgs.session_token = this.sessionToken;
    }

    const result = await this.client.callTool({
      name,
      arguments: callArgs,
    });

    return result;
  }

  // Convenience helper to parse JSON content from tool call
  parseResult(result: any): any {
    if (result && Array.isArray(result.content) && result.content.length > 0) {
      const first = result.content[0];
      if (first.type === 'text' && first.text) {
        try {
          return JSON.parse(first.text);
        } catch {
          return first.text;
        }
      }
    }
    return result;
  }

  async searchAppliances(params: { query?: string; category?: string; session_token?: string } = {}) {
    const result = await this.callTool('search_appliances', params);
    return this.parseResult(result);
  }

  async getRepairPassport(params: { appliance_id: string; session_token?: string }) {
    const result = await this.callTool('get_repair_passport', params);
    return this.parseResult(result);
  }

  async checkWarranty(params: { appliance_id: string; session_token?: string }) {
    const result = await this.callTool('check_warranty', params);
    return this.parseResult(result);
  }

  async listRepairCases(params: { status?: any; appliance_id?: string; session_token?: string } = {}) {
    const result = await this.callTool('list_repair_cases', params);
    return this.parseResult(result);
  }

  async getRepairCase(params: { case_id: string; session_token?: string }) {
    const result = await this.callTool('get_repair_case', params);
    return this.parseResult(result);
  }

  async createRepairCase(params: {
    appliance_id: string;
    issue_description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    confirmation_token?: string;
    allow_duplicate?: boolean;
    appointment_date?: string;
    appointment_notes?: string;
    session_token?: string;
  }) {
    const result = await this.callTool('create_repair_case', params);
    return {
      raw: result,
      parsed: this.parseResult(result),
      isError: result.isError,
    };
  }

  async addRepairNote(params: {
    case_id: string;
    note: string;
    confirmation_token?: string;
    session_token?: string;
  }) {
    const result = await this.callTool('add_repair_note', params);
    return {
      raw: result,
      parsed: this.parseResult(result),
      isError: result.isError,
    };
  }
}
