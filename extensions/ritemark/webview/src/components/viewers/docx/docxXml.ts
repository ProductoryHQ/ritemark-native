/**
 * Sprint 124 (#284) R2 — fixes applied to a Word document's XML before
 * docx-preview draws it. Each one answers a defect measured against Word
 * (docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/research/renderer-spike.md).
 *
 * All pure string transforms: no DOM, no zip, no renderer internals, so they
 * keep working whatever docx-preview does inside.
 */
import { decodeXml } from './symbolFonts';

const FIELD_PART = /(<w:fldChar\b[^>]*\/>|<w:fldChar\b[^>]*>[\s\S]*?<\/w:fldChar>|<w:instrText\b[^>]*\/>|<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>)/;

/**
 * v1.12.0 RC fix: some generators (the docx npm library among them) write a
 * field's code in the same run as the text around it —
 * `<w:r><w:t>Page </w:t><w:fldChar w:fldCharType="begin"/>…`. docx-preview hides
 * every run that holds field code, and that text with it, so such a footer
 * read "" instead of "Page 3 of 12". Give every field character and every piece
 * of field instruction a run of its own, with the same run properties.
 */
export function splitFieldRuns(xml: string): string {
  if (!/<w:fldChar\b|<w:instrText\b/.test(xml)) return xml;
  return xml.replace(/<w:r\b([^>]*)>((?:(?!<w:r\b)[\s\S])*?)<\/w:r>/g, (run, attrs: string, inner: string) => {
    if (!/<w:fldChar\b|<w:instrText\b/.test(inner)) return run;
    const rPr = /^\s*(<w:rPr\b[^>]*\/>|<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>)/.exec(inner);
    const properties = rPr ? rPr[1] : '';
    const content = rPr ? inner.slice(rPr[0].length) : inner;
    const pieces = content.split(FIELD_PART).filter((piece) => piece.trim() !== '');
    if (pieces.length < 2) return run;
    return pieces.map((piece) => `<w:r${attrs}>${properties}${piece}</w:r>`).join('');
  });
}

/** Stand-ins for PAGE / NUMPAGES results; the viewer writes each page's number over them after rendering. */
export const PAGE_FIELD_MARK = '\uE000PAGE\uE001';
export const NUMPAGES_FIELD_MARK = '\uE000NUMPAGES\uE001';

/**
 * Word stores `<w:lastRenderedPageBreak/>` where its own layout started a page.
 * Honouring those gives Word's pages, but only a document Word saved has them —
 * and honouring them in a document without any loses section breaks (defect 1).
 */
export function hasPageMarkers(documentXml: string): boolean {
  return documentXml.includes('<w:lastRenderedPageBreak');
}

// Anything that puts something on the page. A page marker with none of these
// between it and a page break is Word noting the break it already made. A tab
// *in text* is `<w:tab/>`; `<w:tab w:val=… w:pos=…/>` is a tab stop in the
// paragraph's properties and puts nothing on the page.
const CONTENT = String.raw`<w:t[\s>]|<w:drawing\b|<w:pict\b|<w:object\b|<w:sym\b|<w:tab\s*\/>|<w:br\b|<w:cr\b|<m:oMath|<w:tbl\b`;

const BREAK_THEN_MARKER = new RegExp(
  String.raw`(<w:br\b[^>]*\bw:type="page"[^>]*\/>)((?:(?!${CONTENT}).)*?)<w:lastRenderedPageBreak\s*\/>`,
  'gs',
);

// page-break-before set on the paragraph (`w:val` absent, or 1 / true / on), then
// a marker before that paragraph's first content.
const BREAK_BEFORE_THEN_MARKER = new RegExp(
  String.raw`(<w:pageBreakBefore(?:\s+w:val="(?:1|true|on)")?\s*\/>)((?:(?!${CONTENT}|<\/w:p>).)*?)<w:lastRenderedPageBreak\s*\/>`,
  'gs',
);

/**
 * Defect 2: a manual page break followed by Word's marker, with nothing in
 * between, is one page break. docx-preview breaks for both and draws a blank
 * page; drop the marker.
 */
