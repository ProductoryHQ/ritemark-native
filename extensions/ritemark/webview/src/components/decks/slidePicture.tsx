/**
 * Experience 46, "More, the same night", item 15: Copy as picture. The thumbnail's ⋯ puts a 1920 × 1080 PNG of the
 * slide on the clipboard, in the deck's theme and look, with its fonts, pictures and logo.
 *
 * The slide is drawn as every view draws it (`SlideCanvas`, at 1920 pixels wide, off screen so its fit is measured with
 * the real fonts), then copied into an SVG `foreignObject` with the CSS rules that reach it, its fonts and pictures as
 * `data:` URLs (a picture drawn from an SVG loads nothing of its own), and drawn into a canvas: the way `mathExport`
 * draws an equation. The webview writes the PNG to the clipboard itself (`ClipboardItem`), as a picture's Copy does.
 */
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { SlideData } from '../../../../src/decks/deckFormat'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { SlideCanvas } from './slide/SlideCanvas'
import { PICTURE_HEIGHT, PICTURE_WIDTH, customProperties, familiesOf, matchableSelector, slidePictureSvg } from './slidePictureSvg'
import { readFileAsBase64 } from '../../lib/pastedImage'

export { COPY_FAILED_NOTE, PICTURE_HEIGHT, PICTURE_WIDTH, copiedNote } from './slidePictureSvg'

export interface SlidePictureInput {
  kind: string
  data: SlideData
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  missing?: ReadonlySet<string>
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

async function asDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url
  try {
    return await readFileAsBase64(await (await fetch(url)).blob())
  } catch {
    return null
  }
}

/** The `url(…)`s in a CSS value, resolved against `base`. */
function urlsIn(value: string, base: string): Array<{ raw: string; url: string }> {
  const found: Array<{ raw: string; url: string }> = []
  for (const match of value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)) {
    try { found.push({ raw: match[0], url: new URL(match[2], base).href }) } catch { /* not an address */ }
  }
  return found
}

/**
 * The document's CSS that reaches the slide drawn in `host`: each style rule whose selector matches an element there,
 * inside the at-rules that hold it (media, layers, supports), the layer order and `@property` rules as they are, and the
 * `@font-face` rules of the families the slide's words use, their files inlined.
 */
async function cssFor(host: HTMLElement, families: Set<string>): Promise<string> {
  const reaches = (selector: string): boolean => {
    try { return !!host.querySelector(matchableSelector(selector)) } catch { return false }
  }
  const faces: Promise<string>[] = []
  const walk = (rules: CSSRuleList, base: string): string => {
    let out = ''
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (reaches(rule.selectorText)) out += rule.cssText
      } else if (rule instanceof CSSFontFaceRule) {
        const family = familiesOf(rule.style.getPropertyValue('font-family'))[0]
        if (!family || !families.has(family)) continue
        const text = rule.cssText
        faces.push((async () => {
          let inlined = text
          for (const { raw, url } of urlsIn(text, base)) {
            const data = await asDataUrl(url)
            if (!data) return ''
            inlined = inlined.replace(raw, `url("${data}")`)
          }
          return inlined
        })())
      } else if (rule instanceof CSSKeyframesRule) {
        continue
      } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        const inner = walk((rule as CSSGroupingRule).cssRules, base)
        if (inner) out += `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${inner}}`
      } else if (typeof CSSLayerStatementRule !== 'undefined' && rule instanceof CSSLayerStatementRule) {
        out += rule.cssText
      } else if (typeof CSSPropertyRule !== 'undefined' && rule instanceof CSSPropertyRule) {
        out += rule.cssText
      }
    }
    return out
  }
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }
    css += walk(rules, sheet.href ?? document.baseURI)
  }
  return (await Promise.all(faces)).join('') + css
}

/** The slide's pictures (its `<img>`s and inline backgrounds) as `data:` URLs, in the copy. */
async function inlinePictures(copy: HTMLElement): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const image of Array.from(copy.querySelectorAll('img'))) {
    const src = image.getAttribute('src')
    if (!src) continue
    jobs.push(asDataUrl(new URL(src, document.baseURI).href).then(data => {
      if (data) image.setAttribute('src', data)
      else image.removeAttribute('src')
    }))
  }
  for (const element of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('[style]'))]) {
    const style = element.getAttribute('style') ?? ''
    if (!style.includes('url(')) continue
    jobs.push((async () => {
      let next = style
      for (const { raw, url } of urlsIn(style, document.baseURI)) {
        const data = await asDataUrl(url)
        next = next.replace(raw, data ? `url("${data}")` : 'none')
      }
      element.setAttribute('style', next)
    })())
  }
  await Promise.all(jobs)
}

/** The slide drawn at 1920 × 1080, as a PNG. */
export async function renderSlidePicture(input: SlidePictureInput): Promise<Blob> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${PICTURE_WIDTH}px;height:${PICTURE_HEIGHT}px;pointer-events:none;contain:strict`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<SlideCanvas kind={input.kind} data={input.data} width={PICTURE_WIDTH} theme={input.theme} borderless={input.borderless} assets={input.assets} missing={input.missing} />))
    // Its fonts and pictures loaded, then the fit measured again with them (a frame for each pass).
    await document.fonts?.ready
    await Promise.all(Array.from(host.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)))
    await nextFrame()
    await nextFrame()
    await document.fonts?.ready
    await nextFrame()
    const slide = host.querySelector<HTMLElement>('.deck-slide')
    if (!slide) throw new Error('The slide was not drawn.')
    const families = new Set<string>()
    for (const element of [slide, ...Array.from(slide.querySelectorAll('*'))]) {
      for (const family of familiesOf(getComputedStyle(element).fontFamily)) families.add(family)
    }
    const css = await cssFor(host, families)
    const copy = slide.cloneNode(true) as HTMLElement
    await inlinePictures(copy)
    // The document's custom properties as they resolve (VS Code's, and the :root rules' tokens), which the slide's
    // rules may read: the picture has no <html> of its own (review of #794).
    const svg = slidePictureSvg(new XMLSerializer().serializeToString(copy), css, customProperties(getComputedStyle(document.documentElement)))
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = PICTURE_WIDTH
    canvas.height = PICTURE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No canvas to draw on.')
    context.drawImage(image, 0, 0, PICTURE_WIDTH, PICTURE_HEIGHT)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No picture.'))), 'image/png'))
  } finally {
    root.unmount()
    host.remove()
  }
}

/**
 * Copy as picture: the PNG on the clipboard. The write starts at once, with the picture to follow (a `ClipboardItem`
 * of a promise), so it stays the click's own while the slide is drawn. True once it is there.
 */
export async function copySlidePicture(input: SlidePictureInput): Promise<boolean> {
  try {
    const png = renderSlidePicture(input)
    // Its failure is the write's: never an unhandled rejection of its own.
    png.catch(() => undefined)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    return true
  } catch (error) {
    console.warn('[Decks] Copy as picture failed:', error)
    return false
  }
}
