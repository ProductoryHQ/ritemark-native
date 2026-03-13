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

export type ApprovalRouteResult =
  | { type: 'command'; requestId: string | number; command: string; workingDir: string }
  | { type: 'fileChange'; requestId: string | number; fileChanges: Record<string, unknown> }
  | { type: 'denied'; requestId: string | number; method: string };

/**
 * Route a server-initiated approval request to the correct handler.
 */
export function routeApprovalRequest(request: {
  id: string | number;
  method: string;
  params: Record<string, unknown>;
}): ApprovalRouteResult {
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
      command,
      workingDir: (p.cwd as string) || '',
    };
  }

  if (request.method === CODEX_APPROVAL_METHODS.fileChange) {
    const p = request.params;
    return {
      type: 'fileChange',
      requestId: request.id,
      fileChanges: (p.fileChanges ?? p.changes ?? {}) as Record<string, unknown>,
    };
  }

  // Unknown method — deny
  return { type: 'denied', requestId: request.id, method: request.method };
}
