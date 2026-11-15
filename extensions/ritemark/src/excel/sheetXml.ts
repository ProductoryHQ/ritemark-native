/**
 * Sprint 158 (#711): find, replace and insert one cell in a worksheet part's XML, as text.
 *
 * The surgical save changes only the edited cells' elements and leaves every other byte of the part as it was, so
 * nothing here parses the sheet into a model and writes it back. It scans the text with any namespace prefix
 * (`<x:c>` as the Open XML SDK writes it, `<c>` as Excel does). Pure: no Node imports, so the webview can share it.
 */

/** Excel's last column (XFD) and row. */
export const MAX_COLUMN = 16_384;
export const MAX_ROW = 1_048_576;

export interface CellPosition {
  /** 1-based row. */
  r: number;
  /** 1-based column. */
  c: number;
}

export function columnNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function columnLetters(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "B12" → { r: 12, c: 2 }; null for anything that isn't a single A1 address inside the sheet. */
export function parseCellRef(ref: string): CellPosition | null {
  const m = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(ref);
  if (!m) return null;
  const c = columnNumber(m[1]);
  const r = Number(m[2]);
  if (c > MAX_COLUMN || r > MAX_ROW) return null;
  return { r, c };
}

export function cellRef(pos: CellPosition): string {
  return `${columnLetters(pos.c)}${pos.r}`;
}

function mustParse(ref: string): CellPosition {
  const pos = parseCellRef(ref);
  if (!pos) throw new Error(`Not a cell address: ${ref}`);
  return pos;
}

/** A range "A1:C5" (or a single "B2") as its corners; null when it isn't one. */
export function parseRange(ref: string): { from: CellPosition; to: CellPosition } | null {
  const [a, b] = ref.split(':');
  const from = parseCellRef(a);
  const to = b === undefined ? from : parseCellRef(b);
  if (!from || !to) return null;
  return { from, to };
}

export function rangeContains(range: { from: CellPosition; to: CellPosition }, at: CellPosition): boolean {
  return at.r >= range.from.r && at.r <= range.to.r && at.c >= range.from.c && at.c <= range.to.c;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Each attribute name's pattern, compiled once: a million-cell sheet asks for three attributes per cell. */
const attrPatterns = new Map<string, RegExp>();

/** An attribute's value in a start tag's text, or undefined. `name` may carry a prefix ("r:id"). */
export function attr(tagText: string, name: string): string | undefined {
  let re = attrPatterns.get(name);
  if (!re) {
    re = new RegExp(`(?:^|\\s)${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    attrPatterns.set(name, re);
  }
  const m = re.exec(tagText);
  return m ? (m[1] ?? m[2]) : undefined;
}

/** The start tag with `name` set to `value` (added before its end when missing). */
export function setAttr(tagText: string, name: string, value: string): string {
  const re = new RegExp(`(\\s)${escapeRegExp(name)}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
  if (re.test(tagText)) return tagText.replace(re, `$1${name}="${value}"`);
  return tagText.replace(/\s*(\/?>)$/, ` ${name}="${value}"$1`);
}

/** The start tag without the attribute `name`. */
export function removeAttr(tagText: string, name: string): string {
  return tagText.replace(new RegExp(`\\s+${escapeRegExp(name)}\\s*=\\s*(?:"[^"]*"|'[^']*')`), '');
}

/**
 * Text for a `<t>` or `<v>` element. Characters XML 1.0 can't carry are dropped, `&`, `<` and `>` are escaped, and a
 * literal `_xHHHH_` is written as `_x005F_xHHHH_`, since Excel reads `_xHHHH_` as the character HHHH.
 */
export function escapeCellText(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The characters an XML text node or attribute value stands for (entities and character references). */
export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9A-Fa-f]+|#\d+|lt|gt|amp|quot|apos);/g, (all, e: string) => {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : all;
  });
}

/** A `<t>` element's text as Excel reads it: entities decoded, then `_xHHHH_` escapes. */
export function decodeCellText(s: string): string {
  return decodeXmlEntities(s).replace(/_x([0-9A-Fa-f]{4})_/g, (_all, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Whether a `<t>` needs `xml:space="preserve"` to keep its text as typed. */
export function needsPreserve(text: string): boolean {
  return /^\s|\s$|[\n\r\t]/.test(text);
}

/**
 * The prefix the part's root element uses ("x:" or ""), which every SpreadsheetML element in it shares. Elements of
 * other namespaces in the part (extensions, markup compatibility) carry other prefixes and are never matched.
 */
export function rootPrefix(xml: string, rootName: string): string {
  const m = new RegExp(`<(\\w+:)?${rootName}(?=[\\s/>])`).exec(xml);
  if (!m) throw new Error(`No <${rootName}> element`);
  return m[1] ?? '';
}

/** A regular expression source for an element's start tag `<p:name ...>` or `<p:name .../>`. */
function startTag(p: string, name: string): string {
  return `<${escapeRegExp(p)}${name}(?=[\\s/>])([^>]*?)(\\/?)>`;
}

export interface SheetDataSpan {
  /** The index of `<sheetData`. */
  openStart: number;
  /** The index after its start tag. */
  contentStart: number;
  /** The index of `</sheetData>`, or of the self-closing tag's end when empty. */
  contentEnd: number;
  selfClosing: boolean;
  openTag: string;
}

export function findSheetData(xml: string, p: string): SheetDataSpan {
  const open = new RegExp(startTag(p, 'sheetData')).exec(xml);
  if (!open) throw new Error('The sheet has no sheetData');
  const contentStart = open.index + open[0].length;
  if (open[2] === '/') {
    return { openStart: open.index, contentStart, contentEnd: contentStart, selfClosing: true, openTag: open[0] };
  }
  // the one </sheetData> is near the part's end (only merges, rules and page setup follow it): look from there,
  // not through every row (Sprint 158 PR 4: this search ran over 35 MB on every edit)
  const close = xml.lastIndexOf(`</${p}sheetData>`);
  if (close < contentStart) throw new Error('The sheet has no </sheetData>');
  return { openStart: open.index, contentStart, contentEnd: close, selfClosing: false, openTag: open[0] };
}

/** Whether any row or cell in sheetData lacks its `r` (position) attribute. */
export function hasImplicitPositions(xml: string, p: string): boolean {
  const sd = findSheetData(xml, p);
  const re = new RegExp(`<${escapeRegExp(p)}(?:row|c)(?=[\\s/>])(?![^>]*\\sr\\s*=)`, 'g');
  re.lastIndex = sd.contentStart;
  const m = re.exec(xml);
  return !!m && m.index < sd.contentEnd;
}

/**
 * Rows and cells without `r` get their positions written out, so an inserted cell cannot shift the ones after it.
 * Only those tags change; a sheet where every row and cell has `r` comes back as the same string.
 */
export function writeImplicitPositions(xml: string, p: string): string {
  if (!hasImplicitPositions(xml, p)) return xml;
  const sd = findSheetData(xml, p);
  let row = 0;
  let col = 0;
  const body = xml.slice(sd.contentStart, sd.contentEnd).replace(
    new RegExp(`<${escapeRegExp(p)}(row|c)(?=[\\s/>])([^>]*?)(\\/?)>`, 'g'),
    (all, tag: string, attrs: string, sc: string) => {
      const r = attr(attrs, 'r');
      if (tag === 'row') {
        row = r ? Number(r) : row + 1;
        col = 0;
        return r ? all : `<${p}row r="${row}"${attrs}${sc}>`;
      }
      col = r ? mustParse(r).c : col + 1;
      return r ? all : `<${p}c r="${columnLetters(col)}${row}"${attrs}${sc}>`;
    },
  );
  return xml.slice(0, sd.contentStart) + body + xml.slice(sd.contentEnd);
}

/** Where a cell is, or where it would go. Positions are indexes into the sheet's XML. */
export type CellLocation =
  | { kind: 'replace'; start: number; end: number; openTag: string; body: string; rowTag: string; rowStart: number }
  | { kind: 'newCellBefore'; at: number; rowTag: string; rowStart: number }
  | { kind: 'newRowBefore'; at: number }
  | { kind: 'expandRow'; rowStart: number; rowEnd: number; rowTag: string }
  | { kind: 'emptySheetData'; at: number; len: number };

/** Locate a cell in a sheet whose rows and cells all carry `r` (see `writeImplicitPositions`). */
export function locateCell(xml: string, target: CellPosition, p: string): CellLocation {
  const sd = findSheetData(xml, p);
  if (sd.selfClosing) return { kind: 'emptySheetData', at: sd.openStart, len: sd.openTag.length };
  const rowRe = new RegExp(startTag(p, 'row'), 'g');
  rowRe.lastIndex = sd.contentStart;
  // A fast path for large sheets: jump to the row by its r, written first as Excel and most writers write it, and
  // check it is a row tag in sheetData. Otherwise (another attribute order, a row not there) walk the rows.
  const jump = xml.indexOf(`<${p}row r="${target.r}"`, sd.contentStart);
  if (jump >= 0 && jump < sd.contentEnd) {
    rowRe.lastIndex = jump;
    const tag = rowRe.exec(xml);
    if (tag && tag.index === jump && attr(tag[1], 'r') === String(target.r)) rowRe.lastIndex = jump;
    else rowRe.lastIndex = sd.contentStart;
  }
  const rowClose = `</${p}row>`;
  const cellClose = `</${p}c>`;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml)) && m.index < sd.contentEnd) {
    const r = Number(attr(m[1], 'r'));
    if (!Number.isInteger(r) || r < 1) throw new Error('A row has no position');
    const selfClosing = m[2] === '/';
    const afterOpen = m.index + m[0].length;
    const closeAt = selfClosing ? afterOpen : xml.indexOf(rowClose, afterOpen);
    if (closeAt < 0 || closeAt > sd.contentEnd) throw new Error(`Row ${r} has no end`);
    const rowEnd = selfClosing ? afterOpen : closeAt + rowClose.length;
    if (r > target.r) return { kind: 'newRowBefore', at: m.index };
    if (r === target.r) {
      if (selfClosing) return { kind: 'expandRow', rowStart: m.index, rowEnd, rowTag: m[0] };
      const cellRe = new RegExp(startTag(p, 'c'), 'g');
      cellRe.lastIndex = afterOpen;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(xml)) && cm.index < closeAt) {
        const ref = attr(cm[1], 'r');
        if (!ref) throw new Error('A cell has no position');
        const c = mustParse(ref).c;
        const cellAfterOpen = cm.index + cm[0].length;
        let cEnd = cellAfterOpen;
        if (cm[2] !== '/') {
          const close = xml.indexOf(cellClose, cellAfterOpen);
          if (close < 0 || close > closeAt) throw new Error(`Cell ${ref} has no end`);
          cEnd = close + cellClose.length;
        }
        if (c > target.c) return { kind: 'newCellBefore', at: cm.index, rowTag: m[0], rowStart: m.index };
        if (c === target.c) {
          return {
            kind: 'replace',
            start: cm.index,
            end: cEnd,
            openTag: cm[0],
            body: xml.slice(cellAfterOpen, cm[2] === '/' ? cellAfterOpen : cEnd - cellClose.length),
            rowTag: m[0],
            rowStart: m.index,
          };
        }
        cellRe.lastIndex = cEnd;
      }
      return { kind: 'newCellBefore', at: closeAt, rowTag: m[0], rowStart: m.index };
    }
    rowRe.lastIndex = rowEnd;
  }
  return { kind: 'newRowBefore', at: sd.contentEnd };
}

