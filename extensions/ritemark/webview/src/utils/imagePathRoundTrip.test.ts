import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marked } from 'marked'
import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { replacePicture, replacePictureKeepingCaret } from '../extensions/pictures/pictureCommands'
import { loadSlide, saveSlide } from '../components/decks/blocks/slideEditorHarness'
import { installTestDocument, openDocument, saveDocument, typeAtEndOfLastParagraph } from './markdownFidelity'
import { DeckSlide } from '../components/decks/handout/deckSchema'
import { putSlidePicture } from '../components/decks/blocks/slidePictureSwap'
import { flowToSide } from '../components/decks/blocks/slidePicturePlace'
import { slidesOf } from '../components/decks/deckDocument'
import { applyImageMappings, createEditorSchemaExtensions, createEditorTurndownService, markdownToEditorHTML } from './editorMarkdown'
import { isRelativeImagePath, isWebviewResourceUri, sameRelativeImagePath } from '../../../src/utils/imagePaths'

// ── Which paths count as "beside the document" ─────────────────────────────
for (const p of ['./a.png', '../a.png', 'img/a.png', 'a.png', 'img\\a.png', 'my images/a b.png']) {
  assert.equal(isRelativeImagePath(p), true, p)
}
for (const p of ['', '  ', 'https://x.test/a.png', 'http://x/a.png', 'data:image/png;base64,AA', 'file:///a.png',
  'vscode-resource:/a.png', '/abs/a.png', '\\\\server\\a.png', 'C:\\a.png', '#anchor', 'mailto:x@y']) {
  assert.equal(isRelativeImagePath(p), false, p)
}
assert.equal(isWebviewResourceUri('https://file%2B.vscode-resource.vscode-cdn.net/docs/a.png?v=1'), true)
assert.equal(isWebviewResourceUri('vscode-webview://abc/img/a.png'), true)
assert.equal(isWebviewResourceUri('https://example.com/a.png'), false)
assert.equal(sameRelativeImagePath('./img/a.png', 'img/a.png'), true)
assert.equal(sameRelativeImagePath('img\\a.png', './img/a.png'), true)
assert.equal(sameRelativeImagePath('../a.png', 'a.png'), false)

// ── Saving writes the Markdown path back, never the display URI ───────────
const service = createEditorTurndownService()
const display = 'https://file%2B.vscode-resource.vscode-cdn.net/Users/me/docs/img/a.png?v=17'
const save = (html: string) => service.turndown(`<p>${html}</p>`)

assert.equal(save(`<img src="${display}" title="./img/a.png" alt="a">`), '![a](./img/a.png)')
assert.equal(save(`<img src="${display}" title="../a.png" alt="a">`), '![a](../a.png)',
  'a ../ image used to be saved as the webview URI')
assert.equal(save(`<img src="${display}" title="img/a.png" alt="a">`), '![a](img/a.png)',
  'the bare form, now mapped for display, round-trips too')

// A remote image keeps its URL even when it carries a caption title.
assert.equal(save('<img src="https://example.com/a.png" title="A caption" alt="a">'), '![a](https://example.com/a.png)')
assert.equal(save('<img src="https://example.com/a.png" title="img/other.png" alt="a">'), '![a](https://example.com/a.png)',
  'a relative-looking title never overrides a real remote src')
// An unmapped local image (file missing at load) stays as written.
assert.equal(save('<img src="img/missing.png" alt="a">'), '![a](img/missing.png)')

installTestDocument()
for (const path of ['Kickoff Planning.rtms.files/photo.png', 'Kickoff [files]/Õppepäev $& photo.png']) {
  const markdown = `![](<${path}>)`
  const html = marked.parse(markdown, { async: false })
  const mappings = { [path]: display }
  for (const mapped of [
    applyImageMappings(html, mappings),
    applyImageMappings(`<img src="${path}" alt="">`, mappings),
    markdownToEditorHTML(markdown, mappings),
  ]) {
    const container = document.createElement('div')
    container.innerHTML = mapped
    const image = container.querySelector('img')
    assert.equal(image?.getAttribute('src'), display)
    assert.equal(image?.getAttribute('title'), path)
  }
}

