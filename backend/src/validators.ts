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

export type CreateApplianceInput = z.infer<typeof createApplianceSchema>;
export type CreateRepairCaseInput = z.infer<typeof createRepairCaseSchema>;
export type UpdateRepairStatusInput = z.infer<typeof updateRepairStatusSchema>;