export function dropRedundantPageMarkers(documentXml: string): string {
  return documentXml
    .replace(BREAK_THEN_MARKER, '$1$2')
    .replace(BREAK_BEFORE_THEN_MARKER, '$1$2');
}

type FieldKind = 'PAGE' | 'NUMPAGES';

function fieldKind(instruction: string): FieldKind | null {
  const name = instruction.trim().split(/\s+/)[0]?.toUpperCase();
  return name === 'PAGE' || name === 'NUMPAGES' ? name : null;
}

function markFor(kind: FieldKind): string {
  return kind === 'PAGE' ? PAGE_FIELD_MARK : NUMPAGES_FIELD_MARK;
}

const MARK_RUN = (kind: FieldKind) => `<w:r><w:t>${markFor(kind)}</w:t></w:r>`;
const TEXT_ELEMENT = /(<w:t\b[^>]*>)([^<]*)(<\/w:t>)/g;

/** Put the mark in place of a field result: first text element gets it, the rest go empty. */
function replaceResultText(result: string, kind: FieldKind): string | null {
  let first = true;
  let found = false;
  const out = result.replace(TEXT_ELEMENT, (_m, open: string, _text: string, close: string) => {
    found = true;
    const text = first ? markFor(kind) : '';
    first = false;
    return `${open}${text}${close}`;
  });
  return found ? out : null;
}

