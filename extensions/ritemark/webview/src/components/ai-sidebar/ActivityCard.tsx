/**
 * ActivityCard — compact activity entry with icon + one line.
 */

import { Brain, Search, FileText, Terminal, Sparkles, AlertCircle, Play } from 'lucide-react';
import type { AgentProgress } from './types';

const iconMap: Record<string, React.ReactNode> = {
  Glob: <Search size={13} />,
  Grep: <Search size={13} />,
  Read: <FileText size={13} />,
  Write: <FileText size={13} />,
  Edit: <FileText size={13} />,
  Bash: <Terminal size={13} />,
  WebSearch: <Search size={13} />,
  WebFetch: <Search size={13} />,
};

function getActivityIcon(activity: AgentProgress) {
  if (activity.type === 'thinking') return <Brain size={13} />;
  if (activity.type === 'init') return <Play size={13} />;
  if (activity.type === 'error') return <AlertCircle size={13} />;
  if (activity.type === 'done') return <Sparkles size={13} />;
  if (activity.type === 'text') return <Sparkles size={13} />;
  if (activity.tool && iconMap[activity.tool]) return iconMap[activity.tool];
  return <Terminal size={13} />;
}

function getActivityLabel(activity: AgentProgress): string {
  if (activity.type === 'init') return 'Starting';
  if (activity.type === 'thinking') return 'Thinking';
  if (activity.type === 'tool_use') return activity.tool || 'Tool';
  if (activity.type === 'done') return 'Done';
  if (activity.type === 'error') return 'Error';
  if (activity.type === 'text') return 'Response';
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
      <span className="text-[var(--vscode-descriptionForeground)]">
        <span className="font-medium text-[var(--vscode-foreground)]">
          {getActivityLabel(activity)}
        </span>
        {activity.message && (
          <span className="ml-1.5">{activity.message}</span>
        )}
      </span>
    </div>
  );
}
