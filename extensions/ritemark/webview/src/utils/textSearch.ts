/**
 * Case-insensitive text search shared by the transcript (Sprint 123) and the
 * document previews (Sprint 124). Pure functions.
 */

/**
 * Lower-case one character at a time, keeping every offset in place: a
 * character whose lower case has a different length (the Turkish dotted I is
 * one) is compared as it is, so offsets found in the lowered text are offsets
 * in the original.
 */
export function foldCase(text: string): string {
  let folded = '';
  for (const char of text) {
    const lower = char.toLowerCase();
    folded += lower.length === char.length ? lower : char;
  }
  return folded;
}

/** The query as it is matched: surrounding space ignored, case folded. */
export function normalizeQuery(query: string): string {
  return foldCase(query.trim());
}

/** Start offsets of every non-overlapping match of `needle` (already normalized) in `text`. */
export function findAll(text: string, needle: string): number[] {
  if (!needle) return [];
  const haystack = foldCase(text);
  const starts: number[] = [];
  for (let from = 0; ; ) {
    const start = haystack.indexOf(needle, from);
    if (start < 0) break;
    starts.push(start);
    from = start + needle.length;
  }
  return starts;
}

/** The next or previous match, wrapping at the ends. */
export function stepMatch(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}

/** "3 of 12", "No matches", or nothing for an empty query. */
export function matchCountLabel(current: number, count: number, query: string): string {
  if (!normalizeQuery(query)) return '';
  if (count === 0) return 'No matches';
  return `${current + 1} of ${count}`;
}
