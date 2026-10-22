import type {
  Appliance,
  RepairCase,
  DashboardSummary,
  CreateApplianceData,
  CreateRepairCaseData,
  UpdateRepairStatusData,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const body = await response.json();

  if (!response.ok) {
    const errorMsg = body?.error || `HTTP error ${response.status}`;
    const details = body?.details ? ` (${body.details.map((d: any) => d.message).join(', ')})` : '';
    throw new Error(`${errorMsg}${details}`);
  }

  return body.data !== undefined ? body.data : body;
}

export const api = {
  // Health
  getHealth: () => fetchJson<{ status: string; service: string; version: string; timestamp: string }>(`${API_BASE}/health`),

  // Dashboard
  getDashboardSummary: () => fetchJson<DashboardSummary>(`${API_BASE}/dashboard/summary`),

  // Appliances
  getAppliances: () => fetchJson<Appliance[]>(`${API_BASE}/appliances`),
  getAppliance: (id: string) => fetchJson<Appliance>(`${API_BASE}/appliances/${id}`),
  createAppliance: (data: CreateApplianceData) =>
    fetchJson<Appliance>(`${API_BASE}/appliances`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getApplianceHistory: (id: string) =>
    fetchJson<{ appliance: Appliance; cases: RepairCase[]; events: any[] }>(`${API_BASE}/appliances/${id}/history`),

  // Repairs
  getRepairs: (filters?: { status?: string; appliance_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.appliance_id) params.set('appliance_id', filters.appliance_id);
    const qs = params.toString();
    return fetchJson<RepairCase[]>(`${API_BASE}/repairs${qs ? `?${qs}` : ''}`);
  },
  getRepair: (id: string) => fetchJson<RepairCase>(`${API_BASE}/repairs/${id}`),
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
};
