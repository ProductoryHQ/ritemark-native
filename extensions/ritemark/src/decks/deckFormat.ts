/**
 * The deck file (Sprint 157, experience 46): `<name>.deck.md`.
 *
 * A deck is a Markdown file. Its front matter has `deck: 1` and names its theme. Each slide is one fenced block,
 * ```` ```slide <kind> ````, whose body is a strict subset of YAML, so any AI can read and write it:
 *
 *   - one `key: value` per line, the value on one line, double-quoted with YAML's escapes when it needs to be;
 *   - `items:` is a list of mappings (`- heading: …` with `text:` and `icon:` under it);
 *   - `rows:` is a list of flow lists (`- [Data, In the chat, "Yes, on a copy"]`).
 *
 * A ```` ```notes ```` block directly after a slide block is that slide's speaker notes. The Markdown after a slide
 * (and its notes) up to the next slide block is the slide's handout; anything before the first slide is the
 * preamble, kept as written.
 *
 * The handout is a Text document (README decision 12, 16 November): a part opens with its own heading, an H1 for a
 * section slide and an H2 for every other kind, written in the Markdown as ordinary text. It is the handout's, not the
 * slide's: the slide's `title:` and the heading never change each other, except that a slide with no title takes the
 * first heading written in its part as its title, once (a slide made from a line takes the heading after the line, as it
 * is made). A deck whose handout is written this way says so in its front matter, `handout: text` (`isTextHandout`).
 * A deck without that mark (every deck written before this) shows each part without a heading of its own one drawn
 * from its slide's title, in the deck view and on the handout page (`derivedHeading`); the person's first real edit
 * writes those headings and the mark together, and from then on nothing is drawn, so a heading deleted stays deleted.
 * A slide starts only at a slide block: a line (`***`) typed in the deck view becomes a slide block there, and a line in
 * the file is a line.
 *
 * The reader keeps unknown keys and lines as they were written, and the writer rewrites only the lines whose value
 * changed, so a slide nobody touched saves byte for byte.
 *
 * Pure, with no imports: the extension host (the library, the tools) and the webview (the deck view) use this one
 * parser and writer.
 */

/** The nine kinds a slide can have (README decision 8). A slide of any other kind is kept as written. */
export const SLIDE_KINDS = ['title', 'section', 'points', 'boxes', 'columns', 'statement', 'exercise', 'picture', 'table'] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

export function isSlideKind(kind: string): kind is SlideKind {
  return (SLIDE_KINDS as readonly string[]).includes(kind);
}

/** One box, step, point or column of a slide. Keys other than these three are kept as written. */
export interface SlideItem {
  heading?: string;
  text?: string;
  icon?: string;
}

/** A slide's words and settings, as its block holds them. */
export interface SlideData {
  id?: string;
  title?: string;
  subtitle?: string;
  /** A section's number, as written ("1", "A"). */
  number?: string;
  /**
   * An exercise slide's pill (16 November), the one word a layout draws that isn't the person's own text. The rule for
   * this word, and for any later fixed word a layout draws: an optional line; when it is missing the slide shows the
   * default (`EXERCISE_TAG`, "Exercise"), so a deck written before it changes by no byte; `tag: ""` means no pill.
   * Opening a deck never writes it; only editing the pill or Settings' Label row does.
   */
  tag?: string;
  /** The look of a row of boxes: boxes, steps, arrows or line. */
  look?: string;
  /** Where the picture goes: none, left, right or behind. */
  picture?: string;
  /** The picture's path, relative to the deck's folder. */
  image?: string;
  /** Experience 49: the side picture's description (what a screen reader and the page read), kept when it moves. */
  alt?: string;
  /** Experience 49: what stays in view of a side picture that fills its place, `x,y` in percent (50,50 the middle). */
  focus?: string;
  skip?: boolean;
  /** Keep it here: a changed library copy that stays changed (written by Keep it here). */
  kept?: boolean;
  /** `<project-relative path>#<source id> @<stamp>`: where a copy came from. */
  from?: string;
  /**
   * A block slide's header says it is a section (Sprint 161, PR 3: how an old Section slide converts, with or without a
   * number): its band on the page and its H1 in the handout, drawn big and low as a title-only slide.
   */
  section?: boolean;
  items?: SlideItem[];
  rows?: string[][];
  /**
   * A block slide's Markdown, after its header (Sprint 161, format v2): read with `slideDataOf`, in memory only. The
   * v1 writer never writes it, and `writeSlideData` writes a block slide's header around it untouched.
   */
  markdown?: string;
}

/** The pill an exercise slide shows when its block has no `tag:` line. Not yet in the deck's own language. */
export const EXERCISE_TAG = 'Exercise';

/** The words of an exercise slide's pill: its `tag:` line, or the default when there is none; '' (or spaces) is no pill. */
export function exerciseTagOf(data: SlideData): string {
  const tag = data.tag ?? EXERCISE_TAG;
  return tag.trim() ? tag : '';
}

/**
 * Does the pill draw what a slide without a `tag:` line draws? The pill is drawn in capitals, so `tag: exercise` and
 * `tag: Exercise` written out draw the default too (the library stamp and read_deck treat them as no line).
 */
export function isDefaultExerciseTag(data: SlideData): boolean {
  return exerciseTagOf(data).replace(/\s+/g, ' ').trim().toLowerCase() === EXERCISE_TAG.toLowerCase();
}

