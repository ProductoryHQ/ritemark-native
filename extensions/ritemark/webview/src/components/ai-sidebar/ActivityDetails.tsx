/**
 * ActivityDetails — collapsible tool call list using native <details>/<summary>.
 */

import { ActivityCard } from './ActivityCard';
import { activeDurationMs } from './types';
import { formatSeconds } from './activityState';
import type { AgentProgress, AgentMetrics } from './types';

interface ActivityDetailsProps {
  activities: AgentProgress[];
  metrics?: AgentMetrics;
}

export function ActivityDetails({ activities, metrics }: ActivityDetailsProps) {
  if (!activities.length) return null;

  const stepCount = activities.length;
  // Sprint 103 R7: report agent working time, not human wait time — in the
  // same format the status line uses (one vocabulary for one fact).
  const activeMs = metrics ? activeDurationMs(metrics) : 0;
  const duration = activeMs > 0 ? formatSeconds(activeMs / 1000) : null;

  const summaryParts = [`${stepCount} steps`];
  if (duration) summaryParts.push(duration);

  return (
    <details className="mt-2 rounded-md border border-transparent text-[11px]">
      <summary className="cursor-pointer select-none text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)]">
        Activity ({summaryParts.join(' \u00b7 ')})
      </summary>
      <div className="mt-1.5 ml-1 space-y-0.5 border-l border-[var(--r-hairline)] pl-2">
        {activities.map((a, i) => (
          <ActivityCard key={`${a.timestamp}-${i}`} activity={a} />
        ))}
      </div>
    </details>
  );
}
