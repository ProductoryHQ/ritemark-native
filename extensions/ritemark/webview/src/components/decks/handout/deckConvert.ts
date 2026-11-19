/**
 * Sprint 161 (technical plan §4, PR 2): a deck of today's slides becomes a deck of block slides at its first real
 * edit, in one transaction with that edit, so one Undo takes both back.
 *
 *  - Opening a deck writes nothing: the deck view draws a v1 slide through `legacyToBlocks` everywhere (the stage, the
 *    strip, the wall, the page), so what the person sees before the first edit is what the conversion writes.
 *  - The first real edit (typing on the stage or in the handout, a strip operation, a setting) converts every v1 slide
 *    of the nine kinds: its node becomes a bare `slide` with the block body `convertSlide` writes, and its notes and the
 *    words its layout kept hidden become one comment (`<!-- … -->`, the comment node) at the end of its part. The
 *    handout's drawn headings are written with it (`withWrittenHandout`'s rule), and the deck view puts `deck: 2` and
 *    `handout: text` in the front matter in the same change.
 *  - A kind this build doesn't know stays as it is, with its notes.
 *  - Sprint 164 PR 3: a block slide whose Steps block still has its old pill (`tag`) gets it as a Label in the same
 *    place, in the same transaction (`labelledSlideBody`); every view drew it so before (`withStepsLabels`).
 *  - Without the comment node (the comment-callouts kill switch), a slide's private words stay in its notes block,
 *    which never goes out either: nothing is lost and nothing turns public.
 *
 * Not a conversion: the host's revisions, undo and redo, the drawn headings' own transactions, and anything that
 * doesn't change the document.
 */
import { Extension } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { convertSlide, convertsToBlocks, drawsAsBlocks, hasStepsPill, labelledSlideBody, saysBlockDeck } from '../../../../../src/decks/blocks/convertDeck'
import { pictureTarget } from '../../../../../src/decks/blocks/legacyToBlocks'
import { TEXT_HANDOUT_KEY, TEXT_HANDOUT_VALUE, isBlockSlide, slideDataOf as readSlideData, withBlockMarkdown, writeSlideData } from '../../../../../src/decks/deckFormat'
import { DECK_DERIVED, DECK_OPERATION, isSlideNode, slidesOf } from '../deckDocument'
import { handoutMarkFor, hasDrawnHeadings, passes } from './drawnHeadings'
import { editorHTMLToMarkdown } from '../../../utils/editorMarkdown'

export const deckConvertKey = new PluginKey('deckConvert')

/** Meta on the transaction that converts a deck, with what it did (`DeckConversion`). */
export const DECK_CONVERTED = 'deckConverted'

/**
 * What a conversion did: how many slides became block slides, how many got a comment for their private words, and how
 * many block slides had their Steps pill written as a Label (Sprint 164 PR 3).
 */
export interface DeckConversion {
  slides: number
  comments: number
  labels: number
  /** The note of the first comment it made, in the deck's order (the notice's Show opens it); null without one. */
  firstComment: string | null
}

/** The `deck:` line as it was before the deck view wrote `deck: 2`, and the undo depth right after the step that did. */
export interface DeckVersionWritten {
  value: unknown
  depth: number
}

/**
 * The deck's `deck:` line for an edit the editor reports (Sprint 161, PR 2): `deck: 2` is written with the first edit
 * after which the deck holds a block slide (the conversion, or any edit of a deck whose slides are block slides
 * already), and an undo of that step puts the line back as it was, so the edit and its Undo are one step. Null: the
 * front matter stays as it is.
 *
 * "That step is undone" is the undo history's own count (`depth`, `undoDepth` after the change) falling below the one
 * right after the write, not what the slides look like: a deck whose slides were block slides before the edit has
 * block slides after its Undo too (the backlog's `deck: 1` deck of block slides kept `deck: 2`).
 */
export function deckVersionFor(input: { version: unknown; blocks: boolean; undo: boolean; depth: number; written: DeckVersionWritten | null }):
  { write: 2; written: DeckVersionWritten } | { restore: unknown } | null {
  const { version, written } = input
  if (input.blocks && !saysBlockDeck(version === undefined || version === null ? null : String(version))) {
    return { write: 2, written: written ?? { value: version, depth: input.depth } }
  }
  if (written && input.undo && input.depth < written.depth) return { restore: written.value }
  return null
}

type FrontMatter = { [key: string]: unknown }

