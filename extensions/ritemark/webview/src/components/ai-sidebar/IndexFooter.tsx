/**
 * IndexFooter — document count + Re-index/Cancel buttons.
 */

import { useAISidebarStore } from './store';

export function IndexFooter() {
  const indexStatus = useAISidebarStore((s) => s.indexStatus);
  const indexProgress = useAISidebarStore((s) => s.indexProgress);
  const isIndexing = useAISidebarStore((s) => s.isIndexing);
  const reindex = useAISidebarStore((s) => s.reindex);
  const cancelIndex = useAISidebarStore((s) => s.cancelIndex);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--vscode-panel-border)] text-[10px] text-[var(--vscode-descriptionForeground)]">
      <span>
        {isIndexing && indexProgress
          ? `Indexing ${indexProgress.processed}/${indexProgress.total}: ${indexProgress.current}`
          : indexStatus.totalDocs > 0
            ? `${indexStatus.totalDocs} docs`
            : ''}
      </span>
      {isIndexing ? (
        <button
          onClick={cancelIndex}
          className="bg-transparent border-none text-[var(--vscode-errorForeground)] cursor-pointer text-[10px] px-1 py-0.5 hover:underline"
        >
          Cancel
        </button>
      ) : (
        <button
          onClick={reindex}
          className="bg-transparent border-none text-[var(--vscode-textLink-foreground)] cursor-pointer text-[10px] px-1 py-0.5 hover:underline"
        >
          Re-index
        </button>
      )}
    </div>
  );
}
