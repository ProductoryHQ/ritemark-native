import { attr, decodeXmlEntities, rootPrefix } from '../../../../src/excel/sheetXml'
import { colorOf, each, type ColorContext } from './excelStyles'
import { parseFormulaRef, referenceBounds, type RefArea } from './formulaRef'

const kinds = [
  'cellIs', 'containsText', 'notContainsText', 'beginsWith', 'endsWith', 'containsBlanks',
  'notContainsBlanks', 'containsErrors', 'notContainsErrors', 'duplicateValues', 'uniqueValues',
  'top10', 'aboveAverage', 'timePeriod', 'expression', 'colorScale', 'dataBar', 'iconSet',
] as const

export interface RuleThreshold { type: string; value?: string; inclusive: boolean }

export interface DataBarRule {
  id?: string
  stops: RuleThreshold[]
  color?: string
  minLength: number
  maxLength: number
  showValue: boolean
  gradient: boolean
  border: boolean
  borderColor?: string
  negativeColor?: string
  negativeBorderColor?: string
  axisColor?: string
  axisPosition: 'automatic' | 'middle' | 'none'
  direction: 'context' | 'leftToRight' | 'rightToLeft'
}

export interface ConditionalRule {
  type: typeof kinds[number]
  priority: number
  stopIfTrue: boolean
  dxfId?: number
  sqref: string
  areas: RefArea[]
  formulas: string[]
  operator?: string
  text?: string
  rank: number
  percent: boolean
  bottom: boolean
  aboveAverage: boolean
  equalAverage: boolean
  stdDev: number
  timePeriod?: string
  scale?: { stops: RuleThreshold[]; colors: Array<string | undefined> }
  bar?: DataBarRule
  icons?: { name: string; stops: RuleThreshold[]; reverse: boolean; showValue: boolean }
}

export type RuleSet = ConditionalRule[]
const decoded = (attrs: string, name: string) => {
  const value = attr(attrs, name)
  return value === undefined ? undefined : decodeXmlEntities(value)
}
const flag = (attrs: string, name: string, fallback = false) => {
  const value = attr(attrs, name)
  return value === undefined ? fallback : value === 'true' || value === '1'
}
const number = (attrs: string, name: string, fallback: number) => {
  const value = Number(attr(attrs, name))
  return Number.isFinite(value) ? value : fallback
}
const stopsOf = (body: string): RuleThreshold[] => each(body, 'cfvo').map(([a, inner]) => ({
  type: attr(a, 'type') ?? '',
  value: decoded(a, 'val') ?? each(inner, 'f').map(([, value]) => decodeXmlEntities(value))[0],
  inclusive: flag(a, 'gte', true),
}))

export function readRules(xml: string, ctx: ColorContext): RuleSet {
  const prefix = rootPrefix(xml, 'worksheet')
  const blocks = new RegExp(`<${prefix}conditionalFormatting(?=[\\s>])([^>]*)>([\\s\\S]*?)</${prefix}conditionalFormatting>`, 'g')
  const twins = new Map<string, [string, string]>()
  for (const [, , body] of xml.matchAll(/<([\w.-]+:)conditionalFormattings(?=[\s>])[^>]*>([\s\S]*?)<\/\1conditionalFormattings>/g)) {
    for (const [a, rule] of each(body, 'cfRule')) {
      const id = attr(a, 'id')?.trim().toUpperCase()
      const bar = each(rule, 'dataBar')[0]
      if (id && attr(a, 'type') === 'dataBar' && bar) twins.set(id, bar)
    }
  }

  const rules: RuleSet = []
  for (const [, attrs, body] of xml.matchAll(blocks)) {
    const sqref = decoded(attrs, 'sqref') ?? ''
    const areas = sqref.trim().split(/\s+/).flatMap((item) => {
      const ref = parseFormulaRef(item)
      const area = ref && !ref.sheet ? referenceBounds(ref) : undefined
      return area ? [area] : []
    })
    if (!areas.length) continue
    for (const [a, content] of each(body, 'cfRule')) {
      const type = kinds.find((kind) => kind === attr(a, 'type'))
      if (!type) continue
      const rule: ConditionalRule = {
        type, sqref, areas,
        priority: number(a, 'priority', Infinity),
        stopIfTrue: flag(a, 'stopIfTrue'),
        dxfId: attr(a, 'dxfId') === undefined ? undefined : number(a, 'dxfId', -1),
        formulas: each(content, 'formula').map(([, f]) => decodeXmlEntities(f)),
        operator: attr(a, 'operator'), text: decoded(a, 'text'),
        rank: number(a, 'rank', 10), percent: flag(a, 'percent'), bottom: flag(a, 'bottom'),
        aboveAverage: flag(a, 'aboveAverage', true), equalAverage: flag(a, 'equalAverage'),
        stdDev: number(a, 'stdDev', 0), timePeriod: attr(a, 'timePeriod'),
      }
      const scale = each(content, 'colorScale')[0]
      if (type === 'colorScale' && scale) {
        rule.scale = { stops: stopsOf(scale[1]), colors: each(scale[1], 'color').map(([tag]) => colorOf(tag, ctx)) }
      }
      const icons = each(content, 'iconSet')[0]
      if (type === 'iconSet' && icons) {
        rule.icons = { name: attr(icons[0], 'iconSet') ?? '3TrafficLights1', stops: stopsOf(icons[1]),
          reverse: flag(icons[0], 'reverse'), showValue: flag(icons[0], 'showValue', true) }
      }
      const bar = each(content, 'dataBar')[0]
      if (type === 'dataBar' && bar) {
        const id = each(each(content, 'extLst')[0]?.[1] ?? '', 'id')[0]?.[1].trim()
        const twin = twins.get(id?.toUpperCase() ?? '')
        const [ta, tb] = twin ?? ['', '']
        const color = (tag: string) => colorOf(each(tb, tag)[0]?.[0], ctx)
        const positive = color('fillColor') ?? colorOf(each(bar[1], 'color')[0]?.[0], ctx)
        const borderColor = color('borderColor')
        const axis = attr(ta, 'axisPosition')
        const direction = attr(ta, 'direction')
        const extendedStops = stopsOf(tb)
        rule.bar = {
          id, stops: extendedStops.length === 2 ? extendedStops : stopsOf(bar[1]),
          color: positive, minLength: number(ta, 'minLength', number(bar[0], 'minLength', 10)),
          maxLength: number(ta, 'maxLength', number(bar[0], 'maxLength', 90)),
          showValue: flag(ta, 'showValue', flag(bar[0], 'showValue', true)), gradient: flag(ta, 'gradient', true),
          border: flag(ta, 'border'), borderColor,
          negativeColor: flag(ta, 'negativeBarColorSameAsPositive') ? positive : color('negativeFillColor'),
          negativeBorderColor: flag(ta, 'negativeBarBorderColorSameAsPositive', true) ? borderColor : color('negativeBorderColor'),
          axisColor: color('axisColor'), axisPosition: axis === 'none' || axis === 'middle' ? axis : 'automatic',
          direction: direction === 'leftToRight' || direction === 'rightToLeft' ? direction : 'context',
        }
      }
      rules.push(rule)
    }
  }
  return rules
}
