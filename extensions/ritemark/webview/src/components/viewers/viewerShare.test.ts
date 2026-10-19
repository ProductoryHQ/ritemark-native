/**
 * Sprint 134 (R19) — the PDF and Word bars: Make an editable copy, and Share's
 * two items on the Mac and on Windows, each with the message it posts to the host.
 *
 * Run: npx tsx webview/src/components/viewers/viewerShare.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EDITABLE_COPY_ICON,
  EDITABLE_COPY_LABEL,
  SHARE_LABEL,
  editableCopyLabel,
  editableCopyTooltip,
  guessPlatform,
  parsePlatform,
  postShareItem,
  shareMenuItems,
  shareTooltip,
  type ShareMenuItem,
} from './viewerShare'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { ShareMenu, ToolbarDivider, ToolbarTextButton } = await import('./ViewerToolbar')

const source = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf-8')

/** What each item says and posts: [label, message]. */
const summary = (items: ShareMenuItem[]) => items.map((item) => [item.label, item.message])

/** The messages the items post through the bridge. */
function posted(items: ShareMenuItem[]): string[] {
  const sent: string[] = []
  for (const item of items) postShareItem(item, (type) => sent.push(type))
  return sent
}

// ── Make an editable copy: the new words for Save as Markdown ──

assert.equal(EDITABLE_COPY_LABEL, 'Make an editable copy')
assert.equal(editableCopyLabel(false), 'Make an editable copy')
assert.equal(editableCopyLabel(true), 'Converting…', 'while the conversion runs')
assert.equal(EDITABLE_COPY_ICON, 'note-pencil', 'the drawing’s pencil on a page')
assert.match(editableCopyTooltip('pdf', false), /^Save a copy of this PDF as a Markdown document you can edit/)
assert.match(editableCopyTooltip('docx', false), /^Save a copy of this Word document as a Markdown document you can edit/)
assert.equal(editableCopyTooltip('pdf', true), 'Converting the PDF to a Markdown document')

