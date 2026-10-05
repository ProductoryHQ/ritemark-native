/**
 * SubagentCard - Collapsible card showing subagent task progress.
 *
 * Displays:
 * - Task description header
 * - Status indicator (spinner/checkmark/error)
 * - Collapsible nested activity feed
 * - Result when done
 *
 * Sprint 128: a subagent can run in the background, past the end of its turn.
 * The card says so, follows the task to its real end (completed, failed,
 * stopped, or ended with the session), and offers a stop button of its own
 * while the task runs — the main Stop only ends the current turn.
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { ActivityCard } from './ActivityCard';
import type { SubagentProgress } from './types';
import { subagentStatusText } from './backgroundWork';

interface SubagentCardProps {
  subagent: SubagentProgress;
  /** Stops this card's background task (Claude Code); absent when it cannot be stopped. */
  onStop?: (subagent: SubagentProgress) => void;
}

export function SubagentCard({ subagent, onStop }: SubagentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    running: <Icon name="circle-notch" size={12} className="animate-spin text-[var(--r-accent)]" />,
    stopping: <Icon name="circle-notch" size={12} className="animate-spin text-[var(--r-ink-muted)]" />,
    done: <Icon name="check" size={12} className="text-[var(--vscode-testing-iconPassed)]" />,
    error: <Icon name="warning-circle" size={12} className="text-[var(--r-error)]" />,
    stopped: <Icon name="x-circle" size={12} className="text-[var(--r-ink-muted)]" />,
    ended: <Icon name="minus" size={12} className="text-[var(--r-ink-muted)]" />,
  }[subagent.status];

  const hasActivities = subagent.activities.length > 0;
  const statusText = subagentStatusText(subagent);
  const canStop = Boolean(onStop && subagent.taskId && (subagent.status === 'running' || subagent.status === 'stopping'));

  return (
    <div className="ml-2 rounded-md border border-[var(--r-hairline)] border-l-[3px] border-l-[var(--r-accent-fainter)] bg-[color:color-mix(in_srgb,var(--vscode-input-background)_60%,transparent)] px-2 py-1.5">
      <div className="flex items-center gap-1">
        {/* Header */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => hasActivities && setIsExpanded(!isExpanded)}
          aria-expanded={hasActivities ? isExpanded : undefined}
          className={`h-auto min-w-0 flex-1 justify-start gap-2 rounded-md px-1.5 py-1 text-left font-normal has-[>svg]:px-1.5 ${
            hasActivities ? '' : 'cursor-default hover:bg-transparent'
          }`}
        >
          {/* Expand/collapse chevron */}
          {hasActivities ? (
            isExpanded ? (
              <Icon name="caret-down" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
            ) : (
              <Icon name="caret-right" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
            )
          ) : (
            <div className="w-3 shrink-0" />
          )}

          {/* Bot icon */}
          <Icon name="robot" size={14} className="shrink-0 text-[var(--r-ink-muted)]" />

          {/* Task description */}
          <span className="flex-1 truncate text-[11px] font-medium text-[var(--r-ink-strong)]">
            {subagent.task}
          </span>

          {/* Status icon */}
          <span className="shrink-0">{statusIcon}</span>
        </Button>

        {canStop && (
          <Tooltip label={subagent.status === 'stopping' ? 'Stopping this task…' : 'Stop this task'}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0 rounded-[6px] text-[var(--r-ink-muted)]"
              aria-label={subagent.status === 'stopping' ? 'Stopping this task' : `Stop ${subagent.task}`}
              disabled={subagent.status === 'stopping'}
              onClick={() => onStop?.(subagent)}
            >
              <Icon name="square" size={12} />
            </Button>
          </Tooltip>
        )}
      </div>

      {(statusText || subagent.detail) && (
        <div className="ml-5 truncate text-[10px] text-[var(--r-ink-muted)]">
          {[statusText, subagent.detail].filter(Boolean).join(' · ')}
        </div>
      )}

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
