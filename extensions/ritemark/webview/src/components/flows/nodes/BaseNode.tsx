/**
 * Base Node Component
 *
 * Shared structure for all flow steps. Ritemark 2.0 (experience 31; kit: theme.html .node): a 200-wide sheet with
 * radius 10 on the desk, a 40 header with the step's kind chip and its name, label and value rows in 12, and ports
 * as small rings, indigo while the step is chosen.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../../lib/utils';
import { Icon } from '../../ui/Icon';
import { stepInfo } from '../stepKinds';

interface BaseNodeProps {
  children: React.ReactNode;
  /** The node type (stepKinds.ts): its icon and its kind's colour. */
  type: string;
  label: string;
  selected?: boolean;
  className?: string;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  /** Execution order step number (1-indexed) */
  executionStep?: number;
}

const PORT = '!h-2.5 !w-2.5 !rounded-full !border-0 !bg-[var(--r-surface)]';

export function BaseNode({
  children,
  type,
  label,
  selected,
  className,
  showSourceHandle = true,
  showTargetHandle = true,
  executionStep,
}: BaseNodeProps) {
  const step = stepInfo(type);
  const port = cn(PORT, selected ? '!shadow-[inset_0_0_0_2px_var(--r-accent)]' : '!shadow-[inset_0_0_0_2px_var(--r-hairline-strong)]');
  return (
    <div
      className={cn(
        'w-[200px] rounded-[10px] bg-[var(--r-surface)]',
        selected ? 'rm-step-node-on' : 'rm-step-node',
        className
      )}
    >
      {/* Target handle */}
      {showTargetHandle && <Handle type="target" position={Position.Top} className={port} />}

      {/* Header */}
      <div className="flex h-10 items-center gap-2 border-b border-[var(--r-hairline)] px-3">
        <span className={cn('rm-step-chip', step?.kind ?? 'ai')} aria-hidden="true">
          <Icon name={step?.icon ?? 'lightning'} size={14} tone="inherit" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-[18px] text-[var(--r-ink-strong)]">
          {label}
        </span>
        {/* Execution step: its place in the run order */}
        {executionStep !== undefined && (
          <span className="flex-none text-[11px] leading-4 text-[var(--r-ink-muted)]" title={`Step ${executionStep} in the run`}>
            {executionStep}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1 px-3 pb-2.5 pt-2">{children}</div>

      {/* Source handle */}
      {showSourceHandle && <Handle type="source" position={Position.Bottom} className={port} />}
    </div>
  );
}

// A label and its value on one line (kit: .node .kv)
interface NodeFieldProps {
  label: string;
  value: string;
  truncate?: boolean;
}

export function NodeField({ label, value, truncate = true }: NodeFieldProps) {
  return (
    <div className="flex gap-2 text-[12px] leading-4">
      <span className="w-[52px] flex-none text-[var(--r-ink-muted)]">{label}</span>
      <span className={cn('min-w-0 text-[var(--r-ink-body)]', truncate && 'truncate')} title={value}>
        {value || <span className="italic opacity-60">Not set</span>}
      </span>
    </div>
  );
}
