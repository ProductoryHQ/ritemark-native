/**
 * Sprint 162 PR 5 (step-3-themes.md, "See what changed", 17 November; frame 13): what an AI's theme change did, as a
 * sheet over the deck's stage (or the theme tab's preview), never in the chat (too narrow to judge a look) and never a
 * text diff. The strip (or the tab's settings) and the chat stay in view beside it.
 *
 * Two slides, each Before and After side by side, labelled with their themes ("Before · Evening", "After · Fernhollow
 * Bank"): the deck's first slide, and the first with Boxes, Steps or Columns (or the second). Before is drawn with the old
 * theme by the strip's own renderer (`SlideCanvas`), After with the new. Undo and Close (Esc, or a press outside).
 */
import { useEffect, useRef, useState } from 'react'
import { parseTheme } from '../../../../../src/decks/deckTheme'
import { ratioWords, type ThemeChangeView } from '../../../../../src/decks/themeChange'
import { useDismissOnOutside } from '../../../lib/dismissOnOutside'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import './themeChangeSheet.css'

/** A change as the host sends it, checked field by field; null for anything else. */
export function themeChangeFrom(value: unknown): ThemeChangeView | null {
  if (!value || typeof value !== 'object') return null
  const change = value as Partial<ThemeChangeView>
  const side = (entry: unknown) => !!entry && typeof (entry as { name?: unknown }).name === 'string' && typeof (entry as { text?: unknown }).text === 'string'
  if (typeof change.id !== 'string' || !side(change.before) || !side(change.after) || !Array.isArray(change.slides)) return null
  return {
    id: change.id,
    before: change.before!,
    after: change.after!,
    slides: change.slides.slice(0, 2),
    borderless: change.borderless === true,
    assets: change.assets && typeof change.assets === 'object' ? change.assets : {},
    undone: change.undone === true,
    ...(movedFrom(change.moved) ? { moved: movedFrom(change.moved)! } : {}),
  }
}

const HEX = /^#[0-9A-F]{6}$/i

/** A colour fix's moved pairs, checked field by field; null when there are none. */
function movedFrom(value: unknown): ThemeChangeView['moved'] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const moved = value.filter((entry): entry is NonNullable<ThemeChangeView['moved']>[number] => !!entry
    && typeof entry.label === 'string' && typeof entry.from === 'string' && HEX.test(entry.from) && typeof entry.to === 'string' && HEX.test(entry.to)
    && typeof entry.fromRatio === 'number' && typeof entry.toRatio === 'number')
  return moved.length ? moved.slice(0, 5) : null
}

/** A colour, as a small swatch before its code. */
function Swatch({ colour }: { colour: string }) {
  return <span className="theme-change-swatch" style={{ background: colour }} aria-hidden="true" />
}

/** The space between the two columns and around them. */
const GAP = 16
const PAD = 24
const MAX_SLIDE = 440

export function ThemeChangeSheet({ change, onUndo, onClose, style }: { change: ThemeChangeView; onUndo: () => void; onClose: () => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useDismissOnOutside(ref, onClose)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])
  // The sheet takes the focus, so Esc reaches it at once
  useEffect(() => { ref.current?.focus() }, [])
  const before = parseTheme(change.before.text)
  const after = parseTheme(change.after.text)
  const slideWidth = Math.max(120, Math.min(MAX_SLIDE, Math.floor((width - PAD * 2 - GAP) / 2)))

  return (
    <div ref={ref} className="theme-change-sheet" role="dialog" aria-label="What changed" tabIndex={-1} style={style}>
      <div className="theme-change-head">
        <span className="theme-change-title">What changed</span>
        {change.moved ? null : <span className="theme-change-what">{change.before.name} → {change.after.name}</span>}
      </div>
      {/* A colour fix names each pair it moved (the Experience lead, 17 November): "Text #5A5F8C → #868AAA (2.5 → 4.6 to 1)" */}
      {change.moved ? (
        <ul className="theme-change-moved">
          {change.moved.map(entry => (
            <li key={entry.label}>
              <span className="theme-change-pair">{entry.label}</span>
              <Swatch colour={entry.from} /><code>{entry.from}</code> → <Swatch colour={entry.to} /><code>{entry.to}</code>
              <span className="theme-change-ratio">({ratioWords(entry.fromRatio)} → {ratioWords(entry.toRatio)} to 1)</span>
            </li>
          ))}
          <li className="theme-change-unsaved">{change.undone ? 'Undone.' : 'Not saved yet.'}</li>
        </ul>
      ) : null}
      <div className="theme-change-rows">
        {change.slides.length === 0 ? <p className="theme-change-empty">The deck has no slides to show it on.</p> : null}
        {change.slides.map(slide => (
          <div key={slide.number} className="theme-change-row" style={{ gridTemplateColumns: `repeat(2, ${slideWidth}px)`, gap: GAP }}>
            <figure className="theme-change-slide">
              <figcaption>Before · {change.before.name}</figcaption>
              {width > 0 ? <SlideCanvas kind={slide.kind} data={slide.data} width={slideWidth} theme={before} borderless={change.borderless} assets={change.assets} /> : null}
            </figure>
            <figure className="theme-change-slide">
              <figcaption>After · {change.after.name}</figcaption>
              {width > 0 ? <SlideCanvas kind={slide.kind} data={slide.data} width={slideWidth} theme={after} borderless={change.borderless} assets={change.assets} /> : null}
            </figure>
          </div>
        ))}
      </div>
      <div className="theme-change-foot">
        {change.undone ? <span className="theme-change-done">Undone.</span> : (
          <Tooltip label={`Take this change back: the slides look as they did in ${change.before.name}`} side="top">
            <Button variant="outline" size="bar" onClick={onUndo}>
              <Icon name="arrow-counter-clockwise" size={14} tone="inherit" />
              Undo
            </Button>
          </Tooltip>
        )}
        <Tooltip label="Close this view (Esc)" side="top">
          <Button variant="ghost" size="bar" onClick={onClose}>Close</Button>
        </Tooltip>
      </div>
    </div>
  )
}
