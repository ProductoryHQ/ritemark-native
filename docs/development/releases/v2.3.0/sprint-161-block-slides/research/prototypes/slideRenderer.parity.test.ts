/**
 * Sprint 161 spike: one static renderer for the slide (strip, wall, presenter, page), and a parity test against the
 * stage's editor. The renderer is a scoped `marked` v9 instance with the `:::` tokenizer and a renderer that writes
 * the slide's semantic classes. The parity test compares a block outline (depth, kind, text) of the static HTML with
 * the stage editor's document for the same Markdown. Run with `npx tsx`.
 */
import { Marked } from 'marked'
import { createDocument } from '@mixmark-io/domino'
import type { Node as PMNode } from '@tiptap/pm/model'
import { scanFencedDiv } from './fencedDiv'
import { load } from './fencedDiv.roundtrip.harness'

interface DivToken { type: 'slideDiv'; raw: string; classes: string[]; values: Record<string, string>; tokens: unknown[] }

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The static renderer: the same tokenizer as the editor's, rendering classes instead of round-trip attributes. */
export const slideMarked = new Marked({ gfm: true, breaks: true })
slideMarked.use({
  extensions: [{
    name: 'slideDiv',
    level: 'block',
    start(src: string) {
      const match = /(^|\n) {0,3}:{3,}/.exec(src)
      return match ? match.index + match[1].length : undefined
    },
    tokenizer(this: { lexer: { blockTokens: (s: string, t?: unknown[]) => unknown[] } }, src: string) {
      const scan = scanFencedDiv(src)
      if (!scan) return undefined
      return { type: 'slideDiv', raw: scan.raw, classes: scan.attrs.classes, values: scan.attrs.values, tokens: this.lexer.blockTokens(scan.inner.replace(/^\n+/, ''), []) } as DivToken
    },
    renderer(this: { parser: { parse: (t: unknown[]) => string } }, token) {
      const t = token as unknown as DivToken
      const known = ['columns', 'column', 'boxes', 'box', 'steps'].filter(name => t.classes.includes(name))
      const data = Object.entries(t.values).filter(([key]) => key === 'icon' || key === 'tag').map(([key, value]) => ` data-${key}="${esc(value)}"`).join('')
      return `<div class="${known.join(' ') || 'block'}"${data}>${this.parser.parse(t.tokens)}</div>\n`
    },
    childTokens: ['tokens'],
  }],
  // The page's privacy rule: raw HTML (comments included) never renders as HTML.
  renderer: { html: () => '' },
})

type Outline = string[]

function outlineOfHTML(html: string): Outline {
  const out: Outline = []
  const walk = (node: Element, depth: number) => {
    for (const child of Array.from(node.children)) {
      const tag = child.nodeName.toLowerCase()
      if (tag === 'div') { out.push(`${depth}:div.${child.getAttribute('class')}`); walk(child, depth + 1); continue }
      if (['ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'blockquote'].includes(tag)) { out.push(`${depth}:${tag}`); walk(child, depth + 1); continue }
      if (tag === 'li' || tag === 'th' || tag === 'td') {
        const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim()
        out.push(`${depth}:${tag} ${text}`)
        continue
      }
      if (/^(h[1-6]|p|pre)$/.test(tag)) { out.push(`${depth}:${tag} ${(child.textContent ?? '').replace(/\s+/g, ' ').trim()}`); continue }
      if (tag === 'img') { out.push(`${depth}:img ${child.getAttribute('src')}`); continue }
      walk(child, depth)
    }
  }
  walk(createDocument(`<body>${html}</body>`).body as unknown as Element, 0)
  return out
}

function outlineOfDoc(doc: PMNode): Outline {
  const out: Outline = []
  const text = (node: PMNode) => node.textContent.replace(/\s+/g, ' ').trim()
  const walk = (node: PMNode, depth: number) => {
    node.forEach(child => {
      switch (child.type.name) {
        case 'fencedDiv': {
          const classes = String(child.attrs.class).split(' ')
          const known = ['columns', 'column', 'boxes', 'box', 'steps'].filter(name => classes.includes(name))
          out.push(`${depth}:div.${known.join(' ') || 'block'}`)
          walk(child, depth + 1)
          break
        }
        case 'heading': out.push(`${depth}:h${child.attrs.level} ${text(child)}`); break
        case 'paragraph': out.push(`${depth}:p ${text(child)}`); break
        case 'codeBlock': out.push(`${depth}:pre ${text(child)}`); break
        case 'image': out.push(`${depth}:img ${child.attrs.src}`); break
        case 'bulletList': out.push(`${depth}:ul`); walk(child, depth + 1); break
        case 'orderedList': out.push(`${depth}:ol`); walk(child, depth + 1); break
        case 'listItem': out.push(`${depth}:li ${text(child)}`); break
        case 'table': {
          out.push(`${depth}:table`)
          // marked writes thead/tbody; the editor has rows only: compare the cells.
          child.forEach((row, _o, index) => {
            if (index === 0) out.push(`${depth + 1}:thead`, `${depth + 2}:tr`)
            else if (index === 1) out.push(`${depth + 1}:tbody`, `${depth + 2}:tr`)
            else out.push(`${depth + 2}:tr`)
            row.forEach(cell => out.push(`${depth + 3}:${cell.type.name === 'tableHeader' ? 'th' : 'td'} ${text(cell)}`))
          })
          break
        }
        default: out.push(`${depth}:${child.type.name} ${text(child)}`)
      }
    })
  }
  walk(doc, 0)
  return out
}

const CORPUS = [
  `# Copilot or Cursor?\n## Two tools\n\n:::: columns\n::: column\n### Copilot\nDocuments and mail\n:::\n::: column\n### Cursor\n- Intent architecture\n- A sprint\n:::\n::::`,
  `:::: boxes\n::: {.box icon="lightbulb"}\n### Idea\nOne line\n:::\n::: {.box icon="warning"}\n### Risk\nAnother line\n:::\n::::`,
  `# Exercise\n::: {.steps tag="Harjutus"}\n1. Open the file\n2. Ask the question\n:::`,
  `# Results\n\n| Team | Saved |\n| --- | --- |\n| Inbox | 40 min |`,
  `# Picture\n\n![](images/pilot.png)\n\nA caption under it`,
  `# Private words\n\nSeen text\n\n<!-- a remark -->\n\nMore text with <b>raw</b> HTML`,
  `Line one\nline two with a break`,
]

let same = 0
for (const markdown of CORPUS) {
  const staticOutline = outlineOfHTML(slideMarked.parse(markdown) as string)
  const editorOutline = outlineOfDoc(load(markdown))
  const ok = JSON.stringify(staticOutline) === JSON.stringify(editorOutline)
  if (ok) same += 1
  else console.log(`DIFF for ${JSON.stringify(markdown.slice(0, 40))}\n static: ${JSON.stringify(staticOutline)}\n editor: ${JSON.stringify(editorOutline)}`)
}
console.log(`${same}/${CORPUS.length} slides: the static renderer and the stage editor give the same outline`)
