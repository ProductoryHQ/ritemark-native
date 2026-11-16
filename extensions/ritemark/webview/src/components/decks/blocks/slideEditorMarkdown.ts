/**
 * Sprint 161 (spike §3): the slide editor's own Markdown pipeline, with the `:::` blocks (Columns, Boxes, Steps).
 *
 *  - load: a SCOPED `marked` (`slideEditorMarked`), configured as the document editor's (as-written, math) plus the
 *    fenced-div tokenizer of `src/decks/blocks/fencedDiv.ts`, the one the static renderer reads with;
 *  - the node: one `slideDiv` that keeps its opening and closing lines as written, and whether a blank line followed
 *    the opening line or came before the closing one, so an untouched block writes back byte for byte;
 *  - save: the document editor's Turndown rules on their own service (`createSlideTurndownService`) plus the div's rule.
 *
 * Never registered on the document editor's `editorMarked` or `editorTurndownService`: a Text document's `:::` lines
 * stay text (the fidelity corpus proves it). In this build it is read by the parity test, which holds the renderer and
 * the editor's document to the same outline; the editor on the slide uses it next.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { Marked } from 'marked'
import type TurndownService from 'turndown'
import { fencedDivStart, scanFencedDiv, type FenceScan } from '../../../../../src/decks/blocks/fencedDiv'
import { asWrittenMarkedExtension } from '../../../utils/markdownAsWritten'
import { mathMarkedExtension } from '../../../extensions/math/mathMarkedExtension'
import { createEditorTurndownService, markdownToEditorHTML, preprocessTableHTML } from '../../../utils/editorMarkdown'

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface SlideDivToken {
  type: 'slideDiv'
  raw: string
  scan: FenceScan
  tokens: unknown[]
  /** Set by the as-written pass: no blank line between this block and the one before it. */
  rmTight?: boolean
}

/** The `:::` tokenizer for the slide editor: the shared scanner, rendering the div with its lines as written. */
export const slideDivMarkedExtension = {
  extensions: [
    {
      name: 'slideDiv',
      level: 'block' as const,
      start: fencedDivStart,
      tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: unknown[]) => unknown[] } }, src: string): SlideDivToken | undefined {
        const scan = scanFencedDiv(src)
        if (!scan) return undefined
        return { type: 'slideDiv', raw: scan.raw, scan, tokens: this.lexer.blockTokens(scan.inner.replace(/^\n+/, ''), []) }
      },
      renderer(this: { parser: { parse: (tokens: unknown[]) => string } }, token: SlideDivToken): string {
        const scan = token.scan
        return `<div data-fdiv="" data-open="${escapeAttribute(scan.openLine)}" data-close="${escapeAttribute(scan.closeLine)}" data-gap-open="${scan.gapOpen}" data-gap-close="${scan.gapClose}" data-class="${escapeAttribute(scan.attrs.classes.join(' '))}"${token.rmTight ? ' data-md-tight="true"' : ''}>${this.parser.parse(token.tokens)}</div>\n`
      },
      childTokens: ['tokens'],
    },
  ],
}

/** The slide editor's own `marked`: the document editor's configuration, and the `:::` blocks. */
export const slideEditorMarked = new Marked({ breaks: true, gfm: true })
slideEditorMarked.use(asWrittenMarkedExtension)
slideEditorMarked.use(mathMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
slideEditorMarked.use(slideDivMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])

/** A block slide's Markdown as the HTML the slide editor parses. */
export function markdownToSlideEditorHTML(markdown: string): string {
  return markdownToEditorHTML(markdown, undefined, slideEditorMarked)
}

/** The node for a `:::` block: its lines as written, and its blocks. */
export const SlideDiv = Node.create({
  name: 'slideDiv',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    const attribute = (name: string, fallback: string | null) => ({
      default: fallback,
      parseHTML: (element: HTMLElement) => element.getAttribute(name),
      renderHTML: (attrs: Record<string, unknown>) => {
        const key = name.replace(/^data-/, '').replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase())
        return attrs[key] === null || attrs[key] === undefined ? {} : { [name]: String(attrs[key]) }
      },
    })
    return {
      open: attribute('data-open', ':::: columns'),
      close: attribute('data-close', '::::'),
      gapOpen: attribute('data-gap-open', 'false'),
      gapClose: attribute('data-gap-close', 'false'),
      class: attribute('data-class', ''),
      mdTight: attribute('data-md-tight', null),
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-fdiv]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-fdiv': '' }, HTMLAttributes), 0]
  },
})

/** The div's save rule: its lines as written around its blocks as Turndown wrote them. */
export function addSlideDivTurndownRule(service: TurndownService): void {
  service.addRule('slideDiv', {
    filter: node => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-fdiv'),
    replacement: (content, node) => {
      const element = node as HTMLElement
      const open = element.getAttribute('data-open') ?? ':::'
      const close = element.getAttribute('data-close') ?? ':::'
      const gapOpen = element.getAttribute('data-gap-open') === 'true' ? '\n' : ''
      const gapClose = element.getAttribute('data-gap-close') === 'true' ? '\n' : ''
      const inside = content.replace(/^\n+/, '').replace(/\n+$/, '')
      // Tight with a neighbour only as written (`data-md-tight`); a fence line never merges with the block beside it.
      const lead = element.getAttribute('data-md-tight') === 'true' && element.previousElementSibling ? '\n' : '\n\n'
      const next = element.nextElementSibling
      const trail = next && next.getAttribute('data-md-tight') === 'true' ? '\n' : '\n\n'
      return `${lead}${open}\n${gapOpen}${inside}\n${gapClose}${close}${trail}`
    },
  })
}

/** The slide editor's Turndown: the document editor's rules on a service of its own, and the div's rule. */
export function createSlideTurndownService(): TurndownService {
  const service = createEditorTurndownService()
  addSlideDivTurndownRule(service)
  return service
}

let slideTurndown: TurndownService | null = null

/** The slide editor's save: its HTML as Markdown. */
export function slideEditorHTMLToMarkdown(html: string): string {
  slideTurndown ??= createSlideTurndownService()
  return slideTurndown.turndown(preprocessTableHTML(html))
}
