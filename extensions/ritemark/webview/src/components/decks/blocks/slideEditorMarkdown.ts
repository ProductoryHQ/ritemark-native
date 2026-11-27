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
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Marked, type Token } from 'marked'
import type TurndownService from 'turndown'
import { fencedDivStart, scanFencedDiv, type FenceScan } from '../../../../../src/decks/blocks/fencedDiv'
import { AGENDA_CLOSE, AGENDA_OPEN, isAgendaClasses } from '../../../../../src/decks/blocks/agenda'
import { asWrittenMarkedExtension } from '../../../utils/markdownAsWritten'
import { mathMarkedExtension } from '../../../extensions/math/mathMarkedExtension'
import { createEditorTurndownService, markdownToEditorHTML, preprocessTableHTML } from '../../../utils/editorMarkdown'
import { commentMarkedExtension } from '../../../extensions/comment/commentMarkedExtension'
import { pictureMarkedExtension } from '../../../extensions/pictures/pictureMarked'
import { usePictureReferences } from '../../../extensions/pictures/pictureReferences'
import { tabsMarkedExtension } from '../../../extensions/tabs/tabsMarkdown'
import { PANE_PLACEHOLDER, tabsetOf } from '../../../../../src/decks/blocks/tabset'
import { buttonMarkedExtension } from '../../../extensions/buttonBlock/buttonMarkdown'
import { isEmptyLabel, LABEL_PLACEHOLDER } from '../../../../../src/decks/blocks/labelBlock'
import { splitQuoteByLine } from '../../../../../src/decks/blocks/slideRenderer'
import { SLIDE_LABEL_NODE, addLabelTurndownRules, labelMarkedExtension } from './slideLabel'
import { DOMParser as PMDOMParser, Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { markSlideEmptyLines, SLIDE_EMPTY_LINE, slideEmptyLineExtension } from '../../../../../src/decks/blocks/slideEmptyLines'
import { isLineBreakTag } from '../../../../../src/decks/blocks/lineBreakTag'

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

/** Keep inline HTML breaks at textblock edges separate from editable spacer paragraphs. */
function markEdgeInlineBreaks(token: Token): void {
  if (token.type !== 'paragraph' && token.type !== 'heading' && token.type !== 'text') return
  const tokens = (token as { tokens?: Token[] }).tokens
  const markBreak = (inline: Token): boolean => {
    if (inline.type === 'html' && isLineBreakTag(inline.raw)) inline.type = 'slideInlineBreak'
    return inline.type === 'slideInlineBreak'
  }
  const markLeading = (inline: Token): boolean => {
    const children = (inline as { tokens?: Token[] }).tokens
    return children?.length ? children.every(markLeading) : markBreak(inline)
  }
  tokens?.every(markLeading)
  let tail = tokens?.[tokens.length - 1]
  while (tail && 'tokens' in tail) {
    const children = tail.tokens as Token[] | undefined
    tail = children?.[children.length - 1]
  }
  if (tail) markBreak(tail)
}

/** The slide editor's own `marked`: the document editor's configuration, and the `:::` blocks. */
export const slideEditorMarked = new Marked({ breaks: true, gfm: true })
slideEditorMarked.use(asWrittenMarkedExtension)
slideEditorMarked.use({
  extensions: [
    slideEmptyLineExtension(true),
    { name: 'slideInlineBreak', renderer: () => '<br data-md-break="html">' },
  ],
  walkTokens: markEdgeInlineBreaks,
})
slideEditorMarked.use(mathMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
slideEditorMarked.use(slideDivMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
// Experience 49: a picture's look, as the document editor reads it.
slideEditorMarked.use(pictureMarkedExtension as Parameters<typeof slideEditorMarked.use>[0])
// #1129: a reference picture (`![a][ref]`) and its definition stay as written, as in a Text document since #1115.
usePictureReferences(slideEditorMarked)
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
  const html = markdownToEditorHTML(markdown, imageMappings, slideEditorMarked, markSlideEmptyLines)
  return withoutCodeEndBreak(withColumnPlaces(markPictureBoundaries(html)))
}

const PICTURE_PARAGRAPH = 'data-slide-picture-paragraph'
const PICTURE_BREAK = 'slide-picture-boundary'

/** Record the source boundaries before ProseMirror lifts inline pictures out as blocks. */
function markPictureBoundaries(html: string): string {
  if (!html.includes('<img')) return html
  const root = document.createElement('div')
  root.innerHTML = html
  const inlineLeaves = (node: DomNode): DomNode[] => {
    if (node.nodeType === 3) return node.textContent?.trim() ? [node] : []
    if (node.nodeType !== 1) return []
    // These wrappers can share a textblock with a picture. Other elements stop the boundary search.
    if (/^(A|STRONG|B|EM|I|S|DEL|MARK|SPAN|U|SUB|SUP)$/.test(node.nodeName)) {
      return Array.from(node.childNodes).flatMap(inlineLeaves)
    }
    return [node]
  }

  for (const block of Array.from(root.querySelectorAll('p, li'))) {
    if (block.closest('table')) continue
    const leaves = Array.from(block.childNodes).flatMap(inlineLeaves)
    if (block.nodeName === 'P' && leaves.find(leaf => leaf.nodeName !== 'BR')?.nodeName === 'IMG') {
      block.setAttribute(PICTURE_PARAGRAPH, '')
    }
    leaves.forEach((leaf, index) => {
      if (leaf.nodeName !== 'IMG') return
      for (const neighbor of [leaves[index - 1], leaves[index + 1]]) {
        if (neighbor?.nodeName === 'BR') (neighbor as Element).setAttribute('data-md-break', PICTURE_BREAK)
      }
      // The picture replaces one break. Further breaks still belong to the caption.
      for (let next = index + 2; leaves[index + 1]?.nodeName === 'BR' && leaves[next]?.nodeName === 'BR'; next++) {
        const br = leaves[next] as Element
        if (br.getAttribute('data-md-break') !== PICTURE_BREAK) br.setAttribute('data-md-break', 'html')
      }
    })
  }
  return root.innerHTML
}

/** Drop the paragraph and boundary break left when ProseMirror lifts a picture out of a textblock. */
export function withoutPictureSplitArtifacts(doc: PMNode): PMNode {
  function clean(node: PMNode): PMNode {
    if (node.isLeaf) return node
    const children: PMNode[] = []
    node.forEach(child => {
      if (child.type.name === 'hardBreak' && child.attrs.mdBreak === PICTURE_BREAK) return
      children.push(clean(child))
    })
    const generatedParagraph = (child: PMNode) => child.attrs.slidePictureParagraph && child.childCount === 0
    const kept = children.flatMap((child, index) => {
      if (generatedParagraph(child)) return []
      const previous = children[index - 1]
      if (child.type.name === 'image' && previous && generatedParagraph(previous) && previous.attrs.mdTight) {
        return [child.type.create({ ...child.attrs, mdTight: previous.attrs.mdTight }, child.content, child.marks)]
      }
      // A caption parsed in the picture's original paragraph can retain its inter-word space.
      const text = child.firstChild?.text
      if (previous?.type.name === 'image' && child.type.name === 'paragraph' && text?.startsWith(' ')) {
        const start = /^ +/.exec(text)![0].length
        return [child.copy(child.content.cut(start))]
      }
      return [child]
    })
    const content = Fragment.fromArray(kept)
    // A list item can require its initial paragraph even when the picture was lifted out.
    const validContent = node.type.validContent(content) ? content : Fragment.fromArray(children)
    if (node.attrs.slidePictureParagraph && validContent.size > 0) {
      return node.type.create({ ...node.attrs, slidePictureParagraph: false }, validContent, node.marks)
    }
    return node.content.eq(validContent) ? node : node.copy(validContent)
  }
  return clean(doc)
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
      if (node.nodeName === 'P' && (node as HTMLElement).hasAttribute('data-slide-empty-line')) {
        return `\n\n${SLIDE_EMPTY_LINE}\n\n`
      }
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
  const service = createEditorTurndownService(slideEditorMarked)
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

/** Empty lines on the stage are regular paragraphs, so typing replaces the space with text. */
export const SlideEmptyLines = Extension.create({
  name: 'slideEmptyLines',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        slidePictureParagraph: {
          default: false,
          keepOnSplit: false,
          parseHTML: (element: HTMLElement) => element.hasAttribute(PICTURE_PARAGRAPH),
          renderHTML: (attrs: Record<string, unknown>) => attrs.slidePictureParagraph ? { [PICTURE_PARAGRAPH]: '' } : {},
        },
        slideEmptyLine: {
          default: false,
          keepOnSplit: false,
          parseHTML: (element: HTMLElement) => element.hasAttribute('data-slide-empty-line'),
          renderHTML: (attrs: Record<string, unknown>) => attrs.slideEmptyLine ? { 'data-slide-empty-line': '' } : {},
        },
      },
    }]
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations({ doc, selection }) {
          const decorations: Decoration[] = []
          const isEmpty = (block: PMNode) => block.type.name === 'paragraph' &&
            block.content.content.every(child => child.type.name === 'hardBreak')
          let firstDrawn = Infinity
          let lastDrawn = -1
          doc.forEach((block, from) => {
            if (isEmpty(block) || block.type.name === 'commentNode' ||
              (block.type.name === SLIDE_LABEL_NODE && isEmptyLabel(block.textContent))) return
            firstDrawn = Math.min(firstDrawn, from)
            lastDrawn = from
          })

          doc.descendants((block, from, parent) => {
            if (block.type.name === 'table') return false
            const to = from + block.nodeSize
            const hasCaret = selection.from > from && selection.from < to
            if (isEmpty(block)) {
              const edge = parent === doc && (from < firstDrawn || from > lastDrawn)
              const className = edge ? `blk-empty-line is-edge${hasCaret ? ' has-caret' : ''}` : 'blk-empty-line'
              decorations.push(Decoration.node(from, to, { class: className }))
              return false
            }
            if (!/^(paragraph|heading)$/.test(block.type.name)) return
            const first = parent === doc && from === firstDrawn
            const last = parent === doc && from === lastDrawn
            let leading = 0
            let trailing = block.childCount
            while (first && block.maybeChild(leading)?.type.name === 'hardBreak' &&
              block.child(leading).attrs.mdBreak !== 'html') leading++
            while (last && trailing > leading && block.child(trailing - 1).type.name === 'hardBreak' &&
              block.child(trailing - 1).attrs.mdBreak !== 'html') trailing--
            const trailingHtmlBreak = trailing === block.childCount &&
              block.lastChild?.type.name === 'hardBreak' && block.lastChild.attrs.mdBreak === 'html'
            block.forEach((child, offset, index) => {
              if (index >= leading && index < trailing && !(trailingHtmlBreak && index === trailing - 1)) return
              const start = from + 1 + offset
              const caret = selection.from === start || selection.from === start + child.nodeSize
              decorations.push(Decoration.node(start, start + child.nodeSize, {
                class: caret ? 'blk-edge-break has-caret' : 'blk-edge-break',
              }))
            })
          })
          return DecorationSet.create(doc, decorations)
        },
      },
    })]
  },
})

