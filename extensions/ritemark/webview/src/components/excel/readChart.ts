import { attr, decodeXmlEntities } from '../../../../src/excel/sheetXml'
import {
  colorOf, readTheme, section, type ColorContext,
} from './excelStyles'
import type {
  ChartAxis, ChartData, ChartLabels, ChartMarker, ChartModel, ChartNumberFormat,
  ChartPlot, ChartSeries, ChartShape, ChartTextStyle, ChartTitle, ChartValue,
} from './chartModel'

interface Element {
  name: string
  tag: string
  body: string
}

/** Walk immediate children so a series override cannot be mistaken for a plot setting. */
function* children(xml: string): Generator<Element> {
  const tags = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)(?:[\w.-]+:)?([\w.-]+)(?:[^<>"']|"[^"]*"|'[^']*')*>/g
  let depth = 0
  let start: RegExpExecArray | undefined
  let bodyStart = 0
  for (const match of xml.matchAll(tags)) {
    const [, close, name] = match
    if (!name) continue
    if (close) {
      if (depth && --depth === 0 && start) {
        yield { name: start[2], tag: start[0], body: xml.slice(bodyStart, match.index) }
      }
    } else if (match[0].endsWith('/>')) {
      if (!depth) yield { name, tag: match[0], body: '' }
    } else if (depth++ === 0) {
      start = match
      bodyStart = match.index + match[0].length
    }
  }
}

type Fields = ReturnType<typeof fields>

function fields(body = '') {
  const elements = [...children(body)]
  const byName = new Map<string, Element>()
  for (const el of elements) if (!byName.has(el.name)) byName.set(el.name, el)
  const get = (name: string) => byName.get(name)
  return {
    elements,
    get,
    all: (name: string) => elements.filter((el) => el.name === name),
    val: (name: string) => attr(get(name)?.tag ?? '', 'val'),
    num: (name: string) => number(attr(get(name)?.tag ?? '', 'val')),
    bool: (name: string) => {
      const el = get(name)
      return el ? bool(attr(el.tag, 'val') ?? '1') : undefined
    },
    text: (name: string) => elementText(get(name)),
  }
}

function elementText(el?: Element): string | undefined {
  return el && decodeXmlEntities(el.body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, value: string) =>
    value.replace(/&/g, '&amp;')))
}

function number(value?: string): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const bool = (value?: string) => value === undefined ? undefined : value === '1' || value === 'true'

const schemeColors = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4',
  'accent5', 'accent6', 'hlink', 'folHlink']
const schemeAliases: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }

/** Translate DrawingML's colour attributes to the shared workbook colour resolver. */
function drawingColor(fill: Element | undefined, ctx: ColorContext): string | undefined {
  const color = children(fill?.body ?? '').next().value
  if (!color) return undefined
  const value = attr(color.tag, 'val') ?? ''
  const scheme = color.name === 'schemeClr' ? schemeColors.indexOf(schemeAliases[value] ?? value) : -1
  const rgb = color.name === 'srgbClr' ? value : color.name === 'sysClr' ? attr(color.tag, 'lastClr') : undefined
  if (scheme < 0 && !rgb) return undefined
  const transforms = fields(color.body)
  const multiplier = (transforms.num('lumMod') ?? 100_000) / 100_000
  const offset = (transforms.num('lumOff') ?? 0) / 100_000
  const tag = scheme >= 0 ? `theme="${scheme}"` : `rgb="${rgb}"`
  return colorOf(tag, ctx, multiplier === 1 && offset === 0 ? undefined : { multiplier, offset })
}

function shape(el: Element | undefined, ctx: ColorContext): ChartShape | undefined {
  if (!el) return undefined
  const props = fields(el.body)
  const line = props.get('ln')
  const lineProps = fields(line?.body)
  const width = number(attr(line?.tag ?? '', 'w'))
  return {
    fill: drawingColor(props.get('solidFill'), ctx),
    line: drawingColor(lineProps.get('solidFill'), ctx),
    lineWidth: width === undefined ? undefined : width / 9525,
    dash: lineProps.val('prstDash'),
    noFill: props.get('noFill') ? true : undefined,
    noLine: lineProps.get('noFill') ? true : undefined,
  }
}

