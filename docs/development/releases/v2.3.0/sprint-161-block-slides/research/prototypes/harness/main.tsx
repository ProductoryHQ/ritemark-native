/**
 * Sprint 161 spike harness (throwaway): a lean TipTap editor (the editor's schema + the `:::` prototype, SlashCommands,
 * TipTap's BubbleMenu) inside a 960 × 540 slide frame scaled as the stage scales it, by `transform: scale` or by CSS
 * `zoom`. Injected into a Ritemark webview over CDP; it exposes `window.__spike161` for the measuring script.
 */
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { createEditorSchemaExtensions, editorMarked, editorTurndownService, editorHTMLToMarkdown, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { SlashCommands } from '../../extensions/SlashCommands'
import { FencedDiv, addFencedDivTurndownRule, fencedDivMarkedExtension } from '../fencedDiv'

editorMarked.use(fencedDivMarkedExtension as Parameters<typeof editorMarked.use>[0])
addFencedDivTurndownRule(editorTurndownService)

const W = 960
const H = 540
const STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6]

const CSS = `
#spike161 { position: fixed; inset: 0; z-index: 2147483000; background: #fff; overflow: auto; padding: 24px; font-family: 'Sofia Sans', sans-serif; }
#spike161 .frame { position: relative; overflow: hidden; background: #1c1b4d; color: #fff; margin-bottom: 16px; }
#spike161 .canvas { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 48px 64px; transform-origin: 0 0; }
#spike161 .canvas.zoom { position: static; }
#spike161 .ProseMirror { outline: none; font-size: calc(var(--fit, 1) * 26px); line-height: 1.35; }
#spike161 .ProseMirror h1 { font-size: 2em; margin: 0 0 .2em; font-weight: 700; }
#spike161 .ProseMirror h2 { font-size: 1.2em; margin: 0 0 .6em; font-weight: 500; opacity: .8; }
#spike161 .ProseMirror h3 { font-size: 1em; margin: 0 0 .2em; font-weight: 700; }
#spike161 .ProseMirror p { margin: 0 0 .4em; }
#spike161 .ProseMirror ul, #spike161 .ProseMirror ol { margin: 0 0 .4em 1.2em; padding: 0; }
#spike161 [data-fdiv][data-class~="columns"] { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 1.2em; }
#spike161 .bubble { background: #222; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 13px; }
#spike161 .thumbs { display: flex; gap: 12px; }
`

let editorRef: Editor | null = null
let frameEl: HTMLElement | null = null
let canvasEl: HTMLElement | null = null
let modeRef: 'transform' | 'zoom' = 'transform'

function Slide({ markdown, onReady }: { markdown: string; onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    extensions: createEditorSchemaExtensions({
      deck: [FencedDiv],
      afterImage: [
        SlashCommands,
        BubbleMenuExtension.configure({ element: document.getElementById('spike161-bubble') as HTMLElement, tippyOptions: { maxWidth: 'none', appendTo: () => document.body } }),
      ],
    }),
    content: markdownToEditorHTML(markdown),
    onCreate: ({ editor }) => onReady(editor as Editor),
  })
  return <EditorContent editor={editor} />
}

function mount(markdown: string, mode: 'transform' | 'zoom', width: number): Promise<void> {
  document.getElementById('spike161')?.remove()
  const style = document.getElementById('spike161-style') ?? Object.assign(document.createElement('style'), { id: 'spike161-style' })
  style.textContent = CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.id = 'spike161'
  const scale = width / W
  root.innerHTML = `<div class="frame" style="width:${width}px;height:${Math.round(width * H / W)}px"><div class="canvas ${mode === 'zoom' ? 'zoom' : ''}" style="${mode === 'zoom' ? `zoom:${scale}` : `transform:scale(${scale})`}"></div></div><div id="spike161-bubble" class="bubble">B I U Link</div>`
  document.body.appendChild(root)
  frameEl = root.querySelector('.frame')
  canvasEl = root.querySelector('.canvas')
  modeRef = mode
  return new Promise(resolve => {
    flushSync(() => createRoot(canvasEl!).render(<Slide markdown={markdown} onReady={editor => { editorRef = editor; resolve() }} />))
  })
}

const rect = (r: DOMRect | { left: number; top: number; right: number; bottom: number }) => ({ left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10, right: Math.round(r.right * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 })

/** The position just after `text`'s first occurrence. */
function posAfter(text: string): number {
  let found = -1
  editorRef!.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return
    const at = node.text!.indexOf(text)
    if (at >= 0) found = pos + at + text.length
  })
  return found
}

/** The caret: ProseMirror's coordinates for a position vs the right edge of the character before it (DOM ground truth). */
function caretCheck(text: string) {
  const view = editorRef!.view
  const pos = posAfter(text)
  const coords = view.coordsAtPos(pos)
  const at = view.domAtPos(pos - 1)
  let dom: DOMRect | null = null
  let hit: number | null = null
  if (at.node.nodeType === 3) {
    const r = document.createRange()
    r.setStart(at.node, at.offset)
    r.setEnd(at.node, Math.min(at.offset + 1, (at.node as Text).length))
    dom = r.getBoundingClientRect()
    hit = view.posAtCoords({ left: dom.left + dom.width * 0.75, top: dom.top + dom.height / 2 })?.pos ?? null
  }
  return { pos, coords: rect(coords), charRight: dom ? Math.round(dom.right * 10) / 10 : null, dx: dom ? Math.round((coords.left - dom.right) * 10) / 10 : null, dy: dom ? Math.round((coords.top - dom.top) * 10) / 10 : null, hit, hitOk: hit === pos || hit === pos - 1 }
}

