/**
 * Sprint 138 (#481, R8–R10): equations in the export HTML.
 *
 * The exporters run in the host and draw from HTML, and only the webview can
 * typeset. So before PDF, Word or Google Docs gets the document, each
 * equation element is rewritten into its export form:
 *
 *   <span data-math="inline" data-latex="…" data-source="$…$" data-status="ok"
 *         data-display="false" data-width="21.4" data-height="14.1" data-depth="3.2"
 *         data-mathml="…"><img data-math-image="" src="data:image/png;base64,…" alt="…"></span>
 *
 *  - the picture: KaTeX's typesetting at the export's text size (11 pt), drawn
 *    at 4× through an SVG `foreignObject` that carries KaTeX's stylesheet and
 *    the faces the equation uses as `data:` URLs, so it looks like the editor;
 *  - its width, height and depth below the baseline in CSS px, so the PDF can
 *    sit it on the line;
 *  - KaTeX's MathML, for Word's native equations (Word only);
 *  - `data-status="error"` and no picture when KaTeX can't typeset it: every
 *    exporter then shows its source in the code style and counts it.
 *
 * The payloads keep their shapes; the host reads all of this from the HTML.
 */
import { checkTypesets, prepareMath, typesetToString, type MathAssetsStatus } from '../extensions/math/mathRender'
import { webviewAssetUrl } from './webviewAssets'

export type MathExportTarget = 'pdf' | 'word' | 'google'

/** The export's body size: 11 pt, the PDF template's. */
export const EXPORT_TEXT_PX = 11 * (96 / 72)
/** Pictures at 4×: about 380 dpi at 11 pt, sharp when printed or zoomed to 200%. */
export const EXPORT_SCALE = 4

export interface DrawnEquation {
  png: string
  width: number
  height: number
  depth: number
}

export interface MathExportRenderer {
  /** Resolves whether typesetting (and drawing) is possible in this view. */
  prepare(): Promise<MathAssetsStatus>
  /** Throws KaTeX's error when the LaTeX can't be typeset. */
  check(latex: string, display: boolean): void
  draw(latex: string, display: boolean): Promise<DrawnEquation>
  mathml(latex: string, display: boolean): string
}

const ELEMENT_PATTERN = /<(span|div)(\s+data-math="(?:inline|block)"(?:\s+[\w-]+="[^"]*")*)\s*>([\s\S]*?)<\/\1>/g
const ATTRIBUTE_PATTERN = /\s+([\w-]+)="([^"]*)"/g

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function readAttributes(markup: string): Map<string, string> {
  const attributes = new Map<string, string>()
  for (const match of markup.matchAll(ATTRIBUTE_PATTERN)) attributes.set(match[1], decodeEntities(match[2]))
  return attributes
}

const CLOSE: Record<string, string> = { '$': '$', '$$': '$$', '\\(': '\\)', '\\[': '\\]' }

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

/**
 * Rewrite every equation in `html` into its export form. Equations that can't
 * be typeset get `data-status="error"`; equations whose picture can't be drawn
 * keep `data-status="ok"` without one (Word still converts them).
 */
