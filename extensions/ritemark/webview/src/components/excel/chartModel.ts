export type PlotKind = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter'
export type ChartKind = PlotKind | 'combo' | 'chartex' | 'unknown' | `${string}Chart`
export type ChartValue = string | number | boolean
export type SeriesField = 'tx' | 'cat' | 'val' | 'xVal' | 'yVal'

/** Indexed points keep blanks in their original positions, including in sparse caches. */
export interface ChartData {
  formula?: string
  type: 'number' | 'string'
  pointCount?: number
  points: ReadonlyMap<number, ChartValue>
  formatCode?: string
  levels?: ReadonlyMap<number, ChartValue>[]
}

export interface ChartShape {
  fill?: string
  line?: string
  lineWidth?: number
  dash?: string
  noFill?: boolean
  noLine?: boolean
}

export interface ChartTextStyle {
  size?: number
  bold?: boolean
  italic?: boolean
  font?: string
  color?: string
  rotation?: number
}

export interface ChartTitle {
  text?: string
  reference?: ChartData
  style?: ChartTextStyle
  runs?: { text: string; style?: ChartTextStyle }[]
  overlay?: boolean
}

export interface ChartNumberFormat {
  formatCode?: string
  sourceLinked?: boolean
}

export interface ChartLabels {
  showLegendKey?: boolean
  showVal?: boolean
  showCatName?: boolean
  showSerName?: boolean
  showPercent?: boolean
  showBubbleSize?: boolean
  showLeaderLines?: boolean
  position?: string
  separator?: string
  numberFormat?: ChartNumberFormat
  style?: ChartTextStyle
  shape?: ChartShape
  leaderLines?: ChartShape
  deleted?: boolean
  entries?: (ChartLabels & { index: number; text?: ChartTitle })[]
}

export interface ChartMarker {
  symbol?: string
  size?: number
  shape?: ChartShape
}

export interface ChartSeries extends Partial<Record<SeriesField, ChartData>> {
  index?: number
  order?: number
  shape?: ChartShape
  marker?: ChartMarker
  smooth?: boolean
  labels?: ChartLabels
  pointStyles: { index: number; shape?: ChartShape; marker?: ChartMarker; explosion?: number }[]
  explosion?: number
}

export interface ChartPlot {
  kind: PlotKind
  series: ChartSeries[]
  axisIds: number[]
  barDir?: string
  grouping?: string
  varyColors?: boolean
  gapWidth?: number
  overlap?: number
  holeSize?: number
  firstSliceAng?: number
  scatterStyle?: string
  marker?: boolean
  smooth?: boolean
  labels?: ChartLabels
}

export interface ChartAxis {
  kind: 'value' | 'category' | 'date' | 'series'
  id?: number
  crossAxisId?: number
  position?: string
  deleted?: boolean
  orientation?: string
  min?: number
  max?: number
  logBase?: number
  majorUnit?: number
  minorUnit?: number
  majorTimeUnit?: string
  minorTimeUnit?: string
  baseTimeUnit?: string
  crosses?: string
  crossesAt?: number
  crossBetween?: string
  majorTickMark?: string
  minorTickMark?: string
  tickLabelPosition?: string
  tickLabelSkip?: number
  tickMarkSkip?: number
  labelOffset?: number
  majorGridlines?: ChartShape
  minorGridlines?: ChartShape
  numberFormat?: ChartNumberFormat
  title?: ChartTitle
  textStyle?: ChartTextStyle
  shape?: ChartShape
}

export type ChartModel =
  | { supported: false; kind: ChartKind }
  | {
      supported: true
      kind: PlotKind | 'combo'
      plots: ChartPlot[]
      axes: ChartAxis[]
      title?: ChartTitle
      legend?: {
        position?: string
        overlay?: boolean
        textStyle?: ChartTextStyle
        shape?: ChartShape
        entries: { index: number; deleted?: boolean; textStyle?: ChartTextStyle }[]
      }
      textStyle?: ChartTextStyle
      style?: number
      accentColors: string[]
      displayBlanksAs?: string
      plotVisibleOnly?: boolean
    }
