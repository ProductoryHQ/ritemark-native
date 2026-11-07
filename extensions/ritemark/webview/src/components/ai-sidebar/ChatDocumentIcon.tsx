/**
 * Sprint 155 (PR 2) — a chat's document icon (experience 45).
 *
 * The image is the file's own icon from Ritemark's file icon theme, resolved on
 * the host (`src/views/chatDocuments.ts`). It is drawn as a mask in the text
 * colour, so it takes the muted ink at rest and the accent on hover, in Light
 * and Dark alike, as the rail's buttons do; the theme's icons are one colour.
 */
import type { CSSProperties } from 'react';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { chatDocumentLabel, chatDocumentTooltip, type ChatDocumentView } from './chatDocument';

/** The file icon at `size`, in the current text colour. */
export function FileIconMask({ iconUri, size }: { iconUri: string; size: number }) {
  const image = `url("${iconUri}")`;
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: 'currentColor',
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
  return <span aria-hidden="true" data-file-icon="" className="block shrink-0" style={style} />;
}

/**
 * The head's icon: 16 in a 24 square, 8 from the sheet's left edge (the head's
 * 12 less 4), the name 6 later (the head's gap of 8 less 2). Hover is the soft
 * accent fill with the icon in accent; keyboard focus draws the ring and opens
 * the tooltip; a press deepens the accent. The ring sits inside the square (the
 * prototype's -2 offset), so it never runs into the name 6 later or the sheet's edge.
 */
export function ChatDocumentButton({ document, onBringForward }: { document: ChatDocumentView; onBringForward: () => void }) {
  return (
    <Tooltip label={chatDocumentTooltip(document)} className="-ml-1 -mr-0.5 shrink-0">
      <Button
        type="button"
        variant="ghost"
        aria-label={chatDocumentLabel(document)}
        data-chat-document=""
        onClick={onBringForward}
        className="size-6 shrink-0 rounded-[6px] p-0 text-[var(--r-ink-muted)] hover:bg-[var(--r-accent-soft)] hover:text-[var(--r-accent)] focus-visible:text-[var(--r-accent)] focus-visible:!outline-offset-[-2px] active:bg-[var(--r-accent-soft)] active:text-[var(--r-accent-deep)]"
      >
        <FileIconMask iconUri={document.iconUri} size={16} />
      </Button>
    </Tooltip>
  );
}