/**
 * What the deck view writes into the front matter with a deck's first edit (`handout: text`, `deck: 2`), and the step
 * that wrote it, so that step's Undo takes it out again: one record for both, which the deck view and its tests drive
 * alike (review of #796).
 *
 * A step is named by the undo history's depth right after it. The history keeps a bounded number of steps and drops the
 * oldest past its depth (prosemirror-history's overflow): a dropped step can't be undone any more, so what was written
 * with it stays, and the steps after it move down by as many.
 */
export class DeckFrontMatterSteps {
  private mark: number | null = null
  private version: DeckVersionWritten | null = null
  private seen = 0

  /** Every change of the document (the editor's `transaction`), with whether it was an undo or a redo and the depth after it. */
  transaction(history: boolean, depth: number): void {
    // A new step adds one to the depth and a merged one nothing: a change that lowers it without an undo dropped steps.
    const cut = !history && depth < this.seen ? this.seen + 1 - depth : 0
    if (cut > 0) {
      this.mark = this.mark !== null && this.mark - cut >= 1 ? this.mark - cut : null
      this.version = this.version && this.version.depth - cut >= 1 ? { ...this.version, depth: this.version.depth - cut } : null
    }
    this.seen = depth
  }

  /**
   * An edit the editor reports: the front matter's change for it, with the mark and the version it leaves; null when
   * the front matter stays. `marked` and `version` are the front matter as the view holds it; `depth` is null without
   * an editor state, and then nothing is taken out.
   */
  change(input: { marked: boolean; version: unknown; doc: PMNode | null; undo: boolean; depth: number | null }):
    { marked: boolean; version: unknown; apply: <P extends FrontMatter>(properties: P) => P } | null {
    const { doc } = input
    const depth = input.depth ?? 0
    const undo = input.undo && input.depth !== null
    const changes: Array<(properties: FrontMatter) => FrontMatter> = []
    let marked = input.marked
    let version = input.version
    const mark = handoutMarkFor({ marked, drawn: !doc || hasDrawnHeadings(doc), added: this.mark, undo, depth })
    if (mark === 'add') {
      // The first real edit of the handout: its headings are written, and the mark goes with them, in this one edit.
      this.mark = depth
      marked = true
      changes.push(properties => ({ ...properties, [TEXT_HANDOUT_KEY]: TEXT_HANDOUT_VALUE }))
    } else if (mark === 'remove') {
      this.mark = null
      marked = false
      changes.push(properties => {
        const next = { ...properties }
        delete next[TEXT_HANDOUT_KEY]
        return next
      })
    }
    const written = deckVersionFor({ version, blocks: !!doc && slidesOf(doc).some(entry => isBlockSlide(entry.kind)), undo, depth, written: this.version })
    if (written && 'write' in written) {
      this.version = written.written
      version = 2
      changes.push(properties => ({ ...properties, deck: 2 }))
    } else if (written) {
      const before = written.restore
      this.version = null
      version = before
      changes.push(properties => {
        const next = { ...properties }
        if (before === undefined) delete next.deck
        else next.deck = before
        return next
      })
    }
    if (changes.length === 0) return null
    return { marked, version, apply: <P extends FrontMatter>(properties: P) => changes.reduce<FrontMatter>((current, change) => change(current), properties) as P }
  }
}

/**
 * Does the document hold a slide the conversion would change: a v1 slide of one of the nine kinds, or a block slide
 * whose Steps block still has its old pill (Sprint 164 PR 3)?
 */
export function needsConversion(doc: PMNode): boolean {
  let found = false
  doc.forEach(node => { if (!found && isSlideNode(node) && (convertsToBlocks(node.attrs.kind) || hasStepsPill(node.attrs.kind, node.attrs.body))) found = true })
  return found
}

/** The comment node for a conversion's comment (`<!-- body -->`), through the node's own parse rule; null without one. */
function commentNodeOf(schema: Schema, comment: string): PMNode | null {
  if (!schema.nodes.commentNode) return null
  const body = comment.replace(/^<!--\s?/, '').replace(/\s?-->$/, '')
  const element = document.createElement('div')
  const note = document.createElement('ritemark-comment')
  note.setAttribute('data-note', body)
  element.appendChild(note)
  const node = PMDOMParser.fromSchema(schema).parseSlice(element).content.firstChild
  return node && node.type === schema.nodes.commentNode ? node : null
}

/**
 * A part's handout as Markdown, as the file has it (for a library copy's stamp, which counts its handout): the blocks
 * from `from` to `to` through the editor's own save.
 */
