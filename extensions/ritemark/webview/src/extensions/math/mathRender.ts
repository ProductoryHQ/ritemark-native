/**
 * Sprint 138 (#481, R3): typesetting with KaTeX.
 *
 * - KaTeX's code is the copy Mermaid already brings into `webview.js`
 *   (0.16.47, pinned in package.json; the build fails on a second copy).
 *   It is imported on first use, so a document without math runs none of it.
 * - KaTeX's stylesheet and its woff2 faces are files in `media/katex/`, next
 *   to `webview.js`, never inlined into a bundle (#107). The first equation a
 *   view shows adds one `<link>`; a document without math loads nothing.
 * - If the stylesheet cannot load (an older app without `media/katex/`, a
 *   broken path), equations show their source in the code style, never as
 *   unstyled glyphs.
 */
import type katexModule from 'katex'
import { webviewAssetUrl } from '../../lib/webviewAssets'

type Katex = typeof katexModule

/** Must match `media/katex/` (the build copies it from this exact version). */
export const KATEX_VERSION = '0.16.47'

export type MathAssetsStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

let status: MathAssetsStatus = 'idle'
let katex: Katex | null = null
let loading: Promise<MathAssetsStatus> | null = null
const listeners = new Set<() => void>()

export function mathAssetsStatus(): MathAssetsStatus {
  return status
}

/** KaTeX, once `prepareMath()` has resolved (also when only the stylesheet is missing). */
export function loadedKatex(): Katex | null {
  return katex
}

export function onMathAssetsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setStatus(next: MathAssetsStatus): void {
  status = next
  for (const listener of listeners) listener()
}

/** The URL of `media/katex/katex.min.css`, or null when `webview.js`'s own URL is unknown. */
export function katexStylesheetUrl(): string | null {
  return webviewAssetUrl(`katex/katex.min.css?v=${KATEX_VERSION}`)
}

/** How long the stylesheet may take before equations show as sources instead. */
const STYLESHEET_TIMEOUT_MS = 10000

function loadStylesheet(href: string): Promise<boolean> {
  return new Promise(resolve => {
    const existing = document.querySelector<HTMLLinkElement>('link[data-ritemark-katex]')
    if (existing) {
      resolve(!!existing.sheet)
      return
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.ritemarkKatex = ''
    const timer = window.setTimeout(() => resolve(false), STYLESHEET_TIMEOUT_MS)
    link.onload = () => {
      window.clearTimeout(timer)
      resolve(true)
    }
    link.onerror = () => {
      window.clearTimeout(timer)
      resolve(false)
    }
    document.head.appendChild(link)
  })
}

/**
 * Load KaTeX and its stylesheet, once per view. Resolves `ready` or
 * `unavailable`; callers show sources until it is `ready`.
 */
export function prepareMath(): Promise<MathAssetsStatus> {
  if (!loading) {
    setStatus('loading')
    loading = (async () => {
      const href = katexStylesheetUrl()
      const [module, styled] = await Promise.all([
        import('katex').then(m => (m.default ?? m) as Katex).catch(() => null),
        href ? loadStylesheet(href) : Promise.resolve(false),
      ])
      // KaTeX's code is in the bundle either way; without the stylesheet the
      // views show sources, but the export can still check and write MathML.
      katex = module
      setStatus(module && styled ? 'ready' : 'unavailable')
      return status
    })()
  }
  return loading
}

export interface TypesetOptions {
  displayMode: boolean
  /** 'htmlAndMathml' in the editor (the MathML is what a screen reader reads); 'mathml' for Word. */
  output?: 'htmlAndMathml' | 'mathml' | 'html'
}

/** KaTeX's options, with `trust` off and its limits on expansion and size. */
function katexOptions({ displayMode, output = 'htmlAndMathml' }: TypesetOptions) {
  return {
    displayMode,
    output,
    throwOnError: true,
    trust: false,
    strict: 'ignore' as const,
    maxExpand: 1000,
    maxSize: 50,
  }
}

export type TypesetResult = { ok: true } | { ok: false; error: unknown }

/** Typeset `latex` into `element`. Needs `prepareMath()` to have resolved `ready`. */
export function typesetInto(element: HTMLElement, latex: string, options: TypesetOptions): TypesetResult {
  if (!katex) return { ok: false, error: new Error('KaTeX is not loaded.') }
  try {
    katex.render(latex, element, katexOptions(options))
    return { ok: true }
  } catch (error) {
    element.textContent = ''
    return { ok: false, error }
  }
}

/** Typeset to a markup string (for export). Throws KaTeX's error. */
export function typesetToString(latex: string, options: TypesetOptions): string {
  if (!katex) throw new Error('KaTeX is not loaded.')
  return katex.renderToString(latex, katexOptions(options))
}

/** Whether `latex` typesets, without drawing it. */
export function checkTypesets(latex: string, displayMode: boolean): TypesetResult {
  try {
    typesetToString(latex, { displayMode, output: 'mathml' })
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}
