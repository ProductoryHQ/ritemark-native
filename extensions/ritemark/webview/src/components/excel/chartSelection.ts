import { useCallback, useEffect, useId, useState } from 'react'
import * as XLSX from 'xlsx'
import type { ChartModel } from './chartModel'
import { parseFormulaRef, type ReferenceEndpoint } from './formulaRef'

type SupportedChart = Extract<ChartModel, { supported: true }>

export function chartFormulaText(chart: SupportedChart, title: string | undefined, sheetName: string): string {
  const ranges = new Set<string>()
  const cell = ({ row, col }: ReferenceEndpoint) =>
    (col === undefined ? '' : XLSX.utils.encode_col(col)) + (row === undefined ? '' : row + 1)
  for (const plot of chart.plots) {
    for (const series of plot.series) {
      for (const data of [series.val, series.xVal, series.yVal]) {
        if (!data?.formula) continue
        const ref = parseFormulaRef(data.formula)
        if (!ref) {
          ranges.add(data.formula.replace(/^=/, ''))
          continue
        }
        const first = cell(ref.start)
        const last = cell(ref.end)
        const sheet = ref.sheet && ref.sheet.toLowerCase() !== sheetName.toLowerCase()
          ? (/^[\w.]+$/.test(ref.sheet) ? ref.sheet : `'${ref.sheet.replace(/'/g, "''")}'`) + '!'
          : ''
        ranges.add(sheet + (first === last ? first : `${first}:${last}`))
      }
    }
  }
  const article = /^[aeiou]/.test(chart.kind) ? 'an' : 'a'
  const source = ranges.size ? ` from ${[...ranges].join(', ')}` : ''
  return `${title ? `${title} · ` : ''}${article} ${chart.kind} chart${source}. Change it in Excel.`
}

export function chartTarget(target: EventTarget | null) {
  return (target as Element | null)?.closest?.('[data-sheet-chart]')
}

export interface ChartSelectionTarget {
  id: string
  chosen: boolean
  focusable: boolean
  choose: (target: HTMLDivElement, text: string) => void
}

export function useChartSelection(restoreFocus?: () => void) {
  const prefix = useId()
  const [chosen, setChosen] = useState<{ id: string; text: string; target: HTMLDivElement } | null>(null)
  const clear = useCallback(() => setChosen(null), [])
  useEffect(() => {
    if (!chosen) return
    const outside = (event: Event) => {
      if (chartTarget(event.target)?.getAttribute('data-sheet-chart') !== chosen.id) setChosen(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setChosen(null)
      if (chartTarget(document.activeElement)?.getAttribute('data-sheet-chart') === chosen.id) {
        event.preventDefault()
        if (restoreFocus) restoreFocus()
        else chosen.target.blur()
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('click', outside, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [chosen, restoreFocus])
  function bind(index: number, focusable = true): ChartSelectionTarget {
    const id = `${prefix}-${index}`
    return {
      id, focusable, chosen: chosen?.id === id,
      choose: (target, text) => setChosen({ id, text, target }),
    }
  }
  return { chosen, clear, bind }
}