/** Start of the `<w:r>` element enclosing `at` (not `<w:rPr>` or `<w:rFonts>`), or -1. */
function runStartBefore(xml: string, at: number): number {
  let i = xml.lastIndexOf('<w:r', at);
  while (i >= 0 && !/^<w:r[\s>]/.test(xml.slice(i, i + 5))) i = xml.lastIndexOf('<w:r', i - 1);
  return i;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Defect 3: PAGE and NUMPAGES show whatever Word last cached, so every page reads
 * the same number. Replace each field's result with a mark the viewer fills in
 * per rendered page. Handles complex fields (begin / instrText / separate /
 * result / end, possibly with no cached result, as generators write them) and
 * simple fields. Nested fields are left alone.
 */
export function markPageFields(xml: string): string {
  const edits: Edit[] = [];

  // Simple fields.
  const simple = /<w:fldSimple\b([^>]*?)(\/>|>([\s\S]*?)<\/w:fldSimple>)/g;
  for (const m of xml.matchAll(simple)) {
    const instr = /w:instr="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const kind = fieldKind(instr);
    if (!kind) continue;
    const inner = m[3];
    const replacedInner = inner === undefined ? null : replaceResultText(inner, kind);
    const body = replacedInner ?? MARK_RUN(kind);
    edits.push({ start: m.index!, end: m.index! + m[0].length, text: `<w:fldSimple${m[1]}>${body}</w:fldSimple>` });
  }

  // Complex fields: walk the field characters and instruction text in order.
  const token = /<w:fldChar\b[^>]*\bw:fldCharType="(begin|separate|end)"[^>]*\/>|<w:instrText\b[^>]*>([^<]*)<\/w:instrText>/g;
  interface Frame { instr: string; separateEnd: number | null }
  const stack: Frame[] = [];
  for (const m of xml.matchAll(token)) {
    const at = m.index!;
    if (m[2] !== undefined) {
      if (stack.length) stack[stack.length - 1].instr += m[2];
      continue;
    }
    const type = m[1];
    if (type === 'begin') {
      stack.push({ instr: '', separateEnd: null });
    } else if (type === 'separate') {
      if (stack.length) stack[stack.length - 1].separateEnd = at + m[0].length;
    } else {
      const frame = stack.pop();
      if (!frame || stack.length > 0) continue; // unbalanced, or a field inside another
      const kind = fieldKind(frame.instr);
      if (!kind) continue;
      if (frame.separateEnd !== null) {
        const result = xml.slice(frame.separateEnd, at);
        const replaced = replaceResultText(result, kind);
        if (replaced !== null) {
          edits.push({ start: frame.separateEnd, end: at, text: replaced });
        } else {
          // No cached result: add a run right after the run holding `separate`.
          const runClose = result.indexOf('</w:r>');
          if (runClose >= 0) {
            const insertAt = frame.separateEnd + runClose + '</w:r>'.length;
            edits.push({ start: insertAt, end: insertAt, text: MARK_RUN(kind) });
          }
        }
      } else {
        // No `separate` at all: add one and the result before the run holding `end`.
        const runStart = runStartBefore(xml, at);
        if (runStart >= 0) {
          edits.push({ start: runStart, end: runStart, text: `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${MARK_RUN(kind)}` });
        }
      }
    }
  }

  if (!edits.length) return xml;
  edits.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/**
 * Word's single line spacing, as a multiple of the font size: the font's own
 * line height (ascender − descender + line gap, over its units per em). CSS's
 * `line-height: 1` is the font size alone, so Word's "single" and "multiple"
 * spacing drew 15–25 % tighter, and a paragraph without spacing took the
 * webview's line-height of 1.5.
 */
const LINE_HEIGHT_RATIO: Record<string, number> = {
  'calibri': 1.2207, 'calibri light': 1.2207, 'cambria': 1.1719, 'aptos': 1.2, 'aptos display': 1.2, 'aptos narrow': 1.2,
  'arial': 1.1499, 'arial narrow': 1.1499, 'helvetica': 1.1499, 'helvetica neue': 1.1499, 'times new roman': 1.1499,
  'georgia': 1.1362, 'verdana': 1.2153, 'tahoma': 1.2075, 'trebuchet ms': 1.1621, 'segoe ui': 1.3301,
  'century gothic': 1.2251, 'garamond': 1.1235, 'book antiqua': 1.1699, 'palatino linotype': 1.1699,
  'courier new': 1.1328, 'consolas': 1.1709, 'roboto': 1.1719, 'open sans': 1.3618, 'lato': 1.2,
};
const DEFAULT_LINE_HEIGHT_RATIO = 1.17;

/** The line height of a font this table knows (the common system and Office fonts), or null. */
export function knownLineHeightRatio(font: string | null | undefined): number | null {
  return (font && LINE_HEIGHT_RATIO[font.trim().toLowerCase()]) || null;
}

/**
 * The document font's line height: a known font's, else the one read from the
 * font the document embeds (`embedded`, from `fontLineHeightRatio`), else a
 * typical one.
 */
export function lineHeightRatio(font: string | null | undefined, embedded: number | null = null): number {
  return knownLineHeightRatio(font) ?? embedded ?? DEFAULT_LINE_HEIGHT_RATIO;
}

/**
 * v1.12.0 RC fix: the embedded face of `font` to read its line height from —
 * the regular face, else any — as its font-table relationship id and
 * obfuscation key. Null when the document embeds no such font.
 */
export function embeddedFont(fontTableXml: string, font: string): { id: string; key: string | null } | null {
  const wanted = font.trim().toLowerCase();
  for (const m of fontTableXml.matchAll(/<w:font\b([^>]*)>([\s\S]*?)<\/w:font>/g)) {
    const name = /\bw:name="([^"]*)"/.exec(m[1])?.[1];
    if (name === undefined || decodeXml(name).trim().toLowerCase() !== wanted) continue;
    const faces = [...m[2].matchAll(/<w:embed(Regular|Bold|Italic|BoldItalic)\b([^>]*)\/>/g)];
    const face = faces.find((f) => f[1] === 'Regular') ?? faces[0];
    const id = face ? /\br:id="([^"]*)"/.exec(face[2])?.[1] : undefined;
    if (!face || !id) return null;
    return { id, key: /\bw:fontKey="([^"]*)"/.exec(face[2])?.[1] ?? null };
  }
  return null;
}

interface FontFile {
  /** Where each table starts, by tag. */
  tables: Map<string, number>;
  length: number;
  u16(at: number): number;
  i16(at: number): number;
}

/**
 * A font file's table directory. `key` undoes Word's obfuscation of an
 * embedded font (the first 32 bytes, XORed with the key's bytes in reverse
 * order). Null when the data is not a font this can read.
 */
