/**
 * ActivityStatusLine — Sprint 103 R7 (#161): the one truth point under the
 * conversation. Renders the derived activity state (design.md §3): running
 * (accent spinner), the three amber waiting states, muted done with active
 * time, red failure, faint stopped. Never says "Done" while a card is pending
 * — that gating lives in deriveActivityState, not here.
 */
import { Icon } from '../ui/Icon';
import { useActiveConversation } from './store';
import { deriveActivityState, presentActivityState } from './activityState';
import { activeDurationMs } from './types';

const TONE_CLASS: Record<string, string> = {
  accent: 'text-[var(--r-accent)]',
  amber: 'text-[var(--r-warning)]',
  muted: 'text-[var(--r-ink-muted)]',
  red: 'text-[var(--r-error)]',
  faint: 'text-[var(--r-ink-faint)]',
};

export function ActivityStatusLine() {
  const conversation = useActiveConversation();
  const state = deriveActivityState(conversation);

  // Terminal-state context from the newest turn.
  const lastAgent = conversation.agentConversation[conversation.agentConversation.length - 1];
  const lastCodex = conversation.codexConversation[conversation.codexConversation.length - 1];
  const last = !lastAgent ? lastCodex
    : !lastCodex ? lastAgent
    : (lastAgent.timestamp >= lastCodex.timestamp ? lastAgent : lastCodex);

  const metrics = last && 'result' in last ? (last.result as { metrics?: { durationMs: number; waitedMs?: number; costUsd: number | null; model: string | null } } | undefined)?.metrics : undefined;
  const activeSeconds = metrics ? activeDurationMs(metrics) / 1000 : undefined;
  const waitedSeconds = metrics?.waitedMs ? metrics.waitedMs / 1000 : undefined;
  const errorFirstLine = last?.result?.error?.split('\n')[0]?.slice(0, 120);
  const liveActivity = last?.isRunning
    ? last.activities[last.activities.length - 1]?.message?.slice(0, 80)
    : undefined;
  const runningSubagents = last?.isRunning && 'subagents' in last
    ? ((last as { subagents?: Array<{ status: string }> }).subagents?.filter((x) => x.status === 'running').length ?? 0)
    : 0;

  const presentation = presentActivityState(state, { activeSeconds, waitedSeconds, errorFirstLine, liveActivity });
  if (!presentation) return null;

  // AgentResponse already renders recoverable Claude auth failures as an
  // actionable card. Repeating the same failure below it as a red status line
  // creates two competing truth points and exposes the raw runtime wording.
  const terminalResult = last?.result;
  const failureKind = terminalResult && 'failureKind' in terminalResult
    ? terminalResult.failureKind
    : undefined;
  if (state === 'failed' && (failureKind === 'authentication' || failureKind === 'api-key-authentication')) {
    return null;
  }

  const title = state === 'done' && waitedSeconds && waitedSeconds > 1
    ? `+${Math.round(waitedSeconds)}s waiting for you`
    : undefined;

  return (
    <div
      className={`flex h-6 items-center gap-1.5 px-1 text-[12px] ${TONE_CLASS[presentation.tone]}`}
      title={title}
      data-activity-state={state}
    >
      <Icon
        name={presentation.icon as never}
        size={14}
        className={presentation.spin ? 'animate-spin' : undefined}
      />
      <span className="min-w-0 truncate">{presentation.label}</span>
      {runningSubagents > 0 && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--r-accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--r-accent-deep)]">
          <Icon name="robot" size={12} />
          {runningSubagents}
        </span>
      )}
    </div>
  );
}
