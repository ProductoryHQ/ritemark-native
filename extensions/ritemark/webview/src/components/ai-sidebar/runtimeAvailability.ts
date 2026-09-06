import type {
  AcpProviderFlags,
  AgentId,
  ByokModelOption,
  CodexSidebarStatus,
  ModelOption,
  SetupStatus,
} from './types';

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
  { phase: 'checking' | 'ready' | 'error'; error: string | null }
>;

export interface RuntimeAvailabilityInput {
  runtimeHydration: RuntimeHydration;
  setupStatus: SetupStatus | null;
  codexStatus: CodexSidebarStatus;
  opencodeEnabled: boolean;
  acpProviders: AcpProviderFlags;
  byokProviderModels?: Record<string, ByokModelOption[]>;
}

export type RuntimeAvailabilities = Record<AgentId, RuntimeAvailability>;

export interface RuntimeModelSelection {
  claude: string;
  codex: string;
  opencode: string;
}

export interface RuntimeModelCatalogs {
  claude: ModelOption[];
  codex: ModelOption[];
  opencode?: Record<string, ByokModelOption[]>;
  acpProviders: AcpProviderFlags;
}

const RUNTIME_ORDER: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];

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
  const configured = Object.values(input.acpProviders).some(Boolean);
  if (!configured) return availability('needs-configuration');
  const hasConfiguredModel = Object.entries(input.acpProviders).some(([provider, enabled]) => (
    enabled && (input.byokProviderModels?.[provider]?.length ?? 0) > 0
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

/** Resolve a canonical, currently selectable model for an explicit handoff. */
export function resolveAvailableRuntimeModel(
  runtimeId: AgentId,
  selection: RuntimeModelSelection,
  catalogs: RuntimeModelCatalogs,
): string | null {
  if (runtimeId === 'claude-code') {
    return catalogs.claude.find((model) => (
      model.id === selection.claude || model.aliases?.includes(selection.claude)
    ))?.id ?? catalogs.claude[0]?.id ?? null;
  }

  if (runtimeId === 'codex') {
    return catalogs.codex.find((model) => model.id === selection.codex)?.id
      ?? catalogs.codex[0]?.id
      ?? null;
  }

  const current = selection.opencode.replace(/^opencode:/, '');
  const separator = current.indexOf('/');
  const currentProvider = separator > 0 ? current.slice(0, separator) : '';
  const currentModel = separator > 0 ? current.slice(separator + 1) : '';
  if (
    currentProvider
    && currentModel
    && catalogs.acpProviders[currentProvider as keyof AcpProviderFlags]
    && catalogs.opencode?.[currentProvider]?.some((model) => model.id === currentModel)
  ) return `${currentProvider}/${currentModel}`;

  for (const provider of ['google', 'openai', 'anthropic', 'openrouter'] as const) {
    const first = catalogs.acpProviders[provider] ? catalogs.opencode?.[provider]?.[0] : undefined;
    if (first) return `${provider}/${first.id}`;
  }
  return null;
}

export const RUNTIME_LABELS: Record<AgentId, string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
};
