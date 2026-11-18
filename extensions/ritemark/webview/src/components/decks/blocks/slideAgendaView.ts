/**
 * The decks README, small details 14: the Agenda on the stage. The block holds nothing of its own; its list is the
 * deck's section slides as they are now (`agendaOf`), drawn by the one renderer's `agendaHtml`, so the stage, the strip,
 * the wall and the page draw the same list. It draws again when the deck changes (a section added, renamed, skipped or
 * deleted). A deck with no sections shows the quiet "Add a section slide to fill the agenda" here, in the editor only.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'
import { agendaHtml, type AgendaDrawing } from '../../../../../src/decks/blocks/agenda'
import { agendaKey } from '../../../../../src/decks/blocks/slideRenderer'
import { SlideAgenda } from './slideEditorMarkdown'

/** The event a redrawn Agenda sends up the stage, so the stage measures its fit again (the list's height changed). */
export const AGENDA_DRAWN_EVENT = 'deck-agenda-drawn'

/** Where the stage's Agenda reads the deck: its sections now, and a call when they may have changed. */
export interface AgendaSource {
  current: () => AgendaDrawing
  subscribe: (listener: () => void) => () => void
}

class SlideAgendaView implements NodeView {
  dom: HTMLElement
  private shown = ''
  private readonly stop: () => void

  constructor(private node: PMNode, private readonly source: AgendaSource | null) {
    this.dom = document.createElement('div')
    this.dom.className = 'blk-agenda-host'
    this.dom.setAttribute('contenteditable', 'false')
    this.dom.setAttribute('data-agenda', '')
    this.draw()
    this.stop = source ? source.subscribe(() => { if (this.draw()) this.dom.dispatchEvent(new CustomEvent(AGENDA_DRAWN_EVENT, { bubbles: true })) }) : () => {}
  }

  /** Draw the deck's list; true when it changed. */
  private draw(): boolean {
    const drawing = this.source?.current() ?? { entries: [], hint: true }
    const key = `${drawing.hint}\u0002${agendaKey(drawing.entries)}`
    if (key === this.shown) return false
    this.shown = key
    // `agendaHtml` escapes every title; it never draws the block's own lines.
    this.dom.innerHTML = agendaHtml(drawing) || ''
    return true
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    return true
  }

  /** Drawn, never typed in: the editor reads nothing back from it. */
  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    this.stop()
  }
}

/** The Agenda node with its drawing from `source` (the stage's deck), or with an empty deck's line in a test. */
export function slideAgendaWithView(source: AgendaSource | null) {
  return SlideAgenda.extend({
    addNodeView() {
      return ({ node }) => new SlideAgendaView(node, source)
    },
  })
}
