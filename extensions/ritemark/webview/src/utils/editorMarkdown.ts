/**
 * The editor's Markdown pipeline, in one module (Sprint 137, W1).
 *
 * Everything that decides what a Markdown file becomes in the editor, and what
 * the editor writes back, lives here:
 *
 *  - load: `editorMarked` (the scoped `marked` instance), then the task-list and
 *    image preprocessing, then the host's image mappings (`markdownToEditorHTML`);
 *  - the schema: the node and mark extensions whose attributes reach the file
 *    (`createEditorSchemaExtensions`);
 *  - save: `getHTML()`, then `preprocessTableHTML`, then Turndown with the
 *    editor's rules (`editorHTMLToMarkdown`).
 *
 * `Editor.tsx` uses these exports at every parse and serialize place, and the
 * round-trip and corpus tests import the same exports, so a test drives the
 * editor's own code rather than a copy of its settings. The module holds no
 * React and no node views: the editor passes its node views and keyboard
 * extensions in through `EditorExtensionSlots`, at the positions they always
 * had, so the editor's extension order is unchanged.
 */
import { Marked, type Token } from 'marked'
import type TurndownService from 'turndown'
import { Extension, type AnyExtension, type Node as TipTapNode } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import Code from '@tiptap/extension-code'
import { createLowlight, common } from 'lowlight'
import { BoundedOrderedList } from '../extensions/BoundedOrderedList'
import { CustomLink, type CustomLinkOptions } from '../extensions/CustomLink'
import { tableExtensions } from '../extensions/tableExtensions'
import { CommentMark } from '../extensions/comment/CommentMark'
import { CommentNode } from '../extensions/comment/CommentNode'
import { commentMarkedExtension } from '../extensions/comment/commentMarkedExtension'
import { addCommentTurndownRules } from '../extensions/comment/commentTurndownRules'
import { addDeckTurndownRules } from '../components/decks/handout/deckSchema'
import { mathMarkedExtension } from '../extensions/math/mathMarkedExtension'
import { LiteralDollar, MathBlock, MathInline } from '../extensions/math/mathNodes'
import { classifyLinkTarget, isSafeRelativePath } from '../lib/linkTargets'
import { createTurndownService } from './turndownService'
import { pictureMarkedExtension } from '../extensions/pictures/pictureMarked'
import { TabPane, TabsBlock, addTabsTurndownRules, tabsMarkedExtension } from '../extensions/tabs/tabsMarkdown'
import { buttonBlockExtensions } from '../extensions/buttonBlock/ButtonBlock'
import { addButtonTurndownRules, buttonMarkedExtension } from '../extensions/buttonBlock/buttonMarkdown'
import { preprocessTaskListHTML } from './taskListRoundTrip'
import {
  annotateAsWritten,
  AS_WRITTEN_ATTRIBUTES,
  asWrittenMarkedExtension,
  protectFenceTabs,
  TIGHT_BLOCKS,
} from './markdownAsWritten'

// ---------------------------------------------------------------------------
// Load: Markdown → the HTML the editor parses
// ---------------------------------------------------------------------------

/**
 * Sprint 94 (#81): a SCOPED `marked` instance for the editor's load path, so
 * registering the comment tokenizer never mutates the global `marked`
 * singleton — the AI sidebar's RenderedMarkdown uses that global, and a comment
 * tokenizer on it would turn chat `<!-- ... -->` into visible
 * `<ritemark-comment>` (audit M2).
 */
export const editorMarked = new Marked({ breaks: true, gfm: true })
// Sprint 137 (#270): record how each block was written, as `data-md-*` attributes.
editorMarked.use(asWrittenMarkedExtension)

// Sprint 138 (#481, R1): math is read always, never behind a flag. Reading it
// is what keeps formulas safe on save: without it, `$\bar{x}$` is Markdown
// text whose backslashes and underscores a save would rewrite.
editorMarked.use(mathMarkedExtension as Parameters<typeof editorMarked.use>[0])
// Experience 49: a picture's size, crop and caption, kept in the block after its image line.
editorMarked.use(pictureMarkedExtension as Parameters<typeof editorMarked.use>[0])
// Sprint 163: the Tabs block (`::: {.panel-tabset}`), one block in a slide, a handout and a Text document. Only that
// `:::` block: any other `:::` line in a Text document stays text.
editorMarked.use(tabsMarkedExtension as Parameters<typeof editorMarked.use>[0])
// Sprint 163 PR 3: a paragraph ending with a `{.button}` link is a Button block (after the as-written paragraph).
editorMarked.use(buttonMarkedExtension)

