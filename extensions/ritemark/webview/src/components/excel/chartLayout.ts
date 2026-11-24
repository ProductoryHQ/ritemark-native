import type { ChartAxis, ChartData, ChartLabels, ChartMarker, ChartModel, ChartShape, ChartTextStyle, ChartTitle, ChartSeries, ChartValue, PlotKind } from './chartModel'
import { formatCellValue } from './numberFormat'

type DrawableChart = Extract<ChartModel, { supported: true }> & { kind: PlotKind }
export function drawsChart(chart: ChartModel | undefined): chart is DrawableChart {
  if (!chart?.supported || chart.kind === 'combo') return false
  const axisIds = chart.plots[0]?.axisIds
  const valueAxes = chart.axes.filter(({ id, kind }) => kind === 'value' && axisIds?.includes(id ?? -1))
  return valueAxes.length <= (chart.kind === 'scatter' ? 2 : 1)
}

interface Point { x: number; y: number }
interface Rect extends Point { width: number; height: number }
interface Text extends Point {
  text: string
  anchor?: 'start' | 'middle' | 'end'
  style: ChartTextStyle
}
interface Rule {
  from: Point
  to: Point
  shape?: ChartShape
}
interface Mark extends Point {
  marker: ChartMarker
  color: string
}
interface LegendEntry {
  label: Text
  key: Rect
  color: string
  shape?: ChartShape
  marker?: ChartMarker
  lineKey?: boolean
}
export interface ChartLayout {
  width: number
  height: number
  name: string
  plot: Rect
  plotShape?: ChartShape
  chartShape?: ChartShape
  categoryBand: number
  scale: { min: number; max: number; step: number; ticks: number[] }
  xScale?: ChartLayout['scale']
  emptyReason?: string
  slices?: Slice[]
  areas?: { segments: { top: Point[]; base: Point[] }[]; color: string; shape?: ChartShape }[]
  leaders?: Rule[]
  bars: (Rect & { index: number; series: number; from: number; to: number; color: string; shape?: ChartShape })[]
  lines: { segments: Point[][]; shape?: ChartShape; color: string; smooth?: boolean }[]
  markers: Mark[]
  gridlines: Rule[]
  axes: Rule[]
  axisLabels: Text[]
  titles: Text[]
  dataLabels: (Text & { shape?: ChartShape; width: number; height: number; keyColor?: string })[]
  legend?: { position: string; bounds: Rect; shape?: ChartShape; entries: LegendEntry[] }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const px = (pt: number) => pt * 4 / 3
const hideLabels = (axis?: ChartAxis) => axis?.deleted || axis?.tickLabelPosition === 'none'

function niceStep(span: number, divisions: number): number {
  const raw = span / divisions
  const power = 10 ** Math.floor(Math.log10(raw))
  return power * ([1, 2, 2.5, 5, 10].find((n) => n * power >= raw * (1 - 1e-12)) ?? 10)
}

function valueScale(low: number, high: number, axis: ChartAxis | undefined, percent: boolean, line: boolean, pixels: number, padding = .08) {
  const log = axis?.logBase
  if (log && log > 1) {
    const min = axis.min && axis.min > 0 ? axis.min : log ** Math.floor(Math.log(low > 0 ? low : 1) / Math.log(log))
    const max = axis.max && axis.max > min ? axis.max : Math.max(min * log, log ** Math.ceil(Math.log(high > 0 ? high : 1) / Math.log(log)))
    const ticks: number[] = []
    for (let i = Math.ceil(Math.log(min) / Math.log(log) - 1e-9); ticks.length < 100 && log ** i <= max * (1 + 1e-9); i++) ticks.push(log ** i)
    return { min, max, step: log, ticks }
  }
  const extent = high - low || Math.abs(high) || 1
  const autoMin = percent ? (low < 0 ? -1 : 0)
    : line && low > high / 2 && low > 0 ? Math.max(0, low - extent / 2) : low < 0 ? low - extent * padding : 0
  const autoMax = percent ? (high > 0 || low === 0 ? 1 : 0)
    : line && high < low / 2 && high < 0 ? Math.min(0, high + extent / 2) : high > 0 ? high + extent * padding : low < 0 ? 0 : 1
  const lower = axis?.min ?? autoMin
  const upper = axis?.max ?? autoMax
  const span = upper > lower ? upper - lower : extent
  const divisions = clamp(Math.round(pixels / 19), 3, 10)
  const step = axis?.majorUnit && axis.majorUnit > 0 ? axis.majorUnit
    : percent ? .1 : niceStep(span, divisions)
  const min = axis?.min ?? Number((Math.floor(lower / step + 1e-10) * step).toPrecision(14))
  const suggestedMax = axis?.max ?? Number((Math.ceil(upper / step - 1e-10) * step).toPrecision(14))
  const max = suggestedMax > min ? suggestedMax : min + step
  const ticks: number[] = []
  for (let i = 0; i < 500; i++) {
    const tick = Number((min + i * step).toPrecision(14))
    if (tick > max + step * 1e-9) break
    ticks.push(tick)
  }
  return { min, max, step, ticks }
}

function valueText(value: ChartValue | undefined, code: string | undefined, date1904: boolean): string {
  if (value === undefined) return ''
  return typeof value === 'number' ? formatCellValue(value, code ?? 'General', date1904).text : String(value)
}

function titleText(title?: ChartTitle): string {
  const value = title?.text ?? title?.reference?.points.get(0)
  return value === undefined ? '' : String(value)
}

function countOf(data?: ChartData): number {
  let count = data?.pointCount ?? 0
  for (const i of data?.points.keys() ?? []) count = Math.max(count, i + 1)
  return count
}

function mergeDefined<T extends object>(...layers: (T | undefined)[]): T {
  return Object.assign({}, ...layers.map((layer) => Object.fromEntries(
    Object.entries(layer ?? {}).filter(([, value]) => value !== undefined),
  )))
}

type LabelOverrides = Map<number, ChartLabels & { text?: ChartTitle }>

function labelsFor(entry: ChartSeries, plotLabels?: ChartLabels): LabelOverrides | undefined {
  if (!plotLabels && !entry.labels) return undefined
  const overrides: LabelOverrides = new Map()
  for (const label of [...(plotLabels?.entries ?? []), ...(entry.labels?.entries ?? [])]) {
    overrides.set(label.index, mergeDefined(overrides.get(label.index), label))
  }
  return overrides
}

function styleOf(size: number, ...styles: (ChartTextStyle | undefined)[]): ChartTextStyle {
  return mergeDefined({ size, color: '#595959' }, ...styles)
}

function boundsByCategory(series: readonly ChartSeries[], stacked: boolean, percent: boolean, blanksAsZero: boolean, line: boolean, count: number) {
  const totals = new Map<number, number>()
  if (percent) {
    for (const entry of series) for (const [index, value] of entry.val?.points ?? []) {
      if (typeof value === 'number' && Number.isFinite(value)) totals.set(index, (totals.get(index) ?? 0) + Math.abs(value))
    }
  }
  const positive = new Map<number, number>()
  const negative = new Map<number, number>()
  let low = Infinity
  let high = -Infinity
  const points = series.map((entry) => {
    const values = new Map<number, { raw: number; from: number; to: number }>()
    const add = (index: number, raw: ChartValue) => {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return
      const value = percent ? raw / (totals.get(index) || 1) : raw
      const stack = !line && value < 0 ? negative : positive
      const from = stacked ? stack.get(index) ?? 0 : 0
      const to = from + value
      if (stacked) stack.set(index, to)
      low = Math.min(low, to)
      high = Math.max(high, to)
      values.set(index, { raw, from, to })
    }
    for (const [index, raw] of entry.val?.points ?? []) add(index, raw)
    if (blanksAsZero && stacked && values.size < count) {
      // Empty points inherit the running total. Keep categories with no total sparse.
      for (const [index, total] of positive) {
        if (!values.has(index) && total !== 0) add(index, 0)
      }
    }
    if (blanksAsZero && values.size < count) {
      low = Math.min(low, 0)
      high = Math.max(high, 0)
    }
    return values
  })
  return { points, low: Number.isFinite(low) ? low : 0, high: Number.isFinite(high) ? high : 0 }
}

/** Keep extrema in each bucket, at their original category coordinates. */
function sampledIndices(values: ReadonlyMap<number, { to: number }>, count: number): number[] {
  if (count <= 5000) return Array.from({ length: count }, (_, index) => index)
  const buckets = new Map<number, { min: number; max: number }>()
  for (const [index, value] of values) {
    const bucket = Math.floor(index * 2499 / count)
    const previous = buckets.get(bucket)
    if (!previous) buckets.set(bucket, { min: index, max: index })
    else {
      if (value.to < values.get(previous.min)!.to) previous.min = index
      if (value.to > values.get(previous.max)!.to) previous.max = index
    }
  }
  return [...new Set([0, count - 1, ...Array.from(buckets.values()).flatMap(({ min, max }) => [min, max])])].sort((a, b) => a - b)
}

type Measure = (text: string, style: ChartTextStyle) => number

interface LegendItem {
  name: string
  color: string
  shape?: ChartShape
  marker?: ChartMarker
  lineKey?: boolean
  index: number
}

function layoutLegend(model: DrawableChart, entries: LegendItem[],
  width: number, height: number, pad: number, titleBottom: number, measure: Measure): ChartLayout['legend'] {
  const legend = model.legend
  if (!legend) return undefined
  const position = legend.position ?? 'r'
  const side = ['l', 'r', 'tr'].includes(position)
  const rows: LegendEntry[][] = []
  const sizes: { width: number; height: number }[] = []
  for (const entry of entries) {
    const override = legend.entries.find(({ index }) => index === entry.index)
    if (override?.deleted) continue
    const style = styleOf(9, model.textStyle, legend.textStyle, override?.textStyle)
    const keyWidth = model.kind === 'line' || entry.lineKey ? 24 : 7
    const w = measure(entry.name, style) + keyWidth + 4
    const h = px(style.size ?? 9) + 4
    let row = sizes[sizes.length - 1]
    if (!row || side || row.width + w + 10 > width - 2 * pad) {
      row = { width: 0, height: 0 }
      sizes.push(row)
      rows.push([])
    }
    const x = row.width ? row.width + 10 : 0
    rows[rows.length - 1].push({
      color: entry.color, shape: entry.shape, marker: entry.marker, lineKey: entry.lineKey,
      key: { x, y: 0, width: keyWidth, height: 7 },
      label: { x: x + keyWidth + 4, y: 0, text: entry.name, style },
    })
    row.width = x + w
    row.height = Math.max(row.height, h)
  }
  const w = sizes.reduce((max, row) => Math.max(max, row.width), 0)
  const h = sizes.reduce((sum, row) => sum + row.height, 0)
  const x = position === 'l' ? pad : side ? width - pad - w : (width - w) / 2
  const y = position === 'b' ? height - pad - h : position === 't' || position === 'tr' ? titleBottom
    : Math.max(titleBottom, (height - h) / 2)
  let nextY = y
  rows.forEach((row, index) => {
    const offset = x + (side ? 0 : (w - sizes[index].width) / 2)
    const center = nextY + sizes[index].height / 2
    for (const entry of row) {
      entry.key.x += offset
      entry.key.y = center - entry.key.height / 2
      entry.label.x += offset
      entry.label.y = center
    }
    nextY += sizes[index].height
  })
  return { position, bounds: { x, y, width: w, height: h }, shape: legend.shape, entries: rows.flat() }
}

export function layoutChart(model: DrawableChart, resolved: readonly ChartSeries[], width: number, height: number,
  measure: Measure, date1904 = false): ChartLayout {
  const plotModel = model.plots[0]
  const horizontal = model.kind === 'bar'
  const line = model.kind === 'line'
  const area = model.kind === 'area'
  const scatter = model.kind === 'scatter'
  const circular = model.kind === 'pie' || model.kind === 'doughnut'
  const scatterStyle = plotModel.scatterStyle ?? 'marker'
  const scatterLines = scatter && ['line', 'lineMarker', 'smooth', 'smoothMarker'].includes(scatterStyle)
  const scatterMarkers = scatter && ['marker', 'lineMarker', 'smoothMarker'].includes(scatterStyle)
  const percent = plotModel.grouping === 'percentStacked'
  const stacked = percent || plotModel.grouping === 'stacked'
  const blanksAsZero = model.displayBlanksAs === 'zero' && (line || area || scatter)
  const series = [...resolved].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const category = series.find((entry) => countOf(entry.cat))?.cat
  const categoryCount = series.reduce((max, entry) => Math.max(max, countOf(entry.cat), countOf(entry.val)), 1)
  const axes = model.axes.filter((axis) => plotModel.axisIds.includes(axis.id ?? -1))
  const numericAxes = axes.filter((axis) => axis.kind === 'value')
  const xAxis = scatter ? numericAxes.find(({ position }) => position === 'b' || position === 't')
    ?? numericAxes.find(({ position }) => position !== 'l' && position !== 'r') ?? numericAxes[0] : undefined
  const valueAxis = numericAxes.find((axis) => axis !== xAxis)
  const categoryAxis = scatter ? xAxis : axes.find((axis) => axis.kind === 'category' || axis.kind === 'date')
  const { points, low, high } = boundsByCategory(series, stacked, percent, blanksAsZero, line, categoryCount)
  const xy = scatter ? series.map((entry) => scatterPoints(entry, blanksAsZero)) : []
  const pad = Math.min(12, width / 10, height / 10)
  const entries = series.map((entry, index) => {
    const shape = entry.shape
    const automatic = entry.automaticColor ?? model.accentColors[index % model.accentColors.length] ?? '#4472C4'
    const color = (line || scatter ? shape?.line : shape?.fill) ?? automatic
    const marker = entry.marker?.symbol !== 'none' && (scatterMarkers || line && (entry.marker?.symbol || plotModel.marker))
      ? entry.marker ?? {} : undefined
    const name = valueText(entry.tx?.points.get(0), entry.tx?.formatCode, date1904) || `Series ${index + 1}`
    return { name, color, marker, shape, lineKey: scatter ? scatterLines && !shape?.noLine : undefined, index: entry.index ?? index }
  })
  const title = model.title?.automatic ? (entries.length === 1 ? entries[0].name : 'Chart Title') : titleText(model.title)
  const titleStyle = mergeDefined({ size: 16, bold: true, color: '#222222' }, model.textStyle, model.title?.style)
  const titleHeight = title ? px(titleStyle.size ?? 16) + 10 : 0
  const titleBottom = pad + (model.title?.overlay ? 0 : titleHeight)
  const pieCategories = circular ? sliceCategories(model, series, entries, date1904) : []
  const legendItems = circular ? pieCategories : horizontal && !stacked ? [...entries].reverse() : entries
  const legend = layoutLegend(model, legendItems, width, height, pad, titleBottom, measure)
  const reserve = (positions: string[], size: 'width' | 'height') =>
    legend && !model.legend?.overlay && positions.includes(legend.position) ? legend.bounds[size] + 8 : 0
  const top = titleBottom + reserve(['t'], 'height')
  let bottom = height - pad - reserve(['b'], 'height')
  let left = pad + reserve(['l'], 'width')
  let right = width - pad - reserve(['r', 'tr'], 'width')
  const makeLayout = (plot: Rect, scale: ChartLayout['scale']): ChartLayout => ({
    width, height, name: model.kind[0].toUpperCase() + model.kind.slice(1) + ' chart' + (title ? `: ${title}` : ''),
    plot, plotShape: model.plotShape, chartShape: model.chartShape, categoryBand: 0, scale, bars: [], lines: [], markers: [], gridlines: [], axes: [], axisLabels: [],
    titles: title ? [{ x: width / 2, y: pad + px(titleStyle.size ?? 16) / 2, text: title, anchor: 'middle', style: titleStyle }] : [],
    dataLabels: [], legend,
  })
  if (circular) {
    const layout = makeLayout({ x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
      { min: 0, max: 1, step: 1, ticks: [] })
    layoutSlices(layout, model, series, entries, pieCategories, measure, date1904)
    return layout
  }
  const xRange = numericExtent(xy, 'x')
  const yRange = numericExtent(xy, 'y')
  const xScale = scatter ? valueScale(xRange.min, xRange.max, xAxis, false, false, (right - left) / 3, .05) : undefined
  const count = xScale ? xScale.ticks.length : categoryCount
  const labelStyle = (axis?: ChartAxis) => styleOf(9, model.textStyle, axis?.textStyle)
  const categoryStyle = labelStyle(categoryAxis)
  const valueStyle = labelStyle(valueAxis)
  const textHeight = (style: ChartTextStyle) => px(style.size ?? 9)
  const categoryText = (index: number) => xScale
    ? valueText(xScale.ticks[index], xAxis?.numberFormat?.formatCode ?? series[0]?.xVal?.formatCode, date1904)
    : valueText(category?.points.get(index) ?? (category ? undefined : index + 1),
    categoryAxis?.numberFormat?.formatCode === 'General' ? category?.formatCode : categoryAxis?.numberFormat?.formatCode ?? category?.formatCode, date1904)
  const scale = valueScale(scatter ? yRange.min : low, scatter ? yRange.max : high, valueAxis, percent, line, horizontal ? right - left : bottom - top - 20, scatter ? .05 : .08)
  const valueCode = valueAxis?.numberFormat?.formatCode ?? (percent ? '0%' : (scatter ? series[0]?.yVal : series[0]?.val)?.formatCode)
  const valueLabel = (n: number) => valueText(n, valueCode, date1904)
  const valueWidth = scale.ticks.reduce((max, n) => Math.max(max, measure(valueLabel(n), valueStyle)), 0)
  const sampleStride = Math.max(1, Math.ceil(count / 5000))
  let categoryWidth = 0
  for (let i = 0; i < count; i += sampleStride) categoryWidth = Math.max(categoryWidth, measure(categoryText(i), categoryStyle))
  const categoryTitleStyle = styleOf(10, model.textStyle, categoryAxis?.title?.style)
  const valueTitleStyle = styleOf(10, model.textStyle, valueAxis?.title?.style)
  const categoryTitle = categoryAxis?.deleted ? '' : titleText(categoryAxis?.title)
  const valueTitle = valueAxis?.deleted ? '' : titleText(valueAxis?.title)
  const verticalTitleSpace = horizontal ? categoryTitle && textHeight(categoryTitleStyle) + 6 : valueTitle && textHeight(valueTitleStyle) + 6
  const horizontalTitleSpace = horizontal ? valueTitle && textHeight(valueTitleStyle) + 6 : categoryTitle && textHeight(categoryTitleStyle) + 6
  const verticalAxis = horizontal ? categoryAxis : valueAxis
  const horizontalAxis = horizontal ? valueAxis : categoryAxis
  const verticalLabelWidth = Math.min(width * .35, horizontal ? categoryWidth : valueWidth) + 8
  const verticalLabelsRight = verticalAxis?.tickLabelPosition === 'high' || (verticalAxis?.position === 'r' && verticalAxis.tickLabelPosition !== 'low')
  const horizontalLabelsTop = horizontalAxis?.tickLabelPosition === 'high' || (horizontalAxis?.position === 't' && horizontalAxis.tickLabelPosition !== 'low')
  const verticalLabels = hideLabels(verticalAxis) ? 0 : verticalLabelWidth
  left += Number(verticalTitleSpace) + (verticalLabelsRight ? 0 : verticalLabels)
  right -= verticalLabelsRight ? verticalLabels : horizontal ? valueWidth / 2 : 0
  const between = !scatter && (area ? valueAxis?.crossBetween === 'between' || count === 1
    : !line || valueAxis?.crossBetween !== 'midCat' || count === 1)
  const availableBand = Math.max(1, right - left) / Math.max(1, between ? count : count - 1)
  const categoryHeight = textHeight(categoryStyle)
  const autoTilt = !scatter && !horizontal && !hideLabels(categoryAxis) && categoryStyle.rotation === undefined
    && categoryWidth + 5 > availableBand * (categoryAxis?.tickLabelSkip ?? 1)
  if (autoTilt) categoryStyle.rotation = -45
  const angle = (categoryStyle.rotation ?? 0) * Math.PI / 180
  const tiltedHeight = categoryWidth * Math.abs(Math.sin(angle)) + categoryHeight * Math.abs(Math.cos(angle))
  const horizontalLabels = hideLabels(horizontalAxis) ? 0
    : (horizontal ? textHeight(valueStyle) : Math.min(tiltedHeight, Math.max(categoryHeight, (bottom - top) / 2))) + 8
  const plotTop = top + (horizontalLabelsTop ? horizontalLabels : 0)
  bottom -= Number(horizontalTitleSpace) + (horizontalLabelsTop ? 0 : horizontalLabels)
  const plot = { x: left, y: plotTop, width: Math.max(1, right - left), height: Math.max(1, bottom - plotTop) }
  const layout = makeLayout(plot, scale)
  layout.xScale = xScale

  const categoryLength = horizontal ? plot.height : plot.width
  const valueLength = horizontal ? plot.width : plot.height
  const band = categoryLength / Math.max(1, between ? count : count - 1)
  layout.categoryBand = band
  const categoryReversed = (categoryAxis?.orientation === 'maxMin') !== horizontal
  const categoryDirection = categoryReversed ? -1 : 1
  const xAt = (x: number) => {
    const fraction = axisFraction(x, xScale!, xAxis)
    return (categoryReversed ? 1 - fraction : fraction) * categoryLength
  }
  const categoryAt = (i: number) => xScale ? xAt(xScale.ticks[i])
    : ((categoryReversed ? count - 1 - i : i) + (between ? .5 : 0)) * band
  const log = valueAxis?.logBase && valueAxis.logBase > 1
  const unit = log ? Math.log : (v: number) => v
  const valueAt = (v: number) => {
    const fraction = (unit(log ? Math.max(v, Number.MIN_VALUE) : v) - unit(scale.min)) / (unit(scale.max) - unit(scale.min))
    return (valueAxis?.orientation === 'maxMin' ? 1 - fraction : fraction) * valueLength
  }
  const point = (cat: number, val: number): Point => horizontal
    ? { x: left + val, y: plotTop + cat }
    : { x: left + cat, y: plotTop + plot.height - val }
  const rule = (from: Point, to: Point, shape?: ChartShape): Rule => ({ from, to, shape })
  const valueRule = (position: number, shape?: ChartShape) => rule(point(0, position), point(categoryLength, position), shape)
  const categoryRule = (position: number, shape?: ChartShape) => rule(point(position, 0), point(position, valueLength), shape)
  const crossValue = categoryAxis?.crossesAt ?? (categoryAxis?.crosses === 'max' ? scale.max : categoryAxis?.crosses === 'min' ? scale.min : 0)
  const crossBase = clamp(crossValue, scale.min, scale.max)
  const baseline = valueAt(crossBase)
  const crossCategory = valueAxis?.crossesAt ?? (valueAxis?.crosses === 'max' ? count : 1)
  const categoryCross = xScale
    ? xAt(clamp(valueAxis?.crossesAt ?? (valueAxis?.crosses === 'max' ? xScale.max : valueAxis?.crosses === 'min' ? xScale.min : 0), xScale.min, xScale.max))
    : valueAxis?.crossesAt === undefined
    ? ((valueAxis?.crosses === 'max') !== categoryReversed ? categoryLength : 0)
    : clamp(categoryAt(crossCategory - 1) - (between ? categoryDirection * band / 2 : 0), 0, categoryLength)
  if (categoryAxis && !categoryAxis.deleted) layout.axes.push(valueRule(baseline, categoryAxis.shape))
  if (valueAxis && !valueAxis.deleted) layout.axes.push(categoryRule(categoryCross, valueAxis.shape))
  const axisTick = (at: Point, axis: ChartAxis | undefined, horizontalRule: boolean, minor = false) => {
    const mark = minor ? axis?.minorTickMark : axis?.majorTickMark
    if (!axis || axis.deleted || !mark || mark === 'none') return
    const size = minor ? 2 : 4
    const sign = axis.position === 't' || axis.position === 'l' ? -1 : 1
    const shift = (n: number) => ({ x: at.x + (horizontalRule ? 0 : sign * n), y: at.y + (horizontalRule ? sign * n : 0) })
    layout.axes.push(rule(shift(mark === 'in' || mark === 'cross' ? -size : 0), shift(mark === 'out' || mark === 'cross' ? size : 0), axis.shape))
  }
  const valueLabelCross = valueAxis?.tickLabelPosition === 'high' || valueAxis?.tickLabelPosition === 'low'
    ? (horizontal ? (horizontalLabelsTop ? 0 : categoryLength) : (verticalLabelsRight ? categoryLength : 0))
    : categoryCross
  const categoryLabelCross = categoryAxis?.tickLabelPosition === 'high' || categoryAxis?.tickLabelPosition === 'low'
    ? (horizontal ? (verticalLabelsRight ? valueLength : 0) : (horizontalLabelsTop ? valueLength : 0))
    : baseline
  const showValueAt = (tick: number, minor: boolean) => {
    const v = valueAt(tick)
    const grid = minor ? valueAxis?.minorGridlines : valueAxis?.majorGridlines
    if (grid) layout.gridlines.push(valueRule(v, grid))
    axisTick(point(categoryCross, v), valueAxis, horizontal, minor)
  }
  const minorUnit = valueAxis?.minorUnit ?? scale.step / 5
  if (!log && minorUnit > 0 && (valueAxis?.minorGridlines || (valueAxis?.minorTickMark && valueAxis.minorTickMark !== 'none'))) {
    for (let i = 1; i <= 500; i++) {
      const offset = i * minorUnit
      if (offset >= scale.max - scale.min) break
      if (Math.abs(offset / scale.step - Math.round(offset / scale.step)) > 1e-8) showValueAt(scale.min + offset, true)
    }
  }
  for (const tick of scale.ticks) {
    showValueAt(tick, false)
    if (hideLabels(valueAxis)) continue
    const at = point(valueLabelCross, valueAt(tick))
    layout.axisLabels.push(horizontal
      ? { ...at, y: at.y + (horizontalLabelsTop ? -1 : 1) * (textHeight(valueStyle) / 2 + 6), text: valueLabel(tick), anchor: 'middle', style: valueStyle }
      : { ...at, x: at.x + (verticalLabelsRight ? 7 : -7), text: valueLabel(tick), anchor: verticalLabelsRight ? 'start' : 'end', style: valueStyle })
  }
  const categorySpacing = horizontal ? categoryHeight : Math.min(
    categoryWidth * Math.abs(Math.cos(angle)) + categoryHeight * Math.abs(Math.sin(angle)),
    Math.abs(Math.sin(angle)) > 0 ? categoryHeight / Math.abs(Math.sin(angle)) : Infinity,
  )
  const skip = Math.max(1, categoryAxis?.tickLabelSkip ?? Math.ceil((categorySpacing + 5) / band))
  for (let i = 0; !hideLabels(categoryAxis) && i < count; i += Math.max(skip, sampleStride)) {
    const at = point(categoryAt(i), categoryLabelCross)
    const text = categoryText(i)
    if (!text) continue
    if (horizontal) {
      layout.axisLabels.push({ ...at, x: at.x + (verticalLabelsRight ? 7 : -7), text,
        anchor: verticalLabelsRight ? 'start' : 'end', style: categoryStyle })
    } else {
      const labelWidth = measure(text, categoryStyle)
      const halfWidth = Math.min(width / 2, (labelWidth * Math.abs(Math.cos(angle)) + categoryHeight * Math.abs(Math.sin(angle))) / 2)
      const halfHeight = (labelWidth * Math.abs(Math.sin(angle)) + categoryHeight * Math.abs(Math.cos(angle))) / 2
      const x = clamp(at.x, halfWidth, width - halfWidth)
      const y = at.y + (horizontalLabelsTop ? -1 : 1) * (halfHeight + 6)
      layout.axisLabels.push({ x, y, text, anchor: 'middle', style: categoryStyle })
    }
  }
  if (xScale && xAxis && !(xAxis.logBase && xAxis.logBase > 1) &&
    (xAxis.minorGridlines || (xAxis.minorTickMark && xAxis.minorTickMark !== 'none'))) {
    const minor = xAxis.minorUnit ?? xScale.step / 5
    for (let i = 1; minor > 0 && i <= 500; i++) {
      const offset = i * minor
      if (offset >= xScale.max - xScale.min) break
      if (Math.abs(offset / xScale.step - Math.round(offset / xScale.step)) <= 1e-8) continue
      const at = xAt(xScale.min + offset)
      if (xAxis.minorGridlines) layout.gridlines.push(categoryRule(at, xAxis.minorGridlines))
      axisTick(point(at, baseline), xAxis, true, true)
    }
  }
  if (categoryAxis && (categoryAxis.majorGridlines || categoryAxis.majorTickMark && categoryAxis.majorTickMark !== 'none')) {
    const marks = count + (between ? 1 : 0)
    for (let i = 0; i < marks; i += Math.max(sampleStride, categoryAxis.tickMarkSkip ?? 1)) {
      const at = scatter ? categoryAt(i) : i * band
      if (categoryAxis.majorGridlines) layout.gridlines.push(categoryRule(at, categoryAxis.majorGridlines))
      axisTick(point(at, baseline), categoryAxis, !horizontal)
    }
  }
  const xTitle = horizontal ? valueTitle : categoryTitle
  const yTitle = horizontal ? categoryTitle : valueTitle
  if (xTitle) {
    const style = horizontal ? valueTitleStyle : categoryTitleStyle
    layout.titles.push({ x: left + plot.width / 2, y: height - pad - reserve(['b'], 'height') - textHeight(style) / 2,
      text: xTitle, anchor: 'middle', style })
  }
  if (yTitle) {
    const style = horizontal ? categoryTitleStyle : valueTitleStyle
    layout.titles.push({ x: pad + reserve(['l'], 'width') + textHeight(style) / 2, y: plotTop + plot.height / 2,
      text: yTitle, anchor: 'middle', style: { ...style, rotation: style.rotation ?? -90 } })
  }

  const addDataLabel = (entry: ChartSeries, index: number, value: { raw: number; from: number; to: number },
    endpoint: Point, start: Point, name: string, color: string, category: string, overrides: LabelOverrides) => {
    const custom = overrides.get(index)
    const label = mergeDefined<ChartLabels>(plotModel.labels, entry.labels, custom)
    if (label.deleted) return
    const code = label.numberFormat?.formatCode ?? (scatter ? entry.yVal ?? entry.val : entry.val)?.formatCode
    const text = titleText(custom?.text) || [
      label.showSerName && name, label.showCatName && category,
      label.showVal && valueText(value.raw, code, date1904),
      label.showPercent && percent && valueText(Math.abs(value.to - value.from), '0%', date1904),
    ].filter(Boolean).join(label.separator ?? ', ')
    if (!text) return
    const style = styleOf(9, model.textStyle, plotModel.labels?.style, entry.labels?.style, custom?.style, custom?.text?.style)
    const h = textHeight(style)
    const w = measure(text, style)
    const distance = horizontal ? w / 2 + 4 : h / 2 + 3
    const direction = horizontal ? Math.sign(endpoint.x - start.x) || 1 : Math.sign(endpoint.y - start.y) || -1
    const position = label.position ?? (line || scatter ? 'r' : 'outEnd')
    const offset = position === 'inEnd' ? -distance : distance
    let { x, y } = endpoint
    switch (position) {
      case 'ctr':
        if (!line && !scatter) {
          x = (x + start.x) / 2
          y = (y + start.y) / 2
        }
        break
      case 'inBase': x = start.x + (horizontal ? distance * direction : 0); y = start.y + (horizontal ? 0 : distance * direction); break
      case 'l': x -= w / 2 + 4; break
      case 'r': x += w / 2 + 4; break
      case 'b': y += h / 2 + 3; break
      case 't': y -= h / 2 + 3; break
      default: x += horizontal ? offset * direction : 0; y += horizontal ? 0 : offset * direction
    }
    layout.dataLabels.push({ x, y, text, anchor: 'middle', style, width: w, height: h, shape: label.shape,
      keyColor: label.showLegendKey ? color : undefined })
  }

  if (scatter) {
    series.forEach((entry, i) => {
      const { color, shape, marker, name } = entries[i]
      const labels = labelsFor(entry, plotModel.labels)
      const overrides = new Map(entry.pointStyles.map((style) => [style.index, style.marker]))
      const segments: Point[][] = []
      const drawLine = scatterLines && !shape?.noLine
      let segment: Point[] | undefined
      let previous = -1
      for (const { index, x, y } of xy[i]) {
        const at = point(xAt(x), valueAt(y))
        if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || (log && y <= 0) || (xAxis?.logBase && xAxis.logBase > 1 && x <= 0)) {
          previous = -1
          continue
        }
        if (drawLine) {
          if (!segment || (index !== previous + 1 && model.displayBlanksAs !== 'span')) {
            segment = []
            segments.push(segment)
          }
          segment.push(at)
        }
        previous = index
        const symbol = overrides.get(index) ?? marker
        if (x < xScale!.min || x > xScale!.max || y < scale.min || y > scale.max) continue
        if (scatterMarkers && symbol && symbol.symbol !== 'none') layout.markers.push({ ...at, marker: symbol, color })
        if (labels) addDataLabel(entry, index, { raw: y, from: 0, to: y }, at, at, name, color,
          valueText(x, entry.xVal?.formatCode, date1904), labels)
      }
      if (drawLine) layout.lines.push({ segments, color, shape,
        smooth: entry.smooth ?? (scatterStyle === 'smooth' || scatterStyle === 'smoothMarker') })
    })
    return layout
  }

  const areas: NonNullable<ChartLayout['areas']> = []
  const spacing = 1 - clamp(plotModel.overlap ?? (stacked ? 100 : 0), -100, 100) / 100
  const cluster = 1 + (series.length - 1) * spacing
  const barWidth = band / (cluster + clamp(plotModel.gapWidth ?? 150, 0, 500) / 100)
  series.forEach((entry, seriesIndex) => {
    const { color, marker, shape, name } = entries[seriesIndex]
    const pointStyles = new Map(entry.pointStyles.map((style) => [style.index, style]))
    const overrides = labelsFor(entry, plotModel.labels)
    const values = points[seriesIndex]
    const segments: Point[][] = [[]]
    let segment = segments[0]
    const bases: Point[][] = [[]]
    let base = bases[0]
    for (const index of sampledIndices(values, count)) {
      const value = values.get(index) ?? (blanksAsZero ? { raw: 0, from: 0, to: 0 } : undefined)
      if (!value || (log && value.to <= 0)) {
        if (segment.length && model.displayBlanksAs !== 'span') {
          segment = []
          segments.push(segment)
          base = []
          bases.push(base)
        }
        continue
      }
      const override = pointStyles.get(index)
      const cat = categoryAt(index) + (line || area ? 0 : (seriesIndex * spacing - (cluster - 1) / 2) * barWidth * categoryDirection)
      const endpoint = point(cat, valueAt(value.to))
      const startValue = stacked ? value.from : crossBase
      const start = point(cat, valueAt(clamp(startValue, scale.min, scale.max)))
      const inRange = value.to >= scale.min && value.to <= scale.max
      if (area) {
        segment.push(endpoint)
        base.push(start)
      } else if (line) {
        segment.push(endpoint)
        const symbol = override?.marker ?? marker
        if (symbol && symbol.symbol !== 'none' && inRange) layout.markers.push({ ...endpoint, color, marker: symbol })
      } else {
        const varied = plotModel.varyColors && series.length === 1 ? model.accentColors[index % model.accentColors.length] : undefined
        const barShape = override?.shape ? mergeDefined(shape, override.shape) : shape
        const end = point(cat, valueAt(clamp(value.to, scale.min, scale.max)))
        layout.bars.push({
          index, series: seriesIndex, from: startValue, to: value.to,
          x: horizontal ? Math.min(start.x, end.x) : cat + left - barWidth / 2,
          y: horizontal ? cat + plotTop - barWidth / 2 : Math.min(start.y, end.y),
          width: horizontal ? Math.abs(end.x - start.x) : barWidth,
          height: horizontal ? barWidth : Math.abs(end.y - start.y),
          color: override?.shape?.fill ?? varied ?? color, shape: barShape,
        })
      }
      if (inRange && overrides) addDataLabel(entry, index, value, endpoint, start, name, color, categoryText(index), overrides)
    }
    if (area) areas.push({ segments: segments.flatMap((top, i) => top.length ? [{ top, base: bases[i] }] : []), color, shape })
    if (line) layout.lines.push({ segments: segments.filter((part) => part.length), color, shape, smooth: entry.smooth ?? plotModel.smooth })
  })
  if (area) layout.areas = areas
  return layout
}

interface Slice {
  index: number
  center: Point
  start: number
  end: number
  radius: number
  innerRadius: number
  fraction: number
  color: string
  shape?: ChartShape
}

const turn = 2 * Math.PI
const radial = (center: Point, angle: number, radius: number): Point =>
  ({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius })

export function slicePath({ center, start, end, radius, innerRadius }: Slice): string {
  const coords = ({ x, y }: Point) => `${x} ${y}`
  const at = (angle: number, r: number) => coords(radial(center, angle, r))
  // SVG cannot draw a full circle with a single arc whose endpoints coincide.
  const arc = (from: number, to: number, r: number, sweep: number) => Math.abs(to - from) >= turn - 1e-12
    ? `A ${r} ${r} 0 0 ${sweep} ${at((from + to) / 2, r)} A ${r} ${r} 0 0 ${sweep} ${at(to, r)}`
    : `A ${r} ${r} 0 ${Math.abs(to - from) > Math.PI ? 1 : 0} ${sweep} ${at(to, r)}`
  return `M ${at(start, radius)} ${arc(start, end, radius, 1)} ${innerRadius
    ? `L ${at(end, innerRadius)} ${arc(end, start, innerRadius, 0)}` : `L ${coords(center)}`} Z`
}

function sliceColor(model: DrawableChart, index: number, seriesColor: string, override?: ChartShape) {
  const varied = model.plots[0].varyColors !== false && model.accentColors[index % model.accentColors.length]
  return override?.fill ?? (varied || seriesColor)
}

function sliceCategories(model: DrawableChart, series: ChartSeries[], entries: LegendItem[], date1904: boolean): LegendItem[] {
  const entry = series[0]
  if (!entry) return []
  const indices = new Set([...(entry.cat?.points.keys() ?? []), ...(entry.val?.points.keys() ?? [])])
  const styles = new Map(entry.pointStyles.map(({ index, shape }) => [index, shape]))
  return [...indices].sort((a, b) => a - b).map((index) => {
    const override = styles.get(index)
    return {
      index, name: valueText(entry.cat?.points.get(index), entry.cat?.formatCode, date1904) || String(index + 1),
      color: sliceColor(model, index, entries[0].color, override),
      shape: mergeDefined(entry.shape, override),
    }
  })
}

function layoutSlices(layout: ChartLayout, model: DrawableChart, series: ChartSeries[], entries: LegendItem[],
  categories: LegendItem[], measure: Measure, date1904: boolean) {
  const plot = model.plots[0]
  const doughnut = model.kind === 'doughnut'
  const rings = doughnut ? series : series.slice(0, 1)
  const { x, y, width, height } = layout.plot
  const center = { x: x + width / 2, y: y + height / 2 }
  const hole = doughnut ? clamp(plot.holeSize ?? 50, 10, 90) / 100 : 0
  const slices: Slice[] = []
  const leaders: Rule[] = []
  const seriesLabels = rings.map((entry) => mergeDefined<ChartLabels>(plot.labels, entry.labels))
  const labels = seriesLabels.flatMap((label, i) => [label, ...(plot.labels?.entries ?? []), ...(rings[i].labels?.entries ?? [])])
  const mayLabel = labels.some((label) => label.showCatName || label.showVal || label.showPercent || label.showSerName || 'text' in label)
  const mayPlaceOutside = labels.some((label) => label.position === 'outEnd' || label.position === 'bestFit')
  const maxExplosion = rings.reduce((max, entry) => entry.pointStyles.reduce((n, p) =>
    Math.max(n, clamp(p.explosion ?? 0, 0, 400)), Math.max(max, clamp(entry.explosion ?? 0, 0, 400))), 0)
  const radius = Math.min(width, height) * (mayPlaceOutside ? .36 : mayLabel ? .43 : .5) / (1 + maxExplosion / 100)
  const thickness = radius * (1 - hole) / Math.max(1, rings.length)
  layout.slices = slices
  layout.leaders = leaders
  rings.forEach((entry, ring) => {
    const values = [...(entry.val?.points ?? [])].flatMap(([index, value]) =>
      typeof value === 'number' && Number.isFinite(value) && value !== 0 ? [{ index, value }] : []).sort((a, b) => a.index - b.index)
    if (!values.length) return
    // Normalizing before summing keeps very large finite values drawable.
    const max = values.reduce((n, { value }) => Math.max(n, Math.abs(value)), 0)
    const total = values.reduce((n, { value }) => n + Math.abs(value) / max, 0)
    const proportions = values.map(({ value }) => (Math.abs(value) / max) / total)
    const percents = proportions.map((fraction) => Math.floor(fraction * 100))
    const byRemainder = proportions.map((fraction, i) => ({ i, remainder: fraction * 100 - percents[i] }))
      .sort((a, b) => b.remainder - a.remainder)
    const missing = 100 - percents.reduce((sum, percent) => sum + percent, 0)
    for (const { i } of byRemainder.slice(0, missing)) percents[i]++
    const outer = radius * hole + thickness * (ring + 1)
    const innerRadius = outer - thickness
    const points = new Map(entry.pointStyles.map((point) => [point.index, point]))
    const names = new Map(categories.map((category) => [category.index, category]))
    const overrides = labelsFor(entry, plot.labels)
    const startAngle = ((plot.firstSliceAng ?? 0) % 360) * Math.PI / 180 - Math.PI / 2
    let start = startAngle
    values.forEach(({ index, value }, i) => {
      const fraction = proportions[i]
      const end = i === values.length - 1 ? startAngle + turn : start + fraction * turn
      const sweep = end - start
      const angle = (start + end) / 2
      const override = points.get(index)
      const offset = clamp(override?.explosion ?? entry.explosion ?? 0, 0, 400) / 100 * radius
      const shifted = radial(center, angle, offset)
      const category = names.get(index)
      const color = sliceColor(model, index, entries[ring].color, override?.shape)
      slices.push({ index, center: shifted, start, end, radius: outer, innerRadius, fraction, color,
        shape: mergeDefined(entry.shape, override?.shape) })
      start = end

      const custom = overrides?.get(index)
      const label = mergeDefined(seriesLabels[ring], custom)
      if (label.deleted) return
      const format = label.numberFormat?.formatCode
      const percent = format && format !== '0%' && format.includes('%') ? valueText(fraction, format, date1904) : `${percents[i]}%`
      const text = titleText(custom?.text) || [
        label.showSerName && entries[ring].name,
        label.showCatName && (category?.name ?? valueText(entry.cat?.points.get(index), entry.cat?.formatCode, date1904)),
        label.showVal && valueText(value, format ?? entry.val?.formatCode, date1904),
        label.showPercent && percent,
      ].filter(Boolean).join(label.separator ?? ', ')
      if (!text) return
      const style = styleOf(9, model.textStyle, plot.labels?.style, entry.labels?.style, custom?.style, custom?.text?.style)
      const w = measure(text, style)
      const h = px(style.size ?? 9)
      const fitRadius = Math.max((innerRadius + outer) / 2, outer - Math.hypot(w, h) / 2 - 3)
      const outside = label.position === 'outEnd' || (label.position === 'bestFit' &&
        (w > fitRadius * Math.min(Math.PI, sweep) || h > thickness))
      const edge = radial(shifted, angle, outer)
      const right = Math.cos(angle) >= 0
      const tip = radial(shifted, angle, outer + 10)
      const at = outside ? { x: tip.x + (right ? 1 : -1) * (w / 2 + 4), y: tip.y }
        : radial(shifted, angle, label.position === 'ctr' ? (innerRadius + outer) / 2 : fitRadius)
      at.x = clamp(at.x, x + Math.min(w, width) / 2, x + width - Math.min(w, width) / 2)
      at.y = clamp(at.y, y + Math.min(h, height) / 2, y + height - Math.min(h, height) / 2)
      if (outside && label.showLeaderLines !== false) {
        const to = { x: at.x + (right ? -1 : 1) * (w / 2 + 2), y: at.y }
        leaders.push({ from: edge, to, shape: label.leaderLines })
      }
      layout.dataLabels.push({ ...at, text, anchor: 'middle', width: w, height: h, style, shape: label.shape,
        keyColor: label.showLegendKey ? color : undefined })
    })
  })
  if (!slices.length) layout.emptyReason = 'This chart has no nonzero values to draw.'
}

function scatterPoints(entry: ChartSeries, blanksAsZero: boolean) {
  const ys = entry.yVal ?? entry.val
  // The charts-all-kinds scatter fixture is being rebuilt by Experience.
  // The current file stores two Y series and Excel supplies their point numbers as X.
  const indices = new Set(ys?.points.keys())
  if (blanksAsZero) for (const index of entry.xVal?.points.keys() ?? []) indices.add(index)
  return [...indices].sort((a, b) => a - b).flatMap((index) => {
    const x = entry.xVal ? entry.xVal.points.get(index) : index + 1
    const y = ys?.points.get(index) ?? (blanksAsZero ? 0 : undefined)
    return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) ? [{ index, x, y }] : []
  })
}

function numericExtent(series: readonly { x: number; y: number }[][], axis: 'x' | 'y') {
  let min = Infinity
  let max = -Infinity
  for (const points of series) for (const point of points) {
    min = Math.min(min, point[axis])
    max = Math.max(max, point[axis])
  }
  return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 }
}

function axisFraction(value: number, scale: ChartLayout['scale'], axis?: ChartAxis): number {
  const unit = axis?.logBase && axis.logBase > 1 ? Math.log : (n: number) => n
  return (unit(value) - unit(scale.min)) / (unit(scale.max) - unit(scale.min))
}
