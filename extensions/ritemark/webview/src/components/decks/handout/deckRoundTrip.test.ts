/**
 * Sprint 157: a deck opened as a deck saves byte for byte, and a slide edit rewrites only its own lines.
 * Run with `npx tsx webview/src/components/decks/handout/deckRoundTrip.test.ts`.
 *
 * Drives the editor's own pipeline (`utils/editorMarkdown.ts`) with the deck's extensions, as the deck view does:
 * the host's front-matter split and projection, `markdownToEditorHTML`, TipTap's mount parse, then `getHTML()`,
 * `editorHTMLToMarkdown` and the host's join. The flag-off round trip of the same file is the fidelity corpus's
 * `kept/deck.md`.
 */
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { parseSlideBody, writeSlideBody } from '../../../../../src/decks/deckFormat'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from './deckSchema'

installTestDocument()
ensureCommentMarkedPipeline()
const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide] }))

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

function open(text: string): { doc: PMNode; save: (doc: PMNode) => string } {
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(projection)), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  return { doc, save: next => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const deckFile = fs.readFileSync(path.join(here, '../../../utils/fidelity-corpus/kept/deck.md'), 'utf8')

const slides = (doc: PMNode) => {
  const found: PMNode[] = []
  doc.forEach(node => { if (node.type.name === 'deckSlide') found.push(node) })
  return found
}

// Every slide and its notes open as slide nodes; a notes block is folded into its slide.
{
  const { doc, save } = open(deckFile)
  const nodes = slides(doc)
  assert.deepEqual(nodes.map(node => node.attrs.kind), ['title', 'boxes', 'table'])
  assert.equal(nodes[1].attrs.notes, 'Ask who has used an agent.')
  assert.equal(nodes[0].attrs.notes, null)
  assert.equal(parseSlideBody(nodes[1].attrs.body).title, "An assistant's four parts")
  let notesCodeBlocks = 0
  doc.descendants(node => { if (node.type.name === 'codeBlock' && /notes/.test(node.textContent)) notesCodeBlocks++ })
  assert.equal(notesCodeBlocks, 0)
  assert.equal(save(doc), deckFile, 'opened as a deck and saved: byte for byte')
}

// A stage edit rewrites only its own lines.
{
  const { doc, save } = open(deckFile)
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'deckSlide' && node.attrs.kind === 'boxes') at = offset })
  const node = doc.nodeAt(at)!
  const body = writeSlideBody(node.attrs.body, { ...parseSlideBody(node.attrs.body), title: 'Four parts' })
  const tr = EditorState.create({ doc }).tr.setNodeMarkup(at, undefined, { ...node.attrs, body })
  const before = deckFile.split('\n')
  const after = save(tr.doc).split('\n')
  assert.equal(after.length, before.length)
  assert.deepEqual(after.filter((line, index) => line !== before[index]), ['title: Four parts'])
}

// Notes written, emptied and removed.
{
  const { doc, save } = open(deckFile)
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'deckSlide') at = offset })
  const node = doc.nodeAt(at)!
  const withNotes = save(EditorState.create({ doc }).tr.setNodeMarkup(at, undefined, { ...node.attrs, notes: 'Say hello.' }).doc)
  assert.ok(withNotes.includes('subtitle: Harbour Logistics · 3 hours · 12 November 2026\n```\n\n```notes\nSay hello.\n```\n\n## Welcome'))
  const reopened = open(withNotes)
  assert.equal(slides(reopened.doc)[0].attrs.notes, 'Say hello.')
  assert.equal(reopened.save(reopened.doc), withNotes)
}

// A body with backticks gets a longer fence, and reads back the same.
{
  const text = '```slide statement\nid: ab12\ntitle: "```js"\n```\n\nText.\n'
  const { doc, save } = open(text)
  const node = slides(doc)[0]
  const body = 'id: ab12\ntitle: x\n```\ninside'
  const saved = save(EditorState.create({ doc }).tr.setNodeMarkup(0, undefined, { ...node.attrs, body }).doc)
  assert.ok(saved.startsWith('````slide statement\n'))
  assert.equal(slides(open(saved).doc)[0].attrs.body, body)
}

// Non-canonical input is normalised once, predictably, and then stays.
{
  const text = '~~~slide  points\nid: p001\n~~~\nTight text.\n'
  const first = open(text)
  const once = first.save(first.doc)
  assert.equal(once, '```slide points\nid: p001\n```\n\nTight text.\n')
  const second = open(once)
  assert.equal(second.save(second.doc), once)
}

// A notes block that does not follow a slide stays a code block of the handout.
{
  const text = '```slide points\nid: p001\n```\n\nText.\n\n```notes\nNot the slide\'s.\n```\n'
  const { doc, save } = open(text)
  assert.equal(slides(doc)[0].attrs.notes, null)
  assert.equal(save(doc), text)
}

console.log('deckRoundTrip: passed')
