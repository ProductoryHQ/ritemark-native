import type { CSSProperties } from 'react'
import type { CellStyle, DifferentialStyle, FontStyle } from './excelStyles'
import { formatCellValue, formatCode } from './numberFormat'
import { cellKey, type CellModel, type SheetModel, type WorkbookModel } from './readWorkbook'
import { styleIndexOf, styleOf, type SheetLayout } from './sheetLayout'
import { compileRules, type DataBarStyle, type RuleStyle } from './ruleEngine'

export function compileCellRules(model: WorkbookModel, sheet: SheetModel, today = new Date()) {
  if (!sheet.layout.rules.length) return undefined
  return compileRules(sheet, sheet.layout.rules, {
    today, date1904: model.date1904, styles: model.styles, sheets: model.sheets,
  })
}

export type CellRules = ReturnType<typeof compileCellRules>

/** Tabs share one workbook version. Compile each sheet when it is first shown. */
export function cellRulesForVersion(model: WorkbookModel, today = new Date()) {
  const compiled = new Map<SheetModel, CellRules>()
  return (sheet: SheetModel) => {
    if (!compiled.has(sheet)) compiled.set(sheet, compileCellRules(model, sheet, today))
    return compiled.get(sheet)
  }
}

interface PaintedRule {
  rule: RuleStyle
  style: CellStyle | undefined
  cell: CellModel | undefined
  paint: ReturnType<typeof dataBarPaint> | undefined
}

/** Share styling, formatting and bar paint across measurement and drawing. */
export function visibleCellRules(
  rules: CellRules,
  layout: Pick<SheetLayout, 'rowOf' | 'rowH' | 'colW' | 'frozenRows' | 'frozenCols'>,
  window: { i0: number; i1: number; c0: number; c1: number },
  sheet: SheetModel,
  model: WorkbookModel,
) {
  const cells = new Map<number, PaintedRule | undefined>()
  const isVisible = (i: number, c: number) =>
    (i < layout.frozenRows || (i >= window.i0 && i <= window.i1)) &&
    (c < layout.frozenCols || (c >= window.c0 && c <= window.c1))
  const at = (i: number, c: number, row = layout.rowOf[i], col = c, spillSource = false) => {
    if (!rules || !layout.rowH[i] || !layout.colW[c] || (!spillSource && !isVisible(i, c))) return undefined
    const key = cellKey(row, col)
    if (!cells.has(key)) {
      const rule = rules.styleAt(row, col)
      let entry: PaintedRule | undefined
      if (rule.dxf || rule.colorScale || rule.dataBar) {
        const original = sheet.cells.get(key)
        const base = styleOf(model.styles, styleIndexOf(sheet, row, col))
        entry = {
          rule,
          style: ruleCellStyle(base, rule, model.styles.baseFont),
          cell: original && ruleCellText(original, rule, model),
          paint: rule.dataBar && dataBarPaint(rule.dataBar),
        }
      }
      cells.set(key, entry)
    }
    return cells.get(key)
  }
  return { at, isVisible }
}

export function ruleFont(font: FontStyle, overrides: DifferentialStyle['font']): FontStyle {
  if (!overrides) return font
  const combined = { ...font }
  for (const key of Object.keys(overrides) as Array<keyof FontStyle>) {
    const value = overrides[key]
    if (value === null) delete combined[key]
    else if (value !== undefined) Object.assign(combined, { [key]: value })
  }
  return combined
}

export function ruleCellStyle(style: CellStyle | undefined, rule: RuleStyle | undefined, base: FontStyle): CellStyle | undefined {
  if (!rule?.dxf && !rule?.colorScale) return style
  const dxf = rule.dxf
  return {
    numFmtId: dxf?.numberFormat?.id ?? style?.numFmtId ?? 0,
    align: style?.align ?? { wrap: false, indent: 0, rotation: 0, shrink: false },
    font: ruleFont(style?.font ?? base, dxf?.font),
    fill: dxf?.fill ?? rule.colorScale ?? style?.fill,
    border: dxf?.border ? { ...style?.border, ...dxf.border } : style?.border,
  }
}

export function ruleCellText(cell: CellModel, rule: RuleStyle | undefined, model: WorkbookModel): CellModel {
  const format = rule?.dxf?.numberFormat
  if (!format || cell.kind === 'e') return cell
  const out = formatCellValue(cell.value, format.code ?? formatCode(format.id, model.styles.numFmts), model.date1904)
  return { ...cell, text: out.text, color: out.color, pad: out.pad, runs: out.text === cell.text ? cell.runs : undefined }
}

export function ruleTextColor(cell: Pick<CellModel, 'color'>, font: DifferentialStyle['font'], styleColor: string): string {
  return font?.color === undefined && cell.color ? cell.color : styleColor
}

export function dataBarPaint(bar: DataBarStyle): { fill: CSSProperties; axis?: CSSProperties } {
  return {
    fill: {
      left: `${bar.from * 100}%`,
      width: `${bar.fraction * 100}%`,
      background: bar.gradient
        ? `linear-gradient(to ${bar.growsLeft ? 'left' : 'right'}, ${bar.color}, color-mix(in srgb, ${bar.color} 18%, white))`
        : bar.color,
      border: bar.borderColor ? `1px solid ${bar.borderColor}` : undefined,
    },
    axis: bar.axis === undefined ? undefined : { left: `${bar.axis * 100}%`, borderLeft: `1px dashed ${bar.axisColor}` },
  }
}
