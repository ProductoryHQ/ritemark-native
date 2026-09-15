/**
 * Normalized runtime availability — the ONE definition of whether a runtime can
 * accept a turn (Sprint 117, D12).
 *
 * This logic used to live only in the AI sidebar bundle
 * (`webview/src/components/ai-sidebar/runtimeAvailability.ts`), so the comment
 * dispatch path had no gate at all and a signed-out runtime failed minutes
 * later at the runtime boundary instead of where the user was looking
 * (audit F19). The host now owns the policy and the webview re-exports it, so
 * neither side can invent a stricter or looser rule.
 *
 * Deliberately dependency-free apart from a type-only `AgentId` import: the
 * webview bundles this file, so anything that reaches for `vscode` or Node
 * built-ins here would break that bundle. The input types are structural, which
 * is what lets the sidebar keep passing its own `SetupStatus` /
 * `CodexSidebarStatus` objects unchanged.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D12)
 */

import type { AgentId } from '../agent/types';

export type RuntimeAvailabilityState =
  | 'checking'
  | 'ready'
  | 'needs-auth'
  | 'auth-in-progress'
  | 'needs-configuration'
  | 'not-installed'
  | 'broken'
  | 'disabled'
  | 'error';

export interface RuntimeAvailability {
  state: RuntimeAvailabilityState;
  usable: boolean;
  detail: string | null;
}

export type RuntimeHydration = Record<
  AgentId,
  { phase: 'checking' | 'ready' | 'error'; error: string | null; refreshing?: boolean }
>;

/** Structural view of `SetupStatus` — only what availability actually reads. */
export interface ClaudeSetupStatusLike {
  state: 'not-installed' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
  error: string | null;
}

/** Structural view of `CodexSidebarStatus`. */
export interface CodexStatusLike {
  state: 'disabled' | 'checking' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
  error: string | null;
}

/** Structural view of `AcpProviderFlags`; every key optional so both the host's
 *  and the webview's concrete flag objects satisfy it. */
export interface AcpProviderAvailabilityFlags {
  google?: boolean;
  openai?: boolean;
  anthropic?: boolean;
  openrouter?: boolean;
}

export interface RuntimeAvailabilityInput {
  runtimeHydration: RuntimeHydration;
  setupStatus: ClaudeSetupStatusLike | null;
  codexStatus: CodexStatusLike;
  opencodeEnabled: boolean;
  acpProviders: AcpProviderAvailabilityFlags;
  byokProviderModels?: Record<string, readonly { id: string }[]>;
}

export type RuntimeAvailabilities = Record<AgentId, RuntimeAvailability>;

/** Mirrors `CommentTaskRecovery` minus the document-only `save-document`. */
export type RuntimeAvailabilityRecovery = 'none' | 'retry' | 'sign-in' | 'configure' | 'install';

const RUNTIME_ORDER: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];

const ACP_PROVIDER_KEYS = ['google', 'openai', 'anthropic', 'openrouter'] as const;

function availability(
  state: RuntimeAvailabilityState,
  detail: string | null = null,
): RuntimeAvailability {
  return { state, usable: state === 'ready', detail };
}

function probeOverride(
  probe: RuntimeHydration[AgentId],
): RuntimeAvailability | null {
  if (probe.phase === 'checking') return availability('checking');
  if (probe.phase === 'error') return availability('error', probe.error);
  return null;
}

function deriveClaude(input: RuntimeAvailabilityInput): RuntimeAvailability {
  const probe = probeOverride(input.runtimeHydration['claude-code']);
  if (probe) return probe;
  if (!input.setupStatus) return availability('checking');

  switch (input.setupStatus.state) {
    case 'ready': return availability('ready');
    case 'needs-auth': return availability('needs-auth', input.setupStatus.error);
    case 'auth-in-progress': return availability('auth-in-progress');
    case 'not-installed': return availability('not-installed', input.setupStatus.error);
    case 'broken-install': return availability('broken', input.setupStatus.error);
  }
}

function deriveCodex(input: RuntimeAvailabilityInput): RuntimeAvailability {
  const probe = probeOverride(input.runtimeHydration.codex);
  if (probe) return probe;

  switch (input.codexStatus.state) {
    case 'ready': return availability('ready');
    case 'needs-auth': return availability('needs-auth', input.codexStatus.error);
    case 'auth-in-progress': return availability('auth-in-progress');
    case 'broken-install': return availability('broken', input.codexStatus.error);
    case 'disabled': return availability('disabled');
    case 'checking': return availability('checking');
  }
}

function deriveOpenCode(input: RuntimeAvailabilityInput): RuntimeAvailability {
  if (!input.opencodeEnabled) return availability('disabled');
  const probe = probeOverride(input.runtimeHydration.opencode);
  if (probe) return probe;
  const configured = ACP_PROVIDER_KEYS.some((provider) => input.acpProviders[provider] === true);
  if (!configured) return availability('needs-configuration');
  const hasConfiguredModel = ACP_PROVIDER_KEYS.some((provider) => (
    input.acpProviders[provider] === true
    && (input.byokProviderModels?.[provider]?.length ?? 0) > 0
  ));
  return hasConfiguredModel ? availability('ready') : availability('needs-configuration');
}

/**
 * Normalize provider-specific setup/auth reports into the one definition of
 * whether a runtime can accept a turn. `runtimeHydration` remains probe state;
 * a completed probe is never treated as authenticated by itself.
 */
export function deriveRuntimeAvailabilities(
  input: RuntimeAvailabilityInput,
): RuntimeAvailabilities {
  return {
    'claude-code': deriveClaude(input),
    codex: deriveCodex(input),
    opencode: deriveOpenCode(input),
  };
}

export function listReadyAlternatives(
  availabilities: RuntimeAvailabilities,
  selected: AgentId,
): AgentId[] {
  return RUNTIME_ORDER.filter((runtimeId) => (
    runtimeId !== selected && availabilities[runtimeId].usable
  ));
}

export const RUNTIME_LABELS: Record<AgentId, string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
};

/**
 * What the UI should offer next for an unusable runtime. A state the user can
 * act on gets its own action; a state that is merely in flight gets Retry;
 * everything else is the message alone.
 */
export function recoveryForRuntimeAvailability(
  state: RuntimeAvailabilityState,
): RuntimeAvailabilityRecovery {
  switch (state) {
    case 'needs-auth': return 'sign-in';
    case 'needs-configuration': return 'configure';
    case 'not-installed': return 'install';
    case 'checking':
    case 'auth-in-progress': return 'retry';
    default: return 'none';
  }
}

/**
 * One plain sentence naming the runtime and what is wrong with it. The
 * provider's own `detail` is preferred where it exists, because it is already
 * normalized; the fallback never invents a cause.
 */
export function messageForRuntimeAvailability(
  runtimeId: AgentId,
  result: RuntimeAvailability,
): string {
  const label = RUNTIME_LABELS[runtimeId];
  switch (result.state) {
    case 'ready': return `${label} is ready.`;
    case 'checking': return `Ritemark is still checking whether ${label} is ready. Try again in a moment.`;
    case 'needs-auth': return `${label} is signed out. Sign in and try again.`;
    case 'auth-in-progress': return `${label} is still signing in. Try again in a moment.`;
    case 'needs-configuration': return `${label} has no provider configured yet.`;
    case 'not-installed': return `${label} is not installed yet.`;
    case 'broken': return result.detail ?? `${label} is installed but cannot run.`;
    case 'disabled': return `${label} is turned off.`;
    case 'error': return result.detail ?? `Ritemark could not check whether ${label} is ready.`;
  }
}