/** The scalar keys, in the order the writer puts a new key. */
const SCALAR_KEYS = ['id', 'section', 'title', 'subtitle', 'number', 'tag', 'look', 'picture', 'image', 'alt', 'focus', 'skip', 'kept', 'from'] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];
const BOOLEAN_KEYS: ReadonlySet<string> = new Set(['skip', 'kept', 'section']);
const ITEM_KEYS = ['heading', 'text', 'icon'] as const;

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

/** A plain YAML scalar's text: up to a ` #` comment, trimmed. */
function plainValue(raw: string): string {
  const comment = raw.search(/\s#/);
  return (comment >= 0 ? raw.slice(0, comment) : raw).trim();
}

/** Read one scalar as written: double-quoted, single-quoted or plain. */
export function readScalar(raw: string): string {
  const text = raw.trim();
  if (text.startsWith('"')) return readDoubleQuoted(text);
  if (text.startsWith("'")) {
    let out = '';
    for (let index = 1; index < text.length; index++) {
      const char = text[index];
      if (char === "'") {
        if (text[index + 1] === "'") { out += "'"; index++; continue; }
        return out;
      }
      out += char;
    }
    return out;
  }
  return plainValue(text);
}

/** YAML's one-letter escapes in a double-quoted scalar. */
const SIMPLE_ESCAPES: Record<string, string> = {
  '0': '\u0000', a: '\u0007', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\u000b', f: '\f', r: '\r', e: '\u001b',
  ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: ' ', L: '\u2028', P: '\u2029',
};

/**
 * A double-quoted scalar, its escapes read in one pass from left to right (so `\\e` is a backslash and an `e`, never
 * an escape). An escape this reader doesn't know stays as written; an unclosed quote runs to the end.
 */
function readDoubleQuoted(text: string): string {
  let out = '';
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (char === '"') return out;
    if (char !== '\\') { out += char; continue; }
    const next = text[index + 1];
    if (next === undefined) { out += char; break; }
    const width = next === 'x' ? 2 : next === 'u' ? 4 : next === 'U' ? 8 : 0;
    if (width > 0) {
      const hex = text.slice(index + 2, index + 2 + width);
      const code = /^[0-9a-fA-F]+$/.test(hex) && hex.length === width ? parseInt(hex, 16) : NaN;
      if (Number.isFinite(code) && code <= 0x10ffff) {
        out += String.fromCodePoint(code);
        index += 1 + width;
        continue;
      }
    } else if (next in SIMPLE_ESCAPES) {
      out += SIMPLE_ESCAPES[next];
      index += 1;
      continue;
    }
    out += char + next;
    index += 1;
  }
  return out;
}

/**
 * Does this value need quotes to read back as the same string, here and in any YAML reader? Quoting more than YAML
 * strictly needs is safe; quoting less is not. In a flow list (`rows:`) commas and brackets need quotes too.
 */
