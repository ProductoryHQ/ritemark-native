/**
 * Sprint 146 (R3): one tracker per webview decides whether a focus ring shows. The inputs to modes, the default, one
 * watcher per document, the press's own clicks, and that the shared menu and list contents give the focus back to
 * their trigger after every close (decision 1), the ring being the mode's.
 *
 * Run: npx tsx webview/src/components/ui/inputMode.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { inputKindOf, watchInputMode, inputMode, onInputModeChange } = await import('./input-mode')
const { DropdownMenuContent } = await import('./dropdown-menu')
const { SelectContent } = await import('./select')

// ── What an input says ────────────────────────────────────────────────────────
const kindOf = (event: Parameters<typeof inputKindOf>[0], mac = false) => inputKindOf(event, mac)
assert.equal(kindOf({ type: 'pointerdown' }), 'pointer', 'a press of the mouse, a pen or a finger')
for (const key of ['Enter', ' ', 'Escape', 'ArrowDown', 'Tab', 'a']) {
  assert.equal(kindOf({ type: 'keydown', key }), 'keyboard', `${JSON.stringify(key)} is the keyboard`)
}
for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock']) {
  assert.equal(kindOf({ type: 'keydown', key }), null, `${key} alone says nothing`)
}
assert.equal(kindOf({ type: 'keydown', key: 'c', metaKey: true }), null, '⌘C is a shortcut')
assert.equal(kindOf({ type: 'keydown', key: 'v', ctrlKey: true }), null, 'Ctrl+V is a shortcut')
assert.equal(kindOf({ type: 'keydown', key: 'f', altKey: true }), null, "Windows' Alt with a letter is a menu's shortcut (S21)")
// Radix picks, closes and moves on these keys whatever is held
for (const key of ['Enter', ' ', 'Escape', 'Tab', 'ArrowDown', 'Home']) {
  assert.equal(kindOf({ type: 'keydown', key, ctrlKey: true }), 'keyboard', `Ctrl+${JSON.stringify(key)} is the keyboard`)
  assert.equal(kindOf({ type: 'keydown', key, metaKey: true, altKey: true }), 'keyboard', `⌘⌥${JSON.stringify(key)} is the keyboard`)
}
// Characters are typing: AltGr's (Windows reports AltGr as Ctrl and Alt held), and the Mac's Option ones
const altGr = (key: string) => ({ type: 'keydown', key, ctrlKey: true, altKey: true, getModifierState: (k: string) => k === 'AltGraph' })
assert.equal(kindOf(altGr('€')), 'keyboard', "AltGr's character is typing")
assert.equal(kindOf({ type: 'keydown', key: 'e', ctrlKey: true, altKey: true, getModifierState: () => false }), null, 'Ctrl+Alt with no AltGr is a shortcut')
assert.equal(kindOf({ type: 'keydown', key: '@', altKey: true }, true), 'keyboard', "a Mac's Option-2 types @ on many layouts")
assert.equal(kindOf({ type: 'keydown', key: 'c', altKey: true, metaKey: true }, true), null, '⌘⌥C is a shortcut on a Mac')
// A click no press made is a keyboard's or assistive technology's activation; a press's click says nothing
assert.equal(kindOf({ type: 'click', detail: 0 }), 'keyboard', 'a click no press made')
assert.equal(kindOf({ type: 'click', detail: 1 }), null, 'a press made this click: the press said it')
// A script's own event says nothing about the person, whatever its type
for (const event of [{ type: 'click', detail: 0 }, { type: 'keydown', key: 'Escape' }, { type: 'pointerdown' }]) {
  assert.equal(kindOf({ ...event, isTrusted: false }), null, `a script's own ${event.type} says nothing`)
}
assert.equal(kindOf({ type: 'keyup', key: 'Enter' }), null, 'only the press counts')
assert.equal(kindOf({ type: 'pointermove' }), null, 'moving over a menu is not a pick')

// ── The page's mode, written on <html> from the capture phase ─────────────────
const attributes = new Map<string, string>()
const listeners = new Map<string, (event: Event) => void>()
const page = {
  documentElement: { setAttribute: (name: string, value: string) => { attributes.set(name, value) } },
  defaultView: {
    addEventListener(type: string, listener: (event: Event) => void, capture: boolean) {
      assert.equal(capture, true, `${type} is watched in the capture phase`)
      assert.ok(!listeners.has(type), `${type} is watched once`)
      listeners.set(type, listener)
    },
  },
}
assert.equal(inputMode(), 'keyboard', 'before any input: keyboard, so a page reached by the keyboard shows its focus')
watchInputMode(page)
watchInputMode(page)
assert.equal(attributes.get('data-input-mode'), 'keyboard', 'the mode is on <html> from the start')
assert.deepEqual([...listeners.keys()].sort(), ['click', 'keydown', 'pointercancel', 'pointerdown', 'pointerup'])
const press = (event: Record<string, unknown>) => listeners.get(String(event.type))!(event as unknown as Event)
const taskEnds = () => new Promise((resolve) => setTimeout(resolve, 5))
const modes: string[] = []
const stop = onInputModeChange((mode) => modes.push(mode))

press({ type: 'pointerdown' })
assert.equal(inputMode(), 'pointer')
assert.equal(attributes.get('data-input-mode'), 'pointer', 'a press: pointer, so no ring')
press({ type: 'keydown', key: 'Shift' })
press({ type: 'keydown', key: 'c', metaKey: true })
assert.equal(inputMode(), 'pointer', 'a modifier or a shortcut after the mouse changes nothing (S17)')
press({ type: 'keydown', key: 'Escape', isTrusted: false })
assert.equal(inputMode(), 'pointer', "a script's own Escape changes nothing")
press({ type: 'keydown', key: 'Tab' })
assert.equal(attributes.get('data-input-mode'), 'keyboard', 'Tab: keyboard, so the ring shows (S14)')
press({ type: 'pointerdown' })
press({ type: 'keydown', key: 'ArrowDown' })
assert.equal(inputMode(), 'keyboard', 'a menu opened with the mouse, then ↓: keyboard (S18)')
assert.deepEqual(modes, ['pointer', 'keyboard', 'pointer', 'keyboard'], 'subscribers hear each change once')
stop()

// A press's own clicks come after its release, in the same task, however long it was held; a later one counts
press({ type: 'pointerdown' })
press({ type: 'pointerup' })
press({ type: 'click', detail: 0 })
assert.equal(inputMode(), 'pointer', "a press's own click, passed on by a label, is not a second input")
await taskEnds()
press({ type: 'click', detail: 0 })
assert.equal(inputMode(), 'keyboard', 'a click no press made, after the press is over')
// A timer left by one press doesn't end the next: a quick second press, its release not yet in
press({ type: 'pointerdown' })
press({ type: 'pointerup' })
press({ type: 'pointerdown' })
await taskEnds()
press({ type: 'click', detail: 0 })
assert.equal(inputMode(), 'pointer', "the second press is still on: the first one's timer leaves it alone")
// A key ends a press whose release never came (a native context menu took it)
press({ type: 'pointerdown' })
press({ type: 'keydown', key: 'Escape' })
press({ type: 'click', detail: 0 })
assert.equal(inputMode(), 'keyboard', 'after a key, a click no press made counts again')

// ── The shared menu and list contents give the focus back after every close (decision 1) ──
type Rendered = { props: { children: { props: { onCloseAutoFocus?: unknown } } } }
const contents = { DropdownMenuContent, SelectContent } as unknown as Record<string, { render(props: object, ref: null): Rendered }>
const own = () => {}
for (const [name, content] of Object.entries(contents)) {
  assert.equal(content.render({}, null).props.children.props.onCloseAutoFocus, undefined, `${name}: Radix gives the focus back to the trigger`)
  assert.equal(content.render({ onCloseAutoFocus: own }, null).props.children.props.onCloseAutoFocus, own, `${name}: a consumer's own handler is its own`)
}

console.log('inputMode.test.ts: all assertions passed')
