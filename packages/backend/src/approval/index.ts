import { getDb } from '../db/index.js';

export type ApprovalPolicy = 'auto-allow' | 'ask' | 'deny';
export type ApprovalOutcome = 'allowed' | 'rejected' | 'timeout';

export interface ApprovalRequest {
  sessionId: string;
  action: 'exec' | 'write' | 'delete' | 'escalate';
  description: string;
  detail: Record<string, unknown>;
  timeoutMs?: number;
}

const sessionPolicies = new Map<string, ApprovalPolicy>();
const pendingApprovals = new Map<
  string,
  {
    resolve: (outcome: ApprovalOutcome) => void;
    request: ApprovalRequest;
  }
>();

let approvalHandler: ((req: ApprovalRequest) => void) | null = null;

export function setApprovalHandler(handler: (req: ApprovalRequest) => void): void {
  approvalHandler = handler;
}

export function getSessionPolicy(sessionId: string): ApprovalPolicy {
  return sessionPolicies.get(sessionId) || 'auto-allow';
}

export function setSessionPolicy(sessionId: string, policy: ApprovalPolicy): void {
  sessionPolicies.set(sessionId, policy);
}

export async function requestApproval(req: ApprovalRequest): Promise<ApprovalOutcome> {
  const policy = getSessionPolicy(req.sessionId);

  if (policy === 'auto-allow') {
    logApproval(req, 'allowed');
    return 'allowed';
  }

  if (policy === 'deny') {
    logApproval(req, 'rejected');
    return 'rejected';
  }

  const timeoutMs = req.timeoutMs || 30000;

  if (approvalHandler) {
    approvalHandler(req);
  }

  const approvalId = `${req.sessionId}:${Date.now()}`;

  return new Promise<ApprovalOutcome>((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(approvalId);
      logApproval(req, 'timeout');
      resolve('timeout');
    }, timeoutMs);

    pendingApprovals.set(approvalId, {
      resolve: (outcome) => {
        clearTimeout(timer);
        pendingApprovals.delete(approvalId);
        logApproval(req, outcome);
        resolve(outcome);
      },
      request: req,
    });
  });
}

export function resolveApproval(sessionId: string, outcome: ApprovalOutcome): boolean {
  for (const [id, pending] of pendingApprovals) {
    if (id.startsWith(`${sessionId}:`)) {
      pending.resolve(outcome);
      return true;
    }
  }
  return false;
}

export function getPendingApproval(sessionId: string): ApprovalRequest | null {
  for (const [id, pending] of pendingApprovals) {
    if (id.startsWith(`${sessionId}:`)) {
      return pending.request;
    }
  }
  return null;
}

function logApproval(req: ApprovalRequest, outcome: ApprovalOutcome): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO approval_logs (id, session_id, action, description, detail, outcome, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      req.sessionId,
      req.action,
      req.description,
      JSON.stringify(req.detail),
      outcome,
      new Date().toISOString()
    );
  } catch {
    // table may not exist yet
  }
}
