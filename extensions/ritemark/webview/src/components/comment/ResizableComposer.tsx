/**
 * ResizableComposer — Sprint 117 R10 (#281): a text area the user can make
 * taller, with controls that never scroll away.
 *
 * The comment composer was a fixed `rows={2}` box, so a note longer than two
 * lines was written through a letterbox. This primitive gives it the browser's
 * own vertical resize between a two-row floor and a `min(8 rows, 40vh)` ceiling
 * — native resize because it is keyboard-neutral, needs no drag code, and is
 * already accessible (D10). Save / Cancel / Send live in `footer`, OUTSIDE the
 * scrolling area, so they are reachable at any height, at 200% zoom, and at the
 * minimum supported editor width.
 *
 * It is deliberately generic: v1.12.0 Sprint 122 applies the same primitive to
 * the agent composer rather than writing a second one. The agent composer keeps
 * its own field (chips, attachments, pickers), so what it shares is the
 * behaviour: `composerBounds` for the floor and ceiling, and the per-surface
 * session height below.
 */
import { useEffect, useRef, type ReactNode, type TextareaHTMLAttributes, type KeyboardEvent, type CSSProperties } from 'react'

/** Line-height of `.rm-compose-input`, in em — keep in step with index.css. */
const LINE_HEIGHT_EM = 1.45
/** Vertical padding + borders of the field, in px. */
const FIELD_CHROME_PX = 16

export const COMPOSER_MIN_ROWS = 2
export const COMPOSER_MAX_ROWS = 8
export const COMPOSER_MAX_VIEWPORT_FRACTION = 0.4

/** The height a person dragged each composer to, remembered for the session
 *  only (D10) — never persisted, so a new window starts at the floor again.
 *  Keyed per surface: dragging the chat composer taller does not resize the
 *  comment box. */
const sessionHeights = new Map<string, number>()

/** Exported for tests and for surfaces that reset the session, not for styling. */
export function rememberedComposerHeight(surface = 'comment'): number | null {
  return sessionHeights.get(surface) ?? null
}

export function rememberComposerHeight(surface: string, heightPx: number): void {
  sessionHeights.set(surface, heightPx)
}

/** Back to fitting the text: the surface no longer has a chosen height. */
export function forgetComposerHeight(surface: string): void {
  sessionHeights.delete(surface)
}

/**
 * The floor and ceiling of a composer field, as CSS lengths: `rows` lines of
 * text plus the field's vertical padding and borders, and the ceiling also
 * capped at a share of the viewport so the transcript never disappears.
 */
export function composerBounds({
  minRows = COMPOSER_MIN_ROWS,
  maxRows = COMPOSER_MAX_ROWS,
  maxViewportFraction = COMPOSER_MAX_VIEWPORT_FRACTION,
  lineHeightEm = LINE_HEIGHT_EM,
  chromePx = FIELD_CHROME_PX,
}: {
  minRows?: number
  maxRows?: number
  maxViewportFraction?: number
  lineHeightEm?: number
  chromePx?: number
} = {}): { min: string; max: string } {
  return {
    min: `calc(${(minRows * lineHeightEm).toFixed(2)}em + ${chromePx}px)`,
    max: `min(calc(${(maxRows * lineHeightEm).toFixed(2)}em + ${chromePx}px), ${Math.round(maxViewportFraction * 100)}vh)`,
  }
}

export interface ResizableComposerProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  minRows?: number
  maxRows?: number
  maxViewportFraction?: number
  autoFocus?: boolean
  /** Extra attributes for the textarea (aria-*, id, …). */
  inputProps?: TextareaHTMLAttributes<HTMLTextAreaElement>
  inputRef?: { current: HTMLTextAreaElement | null }
  /** Floats above the field — the agent picker. Never over the footer. */
  overlay?: ReactNode
  /** Validation text under the field. */
  error?: ReactNode
  /** Cancel / Comment / Send. Outside the scrolling area, always visible. */
  footer: ReactNode
  className?: string
}

export function ResizableComposer({
  value,
  onChange,
  onKeyDown,
  placeholder,
  minRows = COMPOSER_MIN_ROWS,
  maxRows = COMPOSER_MAX_ROWS,
  maxViewportFraction = COMPOSER_MAX_VIEWPORT_FRACTION,
  autoFocus = false,
  inputProps,
  inputRef,
  overlay,
  error,
  footer,
  className,
}: ResizableComposerProps) {
  const ownRef = useRef<HTMLTextAreaElement | null>(null)

  const setRef = (element: HTMLTextAreaElement | null) => {
    ownRef.current = element
    if (inputRef) inputRef.current = element
  }

  useEffect(() => {
    const element = ownRef.current
    if (!element) return
    if (autoFocus) {
      element.focus()
      element.setSelectionRange(element.value.length, element.value.length)
    }
    const remembered = rememberedComposerHeight('comment')
    if (remembered) element.style.height = `${remembered}px`
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      // `style.height` is set only by the user's drag (or by the restore
      // above), so a width-driven reflow never overwrites the remembered size.
      if (element.style.height) rememberComposerHeight('comment', element.getBoundingClientRect().height)
    })
    observer.observe(element)
    // Mount-only: re-running this would fight the user's own drag.
    return () => observer.disconnect()
  }, [autoFocus])

  const { min, max } = composerBounds({ minRows, maxRows, maxViewportFraction })
  const bounds = {
    '--rm-composer-min': min,
    '--rm-composer-max': max,
  } as CSSProperties

  return (
    <div className={className ? `rm-composer ${className}` : 'rm-composer'}>
      <div className="rm-composer-field" style={bounds}>
        <textarea
          {...inputProps}
          ref={setRef}
          className="rm-compose-input"
          rows={minRows}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {overlay}
      </div>
      {error}
      <div className="rm-compose-foot">{footer}</div>
    </div>
  )
}
