/**
 * Sprint 161 (technical plan §4): a v1 slide (` ```slide points `, its body YAML) drawn as a block slide, in memory.
 * Opening a deck writes nothing; this is what the slide will be when its deck converts at its first real edit (PR 2),
 * and what the library's new stamp and the presenter view's comments read today.
 *
 * | v1 kind            | blocks                                                                         |
 * | ------------------ | ------------------------------------------------------------------------------ |
 * | title, statement   | `# title`, its subtitle as a paragraph (the cover look)                        |
 * | section            | its number as a short first line, then `# title`                               |
 * | points             | `# title`, an ordered list; an item's text is a second line                    |
 * | boxes              | `# title`, `:::: {.boxes look="…"}` of `::: {.box icon="…"}` with `### heading` |
 * | columns            | `# title`, `:::: columns` of two `::: column` with `### heading` and its lines  |
 * | exercise           | `# title`, `::: {.steps tag="…"}` (only when `tag:` is written) and its list    |
 * | picture            | `# title`, `![](image)`, its caption                                           |
 * | table              | `# title`, a GFM table, the first row its header                               |
 * | picture beside or behind | the header's `picture:` and `image:`                                     |
 *
 * Words a layout keeps hidden today (a third column, a title slide's items, a step's line, icons a look doesn't draw)
 * never become public: with the slide's old speaker notes they make one Ritemark comment, "Hidden by the old layout:
 * …", for the end of the slide's handout part (`-->` made harmless). The page and the wall drop comments.
 *
 * Pure and dependency-free but for the deck format: the host and the webview use this one converter.
 */
import { HEADER_KEYS, isSlideKind, parseSlideBody, sidePictureOf, type SlideData, type SlideItem } from '../deckFormat';
import { OWN_MARK_LOOKS } from './fencedDiv';

/** A v1 slide as blocks: the header's data, the Markdown, and the comment its hidden words and notes make. */
export interface LegacyBlocks {
  /** What goes in the block slide's header: id, from, skip, kept, and a picture beside or behind. */
  header: SlideData;
  markdown: string;
  /** `<!-- … -->`, or null when the slide has no notes and hides no words. */
  comment: string | null;
}

/** Characters that are Markdown anywhere in a line: escaped so the words read back as written. */
const INLINE = /[\\`*_[\]<>&$~|]/g;

/** A line's start that would open a block: a heading, a quote, a list item, a fence, a rule, a table, a div. */
function escapeLineStart(line: string): string {
  // A line of dashes alone (`--`, `- - -`) would make the line above a heading, or be a rule.
  if (/^\s*-(?:\s*-)+\s*$/.test(line)) return line.replace('-', '\\-');
  return line
    .replace(/^(\s*)(#{1,6}(?=\s|$)|>|[-+](?=\s|$)|=+\s*$)/, (_all, space: string, mark: string) => `${space}\\${mark}`)
    .replace(/^(\s*)(\d{1,9})([.)])(?=\s|$)/, '$1$2\\$3')
    .replace(/^(\s*)(:{3,})/, '$1\\$2');
}

/** Words as Markdown text: each line escaped so it reads back as the same words, on its own lines (`breaks`). */
export function markdownText(words: string): string {
  return words
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => escapeLineStart(line.replace(INLINE, '\\$&')))
    .join('\n');
}

/** One line of words, for a heading or a table cell: line breaks become spaces. */
function oneLine(words: string): string {
  return markdownText(words.replace(/\s*\n\s*/g, ' ').trim());
}

/**
 * An item's words without the list number that repeats its place ("1. Sisend" as the first item, Jarmo's "1. 1."). A
 * number that isn't its place stays, escaped, so it never becomes a list of its own.
 */
export function withoutItemNumber(words: string, position: number): string {
  const match = /^\s*(\d{1,9})[.)][ \t]+/.exec(words);
  return match && Number(match[1]) === position ? words.slice(match[0].length) : words;
}

/** A path in a Markdown picture: in angle brackets when it holds a space or a bracket. */
function pictureTarget(path: string): string {
  const value = path.trim();
  return /[\s()<>]/.test(value) ? `<${value.replace(/[<>]/g, encodeURIComponent)}>` : value;
}

/**
 * An attribute value in a div's `{…}`, which has no escapes: in double quotes, or in single quotes when it holds a
 * double quote; a value with both keeps its words with a typographic quote. A line break is a space.
 */
export function attributeValue(value: string): string {
  const words = value.replace(/[\r\n]+/g, ' ');
  if (!words.includes('"')) return `"${words}"`;
  if (!words.includes("'")) return `'${words}'`;
  return `"${words.replace(/"/g, '\u201d')}"`;
}

