/**
 * v1.12.0 RC fix — pages for a document that carries no page layout.
 *
 * docx-preview starts a page only where the file says so: a manual page break,
 * a section break, or the page markers Word writes when it saves. A document
 * made by any other program has none, so it drew as one page many pages tall.
 *
 * The viewer lays such a document out in passes:
 *  1. `markBodyBlocks` puts a bookmark in every top-level paragraph and in the
 *     first cell of every row of a top-level table; docx-preview draws each one
 *     as `<span id=…>`, so the viewer can measure where every block lands.
 *  2. `planPageBreaks` decides, from those measurements and the page size,
 *     where a page must start: before a block, before a table row, or inside a
 *     paragraph between two of its lines. A heading that Word keeps with the
 *     next paragraph moves with it; a paragraph split across pages leaves at
 *     least two lines on each side when Word's widow control asks for it; a
 *     table breaks between rows and repeats its header rows.
 *  3. `insertPageBreaks` writes those breaks into the document, and docx-preview
 *     draws it again — so every page gets its own header, footer, footnotes and
 *     page number, exactly as for a page break Word wrote.
 *
 * Page breaks fall where this layout puts them, not where Word would: fonts and
 * line breaking differ, so a page can end a line or two earlier or later.
 */
import { markerBookmark } from './docxXml';
import { decodeXml, encodeXml } from './symbolFonts';

export const BLOCK_MARKER = '_rmb';
export const CARRIER_MARKER = '_rmc';
/** Ends the first part of a paragraph split across pages (its last line is justified like the rest). */
export const SPLIT_MARKER = '_rms';
/** Starts each later part of a split paragraph, followed by its block marker: `_rmp0_rmb12`. */
export const CONTINUED_MARKER = '_rmp';
/** Starts an empty paragraph, with its paragraph mark's size in half-points: `_rme4s2`. */
export const EMPTY_MARKER = '_rme';
const BLOCK_BOOKMARK_ID = 1_800_000_000;
const CARRIER_BOOKMARK_ID = 1_700_000_000;
const SPLIT_BOOKMARK_ID = 1_600_000_000;
const CONTINUED_BOOKMARK_ID = 1_500_000_000;
const EMPTY_BOOKMARK_ID = 1_400_000_000;

/** What a block marker stands for. */
export type BlockMarker =
  | {
      kind: 'p';
      keepNext: boolean;
      /** Word's widow and orphan control: at least two lines on each side of a split. */
      widowControl: boolean;
      /** Length of the text a split counts in, when the paragraph may be split across pages; null when it may not. */
      splitText: number | null;
      /** Border spacing docx-preview leaves out; absent when the paragraph has no border. */
      borders?: BorderSpaces;
    }
  | { kind: 'row'; index: number; header: boolean };

/** The space (pt) Word keeps between a paragraph's text and each of its borders, for the sides that have one. */
export interface BorderSpaces {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/** A page starts inside the paragraph, before the character at `offset` of its text. */
export function splitBreak(marker: string, offset: number): string {
  return `${marker}@${offset}`;
}

// ─── Reading the document body ──────────────────────────────────────────────

interface Span {
  start: number;
  end: number;
}

interface ScannedProperties extends Span {
  /** Index just after `<w:pPr …>`, or null for a self-closing `<w:pPr/>`. */
  openEnd: number | null;
  inner: string;
}

interface ScannedParagraph extends Span {
  kind: 'p';
  openEnd: number;
  selfClosing: boolean;
  /** Where a marker goes: after the paragraph properties, or right after the start tag. */
  insertAt: number;
  pPr: ScannedProperties | null;
  markers: string[];
}

interface ScannedRow extends Span {
  header: boolean;
  /** The first paragraph of the row's first cell — where the row's marker goes. */
  firstParagraph: ScannedParagraph | null;
  markers: string[];
  cells: number;
}

interface ScannedTable extends Span {
  kind: 'tbl';
  tblPr: string;
  tblGrid: string;
  rows: ScannedRow[];
}

type ScannedBlock = ScannedParagraph | ScannedTable;

interface Frame {
  name: string;
  /** Children of this element are the document body's flow of blocks. */
  flow: boolean;
  paragraph?: ScannedParagraph;
  table?: ScannedTable;
  row?: ScannedRow;
  cellOf?: ScannedRow;
  firstCell?: boolean;
}

// Elements that wrap blocks without leaving the body's flow.
const FLOW_WRAPPERS = new Set(['w:sdt', 'w:sdtContent', 'w:customXml']);
const TAG = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g;

function isOn(element: string): boolean {
  const val = /\bw:val="([^"]*)"/.exec(element)?.[1];
  return val === undefined || !['0', 'false', 'off'].includes(val);
}

/** Paragraph properties starting at `at` (after optional whitespace), with nested `w:pPr` (tracked changes) matched. */
function readProperties(xml: string, at: number): ScannedProperties | null {
  const open = /\s*<w:pPr\b([^>]*?)(\/?)>/y;
  open.lastIndex = at;
  const m = open.exec(xml);
  if (!m) return null;
  const start = at + m[0].indexOf('<');
  const openEnd = at + m[0].length;
  if (m[2]) return { start, end: openEnd, openEnd: null, inner: '' };
  const re = /<(\/?)w:pPr\b[^>]*?(\/?)>/g;
  re.lastIndex = openEnd;
  let depth = 1;
  for (let t = re.exec(xml); t; t = re.exec(xml)) {
    if (t[1]) depth--;
    else if (!t[2]) depth++;
    if (depth === 0) {
      return { start, end: t.index + t[0].length, openEnd, inner: xml.slice(openEnd, t.index) };
    }
  }
  return null;
}

