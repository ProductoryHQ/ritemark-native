import { drawsChart } from './chartLayout'
import type { ChartModel } from './chartModel'
import type { SheetLayoutInfo } from './readWorkbook'

const chartKinds = new Map([
  ['radarChart', 'radar'], ['stockChart', 'stock'], ['surfaceChart', 'surface'],
  ['surface3DChart', 'surface'], ['bubbleChart', 'bubble'],
])
const extendedKinds = new Map([
  ['waterfall', 'waterfall'], ['treemap', 'treemap'], ['histogram', 'histogram'],
  ['clusteredColumn', 'histogram'], ['paretoLine', 'histogram'], ['funnel', 'funnel'], ['boxWhisker', 'box and whisker'],
  ['sunburst', 'sunburst'], ['regionMap', 'map'],
])

function unsupportedKinds(chart: ChartModel | undefined): string[] {
  if (!chart) return ['']
  if (chart.supported) {
    const circular = chart.plots.filter(({ kind }) => kind === 'pie' || kind === 'doughnut')
    return chart.plots.length > 1 && circular.length ? circular.map(({ kind }) => kind) : ['']
  }
  if (chart.kind !== 'chartex') return [chartKinds.get(chart.kind) ?? '']
  return chart.extendedKinds?.map((kind) => extendedKinds.get(kind) ?? '') ?? ['']
}

/** What a sheet keeps that the preview doesn't draw, said once on the line under the bar (experience 47, frame 7). */
export function keptNotice(layout: Pick<SheetLayoutInfo, 'drawings' | 'conditionalFormats'>): string | undefined {
  const count = (what: string) => layout.drawings.filter((d) => d.what === what).length
  const things: string[] = []
  const name = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`)
  const charts = new Map<string, number>()
  for (const drawing of layout.drawings) {
    if (drawing.what !== 'chart' || drawsChart(drawing.chart)) continue
    for (const kind of new Set(unsupportedKinds(drawing.chart))) charts.set(kind, (charts.get(kind) ?? 0) + 1)
  }
  for (const [kind, count] of charts) {
    if (kind) things.push(name(count, `${kind} chart`, `${kind} charts`))
  }
  const unnamed = charts.get('') ?? 0
  if (unnamed) things.push(things.length
    ? (unnamed === 1 ? 'another chart' : `${unnamed} other charts`)
    : name(unnamed, 'chart', 'charts'))
  if (count('image')) things.push(name(count('image'), 'picture', 'pictures'))
  if (count('shape')) things.push(name(count('shape'), 'shape', 'shapes'))
  if (layout.conditionalFormats) things.push('colour rules')
  if (!things.length) return undefined
  const list = things.length === 1 ? things[0] : `${things.slice(0, -1).join(', ')} and ${things[things.length - 1]}`
  const one = things.length === 1 && /^an? /.test(list)
  return one
    ? `This sheet has ${list}. It's kept in the file; Open in Excel to see it.`
    : `This sheet has ${list}. They're kept in the file; Open in Excel to see them.`
}
