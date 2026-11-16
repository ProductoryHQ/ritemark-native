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
  /** The look of a row of boxes: boxes, steps, arrows or line. */
  look?: string;
  /** Where the picture goes: none, left, right or behind. */
  picture?: string;
  /** The picture's path, relative to the deck's folder. */
  image?: string;
  skip?: boolean;
  /** Keep it here: a changed library copy that stays changed (written by Keep it here). */
  kept?: boolean;
  /** `<project-relative path>#<source id> @<stamp>`: where a copy came from. */
  from?: string;
  items?: SlideItem[];
  rows?: string[][];
}

/** The scalar keys, in the order the writer puts a new key. */
const SCALAR_KEYS = ['id', 'title', 'subtitle', 'number', 'look', 'picture', 'image', 'skip', 'kept', 'from'] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];
const BOOLEAN_KEYS: ReadonlySet<string> = new Set(['skip', 'kept']);
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
 * A front matter (`head`, as `parseDeck` reads it, or '') saying the view's look: unchanged where it says it already,
 * by the view's own rule (`look: borderless` is Borderless, anything else Card); else without its `look:` lines, and
 * with `look: borderless` for Borderless.
 */
function withLook(head: string, look: 'card' | 'borderless'): string {
  if ((frontMatterField(head, 'look') === 'borderless') === (look === 'borderless')) return head;
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

/** Is this front matter's `deck:` one this version reads? Absent or at most 1. */
export function isReadableDeckVersion(version: string | null): boolean {
  if (version === null || version.trim() === '') return true;
  const number = Number(version);
  return Number.isFinite(number) && number <= 1;
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
