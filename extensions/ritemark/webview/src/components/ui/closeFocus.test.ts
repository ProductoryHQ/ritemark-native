/**
 * 2.2 (Jarmo's Gate 1 finding on 2.1 RC3): after a mouse pick from a menu, no focus goes back to its trigger, so no
 * keyboard ring shows on it; after a keyboard close it does. The rule, its input tracking, and that the shared menu and
 * list contents take it by default, after a consumer's own `onCloseAutoFocus` when one is given.
 *
 * Run: npx tsx webview/src/components/ui/closeFocus.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { inputKindOf, watchInput, lastInputKind, focusTriggerOnlyAfterKeyboard } = await import('./close-focus')
const { DropdownMenuContent } = await import('./dropdown-menu')
const { SelectContent } = await import('./select')

// ── What an input says ────────────────────────────────────────────────────────
const kindOf = (event: Parameters<typeof inputKindOf>[0], mac = false) => inputKindOf(event, mac)
assert.equal(kindOf({ type: 'pointerdown' }), 'pointer', 'a press of the mouse, a pen or a finger')
for (const key of ['Enter', ' ', 'Escape', 'ArrowDown', 'Tab', 'a']) {
  assert.equal(kindOf({ type: 'keydown', key }), 'keyboard', `${JSON.stringify(key)} is the keyboard`)
}
for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']) {
  assert.equal(kindOf({ type: 'keydown', key }), null, `${key} alone says nothing`)
}
assert.equal(kindOf({ type: 'keydown', key: 'c', metaKey: true }), null, 'a shortcut says nothing')
assert.equal(kindOf({ type: 'keydown', key: 'v', ctrlKey: true }), null, 'a shortcut says nothing')
assert.equal(kindOf({ type: 'keydown', key: 'f', altKey: true }), null, "Windows' Alt with a letter is a menu's shortcut")
// Radix picks, closes and moves on these keys whatever is held: a close by Ctrl+Enter or ⌘-Escape is the keyboard's
for (const key of ['Enter', ' ', 'Escape', 'Tab', 'ArrowDown', 'Home']) {
  assert.equal(kindOf({ type: 'keydown', key, ctrlKey: true }), 'keyboard', `Ctrl+${JSON.stringify(key)} is the keyboard`)
  assert.equal(kindOf({ type: 'keydown', key, metaKey: true, altKey: true }), 'keyboard', `⌘⌥${JSON.stringify(key)} is the keyboard`)
}
// Characters are typing: AltGr's (Windows reports AltGr as Ctrl and Alt held), and the Mac's Option ones
const altGr = (key: string) => ({ type: 'keydown', key, ctrlKey: true, altKey: true, getModifierState: (k: string) => k === 'AltGraph' })
assert.equal(kindOf(altGr('€')), 'keyboard', "AltGr's character is typing")
assert.equal(
  kindOf({ type: 'keydown', key: 'e', ctrlKey: true, altKey: true, getModifierState: () => false }),
  null,
  'Ctrl+Alt with no AltGr is a shortcut',
)
assert.equal(kindOf({ type: 'keydown', key: '@', altKey: true }, true), 'keyboard', "a Mac's Option-2 types @ on many layouts")
assert.equal(kindOf({ type: 'keydown', key: 'c', altKey: true, metaKey: true }, true), null, '⌘⌥C is a shortcut on a Mac')
// A click no press made is a keyboard's or assistive technology's activation
assert.equal(kindOf({ type: 'click', detail: 0, isTrusted: true }), 'keyboard', 'a click no press made')
assert.equal(kindOf({ type: 'click', detail: 1, isTrusted: true }), null, 'a press made this click: the press said it')
// A script's own event says nothing about the person
assert.equal(kindOf({ type: 'click', detail: 0, isTrusted: false }), null, "a script's own click() says nothing")
assert.equal(kindOf({ type: 'keydown', key: 'Escape', isTrusted: false }), null, "a script's own Escape says nothing")
assert.equal(kindOf({ type: 'pointerdown', isTrusted: false }), null, "a script's own press says nothing")
assert.equal(kindOf({ type: 'keyup', key: 'Enter' }), null, 'only the press counts')
assert.equal(kindOf({ type: 'pointermove' }), null, 'moving over a menu is not a pick')

// ── The page's last input, seen before any menu handles it ────────────────────
const listeners = new Map<string, (event: Event) => void>()
const page = {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean) {
    assert.equal(capture, true, `${type} is watched in the capture phase`)
    assert.ok(!listeners.has(type), `${type} is watched once`)
    listeners.set(type, listener)
  },
}
watchInput(page)
watchInput(page)
assert.deepEqual([...listeners.keys()].sort(), ['click', 'keydown', 'pointercancel', 'pointerdown', 'pointerup'])
const press = (event: Record<string, unknown>) => listeners.get(String(event.type))!(event as unknown as Event)
const taskEnds = () => new Promise((resolve) => setTimeout(resolve, 5))

/** A close event as Radix's FocusScope gives it; `prevented` says whether the trigger keeps the focus off. */
function closeEvent() {
  const event = { defaultPrevented: false, preventDefault() { event.defaultPrevented = true } }
  return event
}
function closesWithFocusBack(handler: (event: Event) => void = focusTriggerOnlyAfterKeyboard): boolean {
  const event = closeEvent()
  handler(event as unknown as Event)
  return !event.defaultPrevented
}

