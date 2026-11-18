/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): the Button block's Markdown in the editors, a slide's and a
 * Text document's (a deck's handout is one), read and written the one way.
 *
 *  - **Load:** a paragraph that ends with a `{.button}` link (`buttonParagraphOf`, the renderer's own reading) becomes
 *    `<div data-button>` with its words beside it and its button's words, and everything the file wrote that the editor
 *    doesn't show kept as attributes: the link's destination as written (`data-dest`), its attribute block
 *    (`data-attrs`) and what parted the words from it (`data-sep`). Any other paragraph is left to the next renderer.
 *  - **Save:** the words, the separator, `[words](destination)` and the attribute block, so an untouched button writes
 *    back byte for byte. A new address writes a new destination (`buttonDestination`).
 *
 * The DOM Turndown reads here is the editor's own HTML (`getHTML()`), never a page's.
 */
import type { MarkedExtension, Tokens } from 'marked'
import type TurndownService from 'turndown'
import { BUTTON_ATTRIBUTES, buttonParagraphOf } from '../../../../src/decks/blocks/buttonBlock'
import { blockLeading, blockTrailing, escapeLineStarts, tightAttribute } from '../../utils/markdownAsWritten'

/** Escape an attribute value, a line break included (`data-sep` may be one). */
function attribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The `marked` extension: a button paragraph as the editor's Button block. Register it after the as-written one. */
export const buttonMarkedExtension: MarkedExtension = {
  extensions: [
    {
      name: 'paragraph',
      renderer(token) {
        const button = buttonParagraphOf((token as Tokens.Paragraph).tokens)
        if (!button) return false
        const tight = tightAttribute(token)
        const title = button.title === null ? '' : ` data-title="${attribute(button.title)}"`
        return `<div data-button="" data-href="${attribute(button.href)}" data-dest="${attribute(button.dest)}" data-attrs="${attribute(button.attrs)}" data-sep="${attribute(button.sep)}"${title}${tight ? ` data-md-tight="${tight}"` : ''}>`
          + `<div data-button-words="">${this.parser.parseInline(button.words)}</div>`
          + `<span data-button-label="">${escapeText(button.label)}</span></div>\n`
      },
    },
  ],
}

/** The marker between the words' Markdown and the button's in the block's content. */
const LABEL_MARK = '\u0001'

const isButton = (node: Node) => node.nodeName === 'DIV' && (node as Element).hasAttribute('data-button')

/** A button's words in a link's brackets: every bracket escaped, so the link never ends early. */
function labelMarkdown(content: string): string {
  return content.replace(/\\?([[\]])/g, '\\$1').replace(/\n+/g, ' ')
}

/** The block as Markdown: the words, the separator, the link and its attribute block, as a paragraph. */
function buttonMarkdown(content: string, element: Element): string {
  const at = content.lastIndexOf(LABEL_MARK)
  const words = (at >= 0 ? content.slice(0, at) : content).replace(/^\n+/, '').replace(/\s+$/, '')
  const label = at >= 0 ? labelMarkdown(content.slice(at + 1).trim()) : ''
  // As read (nothing between `Word.` and the link stays nothing); a button with no separator recorded: a space.
  const sep = words ? element.getAttribute('data-sep') ?? ' ' : ''
  const dest = element.getAttribute('data-dest') ?? ''
  const attrs = element.getAttribute('data-attrs') || BUTTON_ATTRIBUTES
  const link = `[${label}](${dest})${attrs}`
  return blockLeading(element) + (words ? escapeLineStarts(words) + sep : '') + link + blockTrailing(element)
}

/** The Button block's save rules, on the editor's Turndown (and so the slide editor's). */
export function addButtonTurndownRules(service: TurndownService): void {
  service.addRule('buttonWords', {
    filter: node => node.nodeName === 'DIV' && (node as Element).hasAttribute('data-button-words'),
    replacement: content => content,
  })
  service.addRule('buttonLabel', {
    filter: node => node.nodeName === 'SPAN' && (node as Element).hasAttribute('data-button-label'),
    replacement: content => LABEL_MARK + content,
  })
  service.addRule('buttonBlock', {
    filter: node => isButton(node),
    replacement: (content, node) => buttonMarkdown(content, node as Element),
  })
  // Turndown gives an element with no words its blank rule, never its own: a new button with no words yet would drop
  // out of the file. The service reads its blank rule once, when it is made, so the rule itself is wrapped.
  const rules = (service as unknown as { rules: { blankRule: { replacement: (content: string, node: Node, options: unknown) => string } } }).rules
  const blank = rules.blankRule.replacement
  rules.blankRule = {
    replacement: (content, node, options) => (isButton(node) ? buttonMarkdown(content, node as Element) : blank(content, node, options)),
  }
}
