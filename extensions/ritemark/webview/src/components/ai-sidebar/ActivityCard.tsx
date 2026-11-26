/**
 * ActivityCard — compact activity entry with icon + one line.
 */

import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { isHiddenToolActivity, stepLabel } from './stepLabel';
import { Icon } from '../ui/Icon';
import type { AgentProgress } from './types';

const iconMap: Record<string, React.ReactNode> = {
  Glob: <Icon name="magnifying-glass" size={14} />,
  Grep: <Icon name="magnifying-glass" size={14} />,
  Read: <Icon name="file-text" size={14} />,
  Write: <Icon name="file-text" size={14} />,
  Edit: <Icon name="file-text" size={14} />,
  Bash: <Icon name="terminal" size={14} />,
  WebSearch: <Icon name="magnifying-glass" size={14} />,
  WebFetch: <Icon name="magnifying-glass" size={14} />,
  Agent: <Icon name="robot" size={14} />,
  Task: <Icon name="robot" size={14} />,
};

function getActivityIcon(activity: AgentProgress) {
  if (activity.type === 'thinking') return <Icon name="brain" size={14} />;
  if (activity.type === 'init') return <Icon name="play" size={14} />;
  if (activity.type === 'error' || activity.type === 'notice') return <Icon name="warning-circle" size={14} />;
  if (activity.type === 'done') return <Icon name="star-four" size={14} />;
  if (activity.type === 'text') return <Icon name="star-four" size={14} />;
  if (activity.type === 'subagent_start') return <Icon name="robot" size={14} className="text-[var(--r-ink-strong)]" />;
  if (activity.type === 'subagent_progress') return <Icon name="robot" size={14} className="text-[var(--r-ink-strong)]" />;
  // Sprint 145 (#578): in the icons' own muted ink, as 'done' above; green is only the ready dot
  if (activity.type === 'subagent_done') return <Icon name="check-circle" size={14} />;
  if (activity.tool && iconMap[activity.tool]) return iconMap[activity.tool];
  return <Icon name="terminal" size={14} />;
}

function getActivityLabel(activity: AgentProgress): string {
  if (activity.type === 'init') return 'Starting';
  if (activity.type === 'thinking') return 'Thinking';
  if (activity.type === 'tool_use') return activity.tool || 'Tool';
  if (activity.type === 'done') return 'Done';
  if (activity.type === 'error') return 'Error';
  if (activity.type === 'notice') return 'Notice';
  if (activity.type === 'text') return 'Response';
  if (activity.type === 'subagent_start') return 'Subagent';
  if (activity.type === 'subagent_progress') return 'Subagent';
  if (activity.type === 'subagent_done') return 'Subagent done';
  return activity.type;
}

interface ActivityCardProps {
  activity: AgentProgress;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const step = stepLabel(activity);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (isHiddenToolActivity(activity)) return null;
  if (step) {
    const indicator = step.warning ? 'warning' : activity.step?.status === 'completed' ? 'check' : 'circle-notch';
    const row = (
      <>
        <Icon name={indicator} className="size-3" tone="inherit" />
        <Icon name={step.icon} className="size-3.5" tone="inherit" />
        <span className="min-w-0 truncate">{step.label}</span>
      </>
    );
    const color = step.warning ? 'text-[var(--r-warning-ink)]' : 'text-[var(--r-ink-muted)]';
    return (
      <div className={color}>
        {step.detail ? (
          <Tooltip className="flex min-w-0" label={expanded ? 'Hide step details' : 'Show step details'}>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full min-w-0 justify-start gap-1.5 px-1 py-0.5 text-[11px] font-normal"
              aria-expanded={expanded}
              aria-controls={expanded ? id : undefined}
              onClick={() => setExpanded(!expanded)}
            >
              {row}
            </Button>
          </Tooltip>
        ) : <div className="flex min-w-0 items-center gap-1.5 px-1 py-0.5 text-[11px]">{row}</div>}
        {expanded && (
          <pre id={id} className="ml-4 whitespace-pre-wrap break-all px-1 text-[11px]">{step.detail}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded px-1 py-0.5 text-[11px]">
      <span className="shrink-0 mt-0.5 opacity-50">
        {getActivityIcon(activity)}
      </span>
      <span className="text-[var(--r-ink-muted)]">
        <span className="font-medium text-[var(--r-ink-strong)]">
          {getActivityLabel(activity)}
        </span>
        {activity.message && (
          <span className="ml-1.5">{activity.message}</span>
        )}
      </span>
    </div>
  );
}
