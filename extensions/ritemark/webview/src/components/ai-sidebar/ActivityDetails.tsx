/**
 * ActivityDetails — collapsible tool call list using native <details>/<summary>.
 */

import { readSummary, stepLabel, visibleStepActivities } from './stepLabel';
import { ActivityCard } from './ActivityCard';
import { activeDurationMs } from './types';
import { formatSeconds } from './activityState';
import type { AgentProgress, AgentMetrics } from './types';

interface ActivityDetailsProps {
  activities: AgentProgress[];
  metrics?: AgentMetrics;
  running?: boolean;
}

export function ActivityDetails({ activities, metrics, running }: ActivityDetailsProps) {
  const visible = visibleStepActivities(activities);
  if (running) {
    const steps = visible.filter((activity) => activity.type === 'notice' || stepLabel(activity));
    return steps.length ? (
      <div className="space-y-0.5">
        {steps.map((step, i) => <ActivityCard key={step.step?.id ?? i} activity={step} />)}
      </div>
    ) : null;
  }
  if (!visible.length) return null;

  const stepCount = visible.length;
  // Sprint 103 R7: report agent working time, not human wait time — in the
  // same format the status line uses (one vocabulary for one fact).
  const activeMs = metrics ? activeDurationMs(metrics) : 0;
  const duration = activeMs > 0 ? formatSeconds(activeMs / 1000) : null;

  const summaryParts = [`${stepCount} steps`];
  if (duration) summaryParts.push(duration);

  return (
    <details className="mt-2 rounded-md border border-transparent text-[11px]">
      <summary className="cursor-pointer select-none text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)]">
        {readSummary(activities, activeMs) ?? `Activity (${summaryParts.join(' · ')})`}
      </summary>
      <div className="mt-1.5 ml-1 space-y-0.5 border-l border-[var(--r-hairline)] pl-2">
        {visible.map((a, i) => (
          <ActivityCard key={`${a.timestamp}-${i}`} activity={a} />
        ))}
      </div>
    </details>
  );
}