function scanParagraph(xml: string, start: number, openEnd: number, selfClosing: boolean): ScannedParagraph {
  const pPr = selfClosing ? null : readProperties(xml, openEnd);
  return { kind: 'p', start, end: openEnd, openEnd, selfClosing, insertAt: pPr ? pPr.end : openEnd, pPr, markers: [] };
}

/** The document body's blocks: top-level paragraphs and tables, with each table's rows. */
function scanBody(xml: string): ScannedBlock[] {
  const blocks: ScannedBlock[] = [];
  const stack: Frame[] = [];
  TAG.lastIndex = 0;
  for (let m = TAG.exec(xml); m; m = TAG.exec(xml)) {
    const [whole, closing, name, attrs, selfClosing] = m;
    const start = m.index;
    const end = start + whole.length;
    if (closing) {
      const frame = stack.pop();
      if (frame?.paragraph) frame.paragraph.end = end;
      if (frame?.row) frame.row.end = end;
      if (frame?.table) frame.table.end = end;
      continue;
    }
    const top = stack[stack.length - 1];
    if (name === 'w:bookmarkStart') {
      const bookmark = /\bw:name="([^"]*)"/.exec(attrs)?.[1];
      if (bookmark?.startsWith(BLOCK_MARKER)) {
        for (let i = stack.length - 1; i >= 0; i--) {
          const owner = stack[i].paragraph ?? stack[i].row;
          if (owner) {
            owner.markers.push(bookmark);
            break;
          }
        }
      }
      continue;
    }
    const frame: Frame = { name, flow: false };
    if (name === 'w:body') {
      frame.flow = true;
    } else if (FLOW_WRAPPERS.has(name)) {
      frame.flow = Boolean(top?.flow);
    } else if (name === 'w:p' && top?.flow) {
      frame.paragraph = scanParagraph(xml, start, end, Boolean(selfClosing));
      if (selfClosing) frame.paragraph.end = end;
      blocks.push(frame.paragraph);
    } else if (name === 'w:tbl' && top?.flow) {
      const head = /\s*(<w:tblPr\b[\s\S]*?<\/w:tblPr>|<w:tblPr\s*\/>)?\s*(<w:tblGrid\b[\s\S]*?<\/w:tblGrid>|<w:tblGrid\s*\/>)?/y;
      head.lastIndex = end;
      const h = head.exec(xml);
      frame.table = { kind: 'tbl', start, end, tblPr: h?.[1] ?? '', tblGrid: h?.[2] ?? '', rows: [] };
      blocks.push(frame.table);
    } else if (name === 'w:tr' && top?.table) {
      const firstCell = xml.indexOf('<w:tc', end);
      const rowHead = xml.slice(end, firstCell < 0 ? end : firstCell);
      const tblHeader = /<w:tblHeader\b[^>]*\/>/.exec(rowHead)?.[0];
      frame.row = { start, end, header: Boolean(tblHeader && isOn(tblHeader)), firstParagraph: null, markers: [], cells: 0 };
      top.table.rows.push(frame.row);
    } else if (name === 'w:tc' && top?.row) {
      frame.cellOf = top.row;
      frame.firstCell = top.row.cells++ === 0;
    } else if (name === 'w:p' && top?.firstCell && top.cellOf && !top.cellOf.firstParagraph) {
      // Not a frame of its own: a marker found inside it belongs to the row.
      top.cellOf.firstParagraph = scanParagraph(xml, start, end, Boolean(selfClosing));
    }
    if (!selfClosing) stack.push(frame);
  }
  return blocks;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

