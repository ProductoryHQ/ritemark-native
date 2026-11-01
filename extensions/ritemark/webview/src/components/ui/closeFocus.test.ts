/**
 * 2.2 (Jarmo's Gate 1 finding on 2.1 RC3): after a mouse pick from a menu, no focus goes back to its trigger, so no
 * keyboard ring shows on it; after a keyboard close it does. The rule, its input tracking, and that the shared menu and
 * list contents take it by default while a consumer's own `onCloseAutoFocus` stays its own.
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
assert.equal(inputKindOf({ type: 'pointerdown' }), 'pointer', 'a press of the mouse, a pen or a finger')
for (const key of ['Enter', ' ', 'Escape', 'ArrowDown', 'Tab', 'a']) {
  assert.equal(inputKindOf({ type: 'keydown', key }), 'keyboard', `${JSON.stringify(key)} is the keyboard`)
}
for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
  assert.equal(inputKindOf({ type: 'keydown', key }), null, `${key} alone says nothing`)
}
assert.equal(inputKindOf({ type: 'keydown', key: 'c', metaKey: true }), null, 'a shortcut says nothing')
assert.equal(inputKindOf({ type: 'keydown', key: 'Enter', ctrlKey: true }), null, 'a shortcut says nothing')
assert.equal(inputKindOf({ type: 'keyup', key: 'Enter' }), null, 'only the press counts')
assert.equal(inputKindOf({ type: 'pointermove' }), null, 'moving over a menu is not a pick')

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
assert.deepEqual([...listeners.keys()].sort(), ['keydown', 'pointerdown'])
const press = (event: Record<string, unknown>) => listeners.get(String(event.type))!(event as unknown as Event)

/** A close event as Radix's FocusScope gives it; `prevented` says whether the trigger keeps the focus off. */
function closeEvent() {
  const event = { defaultPrevented: false, preventDefault() { event.defaultPrevented = true } }
  return event
}
function closesWithFocusBack(): boolean {
  const event = closeEvent()
  focusTriggerOnlyAfterKeyboard(event as unknown as Event)
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

// ── The shared menu and list contents take the rule; a consumer's own handler stays its own ──
type Rendered = { props: { children: { props: { onCloseAutoFocus?: unknown } } } }
const contents = { DropdownMenuContent, SelectContent } as unknown as Record<string, { render(props: object, ref: null): Rendered }>
const own = () => {}
for (const [name, content] of Object.entries(contents)) {
  const byDefault = content.render({}, null).props.children.props.onCloseAutoFocus
  assert.equal(byDefault, focusTriggerOnlyAfterKeyboard, `${name}: the rule by default`)
  const given = content.render({ onCloseAutoFocus: own }, null).props.children.props.onCloseAutoFocus
  assert.equal(given, own, `${name}: a consumer's own onCloseAutoFocus is kept as it is`)
}

console.log('closeFocus.test.ts: all assertions passed')
