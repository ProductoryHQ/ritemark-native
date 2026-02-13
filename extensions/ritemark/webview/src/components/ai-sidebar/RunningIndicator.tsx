/**
 * RunningIndicator — single animated status line that updates in real-time.
 */

import { Loader2 } from 'lucide-react';
import type { AgentProgress } from './types';

interface RunningIndicatorProps {
  activities: AgentProgress[];
}

function getStatusText(activities: AgentProgress[]): string {
  if (!activities.length) return 'Starting...';

  const last = activities[activities.length - 1];

  if (last.type === 'thinking') return 'Thinking...';
  if (last.type === 'init') return 'Starting...';
  if (last.type === 'tool_use') {
    const tool = last.tool || 'Tool';
    if (last.file) return `${tool}: ${last.file}`;
    if (last.message) return `${tool}: ${last.message}`;
    return `Running ${tool}...`;
  }
  if (last.message) return last.message;
  return 'Working...';
}

export function RunningIndicator({ activities }: RunningIndicatorProps) {
  const text = getStatusText(activities);

  return (
    <div className="flex items-center gap-2 py-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
      <Loader2 size={13} className="shrink-0 animate-spin" />
      <span className="truncate">{text}</span>
    </div>
  );
}
