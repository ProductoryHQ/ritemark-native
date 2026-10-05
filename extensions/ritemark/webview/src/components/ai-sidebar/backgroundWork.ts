/**
 * Sprint 128 — Claude's background work in the sidebar, as pure functions the
 * store applies (and tests call directly).
 *
 * A subagent card lives in the turn that launched it, but a background task
 * keeps reporting after that turn ended — sometimes after Claude has opened
 * a new turn of its own. Card updates therefore find the card in any turn.
 */
import type { AgentConversationTurn, AgentProgress, SubagentProgress } from './types';

type CardStatus = SubagentProgress['status'];

function cardStatusFor(progress: AgentProgress): CardStatus | null {
  switch (progress.subagentStatus) {
    case 'running': return 'running';
    case 'completed': return 'done';
    case 'failed': return 'error';
    case 'stopped': return 'stopped';
    case 'ended': return 'ended';
    default: return progress.type === 'subagent_done' ? 'done' : null;
  }
}

function patchCard(card: SubagentProgress, progress: AgentProgress): SubagentProgress {
  // Activity of the subagent itself (its tools, its thinking).
  if (progress.type === 'subagent_progress' || (progress.parentToolUseId && !progress.subagentStatus && progress.type !== 'subagent_done')) {
    return { ...card, activities: [...card.activities, progress] };
  }
  const status = cardStatusFor(progress);
  const next: SubagentProgress = {
    ...card,
    ...(progress.taskId ? { taskId: progress.taskId } : {}),
    ...(progress.backgrounded !== undefined ? { backgrounded: progress.backgrounded } : {}),
  };
  // A stop in flight keeps its "Stopping…" state until the task reports an end.
  if (status && !(card.status === 'stopping' && status === 'running')) next.status = status;
  if (status === 'done' || status === 'error' || status === 'stopped') {
    next.result = progress.message || card.result;
    next.detail = undefined;
  } else if (progress.message) {
    next.detail = progress.message;
  }
  return next;
}

/**
 * Apply a card update to the newest turn that holds the card. Returns the same
 * array when no turn holds it (an update for a task with no card, such as a
 * background Bash command).
 */
export function applyTaskProgress(turns: AgentConversationTurn[], progress: AgentProgress): AgentConversationTurn[] {
  const cardId = progress.subagentId ?? progress.parentToolUseId;
  if (!cardId) return turns;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    const index = turn.subagents?.findIndex((card) => card.id === cardId) ?? -1;
    if (index < 0) continue;
    const subagents = [...turn.subagents!];
    subagents[index] = patchCard(subagents[index], progress);
    const next = [...turns];
    next[i] = { ...turn, subagents };
    return next;
  }
  return turns;
}

/** Mark one card as stopping (the user pressed its stop button). */
export function markCardStopping(turns: AgentConversationTurn[], cardId: string): AgentConversationTurn[] {
  return applyCardStatus(turns, (card) => card.id === cardId && card.status === 'running' ? 'stopping' : null);
}

/**
 * Close every card still shown as running: the session that ran them is gone
 * (it ended, or the conversation was reloaded with no live session).
 */
export function endRunningCards(turns: AgentConversationTurn[]): AgentConversationTurn[] {
  return applyCardStatus(turns, (card) => card.status === 'running' || card.status === 'stopping' ? 'ended' : null);
}

function applyCardStatus(
  turns: AgentConversationTurn[],
  decide: (card: SubagentProgress) => CardStatus | null,
): AgentConversationTurn[] {
  let changed = false;
  const next = turns.map((turn) => {
    if (!turn.subagents?.some((card) => decide(card))) return turn;
    changed = true;
    return {
      ...turn,
      subagents: turn.subagents.map((card) => {
        const status = decide(card);
        return status ? { ...card, status, detail: undefined } : card;
      }),
    };
  });
  return changed ? next : turns;
}

const tasks = (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'}`;

/** "Done — 1 task still running in the background" (Design G). */
export function backgroundStatusLabel(prefix: 'Done' | 'Stopped', count: number): string {
  return `${prefix} — ${tasks(count)} still running in the background`;
}

/** "2 background tasks ended with the session." (Design G). */
export function tasksEndedLine(count: number): string {
  return `${count} background ${count === 1 ? 'task' : 'tasks'} ended with the session.`;
}

/** The header line of a turn Claude opened itself (Design G). */
export const RUNTIME_TURN_HEADER = 'A background task finished — Claude is continuing';

/** The card's one-line state, in plain words (Sprint 128 Design G). */
export function subagentStatusText(subagent: SubagentProgress): string | null {
  switch (subagent.status) {
    case 'running': return subagent.backgrounded ? 'Running in the background' : null;
    case 'stopping': return 'Stopping…';
    case 'stopped': return 'Stopped';
    case 'ended': return 'Ended when the session closed';
    case 'error': return 'Failed';
    default: return null;
  }
}
