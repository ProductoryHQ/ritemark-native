/**
 * Small details item 3 (decks README, 17 November): the published page's QR code and its short address under it, in
 * the theme's ink on its ground (`pageCode.ts`). The wall draws it at the size the room needs; the presenter view's Now
 * draws the same, smaller, so the presenter sees what the room sees.
 */
import { useMemo } from 'react'
import { deckFontStack, type DeckTheme } from '../../../../../src/decks/deckTheme'
import { codeSide, pageCodeColours, pageCodeOf, pageCodePath, QUIET_ZONE, shortAddress } from './pageCode'
import './pageCode.css'

export function PageCode({ address, theme, borderless, height, width }: {
  address: string
  theme: DeckTheme
  borderless: boolean
  /** The height and width it is drawn in: the wall's screen, or the presenter view's Now. */
  height: number
  width: number
}) {
  const code = useMemo(() => pageCodeOf(address), [address])
  const path = useMemo(() => pageCodePath(code), [code])
  const { ink, ground } = pageCodeColours(theme, borderless)
  const modules = code.size + QUIET_ZONE * 2
  const side = codeSide(code.size, height, width)
  const short = shortAddress(address)
  return (
    <div className="page-code" style={{ gap: Math.round(height * 0.02) }}>
      <svg
        className="page-code-svg"
        viewBox={`0 0 ${modules} ${modules}`}
        width={side}
        height={side}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${short}`}
      >
        <rect width={modules} height={modules} fill={ground} />
        <path d={path} fill={ink} />
      </svg>
      <span
        className="page-code-address"
        style={{ color: ink, fontFamily: deckFontStack(theme.fb), fontSize: Math.max(11, Math.round(height * 0.042)), maxWidth: Math.round(width * 0.9) }}
      >
        {short}
      </span>
    </div>
  )
}