function applyEdits(xml: string, edits: Edit[]): string {
  edits.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** Put a marker into a paragraph: after its properties, or expand a self-closing `<w:p/>`. */
function markerEdit(xml: string, p: ScannedParagraph, marker: string): Edit {
  if (p.selfClosing) {
    const attrs = xml.slice(p.start + '<w:p'.length, p.openEnd).replace(/\/>$/, '').replace(/\s*$/, '');
    return { start: p.start, end: p.openEnd, text: `<w:p${attrs}>${marker}</w:p>` };
  }
  return { start: p.insertAt, end: p.insertAt, text: marker };
}

/** Paragraph properties that decide how a paragraph flows across pages. */
export type FlowFlag = 'keepNext' | 'keepLines' | 'widowControl';

/** A flag's value in paragraph properties, or undefined when they don't set it. */
function ownFlag(pPr: string, flag: FlowFlag): boolean | undefined {
  const element = new RegExp(`<w:${flag}\\b[^>]*\\/>`).exec(pPr)?.[0];
  return element === undefined ? undefined : isOn(element);
}

/**
 * A flag's value when nothing sets it. Word keeps widow and orphan control on
 * unless the document turns it off (checked against Word: a document that
 * never mentions it lays out as one that sets it); the keep flags are off.
 */
const FLAG_DEFAULT: Record<FlowFlag, boolean> = { keepNext: false, keepLines: false, widowControl: true };

/**
 * How the document's paragraph styles set the flow flags: through `w:basedOn`,
 * then the document defaults (`w:pPrDefault`), then Word's own defaults. A
 * paragraph without a style takes the default paragraph style.
 */
export interface ParagraphStyles {
  flag(styleId: string | undefined, flag: FlowFlag): boolean;
  /** The paragraph borders (`w:pBdr` contents) the style gives, through `w:basedOn`. */
  borders(styleId: string | undefined): string | undefined;
  /** The style's font size (half-points), through `w:basedOn`, else the document default, else Word's 10 pt. */
  markSize(styleId: string | undefined): number;
}

export function paragraphStyles(stylesXml: string | null): ParagraphStyles {
  const xml = stylesXml ?? '';
  const defaults = /<w:pPrDefault>([\s\S]*?)<\/w:pPrDefault>/.exec(xml)?.[1] ?? '';
  const runDefaults = /<w:rPrDefault>([\s\S]*?)<\/w:rPrDefault>/.exec(xml)?.[1] ?? '';
  const styles = new Map<string, { basedOn?: string; pPr: string; rPr: string }>();
  let defaultStyle: string | undefined;
  for (const m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/\bw:type="paragraph"/.test(m[1])) continue;
    const id = /\bw:styleId="([^"]*)"/.exec(m[1])?.[1];
    if (!id) continue;
    const pPr = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/.exec(m[2]);
    styles.set(id, {
      basedOn: /<w:basedOn\s+w:val="([^"]*)"/.exec(m[2])?.[1],
      pPr: pPr?.[1] ?? '',
      rPr: /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(pPr ? m[2].replace(pPr[0], '') : m[2])?.[1] ?? '',
    });
    if (/\bw:default="(?:1|true)"/.test(m[1])) defaultStyle = id;
  }
  const resolve = (id: string | undefined, flag: FlowFlag, seen = new Set<string>()): boolean | undefined => {
    const style = id === undefined ? undefined : styles.get(id);
    if (!style || seen.has(id!)) return undefined;
    seen.add(id!);
    return ownFlag(style.pPr, flag) ?? resolve(style.basedOn, flag, seen);
  };
  const cache = new Map<string, boolean>();
  const bordersOf = (id: string | undefined, seen = new Set<string>()): string | undefined => {
    const style = id === undefined ? undefined : styles.get(id);
    if (!style || seen.has(id!)) return undefined;
    seen.add(id!);
    return /<w:pBdr>([\s\S]*?)<\/w:pBdr>/.exec(style.pPr)?.[1] ?? bordersOf(style.basedOn, seen);
  };
  const sizeOf = (id: string | undefined, seen = new Set<string>()): number | undefined => {
    const style = id === undefined ? undefined : styles.get(id);
    if (!style || seen.has(id!)) return undefined;
    seen.add(id!);
    return runSize(style.rPr) ?? sizeOf(style.basedOn, seen);
  };
  return {
    flag(styleId, flag) {
      const key = `${styleId ?? ''}|${flag}`;
      let value = cache.get(key);
      if (value === undefined) {
        const style = styleId !== undefined && styles.has(styleId) ? styleId : defaultStyle;
        value = resolve(style, flag) ?? ownFlag(defaults, flag) ?? FLAG_DEFAULT[flag];
        cache.set(key, value);
      }
      return value;
    },
    borders(styleId) {
      return bordersOf(styleId !== undefined && styles.has(styleId) ? styleId : defaultStyle);
    },
    markSize(styleId) {
      return sizeOf(styleId !== undefined && styles.has(styleId) ? styleId : defaultStyle) ?? runSize(runDefaults) ?? 20;
    },
  };
}

/** The font size (half-points) run properties set, if they do. */
function runSize(rPr: string): number | undefined {
  const size = /<w:sz\s+w:val="(\d+)"/.exec(rPr)?.[1];
  return size ? Number(size) : undefined;
}

/** The spacing of the borders a `w:pBdr` draws (sides set to none draw nothing). */
export function borderSpaces(pBdr: string | undefined): BorderSpaces | undefined {
  if (!pBdr) return undefined;
  const out: BorderSpaces = {};
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    const element = new RegExp(`<w:(?:${side}|${side === 'left' ? 'start' : side === 'right' ? 'end' : side})\\b[^>]*\\/>`).exec(pBdr)?.[0];
    if (!element) continue;
    const val = /\bw:val="([^"]*)"/.exec(element)?.[1];
    if (!val || val === 'nil' || val === 'none') continue;
    out[side] = Number(/\bw:space="(\d+)"/.exec(element)?.[1] ?? 0);
  }
  return Object.keys(out).length ? out : undefined;
}

function paragraphBorders(p: ScannedParagraph, styles: ParagraphStyles): BorderSpaces | undefined {
  const inner = p.pPr?.inner ?? '';
  const own = /<w:pBdr>([\s\S]*?)<\/w:pBdr>/.exec(inner)?.[1];
  return borderSpaces(own ?? styles.borders(/<w:pStyle\s+w:val="([^"]*)"/.exec(inner)?.[1]));
}

