/**
 * Literal tildes in ordinary text. Run with `npx tsx <this file>`.
 *
 * Mirrors the editor's own path: `marked` (load) → ProseMirror parse with the
 * TipTap schema (`setContent`) → DOMSerializer (`getHTML`) → Turndown (save).
 * `strikethroughRoundTrip.test.ts` drives the same path for text that really
 * is struck; this file covers text that only looks like it.
 *
 * `marked` reads both `~x~` and `~~x~~` as strikethrough while Turndown
 * escaped only a leading `~~~`, so a paragraph typed as `a~b~c` was saved
 * verbatim and reopened as `a<del>b</del>c` — the tildes gone and `b` struck,
 * with the next save making the loss permanent.
 *
 * The other half of the contract is that a save leaves the rest alone. Tildes
 * that cannot pair are not strikethrough to `marked`, so `~/Downloads` and
 * `from ~5 to ~10` have to come back byte for byte rather than growing
 * backslashes on every save (the rewrite-what-nobody-touched class of #270).
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

function getHTML(doc: PMNode): string {
  const document = createDocument()
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document }))
  return container.innerHTML
}

function save(doc: PMNode): string {
  return turndown.turndown(getHTML(doc))
}

/** A document holding `text` as ordinary typed text, carrying no marks at all. */
function typed(text: string, wrap: (escaped: string) => string = inner => `<p>${inner}</p>`): PMNode {
  return fromHTML(wrap(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))
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
  const doc = typed('a~b~c')
  const markdown = save(doc)
  assert.equal(markdown, 'a\\~b~c', 'the tilde that would open a strike is escaped, the other is left alone')
  const reopened = load(markdown)
  assert.equal(reopened.textContent, 'a~b~c', 'both tildes come back')
  assert.deepEqual(struckText(reopened), [], 'and nothing is struck')
  assert.equal(save(reopened), markdown, 'a second save is stable')
}

// ---- text that pairs, in every block a document is made of ----
const WRAPPERS: { name: string; wrap: (inner: string) => string }[] = [
  { name: 'paragraph', wrap: inner => `<p>${inner}</p>` },
  { name: 'heading', wrap: inner => `<h2>${inner}</h2>` },
  { name: 'list item', wrap: inner => `<ul><li><p>${inner}</p></li></ul>` },
  { name: 'blockquote', wrap: inner => `<blockquote><p>${inner}</p></blockquote>` },
  { name: 'mid-sentence', wrap: inner => `<p>Before ${inner} after</p>` },
]

for (const text of [
  'a~b~c', '~~word~~', '~c~', 'v1~v2 and v3~v4', 'a ~b~ c', '~~a~~b~~',
  'a~b~c~d', '~a~ and ~b~', '~~x~~ then ~y~', 'a~~b~~c',
]) {
  for (const { name, wrap } of WRAPPERS) {
    const doc = typed(text, wrap)
    const markdown = save(doc)
    const reopened = load(markdown)
    assert.equal(
      reopened.textContent,
      doc.textContent,
      `every tilde survives save and reopen in a ${name}: ${JSON.stringify(text)} → ${JSON.stringify(markdown)}`,
    )
    assert.deepEqual(
      struckText(reopened),
      [],
      `and no strike mark is invented in a ${name}: ${JSON.stringify(text)} → ${JSON.stringify(markdown)}`,
    )
    assert.equal(save(reopened), markdown, `a second save is stable in a ${name}: ${JSON.stringify(text)}`)
  }
}

