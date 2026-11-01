/**
 * Where the focus goes when a menu closes (2.2; Jarmo's Gate 1 finding on 2.1 RC3, Home's "Ask with" caret): back to
 * the button that opened it only when the page's last input was the keyboard.
 *
 * Radix DropdownMenu and Select give the focus back to the trigger by script after every close, a mouse pick too.
 * Chromium then matches `:focus-visible` on it, so a mouse pick left the keyboard's ring round the caret and opened its
 * tooltip (and a Select trigger's `focus:` styles show whatever the heuristic says). Now, after a click on an item or
 * outside, no focus goes back and nothing is drawn round the trigger. After Enter, Space or Escape the trigger has the
 * focus again, with its ring, and a keyboard user carries on from it.
 *
 * The rule reads the page's last input, not the close itself: a pointer press or a key (or a click no press made:
 * assistive technology), seen in the capture phase before any menu handles it. In practice that is the input that
 * closed the menu; a menu the app closes with no input in the page follows whatever came last. The contents in
 * `dropdown-menu.tsx` and `select.tsx` take `focusTriggerOnlyAfterKeyboard` as their default `onCloseAutoFocus`; a
 * consumer that passes its own keeps it, and the two that focus something else read `lastInputKind` (Share's stand-in
 * trigger, `header/ExportMenu.tsx`; the AI sheet's link menu, `ai-sidebar/ChatLinkMenu.tsx`).
 */

export type InputKind = 'pointer' | 'keyboard'

interface InputEventLike {
  type: string
  key?: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  /** A click's count of presses: 0 for a click no press made (a keyboard's or assistive technology's activation). */
  detail?: number
  isTrusted?: boolean
  timeStamp?: number
  getModifierState?(key: string): boolean
}

interface InputTarget {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn'])
// The keys that move through a page or act on a menu: Radix picks, closes and moves on these whatever is held
const ACTING_KEYS = new Set(['Enter', ' ', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

/** What an input event says about how the person works (pure, tested); null when it says nothing. */
export function inputKindOf(event: InputEventLike): InputKind | null {
  if (event.type === 'pointerdown') return 'pointer'
  // A click no press made: assistive technology's activation (VoiceOver's VO-Space, Voice Control) sends only this.
  // A script's own click() is untrusted and says nothing; `watchInput` leaves out the click a press just made.
  if (event.type === 'click') return event.isTrusted === true && event.detail === 0 ? 'keyboard' : null
  if (event.type !== 'keydown' || !event.key) return null
  // A modifier on its own is not moving through the page
  if (MODIFIER_KEYS.has(event.key)) return null
  if (ACTING_KEYS.has(event.key)) return 'keyboard'
  // A shortcut (⌘, Ctrl or Alt held) is not moving through the page either; AltGr's characters are typing (Windows
  // reports AltGr as Ctrl and Alt held)
  const altGraph = event.getModifierState?.('AltGraph') === true
  if (!altGraph && (event.metaKey || event.ctrlKey || event.altKey)) return null
  return 'keyboard'
}

// A click this soon after a press is that press's own (a label passing its click on to its field), not a second input
const PRESS_CLICK_MS = 1000

// Nothing seen yet keeps Radix's own behaviour: the trigger gets the focus back
let lastInput: InputKind = 'keyboard'
const watchedTargets = new WeakSet<object>()

/** Start remembering the last input on a window (once per window; the page's own window by default). */
export function watchInput(target: InputTarget | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!target || watchedTargets.has(target)) return
  watchedTargets.add(target)
  let lastPressAt = -Infinity
  const note = (event: Event) => {
    const input = event as unknown as InputEventLike
    const kind = inputKindOf(input)
    if (!kind) return
    const at = input.timeStamp ?? 0
    if (input.type === 'click' && at - lastPressAt < PRESS_CLICK_MS) return
    if (kind === 'pointer') lastPressAt = at
    lastInput = kind
  }
  target.addEventListener('pointerdown', note, true)
  target.addEventListener('keydown', note, true)
  target.addEventListener('click', note, true)
}

export function lastInputKind(): InputKind {
  return lastInput
}

/** A menu's default `onCloseAutoFocus`: the trigger gets the focus back only after a keyboard close. */
export function focusTriggerOnlyAfterKeyboard(event: Event): void {
  if (lastInput === 'pointer') event.preventDefault()
}

// From the first import, so the press that opens the first menu is already known
watchInput()
