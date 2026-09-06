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
  ThinkingEffort,
} from './types';
import type { LegacyRitemarkConversationRun } from './conversationModel';

/** Per-run runtime draft selection (runtime + model + policy). */
export interface PendingRuntimeSelection {
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  modelId: string;
  /**
   * Autonomy policy (Sprint 103 R1/R8): 'auto' or 'ask'. The value 'plan'
   * only exists in pre-Sprint-103 persisted threads and is normalized to
   * auto + planFirst by {@link policyOf}.
   */
  mode: 'auto' | 'ask' | 'plan';
  /**
   * Plan chip state (Sprint 103 R1, decision D2): stays on until a plan is
   * APPROVED, then auto-resets. Cancel/discard leaves it on.
   */
  planFirst?: boolean;
}

export interface ConversationContinuationNotice {
  mode: 'context-unavailable' | 'runtime-unavailable';
  runtimeId: AgentId;
  turnId?: string;
  truncated: boolean;
  unansweredPriorRequest: boolean;
}

/** Durable, read-only history marker projected from a canonical boundary event. */
export interface ConversationTranscriptBoundary {
  id: string;
  turnId: string;
  runtimeId: AgentId;
  timestamp: number;
  message: string;
}

/**
 * The two-axis policy of a selection, with legacy 'plan' normalized
 * (Sprint 103 R1/R8 migration): `plan` → autonomy 'auto' + planFirst on.
 */
export function policyOf(p: PendingRuntimeSelection): { autonomy: 'auto' | 'ask'; planFirst: boolean } {
  return {
    autonomy: p.mode === 'ask' ? 'ask' : 'auto',
    planFirst: p.planFirst === true || p.mode === 'plan',
  };
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
  /** Draft preference is isolated by runtime inside this conversation. */
  thinkingEffortByRuntime: Partial<Record<AgentId, ThinkingEffort>>;

  // ── Per-thread UI state ──
  dismissedCurrentPlanKey: string | null;
  estimatedTokens: number;
  contextUsagePercent: number;
  showContextWarning: boolean;
  /** Live continuation disclosure; dismissing it does not remove durable history. */
  continuationNotice: ConversationContinuationNotice | null;
  /** Canonical transcript-restoration boundaries survive close/reopen and restart. */
  transcriptBoundaries: ConversationTranscriptBoundary[];
}

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
    thinkingEffortByRuntime: {},
    dismissedCurrentPlanKey: null,
    estimatedTokens: 0,
    contextUsagePercent: 0,
    showContextWarning: false,
    continuationNotice: null,
    transcriptBoundaries: [],
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

/** R9: a non-empty cross-runtime change is an immediate, draft-safe handoff. */
export function isRuntimeHandoff(
  conversation: ConversationState,
  targetRuntimeId: AgentId,
): boolean {
  return targetRuntimeId !== conversation.pendingRuntime.runtimeId
    && !isConversationEmpty(conversation);
}

/** True when any turn in this thread is mid-flight. */
export function isConversationRunning(conversation: ConversationState): boolean {
  return (
    conversation.agentConversation.some((t) => t.isRunning)
    || conversation.codexConversation.some((t) => t.isRunning)
  );
}

/** Copy shown on a turn that was cut off by a relaunch (R13). */
export const INTERRUPTED_TURN_MESSAGE =
  'Interrupted — Ritemark closed while this turn was running. Send the prompt again to continue.';

/**
 * Sprint 99 (R13): make a restored thread honest about what happened.
 *
 * A turn that was mid-flight at shutdown must not come back looking live, and a
 * pending approval or question restored from disk is un-actionable — the runtime
 * process that raised it is gone. So we stop the turn, drop the stale prompts,
 * and mark it interrupted. This is **informational only**: no retry affordance,
 * because a partially applied turn's side effects (files written, commands run)
 * are not tracked and offering "resume" would be a correctness claim the code
 * cannot back (Resolved Gap 5).
 */
export function markConversationInterrupted(conversation: ConversationState): ConversationState {
  let touched = false;

  const agentConversation = conversation.agentConversation.map((turn) => {
    if (!turn.isRunning && !turn.approval && !turn.pendingQuestion && !turn.pendingPlanApproval) return turn;
    touched = true;
    const next = { ...turn, isRunning: false };
    delete next.approval;
    delete next.pendingQuestion;
    delete next.pendingPlanApproval;
    if (!next.result) {
      next.result = {
        text: '',
        filesModified: [],
        metrics: { durationMs: 0, costUsd: null, model: null },
        error: INTERRUPTED_TURN_MESSAGE,
      };
    }
    return next;
  });

  const codexConversation = conversation.codexConversation.map((turn) => {
    if (!turn.isRunning && !turn.approval && !turn.pendingQuestion) return turn;
    touched = true;
    const next = { ...turn, isRunning: false };
    delete next.approval;
    delete next.pendingQuestion;
    delete next.rpcProgressMessage;
    if (!next.result) {
      next.result = { status: 'interrupted', error: INTERRUPTED_TURN_MESSAGE };
    }
    return next;
  });

  if (!touched) return conversation;
  return { ...conversation, agentConversation, codexConversation, isStreaming: false };
}
