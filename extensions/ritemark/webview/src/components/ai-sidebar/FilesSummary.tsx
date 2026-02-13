/**
 * FilesSummary — "Modified 3 files" with expandable file list.
 */

import { FileText } from 'lucide-react';

interface FilesSummaryProps {
  files: string[];
}

export function FilesSummary({ files }: FilesSummaryProps) {
  if (!files.length) return null;

  return (
    <details className="mt-1 text-[11px]">
      <summary className="cursor-pointer select-none text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
        Modified {files.length} file{files.length !== 1 ? 's' : ''}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-1">
        {files.map((f) => (
          <li
            key={f}
            className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]"
          >
            <FileText size={10} className="shrink-0" />
            <span className="truncate">{f}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
