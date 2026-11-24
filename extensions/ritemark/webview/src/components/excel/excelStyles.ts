/**
 * Sprint 158 (#711): a workbook's styles part (`xl/styles.xml`) and theme (`xl/theme/theme1.xml`), read for the
 * preview. PR 2 read each cell style's number format; PR 3 adds what the sheet grid draws: fonts, fills, borders and
 * alignment, with theme colours, tints (ECMA-376 §18.8.19, in HLS) and the indexed palette resolved to CSS colours.
 * Ported from the study's and the spike's styles.cjs (research/spike/render/styles.cjs).
 */
import { attr, decodeXmlEntities } from '../../../../src/excel/sheetXml'

export interface FontStyle {
  name?: string
  /** Points. */
  size: number
  bold: boolean
  italic: boolean
  underline?: 'single' | 'double' | 'singleAccounting' | 'doubleAccounting'
  strike: boolean
  color?: string
  vertAlign?: 'superscript' | 'subscript'
}

export interface BorderSide {
  /** Pixels. */
  width: number
  style: 'solid' | 'dotted' | 'dashed' | 'double'
  color: string
}

export interface CellBorders {
  left?: BorderSide
  right?: BorderSide
  top?: BorderSide
  bottom?: BorderSide
}

export interface CellAlignment {
  horizontal?: string
  vertical?: string
  wrap: boolean
  indent: number
  /** 0–180 as Excel stores it; 255 is stacked text. */
  rotation: number
  shrink: boolean
}

export interface CellStyle {
  numFmtId: number
  font: FontStyle
  /** A CSS background: a colour or a gradient. */
  fill?: string
  border?: CellBorders
  align: CellAlignment
}

export interface ThemeInfo {
  /** lt1, dk1, lt2, dk2, accent1–6, hlink, folHlink: the order theme indexes use. */
  colors: string[]
  minorFont?: string
  majorFont?: string
}

export interface WorkbookStyles {
  /** The workbook's own number formats, by numFmtId. */
  numFmts: Map<number, string>
  /** Each cell style's (cellXfs entry's) numFmtId, by the cell's `s`. */
  xfNumFmt: number[]
  /** Each cell style, by the cell's `s`. */
  xfs: CellStyle[]
  /** The Normal style's font: the sheet's default, and what column widths are measured in. */
  baseFont: FontStyle
  theme: ThemeInfo
  /** Font families the workbook uses, for the font fallbacks. */
  families: string[]
}

/** Excel's default indexed palette. */
const INDEXED = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
]

/** The text between an element's start and end tags, any prefix; '' when it isn't there. */
export function section(xml: string, tag: string): string {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml)
  return m ? m[1] : ''
}

/** Each element named `tag`: its attributes and its content ('' when self-closing). */
function each(xml: string, tag: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const m of xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'g'))) {
    out.push([m[1], m[2] ?? ''])
  }
  return out
}

export function readTheme(xml: string): ThemeInfo {
  const scheme = section(xml, 'clrScheme')
  const order = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
  const c: Record<string, string> = {}
  for (const name of order) {
    const body = section(scheme, name)
    const srgb = /srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/.exec(body)
    const sys = /sysClr\b[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(body)
    const fallback: Record<string, string> = {
      dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5',
      accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72',
    }
    c[name] = (srgb ? srgb[1] : sys ? sys[1] : fallback[name]).toUpperCase()
  }
  const minor = /<(?:\w+:)?minorFont>[\s\S]*?<(?:\w+:)?latin\b[^>]*typeface="([^"]*)"/.exec(xml)
  const major = /<(?:\w+:)?majorFont>[\s\S]*?<(?:\w+:)?latin\b[^>]*typeface="([^"]*)"/.exec(xml)
  return {
    // theme indexes 0–3 are lt1, dk1, lt2, dk2: the scheme's first two pairs swapped (§18.8.3)
    colors: [c.lt1, c.dk1, c.lt2, c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5, c.accent6, c.hlink, c.folHlink],
    minorFont: minor?.[1] || undefined,
    majorFont: major?.[1] || undefined,
  }
}

interface Luminance {
  multiplier: number
  offset: number
}

