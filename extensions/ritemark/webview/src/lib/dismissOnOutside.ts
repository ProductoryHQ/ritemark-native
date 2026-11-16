/**
 * Popups close when you click outside them (Jarmo, 17 November 2026: "a global UX pattern for all popup elements").
 *
 * The rule, for every popup, menu or settings panel in the webview: Radix first (`Popover`, `DropdownMenu`, `Dialog`,
 * `ContextMenu`, `Select` close themselves). A popup that Radix can't carry (it is placed by its own code, as the deck
 * slide's Settings beside the slide) takes this hook:
 * - a press outside the popup closes it, and the focus goes where the press put it;
 * - Esc closes it, and the focus goes back to where it came from (the trigger that opened it) when it was in the popup;
 *   focus elsewhere (typing in the handout with Settings open) stays where it is;
 * - a press on the trigger is not "outside": the trigger toggles the popup by itself, so it doesn't close and reopen.
 *
 * A press or Esc inside a Radix layer (a Select's list, a tooltip, a menu opened from inside the popup) is the layer's
 * own: it portals out of the popup, so without this check choosing from a Select inside a popup would close the popup.
 * While a Radix list or menu is open, the first press outside closes only it, as Radix does for its own layers.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react'

/** The Radix layers portalled out of a popup (Select, DropdownMenu, Popover, Tooltip content). */
const RADIX_LAYER = '[data-radix-popper-content-wrapper]'
/** An open Radix list or menu (a Select's, a DropdownMenu's). */
const OPEN_RADIX_LIST = `${RADIX_LAYER} [role="listbox"], ${RADIX_LAYER} [role="menu"]`
/** What can take the focus when the trigger is a row rather than a button (a field and its button). */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type ElementSource = RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined)

export interface DismissOptions {
  /** What opened the popup (its button, or the field and button that open it): a press on it is not outside, and Esc
   *  gives it the focus back (its first focusable element when it is a row). */
  trigger?: ElementSource
  /** false: the popup is closed, nothing is listened to. */
  enabled?: boolean
}

/** What the listeners need of a node: enough for a test to stand in for the DOM. */
export interface NodeLike {
  contains?(other: unknown): boolean
  closest?(selector: string): unknown
  matches?(selector: string): boolean
  querySelector?(selector: string): unknown
  focus?(options?: FocusOptions): void
}
export interface DocumentLike {
  activeElement?: unknown
  querySelector?(selector: string): unknown
  addEventListener: (type: string, listener: (event: Event) => void, capture?: boolean) => void
  removeEventListener: (type: string, listener: (event: Event) => void, capture?: boolean) => void
}

const resolve = (source: ElementSource | undefined): HTMLElement | null =>
  !source ? null : typeof source === 'function' ? source() ?? null : source.current

const within = (container: NodeLike | null | undefined, target: unknown): boolean =>
  !!container && !!target && (container === target || !!container.contains?.(target))

const inRadixLayer = (target: unknown): boolean =>
  !!target && typeof (target as NodeLike).closest === 'function' && !!(target as NodeLike).closest!(RADIX_LAYER)

/** Gives the focus to the trigger, or, when the trigger is a row, to its first focusable element. */
export function focusTrigger(trigger: NodeLike | null | undefined): void {
  if (!trigger) return
  const target = trigger.matches?.(FOCUSABLE) === false ? (trigger.querySelector?.(FOCUSABLE) as NodeLike | null) : trigger
  target?.focus?.({ preventScroll: true })
}

/** The focus is in the popup (or nowhere): closing it would drop the focus, so it goes back to the trigger. */
const focusWasIn = (doc: DocumentLike, panel: NodeLike | null | undefined): boolean => {
  const active = doc.activeElement as NodeLike | null | undefined
  return !active || within(panel, active) || (active as { tagName?: string }).tagName === 'BODY'
}

/**
 * Listens on `doc` while a popup is open; returns the call that stops listening. Exported for the tests: components
 * use `useDismissOnOutside`.
 */
export function attachDismissOnOutside(
  doc: DocumentLike,
  getPanel: () => NodeLike | null | undefined,
  getTrigger: () => NodeLike | null | undefined,
  onClose: () => void,
): () => void {
  const onPointerDown = (event: Event) => {
    const target = event.target
    const panel = getPanel()
    if (!panel || within(panel, target) || within(getTrigger(), target) || inRadixLayer(target)) return
    if (doc.querySelector?.(OPEN_RADIX_LIST)) return
    onClose()
  }
  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent
    if (key.key !== 'Escape' || key.defaultPrevented || key.isComposing) return
    const panel = getPanel()
    if (!panel || inRadixLayer(key.target)) return
    key.preventDefault()
    if (focusWasIn(doc, panel)) focusTrigger(getTrigger())
    onClose()
  }
  // Capture: a press that something below stops (an editor, a drag handle) still closes the popup.
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('keydown', onKeyDown, false)
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('keydown', onKeyDown, false)
  }
}

/**
 * Closes the popup in `ref` on a press outside it or on Esc (see the top of this file). Returns `dismiss`, the close
 * for the popup's own Close button: it gives the focus back to the trigger, as Esc does.
 */
export function useDismissOnOutside(ref: RefObject<HTMLElement | null>, onClose: () => void, options: DismissOptions = {}): () => void {
  const { trigger, enabled = true } = options
  const latest = useRef({ onClose, trigger })
  latest.current = { onClose, trigger }

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    return attachDismissOnOutside(
      document,
      () => ref.current,
      () => resolve(latest.current.trigger),
      () => latest.current.onClose(),
    )
  }, [enabled, ref])

  return useCallback(() => {
    focusTrigger(resolve(latest.current.trigger))
    latest.current.onClose()
  }, [])
}