function needsQuotes(value: string, inFlow: boolean): boolean {
  if (value === '') return true;
  if (value !== value.trim()) return true;
  if (/[\u0000-\u001f\u007f\u0085\u2028\u2029]/.test(value)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return true;
  if (/: |:$| #/.test(value)) return true;
  if (/^(true|false|yes|no|on|off|y|n|null|~)$/i.test(value)) return true;
  if (/^[-+.]?\d/.test(value) || /^[-+]?\.(inf|nan)$/i.test(value)) return true;
  if (inFlow && /[,[\]{}]/.test(value)) return true;
  return false;
}

/** Write one scalar: plain when that reads back the same, otherwise double-quoted with JSON's escapes (valid YAML). */
export function writeScalar(value: string, inFlow = false): string {
  if (!needsQuotes(value, inFlow)) return value;
  // JSON leaves the Unicode line breaks as they are; a reader splitting lines would break the value there.
  return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** Split a flow list's inside (`a, "b, c", d`) into its raw entries. */
function splitFlow(inside: string): string[] {
  const entries: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < inside.length; index++) {
    const char = inside[index];
    if (quote === '"') {
      current += char;
      if (char === '\\') { current += inside[++index] ?? ''; continue; }
      if (char === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      current += char;
      if (char === "'") {
        if (inside[index + 1] === "'") { current += inside[++index]; continue; }
        quote = null;
      }
      continue;
    }
    // A quote opens a quoted entry only at its start; `it's` is a plain word.
    if ((char === '"' || char === "'") && current.trim() === '') { quote = char; current += char; continue; }
    if (char === ',') { entries.push(current); current = ''; continue; }
    current += char;
  }
  if (current.trim() !== '' || entries.length > 0) entries.push(current);
  return entries;
}

function readFlowList(raw: string): string[] | null {
  const text = raw.trim();
  if (!text.startsWith('[')) return null;
  const end = text.lastIndexOf(']');
  if (end < 0) return null;
  return splitFlow(text.slice(1, end)).map(entry => readScalar(entry));
}

function writeFlowList(cells: string[]): string {
  return '[' + cells.map(cell => writeScalar(cell, true)).join(', ') + ']';
}

// ---------------------------------------------------------------------------
// A slide block's body
// ---------------------------------------------------------------------------

type BodyEntry =
  | { kind: 'scalar'; key: string; lines: string[] }
  | { kind: 'items'; lines: string[] }
  | { kind: 'rows'; lines: string[] }
  | { kind: 'other'; lines: string[] };

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:\s+(.*)|\s*)$/;

/** The body's lines grouped into entries: each key with the lines that belong to it, and the lines that are neither. */
function bodyEntries(body: string): BodyEntry[] {
  const lines = body === '' ? [] : body.split('\n');
  const entries: BodyEntry[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const key = KEY_LINE.exec(line);
    if (key && (key[1] === 'items' || key[1] === 'rows')) {
      const block = [line];
      index++;
      // The list's lines: `- …`, indented lines, and blank lines followed by more of them.
      while (index < lines.length) {
        const next = lines[index];
        if (/^\s*-(\s|$)/.test(next) || /^\s+\S/.test(next)) { block.push(next); index++; continue; }
        if (next.trim() === '') {
          let ahead = index + 1;
          while (ahead < lines.length && lines[ahead].trim() === '') ahead++;
          if (ahead < lines.length && (/^\s*-(\s|$)/.test(lines[ahead]) || /^\s+\S/.test(lines[ahead]))) {
            while (index < ahead) block.push(lines[index++]);
            continue;
          }
        }
        break;
      }
      entries.push({ kind: key[1] === 'items' ? 'items' : 'rows', lines: block });
      continue;
    }
    if (key) {
      entries.push({ kind: 'scalar', key: key[1], lines: [line] });
      index++;
      continue;
    }
    entries.push({ kind: 'other', lines: [line] });
    index++;
  }
  return entries;
}

function scalarOf(line: string): string {
  const key = KEY_LINE.exec(line);
  return key ? readScalar(key[2] ?? '') : '';
}

interface ParsedItem extends SlideItem {
  /** Keys other than heading, text and icon, as written, in order. */
  extra: Array<{ key: string; line: string }>;
}

function readItems(lines: string[]): ParsedItem[] {
  const head = KEY_LINE.exec(lines[0]);
  const inline = (head?.[2] ?? '').trim();
  if (inline.startsWith('[')) return [];
  const items: ParsedItem[] = [];
  let current: ParsedItem | null = null;
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    const dash = /^(\s*)-(?:\s+(.*))?$/.exec(line);
    let pair: string | undefined;
    if (dash) {
      current = { extra: [] };
      items.push(current);
      pair = dash[2];
    } else {
      pair = line.trim();
    }
    if (!current || !pair) continue;
    const key = KEY_LINE.exec(pair);
    if (!key) continue;
    const value = readScalar(key[2] ?? '');
    if ((ITEM_KEYS as readonly string[]).includes(key[1])) (current as unknown as Record<string, unknown>)[key[1]] = value;
    else current.extra.push({ key: key[1], line: pair });
  }
  return items;
}

function readRows(lines: string[]): string[][] {
  const head = KEY_LINE.exec(lines[0]);
  if ((head?.[2] ?? '').trim().startsWith('[')) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(1)) {
    const dash = /^\s*-\s+(.*)$/.exec(line);
    if (!dash) continue;
    rows.push(readFlowList(dash[1]) ?? [readScalar(dash[1])]);
  }
  return rows;
}

/** Read a slide block's body. */
export function parseSlideBody(body: string): SlideData {
  const data: SlideData = {};
  for (const entry of bodyEntries(body)) {
    if (entry.kind === 'scalar') {
      if (!(SCALAR_KEYS as readonly string[]).includes(entry.key)) continue;
      const value = scalarOf(entry.lines[0]);
      if (BOOLEAN_KEYS.has(entry.key)) (data as Record<string, unknown>)[entry.key] = /^(true|yes|on)$/i.test(value);
      else (data as Record<string, unknown>)[entry.key] = value;
    } else if (entry.kind === 'items') {
      data.items = readItems(entry.lines).map(({ extra: _extra, ...item }) => item);
    } else if (entry.kind === 'rows') {
      data.rows = readRows(entry.lines);
    }
  }
  return data;
}