function paragraphFlag(p: ScannedParagraph, styles: ParagraphStyles, flag: FlowFlag): boolean {
  const inner = p.pPr?.inner ?? '';
  return ownFlag(inner, flag) ?? styles.flag(/<w:pStyle\s+w:val="([^"]*)"/.exec(inner)?.[1], flag);
}

// What a paragraph may hold for it to be split across pages: runs of text,
// tabs and line breaks, in hyperlinks or not. Anything else — fields, pictures,
// footnote references, tracked deletions, numbering — moves the paragraph whole.
const SPLITTABLE_CONTENT = new Set(['w:r', 'w:t', 'w:tab', 'w:br', 'w:lastRenderedPageBreak', 'w:hyperlink', 'w:bookmarkStart', 'w:bookmarkEnd', 'w:proofErr']);
const RUN_PROPERTIES = /<w:rPr\b[^>]*\/>|<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g;

/**
 * The length of the text a split is counted in — `w:t` text plus one per tab,
 * the same text docx-preview puts on screen — or null when the paragraph must
 * not be split.
 */
function splittableText(xml: string, p: ScannedParagraph, styles: ParagraphStyles): number | null {
  if (p.selfClosing || !p.end) return null;
  const pPr = p.pPr?.inner ?? '';
  if (/<w:(?:numPr|sectPr|framePr)\b/.test(pPr) || paragraphFlag(p, styles, 'keepLines')) return null;
  const content = xml.slice(p.insertAt, p.end - '</w:p>'.length).replace(RUN_PROPERTIES, '');
  for (const m of content.matchAll(/<\/?([A-Za-z_][\w:.-]*)/g)) {
    if (!SPLITTABLE_CONTENT.has(m[1])) return null;
  }
  if (/<w:br\b[^>]*\bw:type="(?:page|column)"/.test(content)) return null;
  let length = 0;
  for (const m of content.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>|<w:tab\b[^>]*\/>/g)) {
    length += m[1] !== undefined ? decodeXml(m[1]).length : 1;
  }
  return length > 0 ? length : null;
}

// Besides its properties, an empty paragraph holds nothing that draws.
const EMPTY_CONTENT = new Set([
  'w:r', 'w:t', 'w:rPr', 'w:rPrChange', 'w:bookmarkStart', 'w:bookmarkEnd', 'w:proofErr', 'w:lastRenderedPageBreak',
  'w:permStart', 'w:permEnd', 'w:commentRangeStart', 'w:commentRangeEnd',
]);

/**
 * v1.12.0 RC fix: in Word an empty paragraph is one line of its paragraph mark
 * — a 1 pt mark makes a hairline, a 12 pt one a blank line — and docx-preview
 * drew every one as tall as the webview's own font. Put a marker naming the
 * mark's size (its own run properties, else its style's) in each empty
 * paragraph, anywhere in the part, for `alignParagraphFonts`. `firstIndex`
 * numbers the markers on across parts; returns the next one.
 */
export function markEmptyParagraphs(xml: string, styles: ParagraphStyles, firstIndex = 0): { xml: string; next: number } {
  const edits: Edit[] = [];
  let n = firstIndex;
  const bookmark = (size: number) => {
    const index = n++;
    return markerBookmark(EMPTY_BOOKMARK_ID + index, `${EMPTY_MARKER}${index}s${size}`);
  };
  const open = /<w:p\b([^>]*?)(\/?)>/g;
  for (let m = open.exec(xml); m; m = open.exec(xml)) {
    const start = m.index;
    const openEnd = start + m[0].length;
    if (m[2]) {
      edits.push({ start, end: openEnd, text: `<w:p${m[1].replace(/\s+$/, '')}>${bookmark(styles.markSize(undefined))}</w:p>` });
      continue;
    }
    const close = xml.indexOf('</w:p>', openEnd);
    if (close < 0) break;
    const pPr = readProperties(xml, openEnd);
    const bodyStart = pPr ? pPr.end : openEnd;
    const content = xml.slice(bodyStart, close);
    // A paragraph holding paragraphs (a text box) or text is not empty.
    if (/<w:p\b/.test(content) || /<w:t\b[^>]*>[^<]/.test(content)) continue;
    const tags = content.replace(RUN_PROPERTIES, '').matchAll(/<\/?([A-Za-z_][\w:.-]*)/g);
    if ([...tags].some((t) => !EMPTY_CONTENT.has(t[1]))) continue;
    const inner = pPr?.inner ?? '';
    const markRun = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(inner)?.[1] ?? '';
    const size = runSize(markRun) ?? styles.markSize(/<w:pStyle\s+w:val="([^"]*)"/.exec(inner)?.[1]);
    edits.push({ start: bodyStart, end: bodyStart, text: bookmark(size) });
  }
  return { xml: edits.length ? applyEdits(xml, edits) : xml, next: n };
}

/**
 * Pass 1: a bookmark in every top-level paragraph and in the first cell of
 * every row of every top-level table. Returns the marked document and what
 * each marker stands for.
 */
