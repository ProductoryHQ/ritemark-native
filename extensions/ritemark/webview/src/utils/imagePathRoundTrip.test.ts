import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marked } from 'marked'
import { installTestDocument, openDocument, saveDocument, typeAtEndOfLastParagraph } from './markdownFidelity'
import { applyImageMappings, createEditorTurndownService, markdownToEditorHTML } from './editorMarkdown'
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
for (const path of ['Kickoff files/photo.png', 'Kickoff [files]/Õppepäev $& photo.png']) {
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