function sameItems(a: SlideItem[] | undefined, b: SlideItem[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((item, index) =>
    ITEM_KEYS.every(key => (item[key] ?? undefined) === (right[index][key] ?? undefined)));
}

function sameRows(a: string[][] | undefined, b: string[][] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((row, index) =>
    row.length === right[index].length && row.every((cell, column) => cell === right[index][column]));
}

function scalarLine(key: ScalarKey, value: string | boolean): string {
  return `${key}: ${typeof value === 'boolean' ? String(value) : writeScalar(value)}`;
}

function itemsLines(items: SlideItem[], written: ParsedItem[]): string[] {
  if (items.length === 0) return ['items: []'];
  const lines = ['items:'];
  items.forEach((item, index) => {
    const pairs: string[] = [];
    for (const key of ITEM_KEYS) {
      const value = item[key];
      if (value !== undefined) pairs.push(`${key}: ${writeScalar(value)}`);
    }
    // Keys this writer doesn't know stay with the item that had them.
    for (const extra of written[index]?.extra ?? []) pairs.push(extra.line);
    if (pairs.length === 0) pairs.push('heading: ""');
    lines.push(`- ${pairs[0]}`, ...pairs.slice(1).map(pair => `  ${pair}`));
  });
  return lines;
}

function rowsLines(rows: string[][]): string[] {
  if (rows.length === 0) return ['rows: []'];
  return ['rows:', ...rows.map(row => `- ${writeFlowList(row)}`)];
}

/**
 * Write a slide's body: the body as it was written, with only the lines whose value changed rewritten. A key the
 * slide gains goes in its canonical place; a key it loses is removed; unknown keys and other lines stay as they were.
 */
export function writeSlideBody(written: string, data: SlideData): string {
  const entries = bodyEntries(written);
  const old = parseSlideBody(written);
  const out: string[][] = [];
  const seen = new Set<string>();
  let itemsDone = false;
  let rowsDone = false;

  for (const entry of entries) {
    if (entry.kind === 'scalar' && (SCALAR_KEYS as readonly string[]).includes(entry.key)) {
      const key = entry.key as ScalarKey;
      if (seen.has(key)) continue; // a key written twice: the first one is the one that counts
      seen.add(key);
      const next = data[key];
      if (next === undefined || next === false && BOOLEAN_KEYS.has(key)) continue;
      out.push(old[key] === next ? entry.lines : [scalarLine(key, next)]);
      continue;
    }
    if (entry.kind === 'items') {
      if (itemsDone) continue;
      itemsDone = true;
      if (data.items === undefined) continue;
      out.push(sameItems(old.items, data.items) ? entry.lines : itemsLines(data.items, readItems(entry.lines)));
      continue;
    }
    if (entry.kind === 'rows') {
      if (rowsDone) continue;
      rowsDone = true;
      if (data.rows === undefined) continue;
      out.push(sameRows(old.rows, data.rows) ? entry.lines : rowsLines(data.rows));
      continue;
    }
    out.push(entry.lines);
  }

  // New scalar keys go after the last known key that comes before them in the canonical order.
  const keyAt = (lines: string[]) => KEY_LINE.exec(lines[0] ?? '')?.[1];
  for (const key of SCALAR_KEYS) {
    if (seen.has(key)) continue;
    const value = data[key];
    if (value === undefined || value === false && BOOLEAN_KEYS.has(key)) continue;
    const rank = SCALAR_KEYS.indexOf(key);
    let at = 0;
    out.forEach((lines, index) => {
      const name = keyAt(lines);
      const known = name ? SCALAR_KEYS.indexOf(name as ScalarKey) : -1;
      if (known >= 0 && known < rank) at = index + 1;
    });
    out.splice(at, 0, [scalarLine(key, value)]);
  }
  if (!itemsDone && data.items !== undefined) out.push(itemsLines(data.items, []));
  if (!rowsDone && data.rows !== undefined) out.push(rowsLines(data.rows));
  return out.flat().join('\n');
}

// ---------------------------------------------------------------------------
// Fences and the deck
// ---------------------------------------------------------------------------

/** A fence long enough for this body: three backticks, or one more than the longest run that starts a line in it. */
export function fenceFor(body: string): string {
  let size = 3;
  for (const match of body.matchAll(/^ {0,3}(`{3,})/gm)) size = Math.max(size, match[1].length + 1);
  return '`'.repeat(size);
}

/** A slide block's text, with its notes block after it when it has notes. */
/**
 * A kind as a backtick fence's info string can carry it: one word with no space and no backtick, or null. Unknown
 * kinds a person or another app wrote (`gamma.v2`) pass, so they are kept as written.
 */
export function cleanKind(kind: string | null | undefined): string | null {
  return typeof kind === 'string' && /^[^\s`]{0,200}$/.test(kind) ? kind : null;
}

export function writeSlideBlock(kind: string, body: string, notes?: string | null): string {
  const fence = fenceFor(body);
  // A kind that isn't one word (a pasted element's) would break the fence line: it is written as a Points slide.
  const word = cleanKind(kind) ?? 'points';
  let block = `${fence}slide${word ? ` ${word}` : ''}\n${body}${body === '' ? '' : '\n'}${fence}`;
  if (notes !== undefined && notes !== null) {
    const notesFence = fenceFor(notes);
    block += `\n\n${notesFence}notes\n${notes}${notes === '' ? '' : '\n'}${notesFence}`;
  }
  return block;
}

/** One slide in the deck's text, with the offsets of its block (and its notes) and of its handout. */
export interface DeckSlideBlock {
  /** The word after `slide` in the info string. */
  kind: string;
  /** The body as written, without its fences. */
  body: string;
  /** The speaker notes, or null when the slide has no notes block. */
  notes: string | null;
  /** Where the slide's block starts and where its notes block (or the slide block) ends. */
  start: number;
  end: number;
  /** The handout: the text after the block up to the next slide block, as written. */
  handoutStart: number;
  handoutEnd: number;
}

export interface ParsedDeck {
  /** The front matter's `deck:` value, as written, or null. */
  version: string | null;
  /** The front matter's `theme:` value, or null. */
  theme: string | null;
  /** Where the body starts (after the front matter). */
  bodyStart: number;
  slides: DeckSlideBlock[];
}

interface Fence {
  char: '`' | '~';
  size: number;
  info: string;
  start: number;
  bodyStart: number;
  bodyEnd: number;
  end: number;
}

/** The top-level fenced blocks of a Markdown text, in order (CommonMark's rules for an unindented fence). */
function fencesOf(text: string, from: number): Fence[] {
  const fences: Fence[] = [];
  let offset = from;
  let open: { char: '`' | '~'; size: number; info: string; start: number; bodyStart: number } | null = null;
  while (offset <= text.length) {
    const lineEnd = text.indexOf('\n', offset);
    const end = lineEnd < 0 ? text.length : lineEnd;
    const line = text.slice(offset, end).replace(/\r$/, '');
    const next = lineEnd < 0 ? text.length + 1 : lineEnd + 1;
    if (open) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === open.char && close[1].length >= open.size) {
        fences.push({ ...open, bodyEnd: Math.max(open.bodyStart, offset - 1), end });
        open = null;
      }
    } else {
      const start = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (start && !(start[1][0] === '`' && start[2].includes('`'))) {
        open = { char: start[1][0] as '`' | '~', size: start[1].length, info: start[2].trim(), start: offset, bodyStart: next };
      }
    }
    offset = next;
  }
  // An unclosed fence runs to the end of the text (CommonMark); it is no slide.
  return fences;
}

/** The front matter's values, in order, and where the body starts; null when the text has no front matter. */
function frontMatterEntries(text: string): { entries: Array<[string, string]>; end: number } | null {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const entries: Array<[string, string]> = [];
  for (const line of match[1].split(/\r?\n/)) {
    const key = KEY_LINE.exec(line);
    if (key) entries.push([key[1], readScalar(key[2] ?? '')]);
  }
  return { entries, end: match[0].length };
}

function frontMatterOf(text: string): { version: string | null; theme: string | null; end: number } {
  const front = frontMatterEntries(text);
  if (!front) return { version: null, theme: null, end: 0 };
  let version: string | null = null;
  let theme: string | null = null;
  for (const [key, value] of front.entries) {
    if (key === 'deck') version = value;
    if (key === 'theme') theme = value;
  }
  return { version, theme, end: front.end };
}

/** One of the front matter's values (`look`, say), read as `parseDeck` reads `deck` and `theme`; null when absent. */
export function frontMatterField(text: string, name: string): string | null {
  return frontMatterEntries(text)?.entries.find(([key]) => key === name)?.[1] ?? null;
}

/**
 * Card or Borderless, as the front matter says it: `look: borderless` is Borderless, anything else (or none) Card. The
 * deck view's own rule (`properties.look === 'borderless'`), so the page Publish builds has the look the view draws.
 */
export function frontMatterLook(text: string): 'card' | 'borderless' {
  return frontMatterField(text, 'look') === 'borderless' ? 'borderless' : 'card';
}

/** The info string's kind: `slide boxes` → `boxes`; null when the block is no slide. */
export function slideKindOfInfo(info: string): string | null {
  const match = /^slide(?:\s+(\S+))?\s*$/.exec(info.trim());
  return match ? match[1] ?? '' : null;
}

/** Read a deck's text: its front matter's deck and theme, and every slide with its notes and handout. */
export function parseDeck(text: string): ParsedDeck {
  const front = frontMatterOf(text);
  const fences = fencesOf(text, front.end);
  const slides: DeckSlideBlock[] = [];
  for (let index = 0; index < fences.length; index++) {
    const fence = fences[index];
    const kind = slideKindOfInfo(fence.info);
    if (kind === null) continue;
    let end = fence.end;
    let notes: string | null = null;
    const next = fences[index + 1];
    // A notes block is the slide's when only blank lines stand between them.
    if (next && next.info === 'notes' && text.slice(fence.end, next.start).trim() === '') {
      notes = text.slice(next.bodyStart, next.bodyEnd);
      end = next.end;
      index++;
    }
    slides.push({
      kind,
      body: text.slice(fence.bodyStart, fence.bodyEnd),
      notes,
      start: fence.start,
      end,
      handoutStart: end,
      handoutEnd: text.length,
    });
  }
  slides.forEach((slide, index) => {
    if (index + 1 < slides.length) slide.handoutEnd = slides[index + 1].start;
  });
  return { version: front.version, theme: front.theme, bodyStart: front.end, slides };
}

/**
 * The deck's text Publish builds the page from (Sprint 159): the document's front matter (the theme and the look) with
 * the view's body, front matter left out, since the view's newest words may not have reached the document yet.
 * `fromView` says whether the view's words are in it. With them goes the view's `look` (Card or Borderless), for the
 * same reason: a look chosen a moment before the press may still be on its way to the document.
 *
 * `editorBody` is the body the editor gave the view for this document. The view's body stands in for the document's
 * only where that is exactly what follows the front matter `parseDeck` reads. Anywhere else the editor read the front
 * matter differently (its YAML doesn't read, so the view was given the whole text, or it ends at another line), so
 * the view's words may hold some of it, in the editor's own shape: the document as saved is used then, with its own
 * look, whose front matter `publicDeck` leaves out exactly (fails closed; words typed a moment before the press may be
 * missing).
 */
export function publishText(documentText: string, body: string, editorBody: string, look?: 'card' | 'borderless'): { text: string; fromView: boolean } {
  const text = documentText.replace(/^\uFEFF/, '');
  const head = text.slice(0, parseDeck(text).bodyStart);
  if (head && editorBody.replace(/^\uFEFF/, '') !== text.slice(head.length)) return { text: documentText, fromView: false };
  const front = look ? withLook(head, look) : head;
  return { text: front && !front.endsWith('\n') ? `${front}\n${body}` : front + body, fromView: true };
}

/**
 * A front matter (`head`, as `parseDeck` reads it, or '') saying the view's look: unchanged where it says it already
 * (`frontMatterLook`); else without its `look:` lines, and with `look: borderless` for Borderless.
 */
function withLook(head: string, look: 'card' | 'borderless'): string {
  if (frontMatterLook(head) === look) return head;
  if (!head) return '---\nlook: borderless\n---\n';
  const match = /^(---[ \t]*(\r?\n))([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n)?)$/.exec(head);
  if (!match) return head;
  const lines = match[3].split(/\r?\n/).filter(line => KEY_LINE.exec(line)?.[1] !== 'look');
  if (look === 'borderless') lines.push('look: borderless');
  return match[1] + lines.join(match[2]) + match[4];
}

/** The front matter's `deck:` value, as written, or null: read from the front matter alone. */
export function deckVersionOf(text: string): string | null {
  return frontMatterOf(text).version;
}

/**
 * Is this front matter's `deck:` one this version reads? Absent, 1 (slides of a kind, `slide points`), or 2 (block
 * slides, a bare `slide` whose body is Markdown: Sprint 161). A deck may mix both kinds.
 */
export function isReadableDeckVersion(version: string | null): boolean {
  if (version === null || version.trim() === '') return true;
  const number = Number(version);
  return Number.isFinite(number) && number <= 2;
}

// ---------------------------------------------------------------------------
// Block slides (Sprint 161, format v2)
// ---------------------------------------------------------------------------

/**
 * A block slide: a fence whose info string is a bare `slide`. Its body is an optional header between `---` lines (the
 * keys `HEADER_KEYS`, in the same strict YAML subset as a v1 slide), then Markdown: a title (`#`), a line under it,
 * text, lists, tables, pictures, and the `:::` blocks Columns, Boxes and Steps (Pandoc's fenced divs). `slide <kind>`
 * is the v1 slide, read as before.
 */
export function isBlockSlide(kind: string): boolean {
  return kind === '';
}

/** The picture beside or behind a slide's words (`picture:` left, right or behind), or null. */
export function sidePictureOf(data: SlideData): 'left' | 'right' | 'behind' | null {
  return data.picture === 'left' || data.picture === 'right' || data.picture === 'behind' ? data.picture : null;
}

/** The keys a block slide's header holds: what belongs to the slide as a whole, never its words. */
export const HEADER_KEYS = ['id', 'from', 'skip', 'picture', 'image', 'alt', 'focus', 'kept', 'section'] as const;

/** A block slide's body in its two parts, as written. */
export interface BlockSlideParts {
  /** The header's lines between its `---` lines, or null when the body has no header. */
  header: string | null;
  /** The header as written: its `---` lines and the line break after the closing one ('' without a header). */
  head: string;
  /** The Markdown after the header. */
  markdown: string;
}

/**
 * Split a block slide's body. A header is there only when the body's first line is `---`, a later line is `---`, every
 * line between them is blank, a `key: value` line or a YAML comment, and one of them is a header key; anything else
 * (`Goal: x` in a sentence, a rule, a setext heading, `---` `# Agenda` `---`) is Markdown, so a first paragraph is
 * never read as keys.
 */
export function splitBlockSlide(body: string): BlockSlideParts {
  const lines = body.split('\n');
  if (!/^---[ \t]*\r?$/.test(lines[0] ?? '')) return { header: null, head: '', markdown: body };
  // At least one of the header's own keys: `---`, `# Agenda`, `---` (a rule, a heading, a rule) is Markdown.
  let ownKey = false;
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, '');
    if (/^---[ \t]*$/.test(line)) {
      if (!ownKey) return { header: null, head: '', markdown: body };
      const head = lines.slice(0, index + 1).join('\n');
      const rest = body.slice(head.length);
      return {
        header: lines.slice(1, index).join('\n'),
        head: rest.startsWith('\n') ? `${head}\n` : head,
        markdown: rest.startsWith('\n') ? rest.slice(1) : rest,
      };
    }
    const key = KEY_LINE.exec(line);
    if (key && (HEADER_KEYS as readonly string[]).includes(key[1])) ownKey = true;
    if (line.trim() === '' || /^\s*#/.test(line) || key) continue;
    return { header: null, head: '', markdown: body };
  }
  return { header: null, head: '', markdown: body };
}

/** A heading's words as plain text: its emphasis, code marks, escapes and link targets taken out. */
function plainHeading(text: string): string {
  return text
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|<&$])/g, '$1')
    .replace(/(^|[^\\])[*_`~]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A block slide's title: its first H1 outside code, else its first heading of any level (a slide made only of
 * columns names itself by its first column's heading); '' without one. In memory only: it names the slide in the
 * strip, the go-to box and the page's Contents, and it is never written as a key.
 */
export function blockTitleOf(markdown: string): string {
  let fence: { char: string; size: number } | null = null;
  let comment = false;
  let first = '';
  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index].replace(/\r$/, '');
    // A heading inside a comment is private, never the slide's title (the page and the wall show the title).
    if (comment) {
      const close = line.indexOf('-->');
      if (close < 0) continue;
      comment = false;
      line = line.slice(close + 3);
    }
    if (!fence) {
      line = line.replace(/<!--[\s\S]*?-->/g, '');
      const open = line.indexOf('<!--');
      if (open >= 0) { comment = true; line = line.slice(0, open); }
    }
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.size) fence = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = { char: open[1][0], size: open[1].length }; continue; }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
    let level = 0;
    let words = '';
    if (atx) {
      level = atx[1].length;
      words = atx[2] ?? '';
    } else if (index > 0 && /^ {0,3}(=+|-+)[ \t]*$/.test(line) && lines[index - 1].trim() && !/^ {0,3}(?:[-*+>#]|\d{1,9}[.)]|:::|\||`{3}|~{3})/.test(lines[index - 1]) && !/^ {0,3}(?:-{2,}|={2,})[ \t]*$/.test(lines[index - 1])) {
      // A setext heading: `=` under a line is an H1, `-` an H2 (as the renderer draws them).
      level = line.trim().startsWith('=') ? 1 : 2;
      words = lines[index - 1];
    }
    if (!level) continue;
    const text = plainHeading(words);
    if (!text) continue;
    if (level === 1) return text;
    if (!first) first = text;
  }
  return first;
}

