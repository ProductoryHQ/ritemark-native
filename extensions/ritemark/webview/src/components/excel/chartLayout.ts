import { applyTint, chartColorVariation } from './excelStyles'
import type { ChartAxis, ChartData, ChartLabels, ChartManualLayout, ChartMarker, ChartModel, ChartShape, ChartTextStyle, ChartTitle, ChartSeries, ChartValue, ChartPlot } from './chartModel'
import { formatCellValue } from './numberFormat'
import { fontPointsToPixels } from './sheetLayout'

type DrawableChart = Extract<ChartModel, { supported: true }>

function isCircularPlot(plot: ChartPlot) {
  return plot.kind === 'pie' || plot.kind === 'doughnut'
}

export function drawsChart(chart: ChartModel | undefined): chart is DrawableChart {
  if (!chart?.supported || !chart.plots.length || (chart.plots.length > 1 && chart.plots.some(isCircularPlot))) return false
  return chart.plots.every((plot) => {
    const valueAxes = chart.axes.filter(({ id, kind }) => kind === 'value' && plot.axisIds.includes(id ?? -1))
    return valueAxes.length <= (plot.kind === 'scatter' ? 2 : 1)
  })
}

interface Point { x: number; y: number }
interface Rect extends Point { width: number; height: number }
interface Text extends Point {
  text: string
  anchor?: 'start' | 'middle' | 'end'
  style: ChartTextStyle
  runs?: { text: string; style: ChartTextStyle }[]
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
  chartTitle: string
  plot: Rect
  plotShape?: ChartShape
  chartShape?: ChartShape
  categoryBand: number
  scale: { min: number; max: number; step: number; ticks: number[] }
  xScale?: ChartLayout['scale']
  plotLayers?: (Pick<ChartLayout, 'bars' | 'lines' | 'areas' | 'slices' | 'markers'> & { kind: ChartPlot['kind'] })[]
  valueScales?: { axisId?: number; scale: ChartLayout['scale'] }[]
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
  dataLabels: (Text & { shape?: ChartShape; width: number; height: number; keyColor?: string; fitScale?: number })[]
  legend?: { position: string; bounds: Rect; shape?: ChartShape; entries: LegendEntry[] }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const hideLabels = (axis?: ChartAxis) => axis?.deleted || axis?.tickLabelPosition === 'none'

function niceStep(span: number, divisions: number): number {
  const raw = span / divisions
  const power = 10 ** Math.floor(Math.log10(raw))
  return power * ([1, 2, 2.5, 5, 10].find((n) => n * power >= raw * (1 - 1e-12)) ?? 10)
}

function valueScale(low: number, high: number, axis: ChartAxis | undefined, percent: boolean, allowNonZeroBaseline: boolean, pixels: number, padding = .08) {
  const log = axis?.logBase
  if (log && log > 1) {
    const min = axis.min && axis.min > 0 ? axis.min : log ** Math.floor(Math.log(low > 0 ? low : 1) / Math.log(log))
    const max = axis.max && axis.max > min ? axis.max : Math.max(min * log, log ** Math.ceil(Math.log(high > 0 ? high : 1) / Math.log(log)))
    const ticks: number[] = []
    for (let i = Math.ceil(Math.log(min) / Math.log(log) - 1e-9); ticks.length < 100 && log ** i <= max * (1 + 1e-9); i++) ticks.push(log ** i)
    return { min, max, step: log, ticks }
  }
  const range = high - low
  const extent = range || Math.abs(high) || 1
  // Excel keeps zero on a one-sided axis unless the values are within one sixth of the larger magnitude.
  const minimumRatio = 5 / 6
  const autoMin = percent ? (low < 0 ? -1 : 0)
    : allowNonZeroBaseline && low > high * minimumRatio && low > 0 ? low - range / 2 : low < 0 ? low - extent * padding : 0
  const autoMax = percent ? (high > 0 || low === 0 ? 1 : 0)
    : allowNonZeroBaseline && high < low * minimumRatio && high < 0 ? high + range / 2 : high > 0 ? high + extent * padding : low < 0 ? 0 : 1
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
    const previous = overrides.get(label.index)
    overrides.set(label.index, mergeDefined(previous, label, { style: mergeDefined(previous?.style, label.style) }))
  }
  return overrides
}

function styleOf(...styles: (ChartTextStyle | undefined)[]): ChartTextStyle {
  return mergeDefined({ size: 10, color: '#000000', bold: false, italic: false }, ...styles)
}

const textHeight = (style: ChartTextStyle) => fontPointsToPixels(style.size ?? 10)

function titleFormat(title: ChartTitle | undefined, style: ChartTextStyle) {
  const runs = title?.runs?.map((run) => ({ text: run.text, style: mergeDefined(style, run.style) }))
  return { style, runs, height: runs?.length ? Math.max(...runs.map((run) => textHeight(run.style))) : textHeight(style) }
}

function textWidth(text: string, format: ReturnType<typeof titleFormat>, measure: Measure) {
  return format.runs?.length ? format.runs.reduce((sum, run) => sum + measure(run.text, run.style), 0)
    : measure(text, format.style)
}

function manualBounds(auto: Rect, layout: ChartManualLayout | undefined, width: number, height: number): Rect {
  if (!layout) return auto
  // Factor positions offset the automatic position; edge positions start at the chart origin.
  const position = (automatic: number, value: number | undefined, mode: string | undefined, extent: number) =>
    value === undefined ? automatic : (mode === 'edge' ? 0 : automatic) + value * extent
  const x = position(auto.x, layout.x, layout.xMode, width)
  const y = position(auto.y, layout.y, layout.yMode, height)
  const length = (automatic: number, value: number | undefined, mode: string | undefined, extent: number, start: number) =>
    value === undefined ? automatic : Math.max(1, value * extent - (mode === 'edge' ? start : 0))
  return { x, y, width: length(auto.width, layout.width, layout.widthMode, width, x),
    height: length(auto.height, layout.height, layout.heightMode, height, y) }
}

