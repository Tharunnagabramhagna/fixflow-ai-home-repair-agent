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
    // Sort keys canonically so order does not affect the hash
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

    // Immediately consume token to prevent replay attacks
    this.confirmations.delete(token);

    if (Date.now() > pending.expiresAt) {
      return {
        valid: false,
        reason: 'Confirmation token has expired. Confirmation tokens are valid for 5 minutes. Please prepare the proposal again.',
      };
    }

    if (pending.action !== action) {
      return {
        valid: false,
        reason: `Confirmation token action mismatch: expected '${pending.action}' but received '${action}'.`,
      };
    }

    if (pending.userId !== userId) {
      return {
        valid: false,
        reason: 'Confirmation token is bound to a different authenticated user. Action rejected.',
      };
    }

    if (pending.applianceId && applianceId && pending.applianceId !== applianceId) {
      return {
        valid: false,
        reason: 'Confirmation token is bound to a different appliance. Action rejected.',
      };
    }

    if (pending.caseId && caseId && pending.caseId !== caseId) {
      return {
        valid: false,
        reason: 'Confirmation token is bound to a different repair case. Action rejected.',
      };
    }

    const currentHash = this.computeArgumentsHash(args);
    if (pending.argumentsHash !== currentHash) {
      return {
        valid: false,
        reason: 'Operation arguments do not match the parameters approved during confirmation preparation. Tamper detected.',
      };
    }

    return { valid: true };
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [token, pending] of this.confirmations.entries()) {
      if (now > pending.expiresAt) {
        this.confirmations.delete(token);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.confirmations.clear();
  }
}

export const confirmationManager = new ConfirmationManager();
