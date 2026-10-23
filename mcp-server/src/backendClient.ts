import type {
  AuthUser,
  Appliance,
  RepairCase,
  RepairPassport,
  WarrantyStatusReport,
} from './types.js';

export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export class FixFlowBackendClient {
  constructor(private baseUrl: string) {}

  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token && token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const headers = {
      ...this.getHeaders(token),
      ...(options.headers as Record<string, string> || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new BackendError(
        `Failed to communicate with FixFlow backend at ${this.baseUrl}: ${err.message || 'Network error'}`,
        503
      );
    }

    let body: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      const text = await response.text();
      body = { error: text };
    }

    if (!response.ok) {
      const errorMessage =
        body?.error ||
        body?.message ||
        `Backend request failed with HTTP ${response.status} ${response.statusText}`;
      throw new BackendError(errorMessage, response.status, body?.details);
    }

    return body?.data !== undefined ? body.data : body;
  }

  async getSession(token?: string): Promise<{ authenticated: boolean; user: AuthUser | null }> {
    if (!token || !token.trim()) {
      return { authenticated: false, user: null };
    }
    try {
      return await this.request<{ authenticated: boolean; user: AuthUser | null }>(
        '/api/auth/session',
        { method: 'GET' },
        token
      );
    } catch {
      return { authenticated: false, user: null };
    }
  }

  async searchAppliances(
    query?: string,
    category?: string,
    token?: string
  ): Promise<Appliance[]> {
    const appliances = await this.request<Appliance[]>('/api/appliances', { method: 'GET' }, token);

    let filtered = appliances;
    if (category && category.trim()) {
      const catLower = category.trim().toLowerCase();
      filtered = filtered.filter(
        (a) => a.category && a.category.toLowerCase() === catLower
      );
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.brand.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          (a.location && a.location.toLowerCase().includes(q)) ||
          (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q))
      );
    }

    return filtered;
  }

  async getAppliance(id: string, token?: string): Promise<Appliance> {
    return this.request<Appliance>(`/api/appliances/${encodeURIComponent(id)}`, { method: 'GET' }, token);
  }

  async getRepairPassport(applianceId: string, token?: string): Promise<RepairPassport> {
    return this.request<RepairPassport>(
      `/api/appliances/${encodeURIComponent(applianceId)}/history`,
      { method: 'GET' },
      token
    );
  }

  async checkWarranty(applianceId: string, token?: string): Promise<WarrantyStatusReport> {
    const passport = await this.getRepairPassport(applianceId, token);
    const appliance = passport.appliance;

    const expirationStr = appliance.warranty_expiration;
    let isActive = false;
    let status: 'active' | 'expired' | 'unregistered' = 'unregistered';
    let daysRemaining: number | null = null;

    if (expirationStr) {
      const expirationDate = new Date(expirationStr);
      const now = new Date();
      if (!isNaN(expirationDate.getTime())) {
        const diffMs = expirationDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isActive = daysRemaining >= 0;
        status = isActive ? 'active' : 'expired';
      }
    }

    return {
      appliance_id: appliance.id,
      appliance_name: appliance.name,
      brand: appliance.brand,
      model: appliance.model,
      serial_number: appliance.serial_number,
      status,
      is_active: isActive,
      purchase_date: appliance.purchase_date,
      expiration_date: appliance.warranty_expiration,
      days_remaining: daysRemaining,
      warranty_documents: (passport.documents || []).map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        original_name: doc.original_name,
        uploaded_at: doc.uploaded_at,
      })),
    };
  }

  async listRepairCases(
    filters?: { status?: string; appliance_id?: string },
    token?: string
  ): Promise<RepairCase[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.appliance_id) params.set('appliance_id', filters.appliance_id);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<RepairCase[]>(`/api/repairs${qs}`, { method: 'GET' }, token);
  }

  async getRepairCase(caseId: string, token?: string): Promise<RepairCase> {
    return this.request<RepairCase>(`/api/repairs/${encodeURIComponent(caseId)}`, { method: 'GET' }, token);
  }

  async createRepairCase(
    input: {
      appliance_id: string;
      issue_description: string;
      priority?: string;
      appointment_date?: string;
      appointment_notes?: string;
    },
    token?: string
  ): Promise<RepairCase> {
    return this.request<RepairCase>(
      '/api/repairs',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      token
    );
  }

  async addRepairNote(caseId: string, note: string, token?: string): Promise<RepairCase> {
    return this.request<RepairCase>(
      `/api/repairs/${encodeURIComponent(caseId)}/notes`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      },
      token
    );
  }
}