/** Insert or replace the cell's element (`cellXml`, '' to remove it), keeping every other byte. */
export function writeCell(xml: string, target: CellPosition, loc: CellLocation, cellXml: string, p: string): string {
  switch (loc.kind) {
    case 'replace':
      return xml.slice(0, loc.start) + cellXml + xml.slice(loc.end);
    case 'newCellBefore': {
      if (!cellXml) return xml;
      // A row's spans="first:last" is an optimisation hint; keep it true for the new cell.
      const spans = attr(loc.rowTag, 'spans');
      let rowTag = loc.rowTag;
      if (spans !== undefined) {
        const one = /^(\d+):(\d+)$/.exec(spans);
        rowTag = one
          ? setAttr(rowTag, 'spans', `${Math.min(Number(one[1]), target.c)}:${Math.max(Number(one[2]), target.c)}`)
          : removeAttr(rowTag, 'spans');
      }
      const withCell = xml.slice(0, loc.at) + cellXml + xml.slice(loc.at);
      return rowTag === loc.rowTag
        ? withCell
        : withCell.slice(0, loc.rowStart) + rowTag + withCell.slice(loc.rowStart + loc.rowTag.length);
    }
    case 'newRowBefore':
      if (!cellXml) return xml;
      return xml.slice(0, loc.at) + `<${p}row r="${target.r}">${cellXml}</${p}row>` + xml.slice(loc.at);
    case 'expandRow': {
      if (!cellXml) return xml;
      let rowTag = loc.rowTag.replace(/\s*\/>$/, '>');
      if (attr(rowTag, 'spans') !== undefined) rowTag = setAttr(rowTag, 'spans', `${target.c}:${target.c}`);
      return xml.slice(0, loc.rowStart) + rowTag + cellXml + `</${p}row>` + xml.slice(loc.rowEnd);
    }
    case 'emptySheetData':
      if (!cellXml) return xml;
      return (
        xml.slice(0, loc.at) +
        `${loc.len ? xml.slice(loc.at, loc.at + loc.len).replace(/\s*\/>$/, '>') : `<${p}sheetData>`}<${p}row r="${target.r}">${cellXml}</${p}row></${p}sheetData>` +
        xml.slice(loc.at + loc.len)
      );
  }
}

