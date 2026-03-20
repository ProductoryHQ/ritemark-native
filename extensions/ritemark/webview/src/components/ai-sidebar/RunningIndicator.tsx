/**
 * RunningIndicator — single animated status line that updates in real-time.
 * Shows current status and running subagent count.
 */

import { Loader2, Bot } from 'lucide-react';
import type { AgentProgress, SubagentProgress } from './types';

interface RunningIndicatorProps {
  activities: AgentProgress[];
  subagents?: SubagentProgress[];
}

function getStatusText(activities: AgentProgress[]): string {
  if (!activities.length) return 'Starting...';

  const last = activities[activities.length - 1];

  if (last.type === 'compacting') return last.message;
  if (last.type === 'plan_text') return 'Planning...';
  if (last.type === 'thinking') return 'Thinking...';
  if (last.type === 'init') return 'Starting...';
  if (last.type === 'subagent_start') return `Starting: ${last.subagentTask || 'subagent'}`;
  if (last.type === 'subagent_progress') return last.message;
  if (last.type === 'subagent_done') return `Completed: ${last.message}`;
  if (last.type === 'tool_use') {
    const tool = last.tool || 'Tool';
    if (last.file) return `${tool}: ${last.file}`;
    if (last.message) return `${tool}: ${last.message}`;
    return `Running ${tool}...`;
  }
  if (last.message) return last.message;
  return 'Working...';
}

export function RunningIndicator({ activities, subagents }: RunningIndicatorProps) {
  const text = getStatusText(activities);
  const runningSubagents = subagents?.filter((s) => s.status === 'running').length || 0;

  return (
    <div className="flex items-center gap-2 py-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
      <Loader2 size={13} className="shrink-0 animate-spin" />
      <span className="truncate flex-1">{text}</span>
      {runningSubagents > 0 && (
        <span className="flex items-center gap-1 shrink-0 text-[var(--vscode-progressBar-background)]">
          <Bot size={11} />
          <span>{runningSubagents}</span>
        </span>
      )}
    </div>
  );
}
