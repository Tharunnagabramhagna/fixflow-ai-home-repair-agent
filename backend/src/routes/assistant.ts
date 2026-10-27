import { Router, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { assistantService, ChatMessage } from '../services/llmService';
import { executeMcpTool, MCP_TOOLS } from '../services/mcpToolService';
import { aiChatRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().max(10000),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
});

const assistantChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required'),
  applianceId: z.string().optional(),
});

const assistantConfirmRequestSchema = z.object({
  token: z.string().min(1, 'confirmation token is required'),
  action: z.enum(['create_repair_case', 'add_repair_note']),
  arguments: z.record(z.string(), z.any()),
});

// Handler for conversational diagnostics and tool calling
const handleChat = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = assistantChatRequestSchema.parse(req.body);

    const userContext = {
      id: req.user?.id || null,
      name: req.user?.name,
      email: req.user?.email,
      isGuest: !req.user,
    };

    const response = await assistantService.chat({
      messages: input.messages as ChatMessage[],
      user: userContext,
      applianceId: input.applianceId,
    });

    res.json({ data: response });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    next(err);
  }
};

// POST /api/assistant/chat & POST /api/assistant (alias)
router.post('/chat', aiChatRateLimiter, handleChat);
router.post('/', aiChatRateLimiter, handleChat);

// POST /api/assistant/confirm — Explicit homeowner confirmation execution
router.post('/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = assistantConfirmRequestSchema.parse(req.body);

    if (!req.user || !req.user.id) {
      res.status(401).json({
        error: 'Authentication required: Guest users cannot confirm repair ticket creation.',
      });
      return;
    }

    const userContext = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      isGuest: false,
    };

    const result = await executeMcpTool(
      input.action,
      {
        ...input.arguments,
        confirmation_token: input.token,
      },
      userContext
    );

    if (result.status === 'error') {
      res.status(result.statusCode || 400).json({
        error: result.error || 'Confirmation execution failed.',
      });
      return;
    }

    res.json({
      data: {
        status: 'success',
        action: input.action,
        result: result.data,
      },
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: (err.issues || []).map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }
    next(err);
  }
});

// GET /api/assistant/config — Assistant discovery and active provider status
router.get('/config', (_req: AuthenticatedRequest, res: Response) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const provider = process.env.LLM_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'simulator');

  res.json({
    data: {
      provider,
      hasApiKey: hasKey,
      toolsAvailable: MCP_TOOLS.map((t) => t.name),
      streamableHttpMcp: 'http://127.0.0.1:3002/mcp',
      safetyFeatures: ['electrical_hazard_interceptor', 'gas_leak_evacuation_alert', 'two_step_mutation_confirmation'],
    },
  });
});

export default router;