let commentMarkedRegistered = false

/**
 * Register the comment tokenizer on `editorMarked`, lazily and once, gated on
 * the comment-callouts flag by the caller. Registering it unconditionally would
 * turn a flag-off document's `<!-- -->` into a `<ritemark-comment>` the
 * (unregistered) TipTap node then drops, losing the comment.
 */
export function ensureCommentMarkedPipeline(): void {
  if (commentMarkedRegistered) return
  commentMarkedRegistered = true
  editorMarked.use(commentMarkedExtension as Parameters<typeof editorMarked.use>[0])
}

/**
 * Unwrap standalone images from paragraph tags.
 *
 * marked generates: <p><img src="..." alt=""></p>
 * TipTap with inline:false images expects: <img src="..." alt="">
 *
 * Without this, TipTap creates both an empty paragraph AND an image node,
 * causing extra spacing above images when reopening files.
 */
export function preprocessImageHTML(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Find all paragraphs that hold only pictures (and maybe whitespace)
  temp.querySelectorAll('p').forEach(p => {
    const imgs = Array.from(p.querySelectorAll('img'))
    if (imgs.length === 0) return
    // Check the paragraph holds only its pictures (no text content besides whitespace)
    const textContent = p.textContent?.trim() || ''
    const onlyAlt = imgs.length === 1 && textContent === (imgs[0].getAttribute('alt') || '')
    if (textContent !== '' && !onlyAlt) return
    // Sprint 137: the paragraph's place as written (no blank line before
    // it) moves to the first image that replaces it.
    const tight = p.getAttribute('data-md-tight')
    if (tight !== null) imgs[0].setAttribute('data-md-tight', tight)
    // #1075: replace the paragraph with every picture it holds, in order. Keeping
    // only the first deleted the others (`![a](a.png) ![b](b.png)` saved as
    // `![a](a.png)`). A link around a picture is still dropped, as before (#554).
    p.replaceWith(...imgs)
  })

  return temp.innerHTML
}

/**
 * Apply image mappings to HTML content.
 * Converts relative image paths to webview URIs for display, while storing the
 * original relative path in the title attribute for Turndown.
 */
export function applyImageMappings(html: string, imageMappings: Record<string, string>): string {
  if (!imageMappings || Object.keys(imageMappings).length === 0) {
    return html
  }

  // Process each mapping
  let result = html
  for (const [relativePath, webviewUri] of Object.entries(imageMappings)) {
    // Escape special regex characters in the path
    const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Replace src="relativePath" with src="webviewUri" title="relativePath"
    // This preserves the relative path for turndown to use when saving
    const srcRegex = new RegExp(`src="${escapedPath}"`, 'g')
    result = result.replace(srcRegex, `src="${webviewUri}" title="${relativePath}"`)
  }

  return result
}

/**
 * `editorMarked.parse`, with two steps of its own: the tabs at the start of a
 * code fence's lines are kept from `marked`'s tab expansion
 * (`protectFenceTabs`), and between the lexer and the parser
 * `annotateAsWritten` marks what needs sibling context (a block straight under
 * another) or the whole source (tab-indented lists). The rest is what `parse`
 * does: hooks, `walkTokens` and the parser, with the same options.
 */
function parseAsWritten(markdown: string, instance: Marked, prepareTokens?: (tokens: Token[]) => void): string {
  // The editor's instance is synchronous: no extension sets `async`.
  const options = instance.defaults
  const preprocessed = options.hooks ? options.hooks.preprocess(markdown) as string : markdown
  const source = protectFenceTabs(preprocessed)
  const tokens = instance.lexer(source)
  annotateAsWritten(tokens, source)
  prepareTokens?.(tokens)
  if (options.walkTokens) instance.walkTokens(tokens, options.walkTokens)
  const html = instance.parser(tokens)
  return options.hooks ? options.hooks.postprocess(html) as string : html
}

