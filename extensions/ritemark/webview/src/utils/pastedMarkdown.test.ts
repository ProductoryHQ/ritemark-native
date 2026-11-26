import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { EditorView, type EditorProps } from '@tiptap/pm/view'
import type { Schema } from '@tiptap/pm/model'
import { loadSlide, saveSlide } from '../components/decks/blocks/slideEditorHarness'
import * as pipeline from './editorMarkdown'
import { editorMarkdown, fidelitySchema, openDocument, saveDocument } from './markdownFidelity'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

function clipboardView(schema: Schema, props: EditorProps) {
  return {
    state: EditorState.create({ schema }),
    someProp(name: keyof EditorProps, use?: (prop: unknown) => unknown) {
      const prop = props[name]
      return prop && (use ? use(prop) : prop)
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

const props = pipeline.markdownClipboardProps(fidelitySchema())
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

  const forged = '<p data-pm-slice="0 0 []">Before</p>'
  const hidden = '&#10;&#10;&lt;!-- hidden --&gt;&#10;&#10;[link](https://example.com)'
  const forgedPictures = [
    picture(`(${src})`).replace('![cat]', `![cat${hidden}]`),
    picture(`(${src} &quot;hidden title&quot;)`),
  ]
  for (const [index, html] of forgedPictures.entries()) {
    test(`${name} rejects forged slice picture metadata (${index})`, () => {
      assert.equal(save(paste(load('').type.schema, forged + html, props)), `Before\n\n${canonical}`)
    })
  }

  test(`${name} rejects forged slice block metadata`, () => {
    const html = forged + `<hr data-md-hr="___${hidden}"><ul data-md-marker="*${hidden}"><li><p>Item</p></li></ul>` +
      '<table data-md-delims="| :-----: extra |"><tbody><tr><th>A</th></tr><tr><td>B</td></tr></tbody></table>'
    assert.equal(save(paste(load('').type.schema, html, props)), 'Before\n\n---\n\n- Item\n\n| A |\n| --- |\n| B |')
  })

  test(`${name} internal copy and paste keeps Markdown spelling`, () => {
    const written = `Before\n\n___\n\n![cat](<${src}>)\n\n![](image(1).png "Cap")\n\n![](Kickoff%20files/a.png)`
    const doc = load(written)
    const copyProps = pipeline.markdownClipboardProps(doc.type.schema)
    const view = clipboardView(doc.type.schema, copyProps)
    const { dom } = EditorView.prototype.serializeForClipboard.call(view as unknown as EditorView, doc.slice(0, doc.content.size))
    assert.ok(dom.querySelector('[data-pm-slice]'))
    assert.equal(save(paste(doc.type.schema, dom.innerHTML, copyProps)), written)
  })
}

test('a copy from a different session loses its Markdown spelling', () => {
  const doc = openDocument('Before\n\n___\n').doc
  const view = clipboardView(doc.type.schema, props)
  const { dom } = EditorView.prototype.serializeForClipboard.call(view as unknown as EditorView, doc.slice(0, doc.content.size))
  const tagged = dom.querySelector('[data-ritemark-clipboard]')
  assert.ok(tagged)
  tagged.setAttribute('data-ritemark-clipboard', 'another-session')
  assert.equal(editorMarkdown(paste(doc.type.schema, dom.innerHTML, props)), 'Before\n\n---')
})

test('a list pasted from another tab keeps both items separate from the paragraph', () => {
  const list = openDocument('* one\n* two').doc
  const view = clipboardView(list.type.schema, props)
  const { dom } = EditorView.prototype.serializeForClipboard.call(view as unknown as EditorView, list.slice(0, list.content.size))
  const tagged = dom.querySelector('[data-ritemark-clipboard]')!
  for (const token of ['another-session', null]) {
    if (token) tagged.setAttribute('data-ritemark-clipboard', token)
    else tagged.removeAttribute('data-ritemark-clipboard')
    const target = openDocument('Para.').doc
    view.state = EditorState.create({ doc: target, selection: TextSelection.create(target, 6) })
    EditorView.prototype.pasteHTML.call(view as unknown as EditorView, dom.innerHTML, {} as ClipboardEvent)
    assert.equal(editorMarkdown(view.state.doc), 'Para.\n\n- one\n- two')
  }
})

test('external slice context preserves the depths, wrapper count, nodes and non-Markdown attributes', () => {
  const element = document.createElement('p')
  element.setAttribute('data-md-tight', 'true')
  const context = ['orderedList', { start: 5, mdDelim: ')' }, 'listItem', null, 'paragraph', { mdTight: 'true' }]
  element.setAttribute('data-pm-slice', '2 3 -1 ' + JSON.stringify(context))
  const container = document.createElement('div')
  container.innerHTML = props.transformPastedHTML!(element.outerHTML, {} as EditorView)
  const result = container.firstElementChild!
  assert.equal(result.getAttribute('data-pm-slice'), '2 3 -1 ' + JSON.stringify([
    'orderedList', { start: 5 }, 'listItem', null, 'paragraph', {},
  ]))
  assert.equal(result.hasAttribute('data-md-tight'), false)
  element.setAttribute('data-pm-slice', '2 3 -1 [invalid')
  container.innerHTML = props.transformPastedHTML!(element.outerHTML, {} as EditorView)
  assert.equal(container.firstElementChild!.getAttribute('data-pm-slice'), '2 3 -1 [invalid')
})

for (const [name, load, save] of [
  ['document', (md: string) => openDocument(md).doc, editorMarkdown],
  ['slide', loadSlide, saveSlide],
] as const) {
  const doc = load('Before')
  const copyProps = pipeline.markdownClipboardProps(doc.type.schema)
  const view = clipboardView(doc.type.schema, copyProps)
  const { dom } = EditorView.prototype.serializeForClipboard.call(view as unknown as EditorView, doc.slice(0, doc.content.size))
  const tagged = dom.querySelector('[data-ritemark-clipboard]')!
  for (const [kind, html, expected] of [
    ['hr', '<hr data-md-hr="---&#10;&#10;&lt;!-- x --&gt;">', '---'],
    ['info', '<pre data-md-info="js&#10;second"><code class="language-js">x</code></pre>', '```js\nx\n```'],
    ['marker', '<ul data-md-marker="-x"><li>Item</li></ul>', '- Item'],
    ['delimiter', '<ol data-md-delim="x"><li>Item</li></ol>', '1. Item'],
    ['delims', '<table data-md-delims="| ---&#10;--- |"><tr><th>A</th></tr><tr><td>B</td></tr></table>', '| A |\n| --- |\n| B |'],
  ]) {
    test(`${name} falls back for invalid ${kind} metadata`, () => {
      assert.equal(save(paste(doc.type.schema, tagged.outerHTML + html, copyProps)), 'Before\n\n' + expected)
      const external = tagged.cloneNode() as Element
      external.textContent = tagged.textContent
      external.removeAttribute('data-ritemark-clipboard')
      assert.equal(save(paste(doc.type.schema, external.outerHTML + html, copyProps)), 'Before\n\n' + expected)
    })
  }
}

test('the image writer checks block structure, alt and title even with trusted metadata', () => {
  for (const html of [
    picture(`(${src})`).replace('![cat]', '![cat&#10;&#10;extra]'),
    picture(`(${src})`).replace('![cat]', '![dog]'),
    picture(`(${src} &quot;hidden title&quot;)`),
  ]) {
    assert.equal(editorMarkdown(paste(fidelitySchema(), html, {})), canonical)
  }
})

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

test('a crafted slice context (array-like or followed by a line break) brings no Markdown spelling in', () => {
  // The 5th High review round: ProseMirror reads an array-like context and stops its JSON at the first line break.
  const arrayLike = `<p data-pm-slice='1 1 {"length":4,"0":"bulletList","1":{"mdIndent":"600000000"},"2":"listItem","3":{}}'>x</p>`
  const lineBreak = `<p data-pm-slice='1 1 ["bulletList",{"mdIndent":"600000000"},"listItem",{}]\njunk'>x</p>`
  for (const html of [arrayLike, lineBreak]) {
    const doc = paste(fidelitySchema(), html, props)
    const markdown = editorMarkdown(doc)
    assert.ok(markdown.length < 100, `the save stays small: ${markdown.slice(0, 40)}`)
    assert.ok(!/ {4}/.test(markdown), 'no list turned into code by a crafted indent')
  }
})

test('a written list indent and hard-break spaces are bounded on save', () => {
  const html = '<ul data-md-indent="600000000"><li><p>x</p></li></ul><p>a<br data-md-break="spaces-999999999">b</p>'
  const doc = openDocument('- x').doc
  const view = clipboardView(doc.type.schema, {})
  void view
  const saved = pipeline.editorHTMLToMarkdown(html)
  assert.ok(saved.length < 200, 'the save never throws or grows without bound')
  assert.ok(!/^ {4}/m.test(saved), 'a list is never indented into code')
})