export function handoutMarkdownOf(doc: PMNode, from: number, to: number): string {
  if (to <= from) return ''
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.slice(from, to).content, { document }))
  return editorHTMLToMarkdown(container.innerHTML).replace(/^\n+/, '').replace(/\s+$/, '')
}

/** The comment's words as a notes block holds them, for an editor without the comment node. */
function notesOf(comment: string): string {
  return comment.replace(/^<!--\s?/, '').replace(/\s?-->$/, '')
}

/**
 * Convert the deck in `tr` (on the document as `tr` has it now): every v1 slide of the nine kinds as a block slide,
 * its comment at the end of its part, and every drawn heading written. Null when there was nothing to convert; the
 * transaction is then left as it was.
 */
export function convertDeckInto(tr: Transaction): DeckConversion | null {
  if (!needsConversion(tr.doc)) return null
  const schema = tr.doc.type.schema
  const result: DeckConversion = { slides: 0, comments: 0, labels: 0, firstComment: null }
  const slides = slidesOf(tr.doc)
  // From the last part to the first, so the positions before each one still hold.
  for (let index = slides.length - 1; index >= 0; index--) {
    const slide = slides[index]
    const next = slides[index + 1]
    const partEnd = next ? next.pos : tr.doc.content.size
    if (hasStepsPill(slide.kind, slide.node.attrs.body)) {
      // Its pill as a Label; a copy's stamp renewed when the move changes it (an emptied pill's), as below.
      const handout = slide.data.from ? handoutMarkdownOf(tr.doc, slide.pos + slide.node.nodeSize, partEnd) : ''
      tr.setNodeMarkup(slide.pos, undefined, { ...slide.node.attrs, body: labelledSlideBody(slide.node.attrs.body, handout, '') })
      result.labels++
      continue
    }
    if (!convertsToBlocks(slide.kind)) continue
    // A library copy's stamp counts its handout: the part's words go with it, so a copy still as copied gets the block
    // stamp. The deck's folder isn't known here: a stamp that depends on its paths stays as it was (`renewedFrom`).
    const handout = slide.data.from ? handoutMarkdownOf(tr.doc, slide.pos + slide.node.nodeSize, partEnd) : ''
    const converted = convertSlide(slide.kind, slide.node.attrs.body, slide.node.attrs.notes ?? null, handout, '')
    const comment = converted.comment ? commentNodeOf(schema, converted.comment) : null
    const notes = converted.comment && !comment ? notesOf(converted.comment) : null
    if (comment) {
      tr.insert(partEnd, comment)
      result.comments++
      // From the last part to the first: the last one written is the deck's first.
      result.firstComment = comment.attrs.note as string
    }
    tr.setNodeMarkup(slide.pos, undefined, { ...slide.node.attrs, kind: '', body: converted.body, notes })
    result.slides++
  }
  writeDrawnHeadings(tr)
  tr.setMeta(DECK_OPERATION, true).setMeta(DECK_CONVERTED, result)
  return result
}

/**
 * The handout's drawn headings written in `tr`, as its text from now on (`withWrittenHandout`'s rule): the conversion's
 * and a slide's join (`deckRemove.ts`) both write them so. The empty line the view draws under a drawn heading with
 * nothing under it (`derivedHeadings`) goes with it: no file holds an empty line, so the save's echo would take it out,
 * and a host revision that replaces a range of the document (a new picture's address, Codex's P1 path on #765) would
 * cut the step's Undo short.
 */
export function writeDrawnHeadings(tr: Transaction): void {
  const empties: number[] = []
  let previous: PMNode | null = null
  let previousDrawn = false
  tr.doc.forEach((node, pos, index) => {
    if (node.type.name === 'heading' && node.attrs.deckDrawn === true) tr.setNodeMarkup(pos, undefined, { ...node.attrs, deckDrawn: false })
    const after = index + 1 < tr.doc.childCount ? tr.doc.child(index + 1) : null
    if (previous && previousDrawn && node.type.name === 'paragraph' && node.childCount === 0 && (!after || isSlideNode(after) || after.type.name === 'commentNode')) empties.push(pos)
    previousDrawn = node.type.name === 'heading' && node.attrs.deckDrawn === true
    previous = node
  })
  for (const pos of empties.reverse()) {
    const node = tr.doc.nodeAt(pos)
    if (node) tr.delete(pos, pos + node.nodeSize)
  }
}

