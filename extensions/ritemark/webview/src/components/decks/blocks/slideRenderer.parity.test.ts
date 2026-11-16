/**
 * Sprint 161 (spike §4): the one renderer and the slide editor draw a slide the same. For the same Markdown, the block
 * outline (depth, kind, words) of the renderer's HTML and of the slide editor's document must match: on the spike's
 * slides (with its gap closed: a picture alone in a paragraph is a block in both), on the v2 fixtures, and on every
 * slide of the demo project's decks as `legacyToBlocks` draws it. Run with `npx tsx`.
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
      if (tag === 'div') {
        const known = classes.map(name => name.replace(/^blk-/, '')).filter(name => KNOWN.includes(name))
        out.push(`${depth}:div.${known.join(' ') || 'block'}`)
        walk(child, depth + 1)
        continue
      }
      if (tag === 'span') continue // the Steps pill, a box's icon: the renderer's own drawing, no block of the file
      if (['ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'blockquote'].includes(tag)) { out.push(`${depth}:${tag}`); walk(child, depth + 1); continue }
      if (tag === 'li' || tag === 'th' || tag === 'td') { out.push(`${depth}:${tag} ${words(child)}`); continue }
      if (/^(h[1-6]|p|pre)$/.test(tag)) { out.push(`${depth}:${tag} ${words(child)}`); continue }
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
  const edited = outlineOfDoc(loadSlide(slide.markdown))
  assert.deepEqual(rendered, edited, `${slide.from}: the renderer and the slide editor disagree on\n${slide.markdown}`)
  same += 1
}
assert.ok(blockSlides >= 30, `the fixtures and the demo project give enough slides (${blockSlides})`)
console.log(`slideRenderer.parity: ${same}/${slides.length} slides draw the same outline in the renderer and the slide editor (${SPIKE.length} spike slides, ${blockSlides} from the fixtures and the demo project)`)
