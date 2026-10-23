import { z } from 'zod';
import * as applianceService from './applianceService';
import * as repairService from './repairService';
import { confirmationManager } from './confirmationManager';

export interface UserContext {
  id: string | null;
  name?: string;
  email?: string;
  isGuest: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// Zod schemas to strictly validate model-generated arguments
export const toolArgumentSchemas: Record<string, z.ZodSchema<any>> = {
  search_appliances: z.object({
    query: z.string().max(100).optional(),
    category: z.string().max(50).optional(),
  }),
  get_repair_passport: z.object({
    appliance_id: z.string().min(1, 'appliance_id is required'),
  }),
  check_warranty: z.object({
    appliance_id: z.string().min(1, 'appliance_id is required'),
  }),
  list_repair_cases: z.object({
    status: z.enum(['open', 'diagnosed', 'scheduled', 'in_progress', 'resolved', 'closed']).optional(),
    appliance_id: z.string().optional(),
  }),
  get_repair_case: z.object({
    case_id: z.string().min(1, 'case_id is required'),
  }),
  create_repair_case: z.object({
    appliance_id: z.string().min(1, 'appliance_id is required'),
    issue_description: z.string().min(10, 'issue_description must be at least 10 characters').max(2000),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    appointment_date: z.string().nullable().optional(),
    appointment_notes: z.string().max(500).nullable().optional(),
    confirmation_token: z.string().nullable().optional(),
  }),
  add_repair_note: z.object({
    case_id: z.string().min(1, 'case_id is required'),
    note: z.string().min(5, 'note must be at least 5 characters').max(1000),
    confirmation_token: z.string().optional(),
  }),
};

// Formal tool definitions passed to OpenAI / Gemini / Anthropic structured tool calling
export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: 'search_appliances',
    description:
      'Search registered household appliances by query text (name, brand, model, room) or category. Authenticated users see their registered appliances; guests see sample appliances.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search text matching appliance name, brand, model, serial number, or room/location',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. Kitchen, Laundry, HVAC, Plumbing)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_repair_passport',
    description:
      'Retrieve the complete Digital Repair Passport for an appliance. Returns device specifications, historical repair cases, chronological audit events, and warranty documents.',
    parameters: {
      type: 'object',
      properties: {
        appliance_id: {
          type: 'string',
          description: 'The unique ID/UUID of the appliance',
        },
      },
      required: ['appliance_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_warranty',
    description:
      'Evaluate official warranty status for an appliance. Returns whether warranty is active or expired, expiration date, days remaining, and uploaded warranty documents.',
    parameters: {
      type: 'object',
      properties: {
        appliance_id: {
          type: 'string',
          description: 'The unique ID/UUID of the appliance',
        },
      },
      required: ['appliance_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_repair_cases',
    description:
      'List repair cases with optional status filter (open, diagnosed, scheduled, in_progress, resolved, closed) or appliance ID filter.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'diagnosed', 'scheduled', 'in_progress', 'resolved', 'closed'],
          description: 'Filter by lifecycle status',
        },
        appliance_id: {
          type: 'string',
          description: 'Filter cases by specific appliance ID',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_repair_case',
    description:
      'Get detailed information for a specific repair case including issue description, priority, lifecycle status, scheduled appointments, and audit events.',
    parameters: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The unique ID/UUID of the repair case',
        },
      },
      required: ['case_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_repair_case',
    description:
      'Submit a fault report and create a new repair case. CONSEQUENTIAL ACTION: Requires authentication and two-step human confirmation. Calling without confirmation_token generates a proposal and token. Calling with confirmation_token executes the creation.',
    parameters: {
      type: 'object',
      properties: {
        appliance_id: {
          type: 'string',
          description: 'The unique ID/UUID of the appliance',
        },
        issue_description: {
          type: 'string',
          description: 'Detailed description of the malfunction or issue (minimum 10 characters)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Priority level (default: medium)',
        },
        appointment_date: {
          type: 'string',
          description: 'Optional preferred appointment date (YYYY-MM-DD)',
        },
        appointment_notes: {
          type: 'string',
          description: 'Optional scheduling notes or access instructions',
        },
        confirmation_token: {
          type: 'string',
          description: 'Single-use confirmation token obtained from Step 1 after homeowner approves. Omit on initial proposal.',
        },
      },
      required: ['appliance_id', 'issue_description'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_repair_note',
    description:
      'Append a diagnostic note or technician finding to an existing repair case timeline. CONSEQUENTIAL ACTION: Requires authentication and two-step confirmation.',
    parameters: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The unique ID/UUID of the repair case',
        },
        note: {
          type: 'string',
          description: 'Diagnostic note content (minimum 5 characters)',
        },
        confirmation_token: {
          type: 'string',
          description: 'Single-use confirmation token obtained from Step 1 after homeowner approves. Omit on initial proposal.',
        },
      },
      required: ['case_id', 'note'],
      additionalProperties: false,
    },
  },
];