export function markBodyBlocks(
  documentXml: string,
  styles: ParagraphStyles,
): { xml: string; markers: Map<string, BlockMarker> } {
  const markers = new Map<string, BlockMarker>();
  const edits: Edit[] = [];
  let n = 0;
  const next = () => {
    const name = `${BLOCK_MARKER}${n}`;
    const bookmark = markerBookmark(BLOCK_BOOKMARK_ID + n, name);
    n++;
    return { name, bookmark };
  };
  for (const block of scanBody(documentXml)) {
    if (block.kind === 'p') {
      const { name, bookmark } = next();
      const borders = paragraphBorders(block, styles);
      markers.set(name, {
        kind: 'p',
        keepNext: paragraphFlag(block, styles, 'keepNext'),
        widowControl: paragraphFlag(block, styles, 'widowControl'),
        splitText: splittableText(documentXml, block, styles),
        ...(borders ? { borders } : {}),
      });
      edits.push(markerEdit(documentXml, block, bookmark));
      continue;
    }
    let leadingHeader = true;
    block.rows.forEach((row, index) => {
      leadingHeader = leadingHeader && row.header;
      if (!row.firstParagraph) return;
      const { name, bookmark } = next();
      markers.set(name, { kind: 'row', index, header: leadingHeader });
      edits.push(markerEdit(documentXml, row.firstParagraph, bookmark));
    });
  }
  return { xml: edits.length ? applyEdits(documentXml, edits) : documentXml, markers };
}

// ─── Writing page breaks ────────────────────────────────────────────────────

const OUR_MARKER = new RegExp(String.raw`<w:bookmarkStart w:id="\d+" w:name="${BLOCK_MARKER}\d+"/><w:bookmarkEnd w:id="\d+"/>`, 'g');

/** A paragraph that only starts a page: it carries the break before a table, and the viewer removes it after drawing. */
function carrier(index: number): string {
  return (
    '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>' +
    `${markerBookmark(CARRIER_BOOKMARK_ID + index, `${CARRIER_MARKER}${index}`)}</w:p>`
  );
}

/** Table properties for a continuation that does not repeat header rows: no first-row look. */
function withoutFirstRowLook(tblPr: string): string {
  return tblPr.replace(/<w:tblLook\b[^>]*\/>/, (look) =>
    look
      .replace(/\bw:firstRow="(?:1|true)"/, 'w:firstRow="0"')
      .replace(/\bw:val="([0-9a-fA-F]{4})"/, (_m, hex: string) => `w:val="${(parseInt(hex, 16) & ~0x20).toString(16).padStart(4, '0').toUpperCase()}"`),
  );
}

/** A row that starts a continuation: cells continuing a vertical merge start one instead. */
function restartVerticalMerges(rowXml: string): string {
  return rowXml.replace(/<w:vMerge\s*\/>|<w:vMerge\s+w:val="continue"\s*\/>/g, '<w:vMerge w:val="restart"/>');
}

/**
 * Pass 2: start a page before each named block. A paragraph gets
 * `w:pageBreakBefore`; a table breaks before a row: it is split into two
 * tables with the same properties and grid, the header rows repeated, and a
 * carrier paragraph between them starts the page. A break before a table's
 * first row starts the page before the whole table.
 */
/** The offsets each paragraph is split at, from its `marker@offset` breaks. */
function splitOffsets(breaks: ReadonlySet<string>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const b of breaks) {
    const at = b.lastIndexOf('@');
    if (at < 0) continue;
    const offset = Number(b.slice(at + 1));
    if (!Number.isInteger(offset) || offset <= 0) continue;
    const marker = b.slice(0, at);
    out.set(marker, [...(out.get(marker) ?? []), offset].sort((a, c) => a - c));
  }
  return out;
}

const PAGE_BREAK_BEFORE = '<w:pageBreakBefore/>';

/** A paragraph's properties with a page break before it. */
function withBreakBefore(pPr: ScannedProperties | null, xml: string): string {
  if (!pPr || pPr.openEnd === null) return `<w:pPr>${PAGE_BREAK_BEFORE}</w:pPr>`;
  const own = xml.slice(pPr.start, pPr.end);
  return own.replace(/^<w:pPr\b[^>]*>/, (open) => open + PAGE_BREAK_BEFORE);
}

/**
 * Properties for the part of a split paragraph that goes on a new page: no
 * space before it and no first-line indent — it is the paragraph's next line,
 * not a new paragraph. The paragraph mark's run properties are left alone.
 */
function continuationProperties(inner: string): string {
  const markRun = /<w:rPr\b[\s\S]*?<\/w:rPr>|<w:rPr\b[^>]*\/>/.exec(inner)?.[0] ?? '';
  let pPr = inner
    .replace(markRun, '')
    .replace(/<w:pPrChange\b[\s\S]*?<\/w:pPrChange>/g, '')
    .replace(/<w:pageBreakBefore\b[^>]*\/>/g, '');
  pPr = /<w:spacing\b/.test(pPr)
    ? pPr.replace(/<w:spacing\b([^>]*?)\/>/, (_m, a: string) => `<w:spacing${a.replace(/\s+w:(?:before|beforeLines|beforeAutospacing)="[^"]*"/g, '')} w:before="0"/>`)
    : `${pPr}<w:spacing w:before="0"/>`;
  pPr = /<w:ind\b/.test(pPr)
    ? pPr.replace(/<w:ind\b([^>]*?)\/>/, (_m, a: string) => `<w:ind${a.replace(/\s+w:(?:firstLine|firstLineChars|hanging|hangingChars)="[^"]*"/g, '')} w:firstLine="0"/>`)
    : `${pPr}<w:ind w:firstLine="0"/>`;
  return `<w:pPr>${PAGE_BREAK_BEFORE}${pPr}${markRun}</w:pPr>`;
}

