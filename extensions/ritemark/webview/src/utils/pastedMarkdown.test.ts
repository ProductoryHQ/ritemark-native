import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { EditorView, type EditorProps } from '@tiptap/pm/view'
import type { Schema } from '@tiptap/pm/model'
import { loadSlide, saveSlide } from '../components/decks/blocks/slideEditorHarness'
import * as pipeline from './editorMarkdown'
import { editorMarkdown, fidelitySchema, openDocument, saveDocument } from './markdownFidelity'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

function clipboardView(schema: Schema, props: EditorProps) {
  return {
    state: EditorState.create({ schema }),
    someProp(name: keyof EditorProps, use: (prop: unknown) => unknown) {
      const prop = props[name]
      return prop && use(prop)
    },
    dispatch(tr: Transaction) {
      this.state = this.state.apply(tr)
    },
  }
}

function paste(schema: Schema, html: string, props: EditorProps) {
  const view = clipboardView(schema, props)
  EditorView.prototype.pasteHTML.call(view as unknown as EditorView, html, {} as ClipboardEvent)
  return view.state.doc
}

const props = { transformPastedHTML: pipeline.stripPastedMarkdownAttributes }
const src = 'https://x/cat.png'
const canonical = `![cat](${src})`
const picture = (target: string) => `<img src="${src}" alt="cat" data-md-image-src="${src}" ` +
  `data-md-image-alt="cat" data-md-image-label="![cat]" data-md-image-target="${target}">`

for (const [name, load, save] of [
  ['document', (md: string) => openDocument(md).doc, editorMarkdown],
  ['slide', loadSlide, saveSlide],
] as const) {
  test(`${name} paste discards external picture metadata`, () => {
    const html = picture(`(&lt;${src}&gt;)`)
    assert.equal(save(paste(load('').type.schema, html, props)), canonical)
  })

  test(`${name} paste discards external rule and table metadata`, () => {
    const html = '<p>Before</p><hr data-md-hr="___&#10;extra" data-md-future="unused">' +
      '<table data-md-delims="| :-----: &#10;extra |"><tbody><tr><th>A</th></tr><tr><td>B</td></tr></tbody></table>'
    assert.equal(save(paste(load('').type.schema, html, props)), 'Before\n\n---\n\n| A |\n| --- |\n| B |')
  })

  test(`${name} internal copy and paste keeps Markdown spelling`, () => {
    const written = `Before\n\n___\n\n![cat](<${src}>)`
    const doc = load(written)
    const view = clipboardView(doc.type.schema, {})
    const { dom } = EditorView.prototype.serializeForClipboard.call(view as unknown as EditorView, doc.slice(0, doc.content.size))
    assert.ok(dom.querySelector('[data-pm-slice]'))
    assert.equal(save(paste(doc.type.schema, dom.innerHTML, props)), written)
  })
}

test('the image writer rejects a target followed by an extra inline token', () => {
  const html = picture(`(${src}) *extra*`)
  assert.equal(editorMarkdown(paste(fidelitySchema(), html, {})), canonical)
})

test('the image writer rejects a single image token with a different source', () => {
  const html = picture('(https://x/dog.png)').replace(` data-md-image-src="${src}"`, '')
  assert.equal(editorMarkdown(paste(fidelitySchema(), html, {})), canonical)
})

test('a data URL is written byte for byte with two copies in the editor HTML', () => {
  const data = 'data:image/png;base64,AA'
  const written = `![pixel](<${data}>)\n`
  const opened = openDocument(written)
  assert.equal(pipeline.markdownToEditorHTML(written).split(data).length - 1, 2)
  assert.equal(saveDocument(opened), written)
})
