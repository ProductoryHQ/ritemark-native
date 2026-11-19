/**
 * Sprint 161 (PR 2): a `:::` block on the stage, drawn as the one renderer draws it (`slideRenderer.ts`), so the slide
 * being edited looks like its thumbnail, the wall and the page: `blk-columns` and `blk-column`, `blk-boxes` with its
 * look, `blk-box` with its icon, `blk-steps`. The block's words are the editor's own content.
 *
 * PR 3 (README frame 4 and "The 'Exercise' pill is the person's own word"; the plan's "Added to PR 3"):
 *  - **A box's icon** is clicked to choose another from the grid (`handlers.pickIcon`). A box with none gets a place
 *    for one, on the stage only, under the looks that draw icons. Since the follow-up to #773 the place is never drawn
 *    (`display: none`): it tells the block bar that the caret's box has room for an icon, and the bar draws the icon
 *    handle there (`SlideBlockBar`, the `smile-plus` handle over the box's top edge). `slideCaretBox` still marks the
 *    caret's box `is-caret`; no rule draws it now.
 *  - **Steps** has no pill of its own since Sprint 164 PR 3: its old pill is a Label before it (`slideLabel.ts`), and the
 *    stage opens a slide with its pills as Labels already (`SlideEditor.stageMarkdownOf`).
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { OWN_MARK_LOOKS, boxesDrawnAttributes, columnsDrawnAttributes, revealsOne, slideBlockClassOf, type FenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { iconSvg, isPageIconName } from '../slide/pageIcons'
import { slideIcon } from '../slide/iconSet'
import { SlideDiv } from './slideEditorMarkdown'
import { divAttributesOf, revealWrappedList } from './blockBar'

/** What the stage does when a box's icon is used (SlideEditor gives it; it reads its latest state). */
export interface SlideDivHandlers {
  /** A box's icon (or its empty place) was clicked: choose one for the box at `pos`, under `anchor`. */
  pickIcon: (pos: number, anchor: HTMLElement, current: string | null) => void
}

/** The block's attributes, read from its opening line as written. */
const attributesOf: (node: PMNode) => FenceAttributes = divAttributesOf

/** The Boxes look a box is drawn under: its parent's, or Boxes. */
function lookAround(getPos: () => number | undefined, doc: () => PMNode): string {
  const pos = getPos()
  if (pos === undefined) return 'boxes'
  const parent = doc().resolve(pos).parent
  if (parent.type.name !== 'slideDiv') return 'boxes'
  return attributesOf(parent).values.look ?? 'boxes'
}

/** The attributes the block bar's values are drawn with (`boxesDrawnAttributes`, `columnsDrawnAttributes`). */
const DRAWN = ['data-count', 'data-many', 'data-width', 'data-fill', 'data-align', 'data-valign', 'style'] as const

/** A block's child blocks of one class (`box`, `column`), in order. */
export function childDivs(node: PMNode, kind: string): PMNode[] {
  const found: PMNode[] = []
  node.forEach(child => { if (child.type.name === 'slideDiv' && slideBlockClassOf(attributesOf(child)) === kind) found.push(child) })
  return found
}

/** A Columns block's columns' attributes, or null when it holds a drawn block other than a column (as the renderer). */
function onlyColumns(node: PMNode): FenceAttributes[] | null {
  const columns: FenceAttributes[] = []
  let other = false
  node.forEach(child => {
    if (child.type.name === 'commentNode') return
    const attrs = child.type.name === 'slideDiv' ? attributesOf(child) : null
    if (!attrs || slideBlockClassOf(attrs) !== 'column') other = true
    else columns.push(attrs)
  })
  return other ? null : columns
}

/** A block drawn with something before its words: a box (its icon). */
const decorated = (kind: string | null) => kind === 'box'

/** The empty icon place's mark: a plus, drawn as the page's icons are (Phosphor's regular `plus`). */
const PLUS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>'