function openFont(data: Uint8Array, key: string | null): FontFile | null {
  if (data.length < 64) return null;
  const start = data.slice(0, 32);
  if (key) {
    const hex = key.replace(/[{}-]/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
    for (let i = 0; i < 32; i++) start[i] ^= parseInt(hex.slice((15 - (i % 16)) * 2, (16 - (i % 16)) * 2), 16);
  }
  const byte = (i: number) => (i < 32 ? start[i] : data[i]);
  const u16 = (i: number) => (byte(i) << 8) | byte(i + 1);
  const u32 = (i: number) => ((u16(i) << 16) | u16(i + 2)) >>> 0;
  const version = u32(0);
  // TrueType (0x00010000 or 'true') or CFF ('OTTO') outlines.
  if (version !== 0x00010000 && version !== 0x74727565 && version !== 0x4f54544f) return null;
  const tables = new Map<string, number>();
  const count = u16(4);
  for (let k = 0; k < count; k++) {
    const at = 12 + 16 * k;
    if (at + 16 > data.length) return null;
    tables.set(String.fromCharCode(byte(at), byte(at + 1), byte(at + 2), byte(at + 3)), u32(at + 8));
  }
  return { tables, length: data.length, u16, i16: (i) => (u16(i) << 16) >> 16 };
}

/**
 * A font file's single line height, as a multiple of its size: ascender −
 * descender + line gap from its `hhea` table, over the units per em in `head`
 * (Word's single spacing, as Word for Mac draws it). Null when the data is not
 * a font this can read.
 */
export function fontLineHeightRatio(data: Uint8Array, key: string | null): number | null {
  const font = openFont(data, key);
  const head = font?.tables.get('head');
  const hhea = font?.tables.get('hhea');
  if (!font || head === undefined || hhea === undefined || head + 20 > font.length || hhea + 10 > font.length) return null;
  const unitsPerEm = font.u16(head + 18);
  if (!unitsPerEm) return null;
  const ratio = (font.i16(hhea + 4) - font.i16(hhea + 6) + font.i16(hhea + 8)) / unitsPerEm;
  return ratio >= 0.8 && ratio <= 3 ? ratio : null;
}

/** Whether font data is a variable font with a weight axis (`wght` in its `fvar` table): one file, every weight. */
export function hasWeightAxis(data: Uint8Array, key: string | null): boolean {
  const font = openFont(data, key);
  const fvar = font?.tables.get('fvar');
  if (!font || fvar === undefined || fvar + 16 > font.length) return false;
  const axes = fvar + font.u16(fvar + 4);
  const count = font.u16(fvar + 8);
  const size = font.u16(fvar + 10);
  for (let k = 0; k < count; k++) {
    const at = axes + k * size;
    if (at + 4 > font.length) return false;
    if (String.fromCharCode(font.u16(at) >> 8, font.u16(at) & 255, font.u16(at + 2) >> 8, font.u16(at + 2) & 255) === 'wght') return true;
  }
  return false;
}

/**
 * The font most of the document is set in: the default run font, through the
 * theme when it names a theme font, else the default paragraph style's; Word
 * falls back to Times New Roman.
 */
export function documentFont(stylesXml: string | null, themeXml: string | null): string {
  const styles = stylesXml ?? '';
  const fromRunFonts = (rFonts: string | undefined): string | undefined => {
    if (!rFonts) return undefined;
    const direct = /\bw:(?:ascii|hAnsi)="([^"]+)"/.exec(rFonts)?.[1];
    if (direct) return direct;
    const theme = /\bw:(?:asciiTheme|hAnsiTheme)="(minor|major)[^"]*"/.exec(rFonts)?.[1];
    if (!theme || !themeXml) return undefined;
    const block = new RegExp(`<a:${theme}Font>[\\s\\S]*?<a:latin\\b[^>]*\\btypeface="([^"]+)"`).exec(themeXml);
    return block?.[1];
  };
  const defaults = /<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/.exec(styles)?.[0];
  const defaultStyle = /<w:style\b[^>]*\bw:type="paragraph"[^>]*\bw:default="(?:1|true)"[^>]*>[\s\S]*?<\/w:style>/.exec(styles)?.[0];
  return (
    fromRunFonts(defaultStyle ? /<w:rFonts\b[^>]*\/>/.exec(defaultStyle)?.[0] : undefined) ??
    fromRunFonts(defaults ? /<w:rFonts\b[^>]*\/>/.exec(defaults)?.[0] : undefined) ??
    'Times New Roman'
  );
}

