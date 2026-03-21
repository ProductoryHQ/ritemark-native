/**
 * Mermaid diagram rendering helper.
 * Lazily initializes mermaid on first use and exports a render function.
 *
 * @see Sprint 46: Mermaid Diagram Rendering
 */

let mermaidModule: typeof import('mermaid') | null = null
let initialized = false

// Detect VS Code theme from body class
function getTheme(): 'dark' | 'neutral' {
  return document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast')
    ? 'dark'
    : 'neutral'
}

function getMermaidConfig() {
  const styles = getComputedStyle(document.documentElement)
  const bodyStyles = getComputedStyle(document.body)
  const isDark = getTheme() === 'dark'

  const foreground = styles.getPropertyValue('--foreground').trim() || (isDark ? '#e5e7eb' : '#1f2937')
  const border = styles.getPropertyValue('--border').trim() || (isDark ? '#374151' : '#d1d5db')
  const primary = styles.getPropertyValue('--primary').trim() || '#4338ca'
  const editorBackground = styles.getPropertyValue('--background').trim() || (isDark ? '#111827' : '#ffffff')
  const fontFamily = bodyStyles.fontFamily || "'Sofia Sans', sans-serif"

  return {
    startOnLoad: false,
    securityLevel: 'strict' as const,
    theme: 'base' as const,
    htmlLabels: false,
    fontFamily,
    themeVariables: {
      fontFamily,
      fontSize: '13px',
      textColor: foreground,
      lineColor: isDark ? '#8b9bb4' : '#64748b',
      edgeLabelBackground: isDark ? '#111827' : '#ffffff',
      primaryColor: isDark ? '#232846' : '#eef2ff',
      primaryTextColor: isDark ? '#f8fafc' : '#27304a',
      primaryBorderColor: isDark ? '#7c8cff' : primary,
      secondaryColor: isDark ? '#1a2033' : '#f8fafc',
      tertiaryColor: isDark ? '#20263a' : '#f5f3ff',
      clusterBkg: isDark ? '#161d2d' : '#f8fafc',
      clusterBorder: isDark ? '#4b5563' : border,
      mainBkg: isDark ? '#232846' : '#eef2ff',
      nodeBorder: isDark ? '#7c8cff' : primary,
      background: editorBackground,
    },
    flowchart: {
      curve: 'basis',
    },
  }
}

async function waitForMermaidFonts() {
  const fonts = document.fonts

  if (!fonts) {
    return
  }

  try {
    await fonts.ready
    await Promise.allSettled([
      fonts.load("13px 'Sofia Sans'"),
      fonts.load("600 13px 'Sofia Sans'"),
    ])
  } catch {
    // Fall back silently if the browser cannot resolve font readiness.
  }
}

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid')
  }
  const mermaid = mermaidModule.default

  if (!initialized) {
    mermaid.initialize(getMermaidConfig())
    initialized = true
  }

  return mermaid
}

/**
 * Render a mermaid diagram source string to SVG.
 * Returns the SVG string, or throws on invalid syntax.
 */
export async function renderMermaid(id: string, source: string): Promise<string> {
  await waitForMermaidFonts()
  const mermaid = await getMermaid()

  // Re-apply theme config in case the user switched VS Code themes.
  mermaid.initialize(getMermaidConfig())

  const { svg } = await mermaid.render(id, source)
  return svg
}

/**
 * Ensure the SVG has explicit width/height attributes so the browser
 * reports correct naturalWidth/naturalHeight when loaded via blob URL.
 * Mermaid SVGs often rely on CSS max-width + viewBox, which causes the
 * Image element to fall back to 300×150 (CSS default for replaced elements).
 */
function ensureSvgDimensions(svg: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.documentElement

  const hasWidth = svgEl.hasAttribute('width') && !/^\s*100%\s*$/.test(svgEl.getAttribute('width') || '')
  const hasHeight = svgEl.hasAttribute('height') && !/^\s*100%\s*$/.test(svgEl.getAttribute('height') || '')

  if (hasWidth && hasHeight) {
    return svg
  }

  // Extract dimensions from viewBox
  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/)
    if (parts.length === 4) {
      const vbWidth = parseFloat(parts[2])
      const vbHeight = parseFloat(parts[3])
      if (vbWidth > 0 && vbHeight > 0) {
        svgEl.setAttribute('width', String(Math.ceil(vbWidth)))
        svgEl.setAttribute('height', String(Math.ceil(vbHeight)))
        return new XMLSerializer().serializeToString(doc)
      }
    }
  }

  // Fallback: try to read style max-width
  const style = svgEl.getAttribute('style') || ''
  const maxWidthMatch = style.match(/max-width:\s*([\d.]+)px/)
  if (maxWidthMatch) {
    const w = parseFloat(maxWidthMatch[1])
    // Mermaid often sets only max-width; use aria-roledescription or default aspect
    const heightAttr = svgEl.getAttribute('height')
    const h = heightAttr ? parseFloat(heightAttr) : w * 0.75
    if (w > 0 && h > 0) {
      svgEl.setAttribute('width', String(Math.ceil(w)))
      svgEl.setAttribute('height', String(Math.ceil(h)))
      return new XMLSerializer().serializeToString(doc)
    }
  }

  return svg
}

export async function renderMermaidToPngDataUrl(svg: string): Promise<string> {
  const fixedSvg = ensureSvgDimensions(svg)
  const svgBlob = new Blob([fixedSvg], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to rasterize mermaid SVG'))
      img.src = objectUrl
    })

    const scale = 2
    const width = Math.max(1, Math.ceil((image.naturalWidth || image.width || 1) * scale))
    const height = Math.max(1, Math.ceil((image.naturalHeight || image.height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D context unavailable')
    }

    context.scale(scale, scale)
    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