// ---- text that cannot pair is left exactly as the author wrote it ----
// `marked` needs two runs of the same length, each with a non-space character
// on the inside, so none of these is strikethrough and none may be rewritten.
for (const text of [
  '~/Downloads',
  'Save it to ~/Downloads and ~/Documents',
  'from ~5 to ~10',
  '~5 min',
  'approx ~3 to ~4 items',
  'a~b',
  'a~~b',
  'x ~ y',
  'foo~',
  '~foo',
  'a~~~b',           // three tildes are never a delimiter
  'a~~~b~~~c',
  'a~b~~',           // the runs are different lengths, so they never pair
  'a~~b~',
  'v1~v2 ~ v3',
]) {
  const markdown = save(typed(text))
  assert.equal(markdown, text, `saved byte for byte: ${JSON.stringify(text)}`)
  const reopened = load(markdown)
  assert.equal(reopened.textContent, text, `and reopened unchanged: ${JSON.stringify(text)}`)
  assert.deepEqual(struckText(reopened), [], `with no strike mark: ${JSON.stringify(text)}`)
}

// ---- only the opening run is escaped ----
// `marked` matches on the raw source and ignores backslashes while scanning, so
// escaping a closer would not stop it closing there — it would just swallow the
// `\` as the last character of the strike. Escaping the opener does stop it:
// the lexer consumes the backslash and the tilde together and never scans it.
assert.equal(save(typed('~c~')), '\\~c~', 'the opener is escaped and the closer left bare')
assert.equal(save(typed('~~word~~')), '\\~\\~word~~', 'a two-tilde opener is escaped in full')
assert.equal(save(typed('~~a~~b~~')), '\\~\\~a\\~\\~b~~', 'each run that can open is escaped')
assert.equal(
  save(typed('v1~v2 and v3~v4')),
  'v1\\~v2 and v3~v4',
  'a lone pair escapes only its first run',
)

// ---- Turndown's own `\~~~` escape still composes ----
// Turndown writes a leading `~~~` as `\~~~`, which leaves a bare `~~` that can
// still open a strike; the remainder has to be escaped on top of it.
{
  assert.equal(save(typed('~~~foo')), '\\~~~foo', 'a leading `~~~` alone keeps Turndown\'s own escape')
  const doc = typed('~~~ab~~')
  const markdown = save(doc)
  assert.equal(markdown, '\\~\\~\\~ab~~', 'a leading `~~~` that can pair is escaped the rest of the way')
  const reopened = load(markdown)
  assert.equal(reopened.textContent, '~~~ab~~', 'and the run survives intact')
  assert.equal(save(reopened), markdown, 'a second save is stable')
}

// ---- literal tildes and a real strike in the same paragraph ----
{
  const doc = fromHTML('<p>Plain ~a~b~ and <s>struck ~x~ text</s> here</p>')
  const markdown = save(doc)
  const reopened = load(markdown)
  assert.equal(reopened.textContent, doc.textContent, 'every tilde survives on both sides of the strike')
  assert.deepEqual(struckText(reopened), ['struck ~x~ text'], 'and only the struck run stays struck')
  assert.equal(save(reopened), markdown, 'a second save is stable')
}

// ---- a paragraph of safe tildes next to one that needs escaping ----
{
  const doc = fromHTML('<p>~/Downloads</p><p>a~b~c</p>')
  const markdown = save(doc)
  assert.equal(markdown, '~/Downloads\n\na\\~b~c', 'the untouched paragraph is not rewritten')
  assert.equal(load(markdown).textContent, doc.textContent)
}

// ---- known limitation: a pair split across an inline element ----
// Escaping is decided per text node, but `marked` reads the whole paragraph, so
// a `~` before a bold run and its partner after it are still read as a strike.
// Closing this would mean escaping every lone tilde — rewriting `~/Downloads`
// in every document on every save — which is the worse trade. If a later change
// does close it, delete this block rather than keeping the assertion.
{
  const doc = fromHTML('<p>~a <strong>b</strong> c~</p>')
  const reopened = load(save(doc))
  assert.equal(reopened.textContent, 'a b c', 'still lost: the pair spans three text nodes')
  assert.deepEqual(struckText(reopened), ['a ', 'b', ' c'], 'and is read back as a strike')
}

console.log('literalTildeRoundTrip.test.ts — all assertions passed')
