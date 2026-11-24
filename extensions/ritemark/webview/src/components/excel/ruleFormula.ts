import { A1_TOKEN, parseFormulaRef, refArea, type FormulaRef, type RefArea } from './formulaRef'

export const UNREADABLE = 'unreadable' as const
const ERROR = Symbol('Excel error')
export { ERROR as FORMULA_ERROR }
export type Scalar = string | number | boolean | null | typeof ERROR
export interface FormulaContext {
  row: number
  col: number
  anchor: Pick<RefArea, 'top' | 'left'>
  today: Date
  date1904: boolean
  cellAt(sheet: string | undefined, row: number, col: number): Scalar
  rangeCache?: FormulaRangeCache
  onRead?: (sheet: string | undefined, area: RefArea) => void
  cellsIn(sheet: string | undefined, area: RefArea): Iterable<Scalar>
}

const arities = {
  AND: [1, Infinity], OR: [1, Infinity], NOT: [1, 1], IF: [2, 3],
  ISBLANK: [1, 1], ISNUMBER: [1, 1], ISTEXT: [1, 1], ISERROR: [1, 1],
  ISEVEN: [1, 1], ISODD: [1, 1], MOD: [2, 2], ROW: [0, 1], COLUMN: [0, 1],
  LEN: [1, 1], LEFT: [1, 2], RIGHT: [1, 2], MID: [3, 3], UPPER: [1, 1], LOWER: [1, 1],
  ABS: [1, 1], SUM: [1, Infinity], AVERAGE: [1, Infinity], MIN: [1, Infinity], MAX: [1, Infinity],
  COUNT: [1, Infinity], COUNTA: [1, Infinity], COUNTIF: [2, 2], TODAY: [0, 0], DATE: [3, 3],
} as const

type Name = keyof typeof arities
type Expression =
  | { kind: 'literal'; value: Scalar }
  | { kind: 'ref'; ref: FormulaRef; range: boolean }
  | { kind: 'unary'; op: string; arg: Expression }
  | { kind: 'binary'; op: string; left: Expression; right: Expression }
  | { kind: 'call'; name: Name; args: Expression[] }

type Token = { kind: 'literal' | 'name' | 'ref' | 'operator'; text: string }
const precedence: Record<string, number> = {
  '=': 1, '<>': 1, '<': 1, '<=': 1, '>': 1, '>=': 1,
  '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5,
}

function tokenize(source: string): Token[] {
  const pattern = new RegExp(
    `\\s*(?:(?<ref>${A1_TOKEN.source})(?![\\p{L}\\p{N}_.]|\\s*\\()|(?<literal>"(?:[^"]|"")*"|(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?)|(?<name>[A-Z_][A-Z_0-9.]*)|(?<operator><>|<=|>=|[+*/^&=<>(),-]))`,
    'iuy',
  )
  const tokens: Token[] = []
  while (pattern.lastIndex < source.length) {
    const match = pattern.exec(source)
    if (!match) throw new Error('Unsupported token')
    const kind = (['ref', 'literal', 'name', 'operator'] as const).find((key) => match.groups?.[key] !== undefined)!
    tokens.push({ kind, text: match.groups![kind] })
    if (tokens.length > 512) throw new Error('Formula too long')
  }
  return tokens
}

function acceptsRanges(node: Expression, rangeAllowed = false): boolean {
  switch (node.kind) {
    case 'ref': return !node.range || rangeAllowed
    case 'literal': return true
    case 'unary': return acceptsRanges(node.arg)
    case 'binary': return acceptsRanges(node.left) && acceptsRanges(node.right)
    case 'call':
      return node.args.every((arg, i) => acceptsRanges(arg,
        ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'ROW', 'COLUMN'].includes(node.name) ||
        node.name === 'COUNTIF' && i === 0))
  }
}