/** Move boundary breaks into editable paragraphs before CommonMark's writer can drop them. */
function withSlideEmptyLines(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  const emptyLine = () => {
    const line = document.createElement('p')
    line.setAttribute('data-slide-empty-line', '')
    return line
  }

  for (const block of Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))) {
    if (block.closest('table')) continue
    const parent = block.parentElement!
    if (block.hasChildNodes()) block.removeAttribute('data-slide-empty-line')
    const takeBreak = (side: 'firstChild' | 'lastChild') => {
      let edge: globalThis.Node = block
      while (edge[side]) edge = edge[side]!
      if (edge.nodeName !== 'BR' ||
        (edge as Element).getAttribute('data-md-break') === 'html') return false
      // A break can carry marks. Remove wrappers emptied by taking it out.
      do {
        const parent = edge.parentNode!
        parent.removeChild(edge)
        edge = parent
      } while (edge !== block && !edge.hasChildNodes())
      return true
    }
    // Empty container placeholders and bare list markers have no line in the file.
    if (block.nodeName === 'P' && parent !== root && !block.hasChildNodes() &&
      !block.hasAttribute('data-slide-empty-line') &&
      Array.from(parent.children).every(sibling =>
        sibling === block || (/^H[1-6]$/.test(sibling.nodeName) && !sibling.hasChildNodes()))) {
      continue
    }
    while (takeBreak('firstChild')) parent.insertBefore(emptyLine(), block)
    if (block.nodeName === 'P' && !block.hasChildNodes()) {
      block.setAttribute('data-slide-empty-line', '')
      continue
    }
    const next = block.nextSibling
    while (takeBreak('lastChild')) parent.insertBefore(emptyLine(), next)
  }

  const children = Array.from(root.children).filter(block => block.nodeName !== 'RITEMARK-COMMENT' &&
    !(block.hasAttribute('data-slide-label') && isEmptyLabel(block.textContent ?? '')))
  const isEmptyLine = (block: Element) => block.hasAttribute('data-slide-empty-line')
  const first = children.findIndex(block => !isEmptyLine(block))
  let last = children.length - 1
  while (last > first && isEmptyLine(children[last])) last--
  children.forEach((block, index) => {
    if (isEmptyLine(block) && (first < 0 || index < first || index > last)) block.remove()
  })
  return root
}

function writeSlide(root: HTMLElement, escapeFences = false): string {
  const service = escapeFences
    ? (escapingTurndown ??= createEscapingTurndownService())
    : (slideTurndown ??= createSlideTurndownService())
  return service.turndown(preprocessTableHTML(root.innerHTML))
}

/** The slide editor's save: its HTML as Markdown. */
export function slideEditorHTMLToMarkdown(html: string): string {
  return writeSlide(withSlideEmptyLines(html))
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
  const root = withSlideEmptyLines(html)
  const markdown = writeSlide(root)
  if (!markdown.includes(':::')) return markdown
  const expected = root.innerHTML === html ? doc : PMDOMParser.fromSchema(doc.type.schema).parse(root)
  return sameShape(load(markdown), expected) ? markdown : writeSlide(root, true)
}
