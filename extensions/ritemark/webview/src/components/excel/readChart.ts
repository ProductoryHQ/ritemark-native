import { attr, decodeXmlEntities } from '../../../../src/excel/sheetXml'
import {
  chartColorVariation, colorOf, readTheme, type ColorContext, type ColorTransform,
} from './excelStyles'
import { drawingPresets } from './drawingColorNames'
import type {
  ChartAxis, ChartData, ChartLabels, ChartMarker, ChartManualLayout, ChartModel, ChartNumberFormat,
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

// Use neutral defaults for system colours when Excel did not save lastClr.
const systemColors = new Map(Object.entries({
  scrollbar: 'C8C8C8', background: '000000', activeCaption: '99B4D1', inactiveCaption: 'BFCDDB',
  menu: 'F0F0F0', window: 'FFFFFF', windowFrame: '646464', menuText: '000000', windowText: '000000',
  captionText: '000000', activeBorder: 'B4B4B4', inactiveBorder: 'F4F7FC', appWorkspace: 'ABABAB',
  highlight: '3399FF', highlightText: 'FFFFFF', btnFace: 'F0F0F0', btnShadow: 'A0A0A0',
  grayText: '6D6D6D', btnText: '000000', inactiveCaptionText: '434E54', btnHighlight: 'FFFFFF',
  '3dDkShadow': '696969', '3dLight': 'E3E3E3', infoText: '000000', infoBk: 'FFFFE1',
  hotLight: '0066CC', gradientActiveCaption: 'B9D1EA', gradientInactiveCaption: 'D7E4F2',
  menuHighlight: '3399FF', menuBar: 'F0F0F0',
}))

/** Translate DrawingML's colour attributes to the shared workbook colour resolver. */
function drawingColor(fill: Element | undefined, ctx: ColorContext): string | undefined {
  const color = children(fill?.body ?? '').next().value
  if (!color) return undefined
  const value = attr(color.tag, 'val') ?? ''
  const scheme = color.name === 'schemeClr' ? schemeColors.indexOf(schemeAliases[value] ?? value) : -1
  const preset = value.replace(/^(dk|lt|med)(?=[A-Z])/, (prefix) =>
    prefix === 'dk' ? 'dark' : prefix === 'lt' ? 'light' : 'medium').toLowerCase()
  const rgb = color.name === 'srgbClr' ? value
    : color.name === 'sysClr' ? attr(color.tag, 'lastClr') ?? systemColors.get(value)
    : color.name === 'prstClr' ? drawingPresets.get(preset) : undefined
  if (scheme < 0 && !rgb) return undefined
  const transforms: ColorTransform[] = []
  for (const { name, tag } of children(color.body)) {
    if (name !== 'lumMod' && name !== 'lumOff' && name !== 'satMod' && name !== 'shade' && name !== 'tint') continue
    const value = number(attr(tag, 'val'))
    if (value !== undefined) transforms.push({ kind: name, value: value / 100_000 })
  }
  return colorOf(scheme >= 0 ? `theme="${scheme}"` : `rgb="${rgb}"`, ctx, transforms)
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
    hasLine: line ? true : undefined,
    lineWidth: width === undefined ? undefined : width / 9525,
    dash: lineProps.val('prstDash'),
    noFill: props.get('noFill') ? true : undefined,
    noLine: lineProps.get('noFill') ? true : undefined,
  }
}

function runStyle(pr: Element | undefined, ctx: ColorContext): ChartTextStyle | undefined {
  if (!pr) return undefined
  const style = fields(pr.body)
  const size = number(attr(pr.tag, 'sz'))
  return {
    size: size === undefined || size <= 0 ? undefined : size / 100,
    bold: bool(attr(pr.tag, 'b')),
    italic: bool(attr(pr.tag, 'i')),
    font: attr(style.get('latin')?.tag ?? '', 'typeface'),
    color: drawingColor(style.get('solidFill'), ctx),
  }
}

