/**
 * Sprint 138 (#481): files that ship next to `webview.js` in `media/`
 * (KaTeX's stylesheet and fonts in `media/katex/`), addressed from the
 * bundle's own URL, so the host's HTML and its CSP need no change.
 *
 * `document.currentScript` is only set while the bundle's top level runs,
 * so `main.tsx` captures it first thing.
 */
let scriptUrl: string | null = null

/** Call at the bundle's top level: remembers `webview.js`'s own URL. */
export function captureWebviewScriptUrl(): void {
  const script = document.currentScript
  if (script instanceof HTMLScriptElement && script.src) scriptUrl = script.src
}

/** A file in `media/`, relative to `webview.js` (`katex/katex.min.css`), or null when unknown. */
export function webviewAssetUrl(relativePath: string): string | null {
  if (!scriptUrl) {
    const tag = Array.from(document.scripts).find(script => /\/webview\.js(?:[?#]|$)/.test(script.src))
    if (tag) scriptUrl = tag.src
  }
  if (!scriptUrl) return null
  try {
    return new URL(relativePath, scriptUrl).toString()
  } catch {
    return null
  }
}
