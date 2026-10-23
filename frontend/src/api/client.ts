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
  AnalyzeInspectionInput,
  ApplyInspectionInput,
  VisualInspectionDetail,
} from '../types';

// Determine API base path:
// In production builds (import.meta.env.PROD), always use the same-origin '/api' path
// so all requests route through the Vercel edge rewrite proxy (protecting session cookies
// and avoiding cross-origin issues).
// In development, allow VITE_API_BASE_URL or VITE_API_URL override if explicitly set,
// otherwise default to same-origin '/api' (handled by the Vite dev server proxy).
const isProduction = Boolean((import.meta as any).env?.PROD);
const envUrl = !isProduction
  ? ((import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL)
  : undefined;
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

  // Contractor Dispatch Simulation & SSE (Phase 4)
  getDispatch: (caseId: string) =>
    fetchJson<any>(`${API_BASE}/repairs/${caseId}/dispatch`),

  initiateDispatch: (caseId: string, notes?: string) =>
    fetchJson<any>(`${API_BASE}/repairs/${caseId}/dispatch/initiate`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  advanceDispatch: (caseId: string, targetStatus?: string, message?: string) =>
    fetchJson<any>(`${API_BASE}/repairs/${caseId}/dispatch/advance`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, message }),
    }),

  cancelDispatch: (caseId: string, reason?: string) =>
    fetchJson<any>(`${API_BASE}/repairs/${caseId}/dispatch/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Alexa Voice Integration Simulation (Phase 4)
  sendAlexaRequest: (envelope: any) =>
    fetchJson<any>(`${API_BASE}/alexa`, {
      method: 'POST',
      body: JSON.stringify(envelope),
    }),

  getAlexaDiscovery: () =>
    fetchJson<any>(`${API_BASE}/alexa`),

  // Multimodal AI Diagnostics & Visual Inspection (Phase 5)
  analyzeInspection: (input: AnalyzeInspectionInput) =>
    fetchJson<{ data: VisualInspectionDetail }>(`${API_BASE}/inspections/analyze`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getInspections: (filter?: { appliance_id?: string; case_id?: string }) => {
    const params = new URLSearchParams();
    if (filter?.appliance_id) params.append('appliance_id', filter.appliance_id);
    if (filter?.case_id) params.append('case_id', filter.case_id);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<{ data: VisualInspectionDetail[] }>(`${API_BASE}/inspections${qs}`);
  },

  getInspection: (id: string) =>
    fetchJson<{ data: VisualInspectionDetail }>(`${API_BASE}/inspections/${id}`),

  getInspectionImageUrl: (id: string) =>
    `${API_BASE}/inspections/${id}/image`,

  deleteInspection: (id: string) =>
    fetchJson<{ success: boolean; message: string }>(`${API_BASE}/inspections/${id}`, {
      method: 'DELETE',
    }),

  applyInspection: (id: string, input: ApplyInspectionInput) =>
    fetchJson<any>(`${API_BASE}/inspections/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