// The bars use those words, the same handler and the same flag.
const pdfViewer = source('./PDFViewer.tsx')
const docxViewer = source('./DOCXViewer.tsx')
for (const [name, viewer] of [['PDF', pdfViewer], ['Word', docxViewer]] as const) {
  assert.doesNotMatch(viewer, /'Save as Markdown'/, `${name}: "Save as Markdown" is gone from the bar`)
  assert.match(viewer, /editableCopyLabel\(isSavingMd\)/, `${name}: the bar says Make an editable copy`)
  assert.match(viewer, /handleSaveAsMarkdown/, `${name}: the same handler`)
  assert.match(viewer, /<ShareMenu items=\{shareItems\} onSelect=\{\(item\) => postShareItem\(item, sendToExtension\)\} \/>/, `${name}: Share posts its item's message`)
  assert.match(viewer, /sendToExtension\('getOpenStatus'\)/, `${name}: the viewer asks the host for the system`)
}
// PDF: the button sits on the bar beside Share, only behind the flag.
assert.match(
  pdfViewer,
  /\{canSaveAsMarkdown && \(\s*<>\s*<ToolbarTextButton\s+icon=\{EDITABLE_COPY_ICON\}[\s\S]*?<ToolbarDivider \/>\s*<\/>\s*\)\}\s*<ShareMenu /,
  'PDF: Make an editable copy, a divider, then Share at the end of the bar'
)
// Word: it stays in Open in Word's menu, only behind the flag; Share follows the split button.
assert.match(
  docxViewer,
  /actions=\{canSaveAsMarkdown && ready\s*\? \[\{ icon: EDITABLE_COPY_ICON, label: editableCopyLabel\(isSavingMd\), onSelect: handleSaveAsMarkdown/,
  'Word: Make an editable copy is the Open in Word menu’s item'
)
assert.match(docxViewer, /<SplitButton[\s\S]*?\/>\s*<ToolbarDivider \/>\s*<ShareMenu /, 'Word: Open in Word ▾, a divider, then Share')
// Nothing on today's bar is removed: page, zoom, fit, find, and Open in Word.
for (const kept of ['<PageIndicator', '<ZoomControls', 'icon="magnifying-glass"']) {
  assert.ok(pdfViewer.includes(kept), `PDF keeps ${kept}`)
  assert.ok(docxViewer.includes(kept), `Word keeps ${kept}`)
}
assert.match(docxViewer, /label=\{openLabel\}\s+tooltip="See the document exactly as it is, and edit it"\s+onClick=\{handleOpenExternally\}/, 'Word keeps Open in Word')

// ── Share on a PDF ──

assert.deepEqual(summary(shareMenuItems('pdf', 'darwin')), [
  ['Show in Finder', 'revealInOS'],
  ['Open in Preview', 'openInExternalApp'],
], 'PDF on the Mac')
assert.deepEqual(summary(shareMenuItems('pdf', 'win32')), [
  ['Show in File Explorer', 'revealInOS'],
  ['Open in default app', 'openInExternalApp'],
], 'PDF on Windows: no Preview, the words the Word bar already uses')
assert.deepEqual(posted(shareMenuItems('pdf', 'darwin')), ['revealInOS', 'openInExternalApp'])
assert.deepEqual(posted(shareMenuItems('pdf', 'win32')), ['revealInOS', 'openInExternalApp'])
assert.equal(shareMenuItems('pdf', 'darwin', 'Open in Word')[1].label, 'Open in Preview', 'a PDF ignores the Word label')

// ── Share on a Word file: Open in Word takes the label the host sends ──

assert.deepEqual(summary(shareMenuItems('docx', 'darwin', 'Open in Word')), [
  ['Show in Finder', 'revealInOS'],
  ['Open in Word', 'openInExternalApp'],
], 'Word on the Mac')
assert.deepEqual(summary(shareMenuItems('docx', 'win32', 'Open in Word')), [
  ['Show in File Explorer', 'revealInOS'],
  ['Open in Word', 'openInExternalApp'],
], 'Word on Windows')
assert.equal(shareMenuItems('docx', 'darwin', 'Open in Pages')[1].label, 'Open in Pages', 'the host’s label: Pages')
assert.equal(shareMenuItems('docx', 'win32', 'Open in default app')[1].label, 'Open in default app', 'the host’s label: no Word')
assert.deepEqual(posted(shareMenuItems('docx', 'win32', 'Open in default app')), ['revealInOS', 'openInExternalApp'],
  'Open in Word posts what the bar’s own Open in Word button posts')
assert.match(docxViewer, /const handleOpenExternally = useCallback\(\(\) => \{\s*sendToExtension\('openInExternalApp'\)/,
  'the bar’s Open in Word button posts openInExternalApp too')

// ── Share holds only these two: no Export, no Google Docs ──

for (const kind of ['pdf', 'docx'] as const) {
  for (const platform of ['darwin', 'win32', 'linux'] as const) {
    const items = shareMenuItems(kind, platform)
    assert.equal(items.length, 2, `${kind} on ${platform}: two items`)
    for (const item of items) {
      assert.doesNotMatch(item.label, /Export|Google|PDF|Word document|Markdown/, `${kind}: no Export or Google Docs`)
      assert.ok(item.description.length > 0, 'each item says what it is for')
    }
  }
}
assert.equal(shareMenuItems('pdf', 'linux')[0].label, 'Show in folder')

// ── The system comes from the host ──

assert.equal(parsePlatform('darwin'), 'darwin')
assert.equal(parsePlatform('win32'), 'win32')
assert.equal(parsePlatform('linux'), 'linux')
assert.equal(parsePlatform('freebsd'), null)
assert.equal(parsePlatform(undefined), null)
assert.equal(guessPlatform('MacIntel'), 'darwin', 'until the host answers')
assert.equal(guessPlatform('Win32'), 'win32')
assert.equal(guessPlatform(undefined), 'linux')

// ── The Share button and the bar's pieces ──

assert.equal(SHARE_LABEL, 'Share')
assert.equal(shareTooltip(shareMenuItems('pdf', 'darwin')), 'Show in Finder, or open in Preview')
assert.equal(shareTooltip(shareMenuItems('docx', 'win32', 'Open in Word')), 'Show in File Explorer, or open in Word')

const shareHtml = renderToStaticMarkup(createElement(ShareMenu, { items: shareMenuItems('pdf', 'darwin'), onSelect: () => {} }))
assert.match(shareHtml, /<button[^>]*data-slot="button"[^>]*data-viewer-share[^>]*>Share<\/button>/, 'Share is a shadcn Button that says Share')
assert.match(shareHtml, /aria-haspopup="menu"/, 'Share opens a menu')
assert.doesNotMatch(shareHtml, /title=/, 'no native title: the tooltip says what it does')
assert.match(shareHtml, /whitespace-nowrap/, 'one line')

const copyHtml = renderToStaticMarkup(createElement(ToolbarTextButton, {
  icon: EDITABLE_COPY_ICON,
  label: editableCopyLabel(false),
  tooltip: editableCopyTooltip('pdf', false),
  onClick: () => {},
}))
assert.match(copyHtml, />Make an editable copy<\/button>/, 'the PDF bar’s button says Make an editable copy')
assert.match(copyHtml, /whitespace-nowrap/, 'one line')

assert.match(renderToStaticMarkup(createElement(ToolbarDivider)), /aria-hidden="true"/, 'the divider is not read out')

// The toolbar's Share uses the dropdown and tooltip components, never a hand-rolled menu.
const toolbar = source('./ViewerToolbar.tsx')
const shareComponent = toolbar.slice(toolbar.indexOf('export function ShareMenu'))
assert.match(shareComponent, /<DropdownMenu modal=\{false\}>/)
assert.match(shareComponent, /<Tooltip label=\{shareTooltip\(items\)\}>/)
assert.match(shareComponent, /<DropdownMenuItem key=\{item\.id\} onSelect=\{\(\) => onSelect\(item\)\}/)
assert.doesNotMatch(shareComponent, /<button/, 'no hand-rolled button')

console.log('viewerShare tests passed')