/**
 * A slide's data, from its kind and its body: a v1 slide's YAML (`parseSlideBody`), or a block slide's header with its
 * Markdown and, in memory only, its title (`blockTitleOf`).
 */
export function slideDataOf(kind: string, body: string): SlideData {
  if (!isBlockSlide(kind)) return parseSlideBody(body);
  const parts = splitBlockSlide(body);
  const data: SlideData = {};
  if (parts.header !== null) {
    const header = parseSlideBody(parts.header);
    for (const key of HEADER_KEYS) {
      if (header[key] !== undefined) (data as Record<string, unknown>)[key] = header[key];
    }
  }
  data.markdown = parts.markdown;
  const title = blockTitleOf(parts.markdown);
  if (title) data.title = title;
  return data;
}

/**
 * Write a slide's data into its body, as `writeSlideBody` does for a v1 slide. For a block slide only the header's
 * keys are written, each line only when its value changed, and the Markdown stays byte for byte: a block slide's words
 * are its Markdown, which this writer never touches. A header the slide no longer needs (every key gone, no other
 * line in it) is taken out.
 */
export function writeSlideData(kind: string, body: string, data: SlideData): string {
  if (!isBlockSlide(kind)) return writeSlideBody(body, data);
  const parts = splitBlockSlide(body);
  // The header as it reads, with the header keys from `data`: a line no header key (a `title:` someone wrote there)
  // stays as written.
  const keys: SlideData = parts.header === null ? {} : parseSlideBody(parts.header);
  for (const key of HEADER_KEYS) (keys as Record<string, unknown>)[key] = data[key];
  const inner = writeSlideBody(parts.header ?? '', keys);
  if (inner === (parts.header ?? '')) return body;
  if (inner.trim() === '') return parts.markdown;
  // A slide with no words yet ends at its header, so its fence closes right under it.
  return parts.markdown ? `---\n${inner}\n---\n${parts.markdown}` : `---\n${inner}\n---`;
}