/** Apply a SpreadsheetML tint or DrawingML luminance transform in HLS. */
export function applyTint(hex: string, tint: number, luminance?: Luminance): string {
  if (!tint && !luminance) return hex
  let r = parseInt(hex.slice(0, 2), 16) / 255
  let g = parseInt(hex.slice(2, 4), 16) / 255
  let b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  let l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  l = luminance
    ? Math.min(1, Math.max(0, l * luminance.multiplier + luminance.offset))
    : tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue(p, q, h + 1 / 3)
    g = hue(p, q, h)
    b = hue(p, q, h - 1 / 3)
  }
  return [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export interface ColorContext {
  theme: ThemeInfo
  indexed: string[]
}

/** A `<color>`, `<fgColor>`, `<tabColor>`… tag as a CSS colour; undefined for "automatic" or none. */
export function colorOf(tag: string | undefined, ctx: ColorContext, luminance?: Luminance): string | undefined {
  if (!tag) return undefined
  if (attr(tag, 'auto') === '1' || attr(tag, 'auto') === 'true') return undefined
  let hex: string | undefined
  const rgb = attr(tag, 'rgb')
  const theme = attr(tag, 'theme')
  const indexed = attr(tag, 'indexed')
  if (rgb && /^[0-9A-Fa-f]{6,8}$/.test(rgb)) hex = rgb.slice(-6).toUpperCase()
  else if (theme !== undefined) hex = ctx.theme.colors[Number(theme)]
  else if (indexed !== undefined) {
    const i = Number(indexed)
    if (i === 64 || i === 65) return undefined // system foreground and background
    hex = ctx.indexed[i]
  }
  if (!hex) return undefined
  return '#' + applyTint(hex, Number(attr(tag, 'tint') ?? 0), luminance)
}

const BORDER: Record<string, [number, BorderSide['style']]> = {
  thin: [1, 'solid'], hair: [1, 'dotted'], dotted: [1, 'dotted'], dashed: [1, 'dashed'], dashDot: [1, 'dashed'], dashDotDot: [1, 'dashed'],
  medium: [2, 'solid'], mediumDashed: [2, 'dashed'], mediumDashDot: [2, 'dashed'], mediumDashDotDot: [2, 'dashed'], slantDashDot: [2, 'dashed'],
  thick: [3, 'solid'], double: [3, 'double'],
}

/** A `<font>` or a rich-text run's `<rPr>` body as a font. */
export function fontOf(body: string, ctx: ColorContext, base?: FontStyle): FontStyle {
  const v = (t: string) => {
    const m = new RegExp(`<(?:\\w+:)?${t}(?=[\\s/>])([^>]*?)\\/?>`).exec(body)
    return m ? attr(m[1], 'val') ?? 'true' : undefined
  }
  const on = (x: string | undefined) => x !== undefined && x !== '0' && x !== 'false'
  const scheme = v('scheme')
  const name = scheme === 'minor' && ctx.theme.minorFont ? ctx.theme.minorFont
    : scheme === 'major' && ctx.theme.majorFont ? ctx.theme.majorFont
      : v('name') ?? v('rFont') ?? base?.name
  const u = v('u')
  const size = v('sz')
  const colorTag = /<(?:\w+:)?color(?=[\s/>])[^>]*\/?>/.exec(body)?.[0]
  const vert = v('vertAlign')
  return {
    name: name ? decodeXmlEntities(name) : undefined,
    size: size !== undefined ? Number(size) : base?.size ?? 11,
    bold: on(v('b')),
    italic: on(v('i')),
    underline: u === undefined || u === 'none' ? undefined : u === 'true' ? 'single' : (u as FontStyle['underline']),
    strike: on(v('strike')),
    color: colorOf(colorTag, ctx),
    vertAlign: vert === 'superscript' || vert === 'subscript' ? vert : undefined,
  }
}

function fillOf(body: string, ctx: ColorContext): string | undefined {
  const p = /<(?:\w+:)?patternFill(?=[\s/>])([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?patternFill>)/.exec(body)
  if (p) {
    const inner = p[2] ?? ''
    const type = attr(p[1], 'patternType') ?? (inner.includes('fgColor') ? 'solid' : 'none')
    if (type === 'none') return undefined
    const fg = colorOf(/<(?:\w+:)?fgColor(?=[\s/>])[^>]*\/?>/.exec(inner)?.[0], ctx)
    const bg = colorOf(/<(?:\w+:)?bgColor(?=[\s/>])[^>]*\/?>/.exec(inner)?.[0], ctx)
    if (type === 'gray125' || type === 'gray0625') return fg ?? undefined
    // patterns are drawn as their foreground colour, as the study found Excel's renders read at a glance
    return fg ?? bg
  }
  const g = /<(?:\w+:)?gradientFill(?=[\s/>])([^>]*)>([\s\S]*?)<\/(?:\w+:)?gradientFill>/.exec(body)
  if (g) {
    const stops = each(g[2], 'stop').map(([sa, sb]) => {
      const colour = colorOf(/<(?:\w+:)?color(?=[\s/>])[^>]*\/?>/.exec(sb)?.[0], ctx) ?? '#FFFFFF'
      return `${colour} ${Number(attr(sa, 'position') ?? 0) * 100}%`
    })
    if (stops.length) return `linear-gradient(${90 + Number(attr(g[1], 'degree') ?? 0)}deg, ${stops.join(', ')})`
  }
  return undefined
}

function bordersOf(body: string, ctx: ColorContext): CellBorders | undefined {
  const side = (name: string): BorderSide | undefined => {
    const m = new RegExp(`<(?:\\w+:)?${name}(?=[\\s/>])([^>]*?)(?:\\/>|>([\\s\\S]*?)</(?:\\w+:)?${name}>)`).exec(body)
    const style = m ? attr(m[1], 'style') : undefined
    if (!m || !style || !BORDER[style]) return undefined
    const colour = colorOf(/<(?:\w+:)?color(?=[\s/>])[^>]*\/?>/.exec(m[2] ?? '')?.[0], ctx) ?? '#000000'
    return { width: BORDER[style][0], style: BORDER[style][1], color: colour }
  }
  const b: CellBorders = { left: side('left') ?? side('start'), right: side('right') ?? side('end'), top: side('top'), bottom: side('bottom') }
  return b.left || b.right || b.top || b.bottom ? b : undefined
}

const NO_ALIGN: CellAlignment = { wrap: false, indent: 0, rotation: 0, shrink: false }

export function readStyles(xml: string, themeXml = ''): WorkbookStyles {
  const theme = readTheme(themeXml)
  const custom = each(section(xml, 'indexedColors'), 'rgbColor').map(([a]) => (attr(a, 'rgb') ?? '000000').slice(-6).toUpperCase())
  const ctx: ColorContext = { theme, indexed: custom.length ? custom : INDEXED }

  const numFmts = new Map<number, string>()
  for (const [a] of each(section(xml, 'numFmts'), 'numFmt')) {
    const id = Number(attr(a, 'numFmtId'))
    const code = attr(a, 'formatCode')
    if (Number.isInteger(id) && code !== undefined) numFmts.set(id, decodeXmlEntities(code))
  }
  const fonts = each(section(xml, 'fonts'), 'font').map(([, body]) => fontOf(body, ctx))
  const baseFont = fonts[0] ?? { name: theme.minorFont ?? 'Calibri', size: 11, bold: false, italic: false, strike: false }
  if (!baseFont.name) baseFont.name = theme.minorFont ?? 'Calibri'
  const fills = each(section(xml, 'fills'), 'fill').map(([, body]) => fillOf(body, ctx))
  const borders = each(section(xml, 'borders'), 'border').map(([, body]) => bordersOf(body, ctx))

  const xfNumFmt: number[] = []
  const xfs: CellStyle[] = []
  for (const [a, body] of each(section(xml, 'cellXfs'), 'xf')) {
    const numFmtId = Number(attr(a, 'numFmtId') ?? '0') || 0
    xfNumFmt.push(numFmtId)
    const al = /<(?:\w+:)?alignment(?=[\s/>])([^>]*?)\/?>/.exec(body)
    const font = fonts[Number(attr(a, 'fontId') ?? '0')] ?? baseFont
    xfs.push({
      numFmtId,
      font: { ...font, name: font.name ?? baseFont.name },
      fill: fills[Number(attr(a, 'fillId') ?? '0')],
      border: borders[Number(attr(a, 'borderId') ?? '0')],
      align: al
        ? {
            horizontal: attr(al[1], 'horizontal'),
            vertical: attr(al[1], 'vertical'),
            wrap: /^(1|true)$/.test(attr(al[1], 'wrapText') ?? ''),
            indent: Number(attr(al[1], 'indent') ?? 0) || 0,
            rotation: Number(attr(al[1], 'textRotation') ?? 0) || 0,
            shrink: /^(1|true)$/.test(attr(al[1], 'shrinkToFit') ?? ''),
          }
        : NO_ALIGN,
    })
  }
  const families = [...new Set(fonts.map((f) => f.name).filter((n): n is string => !!n))]
  return { numFmts, xfNumFmt, xfs, baseFont, theme, families }
}

/** The colour context of a workbook's styles, for tab colours and rich-text runs. */
export function colorContext(styles: WorkbookStyles, stylesXml: string): ColorContext {
  const custom = each(section(stylesXml, 'indexedColors'), 'rgbColor').map(([a]) => (attr(a, 'rgb') ?? '000000').slice(-6).toUpperCase())
  return { theme: styles.theme, indexed: custom.length ? custom : INDEXED }
}
