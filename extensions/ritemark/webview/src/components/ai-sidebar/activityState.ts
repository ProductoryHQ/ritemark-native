/**
 * Sprint 103 R7 (#161) — the single source for "what is this conversation
 * doing right now". Pure functions over ConversationState, no React.
 *
 * Contract (spec R7 / design.md §3):
 * - Amber ("blocked on you") is exclusively the three waiting states, and the
 *   thread rail's `attention` MUST agree with them — both derive from here.
 * - "Done" is only reported when the runtime reported turn completion AND no
 *   card is pending.
 * - No invented signals: where a runtime provides no authoritative
 *   background-work information, nothing is claimed.
 */

import type { ConversationState } from './conversationState';
import { isConversationRunning } from './conversationState';

export type ConversationActivityState =
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'waiting-input'
  | 'plan-review'
  | 'done'
  | 'failed'
  | 'cancelled';

/**
 * Derive the activity state. Waiting states outrank running (the urgent
 * information is the blockage — same rule Sprint 99 set for the rail), and
 * running outranks any terminal state of an earlier turn.
 */
export function deriveActivityState(c: ConversationState): ConversationActivityState {
  // ── Waiting states (blocked on the user) ──
  // A Claude turn that already carries a terminal result cannot be waiting —
  // a cancelled/failed plan turn must read as its terminal state, not as
  // "waiting for review" forever (caught live in the Sprint 103 dev matrix).
  for (const turn of c.agentConversation) {
    if (turn.result) continue;
    if (turn.pendingPlanApproval) return 'plan-review';
    if (turn.isPlan && !turn.planHandled) return 'plan-review';
    if (turn.pendingQuestion) return 'waiting-input';
    if (turn.approval) return 'waiting-approval';
  }
  for (const turn of c.codexConversation) {
    // Codex plan review deliberately survives the turn result: the plan turn
    // COMPLETES and then waits for review — but only a successful completion
    // waits; an interrupted/failed turn does not.
    if (turn.requiresPlanReview && !turn.planHandled
      && (!turn.result || !turn.result.error) && turn.result?.status !== 'interrupted') {
      return 'plan-review';
    }
    if (turn.result) continue;
    if (turn.pendingQuestion) return 'waiting-input';
    if (turn.approval) return 'waiting-approval';
  }

  if (isConversationRunning(c)) return 'running';

  // ── Terminal state of the newest turn ──
  const lastAgent = c.agentConversation[c.agentConversation.length - 1];
  const lastCodex = c.codexConversation[c.codexConversation.length - 1];
  const last = !lastAgent ? lastCodex
    : !lastCodex ? lastAgent
    : (lastAgent.timestamp >= lastCodex.timestamp ? lastAgent : lastCodex);
  if (!last?.result) return 'idle';

  const error = last.result.error;
  if (error) {
    return /cancel/i.test(error) ? 'cancelled' : 'failed';
  }
  // Codex results carry a status string; 'interrupted' is a cancel.
  const status = (last.result as { status?: string }).status;
  if (status === 'interrupted') return 'cancelled';
  if (status && status !== 'success' && status !== 'completed') return 'failed';
  return 'done';
}

export interface ActivityStatusPresentation {
  /** Design.md §3 icon name (webview icon pack). */
  icon: string;
  /** Semantic tone → color token mapping happens in the component. */
  tone: 'accent' | 'amber' | 'muted' | 'red' | 'faint';
  label: string;
  spin?: boolean;
}

export function presentActivityState(
  state: ConversationActivityState,
  opts?: { activeSeconds?: number; waitedSeconds?: number; errorFirstLine?: string; liveActivity?: string }
): ActivityStatusPresentation | null {
  switch (state) {
    case 'running':
      return {
        icon: 'circle-notch', tone: 'accent', spin: true,
        label: opts?.liveActivity ? `Working — ${opts.liveActivity}` : 'Working…',
      };
    case 'plan-review':
      return { icon: 'clipboard-text', tone: 'amber', label: 'Waiting for your review' };
    case 'waiting-input':
      return { icon: 'question', tone: 'amber', label: 'Needs your answer' };
    case 'waiting-approval':
      return { icon: 'shield-check', tone: 'amber', label: 'Waiting for approval' };
    case 'done':
      return {
        icon: 'check', tone: 'muted',
        label: opts?.activeSeconds != null ? `Done in ${formatSeconds(opts.activeSeconds)}` : 'Done',
      };
    case 'failed':
      return {
        icon: 'x-circle', tone: 'red',
        label: opts?.errorFirstLine ? `Failed — ${opts.errorFirstLine}` : 'Failed',
      };
    case 'cancelled':
      return { icon: 'x', tone: 'faint', label: 'Stopped' };
    case 'idle':
    default:
      return null;
  }
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}m ${s}s`;
}