/**
 * A block slide's body with its Markdown replaced, its header kept as written (Sprint 161, PR 2: the stage's writes).
 */
export function withBlockMarkdown(body: string, markdown: string): string {
  const head = splitBlockSlide(body).head;
  if (!head) return markdown;
  if (!markdown) return head.replace(/\r?\n$/, '');
  return head.endsWith('\n') ? head + markdown : `${head}\n${markdown}`;
}

// ---------------------------------------------------------------------------
// The part's heading (16 November: the handout is a Text document)
// ---------------------------------------------------------------------------

/** The words a new deck's title slide starts with (New → Deck), selected so they are typed over. */
export const EMPTY_DECK_TITLE = "The deck's title";

/**
 * The heading a part opens with: an H1 for a section slide (an old Section slide, or a block slide whose header says
 * `section: true`, PR 3), an H2 for every other kind.
 */
export function partHeadingLevel(kind: string, data?: SlideData): 1 | 2 {
  return kind === 'section' || (isBlockSlide(kind) && data?.section === true) ? 1 : 2;
}

/** A part's own heading: an H1 or H2 as the handout's first block (ATX or setext), and where it ends in the handout. */
export interface PartHeading {
  level: 1 | 2;
  /** The heading's Markdown, without its marks. */
  text: string;
  /** Where the heading's lines end in the handout (its blank lines before it included). */
  end: number;
}