function boundsByCategory(series: readonly ChartSeries[], stacked: boolean, percent: boolean, blanksAsZero: boolean, runningSum: boolean, count: number) {
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
      const stack = !runningSum && value < 0 ? negative : positive
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
const MAX_DRAWN_POINTS = 5000
// Each bucket contributes up to two extrema per series, with room for the endpoints.
const MAX_BUCKETS = (MAX_DRAWN_POINTS - 2) / 2

function sampledIndices(values: ReadonlyMap<number, { to: number }>, count: number, missingAsZero = false,
  bucketCount = MAX_BUCKETS): number[] {
  if (count <= MAX_DRAWN_POINTS) return Array.from({ length: count }, (_, index) => index)
  const buckets = new Map<number, { min: number; max: number; size: number }>()
  for (const [index, value] of values) {
    const bucket = Math.floor(index * bucketCount / count)
    const previous = buckets.get(bucket)
    if (!previous) buckets.set(bucket, { min: index, max: index, size: 1 })
    else {
      if (value.to < values.get(previous.min)!.to) previous.min = index
      if (value.to > values.get(previous.max)!.to) previous.max = index
      previous.size++
    }
  }
  const selected = new Set([0, count - 1])
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const extrema = buckets.get(bucket)
    const start = Math.ceil(bucket * count / bucketCount)
    const end = Math.ceil((bucket + 1) * count / bucketCount)
    if (!extrema) {
      if (missingAsZero) selected.add(start)
      continue
    }
    let { min, max } = extrema
    if (missingAsZero && extrema.size < end - start && (values.get(min)!.to > 0 || values.get(max)!.to < 0)) {
      let zero = start
      while (values.has(zero)) zero++
      if (values.get(min)!.to > 0) min = zero
      else max = zero
    }
    selected.add(min)
    selected.add(max)
  }
  return [...selected].sort((a, b) => a - b)
}