export function readRuleFormula(source: string): Expression | typeof UNREADABLE {
  if (source.length > 8192) return UNREADABLE
  try {
    const tokens = tokenize(source.trim().replace(/^=/, '').trim())
    let at = 0
    const accept = (text: string) => {
      if (tokens[at]?.text !== text) return false
      at++
      return true
    }
    const expect = (text: string) => {
      if (!accept(text)) throw new Error('Unexpected token')
    }
    function atom(): Expression {
      const token = tokens[at++]
      if (!token) throw new Error('Missing operand')
      const { text, kind } = token
      if (kind === 'literal') {
        const value = text.startsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : Number(text)
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid number')
        return { kind, value }
      }
      if (kind === 'ref') {
        const ref = parseFormulaRef(text)
        if (!ref) throw new Error('Invalid reference')
        return { kind, ref, range: text.slice(text.lastIndexOf('!') + 1).includes(':') }
      }
      if (text === '+' || text === '-') return { kind: 'unary', op: text, arg: atom() }
      if (text === '(') {
        const body = expression(1)
        expect(')')
        return body
      }
      const name = text.toUpperCase()
      if (name === 'TRUE' || name === 'FALSE') return { kind: 'literal', value: name === 'TRUE' }
      if (kind !== 'name' || !Object.prototype.hasOwnProperty.call(arities, name)) throw new Error('Unsupported function')
      const fn = name as Name
      expect('(')
      const args: Expression[] = []
      if (!accept(')')) {
        do { args.push(expression(1)) } while (accept(','))
        expect(')')
      }
      const [min, max] = arities[fn]
      if (args.length < min || args.length > max) throw new Error('Invalid argument count')
      if (fn === 'COUNTIF' && args[0].kind !== 'ref') throw new Error('Expected reference')
      if ((fn === 'ROW' || fn === 'COLUMN') && args.length && args[0].kind !== 'ref') throw new Error('Expected reference')
      return { kind: 'call', name: fn, args }
    }
    function expression(min: number): Expression {
      let left = atom()
      while (tokens[at]?.kind === 'operator') {
        const op = tokens[at].text
        const power = precedence[op] ?? 0
        if (power < min) break
        at++
        left = { kind: 'binary', op, left, right: expression(power + 1) }
      }
      return left
    }
    const result = expression(1)
    return at === tokens.length && acceptsRanges(result) ? result : UNREADABLE
  } catch {
    return UNREADABLE
  }
}

export const DAY = 86_400_000
export function excelDay(timestamp: number, date1904: boolean): number {
  if (date1904) return (timestamp - Date.UTC(1904, 0, 1)) / DAY
  const serial = (timestamp - Date.UTC(1899, 11, 31)) / DAY
  return serial >= 60 ? serial + 1 : serial
}

export const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
export const formulaTruth = (value: Scalar) => value === true || typeof value === 'number' && value !== 0

export function compareScalars(a: Exclude<Scalar, typeof ERROR>, b: Exclude<Scalar, typeof ERROR>): number {
  const fillBlank = (other: Scalar) => typeof other === 'string' ? '' : typeof other === 'boolean' ? false : 0
  const left = a ?? fillBlank(b)
  const right = b ?? fillBlank(a)
  const order = (v: Scalar) => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2
  if (typeof left !== typeof right) return order(left) - order(right)
  const x = typeof left === 'string' ? left.toUpperCase() : left
  const y = typeof right === 'string' ? right.toUpperCase() : right
  return x === y ? 0 : x < y ? -1 : 1
}

const numeric = (value: Scalar) => {
  if (value === ERROR || typeof value === 'string' && !value.trim()) return NaN
  return Number(value)
}
const display = (value: Scalar) => value === null ? '' : typeof value === 'boolean' ? String(value).toUpperCase() : String(value)
const finite = (value: number) => Number.isFinite(value) ? value : ERROR
const relation = (op: string, cmp: number) => {
  switch (op) {
    case '=': return cmp === 0
    case '<>': return cmp !== 0
    case '<': return cmp < 0
    case '<=': return cmp <= 0
    case '>': return cmp > 0
    case '>=': return cmp >= 0
    default: return false
  }
}