/** A red marker at the viewport point ProseMirror gives for the position: on the caret if its coordinates are the viewport's. */
function markCaret(text: string) {
  const pos = posAfter(text)
  const c = editorRef!.view.coordsAtPos(pos)
  const m = document.createElement('div')
  m.className = 'spike161-marker'
  m.style.cssText = `position:fixed;left:${c.left - 1}px;top:${c.top}px;width:3px;height:${c.bottom - c.top}px;background:red;z-index:2147483647;pointer-events:none`
  document.body.appendChild(m)
  return { left: c.left, top: c.top }
}

/** The selection's drawn rectangles vs ProseMirror's coordinates of its ends. */
function selectionCheck(from: string, to: string) {
  const view = editorRef!.view
  const a = posAfter(from) - from.length
  const b = posAfter(to)
  editorRef!.commands.focus()
  editorRef!.commands.setTextSelection({ from: a, to: b })
  const sel = document.getSelection()!
  const r = sel.rangeCount ? sel.getRangeAt(0).getClientRects() : []
  const start = view.coordsAtPos(a)
  const first = r[0]
  return { domFirst: first ? rect(first) : null, pmStart: rect(start), dx: first ? Math.round((start.left - first.left) * 10) / 10 : null }
}

async function frame() { await new Promise(r => setTimeout(r, 50)) }

/** Type "/" after `text` and measure where the menu opens against the caret. */
async function slashCheck(text: string) {
  const view = editorRef!.view
  const pos = posAfter(text)
  editorRef!.commands.focus()
  editorRef!.commands.setTextSelection(pos)
  editorRef!.commands.insertContent(' /')
  await frame()
  await new Promise(r => setTimeout(r, 300))
  const caret = view.coordsAtPos(view.state.selection.from)
  const popup = Array.from(document.querySelectorAll('[data-tippy-root]')).map(el => el.getBoundingClientRect()).find(r => r.height > 0)
  const out = { caret: rect(caret), popup: popup ? rect(popup) : null, dxLeft: popup ? Math.round((popup.left - caret.left) * 10) / 10 : null, dyBelow: popup ? Math.round((popup.top - caret.bottom) * 10) / 10 : null }
  editorRef!.commands.undo()
  editorRef!.commands.blur()
  await frame()
  return out
}

/** Select a word and measure the bubble menu against the selection. */
async function bubbleCheck(word: string) {
  const view = editorRef!.view
  const b = posAfter(word)
  const a = b - word.length
  editorRef!.commands.focus()
  editorRef!.commands.setTextSelection({ from: a, to: b })
  await frame()
  editorRef!.view.dispatch(editorRef!.state.tr.setMeta('spike', true))
  await new Promise(r => setTimeout(r, 600))
  const start = view.coordsAtPos(a)
  const end = view.coordsAtPos(b)
  const bubble = document.getElementById('spike161-bubble')!.getBoundingClientRect()
  const centre = (start.left + end.right) / 2
  return { selection: rect({ left: start.left, top: start.top, right: end.right, bottom: end.bottom }), bubble: rect(bubble), centreOffset: Math.round(((bubble.left + bubble.right) / 2 - centre) * 10) / 10, gapAbove: Math.round((start.top - bubble.bottom) * 10) / 10, visible: bubble.width > 0 && getComputedStyle(document.getElementById('spike161-bubble')!).visibility !== 'hidden' }
}

/** The fit: the largest step whose content fits, with hysteresis on the way up. */
function fitStep(current: number): { step: number; tries: number } {
  const host = editorRef!.view.dom as HTMLElement
  const avail = H - 96
  const heightAt = (step: number) => { canvasEl!.style.setProperty('--fit', String(STEPS[step])); return host.scrollHeight }
  let step = current
  let tries = 0
  let h = heightAt(step); tries++
  while (h > avail && step < STEPS.length - 1) { step++; h = heightAt(step); tries++ }
  // Up only with room to spare: the bigger step must fit with 3 % of the height left over.
  while (step > 0 && h <= avail) {
    const up = heightAt(step - 1); tries++
    if (up <= avail * 0.97) { step--; h = up } else { heightAt(step); break }
  }
  return { step, tries }
}

function setMarkdown(markdown: string) { editorRef!.commands.setContent(markdownToEditorHTML(markdown)) }

function serializeCost(keys: number) {
  const pos = posAfter('caught most mistakes')
  editorRef!.commands.setTextSelection(pos)
  let total = 0
  for (let i = 0; i < keys; i += 1) {
    editorRef!.commands.insertContent('x')
    const t0 = performance.now()
    editorHTMLToMarkdown(editorRef!.getHTML())
    total += performance.now() - t0
  }
  return Math.round((total / keys) * 1000) / 1000
}

;(window as unknown as Record<string, unknown>).__spike161 = {
  mount, caretCheck, markCaret, hasFocus: () => document.hasFocus(), clearMarkers: () => document.querySelectorAll('.spike161-marker').forEach(m => m.remove()), selectionCheck, slashCheck, bubbleCheck, fitStep, setMarkdown, serializeCost,
  editor: () => editorRef, mode: () => modeRef, frame: () => frameEl, canvas: () => canvasEl,
  markdown: () => editorHTMLToMarkdown(editorRef!.getHTML()),
}