/**
 * The editor's load path: Markdown to the HTML TipTap parses. `marked`, then
 * GFM task lists to TipTap's task nodes, then standalone images out of their
 * paragraphs, then — when given — the host's image mappings.
 *
 * Throws what `marked` throws; the editor catches it and falls back to plain
 * paragraphs.
 */
export function markdownToEditorHTML(markdown: string, imageMappings?: Record<string, string>, instance: Marked = editorMarked, prepareTokens?: (tokens: Token[]) => void): string {
  // Sprint 161: the slide editor passes its own scoped instance (`slideEditorMarkdown.ts`), never this one.
  const html = parseAsWritten(markdown, instance, prepareTokens)
  let processed = preprocessTaskListHTML(html)
  processed = preprocessImageHTML(processed)
  return imageMappings ? applyImageMappings(processed, imageMappings) : processed
}

// ---------------------------------------------------------------------------
// Schema: the nodes and marks whose attributes reach the file
// ---------------------------------------------------------------------------

function camelName(dataName: string): string {
  return dataName.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** A data-only attribute, read from and written to one `data-md-*` attribute. */
function dataAttribute(name: string, keepOnSplit: boolean) {
  const key = camelName(name)
  return {
    default: null,
    keepOnSplit,
    parseHTML: (element: HTMLElement) => element.getAttribute(name),
    renderHTML: (attrs: Record<string, unknown>) => {
      const value = attrs[key]
      return value === null || value === undefined ? {} : { [name]: String(value) }
    },
  }
}

function dataAttributes(names: readonly string[], keepOnSplit = true) {
  return Object.fromEntries(names.map(name => [camelName(name), dataAttribute(name, keepOnSplit)]))
}

/**
 * Sprint 137 (#270): how each block was written (`markdownAsWritten.ts`), on
 * TipTap's nodes and marks as data-only attributes (`mdMarker` for
 * `data-md-marker`). Global attributes add them without changing the schema's
 * order or any node's own behaviour, and nothing styles them.
 */
export const MarkdownAsWritten = Extension.create({
  name: 'markdownAsWritten',

  addGlobalAttributes() {
    return [
      { types: ['bulletList', 'orderedList', 'taskList'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.list) },
      // A new item (Enter) keeps its list's blank lines.
      { types: ['listItem', 'taskItem'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.item) },
      { types: ['hardBreak'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.hardBreak, false) },
      { types: ['horizontalRule'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.horizontalRule, false) },
      { types: ['link'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.link) },
      { types: ['table'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.table) },
      { types: ['codeBlock'], attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.codeBlock, false) },
      // Experience 49: a picture's attribute block as written (`{width=50%}`), written back after its image line.
      { types: ['image'], attributes: { picture: dataAttribute('data-picture', false) } },
      // A block split off with Enter is new writing: a blank line before it.
      { types: TIGHT_BLOCKS, attributes: dataAttributes(AS_WRITTEN_ATTRIBUTES.tight, false) },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          mdAlign: {
            default: null,
            // `marked` writes a column's alignment as `align`; the editor keeps it as data only.
            parseHTML: (element: HTMLElement) => element.getAttribute('data-md-align') ?? element.getAttribute('align'),
            renderHTML: (attrs: Record<string, unknown>) => attrs.mdAlign ? { 'data-md-align': String(attrs.mdAlign) } : {},
          },
        },
      },
    ]
  },
})

/** Create lowlight instance with common languages. */
const lowlight = createLowlight(common)

/** The code block's options; the editor's copy-button variant takes the same. */
export const editorCodeBlockOptions = {
  lowlight,
  defaultLanguage: 'plaintext',
  HTMLAttributes: {
    class: 'tiptap-code-block',
  },
}

/** The image node's options; the editor's resizable variant takes the same. */
export const editorImageOptions = {
  inline: false, // Block-level so /image replaces empty paragraph instead of inserting into it
  allowBase64: true,
  HTMLAttributes: {
    class: 'tiptap-image',
    loading: 'lazy',
    decoding: 'async',
  },
}