/**
 * v1.12.0 RC fix: Word's "auto" line spacing (single, 1.15, multiple…) is a
 * multiple of the font's line height; docx-preview writes it as a multiple of
 * the font size, and reads a spacing without `w:lineRule` as exact points
 * (Word reads it as auto). Scale every auto line spacing by the document
 * font's line height, and say `auto` where the document left it out.
 */
export function normalizeLineSpacing(xml: string, ratio: number): string {
  return xml.replace(/<w:spacing\b([^>]*?)\/>/g, (element, attrs: string) => {
    const line = /\bw:line="(-?\d+)"/.exec(attrs)?.[1];
    if (line === undefined) return element;
    const rule = /\bw:lineRule="([^"]*)"/.exec(attrs)?.[1] ?? 'auto';
    if (rule !== 'auto') return element;
    let out = attrs.replace(/\bw:line="-?\d+"/, `w:line="${Math.round(Number(line) * ratio)}"`);
    if (!/\bw:lineRule=/.test(out)) out += ' w:lineRule="auto"';
    return `<w:spacing${out}/>`;
  });
}

/**
 * A paragraph that sets no line spacing anywhere is single-spaced in Word. Give
 * the document defaults that single spacing (already scaled), so no paragraph
 * inherits the webview's own line height.
 */
export function ensureDefaultLineSpacing(stylesXml: string, ratio: number): string {
  const single = Math.round(240 * ratio);
  const spacing = `<w:spacing w:line="${single}" w:lineRule="auto"/>`;
  const pPrDefault = /<w:pPrDefault>([\s\S]*?)<\/w:pPrDefault>/.exec(stylesXml);
  if (pPrDefault) {
    const inner = pPrDefault[1];
    if (/<w:spacing\b[^>]*\bw:line=/.test(inner)) return stylesXml;
    let next: string;
    if (/<w:spacing\b/.test(inner)) next = inner.replace(/<w:spacing\b([^>]*?)\/>/, `<w:spacing$1 w:line="${single}" w:lineRule="auto"/>`);
    else if (/<w:pPr\b[^>]*\/>/.test(inner)) next = inner.replace(/<w:pPr\b[^>]*\/>/, `<w:pPr>${spacing}</w:pPr>`);
    else if (/<w:pPr\b[^>]*>/.test(inner)) next = inner.replace(/<w:pPr\b[^>]*>/, (open) => open + spacing);
    else next = `<w:pPr>${spacing}</w:pPr>${inner}`;
    return stylesXml.replace(pPrDefault[0], `<w:pPrDefault>${next}</w:pPrDefault>`);
  }
  const block = `<w:pPrDefault><w:pPr>${spacing}</w:pPr></w:pPrDefault>`;
  if (/<w:docDefaults>/.test(stylesXml)) return stylesXml.replace(/<\/w:docDefaults>/, `${block}</w:docDefaults>`);
  if (/<w:docDefaults\s*\/>/.test(stylesXml)) return stylesXml.replace(/<w:docDefaults\s*\/>/, `<w:docDefaults>${block}</w:docDefaults>`);
  return stylesXml.replace(/<w:styles\b[^>]*>/, (open) => `${open}<w:docDefaults>${block}</w:docDefaults>`);
}

// A grid whose every column is this narrow is a placeholder, not a layout (the
// docx npm library writes 100 twips per column and lets Word autofit).
const PLACEHOLDER_GRID_TWIPS = 200;

/**
 * v1.12.0 RC fix — table columns as Word lays them out. A table's grid is the
 * column layout Word last computed; the browser's automatic table layout
 * redistributed it by content, so columns (and with them row heights and page
 * counts) came out different, and differently again for each part of a table
 * split across pages. A real grid is now drawn as it is (`table-layout:
 * fixed`); a placeholder grid is dropped, so the browser sizes columns by their
 * content, as Word's autofit would.
 */
