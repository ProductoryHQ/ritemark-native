/**
 * Each slide node draws where its part starts in the handout (16 November: the handout is a Text document): one thin
 * line, the full width of the handout, and the slide's number, small and muted at the right of the part's first line
 * (a CSS counter, so numbers follow any reorder without a redraw), in the accent for the current slide. A skipped
 * slide's number has the skipped mark beside it. That's all: the part's heading is the handout's own text under it.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'
import { slideDataOf } from '../deckDocument'
import { DeckSlide } from './deckSchema'
import { EYE_SLASH_SVG } from './partHeadIcons'

class SlidePartHeadView implements NodeView {
  dom: HTMLElement
  private mark: HTMLElement
  private node: PMNode

  constructor(node: PMNode) {
    this.node = node
    this.dom = document.createElement('div')
    this.dom.className = 'deck-part-head'
    this.dom.setAttribute('data-deck-part', '')
    this.dom.setAttribute('contenteditable', 'false')
    this.mark = document.createElement('span')
    this.mark.className = 'deck-part-number'
    this.mark.setAttribute('aria-hidden', 'true')
    this.dom.append(this.mark)
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

  ignoreMutation(): boolean {
    return true
  }
}

/** The slide node with its part head, as the deck view's handout uses it. */
export const DeckSlideWithPartHead = DeckSlide.extend({
  addNodeView() {
    return ({ node }) => new SlidePartHeadView(node)
  },
})
