/**
 * chatLinks — classification for links and file-path mentions inside rendered
 * chat markdown. Pure so it is unit-testable; RenderedMarkdown routes clicks
 * through this single decision.
 *
 * Jarmo's ask (v1.8.6 testing): a chat reply that links to a file in the
 * workspace ("[Koondfailis](koondfail.md)") must open that file in Ritemark's
 * own editor — not die silently, not open a browser.
 */

export type ChatLinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'file'; path: string }
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
  // ours to open from chat content.
  if (/^[a-z][a-z0-9+.-]*:/i.test(withoutLine)) return { kind: 'none' };
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
