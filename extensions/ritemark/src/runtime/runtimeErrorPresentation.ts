import type { AgentId } from '../agent/types';

export type RuntimeFailureKind = 'authentication' | 'api-key-authentication';

export interface RuntimeErrorPresentation {
  message: string;
  failureKind?: RuntimeFailureKind;
}

const CLAUDE_AUTH_ERROR_PATTERNS = [
  /failed to authenticate/i,
  /oauth session expired/i,
  /oauth token has expired/i,
  /invalid authentication credentials/i,
  /not logged in.*(?:\/login|sign in)/i,
  /please run \/login/i,
];

export function isClaudeAuthenticationError(error: string | undefined): boolean {
  if (!error) return false;
  return CLAUDE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(error));
}

export function classifyClaudeAuthenticationError(
  error: string | undefined,
  usesApiKey: boolean,
): RuntimeFailureKind | undefined {
  if (!isClaudeAuthenticationError(error)) return undefined;
  return usesApiKey ? 'api-key-authentication' : 'authentication';
}

/**
 * Convert provider/runtime failures into stable user-facing categories.
 *
 * The raw provider error remains in Claude's activity trace for diagnostics;
 * the transcript gets copy that explains what the user can do next.
 */
export function presentRuntimeError(
  agentId: AgentId,
  error: string | undefined,
  failureKind?: RuntimeFailureKind,
): RuntimeErrorPresentation | undefined {
  if (!error) return undefined;

  const classifiedFailure = agentId === 'claude-code'
    ? failureKind ?? classifyClaudeAuthenticationError(error, false)
    : undefined;

  if (classifiedFailure === 'authentication') {
    return {
      message: 'Your Claude session has expired. Sign in again, then resend your message.',
      failureKind: 'authentication',
    };
  }

  if (classifiedFailure === 'api-key-authentication') {
    return {
      message: 'Claude did not accept your API key. Update it in AI Settings, then resend your message.',
      failureKind: 'api-key-authentication',
    };
  }

  return { message: error };
}
