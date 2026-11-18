/**
 * Sprint 159 (technical plan §2.2): one slide as static HTML, for the published handout page. It draws the same
 * `layoutSlide` boxes as `SlideCanvas` does when nothing is being edited, element for element and class for class, so
 * `slide/slide.css` draws both the same; `slideMarkup.test.ts` renders both and compares them for every kind, in Card
 * and Borderless.
 *
 * Pure and DOM-free: the extension host builds the page with it (`src/decks/page/pageHtml.ts`). Every word is escaped.
 * The icons are `pageIcons.ts`'s inline SVG, the same Phosphor drawings the deck view's `Icon` draws.
 */
import type { SlideData } from '../../../../../src/decks/deckFormat'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { themeStyle } from '../theme/themeVars'
import { slideIcon } from './iconSet'
import { CANVAS_HEIGHT, CANVAS_WIDTH, layoutSlide, type BoxStyle, type SlideBox, type TextBox } from './layoutSlide'
import { iconSvg, isPageIconName } from './pageIcons'
import { slideLogoHtml, themeSlideLogo } from '../../../../../src/decks/blocks/slideRenderer'

/** Sprint 162 PR 4: an old slide drawn big and low, as a title slide: a Title or a Section slide. */
export function isLayoutTitleSlide(kind: string): boolean {
  return kind === 'title' || kind === 'section'
}

export interface SlideMarkupOptions {
  theme: DeckTheme
  borderless: boolean
  /** The measuring pass's step, as the open deck view found it (0–3). */
  step?: number
  /** A picture's address on the page, by the path the slide names; null draws the empty place, as a missing one does. */
  pictureUrl?: (path: string) => string | null
  /**
   * The slide's width, as `SlideCanvas` takes it: the slide gets its size and the canvas its scale. Without it the
   * page sizes the slide and scales the canvas itself.
   */
  width?: number
  /** The theme's `--s-*` properties on the slide, as `SlideCanvas` puts them; the page sets them once for every slide. */
  inlineTheme?: boolean
}

/** Escape text and attribute values: `&`, `<`, `>`, and both quotes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)
}

const kebab = (key: string) => (key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))

/** A style object as `SlideCanvas`'s `px` and React write it: numbers in pixels (but a font's weight), kebab-case keys. */
export function styleText(style: BoxStyle | Record<string, string | number> | undefined): string {
  if (!style) return ''
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${kebab(key)}:${typeof value === 'number' && key !== 'fontWeight' ? `${value}px` : String(value)}`)
    .join(';')
}

const attr = (name: string, value: string | undefined) => (value ? ` ${name}="${escapeHtml(value)}"` : '')

function text(box: TextBox, tag: 'div' | 'span' = 'div', style: BoxStyle | undefined = box.style): string {
  return `<${tag}${attr('class', box.cls || undefined)}${attr('style', styleText(style))}>${escapeHtml(box.text)}</${tag}>`
}

/** The icon `SlideCanvas` draws for a mark: the Arrows look's arrow, or a box's icon by its slide name. */
function glyph(icon: string | undefined): string | null {
  if (!icon) return null
  const name = icon === 'arrow-right' ? 'arrow-right' : slideIcon(icon)?.phosphor
  return name && isPageIconName(name) ? iconSvg(name, 20) : null
}

function box(entry: SlideBox, pictureUrl: (path: string) => string | null): string {
  switch (entry.type) {
    case 'text':
      return text(entry)
    case 'mark': {
      const svg = glyph(entry.icon)
      return `<span class="${escapeHtml(entry.cls)}"${attr('style', styleText(entry.style))}>${svg ?? escapeHtml(entry.text ?? '')}</span>`
    }
    case 'group':
      return `<div class="${escapeHtml(entry.cls)}"${attr('style', styleText(entry.style))}>${entry.children.map(child => box(child, pictureUrl)).join('')}</div>`
    case 'list':
      return `<ol class="pts"${attr('style', styleText(entry.style))}>${entry.items.map(item =>
        `<li${attr('style', styleText({ marginBottom: entry.gap }))}>${text(item.heading, 'span')}${item.text ? text(item.text, 'span', entry.subStyle) : ''}</li>`).join('')}</ol>`
    case 'table':
      return `<table class="tbl"${attr('style', styleText(entry.style))}><tbody>${entry.rows.map(row =>
        `<tr>${row.cells.map(cell => {
          const tag = cell.head ? 'th' : 'td'
          return `<${tag}${attr('style', styleText({ padding: entry.cellPadding }))}><div>${escapeHtml(cell.text)}</div></${tag}>`
        }).join('')}</tr>`).join('')}</tbody></table>`
    case 'picture': {
      const url = entry.image ? pictureUrl(entry.image) : null
      if (entry.cls === 'picbox') {
        return `<div class="picbox${url ? '' : ' empty'}"${attr('style', styleText(entry.style))}>${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}</div>`
      }
      const style = url ? { ...entry.style, backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : entry.style
      return `<div class="photo${url ? '' : ' empty'}"${attr('style', styleText(style))}></div>`
    }
  }
}

/** One slide as `SlideCanvas` draws it when nothing is being edited. */
export function slideMarkup(kind: string, data: SlideData, options: SlideMarkupOptions): string {
  const layout = layoutSlide(kind, data, { step: options.step ?? 0 })
  const pictureUrl = options.pictureUrl ?? (() => null)
  const outer: Record<string, string | number> = {}
  if (options.width !== undefined) {
    outer.width = options.width
    outer.height = Math.round(options.width * CANVAS_HEIGHT / CANVAS_WIDTH)
  }
  if (options.inlineTheme) Object.assign(outer, themeStyle(options.theme, options.borderless))
  const inner = options.width !== undefined ? styleText({ transform: `scale(${options.width / CANVAS_WIDTH})` }) : ''
  return `<div class="deck-slide${options.borderless ? ' is-borderless' : ''}"${attr('style', styleText(outer))}>`
    + `<div class="deck-sl${layout.known ? '' : ' is-unknown'}"${attr('style', inner)} aria-hidden="true">`
    + layout.boxes.map(entry => box(entry, pictureUrl)).join('')
    // The theme's logo, last, over the slide's words and pictures (Sprint 162 PR 4).
    + slideLogoHtml(themeSlideLogo(options.theme, options.borderless), isLayoutTitleSlide(kind))
    + '</div></div>'
}
