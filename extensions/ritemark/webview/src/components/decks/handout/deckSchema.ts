/**
 * Sprint 157 (experience 46): a deck in the one Markdown editor. The handout column is the document editor holding
 * the whole deck file; each slide block is one atom node, `deckSlide`, in the equation block's pattern: its data in
 * attributes, read from the fence on open and written from the attributes on save (never from its text, which
 * Turndown would collapse).
 *
 *  - Open: a fence arrives from `marked` as `<pre data-md-info="slide <kind>">`. The node's parse rule, above the code
 *    block's, takes the info string and the body. A ```` ```notes ```` block directly after it is folded into the
 *    slide's `notes`, and its own `pre` is ignored. A notes block anywhere else stays a code block.
 *  - Save: `addDeckTurndownRules` writes the slide fence from the attributes, sized past any backticks in the body,
 *    and its notes block after it.
 *
 * Without these extensions (the flag off) a slide fence is an ordinary code block, written back as it was.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type TurndownService from 'turndown'
import { cleanKind, slideKindOfInfo, writeSlideBlock } from '../../../../../src/decks/deckFormat'

/** The attribute on the slide node's element, for the Turndown rule and the deck view's measuring. */
export const DECK_SLIDE_ATTRIBUTE = 'data-deck-slide'

/** A `pre` the editor's load made from a fence: its info string as written ('none' when there was none). */
function infoOf(element: Element | null): string | null {
  if (!element || element.nodeName !== 'PRE') return null
  return element.getAttribute('data-md-info')
}

function isSlidePre(element: Element | null): boolean {
  const info = infoOf(element)
  return info !== null && slideKindOfInfo(info) !== null
}

/**
 * The block right beside this one, as the file has it: only whitespace text may stand between them. An HTML comment,
 * words or any other node in between means the two are not adjacent (Codex on PR 1: `nextElementSibling` skipped
 * them, and the notes moved ahead of what stood between on save).
 */
function adjacent(element: Element, direction: 'next' | 'previous'): Element | null {
  let node = direction === 'next' ? element.nextSibling : element.previousSibling
  while (node && node.nodeType === 3 && !(node.nodeValue ?? '').trim()) {
    node = direction === 'next' ? node.nextSibling : node.previousSibling
  }
  return node && node.nodeType === 1 ? (node as Element) : null
}

/** A fence's text: the code's text without the one newline `marked` puts after it. */
function fenceText(element: Element): string {
  return (element.textContent ?? '').replace(/\n$/, '')
}

export interface DeckSlideAttributes {
  /** The kind, the word after `slide`. */
  kind: string
  /** The body as written, without its fences. */
  body: string
  /** The speaker notes, or null when the slide has no notes block. */
  notes: string | null
}

export const DeckSlide = Node.create({
  name: 'deckSlide',
  group: 'block',
  atom: true,
  selectable: true,
  // Slides move in the strip (one transaction per move), never by the handout's drag handle.
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: 'points',
        // Null when absent, so a rule's own attributes (the fence's) stand: TipTap lets these win otherwise.
        // A pasted element's kind must be one word, or it would break the fence line; anything else is Points.
        parseHTML: element => (element.hasAttribute('data-kind') ? cleanKind(element.getAttribute('data-kind')) ?? 'points' : null),
        renderHTML: attributes => ({ 'data-kind': attributes.kind }),
      },
      body: {
        default: '',
        parseHTML: element => element.getAttribute('data-body'),
        renderHTML: attributes => ({ 'data-body': attributes.body }),
      },
      notes: {
        default: null,
        parseHTML: element => (element.hasAttribute('data-notes') ? element.getAttribute('data-notes') : null),
        renderHTML: attributes => (attributes.notes === null || attributes.notes === undefined ? {} : { 'data-notes': attributes.notes }),
      },
    }
  },

  parseHTML() {
    return [
      // The node's own HTML: the editor's copy and paste.
      { tag: `div[${DECK_SLIDE_ATTRIBUTE}]` },
      // A slide fence from the file. Above the code block's rule, so it is never read as code.
      {
        tag: 'pre',
        priority: 1000,
        getAttrs: element => {
          const el = element as HTMLElement
          const kind = slideKindOfInfo(infoOf(el) ?? 'none')
          if (kind === null) return false
          const next = adjacent(el, 'next')
          const notes = infoOf(next) === 'notes' ? fenceText(next as Element) : null
          return { kind, body: fenceText(el), notes }
        },
      },
      // A notes fence right after a slide fence is that slide's notes: its own element adds nothing.
      {
        tag: 'pre',
        priority: 1001,
        ignore: true,
        getAttrs: element => (infoOf(element as HTMLElement) === 'notes' && isSlidePre(adjacent(element as HTMLElement, 'previous')) ? null : false),
      },
    ]
  },

  // The block's text inside the element: Turndown drops an element with no text before any rule sees it.
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes({ [DECK_SLIDE_ATTRIBUTE]: '' }, HTMLAttributes), writeSlideBlock(node.attrs.kind, node.attrs.body, node.attrs.notes)]
  },

  renderText({ node }) {
    return writeSlideBlock(node.attrs.kind, node.attrs.body, node.attrs.notes)
  },
})

/**
 * The save half: a slide node is written as its fence (and its notes fence) from its attributes. Registered on the
 * editor's one Turndown service, where it is harmless without slide nodes, as the comment rules are.
 */
export function addDeckTurndownRules(service: TurndownService): void {
  service.addRule('deckSlide', {
    filter: node => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute(DECK_SLIDE_ATTRIBUTE),
    replacement: (_content, node) => {
      const element = node as HTMLElement
      const notes = element.hasAttribute('data-notes') ? element.getAttribute('data-notes') : null
      return `\n\n${writeSlideBlock(element.getAttribute('data-kind') ?? 'points', element.getAttribute('data-body') ?? '', notes)}\n\n`
    },
  })
}
