import type { CSSProperties } from 'react'
import type { CellStyle, DifferentialStyle, FontStyle } from './excelStyles'
import { formatCellValue, formatCode } from './numberFormat'
import { cellKey, type CellModel, type SheetModel, type WorkbookModel } from './readWorkbook'
import type { SheetLayout } from './sheetLayout'
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

/** Shared by measurement and drawing. The grid asks only for slots in the current window. */
export function visibleCellRules(
  rules: CellRules,
  layout: Pick<SheetLayout, 'rowOf' | 'rowH' | 'colW' | 'frozenRows' | 'frozenCols'>,
  window: { i0: number; i1: number; c0: number; c1: number },
) {
  const cells = new Map<number, RuleStyle | undefined>()
  // A visible piece of a merged cell draws the rule at its anchor.
  return (i: number, c: number, row = layout.rowOf[i], col = c) => {
    if (!rules || !layout.rowH[i] || !layout.colW[c]) return undefined
    if (i >= layout.frozenRows && (i < window.i0 || i > window.i1)) return undefined
    if (c >= layout.frozenCols && (c < window.c0 || c > window.c1)) return undefined
    const key = cellKey(row, col)
    if (!cells.has(key)) {
      const rule = rules.styleAt(row, col)
      cells.set(key, rule.dxf || rule.colorScale || rule.dataBar ? rule : undefined)
    }
    return cells.get(key)
  }
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

export function dataBarPaint(bar: DataBarStyle): { fill: CSSProperties; axis?: CSSProperties } {
  const towardsLeft = bar.axis === undefined ? bar.from > 0 : bar.from < bar.axis
  return {
    fill: {
      left: `${bar.from * 100}%`,
      width: `${bar.fraction * 100}%`,
      background: bar.gradient
        ? `linear-gradient(to ${towardsLeft ? 'left' : 'right'}, ${bar.color}, color-mix(in srgb, ${bar.color} 18%, white))`
        : bar.color,
      border: bar.borderColor ? `1px solid ${bar.borderColor}` : undefined,
    },
    axis: bar.axis === undefined ? undefined : { left: `${bar.axis * 100}%`, borderLeft: `1px dashed ${bar.axisColor}` },
  }
}
