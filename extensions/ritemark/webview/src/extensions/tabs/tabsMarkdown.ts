/**
 * Sprint 163 (PR 2): the Tabs block in the editors, as Markdown. One block everywhere (decks README "Tabs, one block
 * everywhere"): the slide editor and the Text editor (a Text document, a deck's handout) read and write it with these.
 *
 *  - load: a `marked` tokenizer for `::: {.panel-tabset}` (`src/decks/blocks/tabset.ts`, the renderer's own reader),
 *    each tab's pane lexed as ordinary blocks. Any other `:::` line is not this tokenizer's: in a Text document it stays
 *    text, as before;
 *  - the nodes: `tabsBlock` (its opening and closing lines as written) holding `tabPane`s (each its heading line as
 *    written and whether a blank line followed it), so an untouched block writes back byte for byte;
 *  - save: Turndown rules that write the lines as read around each pane's blocks as Turndown wrote them.
 *
 * A pane holds ordinary blocks. A heading at the tabs' own level typed in a pane would read back as a new tab, so it is
 * written one level down (`tabPaneHeadings`); the tab's own name is its heading, never a heading node.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type TurndownService from 'turndown'
import { scanFencedDiv, type FenceScan } from '../../../../src/decks/blocks/fencedDiv'
import { TAB_LEVEL, TABSET_CLOSE, TABSET_OPEN, tabHeadingOf, tabMarkdown, tabsetOf, tabsetStart } from '../../../../src/decks/blocks/tabset'

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface TabPaneToken {
  type: 'tabPane'
  raw: string
  line: string
  gap: boolean
  tight: boolean
  tokens: unknown[]
}

export interface TabsBlockToken {
  type: 'tabsBlock'
  raw: string
  scan: FenceScan
  tabs: TabPaneToken[]
  /** Set by the as-written pass: no blank line between this block and the one before it. */
  rmTight?: boolean
}

/** A tab's name as a person reads it, from its heading line. */
export function tabNameOf(line: unknown): string {
  return tabHeadingOf(String(line ?? ''))?.name ?? ''
}

/** The heading level of a Tabs block's tabs, from its first tab's line (`##` by default). */
export function tabsLevelOf(node: PMNode): number {
  const first = node.childCount ? node.child(0) : null
  return tabHeadingOf(String(first?.attrs.line ?? ''))?.level ?? TAB_LEVEL
}

/** The `marked` extension: a Tabs block and its panes. Registered on the Text editor's and the slide editor's own `marked`. */
export const tabsMarkedExtension = {
  extensions: [
    {
      name: 'tabsBlock',
      level: 'block' as const,
      start: tabsetStart,
      tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: unknown[]) => unknown[] } }, src: string): TabsBlockToken | undefined {
        const scan = scanFencedDiv(src)
        if (!scan) return undefined
        const tabset = tabsetOf(scan)
        if (!tabset || !tabset.tabs.length) return undefined
        return {
          type: 'tabsBlock',
          raw: scan.raw,
          scan,
          tabs: tabset.tabs.map(tab => ({ type: 'tabPane', raw: tab.markdown, line: tab.line, gap: tab.gap, tight: tab.tight, tokens: this.lexer.blockTokens(tab.markdown, []) })),
        }
      },
      renderer(this: { parser: { parse: (tokens: unknown[]) => string } }, token: TabsBlockToken): string {
        const scan = token.scan
        const panes = token.tabs.map(tab => `<div data-tab="" data-line="${escapeAttribute(tab.line)}" data-gap="${tab.gap}"${tab.tight ? ' data-md-tight="true"' : ''}><div data-tab-name="">${escapeText(tabNameOf(tab.line))}</div><div data-tab-body="">${this.parser.parse(tab.tokens)}</div></div>`).join('')
        return `<div data-tabs="" data-open="${escapeAttribute(scan.openLine)}" data-close="${escapeAttribute(scan.closeLine)}" data-gap-open="${scan.gapOpen}" data-gap-close="${scan.gapClose}"${token.rmTight ? ' data-md-tight="true"' : ''}>${panes}</div>\n`
      },
      childTokens: ['tabs'],
    },
    {
      // Never read from the text: only a Tabs block makes one (so the walkers reach a pane's blocks).
      name: 'tabPane',
      level: 'block' as const,
      tokenizer: () => undefined,
      renderer: () => '',
      childTokens: ['tokens'],
    },
  ],
}

/** A string attribute read from and written to one `data-*` attribute. */
function stringAttribute(name: string, fallback: string | null) {
  const key = name.replace(/^data-/, '').replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase())
  return {
    default: fallback,
    parseHTML: (element: HTMLElement) => element.getAttribute(name) ?? fallback,
    renderHTML: (attrs: Record<string, unknown>) => (attrs[key] === null || attrs[key] === undefined ? {} : { [name]: String(attrs[key]) }),
  }
}

