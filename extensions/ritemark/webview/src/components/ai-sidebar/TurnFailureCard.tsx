/**
 * TurnFailureCard — Sprint 139 (#376, R3–R5): a failed turn, for Claude,
 * ChatGPT and OpenCode alike. One sentence, once, with one way on.
 *
 * The host's one classifier names the failure's kind and data
 * (`errorKind`, `errorDetail`); this draws the card from them, live and after
 * a restart, and never reads the provider's raw text. A failure with no card (no
 * kind: a chat saved by 2.0) shows its one sentence as a line. Claude's
 * sign-in cards stay in AgentResponse.
 */

import { Icon, type PhosphorIconName } from '../ui/Icon';
import { RuntimeNotice } from './RuntimeNotice';
import { useActiveConversation, useAISidebarStore } from './store';
import { defaultCodexModelId } from './modelPresentation';
import { deriveRuntimeAvailabilities, listReadyAlternatives, resolveAvailableRuntimeModel } from './runtimeAvailability';
import { vscode } from '../../lib/vscode';
import { turnFailureCard, type ModelNames } from '../../../../src/runtime/turnFailureCopy';
import type { AgentId, ByokModelOption, ModelOption, RuntimeErrorDetail, RuntimeErrorKind } from './types';

function findModel(models: ModelOption[], id: string): ModelOption | undefined {
  return models.find((model) => model.id === id || model.resolvedModel === id || model.aliases?.includes(id));
}

function openCodeLabel(byok: Record<string, ByokModelOption[]> | undefined, id: string): string | undefined {
  const bare = id.replace(/^opencode:/, '');
  const slash = bare.indexOf('/');
  if (slash <= 0) return undefined;
  return byok?.[bare.slice(0, slash)]?.find((model) => model.id === bare.slice(slash + 1))?.label;
}

const ACTION_ICONS: Record<string, PhosphorIconName> = {
  'sign-in': 'sign-in',
  'open-key-settings': 'key',
  'use-model': 'arrows-clockwise',
  'use-runtime': 'chat-circle',
  'open-billing': 'arrow-square-out',
};

/**
 * Another AI that is ready now, with the model this chat would use with it, or
 * null. The signed-out card's Use ChatGPT and the plan limit's Continue with
 * both take it, so the two offer the same AI the same way.
 */
export function useReadyAlternative(runtimeId: AgentId): { runtimeId: AgentId; modelId: string } | null {
  const runtimeHydration = useAISidebarStore((s) => s.runtimeHydration);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const opencodeEnabled = useAISidebarStore((s) => s.opencodeEnabled);
  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const conversation = useActiveConversation();

  const candidate = listReadyAlternatives(deriveRuntimeAvailabilities({
    runtimeHydration,
    setupStatus,
    codexStatus,
    opencodeEnabled,
    acpProviders,
    byokProviderModels,
  }), runtimeId)[0] ?? null;
  if (!candidate) return null;
  const modelId = resolveAvailableRuntimeModel(candidate, {
    claude: conversation.selectedModel,
    codex: conversation.codexSelectedModel,
    opencode: conversation.opencodeSelectedModel,
  }, {
    claude: models,
    codex: codexModels,
    opencode: byokProviderModels,
    acpProviders,
  });
  return modelId ? { runtimeId: candidate, modelId } : null;
}

export function TurnFailureCard({
  runtimeId,
  error,
  errorKind,
  errorDetail,
  isLatest,
  userPrompt,
}: {
  runtimeId: AgentId;
  error: string;
  errorKind?: RuntimeErrorKind;
  errorDetail?: RuntimeErrorDetail;
  /** Only the newest turn offers a way on; an older one says what happened. */
  isLatest: boolean;
  /** Sprint 143 (#544): the turn's message, which the busy card's Continue with puts back in the box. */
  userPrompt?: string;
}) {
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const defaultClaudeModel = useAISidebarStore((s) => s.defaultClaudeModel);
  const selectRuntimeModel = useAISidebarStore((s) => s.selectRuntimeModel);
  const continueWithAlternative = useAISidebarStore((s) => s.continueWithAlternative);
  const startCodexLogin = useAISidebarStore((s) => s.startCodexLogin);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const conversation = useActiveConversation();
  const readyAlternative = useReadyAlternative(runtimeId);

  const names: ModelNames = {
    label: (id) => runtimeId === 'claude-code'
      ? findModel(models, id)?.label
      : runtimeId === 'codex'
        ? findModel(codexModels, id)?.label
        : openCodeLabel(byokProviderModels, id),
  };
  const fallbackModel = runtimeId === 'claude-code'
    ? (defaultClaudeModel || models[0]?.id)
    : runtimeId === 'codex'
      ? defaultCodexModelId(codexModels)
      : undefined;

  // "Switched" follows the chat's own model: the switch was taken (now or before a restart), or the
  // restore fell back to the default. A switch the person declines (Claude's background-work
  // question) leaves the card offering it.
  const currentModel = runtimeId === 'claude-code'
    ? conversation.selectedModel
    : runtimeId === 'codex'
      ? conversation.codexSelectedModel
      : conversation.opencodeSelectedModel.replace(/^opencode:/, '');
  const alreadySwitched = isLatest && errorKind === 'model' && fallbackModel && currentModel === fallbackModel
    && errorDetail?.model !== fallbackModel
    ? fallbackModel
    : undefined;

  const card = turnFailureCard({
    runtimeId,
    kind: errorKind,
    detail: errorDetail,
    sentence: error,
    names,
    fallbackModel,
    switchedTo: alreadySwitched,
    readyAlternative: readyAlternative?.runtimeId,
  });

  if (!card) {
    return (
      <div className="flex items-start gap-2 text-[var(--r-error)]" data-turn-failure={errorKind ?? 'unclassified'}>
        <Icon name="warning-circle" size={14} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const action = isLatest ? card.action : undefined;
  return (
    <div data-turn-failure={errorKind}>
      <RuntimeNotice
        title={card.title}
        message={card.message}
        tone={card.done ? 'success' : 'warning'}
        primaryAction={action ? {
          label: action.label,
          icon: ACTION_ICONS[action.kind] ?? 'arrow-square-out',
          tooltip: action.tooltip,
          onAction: () => {
            if (action.kind === 'use-model') {
              selectRuntimeModel(runtimeId, action.modelId);
            } else if (action.kind === 'use-runtime' && readyAlternative && action.carryMessage) {
              // Sprint 143 (#544, R3a): the busy card's Continue with, as the waiting line's.
              continueWithAlternative(readyAlternative.runtimeId, readyAlternative.modelId, userPrompt ?? '');
            } else if (action.kind === 'use-runtime' && readyAlternative) {
              selectRuntimeModel(readyAlternative.runtimeId, readyAlternative.modelId);
            } else if (action.kind === 'sign-in') {
              // Each AI's own sign-in; OpenCode signs in with a key.
              if (runtimeId === 'codex') startCodexLogin();
              else if (runtimeId === 'claude-code') startLogin();
              else openApiKeySettings();
            } else if (action.kind === 'open-key-settings') {
              openApiKeySettings();
            } else if (action.kind === 'open-billing' && errorDetail?.billing) {
              vscode.postMessage({ type: 'turn-failure/open-billing', provider: errorDetail.billing });
            }
          },
        } : undefined}
      />
    </div>
  );
}
