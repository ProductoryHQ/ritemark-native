/**
 * Sprint 161 (PR 2): a `:::` block on the stage, drawn as the one renderer draws it (`slideRenderer.ts`), so the slide
 * being edited looks like its thumbnail, the wall and the page: `blk-columns` and `blk-column`, `blk-boxes` with its
 * look, `blk-box` with its icon, `blk-steps` with its pill. The block's words are the editor's own content.
 *
 * PR 3 (README frame 4 and "The 'Exercise' pill is the person's own word"; the plan's "Added to PR 3"):
 *  - **A box's icon** is clicked to choose another from the grid (`handlers.pickIcon`); a box with none shows a place
 *    for one, on the stage only, under the looks that draw icons.
 *  - **The Steps pill** is edited in place, like every other word on the slide. Emptying it hides the pill; while the
 *    caret is in an empty pill, "Exercise" shows faint as its placeholder. Settings' Label row brings it back. Its words
 *    are the block's `tag` (the stage's field over the pill, `handlers.editPill`; #752's rule in `setStepsTag`).
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { OPEN_FENCE, OWN_MARK_LOOKS, parseFenceAttributes, slideBlockClassOf, type FenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { stepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { iconSvg, isPageIconName } from '../slide/pageIcons'
import { slideIcon } from '../slide/iconSet'
import { SlideDiv } from './slideEditorMarkdown'

/** What the stage does when a box's icon or the Steps pill is used (SlideEditor gives them; they read its latest state). */
export interface SlideDivHandlers {
  /** A box's icon (or its empty place) was clicked: choose one for the box at `pos`, under `anchor`. */
  pickIcon: (pos: number, anchor: HTMLElement, current: string | null) => void
  /** The Steps pill at `pos` was pressed: its words are typed in place, in the stage's field over `anchor`. */
  editPill: (pos: number, anchor: HTMLElement) => void
}

/** The block's attributes, read from its opening line as written. */
function attributesOf(node: PMNode): FenceAttributes {
  const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
  return (open ? parseFenceAttributes(open[2]) : null) ?? { classes: [], id: null, values: {} }
}

/** The Boxes look a box is drawn under: its parent's, or Boxes. */
function lookAround(getPos: () => number | undefined, doc: () => PMNode): string {
  const pos = getPos()
  if (pos === undefined) return 'boxes'
  const parent = doc().resolve(pos).parent
  if (parent.type.name !== 'slideDiv') return 'boxes'
  return attributesOf(parent).values.look ?? 'boxes'
}

/** A block drawn with something before its words: a box (its icon) and Steps (its pill). */
const decorated = (kind: string | null) => kind === 'box' || kind === 'steps'

/** The empty icon place's mark: a plus, drawn as the page's icons are (Phosphor's regular `plus`). */
const PLUS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>'

class SlideDivView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  /** The icon or the pill, drawn before the words (a box and Steps only). */
  private readonly deco: HTMLElement | null
  private readonly kind: string | null
  /** The pill's own words, typed in place (Steps only). */
  private readonly pill: HTMLElement | null = null

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
      if (this.kind === 'steps' && handlers) this.pill = this.makePill(handlers)
      if (this.kind === 'box' && handlers) this.deco.addEventListener('click', this.onIconClick)
    } else {
      this.deco = null
      this.contentDOM = this.dom
    }
    this.render()
  }

  /**
   * The pill's words, drawn in the (not editable) mark. A press on them opens the stage's field for them over the pill
   * (`handlers.editPill`), at the pill's own place and size: an editable host nested in ProseMirror's DOM lost the focus
   * at the editor's next redraw (the app run), so the typing happens in that field, written on every key.
   */
  private makePill(handlers: SlideDivHandlers): HTMLElement {
    const pill = document.createElement('span')
    pill.className = 'blk-pill-words'
    this.deco!.setAttribute('role', 'button')
    this.deco!.setAttribute('aria-label', 'Edit the label over the steps')
    this.deco!.addEventListener('mousedown', event => {
      if (event.button !== 0) return
      event.preventDefault()
      const pos = this.getPos()
      if (pos !== undefined && this.deco) handlers.editPill(pos, this.deco)
    })
    this.deco!.append(pill)
    return pill
  }

  private onIconClick = (event: MouseEvent) => {
    event.preventDefault()
    const pos = this.getPos()
    if (pos === undefined || !this.handlers || !this.deco || this.deco.hidden) return
    this.handlers.pickIcon(pos, this.deco, slideIcon(attributesOf(this.node).values.icon)?.name ?? null)
  }

  private render() {
    const attrs = attributesOf(this.node)
    const kind = this.kind
    this.dom.className = kind ? `blk-${kind}` : 'blk-group'
    this.dom.setAttribute('data-fdiv', '')
    if (kind === 'boxes') this.dom.setAttribute('data-look', attrs.values.look ?? 'boxes')
    else this.dom.removeAttribute('data-look')
    const deco = this.deco
    if (!deco) return
    if (kind === 'steps') {
      const tag = stepsTagOf(attrs)
      const pill = this.pill
      if (!pill) {
        // Without the stage's handlers (a test's view): the pill drawn, as the renderer draws it.
        deco.className = tag ? 'blk-pill' : ''
        deco.textContent = tag
        deco.hidden = !tag
        return
      }
      if (pill.textContent !== tag) pill.textContent = tag
      deco.className = 'blk-pill is-pickable'
      // Emptied, the pill hides (the stage's field shows the default faint while the caret is in it).
      deco.hidden = !tag
      return
    }
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
    // The pill's typing and the icon's click are the view's own, never the editor's.
    return !!this.deco && this.deco.contains(event.target as Node)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // Only what happens in the words is the editor's: the icon and the pill are drawn.
    if (mutation.type === 'selection') return !!this.deco && this.deco.contains(mutation.target as Node)
    return !!this.deco && this.deco.contains(mutation.target as Node)
  }
}

/** The `:::` node with the renderer's drawing, as the stage's slide editor uses it; with the stage's handlers in PR 3. */
export function slideDivWithView(handlers: SlideDivHandlers | null) {
  return SlideDiv.extend({
    addNodeView() {
      return ({ node, getPos, editor }) => new SlideDivView(node, getPos as () => number | undefined, () => editor.state.doc, handlers)
    },
  })
}

/** The node with its drawing and no handlers (the icon and the pill drawn, not edited). */
export const SlideDivWithView = slideDivWithView(null)
