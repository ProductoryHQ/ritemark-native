/**
 * SelectedContextTab — Sprint 64 bonus track (Sprint 62 option S5).
 *
 * Shows currently-selected editor text as a docked tab that visually connects
 * to the chat input card below. Replaces the old global SelectionIndicator
 * banner for the main conversation view; SelectionIndicator is still used in
 * Welcome and SetupWizard contexts where there's no chat input to anchor to.
 *
 * Close action detaches the selection from chat context only — it does not
 * clear the editor's selection (the editor is the source of truth and may
 * still be visibly selected, which is the user's intent).
 */

import { Icon } from '../ui/Icon';
import { useAISidebarStore } from './store';

const MAX_PREVIEW_CHARS = 140;

export function SelectedContextTab() {
  const selection = useAISidebarStore((s) => s.selection);
  const dismissSelectedContext = useAISidebarStore((s) => s.dismissSelectedContext);

  if (selection.isEmpty || !selection.text) return null;

  const preview =
    selection.text.length > MAX_PREVIEW_CHARS
      ? `${selection.text.substring(0, MAX_PREVIEW_CHARS)}…`
      : selection.text;

  return (
    <div
      className="
        mx-2.5 -mb-px px-2.5 py-1.5
        rounded-t-lg border border-b-0 border-[rgba(148,163,184,0.20)]
        bg-gradient-to-b from-[rgba(248,250,252,0.82)] to-[rgba(248,250,252,0.52)]
        dark:from-[rgba(25,22,53,0.62)] dark:to-[rgba(25,22,53,0.62)] dark:border-[rgba(129,140,248,0.16)]
      "
      role="status"
      aria-label="Selected editor context"
    >
      <div className="flex items-center gap-1.5">
        <Icon name="selection" size={11} className="shrink-0 opacity-60" />
        <span className="text-[11px] font-medium text-[var(--r-ink-muted)] flex-1 truncate">
          Working on selected text
        </span>
        <button
          onClick={dismissSelectedContext}
          className="
            shrink-0 inline-flex items-center justify-center
            w-4 h-4 rounded
            text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)]
            focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--r-ring-color)]
            transition-colors
          "
          aria-label="Remove selected text from chat context"
          title="Remove selected text from chat context"
        >
          <Icon name="x" size={10} />
        </button>
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[var(--r-ink-body)] truncate">
        {preview}
      </div>
    </div>
  );
}
