/**
 * GH #378 — word count and friends must follow every document change.
 * Run with `npx tsx webview/src/lib/docChange.test.ts`.
 */
import assert from 'node:assert/strict'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { countWords, onDocChanged } from './docChange'

const schema = getSchema([StarterKit])
const p = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)

// Heading + paragraph: words on either side of a block boundary stay separate.
const heading = schema.nodes.heading.create({ level: 1 }, schema.text('Harbor notes'))
assert.equal(countWords(schema.nodes.doc.create(null, [heading, p('This short text has nine words in it.')])), 2 + 8)

// 25 one-word blocks = 25 words (textContent would give 1).
assert.equal(countWords(schema.nodes.doc.create(null, Array.from({ length: 25 }, () => p('word')))), 25)

// A soft line break separates words.
const withBreak = schema.nodes.paragraph.create(null, [schema.text('one'), schema.nodes.hardBreak.create(), schema.text('two')])
assert.equal(countWords(schema.nodes.doc.create(null, [withBreak])), 2)

// Empty document.
assert.equal(countWords(schema.nodes.doc.create(null, [p('')])), 0)

// Listener: recounts on a doc-changing transaction (even one that carries preventUpdate), not on selection-only ones.
type Handler = (arg: { transaction: { docChanged: boolean } }) => void
const handlers = new Set<Handler>()
const stub = {
  on: (_: string, h: Handler) => { handlers.add(h) },
  off: (_: string, h: Handler) => { handlers.delete(h) },
}
let calls = 0
const off = onDocChanged(stub as never, () => { calls++ })
handlers.forEach((h) => h({ transaction: { docChanged: true } }))
assert.equal(calls, 1)
handlers.forEach((h) => h({ transaction: { docChanged: false } }))
assert.equal(calls, 1)
off()
assert.equal(handlers.size, 0)

console.log('docChange tests passed.')
