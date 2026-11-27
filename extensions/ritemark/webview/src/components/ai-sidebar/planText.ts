import type { CodexConversationTurn } from './types';

/**
 * Plan text helpers for the plan-approval flow (Sprint 74, R1 / issue #86).
 *
 * extractPlanDisplayText used to scan backwards and return only the last
 * list/heading block of the plan, which made multi-section plans unreadable
 * in the review card. It now returns the full plan text; the card body
 * handles long plans with max-height + scroll.
 */

export function extractPlanDisplayText(planText: string): string {
  return planText.trim();
}

/** The plan card already renders this response, so there is no separate answer bubble. */
export function codexPlanReplacesStreamingAnswer(turn: CodexConversationTurn): boolean {
  const plan = extractPlanDisplayText(turn.planText || ((turn.result && !turn.result.error) ? turn.streamingText : ''));
  return Boolean(turn.requestedPlanMode && plan && plan === turn.streamingText.trim());
}

/**
 * A turn needs the plan-approval UI only while the agent is actually blocked
 * waiting on ExitPlanMode — i.e. `pendingPlanApproval` is present.
 *
 * Regression guard for issue #86: the old condition used
 * `!turn.pendingPlanApproval`, which showed Approve/Reject buttons exactly
 * when the approval request was already gone (post-result), so clicking them
 * silently did nothing (`approvePlan` returns early without a pending request).
 */
export function planTurnNeedsApproval(turn: {
  isPlan?: boolean;
  planHandled?: boolean;
  pendingPlanApproval?: unknown;
}): boolean {
  return !!turn.isPlan && !turn.planHandled && !!turn.pendingPlanApproval;
}
