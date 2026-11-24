/**
 * Sprint 158 (#711): our own reader for the Excel preview. An .xlsx's bytes in, a model per sheet out.
 *
 * PR 2: every cell's value and its text as Excel draws it (numfmt, numberFormat.ts), formulas for the formula bar
 * (shared ones moved to each cell), hidden rows, columns and sheets, the sheet the workbook opens on, and the date
 * system. PR 3: what the sheet grid draws (styles in excelStyles.ts; column widths and row heights, merges, frozen
 * panes, gridlines, the tab colour, rich text, and where charts and pictures sit, which the preview marks but doesn't
 * draw).
 *
 * It reads the XML as text, as the host's save does (src/excel/), with any namespace prefix. SheetJS stays for .xls
 * and as the fallback when this reader can't read a file.
 */
import JSZip from 'jszip'
import { attr, columnNumber, decodeCellText, decodeXmlEntities, rootPrefix, textOfStringItem } from '../../../../src/excel/sheetXml'
import { shiftFormula } from '../../../../src/excel/sharedFormula'
import { formatCellValue, formatCode } from './numberFormat'
import { colorContext, colorOf, fontOf, readStyles, section, type ColorContext, type FontStyle, type WorkbookStyles } from './excelStyles'
import { chartTitle, readChart } from './readChart'
import type { ChartModel } from './chartModel'

export type SheetState = 'visible' | 'hidden' | 'veryHidden'
import { readRules, type RuleSet } from './readRules'

export type CellKind = 'n' | 's' | 'b' | 'e'

/** A run of rich text, in its own font. */
export interface TextRun {
  text: string
  font?: Partial<FontStyle>
}

export interface CellModel {
  kind: CellKind
  /** The value: a number (dates are serial days), text, a boolean, or an error's text. */
  value: number | string | boolean
  /** What Excel draws for it, by its number format. */
  text: string
  /** A colour the number format asks for ([Red] …). */
  color?: string
  /** Gaps the number format leaves before and after the text (`_-`): as wide as these characters. */
  pad?: [string, string]
  /** The cell style's index (`s`). */
  s: number
  /** The formula without its "=", when the cell has one. */
  formula?: string
  /** Rich text: runs in their own fonts. */
  runs?: TextRun[]
}

export interface ColumnDef {
  /** 0-based, inclusive. */
  min: number
  max: number
  /** Characters, as stored; undefined uses the sheet's default. */
  width?: number
  hidden: boolean
  style?: number
}

export interface RowDef {
  /** Points; undefined is the default height. */
  height?: number
  hidden: boolean
  style?: number
}

/** Where a chart or picture sits: from a cell (and offset) to a cell, or from a cell for a size, in pixels. */
export interface DrawingAnchor {
  from?: { row: number; col: number; rowOff: number; colOff: number }
  to?: { row: number; col: number; rowOff: number; colOff: number }
  size?: { width: number; height: number }
  pos?: { x: number; y: number }
}

export interface DrawingModel {
  what: 'chart' | 'image' | 'shape'
  /** The chart's title, when it has one. */
  title?: string
  chart?: ChartModel
  anchor: DrawingAnchor
}

export interface SheetLayoutInfo {
  cols: ColumnDef[]
  rows: Map<number, RowDef>
  /** sheetFormatPr: points, characters, characters. */
  defaultRowHeight?: number
  defaultColWidth?: number
  baseColWidth?: number
  /** Rows have no height unless given one. */
  zeroHeight: boolean
  /** 0-based [r1, c1, r2, c2]. */
  merges: Array<[number, number, number, number]>
  frozen: { rows: number; cols: number }
  showGridLines: boolean
  showHeaders: boolean
  tabColor?: string
  drawings: DrawingModel[]
  /** Colour scales, data bars and other conditional formats: kept in the file, not drawn. */
  conditionalFormats: number
  rules: RuleSet
  /** Cells with a comment (Excel's red corner). */
  comments: Array<[number, number]>
}

