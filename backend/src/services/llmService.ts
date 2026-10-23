import { MCP_TOOLS, executeMcpTool, ToolExecutionResult, UserContext } from './mcpToolService';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface AssistantChatOptions {
  messages: ChatMessage[];
  user: UserContext;
  applianceId?: string;
  maxIterations?: number;
}

export interface AssistantChatResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  toolsUsed: {
    tool: string;
    args: Record<string, any>;
    status: 'success' | 'confirmation_required' | 'error';
    data?: any;
    error?: string;
  }[];
  pendingConfirmation?: {
    action: string;
    token: string;
    proposal: any;
  } | null;
  safetyAlert?: {
    severity: 'critical' | 'warning';
    title: string;
    message: string;
    actionRequired: string;
  } | null;
  modelInfo: {
    provider: string;
    model: string;
  };
}

export const SYSTEM_INSTRUCTION = `You are FixFlow's AI Home Repair Assistant, an intelligent, safety-first diagnostic companion built to help homeowners troubleshoot household appliances and manage repair cases.

CORE RULES & DIRECTIVES:
1. SAFETY FIRST:
   - If the homeowner describes electrical sparks, smoke, burning odor, gas odor/leak, flame, or electric shock, immediately instruct them to stop using the appliance, unplug it or turn off the breaker/gas supply if safe, and contact emergency services or a certified professional. Never recommend DIY repairs involving open gas lines, internal microwave capacitors, or high-voltage wiring.

2. ASK CLARIFYING QUESTIONS:
   - When a homeowner's description is vague or missing crucial context (e.g. "it makes a weird sound", "it doesn't turn on", "my washer is broken"), ask 1-3 targeted clarifying questions (such as exact noise type, when it occurs in the cycle, whether power lights are on, or any error codes displayed) before proposing solutions.

3. RELY STRICTLY ON VERIFIED RECORDS (NEVER FABRICATE):
   - Always call the provided tools to inspect actual appliance records, Digital Repair Passports, warranty statuses, and repair cases.
   - NEVER invent or assume warranty expiration dates, serial numbers, past repair history, or successful ticket creation.
   - Explicitly cite verified data: "According to your Digital Repair Passport..." or "Based on your verified warranty records...".

4. TWO-STEP HUMAN CONFIRMATION FOR MUTATIONS:
   - You CANNOT create a repair case or add repair notes without explicit homeowner confirmation.
   - Calling 'create_repair_case' without a confirmation_token generates a proposal. Present the proposed ticket details (appliance, issue summary, priority) clearly to the homeowner and ask for their confirmation.
   - Never claim a repair case has been created until the tool returns status 'success' with a valid case ID. Never treat model-generated booleans as user consent.

5. ACCESSIBILITY & OWNERSHIP:
   - Guest users may view sample catalog appliances but cannot view another user's private appliances or create repair cases.
   - Authenticated homeowners have full access to their registered appliances.`;

// Detect critical safety risks in user text
export function detectSafetyHazard(text: string): {
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  actionRequired: string;
} | null {
  const lower = text.toLowerCase();

  const gasKeywords = ['gas leak', 'smell gas', 'smells like gas', 'natural gas odor', 'sulfur smell', 'rotten egg smell'];
  if (gasKeywords.some((k) => lower.includes(k))) {
    return {
      severity: 'critical',
      title: 'CRITICAL SAFETY ALERT: Potential Gas Leak',
      message:
        'A gas odor or suspected leak is extremely hazardous. Do NOT operate light switches, appliances, or open flames, and do not use a phone inside the building.',
      actionRequired:
        'Evacuate the home immediately, leave the door open behind you, shut off the main gas valve if accessible outside, and call your local gas utility emergency hotline or 911 from a safe distance.',
    };
  }

  const electricalKeywords = ['sparking', 'sparks flying', 'smoke coming', 'smoking', 'burning smell', 'burnt wire', 'electric shock', 'shocks me', 'electrical fire'];
  if (electricalKeywords.some((k) => lower.includes(k))) {
    return {
      severity: 'critical',
      title: 'CRITICAL SAFETY ALERT: Electrical / Fire Hazard',
      message:
        'Active sparks, smoke, burning odor, or electrical shock hazards pose immediate risks of fire or electrocution.',
      actionRequired:
        'Turn off the circuit breaker for this appliance immediately at the main electrical panel (or unplug it ONLY if completely safe to do so without touching metal or water). Do not use this appliance. Contact a licensed certified technician or emergency services.',
    };
  }

  return null;
}

