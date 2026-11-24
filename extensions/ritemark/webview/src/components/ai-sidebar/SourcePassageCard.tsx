import { useEffect, useState } from 'react';
import type { SourcePassage, SourcePreview } from '../../utils/sourcePassage';
import { fileIconOf } from '../../lib/fileIcon';
import { Icon, type PhosphorIconName } from '../ui/Icon';
import { vscode } from '../../lib/vscode';
import { Button } from '../ui/button';
import { AnchoredHoverPopover } from '../ui/popover';
import { Tooltip } from '../ui/tooltip';

const fileKinds: Record<string, { label: string; icon: PhosphorIconName }> = {
  '.docx': { label: 'Word', icon: 'file-doc' },
  '.pdf': { label: 'PDF', icon: 'file-pdf' },
  '.pptx': { label: 'PowerPoint', icon: 'file-ppt' },
  '.md': { label: 'Markdown', icon: 'file-text' },
  '.markdown': { label: 'Markdown', icon: 'file-text' },
};

export function SourcePreviewBody({ preview, path, passage, onOpen }: {
  preview: SourcePreview | null;
  path: string;
  passage: SourcePassage;
  onOpen: (openLinkLocation: boolean) => void;
}) {
  if (!preview || 'error' in preview) {
    return <p role="status" className="break-words text-xs">{preview ? preview.error : 'Finding the passage…'}</p>;
  }

  const kind = fileKinds[preview.extension] ?? { label: 'Document', icon: 'file-text' };
  const unit = preview.extension === '.pptx' ? 'slide' : 'page';
  const page = preview.missing ? undefined : preview.page;
  const quote = preview.missing ? passage.text : preview.quote;
  const opensPassage = !preview.missing && !!preview.quote;
  const actionPage = preview.missing ? passage.page : page;
  const action = opensPassage ? 'Open at this passage'
    : actionPage ? `Open page ${actionPage}` : 'Open the document';
  const tip = opensPassage ? `Opens ${preview.name} at the quoted words`
    : actionPage ? `Opens ${preview.name} at ${unit} ${actionPage}` : `Opens ${preview.name}`;

  return (
    <div className="grid min-w-0 gap-2 break-words text-xs">
      <p className="flex min-w-0 items-center gap-1 whitespace-nowrap">
        <Icon name={fileIconOf(path, kind.icon)} size={14} className="shrink-0" />
        <span className="min-w-0 truncate font-semibold">{preview.name}</span>
        <span className="min-w-0 shrink-0 text-ink-muted"> · {kind.label}{page && `, ${unit} ${page}`}</span>
      </p>
      {quote && (
        <blockquote className={`m-0 border-l-2 border-accent-fainter bg-transparent py-0 pl-2 pr-0 ${preview.missing ? 'text-ink-muted' : 'text-ink'}`}>
          “{quote}”
        </blockquote>
      )}
      {preview.missing && <p>These words aren't in the document.</p>}
      <div className="min-w-0">
        <Tooltip label={tip}>
          <Button type="button" variant="link" size="sm" className="h-auto max-w-full justify-start px-0 text-xs" onClick={() => onOpen(preview.missing)}>
            <span aria-hidden="true">→</span><span className="truncate">{action}</span>
          </Button>
        </Tooltip>
      </div>
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
  onOpen: (openLinkLocation: boolean) => void;
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
    <AnchoredHoverPopover
      // Give Radix the loaded card's natural height for its first collision calculation.
      key={preview ? 'preview' : 'loading'}
      label="Source passage"
      collisionBoundary={anchor.closest('[data-chat-column]')}
      {...{ anchor, contentRef, onClose, onPointerEnter, onPointerLeave }}
    >
      <SourcePreviewBody preview={preview} path={path} passage={passage} onOpen={onOpen} />
    </AnchoredHoverPopover>
  );
}
