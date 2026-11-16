/**
 * 17 November 2026 (Jarmo): a popup closes when you click outside it, as a pattern for every popup. The shared rule
 * (`dismissOnOutside.ts`) on a small stand-in for the DOM, then the popups that use it.
 *
 * Run: npx tsx webview/src/lib/dismissOnOutside.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { attachDismissOnOutside, focusTrigger, type DocumentLike, type NodeLike } from './dismissOnOutside'

/** A node in a tree: enough of an Element for the rule (contains, closest, matches, querySelector, focus). */
class FakeNode implements NodeLike {
  children: FakeNode[] = []
  parent: FakeNode | null = null
  constructor(public tagName: string, public attrs: Record<string, string> = {}, public doc?: FakeDoc) {}
  add(child: FakeNode): FakeNode { child.parent = this; child.doc = this.doc; this.children.push(child); return child }
  contains(other: unknown): boolean {
    for (let node = other as FakeNode | null; node; node = node.parent) if (node === this) return true
    return false
  }
  private is(selector: string): boolean {
    return selector.split(',').some(part => {
      const last = part.trim().split(/\s+/).pop()!
      if (last === '[data-radix-popper-content-wrapper]') return 'data-radix-popper-content-wrapper' in this.attrs
      if (last.startsWith('[role=')) return this.attrs.role === last.slice(7, -2)
      const tag = last.split(':')[0]
      return tag.toUpperCase() === this.tagName
    })
  }
  matches(selector: string): boolean { return this.is(selector) }
  closest(selector: string): unknown {
    for (let node: FakeNode | null = this; node; node = node.parent) if (node.is(selector)) return node
    return null
  }
  querySelector(selector: string): unknown {
    for (const child of this.children) {
      if (child.is(selector)) return child
      const deeper = child.querySelector(selector)
      if (deeper) return deeper
    }
    return null
  }
  focus(): void { if (this.doc) this.doc.activeElement = this }
}

class FakeDoc implements DocumentLike {
  activeElement: unknown = null
  body = new FakeNode('BODY', {}, this)
  private listeners: Array<{ type: string; listener: (event: Event) => void; capture: boolean }> = []
  constructor() { this.activeElement = this.body }
  querySelector(selector: string): unknown { return this.body.querySelector(selector) }
  addEventListener(type: string, listener: (event: Event) => void, capture = false) { this.listeners.push({ type, listener, capture: !!capture }) }
  removeEventListener(type: string, listener: (event: Event) => void, capture = false) {
    this.listeners = this.listeners.filter(entry => !(entry.type === type && entry.listener === listener && entry.capture === !!capture))
  }
  get count() { return this.listeners.length }
  press(target: FakeNode) { this.fire('pointerdown', { target }) }
  key(key: string, extra: Record<string, unknown> = {}) {
    const event = { key, target: this.activeElement, defaultPrevented: false, isComposing: false, preventDefault() { event.defaultPrevented = true }, ...extra }
    this.fire('keydown', event)
    return event
  }
  private fire(type: string, event: Record<string, unknown>) {
    for (const entry of [...this.listeners]) if (entry.type === type) entry.listener(event as unknown as Event)
  }
}

/** The deck's desk: the gear above the slide, Settings beside it with a layout option, the handout, a Select's list. */
function desk() {
  const doc = new FakeDoc()
  const sethead = doc.body.add(new FakeNode('DIV'))
  const gear = sethead.add(new FakeNode('BUTTON'))
  const gearIcon = gear.add(new FakeNode('SVG'))
  const slide = doc.body.add(new FakeNode('DIV'))
  const settings = doc.body.add(new FakeNode('SECTION'))
  const layout = settings.add(new FakeNode('INPUT'))
  const close = settings.add(new FakeNode('BUTTON'))
  const handout = doc.body.add(new FakeNode('DIV'))
  let open = true
  let closes = 0
  const detach = attachDismissOnOutside(doc, () => (open ? settings : null), () => gear, () => { open = false; closes++ })
  const reopen = () => { open = true }
  return { doc, gear, gearIcon, slide, settings, layout, close, handout, detach, reopen, get open() { return open }, get closes() { return closes } }
}

// ---- A press outside closes the popup; the focus is left where the press put it.
{
  const d = desk()
  d.doc.press(d.handout)
  assert.equal(d.open, false, 'a pointerdown on the handout closes Settings')
  assert.equal(d.doc.activeElement, d.doc.body, 'an outside press moves no focus itself')
}
{
  const d = desk()
  d.doc.press(d.slide)
  assert.equal(d.open, false, 'a pointerdown on the slide closes Settings')
}

// ---- A press inside keeps it open (choosing a layout or a picture place).
{
  const d = desk()
  d.doc.press(d.layout)
  d.doc.press(d.settings)
  assert.equal(d.open, true, 'a press inside Settings keeps them open')
  assert.equal(d.closes, 0)
}

