/**
 * The Agenda block (the decks README, small details 14: "An agenda that writes itself"). A slide's `/Agenda` writes one
 * block to the file and nothing else:
 *
 *   ::: agenda
 *   :::
 *
 * Its list is never written: every view draws it from the deck as it is now, the deck's section slides by title, in
 * order and numbered (`agendaOf` in `slideRenderer.ts`), so a section added, renamed, skipped or deleted changes the
 * agenda with no edit to it.
 *
 *  - **In Present** (the wall and the presenter view's Now and Next), the sections before the agenda's own slide are
 *    passed and muted, and the next one is in the accent, so returning to the agenda between sections shows how far
 *    the day has come (`at`: the slide's place in the deck).
 *  - **The strip, the page and print** draw the current list, with no progress.
 *  - **A deck with no section slides** shows a quiet "Add a section slide to fill the agenda" in the editor only
 *    (`hint`); in Present and on the page it draws nothing.
 *
 * Pure, with no imports: the renderer (host and webview) and the stage's node view draw it with `agendaHtml`.
 */

/** The block's class (`::: agenda`, or `::: {.agenda}`), and the lines `/Agenda` writes. */
export const AGENDA_CLASS = 'agenda';
export const AGENDA_OPEN = '::: agenda';
export const AGENDA_CLOSE = ':::';

/** The editor's quiet line in a deck with no section slides (the README's words). */
export const AGENDA_HINT = 'Add a section slide to fill the agenda';

/** One section on the agenda: its title, and its slide's place in the deck (from 1). */
export interface AgendaEntry {
  title: string;
  number: number;
}

/** What an agenda draws, from the deck around it: its sections, and whether an empty one says so (the editor's). */
export interface AgendaDrawing {
  entries: readonly AgendaEntry[];
  hint: boolean;
}

/** Does a `:::` block's class list make it the Agenda? */
export function isAgendaClasses(classes: readonly string[]): boolean {
  return classes.includes(AGENDA_CLASS);
}

/** Escape text: `&`, `<`, `>`, and both quotes. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

/** Each section's mark in Present: passed (before the agenda's own slide), next (the first one from it on), or none. */
export type AgendaMark = 'passed' | 'next' | null;

/** The marks for an agenda on the slide at `at` (its place in the deck, from 1); none without `at`. */
export function agendaMarks(entries: readonly AgendaEntry[], at: number | null | undefined): AgendaMark[] {
  if (at === null || at === undefined || !Number.isFinite(at)) return entries.map(() => null);
  const next = entries.findIndex(entry => entry.number >= at);
  return entries.map((entry, index) => (entry.number < at ? 'passed' : index === next ? 'next' : null));
}

/**
 * The agenda's markup: a numbered list of the sections, each marked passed or next in Present (`at`), or the quiet
 * hint in an editor's deck with no sections, or nothing. Every word escaped.
 */
export function agendaHtml(drawing: AgendaDrawing | null | undefined, at?: number | null): string {
  const entries = drawing?.entries ?? [];
  if (!entries.length) return drawing?.hint ? `<div class="blk-agenda is-empty"><p class="blk-agenda-hint">${esc(AGENDA_HINT)}</p></div>\n` : '';
  const marks = agendaMarks(entries, at);
  const rows = entries.map((entry, index) => {
    const mark = marks[index];
    return `<li${mark ? ` class="is-${mark}"` : ''}><span class="blk-agenda-n">${index + 1}</span><span class="blk-agenda-t">${esc(entry.title)}</span></li>`;
  });
  return `<div class="blk-agenda"><ol>${rows.join('')}</ol></div>\n`;
}
