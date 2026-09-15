/**
 * Runtime availability for the AI sidebar.
 *
 * Sprint 117 (D12): the derivation itself now lives in `src/runtime/availability.ts`
 * so the host's comment-task acceptance gate and this sidebar answer "can this
 * runtime take a turn?" with the same function. Before that the policy existed
 * only here, the comment dispatch path had no gate at all, and a signed-out
 * runtime surfaced minutes later at the runtime boundary (audit F19).
 *
 * What stays in this module is the webview-shaped surface: the concrete input
 * type built from the sidebar's own status objects, and `resolveAvailableRuntimeModel`,
 * which needs the sidebar's model catalogs and has no meaning on the host.
 */

import {
  deriveRuntimeAvailabilities as deriveSharedRuntimeAvailabilities,
  type RuntimeAvailabilities,
} from '../../../../src/runtime/availability';
import type {
  AcpProviderFlags,
  AgentId,
  ByokModelOption,
  CodexSidebarStatus,
  ModelOption,
  SetupStatus,
} from './types';

export {
  listReadyAlternatives,
  RUNTIME_LABELS,
} from '../../../../src/runtime/availability';
export type {
  RuntimeAvailability,
  RuntimeAvailabilities,
  RuntimeAvailabilityState,
  RuntimeHydration,
} from '../../../../src/runtime/availability';

import type { RuntimeHydration } from '../../../../src/runtime/availability';

/**
 * The sidebar's own inputs, spelled with its concrete status types. It is
 * structurally the shared module's input, which is exactly how host and webview
 * can share one derivation while each keeps its own status objects.
 */
export interface RuntimeAvailabilityInput {
  runtimeHydration: RuntimeHydration;
  setupStatus: SetupStatus | null;
  codexStatus: CodexSidebarStatus;
  opencodeEnabled: boolean;
  acpProviders: AcpProviderFlags;
  byokProviderModels?: Record<string, ByokModelOption[]>;
}

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

/**
 * Normalize provider-specific setup/auth reports into the one definition of
 * whether a runtime can accept a turn. Thin wrapper over the shared policy so
 * the sidebar's call sites and its tests keep their existing shape.
 */
export function deriveRuntimeAvailabilities(
  input: RuntimeAvailabilityInput,
): RuntimeAvailabilities {
  return deriveSharedRuntimeAvailabilities(input);
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
