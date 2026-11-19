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
 * Pure and dependency-free but for the fenced-div and Agenda readers: the host and the webview import this one file.
 */
import { CLOSE_FENCE, OPEN_FENCE, parseFenceAttributes, withFenceValue } from './fencedDiv';
import { isAgendaClasses } from './agenda';

/** The class that makes a bracketed span a Label (Pandoc's and Quarto's attribute: `{.label}`). */
export const LABEL_CLASS = 'label';

/** A new Label's attribute block, as the slide editor writes one. */
export const LABEL_ATTRIBUTES = `{.${LABEL_CLASS}}`;

/** The faint word an empty Label shows on the stage while the caret is in it (the decks README). */
export const LABEL_PLACEHOLDER = 'Label';

/** The Steps block's old pill value, read only to carry it into a Label. */
const PILL_KEY = 'tag';

/** A `tag` value written on some line: the only Markdown the migration has to read line by line ("tagasi" is a word). */
const PILL_WRITTEN = /\btag\s*=/;

/** The class of a Tabs block (Quarto's tabset): a heading right inside it at its tabs' level is a tab's name. */
const TABSET_CLASS = 'panel-tabset';

/** `[words]{…}` alone on its line: the words may hold escapes (`\]`), never a bare bracket. */
const LABEL_LINE = /^ {0,3}\[((?:\\[^\r\n]|[^\\[\]\r\n])*)\](\{[^{}\r\n]*\})[ \t]*$/;

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
  // Only an attribute block of one line, as the reader reads one (the security review of #858: a value with a line
  // break, a lone carriage return included, would carry a second line into the file).
  const kept = attrs.trim();
  return `[${labelWordsMarkdown(words)}]${/^\{[^{}\r\n]*\}$/.test(kept) && isLabelAttributes(kept) ? kept : LABEL_ATTRIBUTES}`;
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
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;

/** One line of a slide's Markdown as the migration reads it. */
interface LineInfo {
  /** Inside a code block (its fences included): never read. */
  code: boolean;
  /** Inside a comment that runs over several lines (its first and last line included): never read either. */
  comment: boolean;
  /** The opening line of the `:::` block this line is in (-1 at the slide's top level). */
  container: number;
  /** That block is a Tabs block: a heading right inside it at its tabs' level is a tab's name. */
  inTabset: boolean;
  /** Inside an Agenda block: what someone wrote there is kept and never read (`slideRenderer`). */
  inAgenda: boolean;
}

/** Where each line stands: in code or a comment, or not, and in which `:::` block (the innermost open one closes first). */
function lineInfos(lines: string[]): LineInfo[] {
  const out: LineInfo[] = [];
  const stack: Array<{ at: number; tabs: boolean; agenda: boolean }> = [];
  let code: { char: string; size: number } | null = null;
  let comment = false;
  const here = (isCode: boolean, inComment = false): LineInfo => {
    const top = stack[stack.length - 1];
    return { code: isCode, comment: inComment, container: top?.at ?? -1, inTabset: !!top?.tabs, inAgenda: stack.some(entry => entry.agenda) };
  };
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (code) {
      out.push(here(true));
      const close = CODE_CLOSE.exec(line);
      if (close && close[1][0] === code.char && close[1].length >= code.size) code = null;
      return;
    }
    if (comment) {
      out.push(here(false, true));
      if (line.includes('-->')) comment = false;
      return;
    }
    // A comment block (an HTML block that opens with `<!--`) runs to the line that holds `-->`.
    if (/^ {0,3}<!--/.test(line) && !line.slice(line.indexOf('<!--') + 4).includes('-->')) {
      out.push(here(false, true));
      comment = true;
      return;
    }
    const fence = CODE_OPEN.exec(line);
    if (fence) {
      out.push(here(true));
      code = { char: fence[1][0], size: fence[1].length };
      return;
    }
    const open = OPEN_FENCE.exec(line);
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (attrs) {
      out.push(here(false));
      stack.push({ at: index, tabs: attrs.classes.includes(TABSET_CLASS), agenda: isAgendaClasses(attrs.classes) });
      return;
    }
    if (CLOSE_FENCE.test(line) && stack.length) stack.pop();
    out.push(here(false));
  });
  return out;
}

const isBlank = (line: string) => line.trim() === '';

/** A line the migration may read: not code, not inside a comment, not in an Agenda block. */
const readable = (infos: LineInfo[], at: number) => !infos[at].code && !infos[at].comment && !infos[at].inAgenda;

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

/** An ATX heading's level, or 0 for any other line. */
function headingLevel(line: string): number {
  return HEADING.exec(line.replace(/\r$/, ''))?.[1].length ?? 0;
}

/**
 * Is the heading at line `at` a tab's name: right inside a Tabs block, at the level of that block's first heading (as
 * `tabset.tabsetOf` reads its tabs)? A deeper heading in a pane is the pane's own.
 */
function isTabName(lines: string[], infos: LineInfo[], at: number): boolean {
  if (!infos[at].inTabset) return false;
  const container = infos[at].container;
  for (let index = container + 1; index < lines.length; index++) {
    if (infos[index].container !== container || !readable(infos, index)) continue;
    const level = headingLevel(lines[index]);
    if (level) return level === headingLevel(lines[at]);
  }
  return false;
}

/** The heading right over a Steps block (past blank lines and notes, in its own `:::` block), or -1; never a tab's name. */
function headingOver(lines: string[], infos: LineInfo[], steps: number): number {
  const before = blockBefore(lines, infos, steps);
  if (before < 0 || !readable(infos, before) || !headingLevel(lines[before]) || isTabName(lines, infos, before)) return -1;
  return before;
}

