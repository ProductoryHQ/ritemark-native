/**
 * ActivityStatusLine — Sprint 103 R7 (#161): the one truth point under the
 * conversation. Renders the derived activity state (design.md §3): running
 * (accent spinner), the three amber waiting states, muted done with active
 * time, red failure, faint stopped. Never says "Done" while a card is pending
 * — that gating lives in deriveActivityState, not here.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { useActiveConversation, useAISidebarStore } from './store';
import { deriveActivityState, presentActivityState } from './activityState';
import { activeDurationMs } from './types';
import { useReadyAlternative } from './TurnFailureCard';
import {
  continueWithAction,
  failureSilencesStatusLine,
  retryingLine,
  retryingOffersAlternative,
} from '../../../../src/runtime/turnFailureCopy';

/** Sprint 143 (#544, R3a): the waiting line's minutes count down; a tick every 15 s is enough. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

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
  const liveActivity = last?.isRunning
    ? last.activities[last.activities.length - 1]?.message?.slice(0, 80)
    : undefined;
  const runningSubagents = last?.isRunning && 'subagents' in last
    ? ((last as { subagents?: Array<{ status: string }> }).subagents?.filter((x) => x.status === 'running').length ?? 0)
    : 0;
  // Sprint 128: the work still running, from the SDK's live set.
  const backgroundCount = conversation.backgroundTasks?.length ?? 0;
  const chipCount = Math.max(runningSubagents, backgroundCount);

  // Sprint 143 (#544, R3a): the AI waits to try again after the provider turned the request away.
  const lastRuntime = last && 'streamingText' in last
    ? (last.runtime === 'opencode' ? 'opencode' as const : 'codex' as const)
    : 'claude-code' as const;
  const retry = state === 'running' && last && 'retry' in last && last.retry?.busy ? last.retry : undefined;
  // The tick re-renders every 15 s while a wait counts down; the time itself is read now.
  useNow(Boolean(retry?.retryAt));
  const msLeft = retry?.retryAt !== undefined ? Math.max(0, retry.retryAt - Date.now()) : undefined;
  const alternative = useReadyAlternative(lastRuntime);
  const continueWithAlternative = useAISidebarStore((s) => s.continueWithAlternative);
  const offerAlternative = Boolean(retry && alternative && retryingOffersAlternative(msLeft));

  const presentation = presentActivityState(state, {
    activeSeconds,
    waitedSeconds,
    liveActivity,
    backgroundCount,
    ...(retry ? { retryLine: retryingLine(lastRuntime, msLeft) } : {}),
  });
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
  // Sprint 139 (#376): the same under every card with a way on — sign-in, model, limit — for all three AIs.
  // Sprint 143 (#544, R3a): except the busy card, under which it says "Failed".
  const terminalDetail = terminalResult && 'errorDetail' in terminalResult ? terminalResult.errorDetail : undefined;
  if (state === 'failed' && terminalResult?.error && failureSilencesStatusLine(lastRuntime, terminalResult.errorKind, terminalDetail)) {
    return null;
  }

  const title = state === 'done' && waitedSeconds && waitedSeconds > 1
    ? `+${Math.round(waitedSeconds)}s waiting for you`
    : undefined;

  return (
    <div
      className={`flex min-h-6 items-center gap-1.5 px-1 text-[12px] ${TONE_CLASS[presentation.tone]}`}
      title={title}
      data-activity-state={state}
    >
      <Icon
        name={presentation.icon as never}
        size={14}
        className={presentation.spin ? 'animate-spin' : undefined}
      />
      {/* Sprint 128: "Done — 1 task still running in the background" may take two lines in a narrow side bar. */}
      <span className="min-w-0 line-clamp-2" data-retry-line={retry ? 'true' : undefined}>{presentation.label}</span>
      {offerAlternative && alternative && last && (
        <Tooltip label={continueWithAction(alternative.runtimeId, 'waiting').tooltip}>
          <Button
            variant="ghost"
            size="sm"
            className="-my-1 ml-auto h-6 shrink-0 px-2 text-[12px]"
            onClick={() => continueWithAlternative(alternative.runtimeId, alternative.modelId, last.userPrompt ?? '')}
          >
            {continueWithAction(alternative.runtimeId, 'waiting').label}
          </Button>
        </Tooltip>
      )}
      {chipCount > 0 && state === 'running' && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--r-accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--r-accent-deep)]">
          <Icon name="robot" size={12} />
          {chipCount}
        </span>
      )}
    </div>
  );
}