export function fixTableGrids(xml: string): string {
  return xml.replace(
    /(<w:tblPr\b[^>]*>)([\s\S]*?)(<\/w:tblPr>\s*)(<w:tblGrid\b[^>]*>)([\s\S]*?)(<\/w:tblGrid>)/g,
    (whole, prOpen: string, pr: string, prClose: string, gridOpen: string, grid: string, gridClose: string) => {
      if (/<w:tbl\b/.test(pr)) return whole; // not a table's own properties
      const widths = [...grid.matchAll(/<w:gridCol\b[^>]*\bw:w="(\d+)"/g)].map((m) => Number(m[1]));
      if (!widths.length) return whole;
      if (widths.every((w) => w <= PLACEHOLDER_GRID_TWIPS)) {
        return `${prOpen}${pr}${prClose}${gridOpen}${grid.replace(/\s+w:w="\d+"/g, '')}${gridClose}`;
      }
      if (/<w:tblLayout\b/.test(pr)) return whole;
      return `${prOpen}${pr}<w:tblLayout w:type="fixed"/>${prClose}${gridOpen}${grid}${gridClose}`;
    },
  );
}

/** A document's paper when it names none: what Word and LibreOffice default to for the reader's region. */
export type Paper = 'A4' | 'Letter';

const PAPER_TWIPS: Record<Paper, { w: number; h: number }> = {
  A4: { w: 11906, h: 16838 },
  Letter: { w: 12240, h: 15840 },
};
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH']);

export function paperForLocale(locale: string | undefined): Paper {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return region && LETTER_REGIONS.has(region) ? 'Letter' : 'A4';
}

// Word's Normal template: 2.54 cm margins, header and footer 1.25 cm from the edge.
const DEFAULT_MARGINS = '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>';

/**
 * v1.12.0 RC fix: a document written without page setup (no `<w:sectPr>`, or
 * one without a page size or margins, as some generators write it) has no page
 * width, so the preview drew one page as wide as the window. Word gives it the
 * default paper and margins; so does this.
 */
export function ensurePageSetup(documentXml: string, paper: Paper): string {
  const size = `<w:pgSz w:w="${PAPER_TWIPS[paper].w}" w:h="${PAPER_TWIPS[paper].h}"/>`;
  const out = documentXml.replace(
    /<w:sectPr\b([^>]*?)(?:\/>|>((?:(?!<w:sectPr\b)[\s\S])*?)<\/w:sectPr>)/g,
    (_m, attrs: string, inner: string | undefined) => {
      let body = inner ?? '';
      if (!/<w:pgMar\b/.test(body)) body = DEFAULT_MARGINS + body;
      if (!/<w:pgSz\b/.test(body)) body = size + body;
      return `<w:sectPr${attrs}>${body}</w:sectPr>`;
    },
  );
  if (/<w:sectPr\b/.test(out)) return out;
  return out.replace(/<\/w:body>/, `<w:sectPr>${size}${DEFAULT_MARGINS}</w:sectPr></w:body>`);
}

/** One direction of a floating picture's position, as Word stores it (`wp:positionH` / `wp:positionV`). */
export interface AnchorAxis {
  relativeFrom: string;
  align?: string;
  offsetEmu?: number;
}

/** A floating picture drawn in front of or behind the text; `name` is the bookmark set just before it. */
export interface PageAnchor {
  name: string;
  h: AnchorAxis;
  v: AnchorAxis;
  behindDoc: boolean;
}

function anchorAxis(anchor: string, tag: 'positionH' | 'positionV'): AnchorAxis {
  const m = new RegExp(`<wp:${tag}\\b([^>]*)>([\\s\\S]*?)<\\/wp:${tag}>`).exec(anchor);
  if (!m) return { relativeFrom: 'page', offsetEmu: 0 };
  const relativeFrom = /\brelativeFrom="([^"]*)"/.exec(m[1])?.[1] ?? 'page';
  const align = /<wp:align>([^<]*)<\/wp:align>/.exec(m[2])?.[1];
  const offset = /<wp:posOffset>(-?\d+)<\/wp:posOffset>/.exec(m[2])?.[1];
  return { relativeFrom, ...(align ? { align } : {}), ...(offset !== undefined ? { offsetEmu: Number(offset) } : {}) };
}

