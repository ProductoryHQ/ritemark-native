/**
 * ActivityCard — compact activity entry with icon + one line.
 */

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
  if (activity.type === 'error') return <Icon name="warning-circle" size={14} />;
  if (activity.type === 'done') return <Icon name="star-four" size={14} />;
  if (activity.type === 'text') return <Icon name="star-four" size={14} />;
  if (activity.type === 'subagent_start') return <Icon name="robot" size={14} className="text-[var(--vscode-progressBar-background)]" />;
  if (activity.type === 'subagent_progress') return <Icon name="robot" size={14} className="text-[var(--vscode-progressBar-background)]" />;
  if (activity.type === 'subagent_done') return <Icon name="check-circle" size={14} className="text-green-500" />;
  if (activity.tool && iconMap[activity.tool]) return iconMap[activity.tool];
  return <Icon name="terminal" size={14} />;
}

function getActivityLabel(activity: AgentProgress): string {
  if (activity.type === 'init') return 'Starting';
  if (activity.type === 'thinking') return 'Thinking';
  if (activity.type === 'tool_use') return activity.tool || 'Tool';
  if (activity.type === 'done') return 'Done';
  if (activity.type === 'error') return 'Error';
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
  return (
    <div className="flex items-start gap-2 text-[11px] py-0.5">
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
