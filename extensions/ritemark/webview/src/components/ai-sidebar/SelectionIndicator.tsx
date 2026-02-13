/**
 * SelectionIndicator — shows truncated selected text from the editor.
 */

import { TextSelect } from 'lucide-react';
import { useAISidebarStore } from './store';

export function SelectionIndicator() {
  const selection = useAISidebarStore((s) => s.selection);

  if (selection.isEmpty || !selection.text) return null;

  const displayText =
    selection.text.length > 60
      ? selection.text.substring(0, 60) + '...'
      : selection.text;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-[var(--vscode-inputValidation-infoBackground)] border-b border-[var(--vscode-panel-border)]">
      <TextSelect size={12} className="shrink-0 opacity-60" />
      <span className="text-[var(--vscode-descriptionForeground)]">Selected:</span>
      <span className="truncate">{displayText}</span>
    </div>
  );
}