const documentPath = './my images/a b.png'
const documentMarkdown = `![a](<${documentPath}>)`
const documentHtml = markdownToEditorHTML(documentMarkdown, { [documentPath]: display })
assert.ok(documentHtml.includes(`src="${display}"`))
assert.equal(save(documentHtml), documentMarkdown)

for (const [picture, path] of [
  ['![](image(1).png)', 'image(1).png'],
  ['![](image(1).png "Cap")', 'image(1).png'],
  ['![](images/Eiffel_Tower_(Paris).jpg)', 'images/Eiffel_Tower_(Paris).jpg'],
  ['![](images/a%20b.png)', 'images/a b.png'],
  ['![](<a b.png>)', 'a b.png'],
  ['![An \\[example\\]](<https://example.com/a%20b.png> "Caption")', undefined],
] as const) {
  test(`editing text keeps ${picture}`, () => {
    const source = `${picture}\n\nWords.\n`
    const opened = openDocument(source, path ? { [path]: display } : undefined)
    if (path) assert.equal(opened.doc.firstChild?.attrs.src, display)
    const edited = typeAtEndOfLastParagraph(opened.doc, ' Edited.')
    assert.ok(edited)
    assert.equal(saveDocument(opened, edited), source.replace('Words.', 'Words. Edited.'))
  })
}

for (const literal of [
  'Use `<img src="images/a.png">`',
  '```html\n<img src="images/a.png">\n```',
  'Use src="images/a.png" here.',
]) {
  test(`mapping keeps literal text ${JSON.stringify(literal)}`, () => {
    const source = `![](images/a.png)\n\n${literal}\n\nWords.\n`
    const opened = openDocument(source, { 'images/a.png': display })
    const edited = typeAtEndOfLastParagraph(opened.doc, ' Edited.')
    assert.ok(edited)
    assert.equal(saveDocument(opened, edited), source.replace('Words.', 'Words. Edited.'))
  })
}

test('changing the alt keeps the original destination spelling', () => {
  assert.equal(
    save(markdownToEditorHTML('![Old](<image(1).png>)').replace('alt="Old"', 'alt="New"')),
    '![New](<image(1).png>)',
  )
})

test('a changed destination is formatted for the new path', () => {
  const html = markdownToEditorHTML('![](<old.png>)')
  for (const [path, target] of [
    ['image(1).png', 'image(1).png'],
    ['image(1.png', '<image(1.png>'],
    ['image)1(.png', '<image)1(.png>'],
    ['a b.png', '<a b.png>'],
    ['a<b>.png', '<a%3Cb%3E.png>'],
  ]) {
    const container = document.createElement('div')
    container.innerHTML = html
    container.querySelector('img')!.setAttribute('src', path)
    assert.equal(save(container.innerHTML), `![](${target})`)
  }
})

const deckSchema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
for (const old of ['https://example.com/a.png', 'missing.png']) {
  for (const [name, replace] of [
    ['Replace picture', replacePicture],
    ['ChatGPT picture', replacePictureKeepingCaret],
  ] as const) {
    test(`${name} saves a relative path after replacing ${old}`, () => {
      const opened = openDocument(`![](${old})\n\nWords.\n`)
      const tr = replace(EditorState.create({ doc: opened.doc }), 0, { src: display, title: 'new.png' })
      assert.ok(tr)
      for (const key of ['mdImageLabel', 'mdImageTarget', 'mdImageSrc', 'mdImageAlt']) {
        assert.equal(tr.doc.firstChild?.attrs[key], null, key)
      }
      assert.equal(saveDocument(opened, tr.doc), '![](new.png)\n\nWords.\n')
    })
  }

  test(`slide swap saves a relative path after replacing ${old}`, () => {
    const slide = deckSchema.nodes.deckSlide.create({ kind: '', body: `![](${old})\n\nWords.` })
    const state = EditorState.create({ doc: deckSchema.node('doc', null, [slide]) })
    const swap = putSlidePicture(state, { slide: { index: 0 }, side: false, path: old, nth: 0 },
      { picture: { path: 'new.png', url: display, describe: () => '' } }, { load: loadSlide, save: saveSlide })
    assert.ok(swap)
    assert.equal(slidesOf(swap.tr.doc)[0]?.data.markdown, '![](new.png)\n\nWords.')
  })
}