type RunPart = { kind: 'text'; text: string } | { kind: 'tab' | 'other'; xml: string };
type Atom =
  | { kind: 'run'; link: number; open: string; rPr: string; parts: RunPart[] }
  | { kind: 'raw'; link: number; xml: string };

const TOP_LEVEL = /<w:hyperlink\b[^>]*>[\s\S]*?<\/w:hyperlink>|<w:r\b[^>]*>[\s\S]*?<\/w:r>|<[^>]+\/>/g;
const RUN_PART = /<w:t\b[^>]*>([^<]*)<\/w:t>|<w:t\b[^>]*\/>|<w:tab\b[^>]*\/>|<[^>]+\/>|<[^>]+>[\s\S]*?<\/[^>]+>/g;

/** A splittable paragraph's content as a flat list of runs and markers, each with the hyperlink (by index) it sits in. */
function paragraphAtoms(content: string, links: string[]): Atom[] {
  const atoms: Atom[] = [];
  const addRun = (runXml: string, link: number) => {
    const open = /^<w:r\b[^>]*>/.exec(runXml)![0];
    const inner = runXml.slice(open.length, -'</w:r>'.length);
    const rPr = /^<w:rPr\b[^>]*\/>|^<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/.exec(inner)?.[0] ?? '';
    const parts: RunPart[] = [];
    for (const m of inner.slice(rPr.length).matchAll(RUN_PART)) {
      if (/^<w:tab[\s/>]/.test(m[0])) {
        parts.push({ kind: 'tab', xml: m[0] });
      } else if (/^<w:t[\s/>]/.test(m[0])) {
        if (m[1] !== undefined) parts.push({ kind: 'text', text: decodeXml(m[1]) });
      } else {
        parts.push({ kind: 'other', xml: m[0] });
      }
    }
    atoms.push({ kind: 'run', link, open, rPr, parts });
  };
  for (const m of content.matchAll(TOP_LEVEL)) {
    const xml = m[0];
    if (xml.startsWith('<w:hyperlink')) {
      const open = /^<w:hyperlink\b[^>]*>/.exec(xml)![0];
      links.push(open);
      const link = links.length;
      for (const inner of xml.slice(open.length, -'</w:hyperlink>'.length).matchAll(TOP_LEVEL)) {
        if (/^<w:r[\s>]/.test(inner[0])) addRun(inner[0], link);
        else atoms.push({ kind: 'raw', link, xml: inner[0] });
      }
    } else if (/^<w:r[\s>]/.test(xml)) {
      addRun(xml, 0);
    } else {
      atoms.push({ kind: 'raw', link: 0, xml });
    }
  }
  return atoms;
}

/**
 * Split a paragraph into parts, each starting a page, before the characters at
 * `offsets` of its text (counted as `splittableText` counts them). Runs cut in
 * two keep their properties on both sides, and a cut hyperlink continues.
 */
function splitParagraph(
  xml: string,
  block: ScannedParagraph,
  offsets: readonly number[],
  breakBefore: boolean,
  splitBookmark: () => string,
  continuedBookmark: (marker: string) => string,
): string {
  const openTag = xml.slice(block.start, block.openEnd);
  const firstProperties = breakBefore ? withBreakBefore(block.pPr, xml) : block.pPr ? xml.slice(block.pPr.start, block.pPr.end) : '';
  const nextProperties = continuationProperties(block.pPr?.inner ?? '');
  const links: string[] = [];
  const atoms = paragraphAtoms(xml.slice(block.insertAt, block.end - '</w:p>'.length), links);
  const cuts = [...offsets];

  let out = '';
  let body = '';
  let first = true;
  let link = 0;
  const enterLink = (next: number) => {
    if (link === next) return;
    if (link) body += '</w:hyperlink>';
    if (next) body += links[next - 1];
    link = next;
  };
  const blockMarker = block.markers.find((m) => m.startsWith(BLOCK_MARKER));
  const endParagraph = (last: boolean) => {
    enterLink(0);
    const start = first ? openTag + firstProperties : `<w:p>${nextProperties}${blockMarker ? continuedBookmark(blockMarker) : ''}`;
    out += `${start}${body}${last ? '' : splitBookmark()}</w:p>`;
    body = '';
    first = false;
  };

  let count = 0;
  for (const atom of atoms) {
    enterLink(atom.link);
    if (atom.kind === 'raw') {
      body += atom.xml;
      continue;
    }
    let run = '';
    const closeRun = () => {
      if (run) body += `${atom.open}${atom.rPr}${run}</w:r>`;
      run = '';
    };
    const cutHere = (into: number) => {
      closeRun();
      endParagraph(false);
      enterLink(into);
      cuts.shift();
    };
    for (const part of atom.parts) {
      if (part.kind === 'text') {
        let text = part.text;
        while (cuts.length && cuts[0] >= count && cuts[0] < count + text.length) {
          const at = cuts[0] - count;
          if (at > 0) run += `<w:t xml:space="preserve">${encodeXml(text.slice(0, at))}</w:t>`;
          cutHere(atom.link);
          count += at;
          text = text.slice(at);
        }
        if (text) run += `<w:t xml:space="preserve">${encodeXml(text)}</w:t>`;
        count += text.length;
      } else if (part.kind === 'tab') {
        if (cuts.length && cuts[0] === count) cutHere(atom.link);
        run += part.xml;
        count += 1;
      } else {
        run += part.xml;
      }
    }
    closeRun();
  }
  endParagraph(true);
  return out;
}

