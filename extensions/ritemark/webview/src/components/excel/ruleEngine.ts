import type { DifferentialStyle, WorkbookStyles } from './excelStyles'
import { EXCEL_COLS, type RefArea } from './formulaRef'
import type { ConditionalRule, DataBarRule, RuleSet, RuleThreshold } from './readRules'
import type { CellModel, SheetModel } from './readWorkbook'
import {
  calendarDay, compareScalars, DAY, excelDay, FORMULA_ERROR, formulaTruth,
  readRuleFormula, runRuleFormula, UNREADABLE, wildcardText, type FormulaContext, type Scalar,
} from './ruleFormula'

type RuleSheet = Pick<SheetModel, 'cells' | 'name'>
export interface RuleContext {
  today: Date
  date1904: boolean
  styles: Pick<WorkbookStyles, 'dxfs'>
  sheets?: readonly RuleSheet[]
}

export interface DataBarStyle {
  fraction: number
  /** Left edge of the visible bar, as a fraction of the cell width. */
  from: number
  color: string
  negative: boolean
  gradient: boolean
  borderColor?: string
  axis?: number
  axisColor?: string
  showValue: boolean
}

export interface RuleStyle {
  dxf?: DifferentialStyle
  colorScale?: string
  dataBar?: DataBarStyle
}

const inside = (area: RefArea, row: number, col: number) =>
  row >= area.top && row <= area.bottom && col >= area.left && col <= area.right

const toScalar = (cell: CellModel | undefined): Scalar => {
  if (!cell || cell.value === '' && cell.kind === 'n' && cell.formula === undefined) return null
  return cell.kind === 'e' ? FORMULA_ERROR : cell.value
}
const isNumber = (value: Scalar): value is number => typeof value === 'number' && Number.isFinite(value)
const keyOf = (value: Scalar) => typeof value === 'string' ? value.toUpperCase() : value
const clamp = (n: number) => Math.max(0, Math.min(1, n))

/** Small ranges use direct lookups. Whole rows and columns walk the sparse cells. */
function* cellsIn(sheet: RuleSheet, area: RefArea): Iterable<Scalar> {
  const count = (area.bottom - area.top + 1) * (area.right - area.left + 1)
  if (count <= sheet.cells.size) {
    for (let row = area.top; row <= area.bottom; row++) {
      for (let col = area.left; col <= area.right; col++) {
        const cell = sheet.cells.get(row * EXCEL_COLS + col)
        if (cell) yield toScalar(cell)
      }
    }
  } else {
    for (const [key, cell] of sheet.cells) {
      if (inside(area, Math.floor(key / EXCEL_COLS), key % EXCEL_COLS)) yield toScalar(cell)
    }
  }
}

interface RangeFacts {
  numbers: number[]
  counts: Map<Scalar, number>
  mean: number
  deviation: number
}