export interface SheetModel {
  name: string
  state: SheetState
  kind: 'worksheet' | 'chartsheet' | 'other'
  /** By `cellKey(row, col)`, 0-based. */
  cells: Map<number, CellModel>
  /** The last row and column that hold something, 0-based; -1 when empty. */
  maxR: number
  maxC: number
  /** 0-based rows and columns the author hid. */
  hiddenRows: Set<number>
  hiddenCols: Set<number>
  layout: SheetLayoutInfo
}

export interface WorkbookModel {
  sheets: SheetModel[]
  /** The index in `sheets` of the sheet the workbook opens on (a visible one). */
  activeSheet: number
  date1904: boolean
  styles: WorkbookStyles
}

export const cellKey = (r: number, c: number) => r * 16384 + c

/** The number format code of a cell style. */
export function codeOf(model: WorkbookModel, s: number): string {
  return formatCode(model.styles.xfNumFmt[s] ?? 0, model.styles.numFmts)
}

export function emptyLayout(): SheetLayoutInfo {
  return {
    cols: [],
    rows: new Map(),
    zeroHeight: false,
    merges: [],
    frozen: { rows: 0, cols: 0 },
    showGridLines: true,
    showHeaders: true,
    drawings: [],
    conditionalFormats: 0,
    rules: [],
    comments: [],
  }
}

interface Rel {
  type: string
  target: string
}

