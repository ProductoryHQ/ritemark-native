/**
 * Base Node Component
 *
 * Shared styling and structure for all flow nodes.
 * Provides consistent look with VS Code theme integration.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../../lib/utils';

interface BaseNodeProps {
  children: React.ReactNode;
  label: string;
  icon: React.ReactNode;
  selected?: boolean;
  className?: string;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  headerColor?: string;
}

export function BaseNode({
  children,
  label,
  icon,
  selected,
  className,
  showSourceHandle = true,
  showTargetHandle = true,
  headerColor = 'var(--vscode-editor-background)',
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg border shadow-sm',
        'bg-[var(--vscode-editor-background)]',
        'border-[var(--vscode-panel-border)]',
        selected && 'ring-2 ring-[var(--vscode-focusBorder)]',
        className
      )}
    >
      {/* Target handle */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-[var(--vscode-button-background)] !border-[var(--vscode-panel-border)]"
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg border-b border-[var(--vscode-panel-border)]"
        style={{ background: headerColor }}
      >
        <span className="text-white opacity-80">
          {icon}
        </span>
        <span className="text-sm font-medium text-white truncate">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>

      {/* Source handle */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-[var(--vscode-button-background)] !border-[var(--vscode-panel-border)]"
        />
      )}
    </div>
  );
}

// Node field display component
interface NodeFieldProps {
  label: string;
  value: string;
  truncate?: boolean;
}

export function NodeField({ label, value, truncate = true }: NodeFieldProps) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-xs text-[var(--vscode-descriptionForeground)] mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          'text-sm text-[var(--vscode-foreground)]',
          truncate && 'truncate'
        )}
        title={value}
      >
        {value || <span className="italic opacity-50">Not set</span>}
      </div>
    </div>
  );
}
