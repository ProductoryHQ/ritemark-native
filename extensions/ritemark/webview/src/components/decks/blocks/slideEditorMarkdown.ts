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
 * stay text (the fidelity corpus proves it). The parity test holds the renderer and the editor's document to the same
 * outline; the editor on the stage (`SlideEditor`, PR 2) loads and saves with it.
 *
 * PR 2: a typed paragraph that reads as a `:::` line (`::: columns`, `:::`) would open or close a block when the slide
 * is opened again, so the save checks what it wrote reads back as the same blocks, and if it doesn't, writes such lines
 * escaped (`\:::`, which CommonMark reads as `:::`). Only then: a stray `:::` written by someone else stays as written.
 * Comments on the slide (`<!-- … -->`, `<mark data-comment>`) load and save as the handout's do, with the comment flag.
 * Sprint 164 PR 3: the Label (`[words]{.label}`, `slideLabel.ts`) loads and saves here only, never in a Text document.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { Marked } from 'marked'
import type TurndownService from 'turndown'
import { fencedDivStart, scanFencedDiv, type FenceScan } from '../../../../../src/decks/blocks/fencedDiv'
import { AGENDA_CLOSE, AGENDA_OPEN, isAgendaClasses } from '../../../../../src/decks/blocks/agenda'
import { asWrittenMarkedExtension } from '../../../utils/markdownAsWritten'
import { mathMarkedExtension } from '../../../extensions/math/mathMarkedExtension'
import { createEditorTurndownService, markdownToEditorHTML, preprocessTableHTML } from '../../../utils/editorMarkdown'
import { commentMarkedExtension } from '../../../extensions/comment/commentMarkedExtension'
import { pictureMarkedExtension } from '../../../extensions/pictures/pictureMarked'
import { tabsMarkedExtension } from '../../../extensions/tabs/tabsMarkdown'
import { PANE_PLACEHOLDER, tabsetOf } from '../../../../../src/decks/blocks/tabset'
import { buttonMarkedExtension } from '../../../extensions/buttonBlock/buttonMarkdown'
import { LABEL_PLACEHOLDER } from '../../../../../src/decks/blocks/labelBlock'
import { splitQuoteByLine } from '../../../../../src/decks/blocks/slideRenderer'
import { SLIDE_LABEL_NODE, addLabelTurndownRules, labelMarkedExtension } from './slideLabel'
import type { Node as PMNode } from '@tiptap/pm/model'

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
        // Sprint 163: a Tabs block is the Tabs tokenizer's (`tabsMarkdown.ts`).
        if (!scan || tabsetOf(scan)?.tabs.length) return undefined
        // The Agenda draws from the deck: what it holds is kept as written, never edited (`SlideAgenda`).
        if (isAgendaClasses(scan.attrs.classes)) return { type: 'slideDiv', raw: scan.raw, scan, tokens: [] }
        return { type: 'slideDiv', raw: scan.raw, scan, tokens: this.lexer.blockTokens(scan.inner.replace(/^\n+/, ''), []) }
      },
      renderer(this: { parser: { parse: (tokens: unknown[]) => string } }, token: SlideDivToken): string {
        const scan = token.scan
        if (isAgendaClasses(scan.attrs.classes)) {
          const written = token.raw.replace(/\n$/, '')
          return `<div data-agenda="" data-raw="${escapeAttribute(written)}"${token.rmTight ? ' data-md-tight="true"' : ''}></div>\n`
        }
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
// Experience 49: a picture's look, as the document editor reads it.
slideEditorMarked.use(pictureMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
// Sprint 163: the Tabs block, as the Text editor reads it.
slideEditorMarked.use(tabsMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
// Sprint 163 PR 3: the Button block, read as the Text editor reads it.
slideEditorMarked.use(buttonMarkedExtension)
// Sprint 164 PR 3: the Label, on a slide only.
slideEditorMarked.use(labelMarkedExtension)
// Sprint 168 PR 1: a quote's last line after a line break opens as its attribution, a paragraph of its own, as the
// renderer draws it (`splitQuoteByLine`); an untouched slide still writes back as written (`SlideSync`).
slideEditorMarked.use({ walkTokens: splitQuoteByLine })

let slideComments = false

/**
 * The comment tokenizer on the slide editor's own `marked`, once, when the comment flag is on (as the document editor's
 * `ensureCommentMarkedPipeline`): with the flag off a comment stays the plain load's.
 */
export function ensureSlideCommentPipeline(): void {
  if (slideComments) return
  slideComments = true
  slideEditorMarked.use(commentMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
}

/** A block slide's Markdown as the HTML the slide editor parses; `imageMappings` gives its pictures' webview addresses. */
export function markdownToSlideEditorHTML(markdown: string, imageMappings?: Record<string, string>): string {
  return withoutCodeEndBreak(withColumnPlaces(markdownToEditorHTML(markdown, imageMappings, slideEditorMarked)))
}

/**
 * Sprint 163 PR 1: `marked` ends every code block's HTML with a line break of its own (`text\n</code></pre>`), which
 * the editor would keep as an empty last line: on a slide that line made the block a line taller than the renderer
 * draws it (the wall, the strip, the page), and Copy took it along. The break is marked's, never the file's (its
 * tokenizer has already taken a code block's trailing breaks off), and the save writes the closing fence on its own
 * line either way, so the file reads back as written.
 */
export function withoutCodeEndBreak(html: string): string {
  return html.replace(/\n<\/code><\/pre>/g, '</code></pre>')
}

/**
 * PR 3 (the Experience lead on #769): an empty column opens with an empty heading over an empty line, where the stage
 * shows "Heading" over "Text" faint, as a new Columns block starts. Neither is ever written (an empty heading and an
 * empty line save as nothing), so the column's lines read back as they were, and it opens the same again.
 */
export function withColumnPlaces(html: string): string {
  return html.replace(/(<div data-fdiv=""[^>]*\sdata-class="column"[^>]*>)(<\/div>)/g, '$1<h3></h3><p></p>$2')
}

/**
 * The faint words an empty line on the stage shows: the title's, an empty column's heading and text, an empty pane's,
 * and an empty Label's while the caret is in it (`hasCaret`; Sprint 164 PR 3).
 */
export function slidePlaceholderOf(node: PMNode, parent: PMNode | null, isTitle: boolean, hasCaret = false): string {
  if (node.type.name === SLIDE_LABEL_NODE) return hasCaret ? LABEL_PLACEHOLDER : ''
  if (isTitle) return 'Title'
  // Sprint 163: an empty tab's pane says what goes in it (README "Adding it").
  if (parent?.type.name === 'tabPane') return node.type.name === 'paragraph' && parent.childCount === 1 ? PANE_PLACEHOLDER : ''
  if (parent?.type.name !== 'slideDiv' || String(parent.attrs.class ?? '').split(' ')[0] !== 'column') return ''
  if (node.type.name === 'heading') return 'Heading'
  return node.type.name === 'paragraph' ? 'Text' : ''
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

/**
 * The line breaks around a `:::` block (the Agenda's too): tight with a neighbour only as written (`data-md-tight`); a
 * fence line never merges with the block beside it.
 */
function fenceSpacing(element: HTMLElement): { lead: string; trail: string } {
  const lead = element.getAttribute('data-md-tight') === 'true' && element.previousElementSibling ? '\n' : '\n\n'
  const next = element.nextElementSibling
  const trail = next && next.getAttribute('data-md-tight') === 'true' ? '\n' : '\n\n'
  return { lead, trail }
}

/**
 * The decks README, small details 14: the Agenda block. One line pair in the file (`::: agenda`, `:::`), and its list
 * drawn from the deck's section slides, never written. An atom on the stage: it is chosen, moved, deleted and undone
 * whole, and its lines (with anything someone wrote between them) are written back exactly as they were read.
 */
export const SlideAgenda = Node.create({
  name: 'slideAgenda',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      raw: {
        default: `${AGENDA_OPEN}\n${AGENDA_CLOSE}`,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-raw') ?? `${AGENDA_OPEN}\n${AGENDA_CLOSE}`,
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-raw': String(attrs.raw ?? '') }),
      },
      mdTight: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-md-tight'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.mdTight === null || attrs.mdTight === undefined ? {} : { 'data-md-tight': String(attrs.mdTight) }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-agenda]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-agenda': '' }, HTMLAttributes)]
  },
})

const isAgenda = (node: DomNode) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-agenda')

/** The Agenda as Markdown: its lines as read (a new one's `::: agenda` and `:::`), apart from its neighbours as a div. */
function agendaMarkdown(element: HTMLElement): string {
  const raw = (element.getAttribute('data-raw') ?? `${AGENDA_OPEN}\n${AGENDA_CLOSE}`).replace(/\n+$/, '')
  const { lead, trail } = fenceSpacing(element)
  return `${lead}${raw}${trail}`
}

/**
 * A `:::` block as Markdown: its lines as written around its blocks as Turndown wrote them. An empty block (a new Boxes
 * slide's box, a column not yet typed in) keeps its two lines, with its blank line after the opening one only when it
 * had one, so it reads back as the same empty block (PR 3: empty boxes were dropped on save).
 */
function slideDivMarkdown(content: string, element: HTMLElement): string {
  const open = element.getAttribute('data-open') ?? ':::'
  const close = element.getAttribute('data-close') ?? ':::'
  const gapOpen = element.getAttribute('data-gap-open') === 'true' ? '\n' : ''
  const gapClose = element.getAttribute('data-gap-close') === 'true' ? '\n' : ''
  const inside = content.replace(/^\n+/, '').replace(/\n+$/, '')
  const { lead, trail } = fenceSpacing(element)
  if (!inside) return `${lead}${open}\n${gapOpen}${close}${trail}`
  return `${lead}${open}\n${gapOpen}${inside}\n${gapClose}${close}${trail}`
}

/** A DOM node (this file's `Node` is TipTap's). */
type DomNode = globalThis.Node

const isSlideDiv = (node: DomNode) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-fdiv')

/** Is this list inside a `:::` block (a Steps block's steps): only there does an empty list keep its markers. */
function isInsideSlideDiv(node: DomNode): boolean {
  for (let up = node.parentNode; up; up = up.parentNode) if (isSlideDiv(up)) return true
  return false
}

/** The div's save rule: its lines as written around its blocks as Turndown wrote them. */
export function addSlideDivTurndownRule(service: TurndownService): void {
  service.addRule('slideDiv', {
    filter: node => isSlideDiv(node),
    replacement: (content, node) => slideDivMarkdown(content, node as HTMLElement),
  })
  service.addRule('slideAgenda', {
    filter: node => isAgenda(node),
    replacement: (_content, node) => agendaMarkdown(node as HTMLElement),
  })
  // Turndown gives an element with no words (a `:::` block of empty boxes, a Steps block's first empty step) its blank
  // rule, never its own, so the block and its list dropped out of the file. A slide's empty block keeps its lines, and
  // an empty list inside one its markers (`1.`, `-`), which read back as the same empty list. Anything else blank stays
  // as the document editor writes it.
  // The service reads its blank rule once, when it is made (`rules.blankRule`), so the rule itself is replaced.
  const rules = (service as unknown as { rules: { blankRule: { replacement: (content: string, node: DomNode, options: unknown) => string } } }).rules
  const blank = rules.blankRule.replacement
  rules.blankRule = {
    replacement: (content, node, options) => {
      if (isSlideDiv(node)) return slideDivMarkdown(content, node as HTMLElement)
      // The Agenda holds no words of its own: Turndown's blank rule would drop it.
      if (isAgenda(node)) return agendaMarkdown(node as HTMLElement)
      if ((node.nodeName === 'OL' || node.nodeName === 'UL') && isInsideSlideDiv(node)) {
        const items = Array.from((node as HTMLElement).children).filter(child => child.nodeName === 'LI')
        const start = Number((node as HTMLElement).getAttribute('start') ?? '1') || 1
        const marker = (index: number) => (node.nodeName === 'OL' ? `${start + index}.` : '-')
        return `\n\n${Array.from({ length: Math.max(1, items.length) }, (_unused, index) => marker(index)).join('\n')}\n\n`
      }
      return blank(content, node, options)
    },
  }
}

/** The slide editor's Turndown: the document editor's rules on a service of its own, and the div's rule. */
export function createSlideTurndownService(): TurndownService {
  const service = createEditorTurndownService()
  addSlideDivTurndownRule(service)
  addLabelTurndownRules(service)
  return service
}

/**
 * The stage's title place: a top-level heading with nothing before it but Labels (a Label may stand over the title,
 * Sprint 164 PR 3), so an empty title under a Label still says "Title".
 */
export function isTitlePlace(doc: PMNode, node: PMNode, pos: number): boolean {
  if (node.type.name !== 'heading') return false
  let offset = 0
  for (let index = 0; index < doc.childCount; index++) {
    const child = doc.child(index)
    if (offset === pos) return child === node
    if (child.type.name !== SLIDE_LABEL_NODE) return false
    offset += child.nodeSize
  }
  return false
}

let slideTurndown: TurndownService | null = null
let escapingTurndown: TurndownService | null = null

/** A line of text that would read as a `:::` block's opening or closing line. */
const FENCE_LINE = /^(\s*)(:{3,})/gm

/** The slide's Turndown that escapes text reading as a `:::` line (`\:::`). */
function createEscapingTurndownService(): TurndownService {
  const service = createSlideTurndownService()
  const escape = service.escape.bind(service)
  service.escape = (text: string) => escape(text).replace(FENCE_LINE, '$1\\$2')
  return service
}

/** The slide editor's save: its HTML as Markdown. */
export function slideEditorHTMLToMarkdown(html: string): string {
  slideTurndown ??= createSlideTurndownService()
  return slideTurndown.turndown(preprocessTableHTML(html))
}

/** The slide editor's save with every text line that reads as a `:::` line escaped. */
export function slideEditorHTMLToEscapedMarkdown(html: string): string {
  escapingTurndown ??= createEscapingTurndownService()
  return escapingTurndown.turndown(preprocessTableHTML(html))
}

/** Do two documents hold the same blocks and words (their as-written attributes aside)? */
export function sameShape(a: PMNode, b: PMNode): boolean {
  if (a.type !== b.type || a.childCount !== b.childCount) return false
  if (a.isText) return a.text === b.text
  for (let index = 0; index < a.childCount; index++) if (!sameShape(a.child(index), b.child(index))) return false
  return true
}

/**
 * The stage's save (PR 2): the document's Markdown, written so it reads back as the same blocks. `html` is the
 * document's HTML, `load` the slide editor's own load of a Markdown.
 */
export function saveSlideMarkdown(doc: PMNode, html: string, load: (markdown: string) => PMNode): string {
  const markdown = slideEditorHTMLToMarkdown(html)
  if (!markdown.includes(':::') || sameShape(load(markdown), doc)) return markdown
  return slideEditorHTMLToEscapedMarkdown(html)
}