// Fallback deterministic AI Simulator when no external API key is configured or during test suites
export async function runSimulatorChat(
  messages: ChatMessage[],
  user: UserContext,
  applianceId?: string
): Promise<{
  content: string;
  toolCalls?: any[];
}> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const lower = lastUserMsg.toLowerCase();

  // 1. Check for missing information / need for clarifying questions
  const isVague =
    lower.length < 25 &&
    (lower.includes('broken') ||
      lower.includes('not working') ||
      lower.includes('making noise') ||
      lower.includes('weird sound') ||
      lower.includes('help me') ||
      lower.includes('trouble'));

  if (isVague && !lower.includes('refrigerator') && !lower.includes('washer') && !lower.includes('dishwasher')) {
    return {
      content:
        "I'd be glad to help troubleshoot! To give you the most accurate advice:\n\n1. Which appliance is having the issue (e.g. Refrigerator, Washer, Dishwasher)?\n2. Exactly what symptoms are you noticing (e.g. loud grinding sound, error code, leaking water, or no power)?\n3. Did this start suddenly or gradually?",
    };
  }

  // 2. Identify if user is asking for warranty status
  if (lower.includes('warranty') || lower.includes('coverage') || lower.includes('under warranty')) {
    let targetId = applianceId;
    if (!targetId) {
      if (lower.includes('fridge') || lower.includes('refrigerator')) targetId = 'demo-app-001';
      else if (lower.includes('washer')) targetId = 'demo-app-002';
      else if (lower.includes('dish')) targetId = 'demo-app-004';
      else if (lower.includes('ac') || lower.includes('condition')) targetId = 'demo-app-003';
    }

    if (targetId) {
      return {
        content: '',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'check_warranty',
              arguments: JSON.stringify({ appliance_id: targetId }),
            },
          },
        ],
      };
    } else {
      return {
        content: '',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'search_appliances',
              arguments: JSON.stringify({ query: 'warranty' }),
            },
          },
        ],
      };
    }
  }

  // 3. Identify if user is asking for repair history / passport
  if (lower.includes('history') || lower.includes('passport') || lower.includes('past repairs') || lower.includes('previous repairs')) {
    let targetId = applianceId;
    if (!targetId) {
      if (lower.includes('fridge') || lower.includes('refrigerator')) targetId = 'demo-app-001';
      else if (lower.includes('washer')) targetId = 'demo-app-002';
      else if (lower.includes('dish')) targetId = 'demo-app-004';
      else targetId = 'demo-app-001';
    }

    return {
      content: '',
      toolCalls: [
        {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'get_repair_passport',
            arguments: JSON.stringify({ appliance_id: targetId }),
          },
        },
      ],
    };
  }

  // 4. Identify if user wants to report a problem or create a repair case
  if (
    lower.includes('report') ||
    lower.includes('schedule') ||
    lower.includes('repair case') ||
    lower.includes('file a ticket') ||
    lower.includes('create ticket') ||
    lower.includes('open a ticket') ||
    lower.includes('send technician') ||
    lower.includes('book technician')
  ) {
    let targetId = applianceId || 'demo-app-001';
    if (lower.includes('washer')) targetId = 'demo-app-002';
    else if (lower.includes('dish')) targetId = 'demo-app-004';

    return {
      content: '',
      toolCalls: [
        {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'create_repair_case',
            arguments: JSON.stringify({
              appliance_id: targetId,
              issue_description: lastUserMsg.length >= 10 ? lastUserMsg : `${lastUserMsg} - requires diagnostics`,
              priority: lower.includes('urgent') || lower.includes('leak') ? 'high' : 'medium',
            }),
          },
        },
      ],
    };
  }

  // 5. Default: If mentioning an appliance, search for it first
  if (
    lower.includes('fridge') ||
    lower.includes('refrigerator') ||
    lower.includes('washer') ||
    lower.includes('dryer') ||
    lower.includes('dishwasher') ||
    lower.includes('oven') ||
    lower.includes('microwave')
  ) {
    const query = lower.includes('fridge') || lower.includes('refrigerator')
      ? 'refrigerator'
      : lower.includes('washer')
      ? 'washer'
      : lower.includes('dish')
      ? 'dishwasher'
      : 'kitchen';

    return {
      content: '',
      toolCalls: [
        {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'search_appliances',
            arguments: JSON.stringify({ query }),
          },
        },
      ],
    };
  }

  // 6. Helpful standard guidance
  return {
    content:
      "I'm here to help diagnose appliance issues, check warranties, review Digital Repair Passports, or prepare repair cases. Could you tell me which appliance is acting up and describe what you're observing?",
  };
}

