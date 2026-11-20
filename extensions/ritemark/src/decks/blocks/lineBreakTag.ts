/**
 * #923: the line break the editor writes inside a heading (and a table cell) is `<br>`, since `\` and a newline would
 * end an ATX heading. One place says what counts as that break, for every reader that draws or names a heading: the
 * slide renderer, the page's handout, a slide's and a tab's name, and the search text. Pure.
 */

/** Is this raw HTML exactly a line break tag: `<br>`, `<br/>`, `<br />` (any case)? */
export function isLineBreakTag(html: string): boolean {
  return /^<br\s*\/?>$/i.test(html.trim());
}

/** Not after an odd run of backslashes: a `\<` is an escaped `<`, words; `\\<` is a backslash, then a tag. */
const UNESCAPED = String.raw`(?<=(?:^|[^\\])(?:\\\\)*)`;

/** A line break tag, not escaped. */
export const UNESCAPED_BREAK_TAG = new RegExp(UNESCAPED + String.raw`<br\s*\/?>`, 'gi');

/** Any tag, not escaped. */
export const UNESCAPED_TAG = new RegExp(UNESCAPED + String.raw`<\/?[A-Za-z][^>]*>`, 'g');

/** A heading's words without tags, its line breaks as spaces: what names it (before its marks and escapes go). */
export function headingWordsWithoutTags(words: string): string {
  return words.replace(UNESCAPED_BREAK_TAG, ' ').replace(UNESCAPED_TAG, '');
}