function textStyle(container: Element | undefined, ctx: ColorContext): ChartTextStyle | undefined {
  if (!container) return undefined
  const props = fields(container.body)
  const body = props.get('bodyPr')
  const para = fields(props.get('p')?.body)
  const run = fields(para.get('r')?.body).get('rPr')
  const pr = ['rPr', 'defRPr', 'endParaRPr'].includes(container.name) ? container
    : fields(para.get('pPr')?.body).get('defRPr') ?? run ?? para.get('endParaRPr')
  const tag = pr?.tag ?? ''
  const style = fields(pr?.body)
  const size = number(attr(tag, 'sz'))
  const rotation = number(attr(body?.tag ?? '', 'rot'))
  return {
    size: size === undefined ? undefined : size / 100,
    bold: bool(attr(tag, 'b')),
    italic: bool(attr(tag, 'i')),
    font: attr(style.get('latin')?.tag ?? '', 'typeface'),
    color: drawingColor(style.get('solidFill'), ctx),
    rotation: rotation === undefined ? undefined : rotation / 60_000,
  }
}

function points(elements: Iterable<Element>, type: ChartData['type']): Map<number, ChartValue> {
  const result = new Map<number, ChartValue>()
  for (const point of elements) {
    if (point.name !== 'pt') continue
    const index = number(attr(point.tag, 'idx'))
    const value = elementText(children(point.body).next().value)
    const parsed = type === 'number' ? number(value) : value
    if (index !== undefined && Number.isSafeInteger(index) && index >= 0 && parsed !== undefined) result.set(index, parsed)
  }
  return result
}

function data(el?: Element): ChartData | undefined {
  if (!el) return undefined
  const source = fields(el.body)
  const ref = source.get('numRef') ?? source.get('strRef') ?? source.get('multiLvlStrRef')
  const refFields = fields(ref?.body)
  const cache = refFields.get('numCache') ?? refFields.get('strCache') ?? refFields.get('multiLvlStrCache')
    ?? source.get('numLit') ?? source.get('strLit')
  const type = ref?.name === 'numRef' || cache?.name === 'numLit' ? 'number' : 'string'
  const literal = source.text('v')
  const result: ChartData = {
    formula: refFields.text('f'),
    type,
    points: literal === undefined ? new Map() : new Map([[0, literal]]),
  }
  if (!cache) return result
  // Walk points once, retaining their indices even if Excel omitted blank points.
  const levels: ReadonlyMap<number, ChartValue>[] = []
  let pointCount: number | undefined
  let formatCode: string | undefined
  function* cachePoints(body: string) {
    for (const el of children(body)) {
      if (el.name === 'lvl') levels.push(points(children(el.body), type))
      if (el.name === 'ptCount') pointCount = number(attr(el.tag, 'val'))
      if (el.name === 'formatCode') formatCode = elementText(el)
      if (el.name === 'pt') yield el
    }
  }
  const values = points(cachePoints(cache.body), type)
  return {
    ...result,
    points: levels[0] ?? values,
    pointCount,
    formatCode,
    levels: levels.length ? levels : undefined,
  }
}

/** Preserve the rich-text title used by the existing drawing card. */
export function chartTitle(xml: string): string | undefined {
  return richTitleText(section(xml, 'title'))
}

function richTitleText(body: string): string | undefined {
  const words = [...body.matchAll(/<(?:\w+:)?t>([^<]*)<\/(?:\w+:)?t>/g)].map((m) => decodeXmlEntities(m[1])).join('')
  return words || undefined
}

function title(el: Element | undefined, ctx: ColorContext): ChartTitle | undefined {
  if (!el) return undefined
  const props = fields(el.body)
  const tx = props.get('tx')
  const rich = fields(tx?.body).get('rich')
  const reference = rich ? undefined : data(tx)
  const runs = fields(rich?.body).all('p').flatMap((p) =>
    fields(p.body).elements.filter((run) => run.name === 'r' || run.name === 'fld').map((run) => {
      const runFields = fields(run.body)
      return { text: runFields.text('t') ?? '', style: textStyle(runFields.get('rPr'), ctx) }
    }))
  return {
    text: rich ? richTitleText(rich.body) ?? (runs.map((run) => run.text).join('') || undefined) : reference?.points.get(0)?.toString(),
    reference,
    runs: rich ? runs : undefined,
    style: textStyle(props.get('txPr') ?? rich, ctx),
    overlay: props.bool('overlay'),
  }
}

