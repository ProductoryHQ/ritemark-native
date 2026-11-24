import { drawsChart } from './chartLayout'
import type { SheetLayoutInfo } from './readWorkbook'

/** What a sheet keeps that the preview doesn't draw, said once on the line under the bar (experience 47, frame 7). */
export function keptNotice(layout: Pick<SheetLayoutInfo, 'drawings' | 'conditionalFormats'>): string | undefined {
  const count = (what: string) => layout.drawings.filter((d) => d.what === what && (what !== 'chart' || !drawsChart(d.chart))).length
  const things: string[] = []
  const name = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`)
  const charts = count('chart')
  if (charts) things.push(name(charts, 'chart', 'charts'))
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
