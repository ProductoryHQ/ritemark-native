/**
 * Sprint 167 PR 4 (an adjacent fix, a defect on main): a picture going missing while its slide is on the stage blanked
 * the whole deck view, and so did Behind chosen in Slide settings once the corner chip came.
 *
 * TipTap's bubble menu plugin takes the menu's element out of the page as it starts (`this.element.remove()`), while
 * React still counts it as the frame's child; React's `insertBefore` of a new node before it (a missing picture's
 * Replace picture…) threw, and the deck view's root was left empty. The slide editor now keeps the menu in a box of its
 * own (`BubbleMenuBox`) that stays in the frame.
 *
 * The frame is drawn here in the order the slide editor draws it (the canvas, the missing pictures' buttons, the
 * tools, the bubble menu), with a stand-in for the menu that leaves the page as TipTap's does. Without the box, the
 * missing picture's button blanks the view (main today); with it, the view stays drawn.
 *
 * Run: npx tsx webview/src/components/decks/blocks/bubbleMenuBox.test.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { installTestDocument } from '../../../utils/markdownFidelity'

installTestDocument()
const doc = (globalThis as unknown as { document: Document }).document
Object.assign(globalThis, { window: globalThis, IS_REACT_ACT_ENVIRONMENT: false, HTMLIFrameElement: class {} })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement, useLayoutEffect, useRef } = React
const { createRoot } = await import('react-dom/client')
const { flushSync } = await import('react-dom')
const { BubbleMenuBox } = await import('./BubbleMenuBox')

const here = path.dirname(fileURLToPath(import.meta.url))

/** As TipTap's BubbleMenuPlugin does with the menu's element as it starts: out of the page. */
function LeavingMenu() {
  const ref = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => { ref.current?.remove() }, [])
  return createElement('div', { ref, className: 'bubble' })
}

function Frame({ missing, boxed }: { missing: boolean; boxed: boolean }) {
  const menu = createElement(LeavingMenu)
  return createElement('div', { className: 'deck-slide' },
    createElement('div', { className: 'deck-sl' }, 'Three berths, one plan'),
    missing ? createElement('button', { className: 'deck-replace-picture' }, 'Replace picture…') : null,
    boxed ? createElement(BubbleMenuBox, null, menu) : menu,
  )
}

function draw(boxed: boolean): { before: string; after: string; error: unknown } {
  const host = doc.createElement('div')
  doc.body.appendChild(host)
  const root = createRoot(host)
  const quiet = console.error
  console.error = () => {}
  let error: unknown = null
  try {
    flushSync(() => root.render(createElement(Frame, { missing: false, boxed })))
    const before = host.innerHTML
    try {
      // The host says the slide's picture is missing: Replace picture… comes onto the frame.
      flushSync(() => root.render(createElement(Frame, { missing: true, boxed })))
    } catch (thrown) {
      error = thrown
    }
    return { before, after: host.innerHTML, error }
  } finally {
    console.error = quiet
    host.remove()
  }
}

// ---- 1. The menu's element really leaves the page as TipTap's plugin starts (so the stand-in is fair).
{
  const require = createRequire(import.meta.url)
  const pluginFile = require.resolve('@tiptap/extension-bubble-menu')
  const plugin = fs.readFileSync(pluginFile, 'utf8')
  assert.ok(plugin.includes('this.element.remove()'), 'TipTap takes the bubble menu out of the page')
}

// ---- 2. Without the box (main today): a missing picture's button blanks the deck view.
{
  const { before, after, error } = draw(false)
  assert.ok(before.includes('Three berths'), 'drawn at first')
  assert.ok(error || !after.includes('Three berths'), 'without the box the view is blanked (or throws): the fault')
}

// ---- 3. With the box: the button comes, the slide stays drawn.
{
  const { before, after, error } = draw(true)
  assert.ok(before.includes('Three berths'))
  assert.equal(error, null, 'nothing thrown')
  assert.ok(after.includes('Three berths'), 'the slide is still drawn')
  assert.ok(after.includes('Replace picture…'), 'with the missing picture\'s button')
  assert.ok(after.includes('deck-bubble-box'), 'the box stays in the frame')
}

// ---- 4. The slide editor keeps its bubble menu in the box, and the corner chip comes before the canvas.
{
  const editor = fs.readFileSync(path.join(here, 'SlideEditor.tsx'), 'utf8')
  assert.ok(editor.includes('<BubbleMenuBox>{editor ? <FormattingBubbleMenu editor={editor} appendToBody /> : null}</BubbleMenuBox>'))
  const chipAt = editor.indexOf('<BehindChip')
  const canvasAt = editor.indexOf('<div className={classes} style={{ transform:')
  assert.ok(chipAt > 0 && canvasAt > 0 && chipAt < canvasAt, 'the chip comes before the canvas')
}

console.log('bubbleMenuBox: passed')
