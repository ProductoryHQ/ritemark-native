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

function fromHTML(html: string): PMNode {
  return PMDOMParser.fromSchema(schema).parse(createDocument(html).body)
}

function load(markdown: string): PMNode {
  return fromHTML(editorMarked.parse(markdown) as string)
}

function blockTypes(doc: PMNode): string[] {
  const types: string[] = []
  doc.descendants(node => {
    if (node.isBlock) types.push(node.type.name)
  })
  return types
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

// ---- literal tildes inside struck text ----
// A struck run that starts with `~` used to be written `~~~5 min~~`: a code
// fence that turned the rest of the document into a code block on reopen.
{
  const doc = fromHTML('<p><s>~5 min</s></p><p>Next paragraph</p>')
  const markdown = save(doc)
  assert.equal(markdown, '~~\\~5 min~~\n\nNext paragraph', 'a leading tilde is escaped, not merged into the delimiter')
  const reopened = load(markdown)
  assert.deepEqual(blockTypes(reopened), ['paragraph', 'paragraph'], 'no code block appears and the next paragraph survives')
  assert.deepEqual(struckText(reopened), ['~5 min'])
}

for (const text of [
  '~', '~~', '~~~foo', '~foo', 'foo~', 'foo~~', 'a~b', 'a~~b', 'a~~~b', '~a~', 'back\\slash~',
  // Two single tildes used to pair up as a nested strike and vanish on reopen.
  'a~b~c', 'a~b~c~d', 'v1~v2 and v3~v4', 'from ~5 to ~10',
]) {
  for (const html of [`<p><s>${text}</s></p><p>After</p>`, `<p>Before <s>${text}</s> after</p>`, `<ul><li><p><s>${text}</s></p></li></ul>`]) {
    const doc = fromHTML(html)
    const markdown = save(doc)
    const reopened = load(markdown)
    assert.deepEqual(blockTypes(reopened), blockTypes(doc), `block structure survives for ${JSON.stringify(html)} → ${JSON.stringify(markdown)}`)
    assert.deepEqual(struckText(reopened), [text], `struck text survives for ${JSON.stringify(html)} → ${JSON.stringify(markdown)}`)
    assert.equal(save(reopened), markdown, `a second save is stable for ${JSON.stringify(html)}`)
  }
}

assert.equal(turndown.turndown('<p><s>a~b~c</s></p>'), '~~a\\~b\\~c~~', 'every tilde inside struck text is escaped')
assert.equal(turndown.turndown('<p><s>foo~</s></p>'), '~~foo&#126;~~', 'a final tilde is a character reference')
// TipTap's code mark excludes every other mark, so the editor never produces
// this; pasted or DOCX HTML can, and the Markdown layer must keep it intact.
assert.equal(turndown.turndown('<p><s><code>~x~</code></s></p>'), '~~`~x~`~~', 'code spans are literal and never escaped')
assert.equal(
  (editorMarked.parse('~~`~x~`~~') as string).trim(),
  '<p><del><code>~x~</code></del></p>',
  'and the code keeps its tildes on reopen',
)

// ---- an empty strike run never turns into a `~~~~` code fence ----
assert.equal(turndown.turndown('<p><s></s>text</p>'), 'text', 'an empty strike element writes nothing')
assert.ok(!turndown.turndown('<p>a<s><br></s>b</p>').includes('~'), 'a strike holding only a line break writes no tildes')

console.log('strikethroughRoundTrip.test.ts — all assertions passed')
