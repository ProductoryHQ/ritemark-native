/**
 * Sprint 161 (PR 2): a `:::` block on the stage, drawn as the one renderer draws it (`slideRenderer.ts`), so the slide
 * being edited looks like its thumbnail, the wall and the page: `blk-columns` and `blk-column`, `blk-boxes` with its
 * look, `blk-box` with its icon, `blk-steps` with its pill. The icon and the pill are drawn, not edited, in this PR (the
 * icon picker and the pill come with the / menu's blocks, PR 3); the block's words are the editor's own content.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { OPEN_FENCE, OWN_MARK_LOOKS, parseFenceAttributes, slideBlockClassOf, type FenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { stepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { iconSvg, isPageIconName } from '../slide/pageIcons'
import { slideIcon } from '../slide/iconSet'
import { SlideDiv } from './slideEditorMarkdown'

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

class SlideDivView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  /** The icon or the pill, drawn before the words (a box and Steps only). */
  private readonly deco: HTMLElement | null
  private readonly kind: string | null

  constructor(private node: PMNode, private readonly getPos: () => number | undefined, private readonly doc: () => PMNode) {
    this.kind = slideBlockClassOf(attributesOf(node))
    this.dom = document.createElement('div')
    if (decorated(this.kind)) {
      this.deco = document.createElement('span')
      this.deco.setAttribute('contenteditable', 'false')
      this.contentDOM = document.createElement('div')
      this.contentDOM.className = 'blk-inner'
      this.dom.append(this.deco, this.contentDOM)
    } else {
      this.deco = null
      this.contentDOM = this.dom
    }
    this.render()
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
      deco.className = tag ? 'blk-pill' : ''
      deco.textContent = tag
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
    } else if (!OWN_MARK_LOOKS.has(look) && name && isPageIconName(name)) {
      deco.className = 'blk-icon'
      deco.innerHTML = iconSvg(name, 28)
      deco.hidden = false
    } else {
      deco.className = ''
      deco.textContent = ''
      deco.hidden = true
    }
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

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // Only what happens in the words is the editor's: the icon and the pill are drawn.
    if (mutation.type === 'selection') return false
    return !!this.deco && this.deco.contains(mutation.target as Node)
  }
}

/** The `:::` node with the renderer's drawing, as the stage's slide editor uses it. */
export const SlideDivWithView = SlideDiv.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => new SlideDivView(node, getPos as () => number | undefined, () => editor.state.doc)
  },
})
