import assert from 'node:assert/strict'
import { createTurndownService } from './turndownService'
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
const service = createTurndownService()
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

console.log('imagePathRoundTrip: all assertions passed')
