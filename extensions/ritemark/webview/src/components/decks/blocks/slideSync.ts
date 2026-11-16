/**
 * Sprint 161 (spike §2, PR 2): how the slide editor on the stage and the slide's node in the handout's editor stay one
 * slide. The node is an atom whose body is the slide's Markdown ("atom plus string body"); the stage's editor parses it
 * and writes it back. Pure, so the tests drive the same rules the stage uses, with ProseMirror states and no view.
 *
 *  - **Writing.** Each change on the stage serializes the slide and writes it to the node. While the stage's document
 *    is still the one it was parsed from, the Markdown it was parsed from is written, byte for byte, so typing a word
 *    and deleting it again gives the slide back as it was.
 *  - **Its own echo.** The node's body that the stage's write made comes back as a change of the node: it is ignored.
 *  - **Anything else** that changes the node (an undo, the host's revision with an AI's edit, a picture put in) reaches
 *    the stage's editor as its smallest replacement (`documentReplacement`), never a reload, so the caret is mapped.
 *  - **While an input method composes** (`view.composing`), the stage writes nothing and a change from the node waits.
 *    When the composition ends, the waiting change is laid over the composed words (its replacement mapped through the
 *    stage's own steps since they were last in step), so neither the person's word nor the other change is lost, and
 *    the stage then writes the two together.
 *  - **Undo** is the handout editor's: the stage's editor has no history of its own.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Mapping } from '@tiptap/pm/transform'
import { documentReplacement } from '../../../lib/documentUpdate'

/** Meta on the stage editor's own transaction that applies a change from the node (it is never written back). */
export const SLIDE_SYNC = 'deckSlideSync'

export class SlideSync {
  /** The Markdown the stage's document was last parsed from, and that document. */
  private start: { markdown: string; doc: PMNode }
  /** The node's Markdown the stage is in step with: the last one it wrote or took in. */
  private known: string
  /** A change from the node that waits for a composition to end. */
  private pending: string | null = null
  /** The stage's document when it was last in step with the node, and its own steps since (a composition's). */
  private synced: PMNode
  private since = new Mapping()

  constructor(
    private readonly load: (markdown: string) => PMNode,
    private readonly save: (doc: PMNode) => string,
    markdown: string,
    doc: PMNode,
  ) {
    this.start = { markdown, doc }
    this.known = markdown
    this.synced = doc
  }

  /** One of the stage's own changes that isn't written yet (while an input method composes). */
  track(tr: Transaction): void {
    if (tr.docChanged) this.since.appendMapping(tr.mapping)
  }

  /** The slide's Markdown for the stage's document: the Markdown it was parsed from while it is that document still. */
  markdownOf(doc: PMNode): string {
    return doc.eq(this.start.doc) ? this.start.markdown : this.save(doc)
  }

  /** The Markdown to write for this document, or null when the node has it already. */
  toWrite(doc: PMNode): string | null {
    const markdown = this.markdownOf(doc)
    return markdown === this.known ? null : markdown
  }

  /** The stage wrote this Markdown to the node, from this document. */
  wrote(markdown: string, doc: PMNode): void {
    this.known = markdown
    this.inStep(doc)
  }

  /** The stage's document has no words the node lacks (a change wrote nothing): they are in step. */
  settled(doc: PMNode): void {
    this.inStep(doc)
  }

  private inStep(doc: PMNode): void {
    this.synced = doc
    this.since = new Mapping()
  }

  /**
   * The node's Markdown is now `markdown`. Returns the stage editor's transaction that takes it in (marked `SLIDE_SYNC`,
   * out of any history), or null: it is the stage's own write, nothing changed, or an input method is composing (it
   * is then taken in by `compositionEnded`).
   */
  incoming(markdown: string, state: EditorState, composing: boolean): Transaction | null {
    if (markdown === this.known) {
      this.pending = null
      return null
    }
    if (composing) {
      this.pending = markdown
      return null
    }
    return this.take(markdown, state)
  }

  /** A composition ended: a change from the node that waited for it, as `incoming` gives it; null when none waits. */
  compositionEnded(state: EditorState): Transaction | null {
    const markdown = this.pending
    this.pending = null
    if (markdown === null || markdown === this.known) return null
    return this.take(markdown, state)
  }

  /**
   * The stage's document parsed again from the node's Markdown as it is (its pictures' addresses arrived, say): the
   * difference, or null when there is none. The Markdown stays the one the node holds.
   */
  reparse(state: EditorState): Transaction | null {
    return this.take(this.known, state)
  }

  private take(markdown: string, state: EditorState): Transaction | null {
    const next = this.load(markdown)
    this.known = markdown
    // The stage has words of its own not yet written (a composition's): the node's change is laid over them, from the
    // document both last agreed on, so the stage keeps them and writes the two together next (`toWrite`).
    if (!state.doc.eq(this.synced)) {
      const change = documentReplacement(this.synced, next)
      this.start = { markdown, doc: next }
      if (!change) return null
      const from = this.since.map(change.from, -1)
      const to = Math.max(from, this.since.map(change.to, 1))
      const tr = state.tr.replace(from, to, change.slice)
      tr.setMeta(SLIDE_SYNC, true).setMeta('addToHistory', false)
      this.inStep(next)
      return tr
    }
    const replacement = documentReplacement(state.doc, next)
    if (!replacement) {
      this.start = { markdown, doc: state.doc }
      this.inStep(state.doc)
      return null
    }
    const tr = state.tr.replace(replacement.from, replacement.to, replacement.slice)
    tr.setMeta(SLIDE_SYNC, true).setMeta('addToHistory', false)
    this.start = { markdown, doc: tr.doc }
    this.inStep(tr.doc)
    return tr
  }
}
