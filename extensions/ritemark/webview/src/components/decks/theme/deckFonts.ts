/**
 * Sprint 162 PR 3: the five deck fonts beyond Sofia Sans, as `@font-face` rules on files in `media/fonts/` beside
 * `webview.js` (`webviewAssetUrl`), so the deck view, its strip, the wall, the presenter view and the Slide library
 * draw a theme's fonts. Sofia Sans is already in the bundle (`index.css`).
 *
 * The files are not in `webview.js`: inlined, they would add about 0.5 MB to every view (#107), and a rule costs
 * nothing until a slide uses its font. The browser loads a part only for the characters on the page. A file that
 * isn't there (an app older than the fonts) leaves Sofia Sans drawing, the font list's next name.
 */
import { DECK_FONT_LIST, DECK_FONT_SUBSETS, DEFAULT_DECK_FONT, deckFontFile } from '../../../../../src/decks/deckTheme'

const STYLE_ID = 'ritemark-deck-fonts'

/** The rules, for files at `urlOf(file)`; a file without an address gets no rule. */
export function deckFontFaces(urlOf: (file: string) => string | null): string {
  const rules: string[] = []
  for (const font of DECK_FONT_LIST) {
    if (font.name === DEFAULT_DECK_FONT) continue
    for (const part of DECK_FONT_SUBSETS) {
      const url = urlOf(`fonts/${deckFontFile(font, part.subset)}`)
      if (!url) continue
      rules.push(`@font-face{font-family:'${font.name}';font-style:normal;font-weight:100 900;font-display:swap;src:url("${url.replace(/["\\\n]/g, '')}") format('woff2');unicode-range:${part.unicodeRange};}`)
    }
  }
  return rules.join('\n')
}

/** Put the rules in the document once (a second call changes nothing). */
export function installDeckFontFaces(urlOf: (file: string) => string | null, doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const css = deckFontFaces(urlOf)
  if (!css) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  doc.head.appendChild(style)
}
