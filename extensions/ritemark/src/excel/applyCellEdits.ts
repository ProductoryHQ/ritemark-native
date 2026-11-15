/**
 * Sprint 158 (#711): the surgical save. A workbook's original bytes plus a list of cell edits make the saved file.
 *
 * Only the edited cells' elements change, in their sheets' parts. The shared string table gains the new strings at
 * its end. `workbook.xml` asks Excel to recalculate when the file opens (`fullCalcOnLoad`), since formulas that use
 * an edited cell still hold their old results. When an edit overwrites a formula, the calculation chain is dropped
 * (with its relationship and content type), and Excel rebuilds it. Every other part keeps its bytes.
 *
 * An edit is refused when it can't be written safely: inside a multi-cell array formula or data table, on a table's
 * header or totals row (their text lives in the table part too), on a chart sheet, text longer than Excel's 32,767
 * characters, or a shared formula whose cells would move off the sheet.
 *
 * Before the bytes are handed back, `verifySavedWorkbook` reads them again: every part inflates to its size, the
 * parts not changed are byte-identical to the original's, every changed part is well-formed XML, and every edited
 * cell holds what was typed. Anything wrong throws, and nothing is written.
 */
import { verifyDeclaredSizes, readZipDirectory } from '../officePreview/officePackageCheck';
import {
  PackageError,
  encodeText,
  openPackage,
  readTextPart,
  rewritePackage,
  storedPart,
  type XlsxPackage,
} from './xlsxPackage';
import {
  attr,
  cellRef,
  decodeXmlEntities,
  escapeCellText,
  findSheetData,
  growDimension,
  locateCell,
  needsPreserve,
  parseCellRef,
  parseRange,
  rangeContains,
  readCellContent,
  rootPrefix,
  setAttr,
  writeCell,
  writeImplicitPositions,
  type CellPosition,
} from './sheetXml';
import { SharedStrings } from './sharedStrings';
import { FormulaShiftError, shiftFormula } from './sharedFormula';
import { MAX_CELL_TEXT, type CellEdit, type CellValue, coalesceEdits } from './cellEdit';

export class CellEditRefused extends Error {
  constructor(readonly edit: CellEdit, reason: string) {
    super(reason);
  }
}

export class SaveCheckFailed extends Error {}

export interface ApplyReport {
  /** The parts that changed (or were removed). */
  touched: string[];
  formulasRemoved: number;
  calcChainDropped: boolean;
}

const REL_TYPE = {
  officeDocument: /\/officeDocument$/,
  worksheet: /\/worksheet$/,
  sharedStrings: /\/sharedStrings$/,
  calcChain: /\/calcChain$/,
  table: /\/table$/,
};

interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

interface SheetInfo {
  name: string;
  /** The part path, or null for a chart sheet or other kind of sheet. */
  path: string | null;
}

export interface WorkbookIndex {
  pkg: XlsxPackage;
  workbookPath: string;
  workbookRelsPath: string;
  relationships: Relationship[];
  sheets: Map<string, SheetInfo>;
  sharedStringsPath: string | null;
  /** What makes a cell in each sheet unsafe to edit, read once per sheet. */
  guards: Map<string, SheetGuards>;
}

interface SheetGuards {
  arrays: Array<{ from: CellPosition; to: CellPosition; ref: string }>;
  /** Shared formulas' anchors whose formula can't be moved to every cell of their range. */
  unmovableAnchors: Set<string>;
  tableRows: Array<{ from: CellPosition; to: CellPosition; what: 'header' | 'totals'; table: string }>;
}

function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  return `${partPath.slice(0, slash + 1)}_rels/${partPath.slice(slash + 1)}.rels`;
}

