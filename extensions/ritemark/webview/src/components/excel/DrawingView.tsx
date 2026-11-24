import type { CSSProperties } from 'react'
import { Icon } from '../ui/Icon'
import { PositionedChart } from './ChartView'
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
  if (drawsChart(drawing.chart)) {
    return (
      <div style={{ ...style, zIndex: 4 }}>
        <PositionedChart chart={drawing.chart} workbook={workbook} version={version} width={width} height={height} />
      </div>
    )
  }
  const what = drawing.what === 'chart' ? 'Chart' : drawing.what === 'image' ? 'Picture' : 'Shape'
  const label = drawing.what === 'chart' && drawing.title ? `Chart: ${drawing.title}` : what
  const small = width < 160 || height < 90
  return (
    <div className="sg-object" style={style} title={`${label}. Kept in the file. Open in Excel to see it.`}>
      <Icon name={drawing.what === 'chart' ? 'chart-bar' : 'image'} size={16} tone="inherit" className="shrink-0" />
      {!small && (
        <div className="min-w-0">
          <div className="sg-object-label">{label}</div>
          <div className="sg-object-sub">Kept in the file. Open in Excel to see it.</div>
        </div>
      )}
    </div>
  )
}
