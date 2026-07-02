import { rasterizeSvgToPngDataUrl } from './mermaid'

/**
 * Sprint 90 (#127): convert SVG images in the export HTML to PNG before it
 * reaches the host exporters, which use pdfkit/docx and cannot decode SVG.
 *
 * Handles two cases:
 *  - inline `data:image/svg+xml` — decoded in place
 *  - file-referenced `.svg` / `.drawio.svg` — fetched via its webview URI
 *    (needs `connect-src ${cspSource}` in the editor CSP)
 *
 * A rasterized `<img>` also has its `title` attribute removed: the host reads
 * `title || src`, so a leftover relative `.svg` path in `title` would make it
 * re-resolve (and, post-Phase-1, skip) the original SVG instead of using our
 * PNG. On any failure the tag is left untouched so the host's Phase-1 guard
 * skips it gracefully — a bad SVG never aborts the export.
 */

const IMG_TAG_REGEX = /<img\b[^>]*>/gi

interface SvgRasterDeps {
  rasterize: (svg: string) => Promise<string>
  fetchText: (url: string) => Promise<string>
}

const defaultDeps: SvgRasterDeps = {
  rasterize: rasterizeSvgToPngDataUrl,
  fetchText: async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
    return res.text()
  },
}

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1] : null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripQuery(pathValue: string): string {
  const q = pathValue.indexOf('?')
  return q === -1 ? pathValue : pathValue.slice(0, q)
}

function isSvgPath(pathValue: string | null): boolean {
  if (!pathValue) return false
  return /\.svg$/i.test(stripQuery(pathValue))
}

function decodeSvgDataUrl(src: string): string {
  const comma = src.indexOf(',')
  const meta = src.slice(0, comma)
  const payload = src.slice(comma + 1)
  if (/;base64/i.test(meta)) {
    // decodeURIComponent(escape(atob())) safely turns base64 back into UTF-8.
    return decodeURIComponent(escape(atob(payload)))
  }
  return decodeURIComponent(payload)
}

/** Rebuild an `<img>` tag with a new src and no title attribute. */
function rewriteImgTag(tag: string, pngDataUrl: string): string {
  let out = tag.replace(/\btitle\s*=\s*"[^"]*"/i, '')
  if (/\bsrc\s*=\s*"[^"]*"/i.test(out)) {
    out = out.replace(/\bsrc\s*=\s*"[^"]*"/i, `src="${pngDataUrl}"`)
  } else {
    out = out.replace(/<img\b/i, `<img src="${pngDataUrl}"`)
  }
  return out.replace(/\s{2,}/g, ' ')
}

export async function inlineSvgImagesForExport(
  html: string,
  deps: SvgRasterDeps = defaultDeps
): Promise<string> {
  const source = html || ''
  const tags = Array.from(source.matchAll(IMG_TAG_REGEX)).map((m) => m[0])
  const uniqueTags = Array.from(new Set(tags))

  let output = source

  for (const tag of uniqueTags) {
    const src = getAttr(tag, 'src')
    const title = getAttr(tag, 'title')

    let svg: string | null = null
    try {
      if (src && /^data:image\/svg\+xml/i.test(src)) {
        svg = decodeSvgDataUrl(src)
      } else if (isSvgPath(title) || isSvgPath(src)) {
        if (!src) continue
        // title holds the original relative path (not fetchable); the webview
        // URI in src is what actually resolves to the file bytes.
        svg = await deps.fetchText(decodeHtmlEntities(src))
      } else {
        continue
      }

      const pngDataUrl = await deps.rasterize(svg)
      const rewritten = rewriteImgTag(tag, pngDataUrl)
      output = output.split(tag).join(rewritten)
    } catch (error) {
      // Leave the tag untouched — the host guard skips undecodable images.
      console.warn('Failed to rasterize SVG image for export:', error)
    }
  }

  return output
}
