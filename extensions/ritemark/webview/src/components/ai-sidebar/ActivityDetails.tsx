/**
 * ActivityDetails — collapsible tool call list using native <details>/<summary>.
 */

import { ActivityCard } from './ActivityCard';
import type { AgentProgress, AgentMetrics } from './types';

interface ActivityDetailsProps {
  activities: AgentProgress[];
  metrics?: AgentMetrics;
}

export function ActivityDetails({ activities, metrics }: ActivityDetailsProps) {
  if (!activities.length) return null;

  const stepCount = activities.length;
  const duration = metrics?.durationMs
    ? (metrics.durationMs / 1000).toFixed(1) + 's'
    : null;

  const summaryParts = [`${stepCount} steps`];
  if (duration) summaryParts.push(duration);

  return (
    <details className="mt-2 text-[11px]">
      <summary className="cursor-pointer select-none text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
        Activity ({summaryParts.join(' \u00b7 ')})
      </summary>
      <div className="mt-1.5 pl-1 space-y-0.5 border-l-2 border-[var(--vscode-panel-border)] ml-1">
        {activities.map((a, i) => (
          <ActivityCard key={`${a.timestamp}-${i}`} activity={a} />
        ))}
      </div>
    </details>
  );
}
