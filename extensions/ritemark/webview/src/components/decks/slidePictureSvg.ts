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
  const style = `position:relative;width:${PICTURE_WIDTH}px;height:${PICTURE_HEIGHT}px;overflow:hidden;${rootStyle.replace(/"/g, '&quot;')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PICTURE_WIDTH}" height="${PICTURE_HEIGHT}" viewBox="0 0 ${PICTURE_WIDTH} ${PICTURE_HEIGHT}">`
    + `<foreignObject x="0" y="0" width="${PICTURE_WIDTH}" height="${PICTURE_HEIGHT}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="${style}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style>${markup}</div>`
    + '</foreignObject></svg>'
}

/** A selector with its pseudo-elements taken off, so `querySelector` can say whether it reaches an element. */
export function matchableSelector(selector: string): string {
  return selector.replace(/::?(?:before|after|marker|placeholder|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?:\([^)]*\))?/g, '')
}

/** The families a computed `font-family` names, without quotes. */
export function familiesOf(fontFamily: string): string[] {
  return fontFamily.split(',').map(name => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}
