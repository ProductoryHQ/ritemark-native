/**
 * chatLinks — classification for links and file-path mentions inside rendered
 * chat markdown. Pure so it is unit-testable; RenderedMarkdown routes clicks
 * through this single decision.
 *
 * Jarmo's ask (v1.8.6 testing): a chat reply that links to a file in the
 * workspace ("[Koondfailis](koondfail.md)") must open that file in Ritemark's
 * own editor — not die silently, not open a browser.
 *
 * Sprint 122 (#282): no link is inert any more. The webview only sorts a link
 * by its syntax — web, local path, or a scheme we do not open. Whether a local
 * path is a file or a folder, inside the project or not, or missing, is the
 * host's call: it has the filesystem, the webview deliberately does not.
 */

export type ChatLinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'file'; path: string }
  /** A scheme chat content may not open (mailto:, vscode:, command:, …). Explained, never followed. */
  | { kind: 'unsupported'; href: string; scheme: string }
  | { kind: 'none' };

/** Classify an anchor href from rendered chat markdown. */
export function classifyChatHref(rawHref: string | null | undefined): ChatLinkTarget {
  const href = (rawHref ?? '').trim();
  if (!href || href.startsWith('#')) return { kind: 'none' };
  if (/^(https?:)/i.test(href)) return { kind: 'external', url: href };
  if (/^file:\/\//i.test(href)) {
    try {
      return { kind: 'file', path: stripLineSuffix(decodeURIComponent(new URL(href).pathname)) };
    } catch {
      return { kind: 'none' };
    }
  }
  // Codex review (PR #176): "README.md:12" — a root-level path with a line
  // suffix — must not be mistaken for a scheme. Strip the suffix first.
  const withoutLine = stripLineSuffix(href);
  // Any other scheme (mailto:, vscode:, command:, data:, javascript:) is not
  // ours to open from chat content — but the click says so instead of doing
  // nothing.
  const scheme = withoutLine.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme) return { kind: 'unsupported', href, scheme: scheme[1].toLowerCase() };
  // Scheme-less → treat as a workspace-relative (or absolute posix) file path.
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    // keep raw href if percent-decoding fails
  }
  return { kind: 'file', path: stripLineSuffix(decoded) };
}

/** "docs/plan.md:42" → "docs/plan.md" (line suffix is a convention, not a path). */
export function stripLineSuffix(path: string): string {
  return path.replace(/:\d+(?::\d+)?$/, '');
}

/**
 * What the host found at a local path. Mirrors `ChatLocalTargetKind` in
 * `src/views/chatLinkTargets.ts`; the host is the only one who can tell.
 */
export type ChatLocalKind =
  | 'project-file'
  | 'project-folder'
  | 'outside-file'
  | 'outside-folder'
  | 'missing'
  | 'inaccessible'
  | 'needs-folder';

export type ChatLinkAction = 'open' | 'reveal-in-project' | 'locate' | 'open-web' | 'copy';

export interface ChatLinkMenuItem {
  action: ChatLinkAction;
  label: string;
}

/**
 * The link's context menu, first item first. The first item is what an
 * ordinary click already does, so the menu never offers a surprise; the rest
 * are the destination-specific extras from the Sprint 122 plan. An
 * out-of-project path is only ever revealed or copied — never opened.
 */
export function chatLinkMenu(
  target: { kind: 'external' } | { kind: 'unsupported' } | { kind: 'local'; local: ChatLocalKind },
  platform: 'mac' | 'other',
): ChatLinkMenuItem[] {
  const locate: ChatLinkMenuItem = { action: 'locate', label: platform === 'mac' ? 'Locate in Finder' : 'Show in File Explorer' };
  const copyPath: ChatLinkMenuItem = { action: 'copy', label: 'Copy path' };
  const copyLink: ChatLinkMenuItem = { action: 'copy', label: 'Copy link' };

  if (target.kind === 'external') return [{ action: 'open-web', label: 'Open in browser' }, copyLink];
  if (target.kind === 'unsupported') return [copyLink];

  switch (target.local) {
    case 'project-file':
      return [{ action: 'open', label: 'Open' }, { action: 'reveal-in-project', label: 'Reveal in project' }, copyPath];
    case 'project-folder':
      return [{ action: 'reveal-in-project', label: 'Reveal in project' }, locate, copyPath];
    case 'outside-file':
    case 'outside-folder':
      return [locate, copyPath];
    case 'missing':
    case 'inaccessible':
    case 'needs-folder':
      return [copyPath];
  }
}
