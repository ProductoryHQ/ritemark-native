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
import { ChevronRight, ChevronDown, Loader2, Check, AlertCircle, Bot } from 'lucide-react';
import { ActivityCard } from './ActivityCard';
import type { SubagentProgress } from './types';

interface SubagentCardProps {
  subagent: SubagentProgress;
}

export function SubagentCard({ subagent }: SubagentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    running: <Loader2 size={12} className="animate-spin text-[var(--vscode-progressBar-background)]" />,
    done: <Check size={12} className="text-green-500" />,
    error: <AlertCircle size={12} className="text-[var(--vscode-errorForeground)]" />,
  }[subagent.status];

  const hasActivities = subagent.activities.length > 0;

  return (
    <div className="ml-3 border-l-2 border-[var(--vscode-progressBar-background)] pl-3 py-1">
      {/* Header */}
      <button
        onClick={() => hasActivities && setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 w-full text-left ${
          hasActivities ? 'cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]' : 'cursor-default'
        } rounded px-1.5 py-1 -mx-1.5 transition-colors`}
        disabled={!hasActivities}
      >
        {/* Expand/collapse chevron */}
        {hasActivities ? (
          isExpanded ? (
            <ChevronDown size={12} className="shrink-0 text-[var(--vscode-descriptionForeground)]" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-[var(--vscode-descriptionForeground)]" />
          )
        ) : (
          <div className="w-3" />
        )}

        {/* Bot icon */}
        <Bot size={13} className="shrink-0 text-[var(--vscode-progressBar-background)]" />

        {/* Task description */}
        <span className="flex-1 text-[11px] truncate text-[var(--vscode-foreground)]">
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
        <div className="mt-1 ml-5 text-[10px] text-[var(--vscode-descriptionForeground)] italic">
          {subagent.result}
        </div>
      )}
    </div>
  );
}