export class AssistantService {
  private getProviderConfig() {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const providerOverride = process.env.LLM_PROVIDER;

    if (providerOverride === 'simulator') {
      return { provider: 'simulator', model: 'fixflow-deterministic-v1', apiKey: '' };
    }

    if (geminiKey) {
      return {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        apiKey: geminiKey,
        baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
      };
    }

    if (openaiKey) {
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKey: openaiKey,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      };
    }

    if (anthropicKey) {
      return {
        provider: 'anthropic',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        apiKey: anthropicKey,
        baseUrl: 'https://api.anthropic.com/v1',
      };
    }

    return { provider: 'simulator', model: 'fixflow-deterministic-v1', apiKey: '' };
  }

  async chat(options: AssistantChatOptions): Promise<AssistantChatResponse> {
    const { messages, user, applianceId } = options;
    const maxIterations = options.maxIterations || 5;

    const config = this.getProviderConfig();
    const toolsUsed: AssistantChatResponse['toolsUsed'] = [];
    let pendingConfirmation: AssistantChatResponse['pendingConfirmation'] = null;

    // 1. Immediate Safety Check on latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const safetyHazard = detectSafetyHazard(lastUserMsg);

    if (safetyHazard && safetyHazard.severity === 'critical') {
      return {
        message: {
          role: 'assistant',
          content: `🚨 **${safetyHazard.title}**\n\n${safetyHazard.message}\n\n**Action Required Immediately:**\n${safetyHazard.actionRequired}`,
        },
        toolsUsed: [],
        pendingConfirmation: null,
        safetyAlert: safetyHazard,
        modelInfo: { provider: config.provider, model: config.model },
      };
    }

    // 2. Conversation Orchestration Loop
    const workingMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...messages,
    ];

    let currentIteration = 0;
    let finalAssistantReply = '';

    while (currentIteration < maxIterations) {
      currentIteration++;

      let assistantStep: { content: string; toolCalls?: any[] };

      try {
        if (config.provider === 'simulator') {
          // If the last message was a tool result, generate conversational synthesis
          const lastMsg = workingMessages[workingMessages.length - 1];
          if (lastMsg.role === 'tool') {
            const toolData = JSON.parse(lastMsg.content || '{}');
            assistantStep = {
              content: this.synthesizeToolResult(lastMsg.name || '', toolData),
            };
          } else {
            assistantStep = await runSimulatorChat(workingMessages, user, applianceId);
          }
        } else {
          // Live LLM Provider (OpenAI / Gemini OpenAI-Compatible Endpoint)
          assistantStep = await this.callExternalLLM(config, workingMessages);
        }
      } catch (err: any) {
        console.error('[Assistant LLM Error]', err);
        return {
          message: {
            role: 'assistant',
            content: `I encountered an unexpected issue while communicating with the diagnostic AI service (${err.message || 'Connection failure'}). Please try your request again.`,
          },
          toolsUsed,
          pendingConfirmation: null,
          modelInfo: { provider: config.provider, model: config.model },
        };
      }

      // Check if tool calls were requested
      if (assistantStep.toolCalls && assistantStep.toolCalls.length > 0) {
        // Record assistant's tool invocation step
        workingMessages.push({
          role: 'assistant',
          content: assistantStep.content || '',
          tool_calls: assistantStep.toolCalls,
        });

        for (const tc of assistantStep.toolCalls) {
          const fnName = tc.function.name;
          let fnArgs: Record<string, any> = {};
          try {
            fnArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          } catch {
            fnArgs = {};
          }

          // Execute MCP tool via validated service
          const result: ToolExecutionResult = await executeMcpTool(fnName, fnArgs, user);

          toolsUsed.push({
            tool: fnName,
            args: fnArgs,
            status: result.status,
            data: result.data,
            error: result.error,
          });

          // Check if this tool returned a proposal requiring human confirmation
          if (result.status === 'confirmation_required' && result.confirmationToken && result.proposal) {
            pendingConfirmation = {
              action: result.proposal.action || fnName,
              token: result.confirmationToken,
              proposal: result.proposal,
            };
          }

          // Attach tool output back into message stream for next iteration
          workingMessages.push({
            role: 'tool',
            name: fnName,
            tool_call_id: tc.id || `call_${Date.now()}`,
            content: JSON.stringify(result.data || { error: result.error, status: result.status }),
          });
        }
      } else {
        // LLM completed conversational turn
        finalAssistantReply = assistantStep.content;
        break;
      }
    }

    if (!finalAssistantReply && pendingConfirmation) {
      finalAssistantReply = `I've prepared the repair case for your **${pendingConfirmation.proposal.appliance_name || 'appliance'}**. Please review the details in the confirmation card above and confirm to submit the ticket.`;
    } else if (!finalAssistantReply) {
      finalAssistantReply = "I've reviewed your request. What additional details would you like to explore?";
    }

    return {
      message: {
        role: 'assistant',
        content: finalAssistantReply,
      },
      toolsUsed,
      pendingConfirmation,
      safetyAlert: null,
      modelInfo: {
        provider: config.provider,
        model: config.model,
      },
    };
  }

  // Synthesize realistic, verified responses from tool results for simulator
  private synthesizeToolResult(toolName: string, data: any): string {
    if (data.status === 'confirmation_required') {
      const p = data.proposal || {};
      return `I've prepared a repair ticket proposal for your **${p.appliance_name || 'appliance'}** (${p.brand || ''} ${p.model || ''}):\n\n- **Issue:** ${p.issue_description || 'Fault diagnosed'}\n- **Priority:** ${p.priority || 'medium'}\n\nPlease click **Confirm & Submit Ticket** in the card below to approve this action.`;
    }

    if (data.status === 'error' || data.error) {
      return `I wasn't able to complete that operation: ${data.error || 'Access denied or record not found.'}`;
    }

    if (toolName === 'check_warranty') {
      const w = data;
      const statusText = w.is_active
        ? `✅ **Active Warranty**: Valid until **${w.warranty_expiration}** (${w.days_remaining} days remaining).`
        : `⚠️ **Expired Warranty**: Coverage expired on **${w.warranty_expiration}**.`;

      const docsText =
        w.warranty_documents && w.warranty_documents.length > 0
          ? `\n\n📄 **Attached Documentation:** ${w.warranty_documents.map((d: any) => d.original_name).join(', ')}.`
          : '';

      return `Here is the verified warranty status for your **${w.appliance_name}** (${w.brand} ${w.model}):\n\n${statusText}${docsText}\n\nWould you like troubleshooting steps or would you like to prepare a repair service request?`;
    }

    if (toolName === 'get_repair_passport') {
      const p = data;
      const app = p.appliance || {};
      const cases = p.cases || p.passport?.cases || [];
      const casesSummary =
        cases.length > 0
          ? cases.map((c: any) => `- **Case #${c.id.substring(0, 8)}**: ${c.issue_description} (Status: \`${c.status}\`)`).join('\n')
          : 'No past repair cases recorded.';

      return `Here is the **Digital Repair Passport** for your **${app.name}** (${app.brand} ${app.model}, S/N: \`${app.serial_number || 'N/A'}\`):\n\n**Repair History (${cases.length} cases):**\n${casesSummary}\n\n**Warranty Expiration:** ${app.warranty_expiration || 'Not specified'}`;
    }

    if (toolName === 'search_appliances') {
      const apps = data.appliances || [];
      if (apps.length === 0) {
        return "I searched your registered household appliances but didn't find any matches. You can register an appliance using the '+ Register Appliance' button.";
      }
      const list = apps.map((a: any) => `- **${a.name}** (${a.brand} ${a.model}) in ${a.location || 'Home'}`).join('\n');
      return `I found the following appliances in your household inventory:\n\n${list}\n\nWhich appliance would you like to check?`;
    }

    if (toolName === 'create_repair_case') {
      const rc = data.repair_case;
      return `🎉 **Repair Case Created Successfully!**\n\n- **Case ID:** \`${rc.id}\`\n- **Status:** \`${rc.status}\`\n- **Priority:** \`${rc.priority}\`\n\nYou can track the progress of this ticket under **Repair Cases**.`;
    }

    if (toolName === 'add_repair_note') {
      return '✅ **Diagnostic Note Recorded:** Your note has been securely appended to the repair case audit trail.';
    }

    return JSON.stringify(data, null, 2);
  }

  // Call OpenAI or Gemini OpenAI-compatible endpoint with structured tools
  private async callExternalLLM(
    config: { provider: string; model: string; apiKey: string; baseUrl?: string },
    messages: ChatMessage[]
  ): Promise<{ content: string; toolCalls?: any[] }> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;

    // Map tools to OpenAI format
    const formattedTools = MCP_TOOLS.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => {
          if (m.role === 'tool') {
            return {
              role: 'tool',
              tool_call_id: m.tool_call_id,
              content: m.content,
            };
          }
          if (m.role === 'assistant' && m.tool_calls) {
            return {
              role: 'assistant',
              content: m.content || null,
              tool_calls: m.tool_calls,
            };
          }
          return {
            role: m.role,
            content: m.content,
          };
        }),
        tools: formattedTools,
        tool_choice: 'auto',
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LLM API returned HTTP ${response.status}: ${errBody}`);
    }

    const json = (await response.json()) as any;
    const choice = json.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error('LLM API returned an empty or invalid completion choice.');
    }

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls || undefined,
    };
  }
}

export const assistantService = new AssistantService();
