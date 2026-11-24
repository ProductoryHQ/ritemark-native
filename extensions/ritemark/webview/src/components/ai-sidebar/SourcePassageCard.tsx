import { useEffect, useState } from 'react';
import type { SourcePassage, SourcePreview } from '../../utils/sourcePassage';
import { vscode } from '../../lib/vscode';
import { Button } from '../ui/button';
import { AnchoredHoverPopover } from '../ui/popover';
import { Tooltip } from '../ui/tooltip';

export function SourcePreviewBody({ preview, onOpen }: { preview: SourcePreview | null; onOpen: () => void }) {
  return (
    <div className="grid w-[min(17rem,calc(100vw_-_42px))] gap-2 break-words text-xs">
      {!preview ? <p role="status">Finding the passage…</p> : 'error' in preview ? (
        <p role="status">{preview.error}</p>
      ) : (
        <>
          <div>
            <p className="font-semibold">{preview.name}</p>
            {preview.unit && <p className="text-ink-muted">{preview.unit}</p>}
          </div>
          {/* A quiet line beside the passage, no ground of its own (VS Code's webview blockquote ground read as a black bar in dark); the line as the Insights rail draws its quotes. */}
          {preview.quote && <blockquote className="m-0 border-l-2 border-accent-fainter bg-transparent py-0 pl-2 pr-0 text-ink">“{preview.quote}”</blockquote>}
          {preview.missing && <p>These words couldn't be found in the document.</p>}
          <div>
            <Tooltip label="Open at this passage">
              <Button size="sm" variant="secondary" onClick={onOpen}>Open at this passage</Button>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}

export function SourcePassageCard({
  anchor, path, passage, contentRef, onClose, onOpen, onPointerEnter, onPointerLeave,
}: {
  anchor: HTMLElement;
  path: string;
  passage: SourcePassage;
  contentRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  onOpen: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  useEffect(() => {
    const requestId = crypto.randomUUID();
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'chat:source/previewed' && message.requestId === requestId) setPreview(message.preview);
    };
    window.addEventListener('message', receive);
    vscode.postMessage({ type: 'chat:source/preview', requestId, filePath: path, passage });
    return () => window.removeEventListener('message', receive);
  }, [path, passage]);

  return (
    <AnchoredHoverPopover label="Source passage" {...{ anchor, contentRef, onClose, onPointerEnter, onPointerLeave }}>
      <SourcePreviewBody preview={preview} onOpen={onOpen} />
    </AnchoredHoverPopover>
  );
}