export interface ToolExecutionResult {
  tool: string;
  status: 'success' | 'confirmation_required' | 'error';
  data?: any;
  error?: string;
  statusCode?: number;
  confirmationToken?: string;
  proposal?: any;
}

export async function executeMcpTool(
  name: string,
  rawArgs: Record<string, any>,
  user: UserContext
): Promise<ToolExecutionResult> {
  // 1. Validate argument schema
  const schema = toolArgumentSchemas[name];
  if (!schema) {
    return {
      tool: name,
      status: 'error',
      statusCode: 400,
      error: `Unknown tool '${name}'`,
    };
  }

  const parseResult = schema.safeParse(rawArgs);
  if (!parseResult.success) {
    return {
      tool: name,
      status: 'error',
      statusCode: 400,
      error: `Invalid arguments for ${name}: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    };
  }

  const args = parseResult.data;

  try {
    switch (name) {
      case 'search_appliances': {
        const appliances = applianceService.getAllAppliances(user.id);
        const filtered = appliances.filter((a) => {
          if (args.category && a.category.toLowerCase() !== args.category.toLowerCase()) {
            return false;
          }
          if (args.query) {
            const q = args.query.toLowerCase();
            const matches =
              a.name.toLowerCase().includes(q) ||
              a.brand.toLowerCase().includes(q) ||
              a.model.toLowerCase().includes(q) ||
              (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
              (a.location && a.location.toLowerCase().includes(q));
            if (!matches) return false;
          }
          return true;
        });

        return {
          tool: name,
          status: 'success',
          data: {
            count: filtered.length,
            appliances: filtered.map((a) => ({
              id: a.id,
              name: a.name,
              category: a.category,
              brand: a.brand,
              model: a.model,
              serial_number: a.serial_number,
              location: a.location,
              warranty_expiration: a.warranty_expiration,
              is_sample: a.user_id === 'sample' || !a.user_id,
            })),
          },
        };
      }

      case 'get_repair_passport': {
        const history = applianceService.getApplianceHistory(args.appliance_id, user.id);
        if (!history) {
          return {
            tool: name,
            status: 'error',
            statusCode: 404,
            error: `Appliance '${args.appliance_id}' not found or access denied.`,
          };
        }

        return {
          tool: name,
          status: 'success',
          data: {
            appliance: history.appliance,
            cases_count: (history.cases || []).length,
            events_count: (history.events || []).length,
            documents_count: (history.documents || []).length,
            passport: history,
          },
        };
      }

      case 'check_warranty': {
        const appliance = applianceService.getApplianceById(args.appliance_id, user.id);
        if (!appliance) {
          return {
            tool: name,
            status: 'error',
            statusCode: 404,
            error: `Appliance '${args.appliance_id}' not found or access denied.`,
          };
        }

        const now = new Date();
        const expDate = appliance.warranty_expiration ? new Date(appliance.warranty_expiration) : null;
        const isActive = expDate ? expDate > now : false;
        const daysRemaining = expDate && isActive ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        const history = applianceService.getApplianceHistory(args.appliance_id, user.id);
        const docs = history?.documents || [];

        return {
          tool: name,
          status: 'success',
          data: {
            appliance_id: appliance.id,
            appliance_name: appliance.name,
            brand: appliance.brand,
            model: appliance.model,
            purchase_date: appliance.purchase_date,
            warranty_expiration: appliance.warranty_expiration,
            is_active: isActive,
            status: isActive ? 'ACTIVE' : 'EXPIRED',
            days_remaining: daysRemaining,
            warranty_documents: docs.map((d: any) => ({
              id: d.id,
              filename: d.filename,
              original_name: d.original_name,
              mime_type: d.mime_type,
            })),
          },
        };
      }

      case 'list_repair_cases': {
        const filters: { status?: string; appliance_id?: string; user_id?: string | null } = {
          user_id: user.id,
        };
        if (args.status) filters.status = args.status;
        if (args.appliance_id) filters.appliance_id = args.appliance_id;

        const cases = repairService.getAllRepairCases(filters);
        return {
          tool: name,
          status: 'success',
          data: {
            count: cases.length,
            cases,
          },
        };
      }

      case 'get_repair_case': {
        const repairCase = repairService.getRepairCaseById(args.case_id, user.id);
        if (!repairCase) {
          return {
            tool: name,
            status: 'error',
            statusCode: 404,
            error: `Repair case '${args.case_id}' not found or access denied.`,
          };
        }

        return {
          tool: name,
          status: 'success',
          data: {
            repair_case: repairCase,
          },
        };
      }

      case 'create_repair_case': {
        // Enforce Authentication
        if (user.isGuest || !user.id) {
          return {
            tool: name,
            status: 'error',
            statusCode: 401,
            error: 'Authentication required: Guest users cannot create repair cases. Please sign in to submit a ticket.',
          };
        }

        // Verify Appliance Existence and Ownership
        const appliance = applianceService.getApplianceById(args.appliance_id, user.id);
        if (!appliance) {
          return {
            tool: name,
            status: 'error',
            statusCode: 404,
            error: `Appliance '${args.appliance_id}' not found or access denied.`,
          };
        }

        if (appliance.user_id && appliance.user_id !== 'sample' && appliance.user_id !== user.id) {
          return {
            tool: name,
            status: 'error',
            statusCode: 403,
            error: 'Access denied: You cannot create a repair case for an appliance you do not own.',
          };
        }

        const canonicalArgs = {
          appliance_id: args.appliance_id,
          issue_description: args.issue_description,
          priority: args.priority || 'medium',
          appointment_date: args.appointment_date || null,
          appointment_notes: args.appointment_notes || null,
        };

        // Step 1: Proposal if confirmation_token is omitted
        if (!args.confirmation_token || !args.confirmation_token.trim()) {
          const proposalDetails = {
            appliance_id: args.appliance_id,
            appliance_name: appliance.name,
            brand: appliance.brand,
            model: appliance.model,
            serial_number: appliance.serial_number,
            issue_description: args.issue_description,
            priority: args.priority || 'medium',
            appointment_date: args.appointment_date || null,
            appointment_notes: args.appointment_notes || null,
          };

          const proposal = confirmationManager.createProposal({
            action: 'create_repair_case',
            userId: user.id,
            applianceId: args.appliance_id,
            arguments: canonicalArgs,
            details: proposalDetails,
          });

          return {
            tool: name,
            status: 'confirmation_required',
            confirmationToken: proposal.token,
            proposal: proposalDetails,
            data: {
              status: 'confirmation_required',
              action: 'create_repair_case',
              message: 'Explicit user confirmation required. Present this proposed ticket to the homeowner for approval.',
              proposal: proposalDetails,
              confirmation_token: proposal.token,
              expires_in_seconds: proposal.expiresInSeconds,
              instruction: `Ask homeowner to confirm. Once confirmed, submit with confirmation_token: '${proposal.token}'.`,
            },
          };
        }

        // Step 2: Verify & consume confirmation token
        const verification = confirmationManager.verifyAndConsume({
          token: args.confirmation_token.trim(),
          action: 'create_repair_case',
          userId: user.id,
          applianceId: args.appliance_id,
          arguments: canonicalArgs,
        });

        if (!verification.valid) {
          return {
            tool: name,
            status: 'error',
            statusCode: 400,
            error: verification.reason || 'Invalid or expired confirmation token.',
          };
        }

        const createdCase = repairService.createRepairCase(
          {
            appliance_id: args.appliance_id,
            issue_description: args.issue_description,
            priority: args.priority || 'medium',
            appointment_date: args.appointment_date,
            appointment_notes: args.appointment_notes,
          },
          user.id
        );

        return {
          tool: name,
          status: 'success',
          data: {
            status: 'success',
            message: 'Repair case successfully created.',
            repair_case: createdCase,
          },
        };
      }

      case 'add_repair_note': {
        // Enforce Authentication
        if (user.isGuest || !user.id) {
          return {
            tool: name,
            status: 'error',
            statusCode: 401,
            error: 'Authentication required: Guest users cannot add repair notes. Please sign in.',
          };
        }

        // Verify Repair Case Existence and Ownership
        const repairCase = repairService.getRepairCaseById(args.case_id, user.id);
        if (!repairCase) {
          return {
            tool: name,
            status: 'error',
            statusCode: 404,
            error: `Repair case '${args.case_id}' not found or access denied.`,
          };
        }

        if (repairCase.user_id && repairCase.user_id !== 'sample' && repairCase.user_id !== user.id) {
          return {
            tool: name,
            status: 'error',
            statusCode: 403,
            error: 'Access denied: You cannot add notes to a repair case you do not own.',
          };
        }

        const canonicalArgs = {
          case_id: args.case_id,
          note: args.note,
        };

        // Step 1: Proposal if confirmation_token is omitted
        if (!args.confirmation_token || !args.confirmation_token.trim()) {
          const proposalDetails = {
            case_id: args.case_id,
            appliance_name: repairCase.appliance_name,
            current_status: repairCase.status,
            note: args.note,
          };

          const proposal = confirmationManager.createProposal({
            action: 'add_repair_note',
            userId: user.id,
            caseId: args.case_id,
            arguments: canonicalArgs,
            details: proposalDetails,
          });

          return {
            tool: name,
            status: 'confirmation_required',
            confirmationToken: proposal.token,
            proposal: proposalDetails,
            data: {
              status: 'confirmation_required',
              action: 'add_repair_note',
              message: 'Explicit user confirmation required. Present this note to the homeowner for approval.',
              proposal: proposalDetails,
              confirmation_token: proposal.token,
              expires_in_seconds: proposal.expiresInSeconds,
              instruction: `Ask homeowner to confirm. Once confirmed, submit with confirmation_token: '${proposal.token}'.`,
            },
          };
        }

        // Step 2: Verify & consume token
        const verification = confirmationManager.verifyAndConsume({
          token: args.confirmation_token.trim(),
          action: 'add_repair_note',
          userId: user.id,
          caseId: args.case_id,
          arguments: canonicalArgs,
        });

        if (!verification.valid) {
          return {
            tool: name,
            status: 'error',
            statusCode: 400,
            error: verification.reason || 'Invalid or expired confirmation token.',
          };
        }

        const event = repairService.addRepairNote(args.case_id, args.note, user.id);
        return {
          tool: name,
          status: 'success',
          data: {
            status: 'success',
            message: 'Repair note successfully appended to case audit trail.',
            event,
          },
        };
      }

      default:
        return {
          tool: name,
          status: 'error',
          statusCode: 400,
          error: `Unhandled tool '${name}'`,
        };
    }
  } catch (err: any) {
    return {
      tool: name,
      status: 'error',
      statusCode: err.status || 500,
      error: err.message || 'Internal tool execution error.',
    };
  }
}
