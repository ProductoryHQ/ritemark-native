/**
 * Sprint 157 (technical plan §5): the handout can't break the deck file.
 *
 *  - Typing, Backspace, Delete and a selection's delete can't remove a slide node, nor move one inside another block
 *    (where it would stop starting a part). Slides are deleted from the strip's menu, the part number's ⋯ and the
 *    handout's own Backspace in an empty part or its two-press join (`deckRemove.ts`, the deck view's own transactions). Host updates (they carry
 *    `ritemarkDocumentRevision`), undo and redo, and the deck view's own operations (`DECK_OPERATION`) are let through.
 *  - A slide pasted next to its original gets a new id, so ids stay unique within the deck.
 *  - `slide` and `notes` are refused as a code block's language in the handout: a typed ```` ```slide ```` would
 *    otherwise become a slide when the deck is opened again.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { isHistoryTransaction } from '@tiptap/pm/history'
import type { Step } from '@tiptap/pm/transform'
import { newId, writeSlideData } from '../../../../../src/decks/deckFormat'
import { isSlideNode, slideDataOf } from '../deckDocument'

import { DECK_OPERATION } from '../deckDocument'

export { DECK_OPERATION }

export const deckGuardKey = new PluginKey('deckGuard')

/** A transaction the guard leaves alone: the host's, undo and redo, or the deck view's own. */
export function isTrustedDeckTransaction(tr: Transaction): boolean {
  return tr.getMeta('ritemarkDocumentRevision') !== undefined
    || isHistoryTransaction(tr)
    || tr.getMeta(DECK_OPERATION) === true
}

/**
 * Could this transaction take a slide away or bury one? Only when a step's range covers a slide, or a step inserts
 * content holding one (a paste). Typing in a part's text touches neither, so most keystrokes skip the full count.
 */
export function touchesSlides(tr: Transaction): boolean {
  for (let index = 0; index < tr.steps.length; index++) {
    const step = tr.steps[index] as Step & { from?: number; to?: number; slice?: Slice }
    const doc = tr.docs[index]
    let hit = false
    if (typeof step.from === 'number' && typeof step.to === 'number' && step.to > step.from) {
      doc.nodesBetween(step.from, step.to, node => {
        if (isSlideNode(node)) hit = true
        return !hit && !node.isTextblock
      })
    }
    step.slice?.content.descendants(node => {
      if (isSlideNode(node)) hit = true
      return !hit
    })
    if (hit) return true
  }
  return false
}

/** How many slide nodes the document holds at its top level, and whether any sits inside another block. */
function slideCounts(doc: PMNode): { top: number; nested: boolean } {
  let top = 0
  let nested = false
  doc.forEach(node => {
    if (isSlideNode(node)) {
      top++
      return
    }
    if (nested || node.isLeaf) return
    node.descendants(child => {
      if (isSlideNode(child)) nested = true
      return !nested
    })
  })
  return { top, nested }
}

/** Would this transaction take a slide away, or bury one inside another block? */
export function removesSlides(before: PMNode, after: PMNode): boolean {
  const was = slideCounts(before)
  const is = slideCounts(after)
  return is.top < was.top || (is.nested && !was.nested)
}

const REFUSED_LANGUAGE = /^(slide|notes)$/i

/**
 * The fix-ups one person's transaction needs: new ids for slides that arrived carrying an id the deck already has,
 * and no `slide` or `notes` language on a code block that arrived or changed. Only blocks that are new in `after`
 * (not the very nodes `before` had) are looked at.
 */
export function guardFixes(before: PMNode, after: PMNode, tr: Transaction, random: () => number = Math.random): boolean {
  const kept = new Set<PMNode>()
  before.forEach(node => kept.add(node))
  const ids = new Map<string, number>()
  after.forEach(node => {
    if (!isSlideNode(node)) return
    const id = slideDataOf(node.attrs.kind, node.attrs.body).id
    if (id) ids.set(id, (ids.get(id) ?? 0) + 1)
  })
  let changed = false
  after.forEach((node, pos) => {
    if (kept.has(node)) return
    if (isSlideNode(node)) {
      const data = slideDataOf(node.attrs.kind, node.attrs.body)
      if (data.id && (ids.get(data.id) ?? 0) > 1) {
        const id = newId(ids.keys(), random)
        ids.set(data.id, (ids.get(data.id) ?? 1) - 1)
        ids.set(id, 1)
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: writeSlideData(node.attrs.kind, node.attrs.body, { ...data, id }) })
        changed = true
      }
      return
    }
    node.descendants((child, offset) => {
      if (child.type.name === 'codeBlock' && typeof child.attrs.language === 'string' && REFUSED_LANGUAGE.test(child.attrs.language.trim())) {
        tr.setNodeMarkup(pos + 1 + offset, undefined, { ...child.attrs, language: null })
        changed = true
      }
      return true
    })
    if (node.type.name === 'codeBlock' && typeof node.attrs.language === 'string' && REFUSED_LANGUAGE.test(node.attrs.language.trim())) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: null })
      changed = true
    }
  })
  return changed
}

/** The guard's plugin: what the handout's editor runs (and the tests, with the editor's own commands). */
export function deckGuardPlugin(): Plugin {
  return new Plugin({
    key: deckGuardKey,
    filterTransaction(tr, state) {
      if (!tr.docChanged || isTrustedDeckTransaction(tr)) return true
      return !touchesSlides(tr) || !removesSlides(state.doc, tr.doc)
    },
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some(tr => tr.docChanged && !isTrustedDeckTransaction(tr))) return null
      const tr = newState.tr
      return guardFixes(oldState.doc, newState.doc, tr) ? tr : null
    },
  })
}

export const DeckGuard = Extension.create({
  name: 'deckGuard',

  addProseMirrorPlugins() {
    return [deckGuardPlugin()]
  },
})
