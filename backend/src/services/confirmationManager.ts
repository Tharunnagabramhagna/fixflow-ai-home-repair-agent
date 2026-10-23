import crypto from 'crypto';

export interface PendingConfirmation {
  token: string;
  action: 'create_repair_case' | 'add_repair_note';
  userId: string;
  applianceId?: string;
  caseId?: string;
  argumentsHash: string;
  details: Record<string, any>;
  createdAt: number;
  expiresAt: number;
}

export interface CreateProposalOptions {
  action: 'create_repair_case' | 'add_repair_note';
  userId: string;
  applianceId?: string;
  caseId?: string;
  arguments: Record<string, any>;
  details: Record<string, any>;
  ttlMs?: number;
}

export interface VerifyProposalOptions {
  token: string;
  action: 'create_repair_case' | 'add_repair_note';
  userId: string;
  applianceId?: string;
  caseId?: string;
  arguments: Record<string, any>;
}

export class ConfirmationManager {
  private confirmations = new Map<string, PendingConfirmation>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private defaultTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired();
    }, 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private computeArgumentsHash(args: Record<string, any>): string {
    const sortedKeys = Object.keys(args).sort();
    const normalized: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (key !== 'confirmation_token' && key !== 'session_token' && key !== 'confirmed') {
        const val = args[key];
        normalized[key] = typeof val === 'string' ? val.trim() : val;
      }
    }
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  createProposal(options: CreateProposalOptions): { token: string; expiresAt: number; expiresInSeconds: number } {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const token = `cfrm_${rawToken}`;
    const now = Date.now();
    const ttlMs = options.ttlMs || this.defaultTtlMs;
    const expiresAt = now + ttlMs;

    const pending: PendingConfirmation = {
      token,
      action: options.action,
      userId: options.userId,
      applianceId: options.applianceId,
      caseId: options.caseId,
      argumentsHash: this.computeArgumentsHash(options.arguments),
      details: options.details,
      createdAt: now,
      expiresAt,
    };

    this.confirmations.set(token, pending);

    return {
      token,
      expiresAt,
      expiresInSeconds: Math.floor(ttlMs / 1000),
    };
  }

  verifyAndConsume(options: VerifyProposalOptions): { valid: boolean; reason?: string } {
    const { token, action, userId, applianceId, caseId, arguments: args } = options;

    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Confirmation token is missing.' };
    }

    const pending = this.confirmations.get(token);
    if (!pending) {
      return {
        valid: false,
        reason: 'Confirmation token not found, already consumed, or expired. Please prepare the proposed action again to generate a new confirmation token.',
      };
    }

    if (Date.now() > pending.expiresAt) {
      this.confirmations.delete(token);
      return {
        valid: false,
        reason: 'Confirmation token has expired (exceeded 5 minutes validity). Please prepare the proposal again.',
      };
    }

    if (pending.action !== action) {
      return {
        valid: false,
        reason: `Token action mismatch: expected '${pending.action}', received '${action}'.`,
      };
    }

    if (pending.userId !== userId) {
      return {
        valid: false,
        reason: 'Confirmation token ownership mismatch. Tokens are bound strictly to the proposing user account.',
      };
    }

    if (applianceId && pending.applianceId && pending.applianceId !== applianceId) {
      return {
        valid: false,
        reason: 'Confirmation token appliance binding mismatch.',
      };
    }

    if (caseId && pending.caseId && pending.caseId !== caseId) {
      return {
        valid: false,
        reason: 'Confirmation token repair case binding mismatch.',
      };
    }

    const incomingHash = this.computeArgumentsHash(args);
    if (incomingHash !== pending.argumentsHash) {
      return {
        valid: false,
        reason: 'Confirmation rejected: Action arguments have been modified since user approval was granted. Please generate a new proposal.',
      };
    }

    // Single-use: Consume immediately on successful validation
    this.confirmations.delete(token);

    return { valid: true };
  }

  getPending(token: string): PendingConfirmation | undefined {
    const pending = this.confirmations.get(token);
    if (!pending) return undefined;
    if (Date.now() > pending.expiresAt) {
      this.confirmations.delete(token);
      return undefined;
    }
    return pending;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [token, pending] of this.confirmations.entries()) {
      if (now > pending.expiresAt) {
        this.confirmations.delete(token);
      }
    }
  }

  clear(): void {
    this.confirmations.clear();
  }
}

export const confirmationManager = new ConfirmationManager();
