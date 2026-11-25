import type { CellRules } from './cellRules'
import { drawsChart } from './chartLayout'
import type { ChartModel } from './chartModel'
import type { DrawingModel, SheetLayoutInfo } from './readWorkbook'

type ChartNoun = readonly [singular: string, plural: string]

const histogram: ChartNoun = ['histogram', 'histograms']
const surface: ChartNoun = ['surface chart', 'surface charts']
const chartKinds = new Map<string, ChartNoun>([
  ['radarChart', ['radar chart', 'radar charts']],
  ['stockChart', ['stock chart', 'stock charts']],
  ['surfaceChart', surface],
  ['surface3DChart', surface],
  ['bubbleChart', ['bubble chart', 'bubble charts']],
])
const extendedKinds = new Map<string, ChartNoun>([
  ['waterfall', ['waterfall chart', 'waterfall charts']],
  ['treemap', ['treemap', 'treemaps']],
  ['histogram', histogram],
  ['clusteredColumn', histogram],
  ['paretoLine', histogram],
  ['funnel', ['funnel chart', 'funnel charts']],
  ['boxWhisker', ['box and whisker chart', 'box and whisker charts']],
  ['sunburst', ['sunburst chart', 'sunburst charts']],
  ['regionMap', ['map', 'maps']],
])
const circularKinds = new Map<string, ChartNoun>([
  ['pie', ['pie chart', 'pie charts']],
  ['doughnut', ['doughnut chart', 'doughnut charts']],
])

function unsupportedKinds(chart: ChartModel | undefined): (ChartNoun | undefined)[] {
  if (!chart) return [undefined]
  if (chart.supported) {
    const circular = chart.plots.flatMap(({ kind }) => {
      const noun = circularKinds.get(kind)
      return noun ? [noun] : []
    })
    return chart.plots.length > 1 && circular.length ? circular : [undefined]
  }
  if (chart.kind !== 'chartex') return [chartKinds.get(chart.kind)]
  return chart.extendedKinds?.map((kind) => extendedKinds.get(kind)) ?? [undefined]
}

/**
 * What a sheet keeps that the preview doesn't draw, said once on the line under the bar (experience 47, frame 7).
 * Charts the preview draws (Sprint 174 PR 2 on) and colour rules it draws (PR 6) aren't named; chart kinds it can't
 * draw are named by kind (PR 4), and icon sets and rules it can't read are named (PR 6).
 */
export function keptNotice(layout: Pick<SheetLayoutInfo, 'drawings'>, rules?: CellRules, failed?: { has(drawing: DrawingModel): boolean }): string | undefined {
  const count = (what: string) => layout.drawings.filter((d) => d.what === what).length
  const things: string[] = []
  const name = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`)
  const charts = new Map<ChartNoun | undefined, number>()
  for (const drawing of layout.drawings) {
    if (drawing.what !== 'chart') continue
    const drawable = drawsChart(drawing.chart)
    if (drawable && !failed?.has(drawing)) continue
    const kinds = drawable ? [undefined] : unsupportedKinds(drawing.chart)
    for (const kind of new Set(kinds)) charts.set(kind, (charts.get(kind) ?? 0) + 1)
  }
  for (const [kind, count] of charts) {
    if (kind) things.push(name(count, ...kind))
  }
  const unnamed = charts.get(undefined) ?? 0
  if (unnamed) things.push(things.length
    ? (unnamed === 1 ? 'another chart' : `${unnamed} other charts`)
    : name(unnamed, 'chart', 'charts'))
  if (count('image')) things.push(name(count('image'), 'picture', 'pictures'))
  if (count('shape')) things.push(name(count('shape'), 'shape', 'shapes'))
  if (rules?.iconSets.length) things.push(rules.iconSets.length === 1 ? 'an icon set' : `${rules.iconSets.length} icon sets`)
  if (rules?.unreadable.length) things.push(name(rules.unreadable.length, "colour rule it can't read", "colour rules it can't read"))
  if (!things.length) return undefined
  const list = things.length === 1 ? things[0] : `${things.slice(0, -1).join(', ')} and ${things[things.length - 1]}`
  const one = things.length === 1 && /^an? /.test(list)
  return one
    ? `This sheet has ${list}. It's kept in the file; Open in Excel to see it.`
    : `This sheet has ${list}. They're kept in the file; Open in Excel to see them.`
}
