/**
 * Open and save a Markdown file outside the app, through the app's own code
 * (Sprint 137, R9). The corpus test (`markdownFidelity.test.ts`) and the
 * measuring harness (`scripts/qa/markdown-fidelity-measure.mjs`) both use it.
 *
 * The steps are the app's:
 *  1. the host splits the front matter (`splitFrontMatter`) and sends the body
 *     as its canonical projection (`canonicalMarkdownProjection`);
 *  2. the webview's load path (`markdownToEditorHTML`), then TipTap's mount
 *     parse (`elementFromString`'s wrapper and whitespace rule, the editor's
 *     schema, default parse options);
 *  3. the save: ProseMirror's `DOMSerializer` (`getHTML()`), then
 *     `editorHTMLToMarkdown`;
 *  4. the host joins the front matter again (`joinFrontMatter`, with the
 *     document's text before the save).
 *
 * The DOM is `@mixmark-io/domino`, Turndown's own, installed as the global
 * `document` with the two small gaps the editor's code meets filled in.
 * Nothing here is imported by the app.
 */
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { canonicalMarkdownProjection, encodeDocumentText } from '../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter, type SplitMarkdown } from '../../../src/editorSync/frontMatter'
import {
  createEditorSchemaExtensions,
  editorHTMLToMarkdown,
  ensureCommentMarkedPipeline,
  markdownToEditorHTML,
} from './editorMarkdown'

let installed = false

/** A global `document` for the editor's DOM helpers, as the webview has. */
export function installTestDocument(): void {
  if (installed) return
  installed = true
  const document = createDocument('<!doctype html><html><head></head><body></body></html>')
  ;(globalThis as { document?: unknown }).document = document
  // domino's `querySelectorAll` returns a live list without `forEach`, and its
  // `classList` is not iterable; the editor's code uses both.
  const probe = document.createElement('div')
  const listPrototype = Object.getPrototypeOf(probe.querySelectorAll('p'))
  if (typeof listPrototype.forEach !== 'function') {
    Object.defineProperty(listPrototype, 'forEach', {
      value(this: ArrayLike<unknown>, callback: (value: unknown, index: number) => void) {
        Array.from(this).forEach(callback)
      },
    })
  }
  const tokenPrototype = Object.getPrototypeOf(probe.classList)
  if (typeof tokenPrototype[Symbol.iterator] !== 'function') {
    Object.defineProperty(tokenPrototype, Symbol.iterator, {
      value: function* (this: DOMTokenList) {
        for (let index = 0; index < this.length; index++) yield this.item(index)
      },
    })
  }
}

let editorSchema: Schema | null = null

/** The editor's schema with comment callouts on, as shipped (the flag is on by default). */
export function fidelitySchema(): Schema {
  if (!editorSchema) {
    installTestDocument()
    ensureCommentMarkedPipeline()
    editorSchema = getSchema(createEditorSchemaExtensions({ commentCallouts: true }))
  }
  return editorSchema
}

/** TipTap's `elementFromString`: a `<body>` wrapper, minus newline-only text nodes. */
function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

export interface OpenedDocument {
  /** The document's text as the host read it (BOM removed, line endings as they were). */
  text: string
  split: SplitMarkdown
  /** What the host sends the editor. */
  projection: string
  doc: PMNode
}

/** Open a file's text in the editor. */
export function openDocument(text: string): OpenedDocument {
  const schema = fidelitySchema()
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const html = projection.trim() ? markdownToEditorHTML(projection) : ''
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(html))
  return { text, split, projection, doc }
}

/** `editor.getHTML()`. */
export function editorHTML(doc: PMNode): string {
  const document = createDocument('')
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content, { document }))
  return container.innerHTML
}

/** The editor's Markdown for a document, as `document:edit` carries it. */
export function editorMarkdown(doc: PMNode): string {
  return editorHTMLToMarkdown(editorHTML(doc))
}

/** Save: the editor's Markdown joined with the front matter, as the host writes it (LF). */
export function saveDocument(opened: OpenedDocument, doc: PMNode = opened.doc): string {
  // The webview's copy of the properties came through postMessage's JSON.
  const properties = JSON.parse(JSON.stringify(opened.split.properties ?? {}))
  return joinFrontMatter(properties, editorMarkdown(doc), opened.text)
}