function paragraphStyle(list: Fields, paragraph: Fields, ctx: ColorContext): ChartTextStyle | undefined {
  const props = paragraph.get('pPr')
  const level = number(attr(props?.tag ?? '', 'lvl')) ?? 0
  const defaults = (el?: Element) => runStyle(fields(el?.body).get('defRPr'), ctx)
  return mergeTextStyles(defaults(list.get('defPPr')), defaults(list.get(`lvl${level + 1}pPr`)), defaults(props))
}

function bodyStyle(props: Fields): ChartTextStyle | undefined {
  const rotation = number(attr(props.get('bodyPr')?.tag ?? '', 'rot'))
  return rotation === undefined || Math.abs(rotation) > 5_400_000 ? undefined : { rotation: rotation / 60_000 }
}

function textStyle(container: Element | undefined, ctx: ColorContext): ChartTextStyle | undefined {
  const props = fields(container?.body)
  const para = fields(props.get('p')?.body)
  return mergeTextStyles(
    runStyle(para.get('endParaRPr'), ctx),
    paragraphStyle(fields(props.get('lstStyle')?.body), para, ctx),
    bodyStyle(props),
  )
}

function manualLayout(props: Fields): ChartManualLayout | undefined {
  const manual = fields(props.get('layout')?.body).get('manualLayout')
  if (!manual) return undefined
  const layout = fields(manual.body)
  return {
    target: layout.val('layoutTarget'),
    xMode: layout.val('xMode'), yMode: layout.val('yMode'),
    widthMode: layout.val('wMode'), heightMode: layout.val('hMode'),
    x: layout.num('x'), y: layout.num('y'),
    width: layout.num('w'), height: layout.num('h'),
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

/** Read the drawing card title from the chart itself, preferring rich text to ChartEx text data. */
export function chartTitle(xml: string): string | undefined {
  const root = children(xml).next().value
  if (root?.name !== 'chartSpace') return undefined
  const title = fields(fields(root.body).get('chart')?.body).get('title')?.body ?? ''
  const rich = richTitleText(title)
  if (rich) return rich
  const tx = fields(title).get('tx')
  const txData = fields(tx?.body).get('txData')
  return fields(txData?.body).text('v')?.trim() || undefined
}

function richTitleText(body: string): string | undefined {
  const words = [...body.matchAll(/<(?:[\w.-]+:)?t(?=[\s>])[^>]*>([^<]*)<\/(?:[\w.-]+:)?t>|<(?:[\w.-]+:)?(?:p|br)(?=[\s/>])[^>]*>/g)]
    .map((match) => match[1] === undefined ? ' ' : decodeXmlEntities(match[1])).join('').trim()
  return words || undefined
}

function mergeTextStyles(...styles: (ChartTextStyle | undefined)[]): ChartTextStyle | undefined {
  const entries = styles.flatMap((style) => Object.entries(style ?? {}).filter(([, value]) => value !== undefined))
  return entries.length ? Object.fromEntries(entries) : undefined
}

function title(el: Element | undefined, ctx: ColorContext): ChartTitle | undefined {
  if (!el) return undefined
  const props = fields(el.body)
  const tx = props.get('tx')
  const rich = fields(tx?.body).get('rich')
  const reference = rich ? undefined : data(tx)
  const richProps = fields(rich?.body)
  const list = fields(richProps.get('lstStyle')?.body)
  const paragraphs = richProps.all('p')
  const runs = paragraphs.flatMap((p, index) => {
    const para = fields(p.body)
    const style = paragraphStyle(list, para, ctx)
    return [
      ...(index ? [{ text: ' ' }] : []),
      ...para.elements.flatMap((run) => {
        if (run.name === 'br') return [{ text: ' ', style }]
        if (run.name !== 'r' && run.name !== 'fld') return []
        const props = fields(run.body)
        return [{ text: props.text('t') ?? '', style: mergeTextStyles(style, runStyle(props.get('rPr'), ctx)) }]
      }),
    ]
  })
  // Keep the existing single-line title, including its outer whitespace trimming.
  while (runs.length && !runs[0].text.trim()) runs.shift()
  while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop()
  if (runs.length) {
    runs[0].text = runs[0].text.trimStart()
    runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd()
  }
  return {
    text: rich ? runs.map((run) => run.text).join('') || undefined : reference?.points.get(0)?.toString(),
    reference,
    automatic: !tx || undefined,
    runs: rich ? runs : undefined,
    style: mergeTextStyles(textStyle(props.get('txPr'), ctx), bodyStyle(richProps)),
    overlay: props.bool('overlay'),
    layout: manualLayout(props),
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

function automaticSeriesColor(index: number, ctx: ColorContext): string | undefined {
  return colorOf(`theme="${4 + index % 6}"`, ctx, chartColorVariation(Math.floor(index / 6)))
}

export function readChart(xml: string, ctx: ColorContext = { theme: readTheme(''), indexed: [] }, extended = false): ChartModel {
  const root = children(xml).next().value
  if (root?.name !== 'chartSpace') return { supported: false, kind: extended ? 'chartex' : 'unknown' }
  const prefix = /^<([\w.-]+):/.exec(root.tag)?.[1]
  const namespace = attr(root.tag, prefix ? `xmlns:${prefix}` : 'xmlns')
  if (extended || namespace && /\b(?:drawingml|drawing)\/(?:\d+\/)+chartex$/i.test(namespace)) {
    const chart = fields(fields(root.body).get('chart')?.body)
    const regions = fields(chart.get('plotArea')?.body).all('plotAreaRegion')
    const extendedKinds = [...new Set(regions.flatMap((region) => fields(region.body).all('series').flatMap((series) => {
      const kind = attr(series.tag, 'layoutId')
      return kind ? [kind] : []
    })))]
    return { supported: false, kind: 'chartex', ...(extendedKinds.length ? { extendedKinds } : {}) }
  }
  const space = fields(root.body)
  const chart = fields(space.get('chart')?.body)
  const plotArea = fields(chart.get('plotArea')?.body)
  const plots: ChartPlot[] = []
  const axes: ChartAxis[] = []
  for (const element of plotArea.elements) {
    const plotKind = plotKinds.get(element.name)
    const axisKind = axisKinds.get(element.name)
    if (plotKind) {
      const parsed = plot(plotKind, fields(element.body), ctx)
      if (element.name === 'line3DChart') {
        // Excel styles the ribbon as a filled surface. Use that fill for the flat line.
        for (const entry of parsed.series) {
          const ribbon = entry.shape
          if (ribbon && !ribbon.noFill && (ribbon.noLine || !ribbon.line)) {
            entry.shape = { line: ribbon.fill }
          }
        }
      }
      plots.push(parsed)
    }
    else if (axisKind) axes.push(axis(axisKind, fields(element.body), ctx))
    else if (element.name.endsWith('Chart')) return { supported: false, kind: element.name as `${string}Chart` }
  }
  if (!plots.length) return { supported: false, kind: 'unknown' }

  const orderedSeries = plots.flatMap((plot) => plot.series).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  orderedSeries.forEach((entry, index) => {
    entry.automaticColor = automaticSeriesColor(index, ctx)
  })
  const legendEl = chart.get('legend')
  const legend = fields(legendEl?.body)
  return {
    supported: true,
    kind: plots.length > 1 ? 'combo' : plots[0].kind,
    plots,
    axes,
    plotLayout: manualLayout(plotArea),
    plotShape: shape(plotArea.get('spPr'), ctx),
    chartShape: shape(space.get('spPr'), ctx),
    title: title(chart.get('title'), ctx),
    legend: legendEl ? {
      layout: manualLayout(legend),
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
