import { Component, memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { layoutChart, type ChartLayout } from './chartLayout'
import type { ChartMarker, ChartShape, ChartTextStyle } from './chartModel'
import { resolveSeries } from './chartSeries'
import { measure, forgetMeasures } from './gridTextMeasure'
import type { WorkbookModel } from './readWorkbook'
import { fontCss, fontShorthand, GRID_SANS } from './sheetLayout'

const chartFont = { name: GRID_SANS, size: 9, bold: false, italic: false, strike: false }
const fontOf = (style: ChartTextStyle) => ({
  name: !style.font || style.font === 'Calibri' || style.font.startsWith('+') ? GRID_SANS : style.font,
  size: style.size, bold: style.bold, italic: style.italic, color: style.color,
})
const measureChartText = (text: string, style: ChartTextStyle) => measure(text, fontShorthand(fontOf(style), chartFont))

const dashes: Record<string, string> = {
  dot: '1 3', sysDot: '1 2', dash: '5 3', sysDash: '3 2', lgDash: '9 4',
  dashDot: '5 3 1 3', sysDashDot: '3 2 1 2', lgDashDot: '9 4 1 4',
  lgDashDotDot: '9 4 1 4 1 4', sysDashDotDot: '3 2 1 2 1 2',
}
function stroke(shape: ChartShape | undefined, color: string, width = 1) {
  return {
    stroke: shape?.noLine ? 'none' : shape?.line ?? color,
    strokeWidth: shape?.lineWidth ?? width,
    strokeDasharray: shape?.dash ? dashes[shape.dash] : undefined,
  }
}

function Marker({ x, y, marker, color }: { x: number; y: number; marker: ChartMarker; color: string }) {
  const r = (marker.size ?? 5) * 2 / 3
  const shape = { fill: marker.shape?.noFill ? 'none' : marker.shape?.fill ?? color, ...stroke(marker.shape, color) }
  switch (marker.symbol) {
    case 'square': return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...shape} />
    case 'diamond': return <polygon points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`} {...shape} />
    case 'triangle': return <polygon points={`${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}`} {...shape} />
    case 'plus': return <path d={`M${x-r},${y}h${2*r} M${x},${y-r}v${2*r}`} {...shape} />
    case 'x': return <path d={`M${x-r},${y-r}l${2*r},${2*r} M${x-r},${y+r}l${2*r},${-2*r}`} {...shape} />
    case 'star': return <path d={`M${x-r},${y}h${2*r} M${x},${y-r}v${2*r} M${x-r},${y-r}l${2*r},${2*r} M${x-r},${y+r}l${2*r},${-2*r}`} {...shape} />
    case 'dash': return <path d={`M${x-r},${y}h${2*r}`} {...shape} />
    case 'dot': return <circle cx={x} cy={y} r={r / 2} {...shape} />
    default: return <circle cx={x} cy={y} r={r} {...shape} />
  }
}

function Text({ x, y, text, anchor, style }: ChartLayout['axisLabels'][number]) {
  const { color, ...font } = fontCss(fontOf(style), chartFont)
  return <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fill={color}
    transform={style.rotation ? `rotate(${style.rotation} ${x} ${y})` : undefined} style={font}>{text}</text>
}

function Rules({ rules, color }: { rules: ChartLayout['gridlines']; color: string }) {
  return <>{rules.map(({ from, to, shape }, i) => <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...stroke(shape, color)} />)}</>
}

function smoothPath(points: ChartLayout['lines'][number]['segments'][number]): string {
  return points.map((p, i) => {
    if (!i) return `M ${p.x} ${p.y}`
    const start = points[i - 1]
    const before = points[i - 2] ?? start
    const after = points[i + 1] ?? p
    const c1 = { x: start.x + (p.x - before.x) / 6, y: start.y + (p.y - before.y) / 6 }
    const c2 = { x: p.x - (after.x - start.x) / 6, y: p.y - (after.y - start.y) / 6 }
    return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.x} ${p.y}`
  }).join(' ')
}

