/**
 * Trigger Node Component
 *
 * The starting point of every flow.
 * Contains all flow-level inputs that users fill when running.
 * Only ONE Trigger node per flow.
 */

import { memo } from 'react';
import { Zap, FileText, File } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../../lib/utils';
import type { FlowInput } from '../stores/flowEditorStore';

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  inputs: FlowInput[];
}

interface TriggerNodeProps {
  data: TriggerNodeData;
  selected?: boolean;
}

function TriggerNodeComponent({ data, selected }: TriggerNodeProps) {
  const inputs = data.inputs || [];

  return (
    <div
      className={cn(
        'min-w-[220px] rounded-lg border shadow-sm',
        'bg-[var(--vscode-editor-background)]',
        'border-[var(--vscode-panel-border)]',
        selected && 'ring-2 ring-[var(--vscode-focusBorder)]'
      )}
    >
      {/* Header - Blue for Trigger */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg border-b border-[var(--vscode-panel-border)]"
        style={{ background: '#2563eb' }}
      >
        <Zap className="text-white opacity-80" size={16} />
        <span className="text-sm font-medium text-white truncate">
          {data.label || 'Trigger'}
        </span>
      </div>

      {/* Content - List of inputs */}
      <div className="p-3">
        {inputs.length === 0 ? (
          <div className="text-xs text-[var(--vscode-descriptionForeground)] italic">
            No inputs configured
          </div>
        ) : (
          <div className="space-y-2">
            {inputs.map((input) => (
              <div
                key={input.id}
                className="flex items-center gap-2 text-sm"
              >
                {input.type === 'text' ? (
                  <FileText size={14} className="text-[var(--vscode-descriptionForeground)]" />
                ) : (
                  <File size={14} className="text-[var(--vscode-descriptionForeground)]" />
                )}
                <span className="text-[var(--vscode-foreground)] truncate flex-1">
                  {input.label}
                </span>
                {input.required && (
                  <span className="text-[var(--vscode-errorForeground)] text-xs">*</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-[var(--vscode-panel-border)]">
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            {inputs.length} input{inputs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Source handle - Trigger only outputs */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[var(--vscode-button-background)] !border-[var(--vscode-panel-border)]"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
