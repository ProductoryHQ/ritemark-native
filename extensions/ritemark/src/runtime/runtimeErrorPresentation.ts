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

const CLAUDE_STANDALONE_AUTH_ERROR_PATTERNS = [
  /^failed to authenticate:\s*.+$/i,
  /^oauth session expired(?:\s+and could not be refreshed)?[.!]?$/i,
  /^oauth token has expired[.!]?$/i,
  /^invalid authentication credentials[.!]?$/i,
  /^not logged in.*(?:\/login|sign in)[.!]?$/i,
  /^please run \/login[.!]?$/i,
];

export function isClaudeAuthenticationError(error: string | undefined): boolean {
  if (!error) return false;
  return CLAUDE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(error));
}

/**
 * Recognize a provider diagnostic only when the complete payload is the error.
 *
 * Claude's SDK can occasionally wrap an authentication failure in a nominally
 * successful result envelope. Keeping this matcher anchored and single-line
 * prevents a normal model answer that merely discusses an auth error from
 * being reclassified as a failed turn.
 */
export function standaloneClaudeAuthenticationError(text: string | undefined): string | undefined {
  const diagnostic = text?.trim();
  if (!diagnostic || diagnostic.length > 500 || /[\r\n]/.test(diagnostic)) return undefined;
  return CLAUDE_STANDALONE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(diagnostic))
    ? diagnostic
    : undefined;
}

/** Exact legacy RC shape whose auth method is unambiguously OAuth. */
export function standaloneClaudeOAuthExpirationError(text: string | undefined): string | undefined {
  const diagnostic = standaloneClaudeAuthenticationError(text);
  return diagnostic && /oauth (?:session|token) (?:has )?expired/i.test(diagnostic)
    ? diagnostic
    : undefined;
}

/**
 * Sprint 127 R6: the model a Claude failure says is unavailable — the CLI's own
 * wording (2.1.270) or the API's `not_found_error` — so the transcript can name
 * it instead of showing a raw diagnostic. The Ritemark runtime never passes a
 * `fallbackModel`, so the CLI does not silently switch models on this error.
 */
const CLAUDE_UNAVAILABLE_MODEL_PATTERNS = [
  /There's an issue with the selected model \(([^)\s]+)\)/i,
  /not_found_error[^\n]{0,200}?model:\s*([A-Za-z0-9._[\]-]+)/i,
  /([A-Za-z0-9._[\] -]{1,80}?) is not available\. Your organization restricts model selection/i,
  /((?:Opus|Sonnet|Haiku|Fable) with 1M context) is not available for your account/i,
];

export function claudeUnavailableModel(error: string | undefined): string | undefined {
  if (!error) return undefined;
  for (const pattern of CLAUDE_UNAVAILABLE_MODEL_PATTERNS) {
    const model = pattern.exec(error)?.[1]?.trim();
    if (model) return model;
  }
  return undefined;
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

  // Deliberately no failureKind: persisted conversation and comment-task
  // records accept only the authentication kinds.
  const unavailableModel = agentId === 'claude-code' ? claudeUnavailableModel(error) : undefined;
  if (unavailableModel) {
    return {
      message: `Claude can't use ${unavailableModel} with this account. Choose another model in the model menu, then resend your message.`,
    };
  }

  return { message: error };
}
