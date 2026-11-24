import { useCallback, useEffect, useId, useState } from 'react'
import * as XLSX from 'xlsx'
import type { ChartModel } from './chartModel'
import { joinAdjacentRefs, parseFormulaRef, type FormulaRef, type ReferenceEndpoint } from './formulaRef'
import { isMac } from '../../hooks/usePlatform'

type SupportedChart = Extract<ChartModel, { supported: true }>

function formatChartRef(ref: FormulaRef, sheetName: string): string {
  const cell = ({ row, col }: ReferenceEndpoint) =>
    (col === undefined ? '' : XLSX.utils.encode_col(col)) + (row === undefined ? '' : row + 1)
  const first = cell(ref.start)
  const last = cell(ref.end)
  const sheet = ref.sheet?.toLowerCase() !== sheetName.toLowerCase() && ref.sheet
    ? (/^[\w.]+$/.test(ref.sheet) ? ref.sheet : `'${ref.sheet.replace(/'/g, "''")}'`) + '!'
    : ''
  return sheet + (first === last ? first : `${first}:${last}`)
}

export function chartFormulaText(chart: SupportedChart, title: string | undefined, sheetName: string): string {
  const sources = new Map<string, FormulaRef | undefined>()
  for (const plot of chart.plots) {
    for (const series of plot.series) {
      for (const data of [series.val, series.xVal, series.yVal]) {
        if (!data?.formula) continue
        const ref = parseFormulaRef(data.formula)
        if (ref) ref.sheet ??= sheetName
        sources.set(ref ? formatChartRef(ref, sheetName) : data.formula.replace(/^=/, ''), ref)
      }
    }
  }
  const ranges = [...sources].map(([text, ref]) => ({ text, ref }))
  // A merge can make a range adjacent to one we already visited.
  for (let i = 0; i < ranges.length; i++) {
    const first = ranges[i].ref
    if (!first) continue
    for (let j = i + 1; j < ranges.length; j++) {
      const second = ranges[j].ref
      const joined = second && joinAdjacentRefs(first, second)
      if (!joined) continue
      ranges[i] = { text: formatChartRef(joined, sheetName), ref: joined }
      ranges.splice(j, 1)
      i = -1
      break
    }
  }
  const article = /^[aeiou]/.test(chart.kind) ? 'an' : 'a'
  const source = ranges.length ? ` from ${[...new Set(ranges.map(({ text }) => text))].join(', ')}` : ''
  return `${title ? `${title} · ` : ''}${article} ${chart.kind} chart${source}. Change it in Excel.`
}

export function chartShortcutDescription(mac = isMac): string {
  return `Cycle through charts with ${mac ? 'Cmd+Option+5' : 'Ctrl+Alt+5'}. Hold Shift to go back.`
}

export function isChartShortcut(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'getModifierState'>, mac = isMac): boolean {
  return event.code === 'Digit5' && event.altKey && !event.getModifierState('AltGraph')
    && (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)
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
  const barId = `${prefix}-formula-bar`
  const idFor = (index: number) => `${prefix}-${index}`
  const [chosen, setChosen] = useState<{ id: string; text: string; target: HTMLElement } | null>(null)
  const clear = useCallback(() => setChosen(null), [])
  useEffect(() => {
    if (!chosen) return
    const inBar = (target: EventTarget | null) => document.getElementById(barId)?.contains(target as Node)
    const outside = (event: Event) => {
      if (!inBar(event.target) && chartTarget(event.target)?.getAttribute('data-sheet-chart') !== chosen.id) clear()
    }
    const onFocus = (event: FocusEvent) => {
      const chart = chartTarget(event.target)
      if (chart && chart.getAttribute('data-sheet-chart') !== chosen.id) clear()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setChosen(null)
      if (chartTarget(document.activeElement)?.getAttribute('data-sheet-chart') === chosen.id) {
        event.preventDefault()
        if (restoreFocus) restoreFocus()
        else chosen.target.blur()
      } else if (restoreFocus && inBar(document.activeElement)) {
        event.preventDefault()
        restoreFocus()
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', outside, true)
    document.addEventListener('keydown', escape, true)
    document.addEventListener('focusin', onFocus, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('click', outside, true)
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('focusin', onFocus, true)
    }
  }, [barId, chosen, clear, restoreFocus])
  function bind(index: number, focusable = true): ChartSelectionTarget {
    const id = idFor(index)
    return {
      id, focusable, chosen: chosen?.id === id,
      choose: (target, text) => {
        const main = target.ownerDocument.getElementById(id)
        if (!main) return
        main.focus({ preventScroll: true })
        setChosen({ id, text, target: main })
      },
    }
  }
  return { chosen, clear, bind, barId, idFor }
}
