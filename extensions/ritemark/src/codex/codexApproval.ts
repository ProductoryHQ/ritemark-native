/**
 * Codex approval request routing.
 *
 * Maps Codex app-server JSON-RPC method names to internal approval types.
 * Extracted for testability — see codexApproval.test.ts.
 */

/** Method names the Codex app-server sends for approval requests (v0.106+) */
export const CODEX_APPROVAL_METHODS = {
  execCommand: 'item/commandExecution/requestApproval',
  fileChange: 'item/fileChange/requestApproval',
} as const;

/**
 * Sprint 99: every routed result carries `threadId` so the adapter can find the
 * conversation the approval belongs to. Codex sends `threadId`/`turnId` on the
 * approval params (see the recorded fixtures in codexApproval.test.ts); it is
 * `undefined` only for malformed/legacy payloads, which the caller must treat
 * as unattributable rather than guessing.
 */
export type ApprovalRouteResult =
  | { type: 'command'; requestId: string | number; threadId?: string; command: string; workingDir: string }
  | { type: 'fileChange'; requestId: string | number; threadId?: string; fileChanges: Record<string, unknown> }
  | { type: 'denied'; requestId: string | number; threadId?: string; method: string };

/** Pull the owning thread id out of a server-request params bag, if present. */
export function threadIdOf(params: Record<string, unknown> | undefined): string | undefined {
  const raw = params?.threadId;
  return typeof raw === 'string' && raw ? raw : undefined;
}

/**
 * Route a server-initiated approval request to the correct handler.
 */
export function routeApprovalRequest(request: {
  id: string | number;
  method: string;
  params: Record<string, unknown>;
}): ApprovalRouteResult {
  const threadId = threadIdOf(request.params);

  if (request.method === CODEX_APPROVAL_METHODS.execCommand) {
    const p = request.params;
    const command = Array.isArray(p.command)
      ? (p.command as string[]).join(' ')
      : typeof p.command === 'string'
        ? p.command
        : String(p.command ?? '');
    return {
      type: 'command',
      requestId: request.id,
      threadId,
      command,
      workingDir: (p.cwd as string) || '',
    };
  }

  if (request.method === CODEX_APPROVAL_METHODS.fileChange) {
    const p = request.params;
    return {
      type: 'fileChange',
      requestId: request.id,
      threadId,
      fileChanges: (p.fileChanges ?? p.changes ?? {}) as Record<string, unknown>,
    };
  }

  // Unknown method — deny
  return { type: 'denied', requestId: request.id, threadId, method: request.method };
}
