/**
 * #1129: a reference-style picture (`![a][ref]` with `[ref]: x.png`) on a slide is kept as written when the slide is
 * saved, with its definition, as a Text document keeps it since #1115. Through the slide editor's own pipeline (scoped
 * `marked` → TipTap → Turndown) and the handout's (the document editor with the deck's nodes). The deck format's own
 * definition handling (`rewritePictureTargets`, on a move or a copy) still finds what the slide editor saved.
 * Run with `npx tsx webview/src/components/decks/blocks/slidePictureReferences.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { rewritePictureTargets } from '../../../../../src/decks/deckLibraryFormat'
import { createEditorSchemaExtensions, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, typeAtEndOfLastParagraph } from '../../../utils/markdownFidelity'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings } from '../handout/drawnHeadings'
import { loadSlide as load, saveSlide as save } from './slideEditorHarness'

// ---- The slide's body: untouched, it writes back byte for byte, and a second open changes nothing.
const untouched: Array<[string, string]> = [
  ['full reference', '# Title\n\n![A chart][ref]\n\n[ref]: x.png'],
  ['collapsed reference', '# Title\n\n![ref][]\n\n[ref]: x.png'],
  ['shortcut reference', '# Title\n\n![ref]\n\n[ref]: x.png'],
  ['definition with a title, a paragraph after it', '# Title\n\n![a][ref]\n\n[ref]: x.png "A title"\n\nAfter'],
  ['angle-bracket target with a space', '# Title\n\n![a][ref]\n\n[ref]: <my picture.png>'],
  ['upper-case label', '# Title\n\n![a][Chart One]\n\n[chart one]: images/chart.png'],
  ['inside a column', ':::: columns\n::: column\n![a][ref]\n:::\n::: column\nB\n:::\n::::\n\n[ref]: x.png'],
  ['inside a box', ':::: boxes\n::: {.box icon="lightbulb"}\n### Idea\n![a][ref]\n:::\n::::\n\n[ref]: x.png'],
  ['two pictures, one definition each', '# T\n\n![a][one]\n\n![b][two]\n\n[one]: a.png\n[two]: b.png'],
]
for (const [name, markdown] of untouched) {
  const out = save(load(markdown))
  assert.equal(out, markdown, `kept as written: ${name}`)
  assert.equal(save(load(out)), out, `stable on a second open: ${name}`)
}

// A definition no picture on the slide uses is not a picture's: it goes as before (marked reads it and drops it).
assert.equal(save(load('# Title\n\nWords\n\n[unused]: x.png')), '# Title\n\nWords')

// An inline picture is still written inline.
assert.equal(save(load('# Title\n\n![a](x.png "t")')), '# Title\n\n![a](x.png "t")')

// The picture's mapping: the slide shows it from its webview address, and saves the reference.
const display = 'https://file%2B.vscode-resource.vscode-cdn.net/Users/me/decks/x.png?v=1'
{
  const doc = load('# Title\n\n![a][ref]\n\n[ref]: x.png', { 'x.png': display })
  let src: unknown
  doc.descendants(node => { if (node.type.name === 'image' || node.type.name === 'picture') src ??= node.attrs.src })
  assert.equal(src, display, 'the picture shows')
  assert.equal(save(doc), '# Title\n\n![a][ref]\n\n[ref]: x.png', 'and saves as written')
}

// An edit elsewhere on the slide keeps the reference and its definition.
{
  const markdown = '# Title\n\nSome words\n\n![a][ref]\n\n[ref]: x.png'
  const doc = load(markdown)
  let wordsEnd = -1
  doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent === 'Some words') wordsEnd = pos + node.nodeSize - 1 })
  assert.ok(wordsEnd > 0)
  const edited = EditorState.create({ doc }).tr.insertText(' more', wordsEnd).doc
  assert.equal(save(edited), '# Title\n\nSome words more\n\n![a][ref]\n\n[ref]: x.png')
}

// The deck format still rewrites what the slide editor saved: the definition's target moves, the reference stays.
{
  const saved = save(load('# Title\n\n![a][ref]\n\n[ref]: Kickoff.rtms.files/x.png'))
  assert.equal(
    rewritePictureTargets(saved, target => target.replace('Kickoff.rtms.files/', 'Renamed.rtms.files/')),
    '# Title\n\n![a][ref]\n\n[ref]: Renamed.rtms.files/x.png',
  )
}

// ---- The handout: the document editor's pipeline with the deck's nodes, as the deck view opens it (#1115 already).
const deckSchema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

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

function openDeck(text: string): { doc: PMNode; save: (doc: PMNode) => string } {
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const doc = PMDOMParser.fromSchema(deckSchema).parse(elementFromString(markdownToEditorHTML(projection)), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  return { doc, save: next => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const DECK = `---
deck: 2
handout: text
---

\`\`\`slide
# Results

![A chart][chart]

[chart]: Kickoff.rtms.files/chart.png
\`\`\`

## Notes

![The team][team]

Words after.

[team]: Kickoff.rtms.files/team.png
`

{
  const deck = openDeck(DECK)
  assert.equal(deck.save(deck.doc), DECK, 'a deck with reference pictures in a slide and in the handout, as written')
  const again = openDeck(deck.save(deck.doc))
  assert.equal(again.save(again.doc), DECK, 'stable on a second open')
  const typed = typeAtEndOfLastParagraph(deck.doc, '!')
  assert.ok(typed)
  assert.equal(deck.save(typed), DECK.replace('Words after.', 'Words after.!'), 'an edit in the handout keeps both')
  // The slide's body goes to the slide editor as it is in the file, and comes back from it as written.
  let body = ''
  deck.doc.descendants(node => { if (node.type.name === 'deckSlide') body ||= String(node.attrs.body) })
  assert.ok(body.includes('![A chart][chart]'), `the slide's body holds the reference: ${JSON.stringify(body)}`)
}

console.log('slide picture references: all passed')
