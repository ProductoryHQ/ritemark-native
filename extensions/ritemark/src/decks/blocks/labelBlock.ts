/**
 * Sprint 164 PR 3 (the decks README, "Label, a block of its own"): one short line in the theme's accent, as a pill, in
 * capitals with a little letter spacing, the look the Exercise pill had. A block of its own on a slide: above a title,
 * in a column, in a box or in a tab's pane. It holds text only, and the person types everything it says ("Exercise ·
 * 1 / 2" included): nothing is counted or filled in.
 *
 *  - **The file:** a line of its own, `[Exercise · 1 / 2]{.label}`: Pandoc's bracketed span with the same attribute
 *    form as Button's `{.button}`, so Pandoc and Quarto read a span of class `label`, and any other Markdown tool shows
 *    the words in brackets. A bracket in the words is escaped (`\[`); every other escape reads back as its character.
 *    Only a paragraph that is that one line is a Label: `Words\n[x]{.label}` stays words, as Pandoc reads it.
 *  - **Slides only:** the slide renderer and the slide editor read it. The Text editor and the handout never do, so
 *    there the line stays the words it is.
 *  - **An empty Label** (`[]{.label}`) is never drawn on the wall, the page or a thumbnail.
 *  - **Today's pills are kept** (`withStepsLabels`): a Steps block's `tag` becomes a Label in the same place, before
 *    the heading over the steps, or before the steps when there is no heading, with the person's own words; an emptied
 *    pill (`tag=""`) becomes nothing. The deck view writes it with the deck's first real edit, as it converts a v1 slide,
 *    and every view draws a slide not yet written so (`slideRenderer`), so what is seen before the edit is what is
 *    written. A Steps block with no `tag` has no Label: a new Steps block comes without one.
 *
 * Pure and dependency-free but for the fenced-div reader: the host and the webview import this one file.
 */
import { CLOSE_FENCE, OPEN_FENCE, parseFenceAttributes, withFenceValue } from './fencedDiv';

/** The class that makes a bracketed span a Label (Pandoc's and Quarto's attribute: `{.label}`). */
export const LABEL_CLASS = 'label';

/** A new Label's attribute block, as the slide editor writes one. */
export const LABEL_ATTRIBUTES = `{.${LABEL_CLASS}}`;

/** The faint word an empty Label shows on the stage while the caret is in it (the decks README). */
export const LABEL_PLACEHOLDER = 'Label';

/** The Steps block's old pill value, read only to carry it into a Label. */
const PILL_KEY = 'tag';

/** `[words]{…}` alone on its line: the words may hold escapes (`\]`), never a bare bracket. */
const LABEL_LINE = /^ {0,3}\[((?:\\[^\n]|[^\\[\]\n])*)\](\{[^{}\n]*\})[ \t]*$/;

/** A Label as written: its words (escapes read) and its attribute block as written. */
export interface LabelLine {
  words: string;
  attrs: string;
}

/** An attribute block that makes a Label: `{.label}`, with any other Pandoc attributes beside it. */
export function isLabelAttributes(block: string): boolean {
  const attrs = parseFenceAttributes(block.trim());
  return !!attrs && attrs.classes.includes(LABEL_CLASS);
}

