/**
 * SubagentCard - Collapsible card showing subagent task progress.
 *
 * Displays:
 * - Task description header
 * - Status indicator (spinner/checkmark/error)
 * - Collapsible nested activity feed
 * - Result when done
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { ActivityCard } from './ActivityCard';
import type { SubagentProgress } from './types';

interface SubagentCardProps {
  subagent: SubagentProgress;
}

export function SubagentCard({ subagent }: SubagentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    running: <Icon name="circle-notch" size={12} className="animate-spin text-[var(--vscode-progressBar-background)]" />,
    done: <Icon name="check" size={12} className="text-green-500" />,
    error: <Icon name="warning-circle" size={12} className="text-[var(--r-error)]" />,
  }[subagent.status];

  const hasActivities = subagent.activities.length > 0;

  return (
    <div className="ml-3 border-l-2 border-[var(--vscode-progressBar-background)] pl-3 py-1">
      {/* Header */}
      <button
        onClick={() => hasActivities && setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 w-full text-left ${
          hasActivities ? 'cursor-pointer hover:bg-[var(--r-surface-soft)]' : 'cursor-default'
        } rounded px-1.5 py-1 -mx-1.5 transition-colors`}
        disabled={!hasActivities}
      >
        {/* Expand/collapse chevron */}
        {hasActivities ? (
          isExpanded ? (
            <Icon name="caret-down" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
          ) : (
            <Icon name="caret-right" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
          )
        ) : (
          <div className="w-3" />
        )}

        {/* Bot icon */}
        <Icon name="robot" size={14} className="shrink-0 text-[var(--vscode-progressBar-background)]" />

        {/* Task description */}
        <span className="flex-1 text-[11px] truncate text-[var(--r-ink-strong)]">
          {subagent.task}
        </span>

        {/* Status icon */}
        <span className="shrink-0">{statusIcon}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && hasActivities && (
        <div className="mt-1.5 pl-5 space-y-0.5">
          {subagent.activities.map((activity, i) => (
            <ActivityCard key={`${activity.timestamp}-${i}`} activity={activity} />
          ))}
        </div>
      )}

      {/* Result when done */}
      {subagent.status === 'done' && subagent.result && (
        <div className="mt-1 ml-5 text-[10px] text-[var(--r-ink-muted)] italic">
          {subagent.result}
        </div>
      )}
    </div>
  );
}
