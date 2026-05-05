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
    running: <Icon name="circle-notch" size={12} className="animate-spin text-[var(--r-accent)]" />,
    done: <Icon name="check" size={12} className="text-[var(--vscode-testing-iconPassed)]" />,
    error: <Icon name="warning-circle" size={12} className="text-[var(--r-error)]" />,
  }[subagent.status];

  const hasActivities = subagent.activities.length > 0;

  return (
    <div className="ml-2 rounded-md border border-[var(--r-hairline)] border-l-[3px] border-l-[var(--r-accent-fainter)] bg-[var(--vscode-input-background)]/60 px-2 py-1.5">
      {/* Header */}
      <button
        onClick={() => hasActivities && setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 w-full text-left ${
          hasActivities ? 'cursor-pointer hover:bg-[var(--r-surface-soft)]' : 'cursor-default'
        } rounded-md px-1.5 py-1 transition-colors`}
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
        <Icon name="robot" size={14} className="shrink-0 text-[var(--r-ink-muted)]" />

        {/* Task description */}
        <span className="flex-1 truncate text-[11px] font-medium text-[var(--r-ink-strong)]">
          {subagent.task}
        </span>

        {/* Status icon */}
        <span className="shrink-0">{statusIcon}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && hasActivities && (
        <div className="mt-1.5 space-y-0.5 border-l border-[var(--r-hairline)] pl-5">
          {subagent.activities.map((activity, i) => (
            <ActivityCard key={`${activity.timestamp}-${i}`} activity={activity} />
          ))}
        </div>
      )}

      {/* Result when done */}
      {subagent.status === 'done' && subagent.result && (
        <div className="mt-1 ml-5 text-[10px] italic text-[var(--r-ink-muted)]">
          {subagent.result}
        </div>
      )}
    </div>
  );
}