class SlideDivView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  /** The icon, drawn before the words (a box only). */
  private readonly deco: HTMLElement | null
  private readonly kind: string | null

  constructor(
    private node: PMNode,
    private readonly getPos: () => number | undefined,
    private readonly doc: () => PMNode,
    private readonly handlers: SlideDivHandlers | null,
  ) {
    this.kind = slideBlockClassOf(attributesOf(node))
    this.dom = document.createElement('div')
    if (decorated(this.kind)) {
      this.deco = document.createElement('span')
      this.deco.setAttribute('contenteditable', 'false')
      this.contentDOM = document.createElement('div')
      this.contentDOM.className = 'blk-inner'
      this.dom.append(this.deco, this.contentDOM)
      if (handlers) this.deco.addEventListener('click', this.onIconClick)
    } else {
      this.deco = null
      this.contentDOM = this.dom
    }
    this.render()
  }

  private onIconClick = (event: MouseEvent) => {
    event.preventDefault()
    const pos = this.getPos()
    // Only an icon or its place: the Arrows look's arrow is drawn, never chosen (review of #769).
    if (pos === undefined || !this.handlers || !this.deco || this.deco.hidden || !this.deco.classList.contains('is-pickable')) return
    this.handlers.pickIcon(pos, this.deco, slideIcon(attributesOf(this.node).values.icon)?.name ?? null)
  }

  private render() {
    const attrs = attributesOf(this.node)
    const kind = this.kind
    // The caret's box keeps its mark (`slideCaretBox`) through a redraw.
    const caret = this.dom.classList.contains(CARET_CLASS)
    this.dom.className = `${kind ? `blk-${kind}` : 'blk-group'}${caret ? ` ${CARET_CLASS}` : ''}`
    this.dom.setAttribute('data-fdiv', '')
    if (kind === 'boxes') this.dom.setAttribute('data-look', attrs.values.look ?? 'boxes')
    else this.dom.removeAttribute('data-look')
    // README item 18: a block set to One by one, marked as the renderer marks it (a list's `::: incremental` wrapper is
    // then drawn at the list's own size, slide.css). The stage always shows every item.
    const reveals = kind === null ? revealWrappedList(this.node) !== null : (kind === 'boxes' || kind === 'steps' || kind === 'columns') && revealsOne(attrs)
    if (reveals) this.dom.setAttribute('data-reveal', 'one')
    else this.dom.removeAttribute('data-reveal')
    // The block bar's values, drawn as the renderer draws them (Width, Style, alignment; the columns' split).
    this.drawn(kind === 'boxes'
      ? boxesDrawnAttributes(attrs, childDivs(this.node, 'box').length)
      : kind === 'columns'
        ? columnsDrawnAttributes(attrs, onlyColumns(this.node))
        : {})
    const deco = this.deco
    if (!deco) return
    // A box: its icon, an arrow under the Arrows look, nothing under Steps and Line (they draw their own mark).
    const look = lookAround(this.getPos, this.doc)
    const name = slideIcon(attrs.values.icon)?.phosphor
    if (look === 'arrows') {
      deco.className = 'blk-mark'
      deco.innerHTML = iconSvg('arrow-right', 20)
      deco.hidden = false
      deco.removeAttribute('role')
    } else if (!OWN_MARK_LOOKS.has(look) && name && isPageIconName(name)) {
      deco.className = `blk-icon${this.handlers ? ' is-pickable' : ''}`
      deco.innerHTML = iconSvg(name, 28)
      deco.hidden = false
      this.pickable(deco, 'Change the icon')
    } else if (!OWN_MARK_LOOKS.has(look) && this.handlers) {
      // A box with no icon shows a place for one, on the stage only (README frame 4).
      deco.className = 'blk-icon is-pickable is-place'
      deco.innerHTML = PLUS_SVG
      deco.hidden = false
      this.pickable(deco, 'Add an icon')
    } else {
      deco.className = ''
      deco.textContent = ''
      deco.hidden = true
      deco.removeAttribute('role')
    }
  }

  /** The drawn attributes now, and none of the ones drawn before that are gone. */
  private drawn(attributes: Record<string, string>) {
    for (const name of DRAWN) {
      const value = attributes[name]
      if (value === undefined) this.dom.removeAttribute(name)
      else if (this.dom.getAttribute(name) !== value) this.dom.setAttribute(name, value)
    }
  }

  /** The icon as a button: its name for a screen reader, and the pointer the stage gives everything clickable. */
  private pickable(deco: HTMLElement, label: string) {
    deco.setAttribute('role', 'button')
    deco.setAttribute('aria-label', label)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type || slideBlockClassOf(attributesOf(node)) !== this.kind) return false
    // A Boxes block's look draws its boxes' marks: another look draws the block and its boxes again (ProseMirror
    // doesn't update unchanged children; review of #765).
    if (this.kind === 'boxes' && (attributesOf(node).values.look ?? 'boxes') !== (attributesOf(this.node).values.look ?? 'boxes')) return false
    this.node = node
    this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    // The icon's click is the view's own, never the editor's.
    return !!this.deco && this.deco.contains(event.target as Node)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // The block's own attributes are drawn, never read back: its class (the caret's mark, `slideCaretBox`) changing is
    // no edit (else the editor would draw the block again, and the mark again, without end).
    if (mutation.type === 'attributes' && mutation.target === this.dom) return true
    // Only what happens in the words is the editor's: the icon is drawn.
    if (mutation.type === 'selection') return !!this.deco && this.deco.contains(mutation.target as Node)
    return !!this.deco && this.deco.contains(mutation.target as Node)
  }
}

