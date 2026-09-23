/**
 * Sprint 122 (#282) — the context menu of a link in a chat reply.
 *
 * Opened by right-click (or the keyboard's context-menu key) on a link. What
 * it offers depends on where the link goes, and for a local path only the host
 * knows that, so the menu asks (`chat:link/resolve`) before it lists anything.
 * Every item is a request; the host re-checks it against the filesystem before
 * it opens, reveals or locates anything (`src/views/chatLinkTargets.ts`).
 */
import { useEffect, useRef, useState } from 'react';
import { vscode } from '../../lib/vscode';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Icon, type PhosphorIconName } from '../ui/Icon';
import { chatLinkMenu, type ChatLinkAction, type ChatLinkMenuItem, type ChatLocalKind } from './chatLinks';

export type ChatLinkMenuTarget =
  | { kind: 'external'; url: string }
  | { kind: 'file'; path: string }
  | { kind: 'unsupported'; href: string };

export interface ChatLinkMenuRequest {
  x: number;
  y: number;
  target: ChatLinkMenuTarget;
  /** The link that was right-clicked; focus goes back to it when the menu closes. */
  anchor: HTMLElement;
}

const ICONS: Record<ChatLinkAction, PhosphorIconName> = {
  open: 'file-text',
  'reveal-in-project': 'folder-open',
  locate: 'magnifying-glass',
  'open-web': 'arrow-square-out',
  copy: 'copy',
};

const PLATFORM: 'mac' | 'other' =
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'other';

let resolveCounter = 0;

function textOf(target: ChatLinkMenuTarget): string {
  return target.kind === 'external' ? target.url : target.kind === 'file' ? target.path : target.href;
}

function run(item: ChatLinkMenuItem, target: ChatLinkMenuTarget): void {
  if (item.action === 'copy') {
    vscode.postMessage({ type: 'chat:link-action', action: 'copy', text: textOf(target) });
  } else if (item.action === 'open-web' && target.kind === 'external') {
    vscode.postMessage({ type: 'chat:link-action', action: 'open-web', url: target.url });
  } else if (target.kind === 'file') {
    vscode.postMessage({ type: 'chat:link-action', action: item.action, path: target.path });
  }
}

export function ChatLinkMenu({ request, onClose }: { request: ChatLinkMenuRequest; onClose: () => void }) {
  const { target } = request;
  const [local, setLocal] = useState<ChatLocalKind | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (target.kind !== 'file') return;
    const requestId = `chat-link-${++resolveCounter}`;
    const listener = (event: MessageEvent) => {
      const message = event.data as { type?: string; requestId?: string; kind?: ChatLocalKind };
      if (message?.type === 'chat:link/resolved' && message.requestId === requestId && message.kind) setLocal(message.kind);
    };
    window.addEventListener('message', listener);
    vscode.postMessage({ type: 'chat:link/resolve', requestId, path: target.path });
    return () => window.removeEventListener('message', listener);
  }, [target]);

  const items =
    target.kind === 'file'
      ? local
        ? chatLinkMenu({ kind: 'local', local }, PLATFORM)
        : null
      : chatLinkMenu({ kind: target.kind }, PLATFORM);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };

  return (
    <DropdownMenu open modal={false} onOpenChange={(open) => { if (!open) close(); }}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden="true" style={{ position: 'fixed', left: request.x, top: request.y, width: 0, height: 0 }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        aria-label="Link actions"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          request.anchor.focus({ preventScroll: true });
        }}
      >
        {items === null ? (
          <DropdownMenuItem disabled>Checking the link…</DropdownMenuItem>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={`${item.action}-${item.label}`} onSelect={() => run(item, target)}>
              <Icon name={ICONS[item.action]} size={14} />
              {item.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
