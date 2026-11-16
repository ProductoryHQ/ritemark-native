/**
 * Sprint 157: each slide node draws its part's head in the handout: the slide's title over a thin line, with its
 * number on the right (a CSS counter, so numbers follow any reorder without a redraw).
 *
 * The title is the slide's own `title`, edited here or on the slide (the Experience lead's answer 8). It is a small
 * editing host of its own inside the atom: ProseMirror ignores its events, its mutations and its caret, and each
 * change is one transaction that rewrites the slide's `title:` line, so undo covers it as it covers the rest.
 * Enter or ↓ at its end goes on into the part's text.
 */
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
import { writeSlideBody } from '../../../../../src/decks/deckFormat'
import { slideDataOf, slideTitle } from '../deckDocument'
import { DeckSlide } from './deckSchema'
import { EYE_SLASH_SVG } from './partHeadIcons'

/** A title is one line: pasted or typed line breaks become spaces. */
export function oneLineTitle(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ')
}

class SlidePartHeadView implements NodeView {
  dom: HTMLElement
  private title: HTMLElement
  private mark: HTMLElement
  /** A section's eyebrow, "Section 2", over its title (the Experience lead's decision 12); not editable. */
  private eyebrow: HTMLElement
  private node: PMNode

  constructor(node: PMNode, private readonly editor: Editor, private readonly getPos: () => number | undefined) {
    this.node = node
    this.dom = document.createElement('div')
    this.dom.className = 'deck-part-head'
    this.dom.setAttribute('data-deck-part', '')
    this.title = document.createElement('div')
    this.title.className = 'deck-part-title'
    this.title.setAttribute('contenteditable', 'plaintext-only')
    this.title.setAttribute('spellcheck', 'true')
    this.title.setAttribute('role', 'textbox')
    this.title.setAttribute('aria-label', 'Slide title')
    // The first part's own words ("The deck's title") come from CSS, by the `is-first` mark deckCurrent puts on it.
    this.title.setAttribute('data-placeholder', 'Slide title')
    this.mark = document.createElement('span')
    this.mark.className = 'deck-part-number'
    this.mark.setAttribute('aria-hidden', 'true')
    this.eyebrow = document.createElement('div')
    this.eyebrow.className = 'deck-part-eyebrow'
    this.eyebrow.setAttribute('contenteditable', 'false')
    this.dom.append(this.eyebrow, this.title, this.mark)
    this.title.addEventListener('input', this.onInput)
    this.title.addEventListener('keydown', this.onKeyDown)
    this.title.addEventListener('blur', this.onBlur)
    this.render(true)
  }

  private render(force: boolean) {
    const data = slideDataOf(this.node.attrs.body)
    const title = slideTitle(data)
    // While the person types here, the text is theirs; the node follows it, not the other way round.
    if (force || document.activeElement !== this.title) {
      if (this.title.textContent !== title) this.title.textContent = title
    }
    this.dom.classList.toggle('is-skip', data.skip === true)
    const section = this.node.attrs.kind === 'section'
    const eyebrow = section ? `Section${data.number?.trim() ? ` ${data.number.trim()}` : ''}` : ''
    if (this.eyebrow.textContent !== eyebrow) this.eyebrow.textContent = eyebrow
    this.mark.innerHTML = data.skip ? EYE_SLASH_SVG : ''
  }

  /** After undo or redo in the title: its text from the node, the caret at its end, still in the title. */
  private renderKeepingCaret() {
    this.render(true)
    if (!this.title.isConnected) return
    const range = document.createRange()
    range.selectNodeContents(this.title)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  private onInput = () => {
    this.writeTitle(oneLineTitle(this.title.textContent ?? ''))
  }

  /** Leaving the title: spaces typed at its ends are not kept in the file. */
  private onBlur = () => {
    const text = oneLineTitle(this.title.textContent ?? '')
    if (text !== text.trim()) {
      this.writeTitle(text.trim())
      this.render(true)
    }
  }

  private writeTitle(text: string) {
    const pos = this.getPos()
    if (pos === undefined) return
    const data = slideDataOf(this.node.attrs.body)
    if ((data.title ?? '') === text) return
    const body = writeSlideBody(this.node.attrs.body, { ...data, title: text === '' ? undefined : text })
    this.editor.view.dispatch(this.editor.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, body }))
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const mod = event.metaKey || event.ctrlKey
    // Undo and redo are the editor's, so a title change undoes with the rest of the deck.
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) this.editor.commands.redo()
      else this.editor.commands.undo()
      this.renderKeepingCaret()
      return
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      event.stopPropagation()
      this.editor.commands.redo()
      this.renderKeepingCaret()
      return
    }
    const atEnd = (() => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return false
      const range = selection.getRangeAt(0).cloneRange()
      range.selectNodeContents(this.title)
      range.setStart(selection.focusNode ?? this.title, selection.focusOffset)
      return range.toString().length === 0
    })()
    if (event.key === 'Enter' || (event.key === 'ArrowDown' && atEnd)) {
      event.preventDefault()
      this.intoText()
    }
  }

  /** The caret into the part's text: its first paragraph, or a new one when the part starts with something else. */
  private intoText() {
    const pos = this.getPos()
    if (pos === undefined) return
    const { state } = this.editor
    const after = pos + this.node.nodeSize
    const next = state.doc.nodeAt(after)
    let tr = state.tr
    if (!next || !next.isTextblock) {
      tr = tr.insert(after, state.schema.nodes.paragraph.create())
    }
    tr = tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
    this.title.blur()
    this.editor.view.dispatch(tr)
    this.editor.view.focus()
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render(false)
    return true
  }

  /** The title's own events and caret are not ProseMirror's. */
  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.title.contains(event.target)
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    this.title.removeEventListener('input', this.onInput)
    this.title.removeEventListener('keydown', this.onKeyDown)
    this.title.removeEventListener('blur', this.onBlur)
  }
}

/** The slide node with its part head, as the deck view's handout uses it. */
export const DeckSlideWithPartHead = DeckSlide.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => new SlidePartHeadView(node, editor, getPos as () => number | undefined)
  },
})
