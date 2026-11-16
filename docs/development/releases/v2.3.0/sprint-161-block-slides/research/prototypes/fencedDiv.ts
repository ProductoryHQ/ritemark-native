/**
 * Sprint 161 spike (throwaway): Pandoc fenced divs (`:::`) through the editor's own Markdown pipeline.
 *
 *  - load: a block-level `marked` tokenizer that scans lines itself (so a close directly under a paragraph line
 *    closes, as in Pandoc), skips code fences, and lexes the inside with `blockTokens`;
 *  - the node: one generic `fencedDiv` node that keeps its open and close lines as written, and whether a blank
 *    line followed the open line and preceded the close line;
 *  - save: a Turndown rule writing those lines back, with the inside as Turndown wrote it.
 *
 * PR 1 would split the generic node into typed nodes (columns/column, boxes/box, steps); the round trip is the same.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type TurndownService from 'turndown'
import { annotateAsWritten } from '../utils/markdownAsWritten'

/** An opening fence: 3+ colons, then a bare word or a `{…}` attribute block, then optional trailing colons. */
export const OPEN_FENCE = /^ {0,3}(:{3,})[ \t]*(\{[^}\n]*\}|[A-Za-z][\w-]*)[ \t]*:*[ \t]*$/
/** A closing fence: 3+ colons and nothing else. */
export const CLOSE_FENCE = /^ {0,3}(:{3,})[ \t]*$/
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/

export interface FenceAttributes {
  classes: string[]
  id: string | null
  values: Record<string, string>
}

/** `columns`, `{.box icon="x"}`, `{.column width=40%}`, `{#id .a .b key='v'}`. */
export function parseFenceAttributes(spec: string): FenceAttributes | null {
  if (!spec.startsWith('{')) return { classes: [spec], id: null, values: {} }
  const body = spec.slice(1, -1).trim()
  const out: FenceAttributes = { classes: [], id: null, values: {} }
  const part = /\s*(?:\.([\w-]+)|#([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))/y
  let at = 0
  while (at < body.length) {
    part.lastIndex = at
    const m = part.exec(body)
    if (!m) return null // an attribute we can't read: not a fence (stays text)
    if (m[1]) out.classes.push(m[1])
    else if (m[2]) out.id = m[2]
    else out.values[m[3]] = m[4] ?? m[5] ?? m[6] ?? ''
    at = part.lastIndex
    while (at < body.length && /\s/.test(body[at])) at += 1
  }
  return out
}

export interface FenceScan {
  raw: string
  openLine: string
  closeLine: string
  inner: string
  gapOpen: boolean
  gapClose: boolean
  attrs: FenceAttributes
}

/** A fenced div at the start of `src`, to its matching close (innermost open closes first), or null. */
export function scanFencedDiv(src: string): FenceScan | null {
  const lines = src.split('\n')
  const first = OPEN_FENCE.exec(lines[0])
  if (!first) return null
  const attrs = parseFenceAttributes(first[2])
  if (!attrs) return null
  let depth = 1
  let code: { char: string; size: number } | null = null
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (code) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
      if (close && close[1][0] === code.char && close[1].length >= code.size) code = null
      continue
    }
    const fence = CODE_FENCE.exec(line)
    if (fence) {
      code = { char: fence[1][0], size: fence[1].length }
      continue
    }
    const open = OPEN_FENCE.exec(line)
    if (open && parseFenceAttributes(open[2])) {
      depth += 1
      continue
    }
    if (CLOSE_FENCE.test(line)) {
      depth -= 1
      if (depth === 0) {
        const innerLines = lines.slice(1, index)
        const inner = innerLines.join('\n')
        const consumed = lines.slice(0, index + 1).join('\n')
        const raw = src.length > consumed.length && src[consumed.length] === '\n' ? `${consumed}\n` : consumed
        return {
          raw,
          openLine: lines[0],
          closeLine: line,
          inner,
          gapOpen: innerLines.length > 0 && innerLines[0].trim() === '',
          gapClose: innerLines.length > 1 && innerLines[innerLines.length - 1].trim() === '',
          attrs,
        }
      }
    }
  }
  return null // unclosed: not a div
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface FencedDivToken {
  type: 'fencedDiv'
  raw: string
  scan: FenceScan
  tokens: unknown[]
}

export const fencedDivMarkedExtension = {
  extensions: [
    {
      name: 'fencedDiv',
      level: 'block' as const,
      // A start() lets a fence line interrupt a paragraph (Pandoc does). Without it `Text\n::: column` is one paragraph.
      start(src: string) {
        const match = /(^|\n) {0,3}:{3,}/.exec(src)
        return match ? match.index + match[1].length : undefined
      },
      tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: unknown[]) => unknown[] } }, src: string): FencedDivToken | undefined {
        const scan = scanFencedDiv(src)
        if (!scan) return undefined
        const tokens = this.lexer.blockTokens(scan.inner.replace(/^\n+/, ''), [])
        // The editor's as-written pass only walks the top level, lists and quotes; a container's children need it too.
        annotateAsWritten(tokens as never, scan.inner)
        return { type: 'fencedDiv', raw: scan.raw, scan, tokens }
      },
      renderer(this: { parser: { parse: (tokens: unknown[]) => string } }, token: FencedDivToken): string {
        const s = token.scan
        return `<div data-fdiv="" data-open="${esc(s.openLine)}" data-close="${esc(s.closeLine)}" data-gap-open="${s.gapOpen}" data-gap-close="${s.gapClose}" data-class="${esc(s.attrs.classes.join(' '))}"${(token as { rmTight?: boolean }).rmTight ? ' data-md-tight="true"' : ''}>${this.parser.parse(token.tokens)}</div>\n`
      },
      childTokens: ['tokens'],
    },
  ],
}

export const FencedDiv = Node.create({
  name: 'fencedDiv',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    const attr = (name: string, fallback: string | null) => ({
      default: fallback,
      parseHTML: (element: HTMLElement) => element.getAttribute(name),
      renderHTML: (attrs: Record<string, unknown>) => ({ [name]: attrs[name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] as string }),
    })
    return {
      open: attr('data-open', ':::: columns'),
      close: attr('data-close', '::::'),
      gapOpen: attr('data-gap-open', 'false'),
      gapClose: attr('data-gap-close', 'false'),
      class: attr('data-class', ''),
      mdTight: attr('data-md-tight', null),
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-fdiv]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-fdiv': '' }, HTMLAttributes), 0]
  },
})

export function addFencedDivTurndownRule(service: TurndownService): void {
  service.addRule('fencedDiv', {
    filter: node => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-fdiv'),
    replacement: (content, node) => {
      const el = node as HTMLElement
      const open = el.getAttribute('data-open') ?? ':::'
      const close = el.getAttribute('data-close') ?? ':::'
      const gapOpen = el.getAttribute('data-gap-open') === 'true' ? '\n' : ''
      const gapClose = el.getAttribute('data-gap-close') === 'true' ? '\n' : ''
      const inside = content.replace(/^\n+/, '').replace(/\n+$/, '')
      // Tight with a neighbour only as written (`data-md-tight`); a fence line never merges with the block beside it.
      const lead = el.getAttribute('data-md-tight') === 'true' && el.previousElementSibling ? '\n' : '\n\n'
      const next = el.nextElementSibling
      const trail = next && next.getAttribute('data-md-tight') === 'true' ? '\n' : '\n\n'
      return `${lead}${open}\n${gapOpen}${inside}\n${gapClose}${close}${trail}`
    },
  })
}
