export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

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
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairCase {
  id: string;
  appliance_id: string;
  appliance_name?: string;
  issue_description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'diagnosed' | 'scheduled' | 'in_progress' | 'resolved' | 'closed';
  appointment_date: string | null;
  appointment_notes: string | null;
  resolution_notes: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
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

export interface RepairPassport {
  appliance: Appliance;
  cases: RepairCase[];
  events: RepairEvent[];
  documents: WarrantyDocument[];
}

export interface WarrantyStatusReport {
  appliance_id: string;
  appliance_name: string;
  brand: string;
  model: string;
  serial_number: string | null;
  status: 'active' | 'expired' | 'unregistered';
  is_active: boolean;
  purchase_date: string | null;
  expiration_date: string | null;
  days_remaining: number | null;
  warranty_documents: Array<{
    id: string;
    filename: string;
    original_name: string;
    uploaded_at: string;
  }>;
}
