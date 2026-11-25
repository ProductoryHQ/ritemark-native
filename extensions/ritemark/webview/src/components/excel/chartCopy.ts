import { familiesOf, matchingFontFace, readableStyleSheets } from '../../lib/svgFontFaces'

function bundledFontCss(doc: Document, families: ReadonlySet<string>): string {
  let css = ''
  const collect = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const face = matchingFontFace(rule, families)
      // Accept only the bundled font payloads. Copy never fetches fonts.
      if (face && /^url\(["']?data:font\/woff2;base64,[A-Za-z0-9+/=]+["']?\)(?:\s+format\(["']woff2["']\))?$/i.test(face.style.getPropertyValue('src'))) {
        css += face.cssText
      } else if ('cssRules' in rule) {
        collect((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  for (const { rules } of readableStyleSheets(doc)) collect(rules)
  return css
}

// ChartView supplies the SVG geometry, local clip paths, and inline font names.
function serializeChartSvg(svg: SVGSVGElement, width: number, height: number): Blob {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const families = new Set<string>()
  for (const text of copy.querySelectorAll<SVGTextContentElement>('text, tspan')) {
    // Workbook typefaces are names. Fall back when a value looks like a URL.
    if (/[:/\\]|url\s*\(/i.test(text.style.fontFamily)) {
      text.style.fontFamily = "'Ritemark Grid Sans', Carlito, Arial, sans-serif"
    }
    for (const family of familiesOf(text.style.fontFamily)) families.add(family)
  }
  const css = bundledFontCss(svg.ownerDocument, families)
  if (css) {
    const style = svg.ownerDocument.createElementNS(svg.namespaceURI, 'style')
    style.textContent = css
    copy.insertBefore(style, copy.firstChild)
  }
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  return new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' })
}

async function chartPng(svg: SVGSVGElement): Promise<Blob> {
  const { width, height } = svg.viewBox.baseVal
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * 2)
  canvas.height = Math.round(height * 2)
  const context = canvas.getContext('2d')
  if (!context || !canvas.width || !canvas.height) throw new Error('Chart canvas unavailable')

  const image = new Image()
  const url = URL.createObjectURL(serializeChartSvg(svg, width, height))
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Chart SVG could not be loaded'))
      image.src = url
    })
    await image.decode()
    // ChartView sits on white paper in the worksheet.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Chart PNG could not be encoded')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

let copying = false

export async function copyChart(target: HTMLElement): Promise<void> {
  if (copying) return
  const svg = target.querySelector('svg')
  if (!svg) return
  copying = true
  try {
    // Start the write during the Copy gesture while the PNG is still being made.
    const png = chartPng(svg)
    const write = async () => navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    const results = await Promise.allSettled([png, write()])
    if (results.some(({ status }) => status === 'rejected')) throw new Error('Chart copy failed')
  } catch {
    console.warn('Could not copy the Excel chart as a picture.')
  } finally {
    copying = false
  }
}