function resolve(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/')
  parts.pop()
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

async function text(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  return file ? file.async('string') : ''
}

async function rels(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
  const slash = partPath.lastIndexOf('/')
  const relPath = `${partPath.slice(0, slash + 1)}_rels/${partPath.slice(slash + 1)}.rels`
  const out = new Map<string, Rel>()
  for (const m of (await text(zip, relPath)).matchAll(/<(?:\w+:)?Relationship(?=[\s/>])([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id')
    const type = (attr(m[1], 'Type') ?? '').split('/').pop() ?? ''
    const target = attr(m[1], 'Target')
    if (!id || target === undefined || attr(m[1], 'TargetMode') === 'External') continue
    out.set(id, { type, target: resolve(partPath, decodeXmlEntities(target)) })
  }
  return out
}

interface SharedString {
  text: string
  runs?: TextRun[]
}

/** A string item's runs (`<r>`), each in its own font; none when it is plain text. */
function runsOf(inner: string, p: string, ctx: ColorContext): TextRun[] | undefined {
  if (!new RegExp(`<${p}r(?=[\\s>])`).test(inner)) return undefined
  const runs: TextRun[] = []
  for (const m of inner.matchAll(new RegExp(`<${p}r(?=[\\s>])[^>]*>([\\s\\S]*?)</${p}r>`, 'g'))) {
    const t = new RegExp(`<${p}t(?=[\\s/>])[^>]*?(?:/>|>([\\s\\S]*?)</${p}t>)`).exec(m[1])
    const pr = new RegExp(`<${p}rPr(?=[\\s>])[^>]*>([\\s\\S]*?)</${p}rPr>`).exec(m[1])
    runs.push({ text: decodeCellText(t?.[1] ?? ''), font: pr ? fontOf(pr[1], ctx) : undefined })
  }
  return runs
}

function readSharedStrings(xml: string, ctx: ColorContext): SharedString[] {
  if (!xml) return []
  const p = rootPrefix(xml, 'sst')
  const out: SharedString[] = []
  for (const m of xml.matchAll(new RegExp(`<${p}si(?=[\\s/>])[^>]*?(?:\\/>|>([\\s\\S]*?)</${p}si>)`, 'g'))) {
    if (m[1] === undefined) {
      out.push({ text: '' })
      continue
    }
    const runs = runsOf(m[1].replace(new RegExp(`<${p}rPh(?=[\\s>])[\\s\\S]*?</${p}rPh>`, 'g'), ''), p, ctx)
    out.push(runs ? { text: textOfStringItem(m[1], p), runs } : { text: textOfStringItem(m[1], p) })
  }
  return out
}

/** "B12" → [11, 1] (0-based); null when it isn't an address. */
function position(ref: string): [number, number] | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(ref)
  return m ? [Number(m[2]) - 1, columnNumber(m[1]) - 1] : null
}

const isTrue = (v: string | undefined) => v === '1' || v === 'true'
const EMU_PER_PIXEL = 9525

/** A drawing part's charts, pictures and shapes, with their anchors. */
async function readDrawings(zip: JSZip, drawingPath: string, ctx: ColorContext): Promise<DrawingModel[]> {
  const xml = await text(zip, drawingPath)
  if (!xml) return []
  const drawingRels = await rels(zip, drawingPath)
  const out: DrawingModel[] = []
  const anchors = xml.matchAll(/<(?:\w+:)?(twoCellAnchor|oneCellAnchor|absoluteAnchor)(?=[\s>])[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/g)
  for (const m of anchors) {
    const body = m[2]
    const point = (tag: string) => {
      const s = section(body, tag)
      if (!s) return undefined
      const g = (t: string) => Number(new RegExp(`<(?:\\w+:)?${t}>([^<]*)<`).exec(s)?.[1] ?? 0)
      return { col: g('col'), colOff: g('colOff') / EMU_PER_PIXEL, row: g('row'), rowOff: g('rowOff') / EMU_PER_PIXEL }
    }
    const ext = /<(?:\w+:)?ext(?=[\s/>])[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(body)
    const pos = /<(?:\w+:)?pos(?=[\s/>])[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/.exec(body)
    const anchor: DrawingAnchor = {
      from: point('from'),
      to: m[1] === 'twoCellAnchor' ? point('to') : undefined,
      size: ext ? { width: Number(ext[1]) / EMU_PER_PIXEL, height: Number(ext[2]) / EMU_PER_PIXEL } : undefined,
      pos: pos ? { x: Number(pos[1]) / EMU_PER_PIXEL, y: Number(pos[2]) / EMU_PER_PIXEL } : undefined,
    }
    const chartRid = /<(?:\w+:)?chart(?=[\s/>])[^>]*\s[\w.-]+:id="([^"]+)"/.exec(body)?.[1]
    if (chartRid) {
      const relation = drawingRels.get(chartRid)
      try {
        const xml = relation ? await text(zip, relation.target) : ''
        const chart: ChartModel | undefined = relation?.type === 'chartEx'
          ? { supported: false, kind: 'chartex' }
          : xml ? readChart(xml, ctx) : undefined
        out.push({ what: 'chart', title: chartTitle(xml), anchor, chart })
      } catch {
        out.push({ what: 'chart', anchor, chart: { supported: false, kind: 'unknown' } })
      }
    } else if (/<(?:\w+:)?blip(?=[\s/>])/.test(body)) {
      out.push({ what: 'image', anchor })
    } else if (/<(?:\w+:)?sp(?=[\s>])/.test(body)) {
      out.push({ what: 'shape', anchor })
    }
  }
  return out
}

async function readWorksheet(
  zip: JSZip,
  path: string,
  name: string,
  state: SheetState,
  strings: SharedString[],
  model: Pick<WorkbookModel, 'styles' | 'date1904'>,
  ctx: ColorContext,
): Promise<SheetModel> {
  const xml = await text(zip, path)
  const p = rootPrefix(xml, 'worksheet')
  const layout = emptyLayout()
  const sheet: SheetModel = { name, state, kind: 'worksheet', cells: new Map(), maxR: -1, maxC: -1, hiddenRows: new Set(), hiddenCols: new Set(), layout }

  // the sheet's view: frozen panes, gridlines, headers; its tab colour; default sizes
  const view = new RegExp(`<${p}sheetView(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</${p}sheetView>)`).exec(xml)
  if (view) {
    layout.showGridLines = !/^(0|false)$/.test(attr(view[1], 'showGridLines') ?? '')
    layout.showHeaders = !/^(0|false)$/.test(attr(view[1], 'showRowColHeaders') ?? '')
    const pane = view[2] ? new RegExp(`<${p}pane(?=[\\s/>])([^>]*?)\\/?>`).exec(view[2]) : null
    if (pane && /frozen/i.test(attr(pane[1], 'state') ?? '')) {
      layout.frozen = { rows: Number(attr(pane[1], 'ySplit') ?? 0) || 0, cols: Number(attr(pane[1], 'xSplit') ?? 0) || 0 }
    }
  }
  layout.tabColor = colorOf(new RegExp(`<${p}tabColor(?=[\\s/>])[^>]*\\/?>`).exec(xml)?.[0], ctx)
  const format = new RegExp(`<${p}sheetFormatPr(?=[\\s/>])([^>]*?)\\/?>`).exec(xml)
  if (format) {
    const num = (n: string) => {
      const v = attr(format[1], n)
      return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined
    }
    layout.defaultRowHeight = num('defaultRowHeight')
    layout.defaultColWidth = num('defaultColWidth')
    layout.baseColWidth = num('baseColWidth')
    layout.zeroHeight = isTrue(attr(format[1], 'zeroHeight'))
  }

  for (const m of section(xml, 'cols').matchAll(new RegExp(`<${p}col(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const min = Number(attr(m[1], 'min')) - 1
    const max = Math.min(Number(attr(m[1], 'max')), 16384) - 1
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) continue
    const width = attr(m[1], 'width')
    const style = attr(m[1], 'style')
    const hidden = isTrue(attr(m[1], 'hidden'))
    layout.cols.push({ min, max, width: width !== undefined ? Number(width) : undefined, hidden, style: style !== undefined ? Number(style) : undefined })
    if (hidden) for (let c = min; c <= max; c++) sheet.hiddenCols.add(c)
  }

  const shared = new Map<string, { formula: string; r: number; c: number }>()
  const rowRe = new RegExp(`<${p}row(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</${p}row>)`, 'g')
  const cellRe = new RegExp(`<${p}c(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</${p}c>)`, 'g')
  const vRe = new RegExp(`<${p}v(?=[\\s>])[^>]*>([\\s\\S]*?)</${p}v>`)
  const fRe = new RegExp(`<${p}f(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</${p}f>)`)
  const isRe = new RegExp(`<${p}is(?=[\\s>])[^>]*>([\\s\\S]*?)</${p}is>`)
  let nextRow = 0
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(xml))) {
    const rAttr = attr(rm[1], 'r')
    const r = rAttr !== undefined ? Number(rAttr) - 1 : nextRow
    nextRow = r + 1
    const hidden = isTrue(attr(rm[1], 'hidden'))
    if (hidden) sheet.hiddenRows.add(r)
    const ht = attr(rm[1], 'ht')
    const rowStyle = isTrue(attr(rm[1], 'customFormat')) ? Number(attr(rm[1], 's') ?? 0) : undefined
    if (hidden || ht !== undefined || rowStyle !== undefined) {
      layout.rows.set(r, { height: ht !== undefined ? Number(ht) : undefined, hidden, style: rowStyle })
    }
    if (!rm[2]) continue
    let nextCol = 0
    cellRe.lastIndex = 0
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(rm[2]))) {
      const ref = attr(cm[1], 'r')
      const at = ref ? position(ref) : null
      const c = at ? at[1] : nextCol
      nextCol = c + 1
      const body = cm[2] ?? ''
      const s = Number(attr(cm[1], 's') ?? '0') || 0
      const t = attr(cm[1], 't') ?? 'n'
      const v = vRe.exec(body)?.[1]

      // the formula, for the formula bar; a shared formula's other cells get the anchor's, moved
      let formula: string | undefined
      const f = fRe.exec(body)
      if (f) {
        const ft = attr(f[1], 't')
        const si = attr(f[1], 'si')
        if (f[2] !== undefined && f[2] !== '') {
          formula = decodeXmlEntities(f[2])
          if (ft === 'shared' && si !== undefined) shared.set(si, { formula, r, c })
        } else if (ft === 'shared' && si !== undefined) {
          const anchor = shared.get(si)
          if (anchor) {
            try {
              formula = shiftFormula(anchor.formula, r - anchor.r, c - anchor.c)
            } catch {
              formula = undefined
            }
          }
        }
      }

      let kind: CellKind = 'n'
      let value: number | string | boolean | null = null
      let runs: TextRun[] | undefined
      if (t === 's') {
        kind = 's'
        const item = v !== undefined ? strings[Number(v)] : undefined
        value = v !== undefined ? item?.text ?? '' : null
        runs = item?.runs
      } else if (t === 'inlineStr') {
        kind = 's'
        const is = isRe.exec(body)
        value = is ? textOfStringItem(is[1], p) : ''
        runs = is ? runsOf(is[1], p, ctx) : undefined
      } else if (t === 'str') {
        kind = 's'
        value = v !== undefined ? decodeCellText(v) : ''
      } else if (t === 'b') {
        kind = 'b'
        value = isTrue(v)
      } else if (t === 'e') {
        kind = 'e'
        value = v !== undefined ? decodeXmlEntities(v) : '#N/A'
      } else if (t === 'd') {
        // an ISO date, as some writers store it: a serial in the workbook's own date system, since the formatting
        // adds the 1904 system's offset back (Codex on #723)
        const time = v !== undefined ? Date.parse(decodeXmlEntities(v)) : NaN
        value = Number.isFinite(time) ? (time - Date.UTC(1899, 11, 30)) / 86_400_000 - (model.date1904 ? 1462 : 0) : null
      } else if (v !== undefined && v.trim() !== '') {
        const n = Number(v)
        value = Number.isFinite(n) ? n : null
      }
      if (value === null && formula === undefined) {
        // an empty cell with a style still draws its fill and borders
        if (s) sheet.cells.set(cellKey(r, c), { kind: 'n', value: '', text: '', s })
        continue
      }

      const cell: CellModel = { kind, value: value ?? '', text: '', s }
      if (formula !== undefined) cell.formula = formula
      if (runs) cell.runs = runs
      if (kind === 'e') {
        cell.text = String(value)
      } else if (value !== null) {
        const out = formatCellValue(value, formatCode(model.styles.xfNumFmt[s] ?? 0, model.styles.numFmts), model.date1904)
        cell.text = out.text
        if (out.color) cell.color = out.color
        if (out.pad) cell.pad = out.pad
      }
      sheet.cells.set(cellKey(r, c), cell)
      if (r > sheet.maxR) sheet.maxR = r
      if (c > sheet.maxC) sheet.maxC = c
    }
  }

  for (const m of section(xml, 'mergeCells').matchAll(new RegExp(`<${p}mergeCell(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const [a, b] = (attr(m[1], 'ref') ?? '').split(':')
    const from = position(a ?? '')
    const to = position(b ?? a ?? '')
    if (!from || !to) continue
    layout.merges.push([from[0], from[1], to[0], to[1]])
    // a merge widens the drawn area to take it in, unless it is huge (a whole sheet merged): then the cells say how
    // far the sheet goes
    if ((to[0] - from[0] + 1) * (to[1] - from[1] + 1) <= 100_000) {
      if (to[0] > sheet.maxR) sheet.maxR = to[0]
      if (to[1] > sheet.maxC) sheet.maxC = to[1]
    }
  }
  layout.conditionalFormats = (xml.match(new RegExp(`<${p}conditionalFormatting(?=[\\s>])`, 'g')) ?? []).length

  layout.rules = readRules(xml, ctx)

  const sheetRels = await rels(zip, path)
  const drawingId = new RegExp(`<${p}drawing(?=[\\s/>])[^>]*\\s[\\w.-]+:id="([^"]+)"`).exec(xml)?.[1]
  const drawingPath = drawingId ? sheetRels.get(drawingId)?.target : undefined
  if (drawingPath) layout.drawings = await readDrawings(zip, drawingPath, ctx)
  for (const rel of sheetRels.values()) {
    if (rel.type !== 'comments') continue
    for (const m of (await text(zip, rel.target)).matchAll(/<(?:\w+:)?comment(?=[\s>])[^>]*\bref="([^"]+)"/g)) {
      const at = position(m[1])
      if (at) layout.comments.push(at)
    }
  }
  return sheet
}

async function readChartSheet(zip: JSZip, path: string, name: string, state: SheetState, ctx: ColorContext): Promise<SheetModel> {
  const xml = await text(zip, path)
  const layout = emptyLayout()
  layout.tabColor = colorOf(/<(?:\w+:)?tabColor(?=[\s/>])[^>]*\/?>/.exec(xml)?.[0], ctx)
  const drawingId = /<(?:\w+:)?drawing(?=[\s/>])[^>]*\s[\w.-]+:id="([^"]+)"/.exec(xml)?.[1]
  const drawingPath = drawingId ? (await rels(zip, path)).get(drawingId)?.target : undefined
  if (drawingPath) layout.drawings = await readDrawings(zip, drawingPath, ctx)
  return { name, state, kind: 'chartsheet', cells: new Map(), maxR: -1, maxC: -1, hiddenRows: new Set(), hiddenCols: new Set(), layout }
}

/** Read a workbook. Throws when it isn't one this reader can read; the caller falls back to SheetJS. */
export async function readWorkbook(bytes: Uint8Array): Promise<WorkbookModel> {
  const zip = await JSZip.loadAsync(bytes)
  const rootRels = await rels(zip, '')
  const office = [...rootRels.values()].find((r) => r.type === 'officeDocument')
  if (!office) throw new Error('The workbook has no main part')
  const wbPath = office.target
  const wbXml = await text(zip, wbPath)
  if (!wbXml) throw new Error('The workbook has no main part')
  const wbRels = await rels(zip, wbPath)
  const relOf = (type: string) => [...wbRels.values()].find((r) => r.type === type)

  const wp = rootPrefix(wbXml, 'workbook')
  const pr = new RegExp(`<${wp}workbookPr(?=[\\s/>])([^>]*)`).exec(wbXml)
  const date1904 = !!pr && isTrue(attr(pr[1], 'date1904'))
  const view = new RegExp(`<${wp}workbookView(?=[\\s/>])([^>]*)`).exec(wbXml)
  const activeTab = Number(view ? attr(view[1], 'activeTab') ?? '0' : '0') || 0

  const stylesRel = relOf('styles')
  const stylesXml = stylesRel ? await text(zip, stylesRel.target) : ''
  const themeRel = relOf('theme')
  const styles = readStyles(stylesXml, themeRel ? await text(zip, themeRel.target) : '')
  const ctx = colorContext(styles, stylesXml)
  const sstRel = relOf('sharedStrings')
  const strings = readSharedStrings(sstRel ? await text(zip, sstRel.target) : '', ctx)
  const base = { styles, date1904 }

  const sheets: SheetModel[] = []
  for (const m of wbXml.matchAll(new RegExp(`<${wp}sheet(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const name = decodeXmlEntities(attr(m[1], 'name') ?? '')
    const stateAttr = attr(m[1], 'state')
    const state: SheetState = stateAttr === 'hidden' || stateAttr === 'veryHidden' ? stateAttr : 'visible'
    // r:id in either quote (Codex on #725)
    const rid = /\s[\w.-]+:id\s*=\s*(["'])(.*?)\1/.exec(m[1])?.[2]
    const rel = rid ? wbRels.get(rid) : undefined
    if (rel?.type === 'worksheet') {
      sheets.push(await readWorksheet(zip, rel.target, name, state, strings, base, ctx))
    } else if (rel?.type === 'chartsheet') {
      sheets.push(await readChartSheet(zip, rel.target, name, state, ctx))
    } else {
      sheets.push({ name, state, kind: 'other', cells: new Map(), maxR: -1, maxC: -1, hiddenRows: new Set(), hiddenCols: new Set(), layout: emptyLayout() })
    }
  }
  if (!sheets.length) throw new Error('The workbook has no sheets')

  // the sheet it opens on: its active tab when that is visible, else the first visible one
  let activeSheet = activeTab < sheets.length && sheets[activeTab].state === 'visible' ? activeTab : sheets.findIndex((s) => s.state === 'visible')
  if (activeSheet < 0) activeSheet = 0
  return { sheets, activeSheet, date1904, styles }
}
