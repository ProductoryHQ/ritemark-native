/**
 * Each slide node draws where its part starts in the handout (16 November: the handout is a Text document). Since
 * 17 November that is space, not a line (Jarmo: "I thing current whitespaces are enough"), and the slide's number sits
 * on a rail at the left (Jarmo: "change the number position from right side to left side. give it its own almost
 * invisible back-rail"): each part has its own track, a rounded 22 px segment from just above its heading to the end of
 * its text, and the gaps between tracks show where one slide ends and the next begins. The number (a CSS counter, so
 * numbers follow any reorder without a redraw) is sticky inside its track: while a long part scrolls it stays at the
 * top of the handout's view and leaves with the track's end. A skipped slide's number has the skipped mark under it.
 * The track's height is the deck view's to set (`measureRail`), as only the laid-out page knows where a part's text
 * ends; a click on a track makes its slide the current one (the deck view, `railPick`).
 *
 * Pointing at the track shows a ⋯ under the number (experience 46, "Removing a slide from the handout"): the strip's
 * own slide menu. The ⋯ is the deck view's (React, with its tooltip and menu), drawn into this head's slot: each head
 * lists its slot with the editor (`partMenuSlots`), and the deck view draws one menu into each. The same slot has a
 * place for the row a slide with no handout folds to (17 November, "A slide with no handout"), drawn by the deck view
 * too, so it has its tooltip.
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
  /** Where the folded row of a slide with no handout is drawn ("Slide only" and the slide's title). */
  row: HTMLElement
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
  private track: HTMLElement
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
    // The track, and in it the sticky column of the number (with the skipped mark under it) and the ⋯.
    this.track = document.createElement('div')
    this.track.className = 'deck-part-track'
    // A click makes its slide the current one (the pointing hand is the page's one rule for `role="button"`). The strip
    // is the keyboard's way to the same, so the track is no tab stop of its own.
    this.track.setAttribute('role', 'button')
    this.track.setAttribute('aria-label', 'Make this the current slide')
    const pin = document.createElement('div')
    pin.className = 'deck-part-pin'
    this.mark = document.createElement('span')
    this.mark.className = 'deck-part-number'
    this.mark.setAttribute('aria-hidden', 'true')
    const more = document.createElement('span')
    more.className = 'deck-part-more'
    pin.append(this.mark, more)
    this.track.append(pin)
    const row = document.createElement('div')
    row.className = 'deck-part-only'
    this.dom.append(this.track, row)
    this.slot = { id: ++nextSlot, element: more, row, getPos }
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

  /** The track (its click, its ⋯ and menu) and the folded row are the deck view's: the editor leaves their events alone. */
  stopEvent(event: Event): boolean {
    const target = event.target as Node | null
    return !!target && (this.track.contains(target) || this.slot.row.contains(target))
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
