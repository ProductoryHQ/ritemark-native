/**
 * The page's input mode (Sprint 146, R3): keyboard or pointer, decided once per webview from how the person last
 * worked. It is the one rule for whether a focus ring shows, on every control.
 *
 * `watchInputMode` (started once in `main.tsx` and in the Office previews' entry) writes `data-input-mode` on `<html>`
 * from the capture phase, before any control handles the input. The rings read it: Tailwind's `focus-visible:` variant
 * matches only outside pointer mode (`tailwind.config.ts`), the hand-written `:focus-visible` rules carry the same
 * prefix, and in pointer mode no control draws even Chromium's own outline (`index.css`). A field keeps its focused
 * look in both modes: Input, Textarea, the composer and the editor show where the typing goes after a click too. A
 * tooltip opens on focus only in keyboard mode (`tooltip.tsx`, `focusOpensTooltip`).
 *
 * So the focus can go back to a menu's or a list's trigger after every close, as Radix, the WAI-ARIA menu button
 * pattern and React Aria do (decision 1): after a mouse pick the trigger has the focus with no ring and no tooltip,
 * and the next Tab carries on from it. 2.1 RC3's ring after a mouse pick came from Chromium matching `:focus-visible`
 * on that script focus; the mode, not Chromium's guess, decides now. Sprint 146's PR 1 had withheld the focus instead
 * (`close-focus.ts`, #585); this module grew out of it.
 *
 * Before any input the page is in keyboard mode, so a page reached from the workbench by the keyboard shows where the
 * focus is.
 */

import { isMac } from '../../hooks/usePlatform'

export type InputMode = 'pointer' | 'keyboard'

interface InputEventLike {
  type: string
  key?: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  /** A click's count of presses: 0 for a click no press made (a keyboard's or assistive technology's activation). */
  detail?: number
  /** False for an event a script made (`dispatchEvent`, `click()`): it says nothing about the person. */
  isTrusted?: boolean
  getModifierState?(key: string): boolean
}

interface InputWindow {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void
}
interface InputDocument {
  documentElement: { setAttribute(name: string, value: string): void }
  defaultView: InputWindow | null
}

// A key that only changes how others type, or locks: alone it is not moving through the page
const MODIFIER_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn', 'FnLock', 'NumLock', 'ScrollLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock', 'OS',
])
// The keys that move through a page or act on a menu: Radix picks, closes and moves on these whatever is held
const ACTING_KEYS = new Set(['Enter', ' ', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

/**
 * What an input event says about how the person works (pure, tested); null when it says nothing. `mac`: on a Mac,
 * Option types characters (@ [ ] { } on many layouts), where on Windows Alt with a letter is a menu's shortcut.
 */
export function inputKindOf(event: InputEventLike, mac = isMac): InputMode | null {
  if (event.isTrusted === false) return null
  if (event.type === 'pointerdown') return 'pointer'
  // A click no press made: a keyboard's activation, or assistive technology that sends no press of its own (Chromium
  // sends one before its own accessibility click, which then reads as the pointer: no ring, which a screen reader
  // doesn't need). `watchInputMode` leaves out the clicks a press makes.
  if (event.type === 'click') return event.detail === 0 ? 'keyboard' : null
  if (event.type !== 'keydown' || !event.key) return null
  if (MODIFIER_KEYS.has(event.key)) return null
  if (ACTING_KEYS.has(event.key)) return 'keyboard'
  // A shortcut (⌘, Ctrl or Alt held) is not moving through the page either. Characters are typing: AltGr's (Windows
  // reports AltGr as Ctrl and Alt held), and the Mac's Option ones
  const typed =
    event.getModifierState?.('AltGraph') === true ||
    (mac && event.altKey === true && !event.metaKey && !event.ctrlKey && event.key.length === 1)
  if (!typed && (event.metaKey || event.ctrlKey || event.altKey)) return null
  return 'keyboard'
}

let mode: InputMode = 'keyboard'
const listeners = new Set<(mode: InputMode) => void>()
const watched = new WeakSet<object>()

/** The page's input mode now. */
export function inputMode(): InputMode {
  return mode
}

/** Runs `listener` whenever the mode changes; returns the unsubscribe. */
export function onInputModeChange(listener: (mode: InputMode) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Start deciding the page's input mode (once per document; the page's own by default). */
export function watchInputMode(doc: InputDocument | undefined = typeof document === 'undefined' ? undefined : document): void {
  const view = doc?.defaultView
  if (!doc || !view || watched.has(doc)) return
  watched.add(doc)
  const root = doc.documentElement
  root.setAttribute('data-input-mode', mode)
  const set = (next: InputMode) => {
    if (next === mode) return
    mode = next
    root.setAttribute('data-input-mode', next)
    for (const listener of listeners) listener(next)
  }
  // A press's own clicks (and a label's, passed on to its field) come after its release, in the same task: they are
  // left out until that task ends, however long the press was held. Each press has its number, so a timer left by an
  // earlier press can't end a later one; a key ends any press whose release never came (a native context menu's).
  let pressNumber = 0
  let pressing = 0
  const note = (event: Event) => {
    const input = event as unknown as InputEventLike
    if (input.isTrusted === false) return
    if (input.type === 'pointerup' || input.type === 'pointercancel') {
      const released = pressing
      setTimeout(() => { if (pressing === released) pressing = 0 }, 0)
      return
    }
    if (input.type === 'click' && pressing) return
    const kind = inputKindOf(input)
    if (!kind) return
    pressing = kind === 'pointer' ? ++pressNumber : 0
    set(kind)
  }
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'click']) view.addEventListener(type, note, true)
}