test('a webview image without a relative path keeps its local file, never the display address, never dropped', () => {
  assert.equal(save(`<img src="${display}" alt="a">`), '![a](/Users/me/docs/img/a.png)')
})

test('swapping a side picture into the slide words drops the previous picture spelling', () => {
  const doc = loadSlide('![](<missing.png>)')
  const swap = flowToSide(EditorState.create({ doc }), 0, 'right', { image: 'new.png', url: display })
  assert.ok(swap)
  assert.equal(swap.doc.firstChild?.attrs.mdImageTarget, null)
  assert.equal(saveSlide(swap.doc), '![](new.png)')
})

for (const [picture, path, definition] of [
  ['![](./x.png "t")', './x.png', ''],
  ['![](<a b.png> "t")', 'a b.png', ''],
  ['![](images/my%20pic.png)', 'images/my%20pic.png', ''],
  ['![](a(1).png)', 'a(1).png', ''],
  ['![a][ref]', 'x.png', '\n[ref]: x.png\n'],
] as const) {
  test(`saving untouched ${picture} with its display mapping`, () => {
    const source = `${picture}\n${definition}`
    const opened = openDocument(source, { [path]: display })
    assert.equal(opened.doc.firstChild?.attrs.src, display)
    assert.equal(saveDocument(opened), source)
  })
}

test('editing a picture destination keeps its author title', () => {
  const opened = openDocument('![](./x.png "a &quot;quote&quot; and \\\\ slash")\n')
  const state = EditorState.create({ doc: opened.doc })
  const tr = state.tr.setNodeMarkup(0, undefined, { ...opened.doc.firstChild!.attrs, src: './new.png' })
  const saved = saveDocument(opened, tr.doc)
  assert.equal(openDocument(saved).doc.firstChild?.attrs.title, opened.doc.firstChild?.attrs.title)
  assert.equal(openDocument(saved).doc.firstChild?.attrs.src, './new.png')
})

test('replacing a mapped picture keeps its author title', () => {
  const opened = openDocument('![](./x.png "t")\n', { './x.png': display })
  const tr = replacePicture(EditorState.create({ doc: opened.doc }), 0, { src: display, title: './new.png' })
  assert.ok(tr)
  assert.equal(saveDocument(opened, tr.doc), '![](./new.png "t")\n')
})

for (const [picture, definitions] of [
  ['![Alt][UPPER]', '[upper]: <a b.png> \'Title\'\n[UPPER]: another.png'],
  ['![ref][]', '[ref]: x.png'],
  ['![ref]', '[ref]: x.png'],
] as const) {
  test(`saving ${picture} keeps its definitions where they were written`, () => {
    for (const source of [
      `${definitions}\n\n${picture}\n`,
      `# Heading\n${definitions}\n${picture}\n`,
    ]) {
      assert.equal(saveDocument(openDocument(source)), source)
    }
  })
}

test('an escaped destination uses the exact host mapping key and keeps its spelling', () => {
  const path = 'a\\(1\\).png'
  const source = `![](${path})\n`
  const opened = openDocument(source, { [path]: display })
  assert.equal(opened.doc.firstChild?.attrs.src, display)
  assert.equal(saveDocument(opened), source)
})
