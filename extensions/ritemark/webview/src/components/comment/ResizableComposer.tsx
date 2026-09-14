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
 * the agent composer rather than writing a second one.
 */
import { useEffect, useRef, type ReactNode, type TextareaHTMLAttributes, type KeyboardEvent, type CSSProperties } from 'react'

/** Line-height of `.rm-compose-input`, in em — keep in step with index.css. */
const LINE_HEIGHT_EM = 1.45
/** Vertical padding + borders of the field, in px. */
const FIELD_CHROME_PX = 16

export const COMPOSER_MIN_ROWS = 2
export const COMPOSER_MAX_ROWS = 8
export const COMPOSER_MAX_VIEWPORT_FRACTION = 0.4

/** The height the user dragged to, remembered for the session only (D10) —
 *  never persisted, so a new window starts at the two-row floor again. */
let sessionHeightPx: number | null = null

/** Exported for tests and for surfaces that reset the session, not for styling. */
export function rememberedComposerHeight(): number | null {
  return sessionHeightPx
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
    if (sessionHeightPx) element.style.height = `${sessionHeightPx}px`
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      // `style.height` is set only by the user's drag (or by the restore
      // above), so a width-driven reflow never overwrites the remembered size.
      if (element.style.height) sessionHeightPx = element.getBoundingClientRect().height
    })
    observer.observe(element)
    // Mount-only: re-running this would fight the user's own drag.
    return () => observer.disconnect()
  }, [autoFocus])

  const bounds = {
    '--rm-composer-min': `calc(${(minRows * LINE_HEIGHT_EM).toFixed(2)}em + ${FIELD_CHROME_PX}px)`,
    '--rm-composer-max': `min(calc(${(maxRows * LINE_HEIGHT_EM).toFixed(2)}em + ${FIELD_CHROME_PX}px), ${Math.round(
      maxViewportFraction * 100,
    )}vh)`,
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
