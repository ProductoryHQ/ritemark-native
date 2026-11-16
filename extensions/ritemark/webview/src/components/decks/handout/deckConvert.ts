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
 *  - Without the comment node (the comment-callouts kill switch), a slide's private words stay in its notes block,
 *    which never goes out either: nothing is lost and nothing turns public.
 *
 * Not a conversion: the host's revisions, undo and redo, the drawn headings' own transactions, and anything that
 * doesn't change the document.
 */
import { Extension } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { convertSlide, convertsToBlocks, drawsAsBlocks } from '../../../../../src/decks/blocks/convertDeck'
import { slideDataOf as readSlideData, withBlockMarkdown, writeSlideData } from '../../../../../src/decks/deckFormat'
import { DECK_DERIVED, DECK_OPERATION, isSlideNode, slidesOf } from '../deckDocument'
import { passes } from './drawnHeadings'
import { editorHTMLToMarkdown } from '../../../utils/editorMarkdown'

export const deckConvertKey = new PluginKey('deckConvert')

/** Meta on the transaction that converts a deck, with what it did (`DeckConversion`). */
export const DECK_CONVERTED = 'deckConverted'

/** What a conversion did: how many slides became block slides, and how many got a comment for their private words. */
export interface DeckConversion {
  slides: number
  comments: number
}

/** Does the document hold a slide the conversion would change: a v1 slide of one of the nine kinds? */
export function needsConversion(doc: PMNode): boolean {
  let found = false
  doc.forEach(node => { if (!found && isSlideNode(node) && convertsToBlocks(node.attrs.kind)) found = true })
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
  const result: DeckConversion = { slides: 0, comments: 0 }
  const slides = slidesOf(tr.doc)
  // From the last part to the first, so the positions before each one still hold.
  for (let index = slides.length - 1; index >= 0; index--) {
    const slide = slides[index]
    if (!convertsToBlocks(slide.kind)) continue
    const next = slides[index + 1]
    const partEnd = next ? next.pos : tr.doc.content.size
    // A library copy's stamp counts its handout: the part's words go with it, so a copy still as copied gets the block
    // stamp. The deck's folder isn't known here: a stamp that depends on its paths stays as it was (`renewedFrom`).
    const handout = slide.data.from ? handoutMarkdownOf(tr.doc, slide.pos + slide.node.nodeSize, partEnd) : ''
    const converted = convertSlide(slide.kind, slide.node.attrs.body, slide.node.attrs.notes ?? null, handout, '')
    const comment = converted.comment ? commentNodeOf(schema, converted.comment) : null
    const notes = converted.comment && !comment ? notesOf(converted.comment) : null
    if (comment) {
      tr.insert(partEnd, comment)
      result.comments++
    }
    tr.setNodeMarkup(slide.pos, undefined, { ...slide.node.attrs, kind: '', body: converted.body, notes })
    result.slides++
  }
  // The handout's drawn headings are its text from now on, written with the conversion (`withWrittenHandout`'s rule).
  tr.doc.forEach((node, pos) => {
    if (node.type.name === 'heading' && node.attrs.deckDrawn === true) tr.setNodeMarkup(pos, undefined, { ...node.attrs, deckDrawn: false })
  })
  tr.setMeta(DECK_OPERATION, true).setMeta(DECK_CONVERTED, result)
  return result
}

/** A picture's path as a Markdown target: in angle brackets when it holds a space or a bracket. */
function pictureTarget(path: string): string {
  return /[\s()<>]/.test(path) ? `<${path.replace(/[<>]/g, encodeURIComponent)}>` : path
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
  convertDeckInto(tr)
  const pos = tr.mapping.map(before.pos)
  const node = tr.doc.nodeAt(pos)
  if (!node || node.type.name !== 'deckSlide') return null
  const data = readSlideData(node.attrs.kind, node.attrs.body)
  const placed = data.picture && data.picture !== 'none'
  const markdown = (data.markdown ?? '').replace(/\s+$/, '')
  const body = placed
    ? writeSlideData(node.attrs.kind, node.attrs.body, { ...data, image: path })
    : withBlockMarkdown(node.attrs.body, `${markdown}${markdown ? '\n\n' : ''}![](${pictureTarget(path)})`)
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, body })
  return tr
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
