/**
 * CitationChips — clickable RAG source badges.
 */

import { FileText } from 'lucide-react';
import { useAISidebarStore } from './store';
import type { RAGCitation } from './types';

interface CitationChipsProps {
  citations: RAGCitation[];
}

export function CitationChips({ citations }: CitationChipsProps) {
  const openSource = useAISidebarStore((s) => s.openSource);

  if (!citations.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {citations.map((c, i) => (
        <button
          key={`${c.source}-${i}`}
          onClick={() => openSource(c.source, c.page)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] hover:opacity-80 cursor-pointer border-none"
          title={c.snippet}
        >
          <FileText size={10} />
          {c.citation}
        </button>
      ))}
    </div>
  );
}