/** A bookmark as a marker the viewer can find after rendering: docx-preview draws it as `<span id=name>`. */
export function markerBookmark(id: number, name: string): string {
  return `<w:bookmarkStart w:id="${id}" w:name="${name}"/><w:bookmarkEnd w:id="${id}"/>`;
}

const ANCHOR_BOOKMARK_ID = 1_900_000_000;

/**
 * v1.12.0 RC fix, part 1 of 2: docx-preview places a floating picture from the
 * baseline of the line it is anchored in, whatever Word says it is placed
 * against — the page, a margin, the column, or the top of its paragraph. So a
 * cover image set 48 px above its header paragraph (the paragraph itself 48 px
 * down the page) started 16 px below the page top instead of at it. Mark each
 * picture drawn in front of or behind the text with a bookmark just before its
 * run, and return where Word places it; the viewer moves it there after
 * rendering. Pictures the text wraps around are left as docx-preview flows them.
 */
export function markPageAnchors(xml: string, firstIndex: number): { xml: string; anchors: PageAnchor[] } {
  const anchors: PageAnchor[] = [];
  const edits: Edit[] = [];
  for (const m of xml.matchAll(/<wp:anchor\b([^>]*)>([\s\S]*?)<\/wp:anchor>/g)) {
    const [whole, attrs, body] = m;
    if (!/<wp:wrapNone\s*\/>/.test(body)) continue;
    let h = anchorAxis(whole, 'positionH');
    let v = anchorAxis(whole, 'positionV');
    if (/\bsimplePos="(?:1|true)"/.test(attrs)) {
      const pos = /<wp:simplePos\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/.exec(body);
      h = { relativeFrom: 'page', offsetEmu: Number(pos?.[1] ?? 0) };
      v = { relativeFrom: 'page', offsetEmu: Number(pos?.[2] ?? 0) };
    }
    const runStart = runStartBefore(xml, m.index!);
    if (runStart < 0) continue;
    const index = firstIndex + anchors.length;
    const name = `_rma${index}`;
    anchors.push({ name, h, v, behindDoc: /\bbehindDoc="(?:1|true)"/.test(attrs) });
    edits.push({ start: runStart, end: runStart, text: markerBookmark(ANCHOR_BOOKMARK_ID + index, name) });
  }
  if (!edits.length) return { xml, anchors };
  edits.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { xml: out, anchors };
}

// The weight a family name ends in ("Sofia Sans Light"), longest names first.
const WEIGHT_NAMES: [RegExp, number][] = [
  [/(?:^|\s)(?:extra|ultra)[\s-]?light$/i, 200],
  [/(?:^|\s)(?:semi|demi)[\s-]?bold$/i, 600],
  [/(?:^|\s)(?:extra|ultra)[\s-]?bold$/i, 800],
  [/(?:^|\s)(?:thin|hairline)$/i, 100],
  [/(?:^|\s)light$/i, 300],
  [/(?:^|\s)medium$/i, 500],
  [/(?:^|\s)(?:black|heavy)$/i, 900],
];

/** The weight a font family's name gives it, or undefined for a plain family name. */
export function impliedFontWeight(family: string): number | undefined {
  const name = family.trim();
  return WEIGHT_NAMES.find(([re]) => re.test(name))?.[1];
}

/**
 * v1.12.0 RC fix: an embedded font can be a variable font — one file with every
 * weight — under a family name that picks one of them ("Sofia Sans Light").
 * Word draws the named weight; the browser drew the font's default weight,
 * darker and wider, so lines broke earlier than in Word. docx-preview's
 * `@font-face` rules for such a family (`variableFamilies`, lower case) now
 * state that weight, and a family without a bold face of its own gets one from
 * the same file at the bold weight — the browser can't embolden a face it is
 * told is already weighted.
 */