assert.equal(lastInputKind(), 'keyboard', 'nothing seen yet: Radix as before, focus goes back')
assert.equal(closesWithFocusBack(), true)

press({ type: 'pointerdown' })
assert.equal(lastInputKind(), 'pointer')
assert.equal(closesWithFocusBack(), false, 'a mouse pick or a click outside: no focus back, no ring')

press({ type: 'keydown', key: 'Enter' })
assert.equal(closesWithFocusBack(), true, 'Enter on an item: focus back to the trigger, with its ring')

press({ type: 'pointerdown' })
press({ type: 'keydown', key: 'Escape' })
assert.equal(closesWithFocusBack(), true, 'Escape after the mouse opened the menu: focus back')

press({ type: 'keydown', key: 'ArrowDown' })
press({ type: 'pointerdown' })
assert.equal(closesWithFocusBack(), false, 'opened by the keyboard, picked with the mouse: no focus back')

press({ type: 'keydown', key: 'Shift' })
assert.equal(closesWithFocusBack(), false, 'a modifier pressed after the mouse pick changes nothing')

press({ type: 'keydown', key: 'Escape', isTrusted: false })
assert.equal(closesWithFocusBack(), false, "a script's own Escape after the mouse pick changes nothing")

// A press's own clicks come after its release, in the same task, however long it was held: a label's click passed on
// to its field is not a second input. A click no press made, later, is.
press({ type: 'pointerdown' })
press({ type: 'pointerup' })
press({ type: 'click', detail: 0, isTrusted: true })
assert.equal(lastInputKind(), 'pointer', "a press's own click, passed on by a label, is not a second input")
await taskEnds()
press({ type: 'click', detail: 0, isTrusted: true })
assert.equal(lastInputKind(), 'keyboard', 'a click no press made, after the press is over')
assert.equal(closesWithFocusBack(), true, 'then the trigger gets the focus back')
press({ type: 'pointerdown' })
press({ type: 'keydown', key: 'Enter', metaKey: true })
assert.equal(closesWithFocusBack(), true, 'opened with the mouse, picked with ⌘-Enter: focus back')

// ── The shared menu and list contents take the rule, after a consumer's own handler ──
type Rendered = { props: { children: { props: { onCloseAutoFocus: (event: Event) => void } } } }
const contents = { DropdownMenuContent, SelectContent } as unknown as Record<string, { render(props: object, ref: null): Rendered }>
press({ type: 'pointerdown' })
for (const [name, content] of Object.entries(contents)) {
  const byDefault = content.render({}, null).props.children.props.onCloseAutoFocus
  assert.equal(byDefault, focusTriggerOnlyAfterKeyboard, `${name}: the rule by default`)

  let watched = 0
  const watching = content.render({ onCloseAutoFocus: () => { watched += 1 } }, null).props.children.props.onCloseAutoFocus
  assert.equal(closesWithFocusBack(watching), false, `${name}: a handler that only watches the close keeps the rule after a mouse pick`)
  assert.equal(watched, 1, `${name}: the consumer's own handler runs`)

  let ownFocus = 0
  const focusingElsewhere = content.render({ onCloseAutoFocus: (event: Event) => { event.preventDefault(); ownFocus += 1 } }, null)
    .props.children.props.onCloseAutoFocus
  closesWithFocusBack(focusingElsewhere)
  assert.equal(ownFocus, 1, `${name}: a handler that puts the focus elsewhere (Share, the link menu) stays in charge`)
}

console.log('closeFocus.test.ts: all assertions passed')