/**
 * Fix the column widths the first drawing gave each automatically laid out
 * table (by its first row's marker; px), so that every part of a table split
 * across pages keeps them — the browser would size each part's columns anew,
 * and its rows would no longer be the heights the layout was planned with.
 */
export function pinTableGrids(markedXml: string, widths: ReadonlyMap<string, readonly number[]>): string {
  if (!widths.size) return markedXml;
  const edits: Edit[] = [];
  for (const block of scanBody(markedXml)) {
    if (block.kind !== 'tbl' || !block.tblGrid) continue;
    const pinned = block.rows[0]?.markers.map((m) => widths.get(m)).find(Boolean);
    if (!pinned) continue;
    const gridStart = markedXml.indexOf(block.tblGrid, block.start);
    if (gridStart < 0) continue;
    // px to twips: 1 px = 15 twips at 96 dpi.
    const grid = `<w:tblGrid>${pinned.map((px) => `<w:gridCol w:w="${Math.round(px * 15)}"/>`).join('')}</w:tblGrid>`;
    edits.push({ start: gridStart, end: gridStart + block.tblGrid.length, text: grid });
    if (block.tblPr && !/<w:tblLayout\b/.test(block.tblPr)) {
      const prStart = markedXml.indexOf(block.tblPr, block.start);
      const layout = block.tblPr.replace(/<\/w:tblPr>$|<w:tblPr\s*\/>$/, (end) =>
        end.startsWith('</') ? `<w:tblLayout w:type="fixed"/></w:tblPr>` : '<w:tblPr><w:tblLayout w:type="fixed"/></w:tblPr>',
      );
      if (prStart >= 0) edits.push({ start: prStart, end: prStart + block.tblPr.length, text: layout });
    }
  }
  return edits.length ? applyEdits(markedXml, edits) : markedXml;
}

export function insertPageBreaks(markedXml: string, breaks: ReadonlySet<string>): string {
  if (!breaks.size) return markedXml;
  const edits: Edit[] = [];
  const splits = splitOffsets(breaks);
  let carriers = 0;
  let splitParts = 0;
  const splitBookmark = () => {
    const index = splitParts++;
    return markerBookmark(SPLIT_BOOKMARK_ID + index, `${SPLIT_MARKER}${index}`);
  };
  let continuedParts = 0;
  const continuedBookmark = (marker: string) => {
    const index = continuedParts++;
    return markerBookmark(CONTINUED_BOOKMARK_ID + index, `${CONTINUED_MARKER}${index}${marker}`);
  };
  for (const block of scanBody(markedXml)) {
    if (block.kind === 'p') {
      const breakBefore = block.markers.some((m) => breaks.has(m));
      const offsets = block.markers.flatMap((m) => splits.get(m) ?? []);
      if (offsets.length) {
        edits.push({ start: block.start, end: block.end, text: splitParagraph(markedXml, block, offsets, breakBefore, splitBookmark, continuedBookmark) });
        continue;
      }
      if (!breakBefore) continue;
      const pPr = block.pPr;
      if (!pPr || pPr.openEnd === null) {
        const at = pPr ? pPr.start : block.openEnd;
        edits.push({ start: at, end: pPr ? pPr.end : at, text: withBreakBefore(pPr, markedXml) });
      } else {
        edits.push({ start: pPr.openEnd, end: pPr.openEnd, text: PAGE_BREAK_BEFORE });
      }
      continue;
    }
    const headerCount = block.rows.findIndex((row) => !row.header);
    const headerRows = headerCount > 0 ? block.rows.slice(0, headerCount) : [];
    const headerXml = headerRows.map((row) => markedXml.slice(row.start, row.end).replace(OUR_MARKER, '')).join('');
    block.rows.forEach((row, index) => {
      if (!row.markers.some((m) => breaks.has(m))) return;
      if (index === 0) {
        edits.push({ start: block.start, end: block.start, text: carrier(carriers++) });
        return;
      }
      const repeat = index >= headerRows.length ? headerXml : '';
      const tblPr = repeat ? block.tblPr : withoutFirstRowLook(block.tblPr);
      const rowXml = markedXml.slice(row.start, row.end);
      edits.push({
        start: row.start,
        end: row.end,
        text: `</w:tbl>${carrier(carriers++)}<w:tbl>${tblPr}${block.tblGrid}${repeat}${restartVerticalMerges(rowXml)}`,
      });
    });
  }
  return edits.length ? applyEdits(markedXml, edits) : markedXml;
}