/** The handout's own heading, when it opens with an H1 or H2 (blank lines before it allowed); null otherwise. */
export function partHeadingOf(handout: string): PartHeading | null {
  const atx = /^(?:[ \t]*\r?\n)*[ ]{0,3}(#{1,2})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*(?:\r?\n|$)/.exec(handout);
  if (atx) return { level: atx[1].length as 1 | 2, text: (atx[2] ?? '').trim(), end: atx[0].length };
  return setextHeadingOf(handout);
}

/** A line that starts a block of its own, so it can't be a setext heading's text: a list item, a quote, a fence, a table. */
const BLOCK_START = /^[ ]{0,3}(?:[-*+][ \t]|\d{1,9}[.)](?:[ \t]|$)|>|#|`{3}|~{3}|\|)/;

/**
 * A setext heading as the handout's first block, as CommonMark (and `marked`, the editor's and the page's reader) reads
 * one: a paragraph of one or more lines, then a line of `=` (H1) or `-` (H2). Its text is the lines joined by spaces.
 */
function setextHeadingOf(handout: string): PartHeading | null {
  const lines = handout.split('\n');
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index++;
  const text: string[] = [];
  for (; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, '');
    if (line.trim() === '') return null;
    const underline = /^[ ]{0,3}(=+|-+)[ \t]*$/.exec(line);
    if (underline && text.length > 0) {
      // Its lines end after the underline's line break (the blank lines before it included).
      const end = lines.slice(0, index + 1).reduce((sum, next) => sum + next.length + 1, 0);
      return { level: underline[1].startsWith('=') ? 1 : 2, text: text.join(' '), end: Math.min(handout.length, end) };
    }
    // Its first line can't be indented code; a later one is a lazy continuation, whatever its indent.
    if (BLOCK_START.test(line) || (text.length === 0 && /^[ ]{4}/.test(line)) || /^[ ]{0,3}(?:\*[ \t]*){3,}$/.test(line)) return null;
    text.push(line.trim());
  }
  return null;
}

