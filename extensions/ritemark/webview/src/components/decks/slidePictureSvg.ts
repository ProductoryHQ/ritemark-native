/**
 * Copy as picture (experience 46, item 15): the picture's size, the bar's notes and the SVG it is drawn through. Pure, so
 * the test reads them; `slidePicture.tsx` draws the slide.
 */
export const PICTURE_WIDTH = 1920
export const PICTURE_HEIGHT = 1080

/** The bar's note once the picture is on the clipboard (`number` from 1). */
export function copiedNote(number: number): string {
  return `Slide ${number} is copied as a picture.`
}

/** And when it couldn't be. */
export const COPY_FAILED_NOTE = 'The slide could not be copied as a picture.'

/** The SVG that draws `markup` (XHTML) with `css` at 1920 × 1080; `rootStyle` carries the document's own custom properties. */
export function slidePictureSvg(markup: string, css: string, rootStyle = ''): string {
  const style = `position:relative;width:${PICTURE_WIDTH}px;height:${PICTURE_HEIGHT}px;overflow:hidden;${rootStyle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PICTURE_WIDTH}" height="${PICTURE_HEIGHT}" viewBox="0 0 ${PICTURE_WIDTH} ${PICTURE_HEIGHT}">`
    + `<foreignObject x="0" y="0" width="${PICTURE_WIDTH}" height="${PICTURE_HEIGHT}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="${style}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style>${markup}</div>`
    + '</foreignObject></svg>'
}

const PSEUDO_ELEMENT = /::?(?:before|after|marker|placeholder|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?![\w-])(?:\([^)]*\))?/g

/** A selector list's entries, split at the commas outside brackets and parentheses. */
function selectorEntries(selector: string): string[] {
  const entries: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    else if (char === ',' && depth === 0) {
      entries.push(selector.slice(start, index))
      start = index + 1
    }
  }
  entries.push(selector.slice(start))
  return entries
}

/**
 * A selector with its pseudo-elements taken off, so `querySelector` can say whether it reaches an element. An entry
 * that is a pseudo-element alone (`::before` in Tailwind's reset) stands for any element (review of #794: left empty, it
 * made the whole list invalid and the reset was left out).
 */
export function matchableSelector(selector: string): string {
  return selectorEntries(selector).map(entry => entry.replace(PSEUDO_ELEMENT, '').trim() || '*').join(', ')
}

/** The custom properties of a computed style, as declarations (`--name: value;`). */
export function customProperties(style: { length: number; item(index: number): string; getPropertyValue(name: string): string }): string {
  let out = ''
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index)
    if (name.startsWith('--')) out += `${name}: ${style.getPropertyValue(name).trim()};`
  }
  return out
}

export { familiesOf } from '../../lib/svgFontFaces'
