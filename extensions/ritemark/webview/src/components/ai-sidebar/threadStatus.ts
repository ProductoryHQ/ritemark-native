/**
 * Sprint 99 (R6 / R8 / R9 / R11 / E6) — thread rail logic, with no React in it.
 *
 * Everything the rail needs to decide *what to draw* lives here as pure
 * functions over `ConversationState`, so the rules that matter (amber beats
 * spinner, idle shows no badge, a queued prompt is not idle, the soft cap is
 * advisory) are unit-testable without mounting a component.
 *
 * Design source: `docs/development/sprints/sprint-99-parallel-chats/design.md`
 * §4–§6 and spec R6/R8/R9/R11 + Resolved Design Gaps 1, 2, 3, 4, 7.
 */

import type { ConversationState } from './conversationState';
import { isConversationRunning } from './conversationState';

// ── Runtime identity (R9) ────────────────────────────────────────────────

/** The three runtimes a thread can be bound to. */
export type ThreadRuntime = 'claude' | 'codex' | 'opencode';

export const RUNTIME_LABEL: Record<ThreadRuntime, string> = {
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
};

/**
 * Which runtime a thread belongs to.
 *
 * The last turn wins when there is one (that is the engine that actually
 * produced the visible work); an empty thread falls back to the composer's
 * pending runtime selection.
 */
export function runtimeOfConversation(conversation: ConversationState): ThreadRuntime {
  const lastAgent = conversation.agentConversation[conversation.agentConversation.length - 1];
  const lastCodex = conversation.codexConversation[conversation.codexConversation.length - 1];

  if (lastAgent && lastCodex) {
    return lastAgent.timestamp >= lastCodex.timestamp
      ? 'claude'
      : (lastCodex.runtime === 'opencode' ? 'opencode' : 'codex');
  }
  if (lastAgent) return 'claude';
  if (lastCodex) return lastCodex.runtime === 'opencode' ? 'opencode' : 'codex';

  const pending = conversation.pendingRuntime.runtimeId;
  if (pending === 'codex') return 'codex';
  if (pending === 'opencode') return 'opencode';
  return 'claude';
}

// ── Status (R8) ──────────────────────────────────────────────────────────

/**
 * The rail's whole status vocabulary. `attention` = blocked on the user.
 *
 * State machine (spec R8): idle → running → attention → running → idle.
 */
export type ThreadStatus = 'idle' | 'running' | 'attention';

/**
 * True when the thread cannot make progress until the user answers something:
 * a unified-gate approval, an agent question, or a plan awaiting review.
 *
 * Every source listed in design.md §5 maps onto one of these turn fields —
 * Claude `AskUserQuestion` (`pendingQuestion`) and plan review
 * (`pendingPlanApproval` / `isPlan`), Codex `request_user_input`
 * (`pendingQuestion`) and plan review (`requiresPlanReview`), and the unified
 * approval gate for all three runtimes (`approval`).
 */
export function isConversationAwaitingUser(conversation: ConversationState): boolean {
  // Sprint 103 R7: a Claude turn with a terminal result can no longer be
  // waiting (a cancelled plan turn used to leave the rail amber forever).
  for (const turn of conversation.agentConversation) {
    if (turn.result) continue;
    if (turn.approval) return true;
    if (turn.pendingQuestion) return true;
    if (turn.pendingPlanApproval) return true;
    if (turn.isPlan && !turn.planHandled) return true;
  }
  for (const turn of conversation.codexConversation) {
    // Codex plan review outlives a SUCCESSFUL turn result by design.
    if (turn.requiresPlanReview && !turn.planHandled
      && (!turn.result || !turn.result.error) && turn.result?.status !== 'interrupted') {
      return true;
    }
    if (turn.result) continue;
    if (turn.approval) return true;
    if (turn.pendingQuestion) return true;
  }
  return false;
}

/**
 * The single signal a thread icon shows.
 *
 * **Amber overrides spinner** (design.md §5): a turn that is technically
 * mid-flight but waiting on the user reports `attention`, never `running`. The
 * urgent information is the blockage, not the progress.
 */
export function deriveThreadStatus(conversation: ConversationState): ThreadStatus {
  if (isConversationAwaitingUser(conversation)) return 'attention';
  if (isConversationRunning(conversation)) return 'running';
  return 'idle';
}

// ── Title (R6 + Resolved Gap 1) ──────────────────────────────────────────

export const THREAD_TITLE_MAX_CHARS = 60;
export const NEW_THREAD_TITLE = 'New thread';

/** The prompt a thread's auto-title is derived from: its first user prompt. */
export function firstPromptOf(conversation: ConversationState): string | null {
  const candidates: Array<{ prompt: string; timestamp: number }> = [];
  const firstAgent = conversation.agentConversation[0];
  const firstCodex = conversation.codexConversation[0];
  if (firstAgent?.userPrompt) candidates.push({ prompt: firstAgent.userPrompt, timestamp: firstAgent.timestamp });
  if (firstCodex?.userPrompt) candidates.push({ prompt: firstCodex.userPrompt, timestamp: firstCodex.timestamp });
  if (candidates.length === 0) {
    const firstUserMessage = conversation.chatMessages.find((m) => m.role === 'user');
    return firstUserMessage?.content ?? null;
  }
  candidates.sort((a, b) => a.timestamp - b.timestamp);
  return candidates[0].prompt;
}

function cutOnWordBoundary(text: string, max: number): string {
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // A single word longer than the budget has no boundary to break on — hard-cut it.
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

/**
 * Auto-title rule (Resolved Gap 1): the first prompt, trimmed to the first
 * sentence or {@link THREAD_TITLE_MAX_CHARS} characters — whichever comes
 * first — broken on a word boundary, with an ellipsis when anything was cut.
 * A prompt that fits the budget is used verbatim.
 */
export function truncateThreadTitle(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return NEW_THREAD_TITLE;

  const sentenceMatch = text.match(/^[^.!?]*[.!?](?=\s|$)/);
  const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : text;

  const candidate = firstSentence.length <= THREAD_TITLE_MAX_CHARS
    ? firstSentence
    : cutOnWordBoundary(firstSentence, THREAD_TITLE_MAX_CHARS);

  // Nothing was removed → the prompt is short enough to stand as the title.
  if (candidate.length === text.length) return text;
  return `${candidate.replace(/[\s.,;:!?]+$/, '')}…`;
}

/** The thread's rail/History title. Empty threads read as "New thread". */
export function deriveThreadTitle(conversation: ConversationState): string {
  const prompt = firstPromptOf(conversation);
  return prompt ? truncateThreadTitle(prompt) : NEW_THREAD_TITLE;
}

// ── Closing (R11 + Resolved Gap 4) ───────────────────────────────────────

/**
 * Whether a thread offers the hover × .
 *
 * Only an idle thread does. A thread with a QUEUED prompt is deliberately NOT
 * idle (Resolved Gap 4): closing it would silently discard something the user
 * has already written, so the affordance is withheld until the queue drains.
 */
/** Hover tooltip copy: "<title> — <status>" (design.md §4). */
export function threadTooltip(title: string, status: ThreadStatus, hasQueuedPrompt: boolean): string {
  const label =
    status === 'attention' ? 'needs you'
    : status === 'running' ? 'running'
    : hasQueuedPrompt ? 'prompt queued'
    : 'idle';
  return `${title} — ${label}`;
}
