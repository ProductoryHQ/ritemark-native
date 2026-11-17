/**
 * Each slide node draws where its part starts in the handout (16 November: the handout is a Text document): one thin
 * line, the full width of the handout, and the slide's number, small and muted at the right of the part's first line
 * (a CSS counter, so numbers follow any reorder without a redraw), in the accent for the current slide. A skipped
 * slide's number has the skipped mark beside it. That's all: the part's heading is the handout's own text under it.
 *
 * The number shows a ⋯ on hover (experience 46, "Removing a slide from the handout"): the strip's own slide menu, so a
 * slide can be removed from where the person is writing. The ⋯ is the deck view's (React, with its tooltip and menu),
 * drawn into this head's slot: each head lists its slot with the editor (`partMenuSlots`), and the deck view draws one
 * menu into each.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'
import { slideDataOf } from '../deckDocument'
import { DeckSlide } from './deckSchema'
import { EYE_SLASH_SVG } from './partHeadIcons'

/** A part head's slot for its ⋯, and where its slide node is now. */
export interface PartMenuSlot {
  /** Its own, for as long as the head stands (a React key). */
  id: number
  element: HTMLElement
  getPos: () => number | undefined
}

/** The slots of one editor's part heads, with who listens for a change of them. */
interface SlotStore {
  slots: PartMenuSlot[]
  listeners: Set<() => void>
}

let nextSlot = 0
const stores = new WeakMap<object, SlotStore>()

function storeOf(owner: object): SlotStore {
  let store = stores.get(owner)
  if (!store) {
    store = { slots: [], listeners: new Set() }
    stores.set(owner, store)
  }
  return store
}

function changed(store: SlotStore) {
  for (const listener of store.listeners) listener()
}

/** The part heads' ⋯ slots of this editor (by its TipTap editor), as a list that changes (a new array) when a head comes or goes. */
export const partMenuSlots = {
  get(editor: object): PartMenuSlot[] {
    return storeOf(editor).slots
  },
  subscribe(editor: object, listener: () => void): () => void {
    const store = storeOf(editor)
    store.listeners.add(listener)
    return () => { store.listeners.delete(listener) }
  },
}

class SlidePartHeadView implements NodeView {
  dom: HTMLElement
  private mark: HTMLElement
  private slot: PartMenuSlot
  private node: PMNode
  private owner: object

  constructor(node: PMNode, owner: object, getPos: () => number | undefined) {
    this.node = node
    this.owner = owner
    this.dom = document.createElement('div')
    this.dom.className = 'deck-part-head'
    this.dom.setAttribute('data-deck-part', '')
    this.dom.setAttribute('contenteditable', 'false')
    this.mark = document.createElement('span')
    this.mark.className = 'deck-part-number'
    this.mark.setAttribute('aria-hidden', 'true')
    const more = document.createElement('span')
    more.className = 'deck-part-more'
    this.dom.append(this.mark, more)
    this.slot = { id: ++nextSlot, element: more, getPos }
    const store = storeOf(owner)
    store.slots = [...store.slots, this.slot]
    changed(store)
    this.render()
  }

  private render() {
    const skip = slideDataOf(this.node.attrs.kind, this.node.attrs.body).skip === true
    this.dom.classList.toggle('is-skip', skip)
    this.mark.innerHTML = skip ? EYE_SLASH_SVG : ''
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render()
    return true
  }

  /** The ⋯ and its menu are the deck view's: the editor leaves their events alone. */
  stopEvent(event: Event): boolean {
    const target = event.target as Node | null
    return !!target && this.slot.element.contains(target)
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    const store = storeOf(this.owner)
    store.slots = store.slots.filter(slot => slot !== this.slot)
    changed(store)
  }
}

/** The slide node with its part head, as the deck view's handout uses it. */
export const DeckSlideWithPartHead = DeckSlide.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => new SlidePartHeadView(node, editor, getPos as () => number | undefined)
  },
})