/** Grow `<dimension ref>` to take in the cell; the part is unchanged when it already does or has no dimension. */
export function growDimension(xml: string, target: CellPosition, p: string): string {
  const dm = new RegExp(`<${escapeRegExp(p)}dimension(?=[\\s/>])[^>]*>`).exec(xml);
  if (!dm) return xml;
  const ref = attr(dm[0], 'ref');
  const range = ref ? parseRange(ref) : null;
  if (!range) return xml;
  const from = { r: Math.min(range.from.r, target.r), c: Math.min(range.from.c, target.c) };
  const to = { r: Math.max(range.to.r, target.r), c: Math.max(range.to.c, target.c) };
  if (rangeContains(range, target)) return xml;
  const next = `${cellRef(from)}:${cellRef(to)}`;
  return xml.slice(0, dm.index) + setAttr(dm[0], 'ref', next) + xml.slice(dm.index + dm[0].length);
}

/** What a cell holds, as read back from the XML. */
export interface CellContent {
  /** The cell's `t` attribute; undefined is a number. */
  type?: string;
  style?: string;
  /** The `<v>` text, decoded. */
  value?: string;
  /** The inline string's text (`<is>`), decoded. */
  inlineText?: string;
  /** The `<f>` element's text, decoded, when it has one; '' for a shared formula's dependent. */
  formula?: string;
  formulaAttrs?: string;
}

