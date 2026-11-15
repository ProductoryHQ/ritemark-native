/**
 * Sprint 158 PR 2 (#711): our own reader for the Excel preview. An .xlsx's bytes in, a model per sheet out: every
 * cell's value and its text as Excel draws it (numfmt, numberFormat.ts), formulas for the formula bar (shared ones
 * moved to each cell), hidden rows, columns and sheets, the sheet the workbook opens on, and the date system.
 *
 * It reads the XML as text, as the host's save does (src/excel/), with any namespace prefix. SheetJS stays for .xls
 * and as the fallback when this reader can't read a file. PR 3 adds the look (styles, sizes, merges, panes).
 */
import JSZip from 'jszip'
import { attr, columnNumber, decodeCellText, decodeXmlEntities, rootPrefix, textOfStringItem } from '../../../../src/excel/sheetXml'
import { shiftFormula } from '../../../../src/excel/sharedFormula'
import { formatCellValue, formatCode } from './numberFormat'
import { readStyles, type WorkbookStyles } from './excelStyles'

export type SheetState = 'visible' | 'hidden' | 'veryHidden'
export type CellKind = 'n' | 's' | 'b' | 'e'

export interface CellModel {
  kind: CellKind
  /** The value: a number (dates are serial days), text, a boolean, or an error's text. */
  value: number | string | boolean
  /** What Excel draws for it, by its number format. */
  text: string
  /** A colour the number format asks for ([Red] …). */
  color?: string
  /** The cell style's index (`s`). */
  s: number
  /** The formula without its "=", when the cell has one. */
  formula?: string
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

function readSharedStrings(xml: string): string[] {
  if (!xml) return []
  const p = rootPrefix(xml, 'sst')
  const out: string[] = []
  for (const m of xml.matchAll(new RegExp(`<${p}si(?=[\\s/>])[^>]*?(?:\\/>|>([\\s\\S]*?)</${p}si>)`, 'g'))) {
    out.push(m[1] === undefined ? '' : textOfStringItem(m[1], p))
  }
  return out
}

/** "B12" → [11, 1] (0-based); null when it isn't an address. */
function position(ref: string): [number, number] | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(ref)
  return m ? [Number(m[2]) - 1, columnNumber(m[1]) - 1] : null
}

function readWorksheet(
  xml: string,
  name: string,
  state: SheetState,
  strings: string[],
  model: Pick<WorkbookModel, 'styles' | 'date1904'>,
): SheetModel {
  const p = rootPrefix(xml, 'worksheet')
  const sheet: SheetModel = { name, state, kind: 'worksheet', cells: new Map(), maxR: -1, maxC: -1, hiddenRows: new Set(), hiddenCols: new Set() }

  for (const m of xml.matchAll(new RegExp(`<${p}col(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const hidden = attr(m[1], 'hidden')
    if (hidden !== '1' && hidden !== 'true') continue
    const min = Number(attr(m[1], 'min'))
    const max = Math.min(Number(attr(m[1], 'max')), 16384)
    for (let c = min; c <= max; c++) sheet.hiddenCols.add(c - 1)
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
    const hidden = attr(rm[1], 'hidden')
    if (hidden === '1' || hidden === 'true') sheet.hiddenRows.add(r)
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
      if (t === 's') {
        kind = 's'
        value = v !== undefined ? strings[Number(v)] ?? '' : null
      } else if (t === 'inlineStr') {
        kind = 's'
        const is = isRe.exec(body)
        value = is ? textOfStringItem(is[1], p) : ''
      } else if (t === 'str') {
        kind = 's'
        value = v !== undefined ? decodeCellText(v) : ''
      } else if (t === 'b') {
        kind = 'b'
        value = v === '1' || v === 'true'
      } else if (t === 'e') {
        kind = 'e'
        value = v !== undefined ? decodeXmlEntities(v) : '#N/A'
      } else if (t === 'd') {
        // an ISO date, as some writers store it
        const time = v !== undefined ? Date.parse(decodeXmlEntities(v)) : NaN
        value = Number.isFinite(time) ? (time - Date.UTC(1899, 11, 30)) / 86_400_000 : null
      } else if (v !== undefined && v.trim() !== '') {
        const n = Number(v)
        value = Number.isFinite(n) ? n : null
      }
      if (value === null && formula === undefined) continue

      const cell: CellModel = { kind, value: value ?? '', text: '', s }
      if (formula !== undefined) cell.formula = formula
      if (kind === 'e') {
        cell.text = String(value)
      } else if (value !== null) {
        const out = formatCellValue(value, formatCode(model.styles.xfNumFmt[s] ?? 0, model.styles.numFmts), model.date1904)
        cell.text = out.text
        if (out.color) cell.color = out.color
      }
      sheet.cells.set(cellKey(r, c), cell)
      if (r > sheet.maxR) sheet.maxR = r
      if (c > sheet.maxC) sheet.maxC = c
    }
  }
  return sheet
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
  const date1904 = !!pr && /^(1|true)$/.test(attr(pr[1], 'date1904') ?? '')
  const view = new RegExp(`<${wp}workbookView(?=[\\s/>])([^>]*)`).exec(wbXml)
  const activeTab = Number(view ? attr(view[1], 'activeTab') ?? '0' : '0') || 0

  const stylesRel = relOf('styles')
  const styles = readStyles(stylesRel ? await text(zip, stylesRel.target) : '')
  const sstRel = relOf('sharedStrings')
  const strings = readSharedStrings(sstRel ? await text(zip, sstRel.target) : '')
  const base = { styles, date1904 }

  const sheets: SheetModel[] = []
  for (const m of wbXml.matchAll(new RegExp(`<${wp}sheet(?=[\\s/>])([^>]*?)\\/?>`, 'g'))) {
    const name = decodeXmlEntities(attr(m[1], 'name') ?? '')
    const stateAttr = attr(m[1], 'state')
    const state: SheetState = stateAttr === 'hidden' || stateAttr === 'veryHidden' ? stateAttr : 'visible'
    const rid = /\s[\w.-]+:id\s*=\s*"([^"]*)"/.exec(m[1])?.[1]
    const rel = rid ? wbRels.get(rid) : undefined
    if (rel?.type === 'worksheet') {
      sheets.push(readWorksheet(await text(zip, rel.target), name, state, strings, base))
    } else {
      sheets.push({
        name,
        state,
        kind: rel?.type === 'chartsheet' ? 'chartsheet' : 'other',
        cells: new Map(),
        maxR: -1,
        maxC: -1,
        hiddenRows: new Set(),
        hiddenCols: new Set(),
      })
    }
  }
  if (!sheets.length) throw new Error('The workbook has no sheets')

  // the sheet it opens on: its active tab when that is visible, else the first visible one
  let activeSheet = activeTab < sheets.length && sheets[activeTab].state === 'visible' ? activeTab : sheets.findIndex((s) => s.state === 'visible')
  if (activeSheet < 0) activeSheet = 0
  return { sheets, activeSheet, date1904, styles }
}
