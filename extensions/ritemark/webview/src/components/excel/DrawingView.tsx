import { cloneElement, useCallback, type CSSProperties } from 'react'
import { Icon } from '../ui/Icon'
import { ChartErrorBoundary, PositionedChart } from './ChartView'
import { drawsChart } from './chartLayout'
import type { DrawingModel, WorkbookModel } from './readWorkbook'

interface DrawingViewProps {
  drawing: DrawingModel
  style: CSSProperties
  workbook: WorkbookModel
  version: number
  width: number
  height: number
}

export function DrawingView({ drawing, style, workbook, version, width, height }: DrawingViewProps) {
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
    <ChartErrorBoundary chart={drawing.chart} workbook={workbook} version={version} fallback={fallback}>
      <div style={{ ...style, zIndex: 4 }}>
        <PositionedChart chart={drawing.chart} workbook={workbook} version={version} width={width} height={height} emptyFallback={card} />
      </div>
    </ChartErrorBoundary>
  )
}