/** The handout without its own heading: what a library copy's stamp covers (a heading is never a change to the slide). */
export function handoutWithoutHeading(handout: string): string {
  const heading = partHeadingOf(handout);
  return heading ? handout.slice(heading.end) : handout;
}

/** The heading drawn for a part without its own: its slide's title; none for a new deck's words to type over. */
export function derivedHeading(data: SlideData): string {
  const title = (data.title ?? '').trim();
  return title === EMPTY_DECK_TITLE ? '' : title;
}

/** A heading's words as Markdown: the characters that would read as marks are escaped, so it reads back the same. */
export function headingMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/(\s)#+$|^#+$/, match => match.replace(/#/g, '\\#'));
}

/** The front matter's mark of a deck whose handout is written as a Text document, with its own headings. */
export const TEXT_HANDOUT_KEY = 'handout';
export const TEXT_HANDOUT_VALUE = 'text';

/** Is this deck's handout written with its own headings (`handout: text`)? Then no heading is ever drawn for it. */
export function isTextHandout(text: string): boolean {
  return frontMatterField(text.replace(/^\uFEFF/, ''), TEXT_HANDOUT_KEY) === TEXT_HANDOUT_VALUE;
}

/** The deck's text with `handout: text` in its front matter (a front matter made when it has none); else as it was. */
export function withTextHandoutMark(text: string): string {
  if (isTextHandout(text)) return text;
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = text.slice(bom.length);
  // An empty front matter (`---` twice): the mark goes between its lines, never into the text after it.
  const empty = /^(---[ \t]*(\r?\n))(---[ \t]*(?:\r?\n|$))/.exec(body);
  if (empty) return bom + empty[1] + `${TEXT_HANDOUT_KEY}: ${TEXT_HANDOUT_VALUE}` + empty[2] + empty[3] + body.slice(empty[0].length);
  const match = /^(---[ \t]*(\r?\n))([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(body);
  if (!match) return `${bom}---\n${TEXT_HANDOUT_KEY}: ${TEXT_HANDOUT_VALUE}\n---\n\n${body}`;
  const lines = match[3].split(/\r?\n/).filter(line => KEY_LINE.exec(line)?.[1] !== TEXT_HANDOUT_KEY);
  lines.push(`${TEXT_HANDOUT_KEY}: ${TEXT_HANDOUT_VALUE}`);
  return bom + match[1] + lines.join(match[2]) + match[4] + body.slice(match[0].length);
}

/**
 * A deck's text with its handout written as a Text document, as the deck view's first real edit writes it: each part
 * without a heading of its own gets the one drawn from its slide's title, and the front matter gets `handout: text`.
 * A deck that has the mark already is returned as it is. Every slide block stays byte for byte.
 */
export function withWrittenHandout(text: string): string {
  if (isTextHandout(text)) return text;
  const deck = parseDeck(text);
  let out = text;
  for (const slide of [...deck.slides].reverse()) {
    if (partHeadingOf(text.slice(slide.handoutStart, slide.handoutEnd))) continue;
    const heading = withPartHeading(slide.kind, slideDataOf(slide.kind, slide.body), '');
    if (heading) out = `${out.slice(0, slide.end)}\n\n${heading}${out.slice(slide.end)}`;
  }
  return withTextHandoutMark(out);
}

/**
 * A part's handout with its heading: the handout as it is when it opens with one, else with the heading drawn from the
 * slide's title before it (a part an AI or the library makes: making a part writes its heading). No title, no heading.
 */
export function withPartHeading(kind: string, data: SlideData, handout: string): string {
  if (partHeadingOf(handout)) return handout;
  const text = derivedHeading(data);
  if (!text) return handout;
  const heading = `${'#'.repeat(partHeadingLevel(kind, data))} ${headingMarkdown(text)}`;
  const rest = handout.replace(/^\s+/, '');
  return rest ? `${heading}\n\n${rest}` : heading;
}

// ---------------------------------------------------------------------------
// Ids and the from line
// ---------------------------------------------------------------------------

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** A new slide id: four characters, base36 with a letter first, not one of `taken`. */
export function newId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken);
  for (;;) {
    let id = '';
    // A letter first, so a new id never reads as a number and is written without quotes.
    for (let index = 0; index < 4; index++) {
      const alphabet = index === 0 ? ID_ALPHABET.slice(10) : ID_ALPHABET;
      id += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
    }
    if (!used.has(id)) return id;
  }
}

/** Where a copy came from: `<project-relative path>#<source id> @<stamp>`. */
export interface SlideSource {
  path: string;
  id: string;
  stamp: string | null;
}

export function parseFrom(from: string | undefined): SlideSource | null {
  if (!from) return null;
  const match = /^(.+)#([0-9a-z]+)(?:\s+@([0-9a-z]+))?\s*$/i.exec(from.trim());
  if (!match) return null;
  return { path: match[1].trim(), id: match[2], stamp: match[3] ?? null };
}

export function writeFrom(source: SlideSource): string {
  return `${source.path}#${source.id}${source.stamp ? ` @${source.stamp}` : ''}`;
}
