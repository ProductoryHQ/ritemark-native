/**
 * Sprint 157: one slide, drawn on a fixed 960 × 540 canvas and scaled to the width it is given (the stage, a
 * thumbnail). PR 1 draws every kind plainly in the Evening look: its title, its subtitle or section number, and its
 * items as a list, with its picture beside it. PR 2 lays each kind out and fits it.
 */
import type { SlideData } from '../../../../../src/decks/deckFormat'

export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 540

interface SlideCanvasProps {
  kind: string
  data: SlideData
  /** The width to draw at; the height follows 16:9. */
  width: number
  /** The picture's webview URI, when the slide names one and the host found it. */
  pictureUrl?: string
}

/** Kinds whose words stand alone in the middle of the slide. */
const LEAD_KINDS = new Set(['title', 'section', 'statement'])

export function SlideCanvas({ kind, data, width, pictureUrl }: SlideCanvasProps) {
  const scale = width / CANVAS_WIDTH
  const items = (data.items ?? []).map(item => item.heading ?? '').filter(Boolean)
  const rows = data.rows ?? []
  const lead = LEAD_KINDS.has(kind)
  return (
    <div className="deck-slide" style={{ width, height: Math.round(width * CANVAS_HEIGHT / CANVAS_WIDTH) }}>
      <div
        className={`deck-slide-canvas is-evening${lead ? ' is-lead' : ''}`}
        style={{ transform: `scale(${scale})` }}
        aria-hidden={width < 200 ? true : undefined}
      >
        {kind === 'section' && data.number ? <div className="deck-slide-number">{data.number}</div> : null}
        <h2 className="deck-slide-title">{data.title || ''}</h2>
        {data.subtitle ? <div className="deck-slide-sub">{data.subtitle}</div> : null}
        {!lead && items.length > 0 ? (
          <ul className="deck-slide-items">
            {items.map((heading, index) => <li key={index}>{heading}</li>)}
          </ul>
        ) : null}
        {!lead && items.length === 0 && rows.length > 0 ? (
          <ul className="deck-slide-items">
            {rows.map((row, index) => <li key={index}>{row.join(' · ')}</li>)}
          </ul>
        ) : null}
        {pictureUrl ? <div className="deck-slide-picture" style={{ backgroundImage: `url("${pictureUrl.replace(/"/g, '%22')}")` }} /> : null}
      </div>
    </div>
  )
}