/** The Tabs block: its lines as written, and its panes. */
export const TabsBlock = Node.create({
  name: 'tabsBlock',
  group: 'block',
  content: 'tabPane+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      open: stringAttribute('data-open', TABSET_OPEN),
      close: stringAttribute('data-close', TABSET_CLOSE),
      gapOpen: stringAttribute('data-gap-open', 'false'),
      gapClose: stringAttribute('data-gap-close', 'true'),
      mdTight: stringAttribute('data-md-tight', null),
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-tabs]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-tabs': '' }, HTMLAttributes), 0]
  },
  addProseMirrorPlugins() {
    return [tabPaneHeadings()]
  },
})

/** One tab: its heading line as written (its name), and its pane's blocks. */
export const TabPane = Node.create({
  name: 'tabPane',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      line: stringAttribute('data-line', `${'#'.repeat(TAB_LEVEL)} Tab`),
      gap: stringAttribute('data-gap', 'true'),
      mdTight: stringAttribute('data-md-tight', null),
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-tab]', contentElement: 'div[data-tab-body]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    // The name is written out too, so a copied block reads as a heading per tab wherever it is pasted.
    return ['div', mergeAttributes({ 'data-tab': '' }, HTMLAttributes), ['div', { 'data-tab-name': '' }, tabNameOf(node.attrs.line)], ['div', { 'data-tab-body': '' }, 0]]
  },
})

const tabPaneHeadingsKey = new PluginKey('tabPaneHeadings')

/**
 * A heading at the tabs' own level as a pane's own block would read back as a new tab (a higher one is the pane's, as
 * the reader reads it): it is kept one level under the tabs' (a slide's "Heading" in a `##` block is an H3). Only a pane's own
 * blocks: a heading in a column or a list inside it is written inside its own lines.
 */
function tabPaneHeadings(): Plugin {
  return new Plugin({
    key: tabPaneHeadingsKey,
    appendTransaction(transactions, _old, state) {
      if (!transactions.some(tr => tr.docChanged)) return null
      const heading = state.schema.nodes.heading
      if (!heading) return null
      const tr = state.tr
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'tabsBlock') return true
        const level = tabsLevelOf(node)
        node.forEach((pane, paneOffset) => {
          pane.forEach((child, childOffset) => {
            if (child.type !== heading || child.attrs.level !== level) return
            tr.setNodeMarkup(pos + 1 + paneOffset + 1 + childOffset, undefined, { ...child.attrs, level: Math.min(6, level + 1) })
          })
        })
        return true
      })
      return tr.docChanged ? tr : null
    },
  })
}

/** A DOM node (this file's `Node` is TipTap's). */
type DomNode = globalThis.Node

const isTabsElement = (node: DomNode) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-tabs')
const isTabElement = (node: DomNode) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-tab')
const isTabNameElement = (node: DomNode) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-tab-name')

/** The line breaks around an element: tight with a neighbour only as written (`data-md-tight`). */
function spacing(element: HTMLElement): { lead: string; trail: string } {
  const lead = element.getAttribute('data-md-tight') === 'true' && element.previousElementSibling ? '\n' : '\n\n'
  const next = element.nextElementSibling
  const trail = next && next.getAttribute('data-md-tight') === 'true' ? '\n' : '\n\n'
  return { lead, trail }
}

/** A Tabs block as Markdown: its lines as written around its tabs. */
function tabsBlockMarkdown(content: string, element: HTMLElement): string {
  const open = element.getAttribute('data-open') ?? TABSET_OPEN
  const close = element.getAttribute('data-close') ?? TABSET_CLOSE
  const gapOpen = element.getAttribute('data-gap-open') === 'true' ? '\n' : ''
  const gapClose = element.getAttribute('data-gap-close') === 'true' ? '\n' : ''
  const inside = content.replace(/^\n+/, '').replace(/\n+$/, '')
  const { lead, trail } = spacing(element)
  if (!inside) return `${lead}${open}\n${gapOpen}${close}${trail}`
  return `${lead}${open}\n${gapOpen}${inside}\n${gapClose}${close}${trail}`
}

/** One tab as Markdown: its heading line, then its pane's blocks as Turndown wrote them. */
function tabPaneMarkdown(content: string, element: HTMLElement): string {
  const line = element.getAttribute('data-line') ?? `${'#'.repeat(TAB_LEVEL)} Tab`
  const gap = element.getAttribute('data-gap') !== 'false'
  const { lead, trail } = spacing(element)
  return `${lead}${tabMarkdown({ line, markdown: content, gap })}${trail}`
}

/** The Tabs block's save rules, on the Text editor's and the slide editor's Turndown alike. */
export function addTabsTurndownRules(service: TurndownService): void {
  service.addRule('tabName', {
    filter: node => isTabNameElement(node),
    replacement: () => '',
  })
  service.addRule('tabPane', {
    filter: node => isTabElement(node),
    replacement: (content, node) => tabPaneMarkdown(content, node as HTMLElement),
  })
  service.addRule('tabsBlock', {
    filter: node => isTabsElement(node),
    replacement: (content, node) => tabsBlockMarkdown(content, node as HTMLElement),
  })
}