export async function prepareMathForExport(
  html: string,
  target: MathExportTarget,
  renderer: MathExportRenderer = browserMathRenderer(),
): Promise<string> {
  const source = html || ''
  const matches = Array.from(source.matchAll(ELEMENT_PATTERN))
  if (matches.length === 0) return source

  const status = await renderer.prepare()
  const typesets = status === 'ready' || status === 'unavailable'
  let output = ''
  let cursor = 0
  for (const match of matches) {
    const [whole, tag, attributeMarkup] = match
    const attributes = readAttributes(attributeMarkup)
    const kind = attributes.get('data-math') === 'block' ? 'block' : 'inline'
    const latex = attributes.get('data-latex') ?? ''
    const delimiter = attributes.get('data-delimiter') ?? '$'
    const sourceText = kind === 'block'
      ? `${attributes.get('data-open') ?? '$$'}${latex}${attributes.get('data-close') ?? '$$'}`
      : `${delimiter}${latex}${CLOSE[delimiter] ?? '$'}`
    const display = kind === 'block' || delimiter === '$$' || delimiter === '\\['

    const parts: string[] = [
      `data-math="${kind}"`,
      `data-latex="${escapeAttribute(latex)}"`,
      `data-source="${escapeAttribute(sourceText)}"`,
      `data-display="${display}"`,
    ]
    let body = escapeText(sourceText)

    // An empty equation is not in the file; it is not in the export either.
    if (!latex.trim()) {
      output += source.slice(cursor, match.index)
      cursor = match.index! + whole.length
      continue
    }

    let typeset = false
    if (typesets) {
      try {
        renderer.check(latex, display)
        typeset = true
      } catch {
        typeset = false
      }
    }

    if (!typeset) {
      parts.push('data-status="error"')
    } else {
      parts.push('data-status="ok"')
      if (target === 'word') {
        try {
          parts.push(`data-mathml="${escapeAttribute(renderer.mathml(latex, display))}"`)
        } catch (error) {
          // Only the kind of failure: KaTeX's message quotes the LaTeX.
          console.warn(`[export] MathML failed for an equation (${error instanceof Error ? error.name : typeof error})`)
        }
      }
      if (status === 'ready') {
        try {
          const drawn = await renderer.draw(latex, display)
          parts.push(`data-width="${round(drawn.width)}"`, `data-height="${round(drawn.height)}"`, `data-depth="${round(drawn.depth)}"`)
          body = `<img data-math-image="" src="${drawn.png}" alt="${escapeAttribute(latex)}">`
        } catch (error) {
          console.warn(`[export] an equation could not be drawn; its source goes instead (${error instanceof Error ? error.name : typeof error})`)
        }
      }
    }

    output += source.slice(cursor, match.index) + `<${tag} ${parts.join(' ')}>${body}</${tag}>`
    cursor = match.index! + whole.length
  }
  return output + source.slice(cursor)
}

// ---------------------------------------------------------------------------
// The browser renderer: KaTeX, measured on the page, drawn through SVG
// ---------------------------------------------------------------------------

interface FontFace {
  family: string
  weight: string
  style: string
  file: string
  rule: string
}

let stylesheetText: Promise<{ base: string; faces: FontFace[] }> | null = null
const fontData = new Map<string, Promise<string>>()

async function katexStylesheet(): Promise<{ base: string; faces: FontFace[] }> {
  if (!stylesheetText) {
    stylesheetText = (async () => {
      const url = webviewAssetUrl('katex/katex.min.css')
      if (!url) throw new Error('The KaTeX stylesheet URL is unknown.')
      const css = await (await fetch(url)).text()
      const faces: FontFace[] = []
      const base = css.replace(/@font-face\{([^}]*)\}/g, (rule, body: string) => {
        const family = /font-family:([^;]+)/.exec(body)?.[1].trim() ?? ''
        const weight = /font-weight:([^;]+)/.exec(body)?.[1].trim() ?? '400'
        const style = /font-style:([^;]+)/.exec(body)?.[1].trim() ?? 'normal'
        const file = /url\((fonts\/[^)]+\.woff2)\)/.exec(body)?.[1] ?? ''
        if (file) faces.push({ family, weight: weight === 'bold' ? '700' : weight === 'normal' ? '400' : weight, style, file, rule })
        return ''
      })
      return { base, faces }
    })()
  }
  return stylesheetText
}

function fontAsDataUrl(file: string): Promise<string> {
  let cached = fontData.get(file)
  if (!cached) {
    cached = (async () => {
      const url = webviewAssetUrl(`katex/${file}`)
      if (!url) throw new Error('The KaTeX font URL is unknown.')
      const buffer = await (await fetch(url)).arrayBuffer()
      let binary = ''
      const bytes = new Uint8Array(buffer)
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      }
      return `data:font/woff2;base64,${btoa(binary)}`
    })()
    fontData.set(file, cached)
  }
  return cached
}

/** The faces an element's glyphs use, from their computed styles. */
function facesUsed(root: Element, faces: FontFace[]): FontFace[] {
  const wanted = new Set<string>()
  const elements = [root, ...Array.from(root.querySelectorAll('*'))]
  for (const element of elements) {
    if (!element.textContent) continue
    const style = getComputedStyle(element)
    const family = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
    const weight = Number(style.fontWeight) >= 600 ? '700' : '400'
    const italic = style.fontStyle === 'italic' ? 'italic' : 'normal'
    wanted.add(`${family}|${weight}|${italic}`)
  }
  return faces.filter(face => wanted.has(`${face.family}|${face.weight}|${face.style}`))
}

const MEASURE_STYLE = `.rm-math-export .katex{font-size:1.08em;color:#222222}.rm-math-export .katex-display{margin:0}.rm-math-export .katex-display>.katex{font-size:1.18em}`