/**
 * A picture the host saved for a slide drawn as blocks (a block slide, or a v1 slide shown as one): beside or behind it
 * when the slide places one there, else a picture block at the end of its words. A v1 slide's deck is converted in the
 * same transaction first, so the picture joins the slide the person sees and none of its words move (review of #765:
 * the old path made it a Picture slide, whose layout hides its items). Null for any other slide.
 */
export function pictureIntoSlide(state: EditorState, slideId: string, path: string): Transaction | null {
  const tr = state.tr
  const before = slidesOf(tr.doc).find(entry => entry.data.id === slideId)
  if (!before || !drawsAsBlocks(before.kind)) return null
  // A v1 Picture slide's picture is replaced, as before the PR (review of #765): its `image:` first, then the conversion.
  if (before.kind === 'picture') {
    tr.setNodeMarkup(before.pos, undefined, { ...before.node.attrs, body: writeSlideData('picture', before.node.attrs.body, { ...before.data, image: path }) })
    convertDeckInto(tr)
    return tr
  }
  convertDeckInto(tr)
  const pos = tr.mapping.map(before.pos)
  const node = tr.doc.nodeAt(pos)
  if (!node || node.type.name !== 'deckSlide') return null
  const data = readSlideData(node.attrs.kind, node.attrs.body)
  const placed = data.picture && data.picture !== 'none'
  const markdown = (data.markdown ?? '').replace(/\s+$/, '')
  const body = placed
    // Experience 49: the place keeps its side; the new picture's description and focus point start fresh.
    ? writeSlideData(node.attrs.kind, node.attrs.body, { ...data, image: path, alt: undefined, focus: undefined })
    : withBlockMarkdown(node.attrs.body, `${markdown}${markdown ? '\n\n' : ''}![](${pictureTarget(path)})`)
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, body })
  return tr
}

/** The conversion's line in the deck's bar (the coordinator and the Experience lead on #765). */
export const CONVERSION_NOTICE = 'Old notes are now comments in the handout.'

/**
 * Whether the deck's bar says the conversion's line: once per deck, at its first real edit, and only when old notes or
 * hidden words became comments (a deck with neither says nothing). `shownBefore`: this deck's view said it already.
 */
export function conversionNoticeFor(made: DeckConversion | null, shownBefore: boolean): { text: string; firstComment: string } | null {
  if (!made || shownBefore || made.comments === 0 || made.firstComment === null) return null
  return { text: CONVERSION_NOTICE, firstComment: made.firstComment }
}

/** Where the comment with this note is in the handout (Show's target): the first such comment node, or null. */
export function commentNodeAt(doc: PMNode, note: string): number | null {
  let found: number | null = null
  doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'commentNode' && node.attrs.note === note) found = pos
    return true
  })
  return found
}

/** A transaction that is the person's own edit: not the host's, not undo or redo, not the view's drawn headings. */
export function isRealEdit(tr: Transaction): boolean {
  return tr.docChanged && !passes(tr) && tr.getMeta(DECK_DERIVED) !== true && tr.getMeta(DECK_CONVERTED) === undefined
}

/** The conversion for these transactions: one transaction after the person's first real edit, or null. */
export function conversionAfter(transactions: readonly Transaction[], state: EditorState): Transaction | null {
  if (!transactions.some(isRealEdit) || !needsConversion(state.doc)) return null
  const tr = state.tr
  return convertDeckInto(tr) ? tr : null
}

/** The plugin's state: how many conversions this editor made, and the last one (the deck view's notice reads it). */
export interface ConversionState {
  count: number
  last: DeckConversion | null
}

/** The conversions this editor has made so far. */
export function conversionStateOf(state: EditorState): ConversionState {
  return deckConvertKey.getState(state) ?? { count: 0, last: null }
}

/** The conversion's plugin (the tests run it with the editor's own history). */
export function deckConvertPlugin(): Plugin<ConversionState> {
  return new Plugin<ConversionState>({
    key: deckConvertKey,
    state: {
      init: () => ({ count: 0, last: null }),
      apply: (tr, value) => {
        const made = tr.getMeta(DECK_CONVERTED) as DeckConversion | undefined
        return made ? { count: value.count + 1, last: made } : value
      },
    },
    appendTransaction: (transactions, _oldState, newState) => conversionAfter(transactions, newState),
  })
}

export const DeckConvert = Extension.create({
  name: 'deckConvert',

  addProseMirrorPlugins() {
    return [deckConvertPlugin()]
  },
})