/** A backslash before an ASCII punctuation character is that character (CommonMark's escapes). */
function unescapeWords(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

/** A Label's line, or null for any other line. */
export function labelLineOf(line: string): LabelLine | null {
  const match = LABEL_LINE.exec(line.replace(/\r$/, ''));
  if (!match || !isLabelAttributes(match[2])) return null;
  return { words: unescapeWords(match[1]), attrs: match[2] };
}

/**
 * A paragraph that is a Label: its text is one Label line and nothing else (a marked paragraph token's `text`). A
 * paragraph of several lines is words, as Pandoc reads a span inside a paragraph.
 */
export function labelParagraphOf(paragraph: { text?: string } | null | undefined): LabelLine | null {
  const text = paragraph?.text;
  if (typeof text !== 'string' || text.includes('\n')) return null;
  return labelLineOf(text);
}

/**
 * A Label's words as written between its brackets: one line, and the characters that would end the span early or make
 * its words something else (a backslash, a bracket, emphasis, code, a tag) escaped, so they read back as typed here and
 * in Pandoc.
 */
export function labelWordsMarkdown(words: string): string {
  return words.replace(/[\r\n]+/g, ' ').replace(/[\\[\]*_`<]/g, '\\$&');
}

/** A Label's line: `[words]{.label}`, or its own attribute block as read. */
export function labelLine(words: string, attrs: string = LABEL_ATTRIBUTES): string {
  return `[${labelWordsMarkdown(words)}]${isLabelAttributes(attrs) ? attrs.trim() : LABEL_ATTRIBUTES}`;
}

/** Are these a Label's words that draw nothing (empty, or only spaces)? */
export function isEmptyLabel(words: string): boolean {
  return words.trim() === '';
}

// ---------------------------------------------------------------------------
// Today's pills, kept as Labels
// ---------------------------------------------------------------------------

const CODE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const CODE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

/** One line of a slide's Markdown as the migration reads it. */
interface LineInfo {
  /** Inside a code block (its fences included): never read. */
  code: boolean;
  /** The opening line of the `:::` block this line is in (-1 at the slide's top level). */
  container: number;
}

/** Where each line stands: in code or not, and in which `:::` block (the innermost open one closes first). */
function lineInfos(lines: string[]): LineInfo[] {
  const out: LineInfo[] = [];
  const stack: number[] = [];
  let code: { char: string; size: number } | null = null;
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (code) {
      out.push({ code: true, container: stack[stack.length - 1] ?? -1 });
      const close = CODE_CLOSE.exec(line);
      if (close && close[1][0] === code.char && close[1].length >= code.size) code = null;
      return;
    }
    const fence = CODE_OPEN.exec(line);
    if (fence) {
      out.push({ code: true, container: stack[stack.length - 1] ?? -1 });
      code = { char: fence[1][0], size: fence[1].length };
      return;
    }
    const open = OPEN_FENCE.exec(line);
    if (open && parseFenceAttributes(open[2])) {
      out.push({ code: false, container: stack[stack.length - 1] ?? -1 });
      stack.push(index);
      return;
    }
    if (CLOSE_FENCE.test(line) && stack.length) stack.pop();
    out.push({ code: false, container: stack[stack.length - 1] ?? -1 });
  });
  return out;
}

const isBlank = (line: string) => line.trim() === '';

/**
 * The first line of the comment notes right before line `at` (blank lines between them allowed), or `at` when it has
 * none: a note on a block is written before it, so whatever goes before the block goes before its notes too.
 */
function notesStart(lines: string[], infos: LineInfo[], at: number): number {
  let start = at;
  let index = at - 1;
  while (index >= 0 && infos[index].container === infos[at].container && !infos[index].code) {
    const line = lines[index];
    if (isBlank(line)) { index--; continue; }
    if (!/-->\s*$/.test(line)) break;
    // Back to the line that opens this note (a note may run over several lines).
    let open = index;
    while (open >= 0 && !/^\s*<!--/.test(lines[open])) open--;
    if (open < 0 || infos[open].container !== infos[at].container) break;
    start = open;
    index = open - 1;
  }
  return start;
}

/** The block line before line `at` in its own `:::` block, past blank lines and notes, or -1 when there is none. */
function blockBefore(lines: string[], infos: LineInfo[], at: number): number {
  const start = notesStart(lines, infos, at);
  for (let index = start - 1; index >= 0; index--) {
    if (infos[index].container !== infos[at].container) return -1;
    if (index === infos[at].container) return -1;
    if (isBlank(lines[index])) continue;
    return index;
  }
  return -1;
}

/** Where a Steps block's Label goes: before the heading right over it (and that heading's notes), else before it. */
function labelPlace(lines: string[], infos: LineInfo[], steps: number): number {
  const before = blockBefore(lines, infos, steps);
  if (before >= 0 && !infos[before].code && HEADING.test(lines[before])) return notesStart(lines, infos, before);
  return notesStart(lines, infos, steps);
}

/**
 * A slide's Markdown with every Steps block's pill as a Label (the README, "Today's pills are kept"): the block's `tag`
 * taken off its opening line (only that value: its colons, classes and other values stay), and its words, when it has
 * any, as `[words]{.label}` in the same place, before the heading over the steps, or before the steps when there is no
 * heading. An emptied pill (`tag=""`) becomes nothing. The Markdown as it was when no Steps block outside code has a
 * `tag`, so a slide written as Labels is never changed again.
 */
export function withStepsLabels(markdown: string): string {
  if (!markdown.includes(PILL_KEY) || !markdown.includes(':::')) return markdown;
  const lines = markdown.split('\n');
  const infos = lineInfos(lines);
  const pills: Array<{ at: number; words: string }> = [];
  lines.forEach((line, at) => {
    if (infos[at].code) return;
    const open = OPEN_FENCE.exec(line.replace(/\r$/, ''));
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (!attrs || !attrs.classes.includes('steps') || attrs.values[PILL_KEY] === undefined) return;
    pills.push({ at, words: attrs.values[PILL_KEY] });
  });
  if (!pills.length) return markdown;
  // From the last to the first, so the lines before each one keep their places.
  for (const pill of pills.reverse()) {
    const crlf = lines[pill.at].endsWith('\r') ? '\r' : '';
    const without = withFenceValue(lines[pill.at].replace(/\r$/, ''), PILL_KEY, null);
    if (without !== null) lines[pill.at] = without + crlf;
    if (isEmptyLabel(pill.words)) continue;
    const place = labelPlace(lines, infos, pill.at);
    const indent = /^ {0,3}/.exec(lines[place])?.[0] ?? '';
    const label = `${indent}${labelLine(pill.words)}${crlf}`;
    // A blank line before it too, unless it opens its block (or the slide): `Text\n[x]{.label}` would be one paragraph.
    const previous = place - 1;
    const opens = previous < 0 || isBlank(lines[previous]) || previous === infos[place].container;
    lines.splice(place, 0, ...(opens ? [] : [crlf]), label, crlf);
  }
  return lines.join('\n');
}

/**
 * For a library copy's stamp (`deckLibraryFormat.slideStamp`): the slide's Markdown with its Labels as the pills they
 * were, so a slide reads as the same slide before its pills became Labels and after, and every stamp written before
 * Sprint 164 still stands. A Label in the place a Steps block's pill goes (`withStepsLabels`) is taken back onto the
 * block's opening line, in `canonicalSteps`'s form; the default word ("Exercise") and no Label are the old bare pill.
 * Any other Label stays a line of words.
 */
export function labelsAsPills(markdown: string, canonicalSteps: (tag: string | null, written: string | undefined) => string): string {
  if (!markdown.includes(':::')) return markdown;
  const migrated = withStepsLabels(markdown);
  const lines = migrated.split('\n');
  const infos = lineInfos(lines);
  // The `tag` each Steps block was written with, in order (`tag=""` keeps its old stamp until it is written as nothing).
  const written: Array<string | undefined> = [];
  const original = markdown.split('\n');
  const originalInfos = lineInfos(original);
  original.forEach((line, at) => {
    if (originalInfos[at].code) return;
    const open = OPEN_FENCE.exec(line.replace(/\r$/, ''));
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (attrs?.classes.includes('steps')) written.push(attrs.values[PILL_KEY]);
  });
  const drop = new Set<number>();
  let block = 0;
  lines.forEach((line, at) => {
    if (infos[at].code) return;
    const open = OPEN_FENCE.exec(line.replace(/\r$/, ''));
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (!attrs || !attrs.classes.includes('steps')) return;
    let tag: string | null = null;
    let before = blockBefore(lines, infos, at);
    if (before >= 0 && !infos[before].code && HEADING.test(lines[before])) before = blockBefore(lines, infos, before);
    const label = before >= 0 && !infos[before].code ? labelLineOf(lines[before]) : null;
    if (label) {
      tag = label.words;
      drop.add(before);
    }
    lines[at] = canonicalSteps(tag, written[block]);
    block++;
  });
  return lines.filter((_line, at) => !drop.has(at)).join('\n');
}