/** Identify real gaps between sampled line points without walking the empty part of a sparse range. */
function sampledLineRuns(values: ReadonlyMap<number, { to: number }>, indices: number[], log: boolean | 0 | undefined) {
  const runs = new Map<number, number>()
  const selected = new Set(indices)
  let previous = -2
  let run = 0
  for (const index of [...values.keys()].sort((a, b) => a - b)) {
    if (log && values.get(index)!.to <= 0) continue
    if (index !== previous + 1) run++
    if (selected.has(index)) runs.set(index, run)
    previous = index
  }
  return runs
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
  const wrapWidth = legend.layout?.width !== undefined && legend.layout.widthMode !== 'edge'
    ? legend.layout.width * width : width - 2 * pad
  for (const entry of entries) {
    const override = legend.entries.find(({ index }) => index === entry.index)
    if (override?.deleted) continue
    const style = styleOf(model.textStyle, legend.textStyle, override?.textStyle)
    const keyWidth = model.kind === 'line' || entry.lineKey ? 24 : 7
    const w = measure(entry.name, style) + keyWidth + 4
    const h = textHeight(style) + 4
    let row = sizes[sizes.length - 1]
    if (!row || side || row.width + w + 10 > wrapWidth) {
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
  const bounds = manualBounds({ x, y, width: w, height: h }, legend.layout, width, height)
  let nextY = bounds.y
  rows.forEach((row, index) => {
    const offset = bounds.x + (side ? 0 : (bounds.width - sizes[index].width) / 2)
    const center = nextY + sizes[index].height / 2
    for (const entry of row) {
      entry.key.x += offset
      entry.key.y = center - entry.key.height / 2
      entry.label.x += offset
      entry.label.y = center
    }
    nextY += sizes[index].height
  })
  return { position, bounds, shape: legend.shape, entries: rows.flat() }
}

function preparePlot(model: DrawableChart, plotModel: ChartPlot, resolved: readonly ChartSeries[], date1904: boolean,
  seriesOffset: number, sharedCount: number) {
  const horizontal = plotModel.kind === 'bar'
  const line = plotModel.kind === 'line'
  const area = plotModel.kind === 'area'
  const scatter = plotModel.kind === 'scatter'
  const circular = isCircularPlot(plotModel)
  const scatterStyle = plotModel.scatterStyle ?? 'marker'
  const scatterLines = scatter && ['line', 'lineMarker', 'smooth', 'smoothMarker'].includes(scatterStyle)
  const scatterMarkers = scatter && ['marker', 'lineMarker', 'smoothMarker'].includes(scatterStyle)
  const percent = plotModel.grouping === 'percentStacked'
  const stacked = percent || plotModel.grouping === 'stacked'
  const blanksAsZero = area ? model.displayBlanksAs !== 'span' : model.displayBlanksAs === 'zero' && (line || scatter)
  const series = [...resolved].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const categoryCount = Math.max(sharedCount, series.reduce((max, entry) => Math.max(max, countOf(entry.cat), countOf(entry.val)), 1))
  const axes = model.axes.filter((axis) => plotModel.axisIds.includes(axis.id ?? -1))
  const numericAxes = axes.filter((axis) => axis.kind === 'value')
  const xAxis = scatter ? numericAxes.find(({ position }) => position === 'b' || position === 't')
    ?? numericAxes.find(({ position }) => position !== 'l' && position !== 'r') ?? numericAxes[0] : undefined
  const valueAxis = numericAxes.find((axis) => axis !== xAxis)
  const categoryAxis = scatter ? xAxis : axes.find((axis) => axis.kind === 'category' || axis.kind === 'date')
  const { points, low, high } = boundsByCategory(series, stacked, percent, blanksAsZero, line || area, categoryCount)
  const xy = scatter ? series.map((entry) => scatterPoints(entry, blanksAsZero)) : []
  const entries = series.map((entry, index) => {
    const shape = entry.shape
    const automatic = entry.automaticColor ?? model.accentColors[(seriesOffset + index) % model.accentColors.length] ?? '#4472C4'
    const color = (line || scatter ? shape?.line : shape?.fill) ?? automatic
    const marker = entry.marker?.symbol !== 'none' && (scatterMarkers || line && (entry.marker?.symbol || plotModel.marker))
      ? entry.marker ?? {} : undefined
    const name = valueText(entry.tx?.points.get(0), entry.tx?.formatCode, date1904) || `Series ${seriesOffset + index + 1}`
    return { name, color, marker, shape, lineKey: scatter ? scatterLines && !shape?.noLine : line || undefined, index: entry.index ?? seriesOffset + index }
  })
  const category = series.find((entry) => countOf(entry.cat))?.cat
  return { plotModel, series, category, categoryCount, horizontal, line, area, scatter, circular, scatterStyle, scatterLines,
    scatterMarkers, percent, stacked, blanksAsZero, xAxis, valueAxis, categoryAxis, points, low, high, xy, entries }
}

type PlotData = ReturnType<typeof preparePlot>

export function layoutChart(model: DrawableChart, resolved: readonly (readonly ChartSeries[])[], width: number, height: number,
  measure: Measure, date1904 = false): ChartLayout {
  const sharedCounts = new Map<number, number>()
  if (model.plots.length > 1) {
    model.plots.forEach((plot, i) => {
      if (!['column', 'bar', 'line', 'area'].includes(plot.kind)) return
      const id = model.axes.find((axis) => (axis.kind === 'category' || axis.kind === 'date') && plot.axisIds.includes(axis.id ?? -1))?.id
      if (id === undefined) return
      for (const entry of resolved[i] ?? []) {
        sharedCounts.set(id, Math.max(sharedCounts.get(id) ?? 1, countOf(entry.cat), countOf(entry.val)))
      }
    })
  }
  let seriesOffset = 0
  const plots = model.plots.map((plot, i) => {
    const id = model.axes.find((axis) => (axis.kind === 'category' || axis.kind === 'date') && plot.axisIds.includes(axis.id ?? -1))?.id
    const data = preparePlot(model, plot, resolved[i] ?? [], date1904, seriesOffset, sharedCounts.get(id ?? -1) ?? 1)
    seriesOffset += data.entries.length
    return data
  })
  const entries = plots.flatMap(({ entries }) => entries)
  const pad = Math.min(12, width / 10, height / 10)
  const title = model.title?.automatic ? (entries.length === 1 ? entries[0].name : 'Chart Title') : titleText(model.title)
  const chartTitle = titleFormat(model.title, styleOf({ size: 18, bold: true }, model.textStyle, model.title?.style))
  const titleWidth = model.title?.layout ? textWidth(title, chartTitle, measure) : 0
  const titleBounds = manualBounds({ x: (width - titleWidth) / 2, y: pad, width: titleWidth, height: chartTitle.height },
    model.title?.layout, width, height)
  const titleBottom = title && !model.title?.overlay ? Math.max(pad, titleBounds.y + titleBounds.height + 10) : pad
  const { plotModel, series, circular, horizontal, stacked } = plots[0]
  const categoryLegend = plots.length === 1 && plotModel.varyColors && series.length === 1
    ? categoryLegendItems(model, series[0], entries[0], date1904, circular) : undefined
  const legend = layoutLegend(model, categoryLegend ?? (plots.length === 1 && horizontal && !stacked ? [...entries].reverse() : entries), width, height, pad, titleBottom, measure)
  const legendBounds = model.legend?.overlay ? undefined : legend?.bounds
  const top = legendBounds && legend?.position === 't' ? Math.max(titleBottom, legendBounds.y + legendBounds.height + 8) : titleBottom
  const bottom = legendBounds && legend?.position === 'b' ? Math.min(height - pad, legendBounds.y - 8) : height - pad
  const left = legendBounds && legend?.position === 'l' ? Math.max(pad, legendBounds.x + legendBounds.width + 8) : pad
  const right = legendBounds && (legend?.position === 'r' || legend?.position === 'tr')
    ? Math.min(width - pad, legendBounds.x - 8) : width - pad
  const makeLayout = (plot: Rect, scale: ChartLayout['scale']): ChartLayout => ({
    width, height, chartTitle: title, name: model.kind[0].toUpperCase() + model.kind.slice(1) + ' chart' + (title ? `: ${title}` : ''),
    plot, plotShape: model.plotShape, chartShape: model.chartShape, categoryBand: 0, scale, bars: [], lines: [], markers: [], gridlines: [], axes: [], axisLabels: [],
    titles: title ? [{ x: titleBounds.x + titleBounds.width / 2, y: titleBounds.y + titleBounds.height / 2, text: title, anchor: 'middle', style: chartTitle.style, runs: chartTitle.runs }] : [],
    dataLabels: [], legend,
  })
  const shownAxes = new Set<ChartAxis>()
  const painters = plots.map((data) => {
    const { categoryAxis, valueAxis, xAxis } = data
    const showCategory = !categoryAxis || !shownAxes.has(categoryAxis)
    const showValue = !valueAxis || !shownAxes.has(valueAxis)
    if (categoryAxis) shownAxes.add(categoryAxis)
    if (valueAxis) shownAxes.add(valueAxis)
    return preparePlotLayout(model, data, plots.filter((other) => valueAxis && other.valueAxis === valueAxis),
      plots.filter((other) => xAxis && other.xAxis === xAxis),
      { x: left, y: top, width: right - left, height: bottom - top }, width, height, measure, date1904, showCategory, showValue, makeLayout)
  })
  const bounds = painters.map(({ bounds }) => bounds)
  const x = Math.max(...bounds.map((rect) => rect.x))
  const y = Math.max(...bounds.map((rect) => rect.y))
  const plot = { x, y, width: Math.max(1, Math.min(...bounds.map((rect) => rect.x + rect.width)) - x),
    height: Math.max(1, Math.min(...bounds.map((rect) => rect.y + rect.height)) - y) }
  if (plots.length === 1) return painters[0].draw(bounds[0])
  const layers = painters.map(({ draw }) => draw(plot))
  const layout = makeLayout(plot, layers.find((_, index) => !plots[index].circular)?.scale ?? layers[0].scale)
  layout.valueScales = layers.flatMap(({ scale }, index) => !plots[index].circular && layers.findIndex((_, i) => plots[i].valueAxis === plots[index].valueAxis) === index
    ? [{ axisId: plots[index].valueAxis?.id, scale }] : [])
  layout.categoryBand = layers.find(({ categoryBand }) => categoryBand)?.categoryBand ?? 0
  layout.plotLayers = layers.map(({ bars, lines, areas, slices, markers }, i) => ({ bars, lines, areas, slices, markers, kind: plots[i].plotModel.kind }))
  for (const [index, layer] of layers.entries()) {
    layout.gridlines.push(...layer.gridlines)
    layout.axes.push(...layer.axes)
    layout.axisLabels.push(...layer.axisLabels)
    layout.titles.push(...layer.titles.slice(title ? 1 : 0))
    layout.dataLabels.push(...layer.dataLabels)
    if (layer.leaders) (layout.leaders ??= []).push(...layer.leaders)
    layout.lines.push(...layer.lines)
    layout.bars.push(...layer.bars.map((bar) => ({
      ...bar, series: bar.series + plots.slice(0, index).reduce((sum, { series }) => sum + series.length, 0),
    })))
    layout.markers.push(...layer.markers)
    if (layer.areas) (layout.areas ??= []).push(...layer.areas)
    if (layer.slices) (layout.slices ??= []).push(...layer.slices)
  }
  return layout
}

function preparePlotLayout(model: DrawableChart, data: PlotData, yGroup: PlotData[], xGroup: PlotData[], outer: Rect,
  width: number, height: number, measure: Measure, date1904: boolean, showCategory: boolean, showValue: boolean,
  makeLayout: (plot: Rect, scale: ChartLayout['scale']) => ChartLayout) {
  const { plotModel, series, category, categoryCount, horizontal, line, area, scatter, circular, scatterStyle, scatterLines,
    scatterMarkers, percent, stacked, blanksAsZero, xAxis, categoryAxis, valueAxis, points, xy, entries } = data
  if (circular) {
    const bounds = manualBounds({ ...outer, width: Math.max(1, outer.width), height: Math.max(1, outer.height) }, model.plotLayout, width, height)
    return { bounds, draw(plot: Rect) {
      const layout = makeLayout(plot, { min: 0, max: 1, step: 1, ticks: [] })
      layoutSlices(layout, { ...model, kind: plotModel.kind, plots: [plotModel] }, series, entries, measure, date1904)
      return layout
    } }
  }
  const xRange = numericExtent((xGroup.length ? xGroup : [data]).flatMap((plot) => plot.xy), 'x')
  const xScale = scatter ? valueScale(xRange.min, xRange.max, xAxis, false, true, outer.width / 3, .05) : undefined
  const count = xScale ? xScale.ticks.length : categoryCount
  const labelStyle = (axis?: ChartAxis) => styleOf(model.textStyle, axis?.textStyle)
  const categoryStyle = labelStyle(categoryAxis)
  const valueStyle = labelStyle(valueAxis)
  const categoryText = (index: number) => xScale
    ? valueText(xScale.ticks[index], xAxis?.numberFormat?.formatCode ?? series[0]?.xVal?.formatCode, date1904)
    : valueText(category?.points.get(index) ?? (category ? undefined : index + 1),
    categoryAxis?.numberFormat?.formatCode === 'General' ? category?.formatCode : categoryAxis?.numberFormat?.formatCode ?? category?.formatCode, date1904)
  const valueGroup = yGroup.length ? yGroup : [data]
  const extents = valueGroup.map((plot) => plot.scatter ? numericExtent(plot.xy, 'y') : { min: plot.low, max: plot.high })
  const scaleSource = valueGroup[0]
  const allowNonZeroBaseline = valueGroup.every((plot) => plot.line || plot.area || plot.scatter)
  const scale = valueScale(Math.min(...extents.map(({ min }) => min)), Math.max(...extents.map(({ max }) => max)),
    valueAxis, valueGroup.every((plot) => plot.percent), allowNonZeroBaseline, scaleSource.horizontal ? outer.width : outer.height - 20,
    scaleSource.scatter ? .05 : .08)

  const valueCode = valueAxis?.numberFormat?.formatCode ?? (scaleSource.percent ? '0%'
    : (scaleSource.scatter ? scaleSource.series[0]?.yVal : scaleSource.series[0]?.val)?.formatCode)
  const valueLabel = (n: number) => valueText(n, valueCode, date1904)
  const valueWidth = scale.ticks.reduce((max, n) => Math.max(max, measure(valueLabel(n), valueStyle)), 0)
  const sampleStride = Math.max(1, Math.ceil(count / MAX_DRAWN_POINTS))
  let categoryWidth = 0
  for (let i = 0; i < count; i += sampleStride) categoryWidth = Math.max(categoryWidth, measure(categoryText(i), categoryStyle))
  const axisTitleFormat = (axis?: ChartAxis) =>
    titleFormat(axis?.title, styleOf({ bold: true }, model.textStyle, axis?.title?.style))
  const xTitleAxis = horizontal ? valueAxis : categoryAxis
  const yTitleAxis = horizontal ? categoryAxis : valueAxis
  const xTitle = xTitleAxis?.deleted || !(horizontal ? showValue : showCategory) ? '' : titleText(xTitleAxis?.title)
  const yTitle = yTitleAxis?.deleted || !(horizontal ? showCategory : showValue) ? '' : titleText(yTitleAxis?.title)
  const xTitleFormat = axisTitleFormat(xTitleAxis)
  const yTitleFormat = axisTitleFormat(yTitleAxis)
  const verticalTitleSpace = yTitle && !yTitleAxis?.title?.layout ? yTitleFormat.height + 6 : 0
  const horizontalTitleSpace = xTitle && !xTitleAxis?.title?.layout ? xTitleFormat.height + 6 : 0
  const verticalAxis = horizontal ? categoryAxis : valueAxis
  const horizontalAxis = horizontal ? valueAxis : categoryAxis
  const verticalLabelWidth = Math.min(width * .35, horizontal ? categoryWidth : valueWidth) + 8
  const verticalLabelsRight = verticalAxis?.tickLabelPosition === 'high' || (verticalAxis?.position === 'r' && verticalAxis.tickLabelPosition !== 'low')
  const horizontalLabelsTop = horizontalAxis?.tickLabelPosition === 'high' || (horizontalAxis?.position === 't' && horizontalAxis.tickLabelPosition !== 'low')
  const verticalLabels = hideLabels(verticalAxis) || !(horizontal ? showCategory : showValue) ? 0 : verticalLabelWidth
  const rightTitle = model.kind === 'combo' && verticalLabelsRight
  const topTitle = model.kind === 'combo' && horizontalLabelsTop
  const insetLeft = (rightTitle ? 0 : verticalTitleSpace) + (verticalLabelsRight ? 0 : verticalLabels)
  const insetRight = (rightTitle ? verticalTitleSpace : 0) + (verticalLabelsRight ? verticalLabels : horizontal ? valueWidth / 2 : 0)
  const between = !scatter && (area ? valueAxis?.crossBetween === 'between' || count === 1
    : !line || valueAxis?.crossBetween !== 'midCat' || count === 1)
  const categoryHeight = textHeight(categoryStyle)
  const plotLayout = model.plotLayout
  const inner = plotLayout?.target === 'inner'
  const inset = (rect: Rect, top: number, bottom: number): Rect => ({
    x: rect.x + insetLeft, y: rect.y + top,
    width: Math.max(1, rect.width - insetLeft - insetRight),
    height: Math.max(1, rect.height - top - bottom),
  })
  const manualOuter = manualBounds(outer, inner ? undefined : plotLayout, width, height)
  const provisional = manualBounds(inset(manualOuter, 0, 0), inner ? plotLayout : undefined, width, height)
  const availableBand = provisional.width / Math.max(1, between ? count : count - 1)
  const autoTilt = !scatter && !horizontal && !hideLabels(categoryAxis) && categoryStyle.rotation === undefined
    && categoryWidth + 5 > availableBand * (categoryAxis?.tickLabelSkip ?? 1)
  if (autoTilt) categoryStyle.rotation = -45
  const angle = (categoryStyle.rotation ?? 0) * Math.PI / 180
  const tiltedHeight = categoryWidth * Math.abs(Math.sin(angle)) + categoryHeight * Math.abs(Math.cos(angle))
  const horizontalLabels = hideLabels(horizontalAxis) || !(horizontal ? showValue : showCategory) ? 0
    : (horizontal ? textHeight(valueStyle) : Math.min(tiltedHeight, Math.max(categoryHeight, manualOuter.height / 2))) + 8
  const bounds = manualBounds(inset(manualOuter, (topTitle ? horizontalTitleSpace : 0) + (horizontalLabelsTop ? horizontalLabels : 0),
    (topTitle ? 0 : horizontalTitleSpace) + (horizontalLabelsTop ? 0 : horizontalLabels)), inner ? plotLayout : undefined, width, height)
  return { bounds, draw: drawPlot }

  function drawPlot(plot: Rect): ChartLayout {
    const plotLeft = plot.x
    const plotTop = plot.y
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
      ? { x: plotLeft + val, y: plotTop + cat }
      : { x: plotLeft + cat, y: plotTop + plot.height - val }
    const rule = (from: Point, to: Point, shape?: ChartShape): Rule => ({ from, to, shape })
    const valueRule = (position: number, shape?: ChartShape) => rule(point(0, position), point(categoryLength, position), shape)
    const categoryRule = (position: number, shape?: ChartShape) => rule(point(position, 0), point(position, valueLength), shape)
    const crossValue = categoryAxis?.crossesAt ?? (categoryAxis?.crosses === 'max' ? scale.max : categoryAxis?.crosses === 'min' ? scale.min : 0)
    const crossBase = clamp(crossValue, scale.min, scale.max)
    const baseline = valueAt(crossBase)
    const crossCategory = valueAxis?.crossesAt ?? (valueAxis?.crosses === 'max' ? count : 1)
    const crossesAtEnd = valueAxis?.crosses === 'max' ||
      (model.kind === 'combo' && valueAxis?.crosses === undefined && valueAxis?.position === (horizontal ? 'b' : 'r'))
    const categoryCross = xScale
      ? xAt(clamp(valueAxis?.crossesAt ?? (valueAxis?.crosses === 'max' ? xScale.max : valueAxis?.crosses === 'min' ? xScale.min : 0), xScale.min, xScale.max))
      : valueAxis?.crossesAt === undefined
      ? (crossesAtEnd !== categoryReversed ? categoryLength : 0)
      : clamp(categoryAt(crossCategory - 1) - (between ? categoryDirection * band / 2 : 0), 0, categoryLength)
    if (showCategory && categoryAxis && !categoryAxis.deleted) layout.axes.push(valueRule(baseline, categoryAxis.shape))
    if (showValue && valueAxis && !valueAxis.deleted) layout.axes.push(categoryRule(categoryCross, valueAxis.shape))
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
    if (showValue && !log && minorUnit > 0 && (valueAxis?.minorGridlines || (valueAxis?.minorTickMark && valueAxis.minorTickMark !== 'none'))) {
      for (let i = 1; i <= 500; i++) {
        const offset = i * minorUnit
        if (offset >= scale.max - scale.min) break
        if (Math.abs(offset / scale.step - Math.round(offset / scale.step)) > 1e-8) showValueAt(scale.min + offset, true)
      }
    }
    for (const tick of showValue ? scale.ticks : []) {
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
    for (let i = 0; showCategory && !hideLabels(categoryAxis) && i < count; i += Math.max(skip, sampleStride)) {
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
    if (showCategory && xScale && xAxis && !(xAxis.logBase && xAxis.logBase > 1) &&
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
    if (showCategory && categoryAxis && (categoryAxis.majorGridlines || categoryAxis.majorTickMark && categoryAxis.majorTickMark !== 'none')) {
      const marks = count + (between ? 1 : 0)
      for (let i = 0; i < marks; i += Math.max(sampleStride, categoryAxis.tickMarkSkip ?? 1)) {
        const at = scatter ? categoryAt(i) : i * band
        if (categoryAxis.majorGridlines) layout.gridlines.push(categoryRule(at, categoryAxis.majorGridlines))
        axisTick(point(at, baseline), categoryAxis, !horizontal)
      }
    }
    const addTitle = (text: string, format: ReturnType<typeof titleFormat>, center: Point, title?: ChartTitle) => {
      if (title?.layout) {
        const w = textWidth(text, format, measure)
        const bounds = manualBounds({ x: center.x - w / 2, y: center.y - format.height / 2, width: w, height: format.height },
          title.layout, width, height)
        center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      }
      layout.titles.push({ ...center, text, anchor: 'middle', style: format.style, runs: format.runs })
    }
    if (xTitle) addTitle(xTitle, xTitleFormat,
      { x: plotLeft + plot.width / 2, y: topTitle ? plotTop - horizontalLabels - 6 - xTitleFormat.height / 2
        : plotTop + plot.height + (horizontalLabelsTop ? 0 : horizontalLabels) + 6 + xTitleFormat.height / 2 },
      xTitleAxis?.title)
    if (yTitle) addTitle(yTitle, {
      ...yTitleFormat, style: { ...yTitleFormat.style, rotation: yTitleFormat.style.rotation ?? -90 },
    }, { x: rightTitle ? plotLeft + plot.width + verticalLabels + 6 + yTitleFormat.height / 2
      : plotLeft - (verticalLabelsRight ? 0 : verticalLabels) - 6 - yTitleFormat.height / 2, y: plotTop + plot.height / 2 },
    yTitleAxis?.title)

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
      const style = styleOf(model.textStyle, plotModel.labels?.style, entry.labels?.style, custom?.style, custom?.text?.style)
      const format = titleFormat(custom?.text, style)
      const h = format.height
      const w = textWidth(text, format, measure)
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
      layout.dataLabels.push({ x, y, text, anchor: 'middle', style, runs: format.runs, width: w, height: h, shape: label.shape,
        keyColor: label.showLegendKey ? color : undefined })
    }

    if (scatter) {
      series.forEach((entry, i) => {
        const { color, shape, marker, name } = entries[i]
        const labels = labelsFor(entry, plotModel.labels)
        const overrides = new Map(entry.pointStyles.map((style) => [style.index, style.marker]))
        const segments: Point[][] = []
        const drawLine = scatterLines && !shape?.noLine
        const coordinates = xy[i]
        const thin = coordinates.length > MAX_DRAWN_POINTS
        const valid = (x: number, y: number) => !(log && y <= 0) && !(xAxis?.logBase && xAxis.logBase > 1 && x <= 0)
        const firstIndex = coordinates[0]?.index ?? 0
        const indexSpan = (coordinates[coordinates.length - 1]?.index ?? 0) - firstIndex + 1
        const selected = thin ? new Set(sampledIndices(new Map(coordinates.flatMap(({ index, x, y }) =>
          valid(x, y) ? [[index - firstIndex, { to: y }]] : [])), indexSpan)) : undefined
        const markerPixels = new Set<string>()
        let segment: Point[] | undefined
        let previous = -1
        for (const { index, x, y } of coordinates) {
          const at = point(xAt(x), valueAt(y))
          if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || !valid(x, y)) {
            previous = -1
            continue
          }
          if (drawLine) {
            if (!segment || (index !== previous + 1 && model.displayBlanksAs !== 'span')) {
              segment = []
              segments.push(segment)
            }
            if (!selected || selected.has(index - firstIndex)) segment.push(at)
          }
          previous = index
          const symbol = overrides.get(index) ?? marker
          if (selected && !selected.has(index - firstIndex)) continue
        if (x < xScale!.min || x > xScale!.max || y < scale.min || y > scale.max) continue
          if (scatterMarkers && symbol && symbol.symbol !== 'none') {
            const pixel = thin ? `${Math.floor(at.x)},${Math.floor(at.y)}` : undefined
            if (pixel === undefined || !markerPixels.has(pixel)) {
              layout.markers.push({ ...at, marker: symbol, color })
              if (pixel !== undefined) markerPixels.add(pixel)
            }
          }
          if (labels) addDataLabel(entry, index, { raw: y, from: 0, to: y }, at, at, name, color,
            valueText(x, entry.xVal?.formatCode, date1904), labels)
        }
        if (drawLine) layout.lines.push({ segments: segments.filter((part) => part.length), color, shape,
          smooth: entry.smooth ?? (scatterStyle === 'smooth' || scatterStyle === 'smoothMarker') })
      })
      return layout
    }

    const areas: NonNullable<ChartLayout['areas']> = []
    const spacing = 1 - clamp(plotModel.overlap ?? (stacked ? 100 : 0), -100, 100) / 100
    const cluster = 1 + (series.length - 1) * spacing
    const barWidth = band / (cluster + clamp(plotModel.gapWidth ?? 150, 0, 500) / 100)
    // Grouped marks share categories, including the extrema that only one series needs.
    let sharedIndices: number[] | undefined
    if (points.length > 1 && (stacked || plotModel.kind === 'column' || horizontal)) {
      if (count <= MAX_DRAWN_POINTS) sharedIndices = Array.from({ length: count }, (_, index) => index)
      else {
        const bucketCount = Math.max(1, Math.floor(MAX_BUCKETS / points.length))
        const union = new Set<number>()
        for (const values of points) {
          for (const index of sampledIndices(values, count, blanksAsZero, bucketCount)) union.add(index)
        }
        sharedIndices = [...union].sort((a, b) => a - b)
      }
    }
    series.forEach((entry, seriesIndex) => {
      const { color, marker, shape, name } = entries[seriesIndex]
      const pointStyles = new Map(entry.pointStyles.map((style) => [style.index, style]))
      const overrides = labelsFor(entry, plotModel.labels)
      const values = points[seriesIndex]
      const segments: Point[][] = [[]]
      let segment = segments[0]
      const bases: Point[][] = [[]]
      let base = bases[0]
      const indices = sharedIndices ?? sampledIndices(values, count, blanksAsZero)
      const runs = line && !blanksAsZero && model.displayBlanksAs !== 'span' && count > MAX_DRAWN_POINTS
        ? sampledLineRuns(values, indices, log) : undefined
      let previousRun: number | undefined
      for (const index of indices) {
        const value = values.get(index) ?? (blanksAsZero ? { raw: 0, from: 0, to: 0 } : undefined)
        const drawable = value && !(log && value.to <= 0)
        const run = runs?.get(index)
        if ((!drawable && model.displayBlanksAs !== 'span' || runs && run !== previousRun) && segment.length) {
          segment = []
          segments.push(segment)
          base = []
          bases.push(base)
        }
        if (!drawable) continue
        previousRun = run
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
            x: horizontal ? Math.min(start.x, end.x) : cat + plotLeft - barWidth / 2,
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
  if (override?.fill) return override.fill
  const palette = model.accentColors
  const accent = model.plots[0].varyColors !== false && palette[index % palette.length]
  if (!accent) return seriesColor
  const cycle = Math.floor(index / palette.length)
  return cycle && /^#[0-9a-f]{6}$/i.test(accent)
    ? '#' + applyTint(accent.slice(1), 0, chartColorVariation(cycle))
    : accent
}

function categoryLegendItems(model: DrawableChart, entry: ChartSeries, series: LegendItem, date1904: boolean,
  circular: boolean): LegendItem[] {
  const indices = new Set([...(entry.cat?.points.keys() ?? []), ...(entry.val?.points.keys() ?? [])])
  const styles = new Map(entry.pointStyles.map(({ index, shape }) => [index, shape]))
  return [...indices].sort((a, b) => a - b).map((index) => {
    const override = styles.get(index)
    return {
      index, name: valueText(entry.cat?.points.get(index), entry.cat?.formatCode, date1904) || String(index + 1),
      color: circular ? sliceColor(model, index, series.color, override)
        : override?.fill ?? model.accentColors[index % model.accentColors.length] ?? series.color,
      shape: mergeDefined(entry.shape, override),
    }
  })
}

interface OutsideLabel {
  label: ChartLayout['dataLabels'][number]
  edge: Point
  preferred: Point
  right: boolean
  leader: boolean
  bestFit: boolean
  leaderShape?: ChartShape
}

function spreadOutsideLabels(layout: ChartLayout, labels: OutsideLabel[]) {
  const { width, height, legend } = layout
  const bounds = legend?.bounds
  const gap = 3
  const left = bounds && legend.position === 'l' ? clamp(bounds.x + bounds.width + gap, 0, width) : 0
  const right = bounds && ['r', 'tr'].includes(legend.position) ? clamp(bounds.x - gap, left, width) : width
  const top = bounds && legend.position === 't' ? clamp(bounds.y + bounds.height + gap, 0, height) : 0
  const bottom = bounds && legend.position === 'b' ? clamp(bounds.y - gap, top, height) : height
  const middle = clamp(layout.plot.x + layout.plot.width / 2, left, right)

  for (const onRight of [false, true]) {
    const side = labels.filter((item) => item.right === onRight).sort((a, b) => a.preferred.y - b.preferred.y)
    if (!side.length) continue
    const direction = onRight ? 1 : -1
    const minX = onRight ? middle : left
    const maxX = onRight ? right : middle
    const footprints = new Map(side.map((item) => {
      const { label } = item
      const angle = (label.style.rotation ?? 0) * Math.PI / 180
      const sin = Math.abs(Math.sin(angle))
      const cos = Math.abs(Math.cos(angle))
      const key = label.keyColor ? 9 : 0
      const boxX = Math.max(label.width / 2 + (label.shape ? 2 : 0), label.width / 2 + key,
        (label.width * cos + label.height * sin) / 2)
      const boxY = Math.max(label.height / 2 + (label.shape ? 1 : 0), (label.width * sin + label.height * cos) / 2)
      const fit = Math.min(1, (maxX - minX) / (2 * boxX || 1))
      return [item, { boxX, boxY, fit }] as const
    }))
    const naturalHeight = side.reduce((sum, item) => {
      const { boxY, fit } = footprints.get(item)!
      return sum + 2 * boxY * fit
    }, 0)
    const space = bottom - top
    const separation = Math.min(gap, space / (2 * side.length))
    const verticalFit = Math.min(1, (space - separation * (side.length - 1)) / (naturalHeight || 1))
    for (const [item, footprint] of footprints) {
      const fit = footprint.fit * verticalFit
      if (fit < 1) item.label.fitScale = fit
    }
    const halfWidth = (item: OutsideLabel) => {
      const { boxX, fit } = footprints.get(item)!
      return boxX * fit * verticalFit
    }
    const halfHeight = (item: OutsideLabel) => {
      const { boxY, fit } = footprints.get(item)!
      return boxY * fit * verticalFit
    }
    const widest = side.reduce((max, item) => Math.max(max, halfWidth(item) * 2), 0)
    const column = side.reduce((edge, item) => {
      const near = item.preferred.x - direction * item.label.width / 2
      return onRight ? Math.max(edge, near) : Math.min(edge, near)
    }, onRight ? minX : maxX)
    const columnEdge = onRight ? clamp(column, minX, maxX - widest) : clamp(column, minX + widest, maxX)
    let next = top
    for (const item of side) {
      item.label.x = columnEdge + direction * halfWidth(item)
      item.label.y = Math.max(next + halfHeight(item), item.preferred.y)
      next = item.label.y + halfHeight(item) + separation
    }
    next = bottom
    for (let i = side.length - 1; i >= 0; i--) {
      const item = side[i]
      item.label.y = Math.max(top + halfHeight(item), Math.min(item.label.y, next - halfHeight(item)))
      next = item.label.y - halfHeight(item) - separation
      if (!item.leader || (!item.bestFit && Math.hypot(item.label.x - item.preferred.x, item.label.y - item.preferred.y) < gap)) continue
      const to = { x: clamp(columnEdge - direction * 2, left, right), y: clamp(item.label.y, top, bottom) }
      const from = { x: clamp(item.edge.x, 0, width), y: clamp(item.edge.y, 0, height) }
      layout.leaders!.push({ from, to, shape: item.leaderShape })
    }
  }
}

function layoutSlices(layout: ChartLayout, model: DrawableChart, series: ChartSeries[], entries: LegendItem[],
  measure: Measure, date1904: boolean) {
  const plot = model.plots[0]
  const doughnut = model.kind === 'doughnut'
  const rings = doughnut ? series : series.slice(0, 1)
  const { x, y, width, height } = layout.plot
  const center = { x: x + width / 2, y: y + height / 2 }
  const hole = doughnut ? clamp(plot.holeSize ?? 50, 10, 90) / 100 : 0
  const slices: Slice[] = []
  const outsideLabels: OutsideLabel[] = []
  const ringValues = rings.map((entry) => [...(entry.val?.points ?? [])].flatMap(([index, value]) =>
    typeof value === 'number' && Number.isFinite(value) && value !== 0 ? [{ index, value }] : []).sort((a, b) => a.index - b.index))
  const seriesLabels = rings.map((entry) => mergeDefined<ChartLabels>(plot.labels, entry.labels))
  const pointLabels = rings.map((entry) => labelsFor(entry, plot.labels))
  const labels = ringValues.flatMap((values, ring) => values.map(({ index }) =>
    mergeDefined(seriesLabels[ring], pointLabels[ring]?.get(index))))
    .filter((label) => !label.deleted && (label.showCatName || label.showVal || label.showPercent || label.showSerName || 'text' in label))
  const mayLabel = labels.length > 0
  const mayPlaceOutside = labels.some((label) => label.position === 'outEnd' || label.position === 'bestFit')
  const maxExplosion = rings.reduce((max, entry) => entry.pointStyles.reduce((n, p) =>
    Math.max(n, clamp(p.explosion ?? 0, 0, 400)), Math.max(max, clamp(entry.explosion ?? 0, 0, 400))), 0)
  const radius = Math.min(width, height) * (mayPlaceOutside ? .36 : mayLabel ? .43 : .5) / (1 + maxExplosion / 100)
  const thickness = radius * (1 - hole) / Math.max(1, rings.length)
  layout.slices = slices
  layout.leaders = []
  rings.forEach((entry, ring) => {
    const values = ringValues[ring]
    if (!values.length) return
    // Normalizing before summing keeps very large finite values drawable.
    const max = values.reduce((n, { value }) => Math.max(n, Math.abs(value)), 0)
    const total = values.reduce((n, { value }) => n + Math.abs(value) / max, 0)
    const proportions = values.map(({ value }) => (Math.abs(value) / max) / total)
    const outer = radius * hole + thickness * (ring + 1)
    const innerRadius = outer - thickness
    const points = new Map(entry.pointStyles.map((point) => [point.index, point]))
    const overrides = pointLabels[ring]
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
      const color = sliceColor(model, index, entries[ring].color, override?.shape)
      slices.push({ index, center: shifted, start, end, radius: outer, innerRadius, fraction, color,
        shape: mergeDefined(entry.shape, override?.shape) })
      start = end

      const custom = overrides?.get(index)
      const label = mergeDefined(seriesLabels[ring], custom)
      if (label.deleted) return
      const code = label.numberFormat?.formatCode
      const percent = code && code !== '0%' && code.includes('%') ? valueText(fraction, code, date1904) : `${Math.round(fraction * 100)}%`
      const text = titleText(custom?.text) || [
        label.showSerName && entries[ring].name,
        label.showCatName && (valueText(entry.cat?.points.get(index), entry.cat?.formatCode, date1904) || String(index + 1)),
        label.showVal && valueText(value, code ?? entry.val?.formatCode, date1904),
        label.showPercent && percent,
      ].filter(Boolean).join(label.separator ?? ', ')
      if (!text) return
      const style = styleOf(model.textStyle, plot.labels?.style, entry.labels?.style, custom?.style, custom?.text?.style)
      const format = titleFormat(custom?.text, style)
      const w = textWidth(text, format, measure)
      const h = format.height
      const fitRadius = Math.max((innerRadius + outer) / 2, outer - Math.hypot(w, h) / 2 - 3)
      const outside = label.position === 'outEnd' || (label.position === 'bestFit' &&
        (w > fitRadius * Math.min(Math.PI, sweep) || h > thickness))
      const edge = radial(shifted, angle, outer)
      const right = Math.cos(angle) >= 0
      const tip = radial(shifted, angle, outer + 10)
      const at = outside ? { x: tip.x + (right ? 1 : -1) * (w / 2 + 4), y: tip.y }
        : radial(shifted, angle, label.position === 'ctr' || (doughnut && !label.position) ? (innerRadius + outer) / 2 : fitRadius)
      if (!outside) {
        at.x = clamp(at.x, x + Math.min(w, width) / 2, x + width - Math.min(w, width) / 2)
        at.y = clamp(at.y, y + Math.min(h, height) / 2, y + height - Math.min(h, height) / 2)
      }
      const textLabel = { ...at, text, anchor: 'middle' as const, width: w, height: h, style, runs: format.runs, shape: label.shape,
        keyColor: label.showLegendKey ? color : undefined }
      layout.dataLabels.push(textLabel)
      if (outside) outsideLabels.push({ label: textLabel, edge, preferred: at, right,
        leader: label.showLeaderLines !== false, bestFit: label.position === 'bestFit', leaderShape: label.leaderLines })
    })
  })
  spreadOutsideLabels(layout, outsideLabels)
  if (!slices.length) layout.emptyReason = 'This chart has no nonzero values to draw.'
}

function scatterPoints(entry: ChartSeries, blanksAsZero: boolean) {
  const ys = entry.yVal ?? entry.val
  const xs = entry.xVal
  const usePointNumber = !xs || xs.type === 'string' ||
    Array.from(xs.points.values()).some((x) => typeof x !== 'number' || !Number.isFinite(x))
  const indices = new Set(ys?.points.keys())
  if (blanksAsZero) for (const index of entry.xVal?.points.keys() ?? []) indices.add(index)
  return [...indices].sort((a, b) => a - b).flatMap((index) => {
    const x = usePointNumber ? index + 1 : xs.points.get(index)
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
