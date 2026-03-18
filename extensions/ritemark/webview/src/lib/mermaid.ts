/**
 * Mermaid diagram rendering helper.
 * Lazily initializes mermaid on first use and exports a render function.
 *
 * @see Sprint 30: Mermaid Diagram Rendering
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

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid')
  }
  const mermaid = mermaidModule.default

  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: getTheme(),
      securityLevel: 'strict',
    })
    initialized = true
  }

  return mermaid
}

/**
 * Render a mermaid diagram source string to SVG.
 * Returns the SVG string, or throws on invalid syntax.
 */
export async function renderMermaid(id: string, source: string): Promise<string> {
  const mermaid = await getMermaid()

  // Re-check theme each render in case user switched
  const theme = getTheme()
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' })

  const { svg } = await mermaid.render(id, source)
  return svg
}
