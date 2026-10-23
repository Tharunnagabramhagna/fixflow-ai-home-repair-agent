import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FixFlowBackendClient, BackendError } from './backendClient.js';
import { confirmationManager } from './confirmationManager.js';

export type TokenResolver = () => string | undefined;

export function registerFixFlowTools(
  server: McpServer,
  backendClient: FixFlowBackendClient,
  getSessionAuthToken?: TokenResolver
): void {
  function resolveEffectiveToken(toolToken?: string): string | undefined {
    const boundToken = getSessionAuthToken ? getSessionAuthToken() : undefined;

    // Security check: If the connection transport was established with an authenticated Bearer token,
    // do not allow an arbitrary tool call argument to impersonate another token.
    if (boundToken && toolToken && toolToken.trim() !== boundToken.trim()) {
      throw new BackendError(
        'Impersonation attempt detected: tool session_token does not match authenticated connection token.',
        403
      );
    }

    return boundToken || (toolToken && toolToken.trim() ? toolToken.trim() : undefined);
  }

  // 1. search_appliances
  server.registerTool(
    'search_appliances',
    {
      description:
        'Search appliances in FixFlow by query text or category filter. Authenticated users see their registered appliances; guests see FixFlow sample catalog appliances. Useful for locating an appliance before diagnosing or viewing passports.',
      inputSchema: {
        query: z
          .string()
          .max(100)
          .optional()
          .describe('Optional search text matching name, brand, model, serial number, or room/location'),
        category: z
          .string()
          .max(50)
          .optional()
          .describe('Optional category filter (e.g. Kitchen, Laundry, HVAC, Plumbing)'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token. If omitted, uses connection auth or operates in guest mode.'),
      },
    },
    async ({ query, category, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);
        const appliances = await backendClient.searchAppliances(query, category, token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  count: appliances.length,
                  appliances: appliances.map((a) => ({
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
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 2. get_repair_passport
  server.registerTool(
    'get_repair_passport',
    {
      description:
        'Retrieve the complete Digital Repair Passport for an appliance. Returns full specifications, lifetime repair cases, chronological audit events, and uploaded warranty documents.',
      inputSchema: {
        appliance_id: z.string().min(1).describe('The unique UUID of the appliance'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token (required for private owned appliances; sample appliances are accessible in guest mode)'),
      },
    },
    async ({ appliance_id, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);
        const passport = await backendClient.getRepairPassport(appliance_id, token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  appliance: passport.appliance,
                  cases_count: (passport.cases || []).length,
                  events_count: (passport.events || []).length,
                  documents_count: (passport.documents || []).length,
                  passport: {
                    appliance: passport.appliance,
                    cases: passport.cases,
                    events: passport.events,
                    documents: passport.documents,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 3. check_warranty
  server.registerTool(
    'check_warranty',
    {
      description:
        'Evaluate warranty status for an appliance in FixFlow. Computes whether the warranty is currently active or expired, calculates days remaining, and lists associated warranty documentation.',
      inputSchema: {
        appliance_id: z.string().min(1).describe('The unique UUID of the appliance'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token'),
      },
    },
    async ({ appliance_id, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);
        const warrantyReport = await backendClient.checkWarranty(appliance_id, token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  warranty: warrantyReport,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 4. list_repair_cases
  server.registerTool(
    'list_repair_cases',
    {
      description:
        'List repair cases with optional status filter (open, diagnosed, scheduled, in_progress, resolved, closed) or appliance filter. Returns case priority, status, and appliance metadata.',
      inputSchema: {
        status: z
          .enum(['open', 'diagnosed', 'scheduled', 'in_progress', 'resolved', 'closed'])
          .optional()
          .describe('Filter by case status'),
        appliance_id: z.string().optional().describe('Filter cases by specific appliance UUID'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token'),
      },
    },
    async ({ status, appliance_id, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);
        const cases = await backendClient.listRepairCases({ status, appliance_id }, token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  count: cases.length,
                  cases,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 5. get_repair_case
  server.registerTool(
    'get_repair_case',
    {
      description:
        'Get detailed information for a specific repair case including its diagnostic description, current lifecycle status, scheduled appointment information, and chronological event audit log.',
      inputSchema: {
        case_id: z.string().min(1).describe('The unique UUID of the repair case'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token'),
      },
    },
    async ({ case_id, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);
        const repairCase = await backendClient.getRepairCase(case_id, token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  repair_case: repairCase,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 6. create_repair_case
  server.registerTool(
    'create_repair_case',
    {
      description:
        'Submit a diagnostic fault report and create a new repair case for an appliance. SAFETY REQUIREMENT: Consequential action requiring authentication and two-step confirmation. Step 1 (no confirmation_token): returns a human-readable proposal and short-lived confirmation_token. Step 2 (with confirmation_token): executes the approved case creation.',
      inputSchema: {
        appliance_id: z.string().min(1).describe('The unique UUID of the appliance'),
        issue_description: z
          .string()
          .min(10, 'Issue description must be at least 10 characters')
          .max(2000, 'Issue description must not exceed 2000 characters')
          .describe('Detailed description of the fault or malfunction (minimum 10 characters)'),
        priority: z
          .enum(['low', 'medium', 'high', 'urgent'])
          .default('medium')
          .describe('Priority assessment of the issue (low, medium, high, urgent)'),
        confirmation_token: z
          .string()
          .optional()
          .describe('Single-use confirmation token obtained from Step 1 after user approval. Omit this argument on initial call to generate a proposal.'),
        allow_duplicate: z
          .boolean()
          .optional()
          .describe('Set to true to bypass duplicate-case detection if a similar active case already exists on this appliance'),
        appointment_date: z
          .string()
          .optional()
          .describe('Optional preferred appointment date (YYYY-MM-DD)'),
        appointment_notes: z
          .string()
          .max(500)
          .optional()
          .describe('Optional scheduling notes or access instructions'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token (required; guest users cannot create repair cases)'),
      },
    },
    async ({
      appliance_id,
      issue_description,
      priority,
      confirmation_token,
      allow_duplicate,
      appointment_date,
      appointment_notes,
      session_token,
    }) => {
      try {
        const token = resolveEffectiveToken(session_token);

        // 1. Enforce Authentication Context
        if (!token) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 401,
                    message:
                      'Authentication required: Guest users cannot create repair cases. Please sign in or provide a valid session token.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const session = await backendClient.getSession(token);
        if (!session.authenticated || !session.user) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 401,
                    message: 'Session expired or invalid. Please sign in.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 2. Validate Target Appliance Existence & Ownership
        const appliance = await backendClient.getAppliance(appliance_id, token);
        if (!appliance) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 404,
                    message: 'Appliance not found',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (
          appliance.user_id &&
          appliance.user_id !== 'sample' &&
          appliance.user_id !== session.user.id
        ) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 403,
                    message: 'Access denied: You cannot create a repair case for an appliance you do not own.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const canonicalArgs = {
          appliance_id,
          issue_description,
          priority: priority || 'medium',
          appointment_date: appointment_date || null,
          appointment_notes: appointment_notes || null,
        };

        // 3. Step 1: If no confirmation token provided, prepare proposal and generate short-lived confirmation token
        if (!confirmation_token || !confirmation_token.trim()) {
          const proposalDetails = {
            appliance_id,
            appliance_name: appliance.name,
            brand: appliance.brand,
            model: appliance.model,
            serial_number: appliance.serial_number,
            issue_description,
            priority: priority || 'medium',
            appointment_date: appointment_date || null,
            appointment_notes: appointment_notes || null,
          };

          const proposal = confirmationManager.createProposal({
            action: 'create_repair_case',
            userId: session.user.id,
            applianceId: appliance_id,
            arguments: canonicalArgs,
            details: proposalDetails,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'confirmation_required',
                    action: 'create_repair_case',
                    message:
                      'Explicit user confirmation required. Please present this proposed repair case to the user for approval.',
                    proposal: proposalDetails,
                    confirmation_token: proposal.token,
                    expires_in_seconds: proposal.expiresInSeconds,
                    instruction:
                      `Present the details to the homeowner. Once approved, call create_repair_case with confirmation_token: '${proposal.token}'.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 4. Step 2: Validate and Consume Confirmation Token
        const verification = confirmationManager.verifyAndConsume({
          token: confirmation_token.trim(),
          action: 'create_repair_case',
          userId: session.user.id,
          applianceId: appliance_id,
          arguments: canonicalArgs,
        });

        if (!verification.valid) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 400,
                    error_type: 'confirmation_failed',
                    message: verification.reason || 'Invalid confirmation token.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 5. Duplicate Prevention Guard
        if (!allow_duplicate) {
          try {
            const existingCases = await backendClient.listRepairCases(
              { appliance_id },
              token
            );
            const activeCases = existingCases.filter((c) =>
              ['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)
            );

            const duplicate = activeCases.find(
              (c) =>
                c.issue_description.trim().toLowerCase() ===
                issue_description.trim().toLowerCase()
            );

            if (duplicate) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        status: 'potential_duplicate_detected',
                        message:
                          'An active repair case with an identical description already exists for this appliance. To prevent accidental duplicates, case creation was paused.',
                        existing_case: {
                          id: duplicate.id,
                          status: duplicate.status,
                          priority: duplicate.priority,
                          created_at: duplicate.created_at,
                        },
                        resolution:
                          "If you still wish to open an additional case, re-prepare with allow_duplicate: true and confirm.",
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          } catch {
            // Non-fatal duplicate query fallback
          }
        }

        // 6. Execute Creation via Authenticated Backend API
        const createdCase = await backendClient.createRepairCase(
          {
            appliance_id,
            issue_description,
            priority: priority || 'medium',
            appointment_date,
            appointment_notes,
          },
          token
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Repair case ${createdCase.id} successfully created with status 'open'.`,
                  case: createdCase,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );

  // 7. add_repair_note
  server.registerTool(
    'add_repair_note',
    {
      description:
        'Append a progress note, diagnostic update, or troubleshooting observation to an existing repair case. SAFETY REQUIREMENT: Consequential action requiring authentication and two-step confirmation. Step 1 (no confirmation_token): returns proposal and single-use token. Step 2 (with confirmation_token): records the note in the audit trail.',
      inputSchema: {
        case_id: z.string().min(1).describe('The unique UUID of the repair case'),
        note: z
          .string()
          .trim()
          .min(1, 'Note cannot be empty')
          .max(2000, 'Note must not exceed 2000 characters')
          .describe('The diagnostic note or progress update to record'),
        confirmation_token: z
          .string()
          .optional()
          .describe('Single-use confirmation token obtained from Step 1. Omit on initial call to prepare proposal.'),
        session_token: z
          .string()
          .max(256)
          .optional()
          .describe('FixFlow homeowner session token (required; guest users cannot append notes)'),
      },
    },
    async ({ case_id, note, confirmation_token, session_token }) => {
      try {
        const token = resolveEffectiveToken(session_token);

        // 1. Enforce Authentication Context
        if (!token) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 401,
                    message:
                      'Authentication required: Guest users cannot add repair notes. Please sign in or provide a valid session token.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const session = await backendClient.getSession(token);
        if (!session.authenticated || !session.user) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 401,
                    message: 'Session expired or invalid. Please sign in.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 2. Validate Target Case Existence & Ownership
        const existingCase = await backendClient.getRepairCase(case_id, token);
        if (!existingCase) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 404,
                    message: 'Repair case not found',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (
          existingCase.user_id &&
          existingCase.user_id !== 'sample' &&
          existingCase.user_id !== session.user.id
        ) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 403,
                    message: 'Access denied: You cannot add a note to a repair case you do not own.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const canonicalArgs = {
          case_id,
          note: note.trim(),
        };

        // 3. Step 1: If no confirmation token provided, prepare proposal and generate short-lived token
        if (!confirmation_token || !confirmation_token.trim()) {
          const proposalDetails = {
            case_id,
            appliance_id: existingCase.appliance_id,
            appliance_name: existingCase.appliance_name,
            current_status: existingCase.status,
            note: note.trim(),
          };

          const proposal = confirmationManager.createProposal({
            action: 'add_repair_note',
            userId: session.user.id,
            caseId: case_id,
            arguments: canonicalArgs,
            details: proposalDetails,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'confirmation_required',
                    action: 'add_repair_note',
                    message:
                      'Explicit user confirmation required before appending note to the audit trail.',
                    proposal: proposalDetails,
                    confirmation_token: proposal.token,
                    expires_in_seconds: proposal.expiresInSeconds,
                    instruction:
                      `Present the note to the homeowner. Once approved, call add_repair_note with confirmation_token: '${proposal.token}'.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 4. Step 2: Validate and Consume Confirmation Token
        const verification = confirmationManager.verifyAndConsume({
          token: confirmation_token.trim(),
          action: 'add_repair_note',
          userId: session.user.id,
          caseId: case_id,
          arguments: canonicalArgs,
        });

        if (!verification.valid) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    statusCode: 400,
                    error_type: 'confirmation_failed',
                    message: verification.reason || 'Invalid confirmation token.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 5. Execute Note Addition via Authenticated Backend API
        const updatedCase = await backendClient.addRepairNote(case_id, note.trim(), token);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Note successfully added to repair case ${case_id}.`,
                  case: updatedCase,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return formatErrorResult(err);
      }
    }
  );
}

function formatErrorResult(err: any) {
  const statusCode = err instanceof BackendError ? err.statusCode : 500;
  // Sanitize message: never reveal file paths, credentials, or internal stacks
  let message = err.message || 'Internal server error';
  if (message.includes('C:\\') || message.includes('/')) {
    message = 'An unexpected internal error occurred.';
  }

  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            status: 'error',
            statusCode,
            message,
            details: err.details,
          },
          null,
          2
        ),
      },
    ],
  };
}
