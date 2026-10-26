/**
 * Markdown as written (Sprint 137, #270): the parse remembers how a block was
 * written, and the save writes it that way.
 *
 * Three parts, all here:
 *
 *  1. **The parse.** `marked` renderer extensions read each token's raw text and
 *     put `data-md-*` attributes on the HTML: a list's marker, delimiter,
 *     spacing and indent; each item's blank lines; whether a block follows the
 *     one before it with no blank line; a line break's form; a thematic break's
 *     marker; a bare or `<…>` web address; a table's delimiter row and spacing;
 *     a code fence's info string. `annotateAsWritten` adds what needs sibling
 *     context or the whole source (tab-indented lists) before `marked` renders.
 *  2. **The nodes.** `MarkdownAsWritten` (editorMarkdown.ts) gives TipTap's
 *     nodes and marks those attributes, data only: nothing styles them, so the
 *     editor looks the same.
 *     Each value is a pure function of the source, so a host update's parse
 *     equals the editor's document wherever nothing changed.
 *  3. **The save.** `addAsWrittenTurndownRules` writes by the attributes. Where
 *     one is absent, because the person typed something new, the rules write one
 *     plain form: `- item` and `1. item`, tight, `---`, a backslash line break,
 *     a blank line between blocks.
 *
 * Nothing here changes what the editor shows or how it reads Markdown (spec R7):
 * the HTML `marked` makes is the same apart from the added attributes.
 */
import type TurndownService from 'turndown'
import type { MarkedExtension, Token, Tokens } from 'marked'

// ---------------------------------------------------------------------------
// 1. The parse
// ---------------------------------------------------------------------------

/** A list line that begins with a tab: Obsidian indents nested lists with tabs. */
const LIST_LINE_WITH_TAB = /^\t+(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/m

/** A list item's first line: indent, marker (and an ordered list's delimiter), and the spaces after it. */
const LIST_ITEM_HEAD = /^( *)([-*+]|\d{1,9}([.)]))( *)/

/**
 * A tab at the start of a line inside a top-level code fence. `marked` turns
 * every leading tab into four spaces before it reads the source; inside a fence
 * that changes the code (R3: fenced code is left exactly as written, S16).
 */
const FENCE_TAB = '\uE002'

/**
 * Keep the leading tabs of the lines inside top-level fences (an opening
 * fence at column 0) away from `marked`'s tab expansion; the code renderer puts
 * them back. Lines outside fences are untouched: there a leading tab is
 * indentation, and `marked` must see it as such.
 */