/** Where a Steps block's Label goes: before the heading right over it (and that heading's notes), else before it. */
function labelPlace(lines: string[], infos: LineInfo[], steps: number): number {
  const heading = headingOver(lines, infos, steps);
  return notesStart(lines, infos, heading >= 0 ? heading : steps);
}

/**
 * Is line `at` a paragraph of its own: the slide's or its `:::` block's first line, or after a blank line, a heading,
 * a closing fence or the end of a note; and before the end, a blank line, or a line that starts a block (a heading, a
 * fence, a note). A Label line that goes on with words, or that a setext underline makes a heading, is words.
 */
function isOwnParagraph(lines: string[], infos: LineInfo[], at: number): boolean {
  const previous = at - 1;
  const opens = previous < 0 || previous === infos[at].container || isBlank(lines[previous])
    || infos[previous].code || headingLevel(lines[previous]) > 0 || CLOSE_FENCE.test(lines[previous].replace(/\r$/, '')) || /-->\s*$/.test(lines[previous]);
  if (!opens) return false;
  const next = lines[at + 1];
  if (next === undefined || isBlank(next)) return true;
  const line = next.replace(/\r$/, '');
  return headingLevel(line) > 0 || OPEN_FENCE.test(line) || CLOSE_FENCE.test(line) || CODE_OPEN.test(line) || /^ {0,3}<!--/.test(line);
}

/** The Label line in a Steps block's place (before the heading over it, or before it), or -1. */
function labelOf(lines: string[], infos: LineInfo[], steps: number): number {
  const heading = headingOver(lines, infos, steps);
  const before = blockBefore(lines, infos, heading >= 0 ? heading : steps);
  if (before < 0 || !readable(infos, before) || !isOwnParagraph(lines, infos, before)) return -1;
  return labelLineOf(lines[before]) ? before : -1;
}

/** A Steps block's opening line's attributes (outside code and comments; in an Agenda block too), or null. */
function stepsLineAttributes(lines: string[], infos: LineInfo[], at: number): ReturnType<typeof parseFenceAttributes> {
  if (infos[at].code || infos[at].comment) return null;
  const open = OPEN_FENCE.exec(lines[at].replace(/\r$/, ''));
  const attrs = open ? parseFenceAttributes(open[2]) : null;
  return attrs && attrs.classes.includes('steps') ? attrs : null;
}

/** The same for a Steps block the migration may change: never one in an Agenda block. */
function stepsAttributes(lines: string[], infos: LineInfo[], at: number): ReturnType<typeof parseFenceAttributes> {
  return infos[at].inAgenda ? null : stepsLineAttributes(lines, infos, at);
}

/** Does this Markdown write a Steps block's old pill somewhere (a quick look; `withStepsLabels` reads it line by line)? */
export function writesPill(markdown: string): boolean {
  return PILL_WRITTEN.test(markdown) && markdown.includes(':::');
}

/**
 * A slide's Markdown with every Steps block's pill as a Label (the README, "Today's pills are kept"): the block's `tag`
 * taken off its opening line (only that value: its colons, classes and other values stay), and its words, when it has
 * any, as `[words]{.label}` in the same place, before the heading over the steps, or before the steps when there is no
 * heading (a tab's name is no heading over them: the Label stays in the pane). An emptied pill (`tag=""`) becomes
 * nothing. Code, comments and an Agenda block are never read. The Markdown as it was when no Steps block has a `tag`, so
 * a slide written as Labels is never changed again.
 */
export function withStepsLabels(markdown: string): string {
  if (!writesPill(markdown)) return markdown;
  const cached = labelledCache.get(markdown);
  if (cached !== undefined) return cached;
  if (labelledCache.size > 500) labelledCache.clear();
  const out = labelled(markdown);
  labelledCache.set(markdown, out);
  return out;
}

/** Every reader draws a slide through `withStepsLabels`: a slide with a pill is read once per Markdown. */
const labelledCache = new Map<string, string>();

function labelled(markdown: string): string {
  const lines = markdown.split('\n');
  const infos = lineInfos(lines);
  const pills: Array<{ at: number; words: string }> = [];
  lines.forEach((_line, at) => {
    const words = stepsAttributes(lines, infos, at)?.values[PILL_KEY];
    if (words !== undefined) pills.push({ at, words });
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
 * Any other Label stays a line of words. A Steps block in an Agenda block keeps its own `tag`, as it is never migrated.
 */
export function labelsAsPills(markdown: string, canonicalSteps: (tag: string | null, written: string | undefined) => string): string {
  if (!markdown.includes(':::')) return markdown;
  const original = markdown.split('\n');
  const originalInfos = lineInfos(original);
  // The `tag` each Steps block was written with, in order (`tag=""` keeps its old stamp until it is written as nothing).
  const written = original.map((_line, at) => stepsLineAttributes(original, originalInfos, at)).filter(attrs => attrs !== null).map(attrs => attrs!.values[PILL_KEY]);
  const lines = withStepsLabels(markdown).split('\n');
  const infos = lineInfos(lines);
  const drop = new Set<number>();
  let block = 0;
  // Each Steps line read first, then written: a written line is no longer one this reader can read.
  const steps = lines.map((_line, at) => at).filter(at => stepsLineAttributes(lines, infos, at) !== null);
  for (const at of steps) {
    // In an Agenda block the line stays as written (`withStepsLabels` never reads it): its pill is its own tag.
    if (infos[at].inAgenda) {
      lines[at] = canonicalSteps(written[block] ?? null, written[block]);
      block++;
      continue;
    }
    const own = labelOf(lines, infos, at);
    if (own >= 0) drop.add(own);
    lines[at] = canonicalSteps(own >= 0 ? labelLineOf(lines[own])!.words : null, written[block]);
    block++;
  }
  return lines.filter((_line, at) => !drop.has(at)).join('\n');
}
