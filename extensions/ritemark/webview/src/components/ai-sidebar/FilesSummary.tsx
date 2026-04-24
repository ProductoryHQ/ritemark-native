/**
 * FilesSummary — "Modified 3 files" with expandable file list.
 */

import { Icon } from '../ui/Icon';

interface FilesSummaryProps {
  files: string[];
}

export function FilesSummary({ files }: FilesSummaryProps) {
  if (!files.length) return null;

  return (
    <details className="mt-1 text-[11px]">
      <summary className="cursor-pointer select-none text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)]">
        Modified {files.length} file{files.length !== 1 ? 's' : ''}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-1">
        {files.map((f) => (
          <li
            key={f}
            className="flex items-center gap-1 text-[10px] text-[var(--r-ink-muted)]"
          >
            <Icon name="file-text" size={12} className="shrink-0" />
            <span className="truncate">{f}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