export function protectFenceTabs(source: string): string {
  if (!source.includes('\t')) return source
  const lines = source.split('\n')
  let fence: RegExp | null = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!fence) {
      const open = /^(`{3,}|~{3,})(.*)$/.exec(line)
      if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
        fence = new RegExp(`^ {0,3}\\${open[1][0]}{${open[1].length},}[ \\t]*$`)
      }
      continue
    }
    if (fence.test(line)) {
      fence = null
      continue
    }
    lines[index] = line.replace(/^\t+/, tabs => FENCE_TAB.repeat(tabs.length))
  }
  return lines.join('\n')
}

/** Raw text that ends in a blank line. */
const ENDS_WITH_BLANK_LINE = /\n[ \t]*\n[ \t]*$/

/** What the walk adds to a block token. */
interface AsWrittenToken {
  /** No blank line between this block and the one before it. */
  rmTight?: boolean
  /** A list in a document that indents nested lists with tabs. */
  rmTabs?: boolean
}

/**
 * Mark what needs sibling context or the whole source, before `marked`
 * renders. Every block array is visited: the top level, quotes and list items.
 */
export function annotateAsWritten(tokens: Token[], source: string): void {
  walkBlocks(tokens, LIST_LINE_WITH_TAB.test(source))
}

function walkBlocks(tokens: Token[], tabs: boolean): void {
  tokens.forEach((token, index) => {
    const block = token as Token & AsWrittenToken
    const previous = tokens[index - 1]
    // The block comes straight after the one before it: no `space` token
    // between, and no blank line at the end of the earlier block's raw text
    // (a heading or a rule keeps its trailing blank line in its raw).
    block.rmTight = !!previous && previous.type !== 'space' && !ENDS_WITH_BLANK_LINE.test(previous.raw)
    if (token.type === 'list') {
      block.rmTabs = tabs
      for (const item of (token as Tokens.List).items) walkBlocks(item.tokens, tabs)
    } else if (token.type === 'blockquote') {
      walkBlocks((token as Tokens.Blockquote).tokens, tabs)
    }
  })
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function attributes(values: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) => ` ${name}="${escapeAttribute(String(value))}"`)
    .join('')
}

/** Add attributes to the first tag of `html`, which must start with `<tag`. */
function withAttributes(html: string, tag: string, extra: string): string {
  return extra && html.startsWith(`<${tag}`) ? `<${tag}${extra}${html.slice(tag.length + 1)}` : html
}

function tightAttribute(token: Token): string | undefined {
  return (token as Token & AsWrittenToken).rmTight ? 'true' : undefined
}

function listAttributes(list: Tokens.List & AsWrittenToken): string {
  const head = LIST_ITEM_HEAD.exec(list.items[0]?.raw ?? '')
  const indent = head ? head[1].length : 0
  const marker = head?.[2]
  const spaces = head?.[4].length ?? 1
  // Four spaces or fewer after the marker are the marker's padding; more make
  // the content an indented code block, and an empty first item has none.
  const firstLine = (list.items[0]?.raw ?? '').split('\n', 1)[0]
  const pad = head && firstLine.length > head[0].length && spaces >= 1 && spaces <= 4 ? spaces : 1
  return attributes({
    'data-md-marker': list.ordered ? undefined : marker,
    'data-md-delim': list.ordered ? head?.[3] : undefined,
    'data-md-pad': pad,
    'data-md-indent': indent || undefined,
    'data-md-tabs': list.rmTabs || undefined,
    'data-md-tight': tightAttribute(list),
  })
}

function itemAttributes(list: Tokens.List, index: number): string {
  const items = list.items
  const item = items[index]
  // The last item has no next item: it takes the list's separator, so an item
  // added after it (Enter, which keeps the item's attributes) follows the list.
  const gap = index < items.length - 1
    ? ENDS_WITH_BLANK_LINE.test(item.raw)
    : items.length > 1
      ? ENDS_WITH_BLANK_LINE.test(items[index - 1].raw)
      : false
  return attributes({
    'data-md-gap': gap ? 'true' : 'false',
    'data-md-inner': innerBlankLines(item),
  })
}

/**
 * Between an item's own blocks (its text, a nested list, a code fence, a second
 * paragraph): `1` where a blank line separates two of them, `0` where none
 * does, one digit per boundary in order. Consecutive text tokens are one
 * paragraph in the editor, as marked's parser joins them.
 */
function innerBlankLines(item: Tokens.ListItem): string {
  let mask = ''
  let seenBlock = false
  let blankBefore = false
  let previousWasText = false
  for (const token of item.tokens) {
    if (token.type === 'space') {
      blankBefore = true
      continue
    }
    const isText = token.type === 'text'
    if (seenBlock && !(isText && previousWasText && !blankBefore)) mask += blankBefore ? '1' : '0'
    seenBlock = true
    previousWasText = isText
    blankBefore = false
  }
  return mask
}

/** The form of a line break, from its raw text: `soft`, `backslash` or `spaces-N`. */
export function breakForm(raw: string): string {
  if (/\\\n$/.test(raw)) return 'backslash'
  const spaces = /( *)\n$/.exec(raw)?.[1].length ?? 0
  return spaces === 0 ? 'soft' : `spaces-${spaces}`
}

/**
 * The delimiter row exactly as written (`|---|---|`, `| :-- | --: |`), and
 * whether the header row pads its cells with a space. The two often differ:
 * `| Name | Qty |` over `|---|---|` is the common form.
 */
function tableForm(raw: string): { delimiterRow: string; spacing: 'spaced' | 'compact' } | null {
  const [headerRow, delimiterRow] = raw.split('\n')
  if (!headerRow || !delimiterRow) return null
  const header = headerRow.trim()
  const delimiter = delimiterRow.trim()
  // Tables without outer pipes are outside the bound: no attributes, default form.
  if (!header.startsWith('|') || !header.endsWith('|') || !delimiter.startsWith('|') || !delimiter.endsWith('|')) return null
  const delims = delimiter.slice(1, -1).split('|').map(cell => cell.trim())
  if (!delims.every(cell => /^:?-+:?$/.test(cell))) return null
  const spacing = /^\|[ \t]/.test(header) ? 'spaced' : 'compact'
  return { delimiterRow: delimiter, spacing }
}

/**
 * The `marked` extension that records how blocks were written. Each renderer
 * produces exactly the HTML `marked` 9.1.6 would, plus `data-md-*` attributes.
 */
export const asWrittenMarkedExtension: MarkedExtension = {
  extensions: [
    {
      name: 'list',
      renderer(token) {
        // marked's own list rendering (Parser.parse, case 'list'), with
        // attributes on the list and on each of its items.
        const list = token as Tokens.List & AsWrittenToken
        const parser = this.parser
        const loose = list.loose
        let body = ''
        list.items.forEach((item, index) => {
          const checked = item.checked
          const task = item.task
          let itemBody = ''
          if (item.task) {
            const checkbox = parser.renderer.checkbox(!!checked)
            if (loose) {
              if (item.tokens.length > 0 && item.tokens[0].type === 'paragraph') {
                const paragraph = item.tokens[0] as Tokens.Paragraph
                paragraph.text = checkbox + ' ' + paragraph.text
                if (paragraph.tokens && paragraph.tokens.length > 0 && paragraph.tokens[0].type === 'text') {
                  (paragraph.tokens[0] as Tokens.Text).text = checkbox + ' ' + (paragraph.tokens[0] as Tokens.Text).text
                }
              } else {
                item.tokens.unshift({ type: 'text', text: checkbox + ' ' } as Tokens.Text)
              }
            } else {
              itemBody += checkbox + ' '
            }
          }
          itemBody += parser.parse(item.tokens, loose)
          body += withAttributes(parser.renderer.listitem(itemBody, task, !!checked), 'li', itemAttributes(list, index))
        })
        const html = parser.renderer.list(body, list.ordered, list.start)
        return withAttributes(html, list.ordered ? 'ol' : 'ul', listAttributes(list))
      },
    },
    {
      name: 'paragraph',
      renderer(token) {
        const paragraph = token as Tokens.Paragraph
        const html = this.parser.renderer.paragraph(this.parser.parseInline(paragraph.tokens))
        return withAttributes(html, 'p', attributes({ 'data-md-tight': tightAttribute(token) }))
      },
    },
    {
      name: 'heading',
      renderer(token) {
        const heading = token as Tokens.Heading
        const html = this.parser.renderer.heading(this.parser.parseInline(heading.tokens), heading.depth, heading.text)
        return withAttributes(html, `h${heading.depth}`, attributes({ 'data-md-tight': tightAttribute(token) }))
      },
    },
    {
      name: 'blockquote',
      renderer(token) {
        const quote = token as Tokens.Blockquote
        const html = this.parser.renderer.blockquote(this.parser.parse(quote.tokens))
        return withAttributes(html, 'blockquote', attributes({ 'data-md-tight': tightAttribute(token) }))
      },
    },
    {
      name: 'hr',
      renderer(token) {
        return withAttributes(this.parser.renderer.hr(), 'hr', attributes({
          'data-md-hr': token.raw.trim(),
          'data-md-tight': tightAttribute(token),
        }))
      },
    },
    {
      name: 'code',
      renderer(token) {
        const code = token as Tokens.Code
        if (code.codeBlockStyle === 'indented') return false
        // The info string as written after the fence (often empty).
        const info = /^ {0,3}(`{3,}|~{3,})([^\n]*)/.exec(code.raw)?.[2].trim() ?? ''
        const html = this.parser.renderer.code(code.text.replace(/\uE002/g, '\t'), code.lang, !!code.escaped)
        return withAttributes(html, 'pre', attributes({
          'data-md-info': info === '' ? 'none' : info,
          'data-md-tight': tightAttribute(token),
        }))
      },
    },
    {
      name: 'table',
      renderer(token) {
        // marked's own table rendering, with the delimiter row and the cell
        // spacing on the table.
        const table = token as Tokens.Table
        const parser = this.parser
        let cell = ''
        for (let j = 0; j < table.header.length; j++) {
          cell += parser.renderer.tablecell(parser.parseInline(table.header[j].tokens), { header: true, align: table.align[j] })
        }
        const header = parser.renderer.tablerow(cell)
        let body = ''
        for (const row of table.rows) {
          cell = ''
          for (let k = 0; k < row.length; k++) {
            cell += parser.renderer.tablecell(parser.parseInline(row[k].tokens), { header: false, align: table.align[k] })
          }
          body += parser.renderer.tablerow(cell)
        }
        const html = parser.renderer.table(header, body)
        const form = tableForm(table.raw)
        return withAttributes(html, 'table', attributes({
          'data-md-delims': form?.delimiterRow,
          'data-md-spacing': form?.spacing,
          'data-md-tight': tightAttribute(token),
        }))
      },
    },
    {
      name: 'br',
      renderer(token) {
        return withAttributes(this.parser.renderer.br(), 'br', attributes({ 'data-md-break': breakForm(token.raw) }))
      },
    },
    {
      name: 'link',
      renderer(token) {
        const link = token as Tokens.Link
        // `[text](url)` is the default form; only bare and `<…>` addresses are recorded.
        if (link.raw.startsWith('[') || link.raw.startsWith('!')) return false
        const html = this.parser.renderer.link(link.href, link.title ?? null, this.parser.parseInline(link.tokens))
        return withAttributes(html, 'a', attributes({ 'data-md-link': link.raw.startsWith('<') ? 'angle' : 'bare' }))
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// 2. The nodes: `MarkdownAsWritten` in editorMarkdown.ts gives TipTap's nodes
//    and marks these attributes. It lives with the schema, so the Office
//    preview bundle (Save as Markdown uses the rules below) carries no TipTap.
// ---------------------------------------------------------------------------

/** The attribute names (TipTap's are camel case: `mdMarker` for `data-md-marker`). */
export const AS_WRITTEN_ATTRIBUTES = {
  list: ['data-md-marker', 'data-md-delim', 'data-md-pad', 'data-md-indent', 'data-md-tabs', 'data-md-continues'],
  item: ['data-md-gap', 'data-md-inner'],
  hardBreak: ['data-md-break'],
  horizontalRule: ['data-md-hr'],
  link: ['data-md-link'],
  table: ['data-md-delims', 'data-md-spacing'],
  codeBlock: ['data-md-info'],
  /** No blank line between a block and the one before it. */
  tight: ['data-md-tight'],
} as const

/** The blocks that can follow the block before them with no blank line, as written. */
export const TIGHT_BLOCKS = ['paragraph', 'heading', 'codeBlock', 'blockquote', 'table', 'horizontalRule', 'image', 'bulletList', 'orderedList', 'taskList']

// ---------------------------------------------------------------------------
// 3. The save: escapes
// ---------------------------------------------------------------------------

/**
 * The block-level escapes Turndown applies at the start of every text run,
 * moved to where they matter: the start of a line (R4). A line that opens a
 * block — the first line of a paragraph — escapes what would start a block
 * there. A later line of the same paragraph escapes only what can interrupt a
 * paragraph: an ordered list must start at 1 to do that, and an empty item
 * cannot (CommonMark §5.2, §5.3).
 */
export function escapeLineStart(line: string, opensBlock: boolean): string {
  const lead = /^ {0,3}/.exec(line)?.[0] ?? ''
  const rest = line.slice(lead.length)
  // Thematic breaks and setext underlines: a line of only `-`, `_` or `=`.
  if (/^(?:-[ \t]*){3,}$/.test(rest) || /^(?:=+|-+)[ \t]*$/.test(rest)) {
    return lead + '\\' + rest
  }
  // A bullet: `-` or `+` and a space, or alone (`*` is escaped everywhere).
  if (/^[-+](?=[ \t]|$)/.test(rest) && (opensBlock || /^[-+][ \t]+\S/.test(rest))) return lead + '\\' + rest
  // An ATX heading.
  if (/^#{1,6}(?=[ \t]|$)/.test(rest)) return lead + '\\' + rest
  // A quote.
  if (rest.startsWith('>')) return lead + '\\' + rest
  // A code fence (backticks are escaped everywhere).
  if (rest.startsWith('~~~')) return lead + '\\' + rest
  // An ordered list item.
  const ordered = /^(\d{1,9})([.)])(?=[ \t]|$)/.exec(rest)
  if (ordered && (opensBlock || (Number(ordered[1]) === 1 && /^\d{1,9}[.)][ \t]+\S/.test(rest)))) {
    return lead + ordered[1] + '\\' + rest.slice(ordered[1].length)
  }
  return line
}

/** Escape the start of every line of a paragraph's Markdown; the first line opens the block. */
export function escapeLineStarts(markdown: string): string {
  return markdown.split('\n').map((line, index) => escapeLineStart(line, index === 0)).join('\n')
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/**
 * Turndown's text escaper, minus what this sprint moves or narrows (R4):
 *  - the line-start escapes (`-`, `+`, `=`, `#`, `>`, `1.`) move to
 *    `escapeLineStarts`; `~~~` keeps Turndown's run-start escape;
 *  - an underscore between letters or digits stays bare: CommonMark never
 *    reads an underscore inside a word as emphasis;
 *  - a square bracket stays bare unless its block's text holds `](`, `][` or
 *    `]:`, the only ways a bracket in plain text could become a link or a
 *    definition; then each `[` is escaped, which is enough. The block's text,
 *    not the run's: a mark can split the brackets (`neutraliseBrackets` turns
 *    them into placeholders before Turndown runs, and they are written escaped
 *    here). Without that pass (no DOM), the run's own text is checked.
 *  - a `<` that would open an HTML tag, a comment or an autolink (`<string>`,
 *    `<!--`, `<https://…>`) is escaped: unescaped, the next open reads it as
 *    HTML and the editor drops it with its text;
 *  - a backslash is escaped only where it would escape what follows it: before
 *    ASCII punctuation, or at the end of the run (the next run, or a line
 *    break, follows it). `C:\Users\me` stays as written (CommonMark §2.4).
 * `*` and backticks keep today's escaping.
 */
export function escapeTextRun(text: string): string {
  let escaped = text
    .replace(/\\(?=[!-\/:-@[-`{-~]|$)/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/^~~~/, '\\~~~')
    .replace(/<(?=[A-Za-z\/!?])/g, '\\<')
  escaped = escaped.replace(/_/g, (match: string, offset: number, whole: string) => {
    const before = whole[offset - 1]
    const after = whole[offset + 1]
    return before && after && LETTER_OR_DIGIT.test(before) && LETTER_OR_DIGIT.test(after) ? match : '\\_'
  })
  if (/\][([:]/.test(text)) escaped = escaped.replace(/\[/g, '\\[')
  return escaped.replace(//g, '\\[').replace(//g, '\\]')
}

/** A bracket `neutraliseBrackets` marked for escaping; `escapeTextRun` writes it `\[` or `\]`. */
const OPEN_BRACKET = ''
const CLOSE_BRACKET = ''

/** Elements that sit inside a line of text: their text belongs to the block around them. */
const INLINE_ELEMENTS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'DATA', 'DEL', 'DFN', 'EM', 'FONT', 'I', 'IMG', 'INPUT', 'INS',
  'KBD', 'LABEL', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR',
  'WBR',
])

/**
 * Brackets a mark splits (R6: nothing is lost). Turndown escapes one text run
 * at a time, but a link or a definition can be made of several runs:
 * `[` + **x** + `]: y` writes `[**x**]: y`, which the next open reads as a
 * link-reference definition, and the paragraph is gone; `[` + **a** + `](b)`
 * reopens as a link. So the check reads each block's text as a whole: when it
 * holds `](`, `][` or `]:`, every `[` in the block's text is escaped, in
 * whichever run it is. Inside a link every bracket is escaped, since the
 * link's own `[…]` would otherwise end early or nest. Code is literal and left
 * alone, in the check too.
 *
 * Runs on a DOM before Turndown; the brackets become placeholders that
 * `escapeTextRun` writes escaped. Idempotent.
 */
export function neutraliseBrackets(root: Node): void {
  const blocks = new Map<Node, Text[]>()
  const collect = (node: Node, block: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const runs = blocks.get(block) ?? []
        runs.push(child as Text)
        blocks.set(block, runs)
      } else if (child.nodeType === 1 && child.nodeName !== 'CODE' && child.nodeName !== 'PRE') {
        collect(child, INLINE_ELEMENTS.has(child.nodeName) ? block : child)
      }
    }
  }
  collect(root, root)
  for (const runs of blocks.values()) {
    const opensSomething = /\][([:]/.test(runs.map(run => run.nodeValue ?? '').join(''))
    for (const run of runs) {
      const value = run.nodeValue ?? ''
      if (!/[[\]]/.test(value)) continue
      if (insideLink(run)) {
        run.nodeValue = value.replace(/\[/g, OPEN_BRACKET).replace(/\]/g, CLOSE_BRACKET)
      } else if (opensSomething) {
        run.nodeValue = value.replace(/\[/g, OPEN_BRACKET)
      }
    }
  }
}

function insideLink(node: Node): boolean {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === 'A') return true
  }
  return false
}

/** Text as the author wrote it, for rules that compare it (a bare address). */
function restoreBrackets(text: string): string {
  return text.replace(//g, '[').replace(//g, ']')
}

// ---------------------------------------------------------------------------
// 3. The save: blocks and the blank lines between them
// ---------------------------------------------------------------------------

/** Element children of `node`, of one tag name when given. */
function childElements(node: Element, name?: string): HTMLElement[] {
  return Array.from(node.childNodes).filter(
    (child): child is HTMLElement => child.nodeType === 1 && (!name || child.nodeName === name),
  )
}

function isList(node: Node | null | undefined): node is HTMLUListElement | HTMLOListElement {
  return !!node && (node.nodeName === 'UL' || node.nodeName === 'OL')
}

function hasListItemAncestor(node: Node): boolean {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === 'LI') return true
  }
  return false
}

type BlockKind = 'paragraph' | 'heading' | 'code' | 'quote' | 'table' | 'rule' | 'list' | 'other'

function blockKind(node: Element): BlockKind {
  switch (node.nodeName) {
    case 'P': case 'IMG': return 'paragraph'
    case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': return 'heading'
    case 'PRE': return 'code'
    case 'BLOCKQUOTE': return 'quote'
    case 'TABLE': return 'table'
    case 'HR': return 'rule'
    case 'UL': case 'OL': return 'list'
    default: return 'other'
  }
}

/**
 * Whether `next` is written on the line straight after `previous`, with no
 * blank line: only when the source wrote it so (`data-md-tight`), and only
 * when that cannot change what either block is — the two blocks may have
 * changed, or have new neighbours, since the file was read. A paragraph, a
 * list, a quote or a table goes on taking lines until a blank line or a
 * block that can interrupt it (CommonMark §4.8, §5.1, §5.2; GFM tables).
 */
function writtenTight(previous: Element | null, next: Element): boolean {
  if (!previous || next.getAttribute('data-md-tight') !== 'true') return false
  const before = blockKind(previous)
  const after = blockKind(next)
  if (before === 'other' || after === 'other') return false
  if (before === 'heading' || before === 'code' || before === 'rule') return true
  if (after === 'heading' || after === 'code') return true
  if (after === 'rule') return before !== 'paragraph' || !(next.getAttribute('data-md-hr') ?? '-').startsWith('-')
  if (before === 'paragraph') {
    if (after === 'quote' || after === 'table') return true
    // A list interrupts a paragraph only with a first item, and an ordered one only from 1.
    if (after === 'list') return !(next.nodeName === 'OL' && Number(next.getAttribute('start') || 1) !== 1) && childElements(next, 'LI').length > 0
  }
  return false
}

/** The newlines before a top-level block. */
function blockLeading(node: Element): string {
  if (isList(node) && node.getAttribute('data-md-continues') === 'true' && isList(node.previousElementSibling)) return '\n'
  return writtenTight(node.previousElementSibling, node) ? '\n' : '\n\n'
}

/** The newlines after a top-level block. */
function blockTrailing(node: Element): string {
  const next = node.nextElementSibling
  if (!next) return '\n\n'
  if (isList(node) && isList(next) && next.getAttribute('data-md-continues') === 'true') return lastItemGap(node) ? '\n\n' : '\n'
  return writtenTight(node, next) ? '\n' : '\n\n'
}

/** Is this the document's first block? Turndown's root for a string is `x-turndown`. */
function isFirstBlock(node: Element): boolean {
  return !node.previousElementSibling && node.parentNode?.nodeName === 'X-TURNDOWN'
}

/** Is this image a block of its own (TipTap's block image), not inline in text? */
function isBlockImage(image: Element): boolean {
  const parent = image.parentNode
  return !!parent && /^(X-TURNDOWN|BODY|DIV|BLOCKQUOTE|LI|SECTION|ARTICLE)$/.test(parent.nodeName)
}

/** The image rule's Markdown, on lines of its own when the image is a block (R6: images in a row). */
export function blockImage(markdown: string, image: Element): string {
  return isBlockImage(image) ? blockLeading(image) + markdown + blockTrailing(image) : markdown
}

// ---------------------------------------------------------------------------
// 3. The save: lists
// ---------------------------------------------------------------------------

interface ItemBlock {
  kind: 'paragraph' | 'list' | 'code' | 'quote' | 'other'
  markdown: string
  /** A list that continues the list before it (a split task list). */
  continues?: boolean
  /** A list's last item has a blank line after it. */
  lastGap?: boolean
}

/**
 * Markdown for one block, through the service's own rules: a clone of the node
 * in a wrapper, so the node's own rule runs (a paragraph's, a quote's, a code
 * block's). `turndown()` trims the result.
 */
function blockMarkdown(service: TurndownService, node: Node): string {
  const wrapper = (node.ownerDocument as Document).createElement('div')
  wrapper.appendChild(node.cloneNode(true))
  return service.turndown(wrapper)
}

function isTaskItem(item: HTMLElement): boolean {
  return item.getAttribute('data-type') === 'taskItem'
}

/** `checked`, `unchecked`, or null for an item that is not a task. */
function taskState(item: HTMLElement): 'checked' | 'unchecked' | null {
  if (isTaskItem(item)) return item.getAttribute('data-checked') === 'true' ? 'checked' : 'unchecked'
  const first = Array.from(item.childNodes).find(child => child.nodeType !== 3 || child.nodeValue?.trim())
  if (first && first.nodeName === 'INPUT' && (first as HTMLInputElement).getAttribute('type') === 'checkbox') {
    return (first as HTMLInputElement).hasAttribute('checked') ? 'checked' : 'unchecked'
  }
  return null
}

/** The nodes that hold an item's content: TipTap's task item wraps it in a `div` after its label. */
function itemContent(item: HTMLElement): Node[] {
  if (isTaskItem(item)) {
    const container = childElements(item, 'DIV')[0]
    if (container) return Array.from(container.childNodes)
  }
  return Array.from(item.childNodes).filter(child =>
    child.nodeName !== 'LABEL' &&
    !(child.nodeName === 'INPUT' && (child as HTMLInputElement).getAttribute('type') === 'checkbox'),
  )
}

const ITEM_BLOCK_ELEMENTS = /^(P|UL|OL|PRE|BLOCKQUOTE|TABLE|HR|H[1-6]|DIV|IMG|RITEMARK-COMMENT)$/

function itemBlocks(service: TurndownService, item: HTMLElement): ItemBlock[] {
  const blocks: ItemBlock[] = []
  let inline: Node[] = []
  const document = item.ownerDocument as Document
  const flushInline = () => {
    if (inline.some(node => node.nodeType !== 3 || node.nodeValue?.trim())) {
      // Text straight in an item (HTML that is not TipTap's): a paragraph.
      const paragraph = document.createElement('p')
      for (const node of inline) paragraph.appendChild(node.cloneNode(true))
      blocks.push({ kind: 'paragraph', markdown: blockMarkdown(service, paragraph) })
    }
    inline = []
  }
  for (const child of itemContent(item)) {
    if (child.nodeType !== 1 || !ITEM_BLOCK_ELEMENTS.test(child.nodeName)) {
      inline.push(child)
      continue
    }
    flushInline()
    const element = child as HTMLElement
    if (isList(element)) {
      const previous = blocks[blocks.length - 1]
      blocks.push({
        kind: 'list',
        markdown: serializeList(service, element),
        continues: element.getAttribute('data-md-continues') === 'true' && previous?.kind === 'list',
        lastGap: lastItemGap(element),
      })
    } else {
      const kind = element.nodeName === 'P' ? 'paragraph' : element.nodeName === 'PRE' ? 'code' : element.nodeName === 'BLOCKQUOTE' ? 'quote' : 'other'
      blocks.push({ kind, markdown: blockMarkdown(service, element) })
    }
  }
  flushInline()
  return blocks
}

function lastItemGap(list: Element): boolean {
  const items = childElements(list, 'LI')
  return items[items.length - 1]?.getAttribute('data-md-gap') === 'true'
}

/**
 * Join an item's blocks, with the blank lines between them as written
 * (`data-md-inner`, one digit per boundary). Without a blank line only where
 * that keeps the blocks apart: the item's text and what interrupts it (a nested
 * list, a code fence, a quote), and anything straight after a closed code
 * fence; everything else would merge into the block before it. A boundary the
 * source did not have (new writing) takes the same tight form where it can.
 */
function joinBlocks(blocks: ItemBlock[], innerMask: string): string {
  let markdown = ''
  blocks.forEach((block, index) => {
    if (index === 0) {
      markdown = block.markdown
      return
    }
    const previous = blocks[index - 1]
    const blank = innerMask[index - 1] === '1'
    const tightAllowed = (previous.kind === 'paragraph' && (block.kind === 'list' || block.kind === 'code' || block.kind === 'quote'))
      || (previous.kind === 'code' && block.kind !== 'other')
    let separator: string
    if (block.kind === 'list' && block.continues) {
      separator = previous.lastGap ? '\n\n' : '\n'
    } else if (!blank && tightAllowed) {
      separator = '\n'
    } else {
      separator = '\n\n'
    }
    markdown += separator + block.markdown
  })
  return markdown
}

/** Indent every line after the first; an empty line stays empty (R3). */
function indentContinuation(markdown: string, indent: string): string {
  return markdown.split('\n').map((line, index) => index === 0 || line === '' ? line : indent + line).join('\n')
}

function indentAll(markdown: string, indent: string): string {
  return markdown.split('\n').map(line => line === '' ? line : indent + line).join('\n')
}

/** Whether an item holds two paragraph-like blocks, which only a loose list can hold. */
function holdsTwoParagraphs(blocks: ItemBlock[]): boolean {
  return blocks.some((block, index) => index > 0 && (block.kind === 'paragraph' || block.kind === 'other'))
}

/**
 * Write a list as it was written: its marker, the spaces after it, each item's
 * blank lines, its nested lists' indent (spaces, or a tab per level). Without
 * attributes: `- ` or `1. `, tight unless an item holds two paragraphs, nested
 * content at the item's content column (R8).
 */
export function serializeList(service: TurndownService, list: HTMLElement): string {
  const ordered = list.nodeName === 'OL'
  const marker = list.getAttribute('data-md-marker') || '-'
  const delimiter = list.getAttribute('data-md-delim') || '.'
  const padAttribute = Number(list.getAttribute('data-md-pad'))
  const pad = padAttribute >= 1 && padAttribute <= 4 ? padAttribute : 1
  const start = ordered ? Number(list.getAttribute('start') || 1) : 0
  const tabs = list.getAttribute('data-md-tabs') === 'true'
  const items = childElements(list, 'LI')
  const blocksPerItem = items.map(item => itemBlocks(service, item))
  const loose = blocksPerItem.some(holdsTwoParagraphs)

  let markdown = ''
  items.forEach((item, index) => {
    const head = ordered ? `${start + index}${delimiter}` : marker
    const prefix = head + ' '.repeat(pad)
    // The blank lines between the item's own blocks, as written; two
    // paragraphs always get one (joinBlocks).
    let body = joinBlocks(blocksPerItem[index], item.getAttribute('data-md-inner') ?? '')
    const task = taskState(item)
    if (task) {
      const box = task === 'checked' ? '[x]' : '[ ]'
      // `- [ ]` alone: a trailing space does not survive, and the bare marker
      // reads back as an empty task (`leadingTaskMarker`).
      body = body ? `${box} ${body}` : box
    } else if (/^\[[ xX]\](?:[ \t]|$)/.test(body)) {
      // A plain item whose text starts like a task marker keeps its escape.
      body = '\\' + body
    }
    const text = indentContinuation(body, tabs ? '\t' : ' '.repeat(prefix.length))
    // An empty item is its marker alone: no trailing space (R3).
    markdown += text ? prefix + text : head
    if (index < items.length - 1) {
      const gapAttribute = item.getAttribute('data-md-gap')
      const gap = gapAttribute === null ? loose : gapAttribute === 'true'
      markdown += gap ? '\n\n' : '\n'
    }
  })
  const extraIndent = Number(list.getAttribute('data-md-indent'))
  return extraIndent > 0 && !tabs ? indentAll(markdown, ' '.repeat(extraIndent)) : markdown
}

// ---------------------------------------------------------------------------
// 3. The save: the rules
// ---------------------------------------------------------------------------

function cellMarkdown(content: string): string {
  return content.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

const CELL_OPEN = '\uE000'
const CELL_CLOSE = '\uE001'

function alignDelimiter(align: string | null): string {
  switch ((align || '').toLowerCase()) {
    case 'left': return ':---'
    case 'right': return '---:'
    case 'center': return ':---:'
    default: return '---'
  }
}

/** A table row is the heading row when it is the first row and all its cells are `th` (GFM plugin's test). */
function isHeadingRow(row: Element): boolean {
  const parent = row.parentNode as Element
  if (parent.nodeName === 'THEAD') return true
  const firstRow = childElements(parent, 'TR')[0] === row
  const firstSection = parent.nodeName === 'TABLE' || (parent.nodeName === 'TBODY' && !parent.previousElementSibling)
  return firstRow && firstSection && childElements(row).every(cell => cell.nodeName === 'TH')
}

/** Is there text or an element after `node` inside its block (paragraph, heading or cell)? */
function hasContentAfter(node: Element): boolean {
  for (let current: Node | null = node; current && !/^(P|H[1-6]|TD|TH|LI|BLOCKQUOTE|DIV|X-TURNDOWN|BODY)$/.test(current.nodeName); current = current.parentNode) {
    for (let next = current.nextSibling; next; next = next.nextSibling) {
      if (next.nodeType === 1 || (next.nodeType === 3 && next.nodeValue?.trim())) return true
    }
  }
  return false
}

function insideTableCell(node: Node): boolean {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === 'TD' || parent.nodeName === 'TH') return true
  }
  return false
}

/**
 * Wrap a run of inline Markdown in a mark's delimiters, with the line breaks at
 * its edges outside them: `**` cannot close after a `\` break, so a bold run
 * that starts or ends with a break would not be bold on reopen. A run that is
 * only breaks gets no delimiters.
 */
export function wrapMarked(content: string, delimiter: string): string {
  const match = /^((?:\\?\n| +\n)*)([\s\S]*?)((?:\\?\n| +\n)*)$/.exec(content)
  const [lead, middle, trail] = match ? [match[1], match[2], match[3]] : ['', content, '']
  if (!middle.trim()) return lead + trail
  return lead + delimiter + middle + delimiter + trail
}

function escapeLinkDestination(destination: string): string {
  const escaped = destination.replace(/([<>()])/g, '\\$1')
  return escaped.indexOf(' ') >= 0 ? '<' + escaped + '>' : escaped
}

/**
 * The rules that write by the as-written attributes, with R8's plain forms as
 * their defaults. Added after Turndown's and the GFM plugin's, so they win.
 */
export function addAsWrittenTurndownRules(service: TurndownService): void {
  service.addRule('asWrittenParagraph', {
    filter: 'p',
    replacement(content, node) {
      return blockLeading(node as Element) + escapeLineStarts(content) + blockTrailing(node as Element)
    },
  })

  service.addRule('asWrittenHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement(content, node) {
      const level = Number(node.nodeName.charAt(1))
      return blockLeading(node as Element) + '#'.repeat(level) + ' ' + content + blockTrailing(node as Element)
    },
  })

  service.addRule('asWrittenList', {
    filter: ['ul', 'ol'],
    replacement(_content, node) {
      const list = node as HTMLElement
      // A nested list is written by the item that holds it.
      if (hasListItemAncestor(list)) return ''
      return blockLeading(list) + serializeList(service, list) + blockTrailing(list)
    },
  })

  service.addRule('asWrittenBlockquote', {
    filter: 'blockquote',
    replacement(content, node) {
      const body = content.replace(/^\n+/, '').replace(/\n+$/, '')
      // An empty line inside a quote is `>` alone (R3).
      const quoted = body.split('\n').map(line => line ? `> ${line}` : '>').join('\n')
      return blockLeading(node as Element) + quoted + blockTrailing(node as Element)
    },
  })

  service.addRule('asWrittenBreak', {
    filter: 'br',
    replacement(_content, node) {
      const element = node as Element
      // A break with nothing after it in its block has no Markdown form; it
      // would be a literal backslash or trailing spaces.
      if (!hasContentAfter(element)) return ''
      // A line break inside a table cell would end the row.
      if (insideTableCell(element)) return '<br>'
      const form = element.getAttribute('data-md-break')
      if (form === 'soft') return '\n'
      const spaces = /^spaces-(\d+)$/.exec(form ?? '')
      if (spaces) return ' '.repeat(Number(spaces[1])) + '\n'
      // `backslash`, and every break typed in Ritemark (R2, decision 3).
      return '\\\n'
    },
  })

  service.addRule('asWrittenHorizontalRule', {
    filter: 'hr',
    replacement(_content, node) {
      const element = node as Element
      const written = element.getAttribute('data-md-hr')
      // A new break at the very top: `---` there can read as front matter.
      const marker = written || (isFirstBlock(element) ? '***' : '---')
      return blockLeading(element) + marker + blockTrailing(element)
    },
  })

  service.addRule('asWrittenAddress', {
    filter(node) {
      return node.nodeName === 'A' && !!node.getAttribute('data-md-link') && !!node.getAttribute('href')
    },
    replacement(content, node) {
      const link = node as HTMLAnchorElement
      const href = link.getAttribute('href') as string
      const text = restoreBrackets(link.textContent ?? '')
      const plain = link.children.length === 0
      const sameAddress = text === href || `mailto:${text}` === href || `http://${text}` === href
      if (plain && sameAddress) {
        return link.getAttribute('data-md-link') === 'angle' ? `<${text}>` : text
      }
      // The text was edited: the inline form.
      const title = link.getAttribute('title')
      return `[${content}](${escapeLinkDestination(href)}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`
    },
  })

  service.addRule('asWrittenEmphasis', {
    filter: ['em', 'i'],
    replacement(content, _node, options) {
      return wrapMarked(content, options.emDelimiter ?? '*')
    },
  })

  service.addRule('asWrittenStrong', {
    filter: ['strong', 'b'],
    replacement(content, _node, options) {
      return wrapMarked(content, options.strongDelimiter ?? '**')
    },
  })

  service.addRule('asWrittenCodeSpan', {
    filter(node) {
      const hasSiblings = node.previousSibling || node.nextSibling
      const isCodeBlock = node.parentNode?.nodeName === 'PRE' && !hasSiblings
      return node.nodeName === 'CODE' && !isCodeBlock
    },
    replacement(content, node) {
      // Turndown's code rule, with the spaces at the code's edges kept
      // (`preformattedCode`)…
      if (!content) return ''
      content = content.replace(/\r?\n|\r/g, ' ')
      const extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? ' ' : ''
      let delimiter = '`'
      const matches: string[] = content.match(/`+/gm) ?? []
      while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`'
      const span = delimiter + extraSpace + content + extraSpace + delimiter
      // …and the space after it that the editor's parse folds into the code's
      // own trailing space (`2026. ` and → "2026. " + "and"): put it back
      // before a word.
      const next = node.nextSibling
      const nextText = next ? next.textContent ?? '' : ''
      return / $/.test(content) && /^[\p{L}\p{N}]/u.test(nextText) ? span + ' ' : span
    },
  })

  service.addRule('asWrittenFencedCode', {
    filter(node) {
      return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE'
    },
    replacement(_content, node) {
      const pre = node as HTMLElement
      const code = pre.firstChild as HTMLElement
      const language = ((code.getAttribute('class') || '').match(/language-(\S+)/) || [null, ''])[1]
      const written = pre.getAttribute('data-md-info')
      let info: string
      if (written !== null && (written === 'none' ? language === '' || language === 'plaintext' : written.split(/\s+/)[0] === language)) {
        info = written === 'none' ? '' : written
      } else {
        // The editor's default language is no language in the file.
        info = language === 'plaintext' ? '' : language
      }
      const text = code.textContent ?? ''
      let fenceSize = 3
      for (const match of text.matchAll(/^`{3,}/gm)) fenceSize = Math.max(fenceSize, match[0].length + 1)
      const fence = '`'.repeat(fenceSize)
      return blockLeading(pre) + fence + info + '\n' + text.replace(/\n$/, '') + '\n' + fence + blockTrailing(pre)
    },
  })

  service.addRule('asWrittenTable', {
    filter(node) {
      return node.nodeName === 'TABLE' && !!(node as HTMLTableElement).rows?.[0] && isHeadingRow((node as HTMLTableElement).rows[0])
    },
    replacement(content, node) {
      return blockLeading(node as Element) + content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n\n+/g, '\n') + blockTrailing(node as Element)
    },
  })

  service.addRule('asWrittenTableCell', {
    filter: ['th', 'td'],
    replacement(content) {
      return CELL_OPEN + cellMarkdown(content) + CELL_CLOSE
    },
  })

  service.addRule('asWrittenTableRow', {
    filter: 'tr',
    replacement(content, node) {
      const row = node as Element
      const table = row.closest('table')
      const spaced = table?.getAttribute('data-md-spacing') !== 'compact'
      const cells = Array.from(content.matchAll(new RegExp(`${CELL_OPEN}([\\s\\S]*?)${CELL_CLOSE}`, 'g')), match => match[1])
      const line = (values: string[]) => '|' + values.map(value => spaced ? (value ? ` ${value} ` : ' ') : value).join('|') + '|'
      let markdown = '\n' + line(cells)
      if (isHeadingRow(row)) {
        const cellElements = childElements(row).filter(cell => cell.nodeName === 'TH' || cell.nodeName === 'TD')
        // The delimiter row as written, while the table has as many columns;
        // otherwise one cell per column from its alignment (S22).
        const written = table?.getAttribute('data-md-delims') ?? null
        const writtenColumns = written ? written.slice(1, -1).split('|').length : 0
        markdown += '\n' + (written && writtenColumns === cellElements.length
          ? written
          : line(cellElements.map(cell => alignDelimiter(cell.getAttribute('data-md-align') ?? cell.getAttribute('align')))))
      }
      return markdown
    },
  })
}
