import type { UnifiedApprovalRequest } from './AgentRuntime';

export interface ApprovalResult {
  approved: boolean;
  alwaysAllow: boolean;
  /** Optional feedback from the user (e.g. plan rejection note for Claude Code) */
  feedback?: string;
}

interface PendingApproval {
  resolve: (result: ApprovalResult) => void;
  reject: (err: Error) => void;
}

export class UnifiedApprovalGate {
  private readonly pending = new Map<string, PendingApproval>();
  private readonly onRequest: (req: UnifiedApprovalRequest) => void;

  constructor(onRequest: (req: UnifiedApprovalRequest) => void) {
    this.onRequest = onRequest;
  }

  request(req: UnifiedApprovalRequest): Promise<ApprovalResult> {
    return new Promise<ApprovalResult>((resolve, reject) => {
      this.pending.set(req.requestId, { resolve, reject });
      this.onRequest(req);
    });
  }

  respond(requestId: string, approved: boolean, alwaysAllow: boolean, feedback?: string): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return;
    }
    this.pending.delete(requestId);
    entry.resolve({ approved, alwaysAllow, feedback });
  }
}
