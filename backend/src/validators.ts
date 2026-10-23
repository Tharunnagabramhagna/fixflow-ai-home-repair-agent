import { z } from 'zod';

export const createApplianceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().min(1, 'Category is required').max(100),
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  serial_number: z.string().max(100).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must be YYYY-MM-DD format').optional(),
  warranty_expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Warranty expiration must be YYYY-MM-DD format').optional(),
  location: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const createRepairCaseSchema = z.object({
  appliance_id: z.string().min(1, 'Appliance ID is required'),
  issue_description: z.string().min(10, 'Issue description must be at least 10 characters').max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  appointment_date: z.string().optional(),
  appointment_notes: z.string().max(500).optional(),
});

export const updateRepairStatusSchema = z.object({
  status: z.enum(['open', 'diagnosed', 'scheduled', 'in_progress', 'resolved', 'closed']),
  resolution_notes: z.string().max(2000).optional(),
  appointment_date: z.string().optional(),
  appointment_notes: z.string().max(500).optional(),
});

export const addRepairNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note must not exceed 2000 characters'),
});

export const initiateDispatchSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const advanceDispatchSchema = z.object({
  targetStatus: z.enum(['pending', 'dispatched', 'en_route', 'arrived', 'completed', 'cancelled']).optional(),
  message: z.string().max(500).optional(),
});

export const cancelDispatchSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const analyzeInspectionSchema = z.object({
  imageBase64: z.string().min(10, 'Image data is required in base64 format'),
  filename: z.string().max(150).optional(),
  mimeType: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  applianceId: z.string().max(100).optional(),
  caseId: z.string().max(100).optional(),
});

export const applyInspectionSchema = z.object({
  confirmationToken: z.string().optional(),
  brand: z.string().max(100).optional(),
  modelNumber: z.string().max(100).optional(),
});

export type CreateApplianceInput = z.infer<typeof createApplianceSchema>;
export type CreateRepairCaseInput = z.infer<typeof createRepairCaseSchema>;
export type UpdateRepairStatusInput = z.infer<typeof updateRepairStatusSchema>;
export type AddRepairNoteInput = z.infer<typeof addRepairNoteSchema>;
export type InitiateDispatchInput = z.infer<typeof initiateDispatchSchema>;
export type AdvanceDispatchInput = z.infer<typeof advanceDispatchSchema>;
export type CancelDispatchInput = z.infer<typeof cancelDispatchSchema>;
export type AnalyzeInspectionInput = z.infer<typeof analyzeInspectionSchema>;
export type ApplyInspectionInput = z.infer<typeof applyInspectionSchema>;