/**
 * Typeset off screen at the export size, measure the box and the baseline,
 * then draw the same markup into a canvas at 4×.
 */
async function drawEquation(latex: string, display: boolean): Promise<DrawnEquation> {
  const { base, faces } = await katexStylesheet()
  const host = document.createElement('div')
  host.className = 'rm-math-export'
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-20000px;top:0;font-size:${EXPORT_TEXT_PX}px;line-height:normal;white-space:nowrap;pointer-events:none;visibility:hidden`
  const style = document.createElement('style')
  style.textContent = MEASURE_STYLE
  host.appendChild(style)
  const line = document.createElement('div')
  line.style.cssText = 'font-size:0;line-height:0'
  const markup = typesetToString(latex, { displayMode: display, output: 'html' })
  const holder = document.createElement('div')
  holder.innerHTML = markup
  const katexEl = (holder.querySelector('.katex') as HTMLElement | null)
  if (!katexEl) throw new Error('KaTeX wrote no markup.')
  const size = EXPORT_TEXT_PX * (display ? 1.08 * 1.18 : 1.08)
  katexEl.style.cssText = `display:inline-block;font-size:${size}px;color:#222222`
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  line.appendChild(katexEl)
  line.appendChild(probe)
  host.appendChild(line)
  document.body.appendChild(host)
  try {
    // Lay it out first, so the faces it needs start loading, then wait for them.
    void katexEl.offsetWidth
    await document.fonts.ready
    const box = katexEl.getBoundingClientRect()
    // Across: KaTeX's content can reach a little outside its box (italic
    // corrections), so the widest of the box and its parts.
    let left = box.left
    let right = box.right
    for (const part of Array.from(katexEl.querySelectorAll('.base'))) {
      const rect = part.getBoundingClientRect()
      left = Math.min(left, rect.left)
      right = Math.max(right, rect.right)
    }
    // Up and down: each part's strut is the formula's TeX height and depth.
    // The box itself is a line box at KaTeX's line height, taller than the
    // formula, which would open up every PDF line that holds an equation.
    let top = Infinity
    let bottom = -Infinity
    for (const strut of Array.from(katexEl.querySelectorAll('.strut'))) {
      const rect = strut.getBoundingClientRect()
      top = Math.min(top, rect.top)
      bottom = Math.max(bottom, rect.bottom)
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) {
      top = box.top
      bottom = box.bottom
    }
    const baseline = probe.getBoundingClientRect().top
    const pad = 1
    const width = right - left + pad * 2
    const height = bottom - top + pad * 2
    const depth = bottom - baseline + pad
    const lineRect = line.getBoundingClientRect()

    const used = facesUsed(katexEl, faces)
    const fontRules = await Promise.all(used.map(async face => face.rule.replace(face.file, await fontAsDataUrl(face.file))))
    const clone = katexEl.cloneNode(true) as HTMLElement
    const xhtml = new XMLSerializer().serializeToString(clone)
    const offsetX = pad - (left - lineRect.left)
    const offsetY = pad - (top - lineRect.top)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
      + `<foreignObject x="0" y="0" width="${width}" height="${height}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;font-size:${EXPORT_TEXT_PX}px">`
      + `<style>${fontRules.join('')}${base}</style>`
      + `<div style="position:absolute;left:${offsetX}px;top:${offsetY}px;font-size:0;line-height:0;white-space:nowrap">${xhtml}</div>`
      + '</div></foreignObject></svg>'
    const png = await rasterize(svg, width, height)
    return { png, width, height, depth }
  } finally {
    host.remove()
  }
}

async function rasterize(svg: string, width: number, height: number): Promise<string> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * EXPORT_SCALE))
  canvas.height = Math.max(1, Math.ceil(height * EXPORT_SCALE))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')
  context.scale(EXPORT_SCALE, EXPORT_SCALE)
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

/** KaTeX's MathML for Word, without the wrapping span. */
function mathmlFor(latex: string, display: boolean): string {
  const markup = typesetToString(latex, { displayMode: display, output: 'mathml' })
  const match = /<math[\s\S]*<\/math>/.exec(markup)
  if (!match) throw new Error('KaTeX wrote no MathML.')
  return match[0]
}

export function browserMathRenderer(): MathExportRenderer {
  return {
    prepare: () => prepareMath(),
    check: (latex, display) => {
      const result = checkTypesets(latex, display)
      if (!result.ok) throw result.error
    },
    draw: drawEquation,
    mathml: mathmlFor,
  }
}
