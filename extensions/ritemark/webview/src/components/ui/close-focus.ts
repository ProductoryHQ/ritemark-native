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
 * The rule reads the page's last input, not the close itself: a pointer press or a key (or a click no press made),
 * seen in the capture phase before any menu handles it. In practice that is the input that closed the menu; a menu the
 * app closes with no input in the page follows whatever came last. The contents in `dropdown-menu.tsx` and
 * `select.tsx` pass their `onCloseAutoFocus` through `closeFocusHandler`: a consumer's own handler runs first, and the
 * rule follows unless that handler prevented the focus. The two that focus something else read `lastInputKind`
 * (Share's stand-in trigger, `header/ExportMenu.tsx`; the AI sheet's link menu, `ai-sidebar/ChatLinkMenu.tsx`).
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
  /** False for an event a script made (`dispatchEvent`, `click()`): it says nothing about the person. */
  isTrusted?: boolean
  getModifierState?(key: string): boolean
}

interface InputTarget {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn'])
// The keys that move through a page or act on a menu: Radix picks, closes and moves on these whatever is held
const ACTING_KEYS = new Set(['Enter', ' ', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])
const ON_A_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)

/**
 * What an input event says about how the person works (pure, tested); null when it says nothing. `mac`: on a Mac,
 * Option types characters (@ [ ] { } on many layouts), where on Windows Alt with a letter is a menu's shortcut.
 */
export function inputKindOf(event: InputEventLike, mac = ON_A_MAC): InputKind | null {
  if (event.isTrusted === false) return null
  if (event.type === 'pointerdown') return 'pointer'
  // A click no press made: a keyboard's activation, or assistive technology that sends no press of its own. (Chromium
  // sends a press before its own accessibility click, by PR 1's review round 2 reading its source, not run live: that
  // click then reads as the pointer.) `watchInput` leaves out the clicks a press makes.
  if (event.type === 'click') return event.isTrusted === true && event.detail === 0 ? 'keyboard' : null
  if (event.type !== 'keydown' || !event.key) return null
  // A modifier on its own is not moving through the page
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

// Nothing seen yet keeps Radix's own behaviour: the trigger gets the focus back
let lastInput: InputKind = 'keyboard'
const watchedTargets = new WeakSet<object>()

/** Start remembering the last input on a window (once per window; the page's own window by default). */
export function watchInput(target: InputTarget | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!target || watchedTargets.has(target)) return
  watchedTargets.add(target)
  // A press's own clicks (and a label's, passed on to its field) come after its release, in the same task: they are
  // left out until that task ends, however long the press was held
  let pressing = false
  const note = (event: Event) => {
    const input = event as unknown as InputEventLike
    if (input.isTrusted === false) return
    if (input.type === 'pointerup' || input.type === 'pointercancel') {
      setTimeout(() => { pressing = false }, 0)
      return
    }
    if (input.type === 'click' && pressing) return
    const kind = inputKindOf(input)
    if (!kind) return
    pressing = kind === 'pointer'
    lastInput = kind
  }
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'click']) target.addEventListener(type, note, true)
}

export function lastInputKind(): InputKind {
  return lastInput
}

/** A menu's default `onCloseAutoFocus`: the trigger gets the focus back only after the keyboard. */
export function focusTriggerOnlyAfterKeyboard(event: Event): void {
  if (lastInput === 'pointer') event.preventDefault()
}

/**
 * The `onCloseAutoFocus` a shared menu or list passes on: the consumer's own handler first, then the rule, unless that
 * handler prevented the close's focus itself (Share's menu, the link menu). A handler that only watches the close
 * can't bring back Radix's focus after every close.
 */
export function closeFocusHandler(own?: (event: Event) => void): (event: Event) => void {
  if (!own) return focusTriggerOnlyAfterKeyboard
  return (event) => {
    own(event)
    if (!event.defaultPrevented) focusTriggerOnlyAfterKeyboard(event)
  }
}

// From the first import, so the press that opens the first menu is already known
watchInput()
