/**
 * Sprint 99 (R5 / E1) — per-conversation state.
 *
 * Before Sprint 99 the AI sidebar held exactly ONE conversation, spread across
 * a handful of top-level store fields (`agentConversation`, `codexConversation`,
 * `currentConversationId`, a global `isStreaming`, …). Parallel chats make that
 * shape a lie: every one of those fields is a property of a *conversation*, not
 * of the sidebar.
 *
 * This module owns the split. `ConversationState` is everything that belongs to
 * ONE thread; the store keeps `conversations: Record<id, ConversationState>` plus
 * an `activeConversationId`. Anything genuinely app-global (connectivity, the
 * model catalogs, setup/onboarding status, appearance) stays at the store's top
 * level and is deliberately NOT in here.
 */

import type {
  AgentConversationTurn,
  AgentId,
  ChatMessage,
  CodexConversationTurn,
  ConversationEntry,
} from './types';
import type { LegacyRitemarkConversationRun } from './conversationModel';

/** Per-run runtime draft selection (runtime + model + approval mode). */
export interface PendingRuntimeSelection {
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  modelId: string;
  mode: 'auto' | 'ask' | 'plan';
}

/**
 * One live agent conversation ("thread" in user-facing copy).
 *
 * `id` doubles as the storage key used by `chatHistoryStorage` — a conversation
 * gets its id at creation rather than at first save, so background threads can
 * autosave without racing over a shared "current id".
 */
export interface ConversationState {
  id: string;
  createdAt: number;

  // ── Transcript ──
  /** Claude Code turns. */
  agentConversation: AgentConversationTurn[];
  /** Codex + OpenCode turns (they share one turn shape, tagged by `runtime`). */
  codexConversation: CodexConversationTurn[];

  // ── Legacy (read-only) chat compat ──
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
  streamingContent: string;
  /** Legacy non-agent streaming flag. Per-conversation as of Sprint 99. */
  isStreaming: boolean;
  legacyConversation: LegacyRitemarkConversationRun | null;

  // ── Runtime binding + model selection (per thread, spec R14) ──
  selectedAgent: AgentId;
  selectedModel: string;
  codexSelectedModel: string;
  /** Full composite value: "opencode:<provider>/<model>". */
  opencodeSelectedModel: string;
  pendingRuntime: PendingRuntimeSelection;

  // ── Per-thread UI state ──
  dismissedCurrentPlanKey: string | null;
  estimatedTokens: number;
  contextUsagePercent: number;
  showContextWarning: boolean;
}

/**
 * The `ConversationState` fields the store also exposes at its top level, as a
 * projection of the ACTIVE conversation.
 *
 * Sprint 99 Phase 1: the rail (E6) does not exist yet, so every existing view
 * still reads these flat fields. Keeping them as a derived mirror is what lets
 * the store reshape land without rewriting six components in the same change.
 * Phase 5 points the views at `conversations[activeConversationId]` directly and
 * this projection goes away.
 */
export type MirroredConversationKey = Exclude<keyof ConversationState, 'id' | 'createdAt'>;

export const MIRRORED_CONVERSATION_KEYS: MirroredConversationKey[] = [
  'agentConversation',
  'codexConversation',
  'chatMessages',
  'conversationHistory',
  'streamingContent',
  'isStreaming',
  'legacyConversation',
  'selectedAgent',
  'selectedModel',
  'codexSelectedModel',
  'opencodeSelectedModel',
  'pendingRuntime',
  'dismissedCurrentPlanKey',
  'estimatedTokens',
  'contextUsagePercent',
  'showContextWarning',
];

export function createConversationState(
  id: string,
  overrides: Partial<ConversationState> = {},
): ConversationState {
  const base: ConversationState = {
    id,
    createdAt: Date.now(),
    agentConversation: [],
    codexConversation: [],
    chatMessages: [],
    conversationHistory: [],
    streamingContent: '',
    isStreaming: false,
    legacyConversation: null,
    selectedAgent: 'claude-code',
    selectedModel: '',
    codexSelectedModel: '',
    opencodeSelectedModel: '',
    pendingRuntime: { runtimeId: 'claude-code', modelId: '', mode: 'auto' },
    dismissedCurrentPlanKey: null,
    estimatedTokens: 0,
    contextUsagePercent: 0,
    showContextWarning: false,
  };
  // `id` is the storage key — never let an override desync it from the map key.
  return { ...base, ...overrides, id };
}

/** True when nothing has been said in this thread yet (R10 empty-thread hygiene). */
export function isConversationEmpty(conversation: ConversationState): boolean {
  return (
    conversation.agentConversation.length === 0
    && conversation.codexConversation.length === 0
    && conversation.chatMessages.length === 0
  );
}

/** True when any turn in this thread is mid-flight. */
export function isConversationRunning(conversation: ConversationState): boolean {
  return (
    conversation.agentConversation.some((t) => t.isRunning)
    || conversation.codexConversation.some((t) => t.isRunning)
  );
}