/** The box the caret is in: its empty icon place shows, and only there (17 November). */
export const CARET_CLASS = 'is-caret'

/** The position of the innermost box (`::: box`) holding the selection's head, or null. */
export function caretBoxPos(state: EditorState): number | null {
  const $head = state.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth)
    if (node.type.name === 'slideDiv' && slideBlockClassOf(attributesOf(node)) === 'box') return $head.before(depth)
  }
  return null
}

/**
 * The element the caret's mark may go on: a box this view draws, in the page. Anything else (another node's element
 * at a stale place while a slide is swapped in) would be read back by ProseMirror as a change, drawn again and marked
 * again, without end: the block bar's app run hung the deck on changing slides.
 */
export function markableBox<T extends { isConnected?: boolean; classList?: { contains(name: string): boolean } }>(found: T | null | undefined): T | null {
  return found && found.isConnected && found.classList?.contains('blk-box') ? found : null
}

const slideCaretBoxKey = new PluginKey('slideCaretBox')

/** Marks the caret's box (`is-caret`) as the selection moves; nothing in the document changes. */
function slideCaretBox(): Plugin {
  let marked: HTMLElement | null = null
  const mark = (view: EditorView) => {
    const pos = caretBoxPos(view.state)
    const found = pos === null ? null : (view.nodeDOM(pos) as HTMLElement | null)
    // Only a box this view draws (`blk-box`): a class put on any other element is a change ProseMirror reads back and
    // draws again, and the mark put back, without end (the block bar's app run: the deck hung on changing slides).
    const dom = markableBox(found)
    if (dom === marked && dom?.classList.contains(CARET_CLASS)) return
    marked?.classList.remove(CARET_CLASS)
    marked = dom
    marked?.classList.add(CARET_CLASS)
  }
  return new Plugin({
    key: slideCaretBoxKey,
    view: view => {
      mark(view)
      return { update: mark, destroy: () => { marked?.classList.remove(CARET_CLASS); marked = null } }
    },
  })
}

/** The `:::` node with the renderer's drawing, as the stage's slide editor uses it; with the stage's handlers in PR 3. */
export function slideDivWithView(handlers: SlideDivHandlers | null) {
  return SlideDiv.extend({
    addNodeView() {
      return ({ node, getPos, editor }) => new SlideDivView(node, getPos as () => number | undefined, () => editor.state.doc, handlers)
    },
    // The box being edited shows its empty icon place (17 November): the stage's editor, which has the handlers.
    addProseMirrorPlugins() {
      return handlers ? [slideCaretBox()] : []
    },
  })
}

/** The node with its drawing and no handlers (the icon drawn, not chosen). */
export const SlideDivWithView = slideDivWithView(null)
