import type {
  Appliance,
  RepairCase,
  DashboardSummary,
  CreateApplianceData,
  CreateRepairCaseData,
  UpdateRepairStatusData,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from '../types';

const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
const API_BASE = envUrl
  ? (envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`)
  : '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (networkError: any) {
    console.error('[FixFlow Client Network Error]', networkError);
    throw new Error(
      'Unable to connect to the FixFlow server. Please check your connection or ensure the API service is active.'
    );
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status} (${response.statusText || 'Error'})`);
    }
    throw new Error('Received unexpected non-JSON response from server.');
  }

  if (!response.ok) {
    const errorMsg = body?.error || `HTTP error ${response.status}`;
    const details = body?.details ? ` (${body.details.map((d: any) => d.message).join(', ')})` : '';
    throw new Error(`${errorMsg}${details}`);
  }

  return body.data !== undefined ? body.data : body;
}

export const api = {
  // Authentication & Session
  getSession: () =>
    fetchJson<{ authenticated: boolean; user: AuthUser | null; expires_at?: string }>(`${API_BASE}/auth/session`),

  register: (credentials: RegisterCredentials) =>
    fetchJson<{ authenticated: boolean; user: AuthUser; token?: string; message?: string }>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  login: (credentials: LoginCredentials) =>
    fetchJson<{ authenticated: boolean; user: AuthUser; token?: string; message?: string }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    fetchJson<{ authenticated: boolean; message: string }>(`${API_BASE}/auth/logout`, {
      method: 'POST',
    }),

  // Health
  getHealth: () =>
    fetchJson<{ status: string; service: string; version: string; timestamp: string }>(`${API_BASE}/health`),

  // Dashboard
  getDashboardSummary: () =>
    fetchJson<DashboardSummary>(`${API_BASE}/dashboard/summary`),

  // Appliances
  getAppliances: () =>
    fetchJson<Appliance[]>(`${API_BASE}/appliances`),

  getAppliance: (id: string) =>
    fetchJson<Appliance>(`${API_BASE}/appliances/${id}`),

  createAppliance: (data: CreateApplianceData) =>
    fetchJson<Appliance>(`${API_BASE}/appliances`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getApplianceHistory: (id: string) =>
    fetchJson<{ appliance: Appliance; cases: RepairCase[]; events: any[]; documents: any[] }>(`${API_BASE}/appliances/${id}/history`),

  // Repairs
  getRepairs: (filters?: { status?: string; appliance_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.appliance_id) params.set('appliance_id', filters.appliance_id);
    const qs = params.toString();
    return fetchJson<RepairCase[]>(`${API_BASE}/repairs${qs ? `?${qs}` : ''}`);
  },

  getRepair: (id: string) =>
    fetchJson<RepairCase>(`${API_BASE}/repairs/${id}`),

  createRepair: (data: CreateRepairCaseData) =>
    fetchJson<RepairCase>(`${API_BASE}/repairs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRepairStatus: (id: string, data: UpdateRepairStatusData) =>
    fetchJson<RepairCase>(`${API_BASE}/repairs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // AI Repair Assistant (Phase 3)
  sendAssistantMessage: (
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    applianceId?: string
  ) =>
    fetchJson<any>(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages, applianceId }),
    }),

  confirmAssistantAction: (
    token: string,
    action: string,
    args: Record<string, any>
  ) =>
    fetchJson<any>(`${API_BASE}/assistant/confirm`, {
      method: 'POST',
      body: JSON.stringify({ token, action, arguments: args }),
    }),

  getAssistantConfig: () =>
    fetchJson<any>(`${API_BASE}/assistant/config`),
};