function collectFacts(sheet: RuleSheet, area: RefArea): RangeFacts {
  const numbers: number[] = []
  const counts = new Map<Scalar, number>()
  let sum = 0
  for (const value of cellsIn(sheet, area)) {
    if (isNumber(value)) {
      numbers.push(value)
      sum += value
    }
    if (value !== null && value !== '') {
      const key = keyOf(value)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const mean = sum / numbers.length
  const deviation = Math.sqrt(numbers.reduce((total, n) => total + (n - mean) ** 2, 0) / numbers.length)
  numbers.sort((a, b) => a - b)
  return { numbers, counts, mean, deviation }
}

function dateWindow(period: string | undefined, ctx: RuleContext): [number, number] | undefined {
  const today = calendarDay(ctx.today)
  const date = new Date(today)
  const week = today - date.getUTCDay() * DAY
  const month = (delta: number) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)
  const windows: Record<string, [number, number]> = {
    yesterday: [today - DAY, today], today: [today, today + DAY], tomorrow: [today + DAY, today + 2 * DAY],
    last7Days: [today - 7 * DAY, today],
    lastWeek: [week - 7 * DAY, week], thisWeek: [week, week + 7 * DAY], nextWeek: [week + 7 * DAY, week + 14 * DAY],
    lastMonth: [month(-1), month(0)], thisMonth: [month(0), month(1)], nextMonth: [month(1), month(2)],
  }
  const bounds = period && Object.prototype.hasOwnProperty.call(windows, period) ? windows[period] : undefined
  return bounds && [excelDay(bounds[0], ctx.date1904), excelDay(bounds[1], ctx.date1904)]
}

function blend(from: string, to: string, fraction: number): string {
  const mix = (at: number) => {
    const a = parseInt(from.slice(at, at + 2), 16)
    const b = parseInt(to.slice(at, at + 2), 16)
    return Math.round(a + (b - a) * fraction).toString(16).padStart(2, '0').toUpperCase()
  }
  return '#' + mix(1) + mix(3) + mix(5)
}

function barAt(value: number, low: number, high: number, bar: DataBarRule): DataBarStyle | undefined {
  if (!bar.color || low > high) return undefined
  const axis = bar.axisPosition === 'middle' ? 0.5 : low >= 0 ? 0 : high <= 0 ? 1 : -low / (high - low)
  const onAxis = bar.axisPosition !== 'none'
  const negative = value < 0
  const length = (x: number) => clamp(bar.minLength / 100 + x * (bar.maxLength - bar.minLength) / 100)
  const magnitude = negative ? Math.abs(Math.min(0, low)) : Math.max(0, high)
  const crossesZero = low < 0 && high > 0
  const useMagnitude = onAxis && (crossesZero || bar.axisPosition === 'middle')
  const extent = negative ? axis : 1 - axis
  const denominator = bar.axisPosition === 'middle' ? Math.max(Math.abs(low), Math.abs(high)) : magnitude
  const progress = useMagnitude
    ? denominator ? clamp(Math.abs(value) / denominator) : 0
    : high === low ? 1 : clamp(negative && onAxis ? (high - value) / (high - low) : (value - low) / (high - low))
  const fraction = onAxis ? value === 0 && useMagnitude ? 0 : extent * length(progress) : length(progress)
  const from = onAxis ? negative ? axis - fraction : axis : 0
  const rtl = bar.direction === 'rightToLeft'
  const showAxis = onAxis && (crossesZero || bar.axisPosition === 'middle')
  return {
    fraction, from: rtl ? 1 - from - fraction : from,
    color: negative && onAxis ? bar.negativeColor ?? '#FF0000' : bar.color,
    negative, gradient: bar.gradient, showValue: bar.showValue,
    borderColor: bar.border ? (negative && onAxis ? bar.negativeBorderColor ?? bar.negativeColor ?? '#FF0000' : bar.borderColor ?? bar.color) : undefined,
    axis: showAxis ? rtl ? 1 - axis : axis : undefined,
    axisColor: showAxis ? bar.axisColor ?? '#000000' : undefined,
  }
}

function mergeDxf(lower: DifferentialStyle, higher: DifferentialStyle): DifferentialStyle {
  return {
    ...lower, ...higher,
    ...(lower.font || higher.font ? { font: { ...lower.font, ...higher.font } } : {}),
    ...(lower.border || higher.border ? { border: { ...lower.border, ...higher.border } } : {}),
  }
}

type Match = true | { fill: string } | { bar: DataBarStyle } | undefined | false
type MatchAt = (row: number, col: number, value: Scalar) => Match
type Parsed = ReturnType<typeof readRuleFormula>

function compare(operator: string | undefined, value: Scalar, args: Scalar[]): boolean {
  if (value === FORMULA_ERROR || args[0] === FORMULA_ERROR || args[1] === FORMULA_ERROR) return false
  const x = compareScalars(value, args[0])
  switch (operator) {
    case 'equal': return x === 0
    case 'notEqual': return x !== 0
    case 'greaterThan': return x > 0
    case 'greaterThanOrEqual': return x >= 0
    case 'lessThan': return x < 0
    case 'lessThanOrEqual': return x <= 0
    case 'between': return x >= 0 && compareScalars(value, args[1]) <= 0
    case 'notBetween': return x < 0 || compareScalars(value, args[1]) > 0
    default: return false
  }
}

function compileArea(
  rule: ConditionalRule, area: RefArea,
  formulas: Parsed[], thresholds: Array<Parsed | undefined>,
  context: RuleContext, getSheet: (name?: string) => RuleSheet | undefined,
  factsFor: (area: RefArea) => RangeFacts, window?: [number, number],
): MatchAt {
  const formulaContext = (row: number, col: number): FormulaContext => ({
    row, col, anchor: area, today: context.today, date1904: context.date1904,
    cellAt(name, r, c) {
      const target = getSheet(name)
      return target ? toScalar(target.cells.get(r * EXCEL_COLS + c)) : FORMULA_ERROR
    },
    *cellsIn(name, range) {
      const target = getSheet(name)
      if (target) yield* cellsIn(target, range)
      else yield FORMULA_ERROR
    },
  })
  const run = (formula: Parsed | undefined, row: number, col: number) =>
    formula === undefined || formula === UNREADABLE ? FORMULA_ERROR : runRuleFormula(formula, formulaContext(row, col))

  switch (rule.type) {
    case 'cellIs': return (r, c, value) => compare(rule.operator, value, formulas.map((f) => run(f, r, c)))
    case 'expression': return (r, c) => formulaTruth(run(formulas[0], r, c))
    case 'containsText': case 'notContainsText': case 'beginsWith': case 'endsWith': {
      const text = rule.text
      if (text === undefined) return () => false
      const needle = text.toUpperCase()
      return (_r, _c, value) => {
        if (value === null || value === FORMULA_ERROR) return false
        const input = String(value).toUpperCase()
        const match = rule.type === 'beginsWith' ? input.startsWith(needle)
          : rule.type === 'endsWith' ? input.endsWith(needle) : wildcardText(input, '*' + text + '*')
        return rule.type === 'notContainsText' ? !match : match
      }
    }
    case 'containsBlanks': return (_r, _c, value) => value === null || typeof value === 'string' && !value.trim()
    case 'notContainsBlanks': return (_r, _c, value) => value !== null && (typeof value !== 'string' || !!value.trim())
    case 'containsErrors': return (_r, _c, value) => value === FORMULA_ERROR
    case 'notContainsErrors': return (_r, _c, value) => value !== FORMULA_ERROR
    case 'duplicateValues': case 'uniqueValues': {
      const { counts } = factsFor(area)
      return (_r, _c, value) => {
        const count = counts.get(keyOf(value)) ?? 0
        return rule.type === 'uniqueValues' ? count === 1 : count > 1
      }
    }
    case 'timePeriod':
      return (_r, _c, value) => !!window && isNumber(value) && value >= window[0] && value < window[1]
    case 'iconSet': return () => false
  }

  const { numbers, mean, deviation } = factsFor(area)
  if (!numbers.length) return () => false
  const low = numbers[0]
  const high = numbers[numbers.length - 1]
  if (rule.type === 'top10') {
    const count = Math.min(numbers.length, Math.max(0, rule.percent
      ? Math.floor(numbers.length * rule.rank / 100) || 1
      : Math.floor(rule.rank)))
    const cut = numbers[rule.bottom ? count - 1 : numbers.length - count]
    return (_r, _c, value) => isNumber(value) && (rule.bottom ? value <= cut : value >= cut)
  }
  if (rule.type === 'aboveAverage') {
    const cut = mean + (rule.aboveAverage ? 1 : -1) * rule.stdDev * deviation
    return (_r, _c, value) => isNumber(value) &&
      ((rule.aboveAverage ? value > cut : value < cut) || rule.equalAverage && value === cut)
  }

  const resolve = (stop: RuleThreshold, i: number): number => {
    const value = stop.value?.trim() ? Number(stop.value) : NaN
    switch (stop.type) {
      case 'min': return low
      case 'max': return high
      case 'autoMin': return Math.min(0, low)
      case 'autoMax': return Math.max(0, high)
      case 'num': return value
      case 'percent': return low + (high - low) * clamp(value / 100)
      case 'percentile': {
        const rank = (numbers.length - 1) * clamp(value / 100)
        const index = Math.floor(rank)
        return numbers[index] + (numbers[Math.ceil(rank)] - numbers[index]) * (rank - index)
      }
      case 'formula': {
        const result = run(thresholds[i], area.top, area.left)
        return isNumber(result) ? result : NaN
      }
      default: return NaN
    }
  }
  if (rule.scale) {
    const { colors, stops } = rule.scale
    const values = stops.map(resolve)
    if (values.length < 2 || values.length > 3 || values.length !== colors.length ||
        colors.some((color) => !color) || values.some((v, i) => !Number.isFinite(v) || i > 0 && v < values[i - 1])) return () => false
    return (_r, _c, value) => {
      if (!isNumber(value)) return false
      const i = values.length === 3 && value > values[1] ? 1 : 0
      const delta = values[i + 1] - values[i]
      const fraction = delta === 0 ? (value <= values[i] ? 0 : 1) : clamp((value - values[i]) / delta)
      return { fill: blend(colors[i]!, colors[i + 1]!, fraction) }
    }
  }
  if (rule.bar) {
    const bar = rule.bar
    const [min, max] = bar.stops.map(resolve)
    if (!Number.isFinite(min) || !Number.isFinite(max)) return () => false
    return (_r, _c, value) => {
      const result = isNumber(value) && barAt(value, min, max, bar)
      return result ? { bar: result } : false
    }
  }
  return () => false
}

/** Compile once for a sheet version. Call styleAt only for the cells the caller needs. */
export function compileRules(sheet: RuleSheet, rules: RuleSet, ctx: RuleContext) {
  const unreadable: ConditionalRule[] = []
  const iconSets: ConditionalRule[] = []
  const sheets = new Map(ctx.sheets?.map((target) => [target.name.toUpperCase(), target]))
  sheets.set(sheet.name.toUpperCase(), sheet)
  const getSheet = (name?: string) => name === undefined ? sheet : sheets.get(name.toUpperCase())
  const facts = new Map<string, RangeFacts>()
  const factsFor = (area: RefArea) => {
    const key = `${area.top}:${area.left}:${area.bottom}:${area.right}`
    let cached = facts.get(key)
    if (!cached) {
      cached = collectFacts(sheet, area)
      facts.set(key, cached)
    }
    return cached
  }
  const compiled = [...rules].sort((a, b) => a.priority - b.priority).flatMap((rule) => {
    if (rule.type === 'iconSet') {
      iconSets.push(rule)
      return []
    }
    // Excel commonly stores generated SEARCH/ISERROR formulas on built-in text,
    // error and blank rules. Their declared type and attributes define the test.
    const formulas = rule.type === 'cellIs' || rule.type === 'expression' ? rule.formulas.map(readRuleFormula) : []
    const thresholds = (rule.scale?.stops ?? rule.bar?.stops ?? []).map((stop) =>
      stop.type === 'formula' ? readRuleFormula(stop.value ?? '') : undefined)
    const required = rule.type === 'expression' || rule.type === 'cellIs'
      ? rule.operator === 'between' || rule.operator === 'notBetween' ? 2 : 1 : 0
    if (formulas.length < required || [...formulas, ...thresholds].includes(UNREADABLE)) {
      unreadable.push(rule)
      return []
    }
    const window = rule.type === 'timePeriod' ? dateWindow(rule.timePeriod, ctx) : undefined
    return [{
      rule, dxf: rule.dxfId === undefined ? undefined : ctx.styles.dxfs[rule.dxfId],
      areas: rule.areas.map((area) => ({ area, match: compileArea(rule, area, formulas, thresholds, ctx, getSheet, factsFor, window) })),
    }]
  })
  return {
    unreadable, iconSets,
    styleAt(row: number, col: number): RuleStyle {
      const result: RuleStyle = {}
      const value = toScalar(sheet.cells.get(row * EXCEL_COLS + col))
      for (const { rule, dxf, areas } of compiled) {
        const match = areas.find(({ area }) => inside(area, row, col))?.match(row, col, value)
        if (!match) continue
        if (typeof match === 'object' && 'bar' in match) result.dataBar ??= match.bar
        if (typeof match === 'object' && 'fill' in match && !result.dxf?.fill) result.colorScale ??= match.fill
        if (dxf) {
          const lower = { ...dxf }
          if (result.colorScale) delete lower.fill
          result.dxf = result.dxf ? mergeDxf(lower, result.dxf) : { ...lower }
        }
        if (rule.stopIfTrue) break
      }
      return result
    },
  }
}