function numberFormat(el?: Element): ChartNumberFormat | undefined {
  if (!el) return undefined
  const code = attr(el.tag, 'formatCode')
  return { formatCode: code === undefined ? undefined : decodeXmlEntities(code), sourceLinked: bool(attr(el.tag, 'sourceLinked')) }
}

function labels(el: Element | undefined, ctx: ColorContext): ChartLabels | undefined {
  if (!el) return undefined
  const props = fields(el.body)
  return {
    position: props.val('dLblPos'),
    separator: props.text('separator'),
    deleted: props.bool('delete'),
    showLegendKey: props.bool('showLegendKey'),
    showVal: props.bool('showVal'),
    showCatName: props.bool('showCatName'),
    showSerName: props.bool('showSerName'),
    showPercent: props.bool('showPercent'),
    showBubbleSize: props.bool('showBubbleSize'),
    showLeaderLines: props.bool('showLeaderLines'),
    leaderLines: gridlines(props.get('leaderLines'), ctx),
    numberFormat: numberFormat(props.get('numFmt')),
    style: textStyle(props.get('txPr'), ctx),
    shape: shape(props.get('spPr'), ctx),
    entries: props.all('dLbl').flatMap((entry) => {
      const fieldsOfEntry = fields(entry.body)
      const index = fieldsOfEntry.num('idx')
      return index === undefined ? [] : [{ ...labels(entry, ctx), index, text: title(entry, ctx) }]
    }),
  }
}

function marker(el: Element | undefined, ctx: ColorContext): ChartMarker | undefined {
  if (!el) return undefined
  const props = fields(el.body)
  return { symbol: props.val('symbol'), size: props.num('size'), shape: shape(props.get('spPr'), ctx) }
}

function series(el: Element, ctx: ColorContext): ChartSeries {
  const props = fields(el.body)
  return {
    index: props.num('idx'),
    order: props.num('order'),
    tx: data(props.get('tx')),
    cat: data(props.get('cat')),
    val: data(props.get('val')),
    xVal: data(props.get('xVal')),
    yVal: data(props.get('yVal')),
    shape: shape(props.get('spPr'), ctx),
    marker: marker(props.get('marker'), ctx),
    smooth: props.bool('smooth'),
    explosion: props.num('explosion'),
    labels: labels(props.get('dLbls'), ctx),
    pointStyles: props.all('dPt').flatMap((point) => {
      const pointProps = fields(point.body)
      const index = pointProps.num('idx')
      if (index === undefined) return []
      return [{
        index,
        shape: shape(pointProps.get('spPr'), ctx),
        marker: marker(pointProps.get('marker'), ctx),
        explosion: pointProps.num('explosion'),
      }]
    }),
  }
}

function gridlines(el: Element | undefined, ctx: ColorContext): ChartShape | undefined {
  return el ? shape(fields(el.body).get('spPr'), ctx) ?? {} : undefined
}

function axis(kind: ChartAxis['kind'], props: Fields, ctx: ColorContext): ChartAxis {
  const scaling = fields(props.get('scaling')?.body)
  return {
    kind,
    id: props.num('axId'),
    crossAxisId: props.num('crossAx'),
    position: props.val('axPos'),
    deleted: props.bool('delete'),
    orientation: scaling.val('orientation'),
    min: scaling.num('min'),
    max: scaling.num('max'),
    logBase: scaling.num('logBase'),
    majorUnit: props.num('majorUnit'),
    minorUnit: props.num('minorUnit'),
    majorTimeUnit: props.val('majorTimeUnit'),
    minorTimeUnit: props.val('minorTimeUnit'),
    baseTimeUnit: props.val('baseTimeUnit'),
    crosses: props.val('crosses'),
    crossesAt: props.num('crossesAt'),
    crossBetween: props.val('crossBetween'),
    majorTickMark: props.val('majorTickMark'),
    minorTickMark: props.val('minorTickMark'),
    tickLabelPosition: props.val('tickLblPos'),
    tickLabelSkip: props.num('tickLblSkip'),
    tickMarkSkip: props.num('tickMarkSkip'),
    labelOffset: props.num('lblOffset'),
    majorGridlines: gridlines(props.get('majorGridlines'), ctx),
    minorGridlines: gridlines(props.get('minorGridlines'), ctx),
    numberFormat: numberFormat(props.get('numFmt')),
    title: title(props.get('title'), ctx),
    textStyle: textStyle(props.get('txPr'), ctx),
    shape: shape(props.get('spPr'), ctx),
  }
}

