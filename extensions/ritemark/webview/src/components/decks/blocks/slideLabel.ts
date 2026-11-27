/**
 * Sprint 164 PR 3 (the decks README, "Label, a block of its own"): the Label on the stage, in the slide editor only. The
 * Text editor and the handout never read it, so there `[words]{.label}` stays the words it is.
 *
 *  - **Load:** a paragraph that is one `[words]{.label}` line (`labelParagraphOf`, the renderer's own reading) becomes
 *    `<div data-slide-label>` with its words, and what the file wrote kept as attributes: the line as written
 *    (`data-raw`), the words as read (`data-words`) and its attribute block (`data-attrs`).
 *  - **The node:** one line of plain text (`text*`, no marks), drawn as the pill (`blk-label`). A click puts the caret in
 *    its words, like every word on the slide.
 *  - **Save:** while its words are still the ones read, the line as written, byte for byte; else `[words]{.label}` with
 *    its own attribute block (`labelLine`).
 *  - **Empty:** "Label" shows faint while the caret is in it (`slidePlaceholderOf`), and it takes no room while the caret
 *    is elsewhere, as the renderer draws nothing for it. Backspace in it removes it (`labelBackspace`).
 *
 * The DOM Turndown reads here is the slide editor's own HTML (`getHTML()`), never a page's.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { MarkedExtension, Tokens } from 'marked'
import type TurndownService from 'turndown'
import { Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { LABEL_ATTRIBUTES, labelLine, labelParagraphOf } from '../../../../../src/decks/blocks/labelBlock'
import { blockLeading, blockTrailing, tightAttribute } from '../../../utils/markdownAsWritten'

export const SLIDE_LABEL_NODE = 'slideLabel'

/** Escape an attribute value. */
function attribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The `marked` extension: a Label's paragraph as the slide editor's Label. Register it after the as-written one. */
export const labelMarkedExtension: MarkedExtension = {
  extensions: [
    {
      name: 'paragraph',
      renderer(token) {
        const paragraph = token as Tokens.Paragraph
        const label = labelParagraphOf(paragraph)
        if (!label) return false
        const tight = tightAttribute(token)
        return `<div data-slide-label="" data-raw="${attribute(paragraph.text)}" data-words="${attribute(label.words)}" data-attrs="${attribute(label.attrs)}"${tight ? ` data-md-tight="${tight}"` : ''}>${escapeText(label.words)}</div>\n`
      },
    },
  ],
}

/** One attribute kept as written: read from and written back to its own `data-*` attribute. */
function kept(key: string, name: string, fallback: string | null) {
  return {
    default: fallback,
    parseHTML: (element: HTMLElement) => element.getAttribute(name) ?? fallback,
    renderHTML: (attrs: Record<string, unknown>) => (attrs[key] === null || attrs[key] === undefined ? {} : { [name]: String(attrs[key]) }),
  }
}

/** The Label: one line of plain text, drawn as the pill. */
export const SlideLabel = Node.create({
  name: SLIDE_LABEL_NODE,
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,

  addAttributes() {
    return {
      raw: kept('raw', 'data-raw', null),
      words: kept('words', 'data-words', null),
      attrs: kept('attrs', 'data-attrs', LABEL_ATTRIBUTES),
      mdTight: kept('mdTight', 'data-md-tight', null),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-slide-label]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-slide-label': '', class: 'blk-label' }, HTMLAttributes), 0]
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const tr = labelBackspace(this.editor.state)
        if (!tr) return false
        this.editor.view.dispatch(tr)
        return true
      },
    }
  },
})

/** A new, empty Label, as the / menu puts one where the / was. */
export function labelNode(schema: Schema, words = ''): PMNode {
  return schema.nodes[SLIDE_LABEL_NODE].create(null, words ? schema.text(words) : undefined)
}

/**
 * Backspace with the caret in an empty Label: the Label goes, as an empty line does, and the caret goes to the end of
 * the line before it (to the start of the one after it when it was first). The only block of a box, a column or a pane
 * leaves an empty line in its place, since those always hold one. Null anywhere else (the editor's own Backspace).
 */
export function labelBackspace(state: EditorState): Transaction | null {
  const { $from, empty } = state.selection
  if (!empty || $from.parent.type.name !== SLIDE_LABEL_NODE || $from.parent.content.size > 0) return null
  const pos = $from.before()
  const node = $from.parent
  const tr = state.tr
  if ($from.node(-1).childCount === 1) {
    tr.replaceWith(pos, pos + node.nodeSize, state.schema.nodes.paragraph.create())
    tr.setSelection(TextSelection.create(tr.doc, pos + 1))
    return tr.scrollIntoView()
  }
  const first = $from.index(-1) === 0
  tr.delete(pos, pos + node.nodeSize)
  // Its neighbour in the same block: the line before it, or the one after it when it was first.
  const $at = tr.doc.resolve(Math.min(pos, tr.doc.content.size))
  tr.setSelection(Selection.findFrom($at, first ? 1 : -1, true) ?? Selection.near($at, first ? 1 : -1))
  return tr.scrollIntoView()
}

const isLabel = (node: globalThis.Node) => node.nodeName === 'DIV' && (node as Element).hasAttribute('data-slide-label')

/** The Label as Markdown: its line as written while its words are as read, else its words in their brackets. */
function labelMarkdown(element: Element): string {
  const words = element.textContent ?? ''
  const raw = element.getAttribute('data-raw')
  const line = raw !== null && element.getAttribute('data-words') === words ? raw.trim() : labelLine(words, element.getAttribute('data-attrs') ?? LABEL_ATTRIBUTES)
  return blockLeading(element, line) + line + blockTrailing(element)
}

/** The Label's save rule, on the slide editor's Turndown (never the Text editor's). */
export function addLabelTurndownRules(service: TurndownService): void {
  service.addRule('slideLabel', {
    filter: node => isLabel(node),
    replacement: (_content, node) => labelMarkdown(node as Element),
  })
  // Turndown gives an element with no words its blank rule, never its own: an empty Label would drop out of the file
  // (and a slide's empty Label is kept until Backspace takes it). The service reads its blank rule once, when it is
  // made, so the rule itself is wrapped.
  const rules = (service as unknown as { rules: { blankRule: { replacement: (content: string, node: globalThis.Node, options: unknown) => string } } }).rules
  const blank = rules.blankRule.replacement
  rules.blankRule = {
    replacement: (content, node, options) => (isLabel(node) ? labelMarkdown(node as Element) : blank(content, node, options)),
  }
}
