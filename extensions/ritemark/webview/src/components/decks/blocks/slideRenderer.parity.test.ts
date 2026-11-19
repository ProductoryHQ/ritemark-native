/**
 * Sprint 161 (spike §4): the one renderer and the slide editor draw a slide the same. For the same Markdown, the block
 * outline (depth, kind, words) of the renderer's HTML and of the slide editor's document must match: on the spike's
 * slides (with its gap closed: a picture alone in a paragraph is a block in both), on the v2 fixtures, and on every
 * slide of the demo project's decks as `legacyToBlocks` draws it. Sprint 164 PR 3: the Label on both sides, and an old
 * Steps pill as the Label the stage opens it with (`SlideEditor.stageMarkdownOf`, `withStepsLabels`). Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDocument } from '@mixmark-io/domino'
import type { Node as PMNode } from '@tiptap/pm/model'
import { isBlockSlide, isSlideKind, parseDeck, slideDataOf } from '../../../../../src/decks/deckFormat'
import { legacyToBlocks } from '../../../../../src/decks/blocks/legacyToBlocks'
import { blockSlideHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { withStepsLabels } from '../../../../../src/decks/blocks/labelBlock'
import { SLIDE_BLOCK_CLASSES } from '../../../../../src/decks/blocks/fencedDiv'
import { loadSlide } from './slideEditorHarness'

type Outline = string[]

const KNOWN = SLIDE_BLOCK_CLASSES as readonly string[]

function outlineOfHTML(html: string): Outline {
  const out: Outline = []
  const words = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim()
  const walk = (node: Element, depth: number) => {
    for (const child of Array.from(node.children)) {
      const tag = child.nodeName.toLowerCase()
      const classes = (child.getAttribute('class') ?? '').split(/\s+/)
      // Sprint 163 PR 3: a Button block, its words beside it and on it (its icon is the renderer's own drawing).
      if (tag === 'div' && classes.includes('blk-button')) { out.push(`${depth}:button ${words(child)}`); continue }
      // Sprint 164 PR 3: a Label, its words.
      if (tag === 'div' && classes.includes('blk-label')) { out.push(`${depth}:label ${words(child)}`); continue }
      if (tag === 'div') {
        const known = classes.map(name => name.replace(/^blk-/, '')).filter(name => KNOWN.includes(name))
        out.push(`${depth}:div.${known.join(' ') || 'block'}`)
        walk(child, depth + 1)
        continue
      }
      if (tag === 'span') continue // a box's icon: the renderer's own drawing, no block of the file
      if (['ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'blockquote'].includes(tag)) { out.push(`${depth}:${tag}`); walk(child, depth + 1); continue }
      if (tag === 'li' || tag === 'th' || tag === 'td') { out.push(`${depth}:${tag} ${words(child)}`); continue }
      // A code block's Copy and ↗ (Sprint 163 PR 1) are the renderer's own drawing: its words are its code's.
      if (tag === 'pre') { const code = child.querySelector('code'); out.push(`${depth}:pre ${code ? words(code) : words(child)}`); continue }
      if (/^(h[1-6]|p)$/.test(tag)) { out.push(`${depth}:${tag} ${words(child)}`); continue }
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
        case 'slideDiv': {
          const classes = String(child.attrs.class).split(' ')
          out.push(`${depth}:div.${classes.filter(name => KNOWN.includes(name)).join(' ') || 'block'}`)
          walk(child, depth + 1)
          break
        }
        case 'heading': out.push(`${depth}:h${child.attrs.level} ${text(child)}`); break
        case 'paragraph': out.push(`${depth}:p ${text(child)}`); break
        case 'codeBlock': out.push(`${depth}:pre ${text(child)}`); break
        case 'buttonBlock': out.push(`${depth}:button ${text(child)}`); break
        // An empty Label takes no room on the stage and is never drawn elsewhere.
        case 'slideLabel': if (text(child)) out.push(`${depth}:label ${text(child)}`); break
        case 'image': out.push(`${depth}:img ${child.attrs.src}`); break
        case 'bulletList': out.push(`${depth}:ul`); walk(child, depth + 1); break
        case 'orderedList': out.push(`${depth}:ol`); walk(child, depth + 1); break
        case 'listItem': out.push(`${depth}:li ${text(child)}`); break
        case 'table': {
          out.push(`${depth}:table`)
          // marked writes thead and tbody; the editor has rows only: compare the cells.
          child.forEach((row, _offset, index) => {
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

/** Pictures by their path on both sides: the renderer asks `pictureUrl`, the editor keeps the path as written. */
const draw = (markdown: string) => blockSlideHtml(markdown, { pictureUrl: picture => picture })