/** A relationship's target as a part path ("worksheets/sheet1.xml" from "xl/workbook.xml" → "xl/worksheets/sheet1.xml"). */
export function resolveTarget(fromPart: string, target: string): string {
  const decoded = decodeURI(target);
  if (decoded.startsWith('/')) return decoded.slice(1);
  const parts = fromPart.split('/');
  parts.pop();
  for (const seg of decoded.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

function parseRelationships(xml: string): Relationship[] {
  const out: Relationship[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?Relationship(?=[\s/>])([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id');
    const type = attr(m[1], 'Type');
    const target = attr(m[1], 'Target');
    if (!id || !type || target === undefined) continue;
    out.push({ id, type, target: decodeXmlEntities(target), external: attr(m[1], 'TargetMode') === 'External' });
  }
  return out;
}

async function mustReadText(pkg: XlsxPackage, name: string): Promise<string> {
  const text = await readTextPart(pkg, name);
  if (text === null) throw new PackageError(`The workbook has no ${name}`);
  return text;
}

/** Read the workbook's map: its sheets, their parts, the shared strings part. */
export async function indexWorkbook(bytes: Uint8Array): Promise<WorkbookIndex> {
  const pkg = openPackage(bytes);
  const rootRels = parseRelationships(await mustReadText(pkg, '_rels/.rels'));
  const office = rootRels.find((r) => REL_TYPE.officeDocument.test(r.type) && !r.external);
  if (!office) throw new PackageError('The workbook has no main part');
  const workbookPath = resolveTarget('', office.target);
  const workbookRelsPath = relsPathFor(workbookPath);
  const workbookXml = await mustReadText(pkg, workbookPath);
  const relationships = parseRelationships(await mustReadText(pkg, workbookRelsPath));
  const byId = new Map(relationships.map((r) => [r.id, r]));
  const sheets = new Map<string, SheetInfo>();
  const wp = rootPrefix(workbookXml, 'workbook');
  for (const m of workbookXml.matchAll(new RegExp(`<${wp}sheet(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const rawName = attr(m[1], 'name');
    // the relationship id is r:id, whatever prefix the relationships namespace has here
    const rid = /\s[\w.-]+:id\s*=\s*"([^"]*)"/.exec(m[1])?.[1];
    if (rawName === undefined || !rid) continue;
    const name = decodeXmlEntities(rawName);
    const rel = byId.get(rid);
    const path = rel && !rel.external && REL_TYPE.worksheet.test(rel.type) ? resolveTarget(workbookPath, rel.target) : null;
    sheets.set(name, { name, path });
  }
  const sst = relationships.find((r) => REL_TYPE.sharedStrings.test(r.type) && !r.external);
  const sharedStringsPath = sst ? resolveTarget(workbookPath, sst.target) : null;
  return {
    pkg,
    workbookPath,
    workbookRelsPath,
    relationships,
    sheets,
    sharedStringsPath: sharedStringsPath && pkg.byName.has(sharedStringsPath) ? sharedStringsPath : null,
    guards: new Map(),
  };
}

function sheetGuardsFrom(xml: string, p: string): Pick<SheetGuards, 'arrays' | 'unmovableAnchors'> {
  const arrays: SheetGuards['arrays'] = [];
  const unmovableAnchors = new Set<string>();
  const fRe = new RegExp(`<${p}f(?=[\\s/>])([^>]*?)(\\/?)>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = fRe.exec(xml))) {
    const t = attr(m[1], 't');
    const ref = attr(m[1], 'ref');
    const range = ref ? parseRange(ref) : null;
    if ((t === 'array' || t === 'dataTable') && range && ref && ref.includes(':')) arrays.push({ ...range, ref });
    if (t === 'shared' && range && m[2] !== '/') {
      // the anchor: overwriting it moves its formula to each cell of the range. Moving is monotonic, so if it
      // reaches the range's four corners it reaches every cell between them.
      const close = xml.indexOf(`</${p}f>`, fRe.lastIndex);
      const formula = decodeXmlEntities(xml.slice(fRe.lastIndex, close));
      const cellStart = xml.lastIndexOf(`<${p}c`, m.index);
      const anchorRef = attr(/<[^>]*>/.exec(xml.slice(cellStart))?.[0] ?? '', 'r');
      const anchor = anchorRef ? parseCellRef(anchorRef) : null;
      if (!anchor || !anchorRef) continue;
      try {
        for (const r of [range.from.r, range.to.r]) {
          for (const c of [range.from.c, range.to.c]) shiftFormula(formula, r - anchor.r, c - anchor.c);
        }
      } catch {
        unmovableAnchors.add(anchorRef);
      }
    }
  }
  return { arrays, unmovableAnchors };
}

async function guardsFor(index: WorkbookIndex, sheetPath: string, xml?: string): Promise<SheetGuards> {
  const known = index.guards.get(sheetPath);
  if (known) return known;
  const text = xml ?? (await mustReadText(index.pkg, sheetPath));
  const p = rootPrefix(text, 'worksheet');
  const guards: SheetGuards = { ...sheetGuardsFrom(text, p), tableRows: [] };
  const relsText = await readTextPart(index.pkg, relsPathFor(sheetPath));
  if (relsText) {
    for (const rel of parseRelationships(relsText)) {
      if (rel.external || !REL_TYPE.table.test(rel.type)) continue;
      const tablePath = resolveTarget(sheetPath, rel.target);
      const tableXml = await readTextPart(index.pkg, tablePath);
      if (!tableXml) continue;
      const tag = /<(?:\w+:)?table(?=[\s/>])([^>]*)>/.exec(tableXml);
      const ref = tag ? attr(tag[1], 'ref') : undefined;
      const range = ref ? parseRange(ref) : null;
      if (!tag || !range) continue;
      const name = decodeXmlEntities(attr(tag[1], 'displayName') ?? attr(tag[1], 'name') ?? 'a table');
      const headerRows = Number(attr(tag[1], 'headerRowCount') ?? '1');
      const totalsRows = Number(attr(tag[1], 'totalsRowCount') ?? '0');
      if (headerRows > 0) {
        guards.tableRows.push({ from: range.from, to: { r: range.from.r + headerRows - 1, c: range.to.c }, what: 'header', table: name });
      }
      if (totalsRows > 0) {
        guards.tableRows.push({ from: { r: range.to.r - totalsRows + 1, c: range.from.c }, to: range.to, what: 'totals', table: name });
      }
    }
  }
  index.guards.set(sheetPath, guards);
  return guards;
}

/** Throws CellEditRefused when the edit can't be written safely. Cheap after the sheet's first check. */
export async function checkCellEdit(index: WorkbookIndex, edit: CellEdit): Promise<void> {
  const sheet = index.sheets.get(edit.sheet);
  if (!sheet) throw new CellEditRefused(edit, `The workbook has no sheet named ${edit.sheet}.`);
  if (!sheet.path) throw new CellEditRefused(edit, `${edit.sheet} is a chart sheet; its cells can't be edited here.`);
  const at = parseCellRef(edit.ref);
  if (!at) throw new CellEditRefused(edit, `${edit.ref} is not a cell address.`);
  if (typeof edit.value === 'string' && edit.value.length > MAX_CELL_TEXT) {
    throw new CellEditRefused(edit, `A cell holds at most ${MAX_CELL_TEXT.toLocaleString('en-US')} characters.`);
  }
  const guards = await guardsFor(index, sheet.path);
  const array = guards.arrays.find((a) => rangeContains(a, at));
  if (array) {
    throw new CellEditRefused(edit, `${edit.ref} is part of an array formula (${array.ref}). Change it in Excel.`);
  }
  if (guards.unmovableAnchors.has(edit.ref)) {
    throw new CellEditRefused(edit, `The formula in ${edit.ref} is shared with other cells and can't be moved to them. Change it in Excel.`);
  }
  const tableRow = guards.tableRows.find((t) => rangeContains(t, at));
  if (tableRow) {
    throw new CellEditRefused(
      edit,
      tableRow.what === 'header'
        ? `${edit.ref} is a column name in the table ${tableRow.table}. Rename the column in Excel.`
        : `${edit.ref} is in the totals row of the table ${tableRow.table}. Change it in Excel.`,
    );
  }
}

/** Plain XML text escaping, for a formula moved to another cell (its `_xHHHH_` sequences are kept as written). */
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Overwriting a shared formula's anchor: give each cell that shares it the anchor's formula moved to that cell.
 * Returns the sheet with those cells' `<f>` written out; the anchor itself is left for the caller to replace.
 */
function unshareFormula(xml: string, p: string, anchor: CellPosition, si: string, formula: string): string {
  const fRe = new RegExp(`<${p}f(?=[\\s/>])([^>]*?)(?:\\/>|>\\s*</${p}f>)`, 'g');
  const sd = findSheetData(xml, p);
  fRe.lastIndex = sd.contentStart;
  const cellStartRe = new RegExp(`<${p}c(?=[\\s/>])[^>]*>`, 'g');
  const pieces: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fRe.exec(xml)) && m.index < sd.contentEnd) {
    const fa = m[1];
    if (attr(fa, 't') !== 'shared' || attr(fa, 'si') !== si || attr(fa, 'ref') !== undefined) continue;
    // the cell this <f/> is in: the last cell start before it
    const before = xml.lastIndexOf(`<${p}c`, m.index);
    cellStartRe.lastIndex = before;
    const cellTag = cellStartRe.exec(xml);
    const ref = cellTag && cellTag.index === before ? attr(cellTag[0], 'r') : undefined;
    const at = ref ? parseCellRef(ref) : null;
    if (!at) throw new FormulaShiftError('A shared formula cell has no position');
    const moved = shiftFormula(formula, at.r - anchor.r, at.c - anchor.c);
    const keep = fa.replace(/\s+(?:t|si|ref)\s*=\s*"[^"]*"/g, '');
    pieces.push(xml.slice(last, m.index), `<${p}f${keep}>${escapeXml(moved)}</${p}f>`);
    last = m.index + m[0].length;
  }
  pieces.push(xml.slice(last));
  return pieces.join('');
}

function newCellStyle(xml: string, p: string, rowTag: string | undefined, at: CellPosition): string | undefined {
  // a new cell takes its row's style when the row has one, otherwise its column's, as Excel does
  if (rowTag && attr(rowTag, 'customFormat') === '1' && attr(rowTag, 's') !== undefined) return attr(rowTag, 's');
  for (const m of xml.matchAll(new RegExp(`<${p}col(?=[\\s/>])([^>]*)\\/?>`, 'g'))) {
    const min = Number(attr(m[1], 'min'));
    const max = Number(attr(m[1], 'max'));
    if (at.c >= min && at.c <= max) return attr(m[1], 'style');
  }
  return undefined;
}

function cellXmlFor(p: string, ref: string, style: string | undefined, value: CellValue, strings: SharedStrings | null): string {
  const s = style !== undefined && style !== '0' ? ` s="${style}"` : '';
  if (value === null || value === '') return s ? `<${p}c r="${ref}"${s}/>` : '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A number must be finite');
    return `<${p}c r="${ref}"${s}><${p}v>${String(value)}</${p}v></${p}c>`;
  }
  if (strings) return `<${p}c r="${ref}"${s} t="s"><${p}v>${strings.append(value)}</${p}v></${p}c>`;
  const preserve = needsPreserve(value) ? ' xml:space="preserve"' : '';
  return `<${p}c r="${ref}"${s} t="inlineStr"><${p}is><${p}t${preserve}>${escapeCellText(value)}</${p}t></${p}is></${p}c>`;
}

/** The workbook part with `fullCalcOnLoad="1"` on its calcPr, which is added in schema order when missing. */
function requestFullCalc(workbookXml: string): string {
  const wp = rootPrefix(workbookXml, 'workbook');
  const calc = new RegExp(`<${wp}calcPr(?=[\\s/>])[^>]*?\\/?>`).exec(workbookXml);
  if (calc) {
    if (attr(calc[0], 'fullCalcOnLoad') === '1' || attr(calc[0], 'fullCalcOnLoad') === 'true') return workbookXml;
    return workbookXml.slice(0, calc.index) + setAttr(calc[0], 'fullCalcOnLoad', '1') + workbookXml.slice(calc.index + calc[0].length);
  }
  // CT_Workbook: … sheets, functionGroups, externalReferences, definedNames, calcPr, oleSize, …
  const anchors = ['definedNames', 'externalReferences', 'functionGroups', 'sheets'];
  for (const name of anchors) {
    const close = workbookXml.lastIndexOf(`</${wp}${name}>`);
    const selfClosing = new RegExp(`<${wp}${name}(?=[\\s/>])[^>]*\\/>`).exec(workbookXml);
    const at = close >= 0 ? close + `</${wp}${name}>`.length : selfClosing ? selfClosing.index + selfClosing[0].length : -1;
    if (at >= 0) return workbookXml.slice(0, at) + `<${wp}calcPr fullCalcOnLoad="1"/>` + workbookXml.slice(at);
  }
  throw new PackageError('The workbook part has no sheets');
}

/**
 * The saved workbook: the original bytes with the edits written in. Throws CellEditRefused for an edit that can't be
 * written safely, PackageError for a workbook that can't be read, and SaveCheckFailed when the result doesn't read
 * back as it should. Never returns a partly edited file.
 */
export async function applyCellEdits(
  original: Uint8Array,
  edits: readonly CellEdit[],
  existingIndex?: WorkbookIndex,
): Promise<{ bytes: Uint8Array; report: ApplyReport }> {
  const index = existingIndex ?? (await indexWorkbook(original));
  const final = coalesceEdits(edits);
  const report: ApplyReport = { touched: [], formulasRemoved: 0, calcChainDropped: false };
  if (!final.length) return { bytes: original, report };

  const replace = new Map<string, Uint8Array | null>();
  const strings = index.sharedStringsPath ? new SharedStrings(await mustReadText(index.pkg, index.sharedStringsPath)) : null;

  // group by sheet, keeping the order of the edits within each sheet
  const bySheet = new Map<string, CellEdit[]>();
  for (const edit of final) {
    await checkCellEdit(index, edit);
    const list = bySheet.get(edit.sheet) ?? [];
    list.push(edit);
    bySheet.set(edit.sheet, list);
  }

  for (const [sheetName, sheetEdits] of bySheet) {
    const path = index.sheets.get(sheetName)!.path!;
    const originalXml = await mustReadText(index.pkg, path);
    const p = rootPrefix(originalXml, 'worksheet');
    let xml = writeImplicitPositions(originalXml, p);
    for (const edit of sheetEdits) {
      const at = parseCellRef(edit.ref)!;
      let loc = locateCell(xml, at, p);
      let style: string | undefined;
      if (loc.kind === 'replace') {
        style = attr(loc.openTag, 's');
        const content = readCellContent(loc.openTag, loc.body, p);
        if (content.formula !== undefined) {
          report.formulasRemoved++;
          const fa = content.formulaAttrs ?? '';
          const si = attr(fa, 'si');
          if (attr(fa, 't') === 'shared' && attr(fa, 'ref') !== undefined && si !== undefined) {
            try {
              xml = unshareFormula(xml, p, at, si, content.formula);
            } catch (error) {
              if (error instanceof FormulaShiftError) {
                throw new CellEditRefused(edit, `The formula in ${edit.ref} is shared with other cells and can't be moved to them. Change it in Excel.`);
              }
              throw error;
            }
            loc = locateCell(xml, at, p);
          }
        }
      } else {
        style = newCellStyle(xml, p, 'rowTag' in loc ? loc.rowTag : undefined, at);
      }
      const cellXml = cellXmlFor(p, cellRef(at), style, edit.value, strings);
      xml = writeCell(xml, at, loc, cellXml, p);
      if (cellXml) xml = growDimension(xml, at, p);
    }
    if (xml !== originalXml) replace.set(path, encodeText(xml));
  }

  if (strings?.changed && index.sharedStringsPath) replace.set(index.sharedStringsPath, encodeText(strings.serialize()));

  if (replace.size) {
    const workbookXml = await mustReadText(index.pkg, index.workbookPath);
    const recalculating = requestFullCalc(workbookXml);
    if (recalculating !== workbookXml) replace.set(index.workbookPath, encodeText(recalculating));

    const chain = index.relationships.find((r) => REL_TYPE.calcChain.test(r.type) && !r.external);
    const chainPath = chain ? resolveTarget(index.workbookPath, chain.target) : null;
    if (chain && chainPath && report.formulasRemoved > 0 && index.pkg.byName.has(chainPath)) {
      replace.set(chainPath, null);
      const rels = await mustReadText(index.pkg, index.workbookRelsPath);
      const withoutChain = rels.replace(
        new RegExp(`<(?:\\w+:)?Relationship(?=[\\s/>])[^>]*\\sId\\s*=\\s*"${chain.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\/>`),
        '',
      );
      replace.set(index.workbookRelsPath, encodeText(withoutChain));
      const types = await mustReadText(index.pkg, '[Content_Types].xml');
      const partName = `/${chainPath}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      replace.set('[Content_Types].xml', encodeText(types.replace(new RegExp(`<Override(?=\\s)[^>]*PartName\\s*=\\s*"${partName}"[^>]*\\/>`, 'i'), '')));
      report.calcChainDropped = true;
    }
  }

  report.touched = [...replace.keys()];
  if (!replace.size) return { bytes: original, report };
  const bytes = await rewritePackage(index.pkg, replace);
  await verifySavedWorkbook(index.pkg, bytes, final, report.touched);
  return { bytes, report };
}

/** Well-formed XML: every element closed in order, quotes and comments closed. */
export function isWellFormedXml(xml: string): boolean {
  const stack: string[] = [];
  let i = xml.indexOf('<');
  while (i >= 0) {
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2);
      if (end < 0) return false;
      i = xml.indexOf('<', end + 2);
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      if (end < 0) return false;
      i = xml.indexOf('<', end + 3);
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      if (end < 0) return false;
      i = xml.indexOf('<', end + 3);
      continue;
    }
    if (xml.startsWith('<!', i)) {
      const end = xml.indexOf('>', i + 2);
      if (end < 0) return false;
      i = xml.indexOf('<', end + 1);
      continue;
    }
    const closing = xml[i + 1] === '/';
    let k = i + (closing ? 2 : 1);
    const nameStart = k;
    while (k < xml.length && !/[\s/>]/.test(xml[k])) k++;
    const name = xml.slice(nameStart, k);
    if (!name) return false;
    let quote = '';
    for (; k < xml.length; k++) {
      const ch = xml[k];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '<') return false;
      else if (ch === '>') break;
    }
    if (k >= xml.length) return false;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else if (xml[k - 1] !== '/') {
      stack.push(name);
    }
    i = xml.indexOf('<', k + 1);
  }
  return stack.length === 0;
}

function sameBytes(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Read the saved bytes back; throws SaveCheckFailed naming the first thing that is wrong. */
export async function verifySavedWorkbook(
  original: XlsxPackage,
  bytes: Uint8Array,
  edits: readonly CellEdit[],
  touched: readonly string[],
): Promise<void> {
  const fail = (why: string): never => {
    throw new SaveCheckFailed(why);
  };
  const entries = readZipDirectory(bytes);
  if (!entries) fail('the saved file has no ZIP directory');
  if (!(await verifyDeclaredSizes(bytes, entries!))) fail('a part of the saved file does not unpack to its size');
  const saved = openPackage(bytes);
  const changed = new Set(touched);
  for (const entry of original.entries) {
    if (changed.has(entry.name)) continue;
    if (!sameBytes(storedPart(original, entry.name), storedPart(saved, entry.name))) fail(`the part ${entry.name} changed`);
  }
  if (saved.entries.length > original.entries.length) fail('the saved file has a part the original did not');
  for (const name of touched) {
    if (!saved.byName.has(name)) continue; // removed on purpose (the calculation chain)
    const text = await readTextPart(saved, name);
    if (text === null || !isWellFormedXml(text)) fail(`the part ${name} is not well-formed`);
  }

  // every edited cell holds what was typed
  const index = await indexWorkbook(bytes);
  const strings = index.sharedStringsPath ? new SharedStrings((await readTextPart(saved, index.sharedStringsPath))!) : null;
  const sheetText = new Map<string, string>();
  for (const edit of edits) {
    const path = index.sheets.get(edit.sheet)?.path;
    if (!path) fail(`the sheet ${edit.sheet} is missing`);
    let xml = sheetText.get(path!);
    if (xml === undefined) {
      xml = (await readTextPart(saved, path!)) ?? '';
      sheetText.set(path!, xml);
    }
    const p = rootPrefix(xml, 'worksheet');
    const loc = locateCell(xml, parseCellRef(edit.ref)!, p);
    const content = loc.kind === 'replace' ? readCellContent(loc.openTag, loc.body, p) : null;
    const where = `${edit.sheet}!${edit.ref}`;
    if (content?.formula !== undefined) fail(`${where} still has a formula`);
    if (edit.value === null || edit.value === '') {
      if (content && (content.value !== undefined || content.inlineText !== undefined)) fail(`${where} was not cleared`);
    } else if (typeof edit.value === 'number') {
      if (!content || content.type !== undefined && content.type !== 'n' || Number(content.value) !== edit.value) fail(`${where} does not hold ${edit.value}`);
    } else {
      const text =
        content?.type === 's' ? strings?.textAt(Number(content.value)) : content?.type === 'inlineStr' ? content.inlineText : undefined;
      if (text !== edit.value) fail(`${where} does not hold the text typed`);
    }
  }
}