export function wildcardText(value: string, pattern: string): boolean {
  // Match by advancing through literal runs and single-character wildcards, with a
  // checkpoint at the most recent star. This avoids exponential regex backtracking.
  const input = Array.from(value.toUpperCase())
  const tokens = Array.from(pattern.toUpperCase().matchAll(/~[~?*]|[\s\S]/gu), ([token]) => token)
  let at = 0
  let token = 0
  let star = -1
  let retry = 0
  while (at < input.length) {
    const part = tokens[token]
    if (part === '*') {
      star = token++
      retry = at
    } else if (part === '?' || (part?.length === 2 && part[0] === '~' ? part[1] : part) === input[at]) {
      at++
      token++
    } else if (star >= 0) {
      token = star + 1
      at = ++retry
    } else return false
  }
  while (tokens[token] === '*') token++
  return token === tokens.length
}

const countKey = (value: Scalar) => typeof value === 'string' ? value.toUpperCase() : value

function criterionParts(value: string) {
  const [, op = '=', text] = /^(<>|<=|>=|=|<|>)?([\s\S]*)$/.exec(value)!
  const target = text.trim() && Number.isFinite(Number(text)) ? Number(text) : text
  return { op, target }
}

function criterion(value: Scalar): (candidate: Scalar) => boolean {
  if (value === ERROR) return (candidate) => candidate === ERROR
  if (typeof value !== 'string') return (candidate) => candidate !== null && candidate !== ERROR && compareScalars(candidate, value) === 0
  const { op, target } = criterionParts(value)
  return (candidate) => {
    if (candidate === ERROR) return false
    if (op === '=' || op === '<>') {
      const equal = typeof target === 'string' && /[~*?]/.test(target)
        ? typeof candidate === 'string' && wildcardText(candidate, target)
        : (candidate !== null || target === '') && compareScalars(candidate, target) === 0
      return op === '=' ? equal : !equal
    }
    return candidate !== null && typeof candidate === typeof target && relation(op, compareScalars(candidate, target))
  }
}

interface RangeSummary {
  count: number
  occupied: number
  total: number
  min: number
  max: number
  error: boolean
}

interface CachedRange {
  sheet: string | undefined
  area: RefArea
  summary?: RangeSummary
  counts?: Map<Scalar, number>
}

export type FormulaRangeCache = Map<string, CachedRange>

function staticRange(ref: FormulaRef, area: RefArea, ctx: FormulaContext): CachedRange | undefined {
  const cache = ctx.rangeCache
  if (!cache || ![ref.start, ref.end].every(({ row, col, absoluteRow, absoluteCol }) =>
    (row === undefined || absoluteRow) && (col === undefined || absoluteCol))) return undefined
  const key = JSON.stringify([ref.sheet?.toUpperCase(), area.top, area.left, area.bottom, area.right])
  let entry = cache.get(key)
  if (!entry) {
    entry = { sheet: ref.sheet, area }
    cache.set(key, entry)
  }
  return entry
}

function summarize(values: Iterable<Scalar>, coerce: boolean): RangeSummary {
  const result = { count: 0, occupied: 0, total: 0, min: Infinity, max: -Infinity, error: false }
  for (const value of values) {
    if (value === null) continue
    result.occupied++
    if (value === ERROR) result.error = true
    const n = typeof value === 'number' ? value : coerce ? numeric(value) : NaN
    if (!Number.isFinite(n)) continue
    result.count++
    result.total += n
    result.min = Math.min(result.min, n)
    result.max = Math.max(result.max, n)
  }
  return result
}

function rangeSummary(ref: FormulaRef, area: RefArea, ctx: FormulaContext): RangeSummary {
  const entry = staticRange(ref, area, ctx)
  const summary = entry?.summary ?? summarize(ctx.cellsIn(ref.sheet, area), false)
  if (entry) entry.summary = summary
  return summary
}