const plotKinds = new Map<string, ChartPlot['kind']>([
  ['barChart', 'column'], ['bar3DChart', 'column'],
  ['lineChart', 'line'], ['line3DChart', 'line'],
  ['pieChart', 'pie'], ['pie3DChart', 'pie'],
  ['areaChart', 'area'], ['area3DChart', 'area'],
  ['doughnutChart', 'doughnut'], ['scatterChart', 'scatter'],
])

const axisKinds = new Map<string, ChartAxis['kind']>([
  ['valAx', 'value'], ['catAx', 'category'], ['dateAx', 'date'], ['serAx', 'series'],
])

function plot(kind: ChartPlot['kind'], props: Fields, ctx: ColorContext): ChartPlot {
  const barDir = props.val('barDir')
  return {
    kind: kind === 'column' && barDir === 'bar' ? 'bar' : kind,
    series: props.all('ser').map((el) => series(el, ctx)),
    axisIds: props.all('axId').flatMap((el) => {
      const id = number(attr(el.tag, 'val'))
      return id === undefined ? [] : [id]
    }),
    barDir,
    grouping: props.val('grouping'),
    varyColors: props.bool('varyColors'),
    gapWidth: props.num('gapWidth'),
    overlap: props.num('overlap'),
    holeSize: props.num('holeSize'),
    firstSliceAng: props.num('firstSliceAng'),
    scatterStyle: props.val('scatterStyle'),
    marker: props.bool('marker'),
    smooth: props.bool('smooth'),
    labels: labels(props.get('dLbls'), ctx),
  }
}

export function readChart(xml: string, ctx: ColorContext = { theme: readTheme(''), indexed: [] }): ChartModel {
  const root = children(xml).next().value
  if (root?.name !== 'chartSpace') return { supported: false, kind: 'unknown' }
  const prefix = /^<([\w.-]+):/.exec(root.tag)?.[1]
  const namespace = attr(root.tag, prefix ? `xmlns:${prefix}` : 'xmlns')
  if (namespace && /\b(?:drawingml|drawing)\/(?:\d+\/)+chartex$/i.test(namespace)) {
    return { supported: false, kind: 'chartex' }
  }
  const space = fields(root.body)
  const chart = fields(space.get('chart')?.body)
  const plots: ChartPlot[] = []
  const axes: ChartAxis[] = []
  for (const element of children(chart.get('plotArea')?.body ?? '')) {
    const plotKind = plotKinds.get(element.name)
    const axisKind = axisKinds.get(element.name)
    if (plotKind) plots.push(plot(plotKind, fields(element.body), ctx))
    else if (axisKind) axes.push(axis(axisKind, fields(element.body), ctx))
    else if (element.name.endsWith('Chart')) return { supported: false, kind: element.name as `${string}Chart` }
  }
  if (!plots.length) return { supported: false, kind: 'unknown' }

  const legendEl = chart.get('legend')
  const legend = fields(legendEl?.body)
  return {
    supported: true,
    kind: plots.length > 1 ? 'combo' : plots[0].kind,
    plots,
    axes,
    title: title(chart.get('title'), ctx),
    legend: legendEl ? {
      position: legend.val('legendPos'),
      overlay: legend.bool('overlay'),
      textStyle: textStyle(legend.get('txPr'), ctx),
      shape: shape(legend.get('spPr'), ctx),
      entries: legend.all('legendEntry').flatMap((el) => {
        const entry = fields(el.body)
        const index = entry.num('idx')
        return index === undefined ? [] : [{ index, deleted: entry.bool('delete'), textStyle: textStyle(entry.get('txPr'), ctx) }]
      }),
    } : undefined,
    style: space.num('style'),
    textStyle: textStyle(space.get('txPr'), ctx),
    accentColors: schemeColors.slice(4, 10).flatMap((_, index) => {
      const color = colorOf(`theme="${index + 4}"`, ctx)
      return color ? [color] : []
    }),
    displayBlanksAs: chart.val('dispBlanksAs'),
    plotVisibleOnly: chart.bool('plotVisOnly'),
  }
}
