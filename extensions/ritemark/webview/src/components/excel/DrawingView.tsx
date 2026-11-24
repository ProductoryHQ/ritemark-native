import { cloneElement, useCallback, useEffect, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { ChartErrorBoundary, PositionedChart } from './ChartView'
import { drawsChart } from './chartLayout'
import type { DrawingModel, WorkbookModel } from './readWorkbook'

export type ChartFailureReporter = (drawing: DrawingModel, change: 1 | -1) => void

/** Report only committed fallbacks, including when the chart later recovers. */
export function FailedChart({ drawing, report, children }: {
  drawing: DrawingModel
  report?: ChartFailureReporter
  children: ReactNode
}) {
  useEffect(() => {
    report?.(drawing, 1)
    return () => report?.(drawing, -1)
  }, [drawing, report])
  return children
}

interface DrawingViewProps {
  drawing: DrawingModel
  style: CSSProperties
  workbook: WorkbookModel
  version: number
  width: number
  height: number
  onChartFailure?: ChartFailureReporter
}

export function DrawingView({ drawing, style, workbook, version, width, height, onChartFailure }: DrawingViewProps) {
  const what = drawing.what === 'chart' ? 'Chart' : drawing.what === 'image' ? 'Picture' : 'Shape'
  const label = drawing.what === 'chart' && drawing.title ? `Chart: ${drawing.title}` : what
  const small = width < 160 || height < 90
  const icon = drawing.what === 'chart' ? 'chart-bar' : 'image'
  const card = useCallback((reason?: string) => {
    const message = `${reason ? `${reason} ` : ''}Kept in the file. Open in Excel to see it.`
    return (
      <div className="sg-object" style={{ width: '100%', height: '100%' }} title={`${label}. ${message}`}>
        <Icon name={icon} size={16} tone="inherit" className="shrink-0" />
        {!small && (
          <div className="min-w-0">
            <div className="sg-object-label">{label}</div>
            <div className="sg-object-sub">{message}</div>
          </div>
        )}
      </div>
    )
  }, [icon, label, small])
  const fallback = cloneElement(card(), { style })
  if (!drawsChart(drawing.chart)) return fallback
  return (
    <ChartErrorBoundary chart={drawing.chart} workbook={workbook} version={version} fallback={<FailedChart drawing={drawing} report={onChartFailure}>{fallback}</FailedChart>}>
      <div style={{ ...style, zIndex: 4 }}>
        <PositionedChart chart={drawing.chart} workbook={workbook} version={version} width={width} height={height} emptyFallback={card} />
      </div>
    </ChartErrorBoundary>
  )
}
