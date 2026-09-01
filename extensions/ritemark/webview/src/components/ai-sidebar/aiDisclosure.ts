import type { ModelOption } from './types';
import { modelDisplayName } from './modelPresentation';

export const AI_DISCLOSURE_STORAGE_KEY = 'ritemark.ai-disclosure.acknowledged.v1';

export const AI_INFORMATION_URL = 'https://ritemark.app/en/support/guides/ai-information';
export const RITEMARK_PRIVACY_URL = 'https://www.productory.ai/en/privacy/';
export const RITEMARK_TERMS_URL = 'https://www.productory.ai/en/terms/';

export type DisclosureRuntimeId = 'claude-code' | 'codex' | 'opencode';

export interface AIIdentity {
  runtimeId: DisclosureRuntimeId;
  runtimeLabel: string;
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  providerInformationUrl: string;
}

export interface ResolveAIIdentityInput {
  runtimeId: string;
  pendingModelId?: string;
  claudeModelId?: string;
  codexModelId?: string;
  openCodeModelValue?: string;
  claudeModels?: ModelOption[];
  codexModels?: ModelOption[];
  byokProviderModels?: Record<string, ModelOption[]>;
}

export interface DisclosureContextInput {
  hasPrompt: boolean;
  hasActiveFile: boolean;
  hasSelection: boolean;
  attachmentCount: number;
  hasBrowserContext: boolean;
  hasConversationContext: boolean;
}

export interface DisclosureContextRow {
  id: 'prompt' | 'active-file' | 'selection' | 'attachments' | 'browser' | 'tool-results';
  label: string;
  activeNow: boolean;
  detail: string;
}

export interface DisclosureStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PROVIDERS: Record<string, { label: string; informationUrl: string }> = {
  anthropic: {
    label: 'Anthropic',
    informationUrl: 'https://www.anthropic.com/legal/privacy',
  },
  openai: {
    label: 'OpenAI',
    informationUrl: 'https://openai.com/policies/privacy-policy/',
  },
  google: {
    label: 'Google',
    informationUrl: 'https://policies.google.com/privacy',
  },
  openrouter: {
    label: 'OpenRouter',
    informationUrl: 'https://openrouter.ai/privacy',
  },
};

function modelLabel(models: ModelOption[] | undefined, id: string, preferDescriptionVersion = false): string {
  return modelDisplayName(
    models?.find((model) => model.id === id),
    preferDescriptionVersion,
  ) || id || 'Not selected';
}

function modelIdForRuntime(
  pendingModelId: string | undefined,
  selectedModelId: string | undefined,
  models: ModelOption[] | undefined,
): string {
  if (pendingModelId && models?.some((model) => model.id === pendingModelId)) {
    return pendingModelId;
  }
  return selectedModelId || models?.[0]?.id || '';
}

function providerDetails(providerId: string): { label: string; informationUrl: string } {
  return PROVIDERS[providerId] || {
    label: providerId || 'Not selected',
    informationUrl: 'https://opencode.ai/docs/providers/',
  };
}

/**
 * Resolve the disclosure identity from the same runtime/model values used by
 * the composer. No second model catalogue or runtime-specific UI state.
 */
export function resolveAIIdentity(input: ResolveAIIdentityInput): AIIdentity {
  if (input.runtimeId === 'codex') {
    const modelId = modelIdForRuntime(input.pendingModelId, input.codexModelId, input.codexModels);
    return {
      runtimeId: 'codex',
      runtimeLabel: 'Codex',
      providerId: 'openai',
      providerLabel: PROVIDERS.openai.label,
      modelId,
      modelLabel: modelLabel(input.codexModels, modelId),
      providerInformationUrl: PROVIDERS.openai.informationUrl,
    };
  }

  if (input.runtimeId === 'opencode') {
    const composite = input.openCodeModelValue || (input.pendingModelId ? `opencode:${input.pendingModelId}` : '');
    const providerModel = composite.startsWith('opencode:')
      ? composite.slice('opencode:'.length)
      : composite;
    const slash = providerModel.indexOf('/');
    const providerId = slash >= 0 ? providerModel.slice(0, slash) : '';
    const modelId = slash >= 0 ? providerModel.slice(slash + 1) : providerModel;
    const provider = providerDetails(providerId);
    return {
      runtimeId: 'opencode',
      runtimeLabel: 'OpenCode',
      providerId,
      providerLabel: provider.label,
      modelId,
      modelLabel: modelLabel(input.byokProviderModels?.[providerId], modelId),
      providerInformationUrl: provider.informationUrl,
    };
  }

  const modelId = modelIdForRuntime(input.pendingModelId, input.claudeModelId, input.claudeModels);
  return {
    runtimeId: 'claude-code',
    runtimeLabel: 'Claude Code',
    providerId: 'anthropic',
    providerLabel: PROVIDERS.anthropic.label,
    modelId,
    modelLabel: modelLabel(input.claudeModels, modelId, true),
    providerInformationUrl: PROVIDERS.anthropic.informationUrl,
  };
}

/**
 * The detail view always explains every category that can be transmitted. The
 * active marker is intentionally descriptive, not a promise that the provider
 * will receive only these values: an approved agent can read more workspace
 * files or use tools while completing the task.
 */
export function buildDisclosureContextRows(input: DisclosureContextInput): DisclosureContextRow[] {
  return [
    {
      id: 'prompt',
      label: 'Your prompt',
      activeNow: input.hasPrompt,
      detail: 'The instruction you send, plus hidden Ritemark instructions needed to carry it out.',
    },
    {
      id: 'active-file',
      label: 'Active file',
      activeNow: input.hasActiveFile,
      detail: 'The active file path and, when the runtime reads it, relevant file content.',
    },
    {
      id: 'selection',
      label: 'Selected text',
      activeNow: input.hasSelection,
      detail: 'The selected text, its file path, and a short surrounding context window.',
    },
    {
      id: 'attachments',
      label: 'Attachments',
      activeNow: input.attachmentCount > 0,
      detail: 'Files or images you explicitly attach to the turn when the selected runtime supports them.',
    },
    {
      id: 'browser',
      label: 'Shared browser context',
      activeNow: input.hasBrowserContext,
      detail: 'A shared page summary, URL, and optional screenshot when browser context is visible and enabled.',
    },
    {
      id: 'tool-results',
      label: 'Conversation and tool context',
      activeNow: input.hasConversationContext,
      detail: 'Recent messages, cross-runtime handoff context, and results returned by tools used for the task.',
    },
  ];
}

function defaultStorage(): DisclosureStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function shouldShowFirstUseDisclosure(storage: DisclosureStorage | null = defaultStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(AI_DISCLOSURE_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function acknowledgeFirstUseDisclosure(storage: DisclosureStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AI_DISCLOSURE_STORAGE_KEY, '1');
  } catch {
    // A blocked storage backend must not make the disclosure unusable.
  }
}