const has = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

function itemLine(item: SlideItem): string {
  return [item.heading, item.text].filter(has).map(part => part.replace(/\s*\n\s*/g, ' ').trim()).join(': ');
}

/** The words this kind's layout doesn't draw, one line each (what `drawnData` keeps private). */
export function hiddenWords(kind: string, data: SlideData): string[] {
  if (!isSlideKind(kind)) return [];
  const out: string[] = [];
  const items = data.items ?? [];
  const drawsSubtitle = kind === 'title' || kind === 'statement' || kind === 'picture';
  if (!drawsSubtitle && has(data.subtitle)) out.push(data.subtitle.trim());
  if (kind !== 'section' && has(data.number)) out.push(`number ${data.number.trim()}`);
  if (kind !== 'exercise' && data.tag !== undefined && has(data.tag)) out.push(`label ${data.tag.trim()}`);
  switch (kind) {
    case 'title':
    case 'statement':
    case 'section':
    case 'picture':
    case 'table':
      for (const item of items) if (itemLine(item)) out.push(itemLine(item));
      break;
    case 'columns':
      for (const item of items.slice(2)) if (itemLine(item)) out.push(itemLine(item));
      for (const item of items.slice(0, 2)) if (has(item.icon)) out.push(`icon ${item.icon.trim()}`);
      break;
    case 'exercise':
      items.forEach((item, index) => {
        if (has(item.text)) out.push(`step ${index + 1}: ${item.text.replace(/\s*\n\s*/g, ' ').trim()}`);
        if (has(item.icon)) out.push(`icon ${item.icon.trim()}`);
      });
      break;
    case 'points':
      for (const item of items) if (has(item.icon)) out.push(`icon ${item.icon.trim()}`);
      break;
    case 'boxes':
      if (OWN_MARK_LOOKS.has(data.look ?? '')) for (const item of items) if (has(item.icon)) out.push(`icon ${item.icon.trim()}`);
      break;
  }
  if (kind !== 'table' && data.rows?.length) {
    for (const row of data.rows) if (row.some(has)) out.push(row.map(cell => cell.trim()).join(' | '));
  }
  // A Picture slide draws its own picture; any other kind only beside or behind its words.
  if (kind !== 'picture' && has(data.image) && !sidePictureOf(data)) out.push(`picture ${data.image.trim()}`);
  return out;
}

