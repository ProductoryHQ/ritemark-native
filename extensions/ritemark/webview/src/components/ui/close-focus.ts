/**
 * Where the focus goes when a menu closes (2.2; Jarmo's Gate 1 finding on 2.1 RC3, Home's "Ask with" caret): back to
 * the button that opened it only when the keyboard closed the menu.
 *
 * Radix DropdownMenu and Select give the focus back to the trigger by script after every close, a mouse pick too.
 * Chromium then matches `:focus-visible` on it, so a mouse pick left the keyboard's ring round the caret and opened its
 * tooltip (and a Select trigger's `focus:` styles show whatever the heuristic says). Now, after a click on an item or
 * outside, no focus goes back and nothing is drawn round the trigger. After Enter, Space or Escape the trigger has the
 * focus again, with its ring, and a keyboard user carries on from it.
 *
 * The page remembers its last input, a pointer press or a key, in the capture phase, before any menu handles it. The
 * contents in `dropdown-menu.tsx` and `select.tsx` take `focusTriggerOnlyAfterKeyboard` as their default
 * `onCloseAutoFocus`; a consumer that passes its own keeps it (Share's menu, `header/ExportMenu.tsx`, reads
 * `lastInputKind` for its stand-in trigger).
 */

export type InputKind = 'pointer' | 'keyboard'

interface InputEventLike {
  type: string
  key?: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

interface InputTarget {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn'])

/** What an input event says about how the person works (pure, tested); null when it says nothing. */
export function inputKindOf(event: InputEventLike): InputKind | null {
  if (event.type === 'pointerdown') return 'pointer'
  if (event.type !== 'keydown' || !event.key) return null
  // A modifier on its own, or a shortcut, is not moving through the page
  if (MODIFIER_KEYS.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) return null
  return 'keyboard'
}

// Nothing seen yet keeps Radix's own behaviour: the trigger gets the focus back
let lastInput: InputKind = 'keyboard'
const watchedTargets = new WeakSet<object>()

/** Start remembering the last input on a window (once per window; the page's own window by default). */
export function watchInput(target: InputTarget | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!target || watchedTargets.has(target)) return
  watchedTargets.add(target)
  const note = (event: Event) => {
    const kind = inputKindOf(event as unknown as InputEventLike)
    if (kind) lastInput = kind
  }
  target.addEventListener('pointerdown', note, true)
  target.addEventListener('keydown', note, true)
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
