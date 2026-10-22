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
