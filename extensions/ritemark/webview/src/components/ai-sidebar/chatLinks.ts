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

import { decodeSourcePassage, type SourcePassage } from '../../utils/sourcePassage';

export type ChatLinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'file'; path: string; passage?: SourcePassage }
  /** A scheme chat content may not open (mailto:, vscode:, command:, …). Explained, never followed. */
  | { kind: 'unsupported'; href: string; scheme: string }
  | { kind: 'none' };

/** Classify an anchor href from rendered chat markdown. */
export function classifyChatHref(rawHref: string | null | undefined): ChatLinkTarget {
  let href = (rawHref ?? '').trim();
  if (!href || href.startsWith('#')) return { kind: 'none' };
  if (/^(https?:)/i.test(href)) return { kind: 'external', url: href };
  // Split before decoding the path so an encoded '#' stays part of the filename.
  let passage: SourcePassage | undefined;
  const hash = href.indexOf('#');
  const fragment = hash < 0 ? '' : href.slice(hash + 1);
  if (/^(?:p|q)=/.test(fragment)) {
    href = href.slice(0, hash);
    const params = new URLSearchParams(fragment);
    const page = params.get('p');
    const quote = params.get('q');
    try {
      // URLSearchParams tolerates broken escapes. A malformed quote is a plain file link.
      if (quote !== null) decodeURIComponent(fragment);
      passage = decodeSourcePassage({
        text: quote ?? undefined,
        page: page && /^\d+$/.test(page) ? Number(page) : undefined,
      });
    } catch {
      // Keep the file link.
    }
  }
  const file = (path: string): ChatLinkTarget => ({
    kind: 'file', path: stripLineSuffix(path), ...(passage ? { passage } : {}),
  });
  if (/^file:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      const path = decodeURIComponent(url.pathname);
      if (passage && url.hostname) return { kind: 'none' };
      return file(passage ? path.replace(/^\/(?=[a-z]:\/)/i, '') : path);
    } catch {
      return { kind: 'none' };
    }
  }
  // Codex review (PR #176): "README.md:12" — a root-level path with a line
  // suffix — must not be mistaken for a scheme. Strip the suffix first.
  const withoutLine = stripLineSuffix(href);
  // Sprint 140: a Windows path ("C:\\Work\\Plan.docx", as Codex cites files on Windows) is a file, not a "c:" scheme.
  let windowsPath = href;
  try {
    windowsPath = decodeURIComponent(href);
  } catch {
    // keep raw href if percent-decoding fails
  }
  if (/^[a-z]:[\\/]/i.test(windowsPath)) return file(windowsPath);
  // Any other scheme (mailto:, vscode:, command:, data:, javascript:) is not
  // ours to open from chat content — but the click says so instead of doing
  // nothing.
  const scheme = withoutLine.match(/^([a-z][a-z0-9+.-]*):/i)
    ?? (fragment && /^[a-z][a-z0-9+-]*$/i.test(withoutLine) ? href.match(/^([a-z][a-z0-9+-]*):/i) : null);
  if (scheme) return { kind: 'unsupported', href, scheme: scheme[1].toLowerCase() };
  // Scheme-less → treat as a workspace-relative (or absolute posix) file path.
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    // keep raw href if percent-decoding fails
  }
  return file(decoded);
}

/**
 * Sprint 140 (the #497 spike): Codex 0.163 cites a file it read as
 * `:codex-file-citation{path="/…/Tender.pdf" purpose="source"}`, which 2.0.1
 * drew as raw text in ChatGPT's answers. It becomes a link to the file, by its
 * name, which opens it as any other file link in chat does.
 */
export function rewriteCodexCitations(content: string): string {
  return content.replace(/:codex-file-citation\{([^}\n]*)\}/g, (whole, attributes: string) => {
    const path = /(?:^|\s)path="([^"\n]+)"/.exec(attributes)?.[1];
    if (!path) return whole;
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const label = name.replace(/([\\`*_[\]])/g, '\\$1');
    const href = encodeURI(path).replace(/#/g, '%23').replace(/\(/g, '%28').replace(/\)/g, '%29');
    return `[${label}](${href})`;
  });
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