const SPIKE = [
  '# Copilot or Cursor?\n## Two tools\n\n:::: columns\n::: column\n### Copilot\nDocuments and mail\n:::\n::: column\n### Cursor\n- Intent architecture\n- A sprint\n:::\n::::',
  ':::: boxes\n::: {.box icon="lightbulb"}\n### Idea\nOne line\n:::\n::: {.box icon="warning"}\n### Risk\nAnother line\n:::\n::::',
  '# Exercise\n::: {.steps tag="Harjutus"}\n1. Open the file\n2. Ask the question\n:::',
  '# Results\n\n| Team | Saved |\n| --- | --- |\n| Inbox | 40 min |',
  // The spike's gap: a picture alone in its paragraph.
  '# Picture\n\n![](images/pilot.png)\n\nA caption under it',
  '# Private words\n\nSeen text\n\n<!-- a remark -->\n\nMore text with <b>raw</b> HTML',
  'Line one\nline two with a break',
  // README item 18: One by one on a block's line, and a list in its `::: incremental` wrapper (or `{reveal="one"}`).
  '# Plan\n\n:::: {.boxes reveal="one"}\n::: box\n### One\n:::\n::: box\n### Two\n:::\n::::',
  '# Plan\n\n::: incremental\n- Open the file\n- Ask the question\n:::\n\nAfter the list.',
  '# Plan\n\n::: {reveal="one"}\n1. Open the file\n2. Ask the question\n:::',
  // Sprint 163 PR 1: a prompt in a code block, with a place to fill in, in a column too.
  '# Prompt\n\n```\nSummarise [the report] & stop.\n```\n\n:::: columns\n::: column\n```text\nOne [place]\n```\n:::\n::: column\nB\n:::\n::::',
  // Sprint 163 PR 3: a Button block with words beside it, one alone in a column, and one with no full address.
  '# Material\n\nUse **this** & that. [Open the sample](https://example.com/a.pdf){.button}\n\n:::: columns\n::: column\n[Open](https://example.com){.button}\n:::\n::: column\n[Not yet](http://example.com){.button}\n:::\n::::',
  // Sprint 164 PR 3: a Label over a title, in a column, in a box, an empty one, and words that only look like one.
  '[Workshop · day 1]{.label}\n\n# Agents at work\n\n:::: columns\n::: column\n[Before]{.label}\n\n### Copilot\nText\n:::\n::: column\n[]{.label}\n\nAfter\n:::\n::::',
  ':::: boxes\n::: box\n[Tip]{.label}\n\nOne line\n:::\n::::\n\nWords\n[not a label]{.label}\n\n[a link](https://example.com){.label}',
  '# Steps with an old pill\n\n::: {.steps tag="Harjutus · 1 / 2"}\n1. Open the file\n:::\n\n::: {.steps tag=""}\n1. Emptied\n:::',
]

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../../../..')
const deckFiles = [
  ...fs.readdirSync(path.join(root, 'docs/development/sprints/sprint-157-decks/demo-project'), { recursive: true, encoding: 'utf8' })
    .filter(name => name.endsWith('.deck.md'))
    .map(name => path.join(root, 'docs/development/sprints/sprint-157-decks/demo-project', name)),
  ...['deck.md', 'deck-blocks.md', 'deck-mixed.md'].map(name => path.join(root, 'extensions/ritemark/webview/src/utils/fidelity-corpus/kept', name)),
]

const slides: Array<{ from: string; markdown: string }> = SPIKE.map(markdown => ({ from: 'spike', markdown }))
for (const file of deckFiles) {
  const text = fs.readFileSync(file, 'utf8')
  for (const slide of parseDeck(text).slides) {
    if (isBlockSlide(slide.kind)) slides.push({ from: path.basename(file), markdown: slideDataOf('', slide.body).markdown ?? '' })
    else if (isSlideKind(slide.kind)) slides.push({ from: `${path.basename(file)} (${slide.kind}, converted)`, markdown: legacyToBlocks(slide.kind, slide.body).markdown })
  }
}

let same = 0
const blockSlides = slides.filter(slide => slide.from !== 'spike').length
for (const slide of slides) {
  const rendered = outlineOfHTML(draw(slide.markdown))
  // The stage opens a block slide with its old pills as Labels, as the renderer draws them.
  const edited = outlineOfDoc(loadSlide(withStepsLabels(slide.markdown)))
  assert.deepEqual(rendered, edited, `${slide.from}: the renderer and the slide editor disagree on\n${slide.markdown}`)
  same += 1
}
assert.ok(blockSlides >= 30, `the fixtures and the demo project give enough slides (${blockSlides})`)
console.log(`slideRenderer.parity: ${same}/${slides.length} slides draw the same outline in the renderer and the slide editor (${SPIKE.length} spike slides, ${blockSlides} from the fixtures and the demo project)`)