function rangeCounts(ref: FormulaRef, area: RefArea, ctx: FormulaContext): Map<Scalar, number> | undefined {
  const entry = staticRange(ref, area, ctx)
  if (!entry) return undefined
  if (!entry.counts) {
    const counts = new Map<Scalar, number>()
    let blanks = (area.bottom - area.top + 1) * (area.right - area.left + 1)
    for (const value of ctx.cellsIn(ref.sheet, area)) {
      if (value === null) continue
      blanks--
      const key = countKey(value)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    counts.set(null, blanks)
    entry.counts = counts
  }
  return entry.counts
}

export function primeFormulaRanges(expr: Expression, ctx: FormulaContext): void {
  switch (expr.kind) {
    case 'unary': primeFormulaRanges(expr.arg, ctx); break
    case 'binary':
      primeFormulaRanges(expr.left, ctx)
      primeFormulaRanges(expr.right, ctx)
      break
    case 'call':
      for (const [i, arg] of expr.args.entries()) {
        primeFormulaRanges(arg, ctx)
        if (arg.kind !== 'ref') continue
        const area = refArea(arg.ref)
        if (!area || !staticRange(arg.ref, area, ctx)) continue
        if (expr.name === 'COUNTIF' && i === 0) rangeCounts(arg.ref, area, ctx)
        if (['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA'].includes(expr.name)) rangeSummary(arg.ref, area, ctx)
      }
      break
  }
}

export function runRuleFormula(expr: Expression, ctx: FormulaContext): Scalar {
  const areaOf = (ref: FormulaRef) => {
    const area = refArea(ref, ctx.row - ctx.anchor.top, ctx.col - ctx.anchor.left)
    if (area) ctx.onRead?.(ref.sheet, area)
    return area
  }
  const read = (node: Expression): Scalar => {
    switch (node.kind) {
      case 'literal': return node.value
      case 'ref': {
        const area = areaOf(node.ref)
        return area && !node.range ? ctx.cellAt(node.ref.sheet, area.top, area.left) : ERROR
      }
      case 'unary': return finite(numeric(read(node.arg)) * (node.op === '-' ? -1 : 1))
      case 'binary': {
        const a = read(node.left)
        const b = read(node.right)
        if (a === ERROR || b === ERROR) return ERROR
        switch (node.op) {
          case '&': return display(a) + display(b)
          case '+': return finite(numeric(a) + numeric(b))
          case '-': return finite(numeric(a) - numeric(b))
          case '*': return finite(numeric(a) * numeric(b))
          case '/': return finite(numeric(a) / numeric(b))
          case '^': return finite(numeric(a) ** numeric(b))
          default: return relation(node.op, compareScalars(a, b))
        }
      }
      case 'call': return call(node.name, node.args)
    }
  }
  function aggregate(name: Name, args: Expression[]): Scalar {
    let count = 0
    let occupied = 0
    let total = 0
    let min = Infinity
    let max = -Infinity
    for (const arg of args) {
      const area = arg.kind === 'ref' ? areaOf(arg.ref) : undefined
      if (arg.kind === 'ref' && !area) return ERROR
      const summary = arg.kind === 'ref' && area
        ? rangeSummary(arg.ref, area, ctx)
        : summarize([read(arg)], true)
      if (summary.error && name !== 'COUNT' && name !== 'COUNTA') return ERROR
      count += summary.count
      occupied += summary.occupied
      total += summary.total
      min = Math.min(min, summary.min)
      max = Math.max(max, summary.max)
    }
    switch (name) {
      case 'COUNT': return count
      case 'COUNTA': return occupied
      case 'SUM': return finite(total)
      case 'AVERAGE': return finite(total / count)
      case 'MIN': return count ? min : 0
      case 'MAX': return count ? max : 0
      default: return ERROR
    }
  }
  function call(name: Name, args: Expression[]): Scalar {
    switch (name) {
      case 'TODAY': return excelDay(calendarDay(ctx.today), ctx.date1904)
      case 'ROW':
      case 'COLUMN': {
        const arg = args[0]
        const area = arg?.kind === 'ref' ? areaOf(arg.ref) : { top: ctx.row, left: ctx.col }
        return area ? 1 + (name === 'ROW' ? area.top : area.left) : ERROR
      }
      case 'COUNTIF': {
        const arg = args[0]
        const area = arg.kind === 'ref' ? areaOf(arg.ref) : undefined
        if (!area || arg.kind !== 'ref') return ERROR
        const input = read(args[1])
        const counts = rangeCounts(arg.ref, area, ctx)
        if (counts) {
          const { op, target }: { op: string; target: Scalar } = typeof input === 'string'
            ? criterionParts(input) : { op: '=', target: input }
          if (op === '=' && (typeof target !== 'string' || !/[~*?]/.test(target))) {
            if (target === null) return (counts.get(0) ?? 0) + (counts.get(false) ?? 0) + (counts.get('') ?? 0)
            return (counts.get(countKey(target)) ?? 0) + (target === '' ? counts.get(null) ?? 0 : 0)
          }
          const matches = criterion(input)
          let count = 0
          for (const [value, occurrences] of counts) if (matches(value)) count += occurrences
          return count
        }
        const matches = criterion(input)
        let count = 0
        let occupied = 0
        for (const value of ctx.cellsIn(arg.ref.sheet, area)) {
          if (value === null) continue
          occupied++
          if (matches(value)) count++
        }
        return count + (matches(null) ? (area.bottom - area.top + 1) * (area.right - area.left + 1) - occupied : 0)
      }
      case 'SUM': case 'AVERAGE': case 'MIN': case 'MAX': case 'COUNT': case 'COUNTA':
        return aggregate(name, args)
      case 'IF': {
        const condition = read(args[0])
        if (condition === ERROR) return ERROR
        return formulaTruth(condition) ? read(args[1]) : args[2] ? read(args[2]) : false
      }
    }
    const values = args.map(read)
    const [a, b, c] = values
    switch (name) {
      case 'ISBLANK': return a === null
      case 'ISNUMBER': return typeof a === 'number'
      case 'ISTEXT': return typeof a === 'string'
      case 'ISERROR': return a === ERROR
    }
    if (values.includes(ERROR)) return ERROR
    const na = numeric(a)
    const nb = numeric(values.length >= 2 ? b : 1)
    const nc = numeric(c)
    const text = display(a)
    switch (name) {
      case 'AND': return values.every(formulaTruth)
      case 'OR': return values.some(formulaTruth)
      case 'NOT': return !formulaTruth(a)
      case 'ABS': return finite(Math.abs(na))
      case 'ISEVEN': return Number.isFinite(na) ? Math.trunc(na) % 2 === 0 : ERROR
      case 'ISODD': return Number.isFinite(na) ? Math.trunc(na) % 2 !== 0 : ERROR
      case 'MOD': return finite(na - nb * Math.floor(na / nb))
      case 'LEN': return text.length
      case 'LEFT': return nb >= 0 ? text.slice(0, nb) : ERROR
      case 'RIGHT': return nb >= 0 ? text.slice(Math.max(0, text.length - Math.trunc(nb))) : ERROR
      case 'MID': return nb >= 1 && nc >= 0 ? text.slice(Math.trunc(nb) - 1, Math.trunc(nb) - 1 + Math.trunc(nc)) : ERROR
      case 'UPPER': return text.toUpperCase()
      case 'LOWER': return text.toLowerCase()
      case 'DATE': {
        const y = Math.trunc(na)
        if (y < 0 || y >= 10000) return ERROR
        const year = y < 1900 ? y + 1900 : y
        if (!ctx.date1904 && year === 1900 && nb === 2 && nc === 29) return 60
        return finite(excelDay(Date.UTC(year, Math.trunc(nb) - 1, Math.trunc(nc)), ctx.date1904))
      }
    }
  }
  return read(expr)
}
