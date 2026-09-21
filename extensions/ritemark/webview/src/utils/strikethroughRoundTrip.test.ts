/**
 * Strikethrough round trip. Run with `npx tsx <this file>`.
 *
 * Mirrors the editor's own path: `marked` (load) → ProseMirror parse with the
 * TipTap schema (`setContent`) → DOMSerializer (`getHTML`) → Turndown (save).
 * Turndown had no rule for `<s>`/`<del>`/`<strike>`, so a save kept the text and
 * silently dropped the mark: `~~strike~~` came back as `strike`.
 *
 * domino stands in for the browser DOM: it is the DOM Turndown itself uses in
 * Node, and unlike xmldom it implements `Element.matches`, which ProseMirror's
 * parser needs.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { Marked } from 'marked'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode } from '@tiptap/pm/model'
import { createTurndownService } from './turndownService'
import { addTipTapTaskListTurndownRules } from './taskListRoundTrip'

// Same options as `editorMarked` in components/Editor.tsx.
const editorMarked = new Marked({ breaks: true, gfm: true })
const schema = getSchema([StarterKit])
const turndown = createTurndownService()
addTipTapTaskListTurndownRules(turndown)

function load(markdown: string): PMNode {
  const html = editorMarked.parse(markdown) as string
  return PMDOMParser.fromSchema(schema).parse(createDocument(html).body)
}

function getHTML(doc: PMNode): string {
  const document = createDocument()
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document }))
  return container.innerHTML
}

function save(doc: PMNode): string {
  return turndown.turndown(getHTML(doc))
}

function struckText(doc: PMNode): string[] {
  const runs: string[] = []
  doc.descendants(node => {
    if (node.isText && node.marks.some(mark => mark.type.name === 'strike')) runs.push(node.text ?? '')
  })
  return runs
}

// ---- the reported case, byte for byte ----
{
  const markdown = 'This checks ~~strike~~ text.'
  const doc = load(markdown)
  assert.deepEqual(struckText(doc), ['strike'], 'loading `~~strike~~` gives the editor a strike mark')
  assert.equal(getHTML(doc), '<p>This checks <s>strike</s> text.</p>', 'TipTap renders the mark as <s>')
  assert.equal(save(doc), markdown, 'saving writes the strike back as `~~strike~~`')
}

// ---- every HTML spelling of strikethrough ----
for (const tag of ['s', 'del', 'strike']) {
  assert.equal(
    turndown.turndown(`<p>a <${tag}>b</${tag}> c</p>`),
    'a ~~b~~ c',
    `<${tag}> serializes as a double-tilde strike`,
  )
}

// ---- strike next to, inside and around other marks ----
for (const markdown of [
  '~~**bold strike**~~ and **~~strike bold~~**',
  '~~*italic strike*~~ and ~~`code`~~',
  '~~[a link](https://example.com)~~',
  'un~~done~~ intraword',
  '# Heading with ~~strike~~',
  '- item with ~~strike~~\n- plain item',
]) {
  const once = save(load(markdown))
  assert.ok(once.includes('~~'), `strike is written for: ${markdown}`)
  assert.deepEqual(
    struckText(load(once)),
    struckText(load(markdown)),
    `struck text survives save and reopen for: ${markdown}`,
  )
  assert.equal(save(load(once)), once, `a second save is stable for: ${markdown}`)
}

// ---- inner whitespace moves outside the delimiters, where GFM needs it ----
{
  const markdown = turndown.turndown('<p>a<s> b </s>c</p>')
  assert.equal(markdown, 'a ~~b~~ c', 'flanking whitespace is kept outside the `~~`')
  assert.deepEqual(struckText(load(markdown)), ['b'], 'and the result still reads back as strike')
}

// ---- single-tilde input keeps its mark and is written in the `~~` form ----
{
  const doc = load('An ~old~ form.')
  assert.deepEqual(struckText(doc), ['old'], '`marked` reads a single-tilde strike')
  assert.equal(save(doc), 'An ~~old~~ form.', 'the saved form is the double tilde')
}

// ---- an empty strike run never turns into a `~~~~` code fence ----
assert.equal(turndown.turndown('<p><s></s>text</p>'), 'text', 'an empty strike element writes nothing')
assert.ok(!turndown.turndown('<p>a<s><br></s>b</p>').includes('~'), 'a strike holding only a line break writes no tildes')

console.log('strikethroughRoundTrip.test.ts — all assertions passed')
