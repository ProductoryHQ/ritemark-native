/**
 * Sprint 161 spike: private remarks as Ritemark comments (Jarmo, 17 November), not a notes field.
 *  1. A comment in a handout part round-trips byte for byte through the deck editor (DeckSlide + comment callouts).
 *  2. The page drops it (`publicDeck`).
 *  3. The presenter view could read the part's comments, in order, from the deck text (a prototype reader).
 *  4. The conversion's comment: a v1 `notes` block and hidden words written as one standalone comment at the part's end.
 * Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { canonicalMarkdownProjection } from '../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../src/editorSync/frontMatter'
import { parseDeck } from '../../../src/decks/deckFormat'
import { publicDeck, lexHandout } from '../../../src/decks/page/publicDeck'
import { BUILT_IN_THEME } from '../../../src/decks/deckTheme'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../utils/markdownFidelity'
import { DeckSlide } from '../components/decks/handout/deckSchema'
import { DeckDrawnHeadings } from '../components/decks/handout/drawnHeadings'

installTestDocument()
ensureCommentMarkedPipeline()
const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

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

function openAndSave(text: string): string {
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const doc: PMNode = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(projection)), { preserveWhitespace: 'full' })
  return joinFrontMatter(JSON.parse(JSON.stringify(split.properties)), editorMarkdown(doc), text)
}

const DECK = `---
deck: 1
handout: text
---

\`\`\`slide title
title: Copilot at work
\`\`\`

# Copilot at work

Welcome text for participants.

<!-- Ask who has used an assistant this week. -->

\`\`\`slide points
title: Where assistants help
items:
  - heading: Mail
  - heading: Documents
\`\`\`

## Where assistants help

<!-- {id:0f8e2b1c-3d4a-4e5f-8a9b-0c1d2e3f4a5b} Story: the bank's inbox.
Keep it under two minutes. -->

The participants read this, and <mark data-comment="say the number out loud">40 minutes</mark> is the saving.

<!-- @claude: check this figure -->
`

// 1. Byte for byte.
const saved = openAndSave(DECK)
console.log(`1. deck with comments in its parts, opened and saved: ${saved === DECK ? 'byte for byte' : 'CHANGED'}`)
if (saved !== DECK) console.log(saved)

// 2. The page drops every comment (standalone, with an id, multi-line, assigned, anchored) and keeps the anchored words.
const page = publicDeck(DECK, { folderName: 'Demo', deckName: 'Copilot at work', theme: BUILT_IN_THEME })
const pageText = JSON.stringify(page)
for (const secret of ['Ask who has used', 'Story: the bank', 'Keep it under', 'say the number', 'check this figure', '<!--', 'data-comment']) {
  assert.ok(!pageText.includes(secret), `the page leaks "${secret}"`)
}
assert.ok(pageText.includes('40 minutes'), 'the anchored words stay')
console.log('2. publicDeck: no comment body reaches the page; the anchored words stay')

// 3. The presenter view's "Your comments": the part's comments in order, read from the deck text on the host.
interface PartComment { kind: 'note' | 'anchored'; body: string; words?: string }
function partComments(handout: string): PartComment[] {
  const out: PartComment[] = []
  const visit = (tokens: ReturnType<typeof lexHandout>) => {
    for (const token of tokens as Array<{ type: string; raw: string; text?: string; tokens?: unknown[]; items?: Array<{ tokens: unknown[] }> }>) {
      if (token.type === 'code') continue
      if (token.type === 'html' || token.type === 'paragraph' || token.type === 'text') {
        // Standalone and inline comments, then anchored notes, in the order they appear.
        const scan = /<!--([\s\S]*?)-->|<mark\b[^>]*\bdata-comment="([^"]*)"[^>]*>([\s\S]*?)<\/mark>/g
        let m: RegExpExecArray | null
        while ((m = scan.exec(token.raw))) {
          if (m[1] !== undefined) out.push({ kind: 'note', body: m[1].trim().replace(/^\{id:[^}]+\}\s*/, '') })
          else out.push({ kind: 'anchored', body: m[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&'), words: m[3] })
        }
        continue
      }
      if (token.items) for (const item of token.items) visit(item.tokens as never)
      else if (token.tokens && token.type === 'blockquote') visit(token.tokens as never)
    }
  }
  visit(lexHandout(handout))
  return out
}
const parsed = parseDeck(DECK)
const perSlide = parsed.slides.map(slide => partComments(DECK.slice(slide.handoutStart, slide.handoutEnd)))
console.log('3. presenter view, per slide:', JSON.stringify(perSlide, null, 1))
assert.equal(perSlide[0].length, 1)
assert.equal(perSlide[1].length, 3)
// A comment inside a prompt (a code fence) is the prompt's text, not a comment.
assert.equal(partComments('```\n<!-- not a comment -->\n```\n').length, 0)

// 4. The conversion's comment: notes plus hidden words, at the end of the part. `-->` in the text would end the comment
// early, and the comment model rejects it at input (`hasCommentTerminator`), so the converter must neutralise it.
function conversionComment(notes: string | null, hidden: string[]): string | null {
  const parts = [notes?.trim() ?? '', ...hidden.map(words => `Hidden by the old layout: ${words}`)].filter(Boolean)
  if (!parts.length) return null
  const body = parts.join('\n').replace(/--+>/g, match => match.replace(/>$/, '›')) // `-->` becomes `--›`
  return `<!-- ${body} -->`
}
const comment = conversionComment('Ask who has used an agent.\nThen --> the demo.', ['Third column: Gemini'])!
const withComment = `${DECK}\n${comment}\n`
assert.equal(openAndSave(withComment), withComment, 'a converted comment round-trips')
assert.ok(!JSON.stringify(publicDeck(withComment, { folderName: 'Demo', deckName: 'x', theme: BUILT_IN_THEME })).includes('Gemini'), 'and stays off the page')
console.log(`4. conversion comment ${JSON.stringify(comment)} round-trips and stays off the page`)