export function weightFontFaces(css: string, variableFamilies: ReadonlySet<string>): string {
  if (!variableFamilies.size) return css;
  const FACE = /@font-face\s*\{([^}]*)\}/g;
  const familyOf = (body: string) => /font-family\s*:\s*(['"]?)([^;'"]+)\1/.exec(body)?.[2]?.trim();
  const weightOf = (body: string) => /font-weight\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
  const hasBold = new Set<string>();
  for (const m of css.matchAll(FACE)) {
    const family = familyOf(m[1])?.toLowerCase();
    const weight = weightOf(m[1]);
    if (family && weight && (weight === 'bold' || Number(weight) >= 600)) hasBold.add(family);
  }
  const boldAdded = new Set<string>();
  return css.replace(FACE, (rule, body: string) => {
    const family = familyOf(body);
    const weight = family && variableFamilies.has(family.toLowerCase()) ? impliedFontWeight(family) : undefined;
    if (!family || weight === undefined || weightOf(body) !== undefined) return rule;
    const face = body.replace(/;?\s*$/, ';');
    let out = `@font-face {${face} font-weight: ${weight}; }`;
    const style = /font-style\s*:\s*([^;]+)/.exec(body)?.[1]?.trim() ?? 'normal';
    const key = `${family.toLowerCase()}|${style}`;
    if (!hasBold.has(family.toLowerCase()) && !boldAdded.has(key)) {
      boldAdded.add(key);
      out += ` @font-face {${face} font-weight: 700; }`;
    }
    return out;
  });
}

/**
 * Word hyphenates automatically only when the document asks for it
 * (`<w:autoHyphenation/>` in its settings); docx-preview hyphenates always.
 */
export function wantsAutoHyphenation(settingsXml: string | null): boolean {
  if (!settingsXml) return false;
  const m = /<w:autoHyphenation\b([^>]*)\/>/.exec(settingsXml);
  if (!m) return false;
  const val = /w:val="([^"]*)"/.exec(m[1])?.[1];
  return val === undefined || val === '1' || val === 'true' || val === 'on';
}

/** Relationship id -> target, from a `.rels` part. */
export function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

const FONT_EMBED = /<w:embed(?:Regular|Bold|Italic|BoldItalic)\b[^>]*\br:id="([^"]*)"[^>]*\/>/g;

/** Relationship ids of the embedded font faces the font table refers to. */
export function listFontEmbedIds(fontTableXml: string): string[] {
  return [...fontTableXml.matchAll(FONT_EMBED)].map((m) => m[1]);
}

/**
 * Defect 5: Word can embed a face with no data (a 0-byte font part). The browser
 * then fails that face and draws it in its default serif. Drop such references,
 * so the family's other faces are used instead.
 */
export function dropFontEmbeds(fontTableXml: string, ids: ReadonlySet<string>): string {
  if (!ids.size) return fontTableXml;
  return fontTableXml.replace(FONT_EMBED, (element, id: string) => (ids.has(id) ? '' : element));
}

export interface UnsupportedContent {
  charts: boolean;
  smartArt: boolean;
  embeddedObjects: boolean;
  equations: boolean;
}

/** R6: things the preview does not draw, or draws only roughly. */
export function scanUnsupported(xmlParts: readonly string[]): UnsupportedContent {
  const has = (re: RegExp) => xmlParts.some((xml) => re.test(xml));
  return {
    charts: has(/drawingml\/2006\/chart"|<c:chart\b/),
    smartArt: has(/drawingml\/2006\/diagram"|<dgm:relIds\b/),
    embeddedObjects: has(/<w:object\b|<o:OLEObject\b/),
    equations: has(/<m:oMath(?:Para)?\b/),
  };
}

/** A sentence for the notice, or null when there is nothing to say. */
export function describeUnsupported(u: UnsupportedContent): string | null {
  const parts: string[] = [];
  if (u.charts) parts.push('charts');
  if (u.smartArt) parts.push('SmartArt diagrams');
  if (u.embeddedObjects) parts.push('embedded objects');
  if (u.equations) parts.push('equations');
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `This document has ${list} that the preview can’t show exactly.`;
}