// ─── Deciding where pages start ─────────────────────────────────────────────

export interface MeasuredRow {
  marker: string;
  /** px from the top of the drawn page, border box. */
  top: number;
  bottom: number;
  header: boolean;
}

export interface MeasuredBlock {
  marker: string;
  top: number;
  bottom: number;
  /** The space above it, which moves to the new page with it. */
  marginTop: number;
  keepNext: boolean;
  rows?: MeasuredRow[];
  /** Height of the header rows a continuation of this table repeats. */
  headerHeight?: number;
  /** A paragraph that may split across pages: its lines, measured when first asked for; null when they can't be. */
  lines?: () => Line[] | null;
  /** Keep at least two lines on each side of a split (Word's widow and orphan control). */
  widowControl?: boolean;
}

/** One line of a paragraph: where it starts in the paragraph's text, and its box, px from the page's top. */
export interface Line {
  offset: number;
  top: number;
  bottom: number;
}

export interface MeasuredPage {
  /** Where this page's body starts and must end, px from the page's top. */
  contentTop: number;
  contentBottom: number;
  /** The same for a page started by a break inside this one. */
  nextContentTop: number;
  nextContentBottom: number;
  blocks: MeasuredBlock[];
}

const EPSILON = 0.5;

/**
 * The markers of the blocks and rows a new page must start before, so that
 * each drawn page's body fits its page. Pages are planned independently: each
 * `MeasuredPage` is one page as drawn now, however tall.
 */
export function planPageBreaks(pages: readonly MeasuredPage[]): string[] {
  const breaks: string[] = [];
  for (const page of pages) {
    const blocks = page.blocks;
    let shift = 0; // how far up the blocks after the last break moved
    let bottom = page.contentBottom;
    let pageStart = 0; // the first block on the current page
    let rowFrom = 0; // a table running over from the previous page: its first row here
    let i = 0;

    const breakBefore = (index: number) => {
      let at = index;
      while (at - 1 > pageStart && blocks[at - 1].keepNext) at--;
      breaks.push(blocks[at].marker);
      shift = blocks[at].top - blocks[at].marginTop - page.nextContentTop;
      bottom = page.nextContentBottom;
      pageStart = at;
      rowFrom = 0;
      i = at;
    };

    while (i < blocks.length) {
      const block = blocks[i];
      if (block.bottom - shift <= bottom + EPSILON) {
        i++;
        rowFrom = 0;
        continue;
      }
      const rows = block.rows ?? [];
      if (rows.length === 0) {
        // A paragraph: split it between lines if it may be split, else move it whole.
        const lines = block.lines?.() ?? null;
        const keep = block.widowControl ? 2 : 1;
        if (lines && lines.length >= 2 * keep) {
          let from = 0;
          let placed = false;
          while (true) {
            let fit = from;
            while (fit < lines.length && lines[fit].bottom - shift <= bottom + EPSILON) fit++;
            if (fit === lines.length) {
              placed = true; // the rest fits on this page
              break;
            }
            let cut = Math.min(fit, lines.length - keep); // carry at least `keep` lines over
            if (cut - from < keep) {
              if (from === 0 && i !== pageStart) break; // not enough room here: move it whole
              cut = Math.min(from + keep, lines.length - 1); // at a page top: take what fits, at least `keep` lines
              if (cut <= from) {
                placed = true;
                break;
              }
            }
            breaks.push(splitBreak(block.marker, lines[cut].offset));
            shift = lines[cut].top - page.nextContentTop;
            bottom = page.nextContentBottom;
            pageStart = i;
            from = cut;
          }
          if (placed) {
            i++;
            rowFrom = 0;
            continue;
          }
        }
        if (i === pageStart) {
          i++; // taller than a page: it overflows, and the next block starts a page
          continue;
        }
        breakBefore(i);
        continue;
      }
      // A table: break between rows, leaving at least one body row under the
      // header rows on this page (a header alone at a page's foot moves on).
      const leadingHeaders = rows.findIndex((r) => !r.header);
      const headerCount = leadingHeaders < 0 ? rows.length : leadingHeaders;
      const firstBreakable = rowFrom === 0 ? headerCount + 1 : rowFrom + 1;
      let overflow = -1;
      for (let k = rowFrom; k < rows.length; k++) {
        if (rows[k].bottom - shift > bottom + EPSILON) {
          overflow = k;
          break;
        }
      }
      if (overflow === -1) {
        i++;
        rowFrom = 0;
        continue;
      }
      if (overflow < firstBreakable) {
        if (rowFrom === 0 && i !== pageStart) {
          breakBefore(i);
          continue;
        }
        overflow = firstBreakable; // a row taller than the page: let it overflow, break after it
        if (overflow >= rows.length) {
          i++;
          rowFrom = 0;
          continue;
        }
      }
      breaks.push(rows[overflow].marker);
      shift = rows[overflow].top - (page.nextContentTop + (block.headerHeight ?? 0));
      bottom = page.nextContentBottom;
      pageStart = i;
      rowFrom = overflow;
    }
  }
  return breaks;
}
