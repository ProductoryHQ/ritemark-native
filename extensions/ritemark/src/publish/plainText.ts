/**
 * Plain text for VS Code's notifications (Sprint 149, PR 4, the security review of #668). A notification's message
 * turns `[label](command:…)` into a link that runs the command when clicked (`notificationsViewer.ts` opens it with
 * `allowCommands: true`), and patch 018's brief toast and every `showXxxMessage` go there. A page's `<title>`, a file
 * name or a server's error text is not ours: a downloaded or AI-written page could otherwise put one click to any
 * command into a toast. Everything such a text puts into a line goes through here first.
 *
 * - Markdown's link characters (`[`, `]`, `(`, `)`, backticks) become spaces, so no link can form.
 * - Control and invisible characters (bidi overrides, zero-width marks) become spaces; whitespace folds to one space.
 * - A part (`plainPart`) is capped at 80 characters, a whole line (`plainLine`) at 400, with an ellipsis.
 */

/** C0 and C1 controls, zero-width marks, bidi embeddings, overrides and isolates, word joiners, the BOM. */
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;
/** What VS Code's linked-text parser needs for a link (`linkedText.ts`), and Markdown's code span. */
const LINK_CHARS = /[[\]()`]/g;

/** At most this many characters of a title, a file name or a server's text. */
export const PART_MAX = 80;
/** At most this many characters in a whole line. */
export const LINE_MAX = 400;

function neutralised(text: unknown): string {
  return String(text ?? '').replace(INVISIBLE, ' ').replace(LINK_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

function capped(text: string, max: number): string {
  const chars = Array.from(text); // by code point: an emoji is never cut in half
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

/** A title, a file name, a name or a server's text, as it may go into a line: no link syntax, one line, 80 at most. */
export function plainPart(text: unknown, max: number = PART_MAX): string {
  return capped(neutralised(text), max);
}

/** A whole line for a notification, a toast or a dialog: no link syntax, one line, 400 at most. */
export function plainLine(text: unknown): string {
  return capped(neutralised(text), LINE_MAX);
}

/** Whether a text could still form a link (or a code span) in a notification. For tests and asserts. */
export function hasLinkSyntax(text: string): boolean {
  return /[[\]()`]/.test(text);
}
