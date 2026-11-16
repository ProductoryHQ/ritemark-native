/**
 * Sprint 161 spike: mapping a Gamma card's clipboard HTML to slide Markdown by structure, never by Gamma's class
 * names alone. The fixture is SYNTHETIC: the structure of a real two-column card copied on 17 November, with made-up
 * text and dummy ids. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { load, save } from './fencedDiv.roundtrip.harness'

/** The structure of Gamma's `«class HTML»` for a two-column card (ProseMirror clipboard HTML), text and ids made up. */
export const GAMMA_TWO_COLUMNS = `<meta charset='utf-8'><div class="card-layout-item" data-pm-slice="2 4 [&quot;document&quot;,{&quot;docId&quot;:&quot;doc-00000000&quot;,&quot;format&quot;:&quot;deck&quot;,&quot;settings&quot;:{&quot;locale&quot;:&quot;en&quot;}},&quot;card&quot;,{&quot;id&quot;:&quot;card-00000000&quot;,&quot;layout&quot;:&quot;blank&quot;}]"><h1>Two ways to start</h1><div class="columns" data-colwidths="[50,50]"><div class="column"><h2><b>Start small</b> </h2><p class="paragraph" data-font-size="default">Pick one task a week.</p><p class="paragraph" data-font-size="default">Write down what changed.</p></div><div class="column"><h2><b>Start with a</b><br><b>shared folder</b></h2><p class="paragraph">Keep the files <b>current</b> and the prompts <b>short</b>.</p></div></div></div>`

const HEADING = /^H[1-6]$/

/** Inline content as Markdown: bold and italic kept, everything else's text. In a heading, marks and breaks go. */
function inline(node: Node, inHeading: boolean): string {
  let out = ''
  node.childNodes.forEach(child => {
    if (child.nodeType === 3) out += (child.nodeValue ?? '').replace(/\s+/g, ' ')
    else if (child.nodeName === 'BR') out += inHeading ? ' ' : '  \n'
    else if (!inHeading && (child.nodeName === 'B' || child.nodeName === 'STRONG')) out += `**${inline(child, false).trim()}**`
    else if (!inHeading && (child.nodeName === 'I' || child.nodeName === 'EM')) out += `*${inline(child, false).trim()}*`
    else out += inline(child, inHeading)
  })
  return out
}

const elements = (node: Element) => Array.from(node.children)

/** A container whose two or more children each open with a heading, or Gamma's own `div.columns`. */
function isColumns(el: Element): boolean {
  if (el.classList.contains('columns')) return true
  const kids = elements(el)
  return kids.length >= 2 && kids.every(kid => kid.nodeName === 'DIV' && kid.firstElementChild && HEADING.test(kid.firstElementChild.nodeName))
}

/** Blocks as Markdown. `depth` is 0 for the card itself, 1 inside a column (its headings become ###). */
function blocks(parent: Element, depth: number, out: string[], state: { titled: boolean }) {
  for (const el of elements(parent)) {
    if (el.nodeName === 'META' || el.nodeName === 'STYLE' || el.nodeName === 'SCRIPT') continue
    if (HEADING.test(el.nodeName)) {
      const text = inline(el, true).trim()
      if (!text) continue
      if (depth === 0 && !state.titled) { out.push(`# ${text}`); state.titled = true }
      else out.push(`${depth === 0 ? '##' : '###'} ${text}`)
    } else if (el.nodeName === 'P') {
      const text = inline(el, false).trim()
      if (text) out.push(text)
    } else if (el.nodeName === 'UL' || el.nodeName === 'OL') {
      out.push(elements(el).map((li, i) => `${el.nodeName === 'OL' ? `${i + 1}.` : '-'} ${inline(li, false).trim()}`).join('\n'))
    } else if (el.nodeName === 'IMG') {
      // A remote picture: downloaded into images/ by the host (`deck/fetch-image`), never kept as a remote address.
      out.push(`![](pending-download:${el.getAttribute('src') ?? ''})`)
    } else if (el.nodeName === 'DIV' && isColumns(el)) {
      const columns = elements(el).map(column => {
        const inner: string[] = []
        blocks(column, 1, inner, state)
        return `::: column\n${inner.join('\n\n')}\n:::`
      })
      out.push(`:::: columns\n${columns.join('\n\n')}\n::::`)
    } else {
      blocks(el, depth, out, state) // a wrapper (Gamma's card-layout-item): its children
    }
  }
}

export function gammaHtmlToSlideMarkdown(html: string): string {
  const doc = createDocument(`<body>${html}</body>`)
  const out: string[] = []
  blocks(doc.body as unknown as Element, 0, out, { titled: false })
  return out.join('\n\n')
}

const markdown = gammaHtmlToSlideMarkdown(GAMMA_TWO_COLUMNS)
console.log(markdown)
assert.equal(markdown, `# Two ways to start

:::: columns
::: column
### Start small

Pick one task a week.

Write down what changed.
:::

::: column
### Start with a shared folder

Keep the files **current** and the prompts **short**.
:::
::::`)
assert.ok(!markdown.includes('card-00000000') && !markdown.includes('colwidths') && !markdown.includes('font-size'), 'no Gamma ids, widths or styles')
// The mapped Markdown opens as Columns in the slide editor and saves byte for byte.
let columns = 0
load(markdown).descendants(node => { if (node.type.name === 'fencedDiv' && node.attrs.class === 'column') columns += 1 })
assert.equal(columns, 2)
assert.equal(save(load(markdown)), markdown)
// Without Gamma's classes, the structure rule still finds the columns (another app's HTML).
assert.equal(gammaHtmlToSlideMarkdown(GAMMA_TWO_COLUMNS.replace(/ class="[^"]*"/g, '')), markdown)
console.log('\nGamma two-column card: mapped by structure, opens as two columns, round-trips; the same without class names')