/** Read one cell's element (from `locateCell`'s 'replace'). */
export function readCellContent(openTag: string, body: string, p: string): CellContent {
  const out: CellContent = { type: attr(openTag, 't'), style: attr(openTag, 's') };
  const v = new RegExp(`<${escapeRegExp(p)}v(?=[\\s>])[^>]*>([\\s\\S]*?)</${escapeRegExp(p)}v>`).exec(body);
  if (v) out.value = decodeXmlEntities(v[1]);
  const f = new RegExp(`${startTag(p, 'f')}(?:([\\s\\S]*?)</${escapeRegExp(p)}f>)?`).exec(body);
  if (f) {
    out.formulaAttrs = f[1];
    out.formula = f[2] === '/' ? '' : decodeXmlEntities(f[3] ?? '');
  }
  const is = new RegExp(`<${escapeRegExp(p)}is(?=[\\s>])[^>]*>([\\s\\S]*?)</${escapeRegExp(p)}is>`).exec(body);
  if (is) out.inlineText = textOfStringItem(is[1], p);
  return out;
}

/** The text of a string item's content (`<si>` or `<is>`): its `<t>` elements, outside phonetic runs. */
export function textOfStringItem(inner: string, p: string): string {
  const withoutPhonetic = inner.replace(new RegExp(`<${escapeRegExp(p)}rPh(?=[\\s>])[\\s\\S]*?</${escapeRegExp(p)}rPh>`, 'g'), '');
  let text = '';
  for (const m of withoutPhonetic.matchAll(new RegExp(`<${escapeRegExp(p)}t(?=[\\s/>])[^>]*?(?:/>|>([\\s\\S]*?)</${escapeRegExp(p)}t>)`, 'g'))) {
    text += decodeCellText(m[1] ?? '');
  }
  return text;
}