export const ChartView = memo(function ChartView({ layout }: { layout: ChartLayout }) {
  const clip = useId()
  const { width, height, plot, legend, plotShape, chartShape } = layout
  const borderInset = Math.min((chartShape?.lineWidth ?? 1) / 2, width / 2, height / 2)
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={layout.name}
      style={{ display: 'block', background: '#ffffff', forcedColorAdjust: 'none' }}>
      <defs><clipPath id={clip}><rect {...plot} /></clipPath></defs>
      <rect data-chart="chart-border" x={borderInset} y={borderInset}
        width={width - 2 * borderInset} height={height - 2 * borderInset}
        fill={chartShape?.noFill ? 'none' : chartShape?.fill ?? 'none'} {...stroke(chartShape, '#898989')} />
      {plotShape && !plotShape.noFill && plotShape.fill && <rect {...plot} fill={plotShape.fill} />}
      <g data-chart="gridlines"><Rules rules={layout.gridlines} color="#d9d9d9" /></g>
      <g clipPath={`url(#${clip})`}>
        <g data-chart="bars">{layout.bars.map(({ x, y, width, height, color, shape, index, series }) =>
          <rect key={`${series}:${index}`} {...{ x, y, width, height }} fill={shape?.noFill ? 'none' : color} {...stroke(shape, 'none')} />)}</g>
        <g data-chart="lines">{layout.lines.flatMap(({ segments, shape, color, smooth }, i) => segments.map((points, j) =>
          smooth ? <path key={`${i}:${j}`} d={smoothPath(points)} fill="none" {...stroke(shape, color, 2.25)} />
            : <polyline key={`${i}:${j}`} points={points.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" {...stroke(shape, color, 2.25)} />,
        ))}</g>
      </g>
      {plotShape && <rect data-chart="plot-area" {...plot} fill="none" {...stroke(plotShape, plotShape.hasLine ? '#898989' : 'none')} />}
      <g data-chart="axes"><Rules rules={layout.axes} color="#898989" /></g>
      <g data-chart="markers">{layout.markers.map((marker, i) => <Marker key={i} {...marker} />)}</g>
      <g data-chart="axis-labels">{layout.axisLabels.map((label, i) => <Text key={i} {...label} />)}</g>
      <g data-chart="titles">{layout.titles.map((label, i) => <Text key={i} {...label} />)}</g>
      <g data-chart="data-labels">{layout.dataLabels.map(({ shape, width, height, keyColor, ...label }, i) => (
        <g key={i}>
          {shape && <rect x={label.x - width / 2 - 2} y={label.y - height / 2 - 1} width={width + 4} height={height + 2}
            fill={shape.noFill ? 'none' : shape.fill ?? 'none'} {...stroke(shape, 'none')} />}
          {keyColor && <rect x={label.x - width / 2 - 9} y={label.y - 3} width={6} height={6} fill={keyColor} />}
          <Text {...label} />
        </g>
      ))}</g>
      {legend && <g data-chart="legend">
        {legend.shape && <rect {...legend.bounds} fill={legend.shape.noFill ? 'none' : legend.shape.fill ?? 'none'} {...stroke(legend.shape, 'none')} />}
        {legend.entries.map(({ key, label, color, shape, marker }, i) => {
          const middle = key.y + key.height / 2
          return <g key={i}>
            {key.width > 7
              ? <line x1={key.x} y1={middle} x2={key.x + key.width} y2={middle} {...stroke(shape, color, 2.25)} />
              : <rect {...key} fill={shape?.noFill ? 'none' : color} {...stroke(shape, 'none')} />}
            {marker && <Marker x={key.x + key.width / 2} y={middle} marker={marker} color={color} />}
            <Text {...label} />
          </g>
        })}
      </g>}
    </svg>
  )
})

interface ChartProps {
  chart: Parameters<typeof layoutChart>[0]
  workbook: WorkbookModel
  version: number
}
interface PositionedChartProps extends ChartProps {
  width?: number
  height?: number
}

export class ChartErrorBoundary extends Component<ChartProps & { children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previous: ChartProps) {
    if (this.state.failed && (previous.chart !== this.props.chart ||
      previous.workbook !== this.props.workbook || previous.version !== this.props.version)) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export const PositionedChart = memo(function PositionedChart({ chart, workbook, version, width, height }: PositionedChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [fontVersion, setFontVersion] = useState(0)
  useEffect(() => {
    if (width !== undefined && height !== undefined || !container.current) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [width, height])
  useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return
    let mounted = true
    const refresh = () => {
      if (!mounted) return
      forgetMeasures()
      setFontVersion((n) => n + 1)
    }
    // Canvas measures before a webfont is ready on the first render.
    void Promise.allSettled([400, 700].flatMap((weight) =>
      ['normal', 'italic'].map((style) => fonts.load(`${style} ${weight} 12px "${GRID_SANS}"`)),
    )).then(refresh)
    fonts.addEventListener('loadingdone', refresh)
    return () => { mounted = false; fonts.removeEventListener('loadingdone', refresh) }
  }, [])
  const series = useMemo(() => resolveSeries(chart, workbook.sheets, workbook)[0], [chart, workbook, version])
  const w = width ?? size.width
  const h = height ?? size.height
  const layout = useMemo(() => w > 0 && h > 0 ? layoutChart(chart, series, w, h, measureChartText, workbook.date1904) : undefined,
    [chart, series, w, h, workbook.date1904, fontVersion])
  const style: CSSProperties = { width: '100%', height: '100%', background: '#fff', overflow: 'hidden' }
  return <div ref={container} style={style}>{layout && <ChartView layout={layout} />}</div>
})
