/**
 * WidgetPreview — edit preview with Apply/Discard buttons.
 */

import { Check, X } from 'lucide-react';
import { useAISidebarStore } from './store';
import type { WidgetData } from './types';

interface WidgetPreviewProps {
  widget: WidgetData;
  messageId: string;
}

export function WidgetPreview({ widget, messageId }: WidgetPreviewProps) {
  const applyWidget = useAISidebarStore((s) => s.applyWidget);
  const discardWidget = useAISidebarStore((s) => s.discardWidget);

  return (
    <div className="mt-2">
      <div className="rounded p-2 text-xs whitespace-pre-wrap bg-[var(--vscode-inputValidation-infoBackground)] border border-[var(--vscode-focusBorder)]">
        {widget.preview}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => applyWidget(widget)}
          className="inline-flex items-center gap-1 px-3 py-1 text-[11px] rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] border-none cursor-pointer"
        >
          <Check size={12} />
          Apply
        </button>
        <button
          onClick={() => discardWidget(messageId)}
          className="inline-flex items-center gap-1 px-3 py-1 text-[11px] rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] border-none cursor-pointer"
        >
          <X size={12} />
          Discard
        </button>
      </div>
    </div>
  );
}
