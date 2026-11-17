/**
 * A wide table that scrolls keeps sensible column widths (the Experience lead on #780, 17 November 2026). Since #780 a
 * wide table in a deck's handout (and on its published page) scrolls sideways in its own frame, so no column needs to
 * squeeze. The rule:
 *  - each column keeps at least its widest word (the browser's own minimum for a table's column; nothing here goes
 *    under it);
 *  - a text column keeps at least about 200 px, or its stored width (#772's dash-count form, a share of the width the
 *    table has when it fits), whichever is larger, so a note wraps into two or three lines, not one word per line;
 *  - a text column never asks for more than its longest note on one line, so a short note stays on one line and
 *    takes no more room than it needs;
 *  - a number column stays as narrow as its widest word.
 *
 * Which column is text is read from its body cells' words (the header doesn't count): a column is text when one of
 * its cells holds two or more words with a letter among them. A cell of numbers ("412", "1 200 €") or one word isn't.
 * A column read as text by mistake costs nothing, since it never asks for more than its longest cell on one line.
 *
 * The floor is drawn, never written, in CSS units the browser resolves itself (`cqw` of the table's frame for the
 * stored share, `ch` for the note's length), so nothing is measured. The deck view's handout sets it as the `<col>`'s
 * `min-width` (Chromium keeps a column at it); the published page, read in any browser, as a spacer in the column's
 * header cell (`pageHtml.ts`).
 *
 * Pure, with no imports: the page builder (host) and the editors (webview) use these same functions.
 */

/** A text column's least width, in CSS pixels. */
export const TEXT_COLUMN_MIN = 200

/** A text column's floor: at least 200 px, or `share` % of its frame when larger, but never more than `chars` on one line. */
export interface ColumnFloor {
  /** The column's stored share of the table's width, in percent; 0 when the table has automatic widths. */
  share: number
  /** The column's longest body cell, in characters. */
  chars: number
}

/** A cell's words as one line: runs of white space as one space, trimmed. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Two or more words with a letter among them: a note, not a number or a single word. */
export function isProse(text: string): boolean {
  const line = oneLine(text)
  return /\S \S/.test(line) && /\p{L}/u.test(line)
}

/**
 * Each column's floor, from its body cells' plain text (rows under the header, one string per cell) and its stored
 * shares (`percents`, or null for automatic widths); null for a column that keeps only its widest word.
 */
export function columnFloors(bodyRows: string[][], columns: number, percents: number[] | null): (ColumnFloor | null)[] {
  const floors: (ColumnFloor | null)[] = []
  for (let col = 0; col < columns; col++) {
    let text = false
    let chars = 0
    for (const row of bodyRows) {
      const cell = oneLine(row[col] ?? '')
      if (isProse(cell)) text = true
      chars = Math.max(chars, [...cell].length)
    }
    floors.push(text ? { share: percents?.[col] ?? 0, chars } : null)
  }
  return floors
}

/**
 * The floor as a CSS length for a `<col>`'s `min-width`: `min(max(200px, <share>cqw), calc(<chars>ch + 2em))`. A
 * `<col>`'s width holds the cell's padding, so the note's length gets 2em more (the cell's padding is under 1em a side).
 */
export function floorCss(floor: ColumnFloor): string {
  const least = floor.share > 0 ? `max(${TEXT_COLUMN_MIN}px, ${floor.share}cqw)` : `${TEXT_COLUMN_MIN}px`
  return `min(${least}, calc(${floor.chars}ch + 2em))`
}
