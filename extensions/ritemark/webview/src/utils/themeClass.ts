/**
 * The `ritemark-dark` class on <body>, kept in step with the VS Code theme.
 * Shared by the webview entries (the main bundle and the Office preview).
 */

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) return null

  const normalized = match[1].length === 3
    ? match[1].split('').map((char) => char + char).join('')
    : match[1]

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

function isDarkColor(value: string): boolean {
  const rgb = parseHexColor(value)
  if (!rgb) return false

  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 0.18
}

export function syncRitemarkThemeClass() {
  const body = document.body
  const classList = body.classList
  const themeKind = body.getAttribute('data-vscode-theme-kind') ?? ''
  const editorBackground = getComputedStyle(body).getPropertyValue('--vscode-editor-background')
  const shouldUseDarkTokens =
    classList.contains('vscode-dark') ||
    themeKind.toLowerCase().includes('dark') ||
    isDarkColor(editorBackground)

  classList.toggle('ritemark-dark', shouldUseDarkTokens)
}

/** Set the class now and whenever VS Code changes the theme. */
export function watchRitemarkThemeClass(): void {
  syncRitemarkThemeClass()
  new MutationObserver(syncRitemarkThemeClass).observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-vscode-theme-kind', 'style'],
  })
}