// ---- A press on the trigger is not outside: the gear toggles by itself, so it doesn't close and reopen.
{
  const d = desk()
  d.doc.press(d.gear)
  d.doc.press(d.gearIcon)
  assert.equal(d.open, true, 'a press on the gear (or its icon) leaves the toggle to the gear')
}

// ---- Esc closes it and gives the focus back to the trigger.
{
  const d = desk()
  d.layout.focus()
  const event = d.doc.key('Escape')
  assert.equal(d.open, false, 'Esc closes Settings')
  assert.equal(d.doc.activeElement, d.gear, 'the focus goes back to the gear')
  assert.equal(event.defaultPrevented, true, 'Esc is spent on the popup')
}
{
  // Esc with nothing focused (the focus was on the body): the gear takes it, so the keyboard can carry on.
  const d = desk()
  d.doc.key('Escape')
  assert.equal(d.doc.activeElement, d.gear)
}
{
  // Esc while typing elsewhere (the handout's text) closes Settings and leaves the caret where it is.
  const d = desk()
  const text = d.handout.add(new FakeNode('TEXTAREA'))
  text.focus()
  d.doc.key('Escape')
  assert.equal(d.open, false)
  assert.equal(d.doc.activeElement, text, 'focus outside the popup stays where it was')
}
{
  // Other keys, an Esc already handled (a field's own first Esc) and an Esc while composing do nothing.
  const d = desk()
  d.layout.focus()
  d.doc.key('Enter')
  d.doc.key('Escape', { defaultPrevented: true })
  d.doc.key('Escape', { isComposing: true })
  assert.equal(d.open, true)
  assert.equal(d.doc.activeElement, d.layout)
}

// ---- Radix layers portalled out of the popup are its own: a Select's list or a tooltip inside does not close it.
{
  const d = desk()
  const wrapper = d.doc.body.add(new FakeNode('DIV', { 'data-radix-popper-content-wrapper': '' }))
  const list = wrapper.add(new FakeNode('DIV', { role: 'listbox' }))
  const option = list.add(new FakeNode('DIV', { role: 'option' }))
  d.doc.press(option)
  assert.equal(d.open, true, 'choosing from a Select inside the popup keeps it open')
  // While that list is open, the first press outside closes only the list (Radix does that one itself).
  d.doc.press(d.handout)
  assert.equal(d.open, true, 'the first outside press belongs to the open list')
  wrapper.parent!.children = wrapper.parent!.children.filter(child => child !== wrapper)
  d.doc.press(d.handout)
  assert.equal(d.open, false, 'with the list gone, the next press closes the popup')
}
{
  const d = desk()
  const wrapper = d.doc.body.add(new FakeNode('DIV', { 'data-radix-popper-content-wrapper': '' }))
  const option = wrapper.add(new FakeNode('DIV', { role: 'listbox' })).add(new FakeNode('DIV', { role: 'option' }))
  option.focus()
  d.doc.key('Escape')
  assert.equal(d.open, true, "Esc in a Select's list closes the list, not the popup")
}

// ---- Closed or detached: nothing more happens, and no listener is left behind.
{
  const d = desk()
  d.doc.press(d.handout)
  d.doc.press(d.handout)
  assert.equal(d.closes, 1, 'a closed popup is not closed again')
  d.reopen()
  assert.equal(d.doc.count, 2)
  d.detach()
  assert.equal(d.doc.count, 0, 'detaching takes both listeners away')
  d.doc.press(d.handout)
  assert.equal(d.open, true)
}

// ---- A trigger that is a row (a field and its button) gives the focus to its first focusable element.
{
  const doc = new FakeDoc()
  const row = doc.body.add(new FakeNode('DIV'))
  const field = row.add(new FakeNode('INPUT'))
  row.add(new FakeNode('BUTTON'))
  focusTrigger(row)
  assert.equal(doc.activeElement, field)
  focusTrigger(null)
}

// ---- The popups that use it (the deck slide's Settings is a Radix Popover: slideSettingsPopup.test.ts).
const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
{
  assert.match(here('../components/decks/library/AddToLibrarySheet.tsx'), /useDismissOnOutside\(ref, onClose\)/)
  assert.match(here('../components/header/CommentsMenuButton.tsx'), /useDismissOnOutside\(rootRef,/)
  const property = here('../components/properties/AddPropertyMenu.tsx')
  assert.match(property, /useDismissOnOutside\(menuRef, onClose, \{/)
  assert.doesNotMatch(property, /addEventListener\('mousedown'/, 'the old mousedown that reopened the menu on its own button is gone')
  assert.match(here('../components/flows/NodeConfigPanel.tsx'), /useDismissOnOutside\(varPickerRef, \(\) => setShowVarPicker\(false\), \{ enabled: showVarPicker, trigger: varFieldRef \}\)/)
}

console.log('dismissOnOutside: all checks passed')