/** The comment the conversion writes: the old notes, then each hidden line. `-->` and `--!>` can't end it early. */
export function conversionComment(notes: string | null | undefined, hidden: string[]): string | null {
  const parts = [(notes ?? '').trim(), ...hidden.map(words => `Hidden by the old layout: ${words}`)].filter(Boolean);
  if (!parts.length) return null;
  // A line that reads as a code fence's (```` ``` ```` or `~~~`, as a trainer's notes quoting a slide may hold) would open
  // a fence for the deck's own reader (`parseDeck` doesn't know comments): indented four spaces it is no fence, so no
  // slide can start inside the comment and no slide after it is swallowed (security review of #765).
  const body = parts.join('\n').replace(/--(!?)>/g, '--$1›').replace(/^ {0,3}(?=`{3,}|~{3,})/gm, '    ');
  return `<!-- ${body} -->`;
}

function titleLine(data: SlideData): string[] {
  return has(data.title) ? [`# ${oneLine(data.title)}`] : [];
}

function orderedList(items: SlideItem[], withText: boolean): string[] {
  const lines: string[] = [];
  items.forEach((item, index) => {
    const heading = oneLine(withoutItemNumber(item.heading ?? '', index + 1));
    const text = withText && has(item.text) ? markdownText(item.text.trim()) : '';
    if (!heading && !text) return;
    const marker = `${lines.filter(line => /^\d+\. /.test(line)).length + 1}. `;
    const body = [heading, ...(text ? text.split('\n') : [])].filter((line, at) => at === 0 || line !== '');
    lines.push(`${marker}${body[0] ?? ''}`, ...body.slice(1).map(line => `${' '.repeat(marker.length)}${line}`));
  });
  return lines;
}

function tableLines(rows: string[][]): string[] {
  const width = Math.max(0, ...rows.map(row => row.length));
  if (!width || !rows.some(row => row.some(has))) return [];
  const cells = (row: string[]) => `| ${Array.from({ length: width }, (_, column) => oneLine(row[column] ?? '') || ' ').join(' | ')} |`;
  return [cells(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(cells)];
}

/** The Markdown of a v1 slide's words, as blocks. */
function markdownOf(kind: string, data: SlideData): string {
  const items = data.items ?? [];
  const blocks: string[][] = [];
  switch (kind) {
    case 'title':
    case 'statement':
      blocks.push(titleLine(data));
      if (has(data.subtitle)) blocks.push([markdownText(data.subtitle.trim())]);
      break;
    case 'section':
      if (has(data.number)) blocks.push([oneLine(data.number)]);
      blocks.push(titleLine(data));
      break;
    case 'points':
      blocks.push(titleLine(data), orderedList(items, true));
      break;
    case 'exercise': {
      const open = data.tag === undefined ? '::: steps' : `::: {.steps tag=${attributeValue(data.tag)}}`;
      const list = orderedList(items, false);
      blocks.push(titleLine(data), [open, ...list, ':::']);
      break;
    }
    case 'boxes': {
      const look = data.look;
      const icons = !OWN_MARK_LOOKS.has(look ?? '');
      const lines = [look ? `:::: {.boxes look=${attributeValue(look)}}` : ':::: boxes'];
      items.forEach((item, index) => {
        lines.push(icons && has(item.icon) ? `::: {.box icon=${attributeValue(item.icon.trim())}}` : '::: box');
        const heading = oneLine(withoutItemNumber(item.heading ?? '', index + 1));
        if (heading) lines.push(`### ${heading}`);
        if (has(item.text)) lines.push(...markdownText(item.text.trim()).split('\n').filter(line => line.trim() !== ''));
        lines.push(':::');
      });
      lines.push('::::');
      blocks.push(titleLine(data), items.length ? lines : []);
      break;
    }
    case 'columns': {
      const lines = [':::: columns'];
      for (const item of items.slice(0, 2)) {
        lines.push('::: column');
        if (has(item.heading)) lines.push(`### ${oneLine(item.heading)}`);
        if (has(item.text)) lines.push(...markdownText(item.text.trim()).split('\n').filter(line => line.trim() !== ''));
        lines.push(':::');
      }
      lines.push('::::');
      blocks.push(titleLine(data), items.length ? lines : []);
      break;
    }
    case 'picture':
      blocks.push(titleLine(data));
      if (has(data.image)) blocks.push([`![](${pictureTarget(data.image)})`]);
      if (has(data.subtitle)) blocks.push([markdownText(data.subtitle.trim())]);
      break;
    case 'table':
      blocks.push(titleLine(data), tableLines(data.rows ?? []));
      break;
    default:
      // A kind this build doesn't know: its title alone, as the stage draws it.
      blocks.push(titleLine(data));
  }
  return blocks.filter(lines => lines.length).map(lines => lines.join('\n')).join('\n\n');
}

/** A v1 slide's data as blocks. `notes` is its ```` ```notes ```` block, when it has one. */
export function legacyDataToBlocks(kind: string, data: SlideData, notes?: string | null): LegacyBlocks {
  const header: SlideData = {};
  for (const key of HEADER_KEYS) {
    if (key === 'picture' || key === 'image') continue;
    if (data[key] !== undefined) (header as Record<string, unknown>)[key] = data[key];
  }
  const side = sidePictureOf(data);
  if (kind !== 'picture' && side) {
    header.picture = side;
    if (data.image !== undefined) header.image = data.image;
  }
  return { header, markdown: markdownOf(kind, data), comment: conversionComment(notes, hiddenWords(kind, data)) };
}

/** A v1 slide (its kind and YAML body) as blocks. */
export function legacyToBlocks(kind: string, body: string, notes?: string | null): LegacyBlocks {
  return legacyDataToBlocks(kind, parseSlideBody(body), notes);
}