/**
 * Which links the link mark keeps. Allow external URLs, in-workspace relative
 * paths, and same-document anchor links (`#section`). Anchor links are valid
 * Markdown and shouldn't be stripped by the TipTap Link extension — Sprint 72
 * separated them out from `internal` so Cmd-click doesn't try to resolve them
 * as files, but they're still legitimate link targets.
 */
function validateLinkTarget(url: string): boolean {
  const target = classifyLinkTarget(url)
  return (
    target.kind === 'external' ||
    target.kind === 'internal' ||
    target.kind === 'anchor'
  )
}

/**
 * Which addresses a link may have, on open, on render and in `setLink` (the
 * link dialog). TipTap's own check first; it refuses `notes/report.md`, because
 * its pattern's `.`–`:` range takes in `/`, so a link into a folder was dropped
 * on open and lost on the next save (#539). A relative path Ritemark's own link
 * check accepts is allowed too. `javascript:`, `vbscript:`, `data:` and `file:`
 * stay refused: neither check accepts them (R6, S31).
 */
export function isAllowedLinkUri(url: string, defaultValidate: (url: string) => boolean): boolean {
  if (defaultValidate(url)) return true
  return isSafeRelativePath(url) && classifyLinkTarget(url).kind !== 'dangerous'
}

/**
 * The editor's UI pieces, passed in at the positions they always had in the
 * editor's extension list. Every slot is optional: a test leaves them out and
 * gets the same schema without node views, keyboard extensions or callbacks.
 */
export interface EditorExtensionSlots {
  /** Right after StarterKit, so their bindings get the first dispatch chance. */
  afterStarterKit?: AnyExtension[]
  /** The code block node; the editor passes its copy-button node view. */
  codeBlock?: TipTapNode
  /** Between the task nodes and the link mark (the placeholder). */
  beforeLink?: AnyExtension[]
  /** Called when a link is clicked without a modifier (the edit dialog). */
  onLinkClick?: CustomLinkOptions['onLinkClick']
  /** The image node; the editor passes its resizable node view. */
  image?: TipTapNode
  /** After the image node: the editor's UI extensions. */
  afterImage?: AnyExtension[]
  /** Sprint 94 (#81): the comment-callout mark and node, gated on the flag. */
  commentCallouts?: boolean
  /** Sprint 138 (#481): the inline equation node; the editor passes its typesetting view. */
  mathInline?: TipTapNode
  /** Sprint 138 (#481): the equation block node; the editor passes its typesetting view. */
  mathBlock?: TipTapNode
  /** Sprint 157: a deck's slide node and its guard, only when the document opens as a deck. */
  deck?: AnyExtension[]
  /** Sprint 163: the Tabs block's two nodes; the editors pass them with their node views. */
  tabs?: AnyExtension[]
}

/**
 * The editor's extensions, in the editor's order. Each call makes fresh
 * extension instances, as the editor's own list did when it was written out in
 * `Editor.tsx`.
 */
