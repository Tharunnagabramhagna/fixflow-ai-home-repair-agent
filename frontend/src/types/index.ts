export interface Appliance {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_expiration: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairCase {
  id: string;
  appliance_id: string;
  issue_description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'diagnosed' | 'scheduled' | 'in_progress' | 'resolved' | 'closed';
  appointment_date: string | null;
  appointment_notes: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  appliance_name?: string;
  events?: RepairEvent[];
}

export interface RepairEvent {
  id: string;
  case_id: string;
  event_type: 'created' | 'status_change' | 'note_added' | 'appointment_set' | 'resolved' | 'closed';
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  appliance_id?: string;
  appliance_name?: string;
}

export interface WarrantyDocument {
  id: string;
  appliance_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

export interface DashboardSummary {
  counts: {
    total_appliances: number;
    active_repairs?: number;
    open_repairs: number;
    scheduled_visits: number;
    resolved_cases: number;
    total_cases?: number;
  };
  recent_events: RepairEvent[];
  upcoming_appointments: RepairCase[];
}

export interface CreateApplianceData {
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number?: string;
  purchase_date?: string;
  warranty_expiration?: string;
  location?: string;
  notes?: string;
}

export interface CreateRepairCaseData {
  appliance_id: string;
  issue_description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  appointment_date?: string;
  appointment_notes?: string;
}

export interface UpdateRepairStatusData {
  status: 'open' | 'diagnosed' | 'scheduled' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes?: string;
  appointment_date?: string;
  appointment_notes?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'guest' | 'error';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  safetyAlert?: AssistantSafetyAlert | null;
  toolsUsed?: AssistantToolUsed[];
  pendingConfirmation?: AssistantPendingConfirmation | null;
  confirmed?: boolean;
}

export interface AssistantToolUsed {
  tool: string;
  args: Record<string, any>;
  status: 'success' | 'confirmation_required' | 'error';
  data?: any;
  error?: string;
}

export interface AssistantPendingConfirmation {
  action: string;
  token: string;
  proposal: {
    appliance_id?: string;
    appliance_name?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    issue_description?: string;
    priority?: string;
    appointment_date?: string;
    appointment_notes?: string;
    case_id?: string;
    note?: string;
  };
}

export interface AssistantSafetyAlert {
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  actionRequired: string;
}

export interface AssistantChatResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  toolsUsed: AssistantToolUsed[];
  pendingConfirmation?: AssistantPendingConfirmation | null;
  safetyAlert?: AssistantSafetyAlert | null;
  modelInfo: {
    provider: string;
    model: string;
  };
}

export interface AssistantConfig {
  provider: string;
  hasApiKey: boolean;
  toolsAvailable: string[];
  streamableHttpMcp: string;
  safetyFeatures: string[];
}

export type DispatchStatus = 'pending' | 'dispatched' | 'en_route' | 'arrived' | 'completed' | 'cancelled';

export interface DispatchEvent {
  id: string;
  dispatch_id: string;
  case_id: string;
  status: DispatchStatus;
  message: string;
  actor: string;
  created_at: string;
}

export interface ContractorDispatch {
  id: string;
  case_id: string;
  user_id: string;
  contractor_name: string;
  company_name: string;
  phone_number: string;
  vehicle_info: string | null;
  estimated_arrival_minutes: number | null;
  status: DispatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface DispatchDetail extends ContractorDispatch {
  events: DispatchEvent[];
  appliance_name?: string;
  issue_description?: string;
  is_simulated: boolean;
}