/** Open a file's text and save it again, with no edit. */
export function openAndSave(text: string): string {
  return saveDocument(openDocument(text))
}

/**
 * Type `text` at the end of the document's last paragraph that is not in a
 * table, a code block or a list: one ProseMirror transaction, as a keystroke
 * makes. Null when the document has no such paragraph.
 */
export function typeAtEndOfLastParagraph(doc: PMNode, text: string): PMNode | null {
  let target = -1
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'paragraph' && node.textContent.trim() && parent?.type.name === 'doc') {
      target = pos + node.nodeSize - 1
    }
    return node.isBlock
  })
  if (target < 0) return null
  const state = EditorState.create({ doc })
  const tr = state.tr.setSelection(TextSelection.create(doc, target)).insertText(text)
  return tr.doc
}

/**
 * The text as the coordinator writes it to disk (`encodeDocumentBytes`): the
 * document's line endings, and its byte order mark when it had one.
 */
export function encodeLikeTheFile(content: string, crlf: boolean, bom: boolean): string {
  return encodeDocumentText(content, crlf ? '\r\n' : '\n', bom)
}

// ---------------------------------------------------------------------------
// What a document holds: for "nothing lost" and "looks the same"
// ---------------------------------------------------------------------------

export interface Inventory {
  /** The text, whitespace collapsed. */
  text: string
  links: string[]
  images: string[]
  /** `mark:text` for every marked run (bold, italic, strike, code, link), its edges trimmed. */
  marks: string[]
}

/** What an opened document holds, read from the editor's document itself. */
export function inventory(doc: PMNode): Inventory {
  const links: string[] = []
  const images: string[] = []
  const marks: string[] = []
  let text = ''
  doc.descendants(node => {
    if (node.isText) {
      text += node.text
      for (const mark of node.marks) {
        // A space at a mark's edge may move outside it (`**bold **` → `**bold** `).
        if (node.text?.trim()) marks.push(`${mark.type.name}:${node.text.trim()}`)
        if (mark.type.name === 'link') links.push(String(mark.attrs.href))
      }
    } else if (node.type.name === 'image') {
      images.push(String(node.attrs.src))
    } else if (node.isBlock) {
      text += ' '
    } else if (node.type.name === 'hardBreak') {
      text += ' '
    }
    return true
  })
  return { text: text.replace(/\s+/g, ' ').trim(), links: [...new Set(links)].sort(), images: images.sort(), marks: marks.sort() }
}

/**
 * The links and images the file itself holds: what `marked` reads, before the
 * editor's schema keeps or drops anything.
 */
export function sourceInventory(text: string): Pick<Inventory, 'links' | 'images'> {
  const projection = canonicalMarkdownProjection(splitFrontMatter(text).content)
  const root = createDocument(`<body>${projection.trim() ? markdownToEditorHTML(projection) : ''}</body>`).body
  const links = Array.from(root.querySelectorAll('a[href]'), a => (a as Element).getAttribute('href') ?? '')
  const images = Array.from(root.querySelectorAll('img'), img => (img as Element).getAttribute('src') ?? '')
  return { links: [...new Set(links)].sort(), images: images.sort() }
}

/** The editor's document without the as-written attributes: what the person sees. */
export function look(doc: PMNode): { json: unknown; html: string } {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/^md[A-Z]/.test(key))
        .map(([key, item]) => [key, strip(item)])
        // A node whose only attributes were as-written ones has none.
        .filter(([key, item]) => !(key === 'attrs' && item && typeof item === 'object' && Object.keys(item).length === 0)))
    }
    return value
  }
  return { json: strip(doc.toJSON()), html: editorHTML(doc).replace(/ data-md-[a-z-]+="[^"]*"/g, '') }
}

/** Lines that end in a space or a tab, outside fenced code. */
export function trailingWhitespaceLines(markdown: string): number[] {
  const lines = markdown.split('\n')
  const found: number[] = []
  let fence: string | null = null
  lines.forEach((line, index) => {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null
      return
    }
    if (opener) {
      fence = opener[1]
      return
    }
    if (/[ \t]$/.test(line)) found.push(index + 1)
  })
  return found
}