export function createEditorSchemaExtensions(slots: EditorExtensionSlots = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false, // Disable default to use enhanced version
      code: false, // Added last, below: no longer excludes the other marks (#539)
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      bold: {
        HTMLAttributes: {
          class: 'font-bold',
        },
      },
      italic: {
        HTMLAttributes: {
          class: 'italic',
        },
      },
    }),
    ...(slots.afterStarterKit ?? []),
    (slots.codeBlock ?? CodeBlockLowlight).configure(editorCodeBlockOptions),
    BulletList.configure({
      HTMLAttributes: {
        class: 'tiptap-bullet-list',
      },
    }),
    // Sprint 120 (#280): same as TipTap's ordered list, except a number
    // only starts a list up to 99, so a year stays prose.
    BoundedOrderedList.configure({
      HTMLAttributes: {
        class: 'tiptap-ordered-list',
      },
    }),
    ListItem.configure({
      HTMLAttributes: {
        class: 'tiptap-list-item',
      },
    }),
    TaskList.configure({
      HTMLAttributes: {
        class: 'tiptap-task-list',
      },
    }),
    TaskItem.configure({
      HTMLAttributes: {
        class: 'tiptap-task-item',
      },
      nested: true,
    }),
    ...(slots.beforeLink ?? []),
    CustomLink.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'tiptap-link',
      },
      validate: validateLinkTarget,
      isAllowedUri: (url, ctx) => isAllowedLinkUri(url, ctx.defaultValidate),
      onLinkClick: slots.onLinkClick,
    }),
    ...tableExtensions,
    // Sprint 163 PR 3: the Button block, the same in a Text document and on a slide.
    ...buttonBlockExtensions,
    slots.image ?? Image.configure(editorImageOptions),
    ...(slots.afterImage ?? []),
    // Sprint 94 (#81): comment callouts, gated on the kill-switch flag.
    // Registered at the highest level — when off, the extensions don't exist,
    // so a document's comments fall back to the plain load/save path.
    ...(slots.commentCallouts ? [CommentMark, CommentNode] : []),
    // Sprint 138 (#481): equations and `\$`, always (see editorMarked above).
    slots.mathInline ?? MathInline,
    slots.mathBlock ?? MathBlock,
    LiteralDollar,
    // Sprint 157: the deck's slide node, after math, only in a deck.
    ...(slots.deck ?? []),
    // Sprint 163: the Tabs block, everywhere (its file form is read in every document).
    ...(slots.tabs ?? [TabsBlock, TabPane]),
    // Sprint 137 (#539): inline code no longer excludes every other mark, so
    // a link, bold, italic or strikethrough around code keeps its mark
    // (``[`file.md`](file.md)``, ``**`name` is vendored**``). It comes last, so
    // it is the innermost mark: `<a><code>`, `<strong><code>`, `<mark><code>`.
    Code.extend({ excludes: 'code' }),
    // Sprint 137 (#270): how each block was written, as data-only attributes.
    MarkdownAsWritten,
  ]
}

// ---------------------------------------------------------------------------
// Save: the editor's HTML → Markdown
// ---------------------------------------------------------------------------

/**
 * Make TipTap tables compatible with turndown-plugin-gfm.
 *
 * TipTap generates tables with:
 * 1. <colgroup> elements that break GFM table parser
 * 2. <p> tags inside cells that add unwanted line breaks
 *
 * This function cleans the HTML in the DOM before Turndown processes it.
 */
export function preprocessTableHTML(html: string): string {
  // Create a temporary DOM element to parse and manipulate HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Remove all <colgroup> elements from tables
  temp.querySelectorAll('colgroup').forEach(colgroup => colgroup.remove())

  // Unwrap <p> tags inside table cells (keep content, remove wrapper)
  temp.querySelectorAll('td > p, th > p').forEach(p => {
    const parent = p.parentElement
    if (parent) {
      // Move all child nodes of <p> to parent
      while (p.firstChild) {
        parent.insertBefore(p.firstChild, p)
      }
      // Remove the now-empty <p> tag
      p.remove()
    }
  })

  return temp.innerHTML
}

/**
 * The editor's Turndown service: Ritemark's canonical rules
 * (`createTurndownService`, shared with Copy and Save as Markdown, which
 * include the as-written rules and TipTap's task lists) plus the
 * comment-callout rules. Comment rules register unconditionally: they are
 * harmless when no comment nodes exist.
 */
export function createEditorTurndownService(): TurndownService {
  const service = createTurndownService()
  addCommentTurndownRules(service)
  // Sprint 157: a deck's slide nodes. Harmless without them, like the comment rules.
  addDeckTurndownRules(service)
  // Sprint 163: the Tabs block. Harmless without one, like the rules above.
  addTabsTurndownRules(service)
  // Sprint 163 PR 3: the Button block (a paragraph ending with its `{.button}` link).
  addButtonTurndownRules(service)
  return service
}

/** The editor's one Turndown instance, shared by the save path and Copy as Markdown. */
export const editorTurndownService = createEditorTurndownService()

/**
 * Serialize every TipTap document through one canonical Markdown path.
 *
 * The editor's incoming-value reconciliation and outgoing change publication
 * must compare the same representation. Otherwise a harmless TipTap plugin
 * transaction after opening a file can look like a user edit (for example,
 * when the source file has a trailing newline but Turndown does not).
 */
export function editorHTMLToMarkdown(html: string): string {
  return editorTurndownService.turndown(preprocessTableHTML(html))
}
