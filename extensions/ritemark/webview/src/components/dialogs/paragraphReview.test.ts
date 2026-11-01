/**
 * Sprint 145 R1 (revised 1 November, #588): experience 44's words for a paragraph both the person and a writer
 * changed, and the document bar's button for every conflict (ink with a hairline, two arrows parting).
 *
 * Run: npx tsx webview/src/components/dialogs/paragraphReview.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { paragraphReviewWords } = await import('./paragraphReviewWords')
const { SyncActionButton } = await import('../header/DocumentHeader')
const { DocumentConflictHeader, ParagraphQuote } = await import('./DocumentConflictDialog')
const { Dialog } = await import('../ui/dialog')

// The words: the AI by name only when Ritemark knows it; otherwise another app. One paragraph, or several.
const claude = paragraphReviewWords(1, 'Claude')
assert.equal(claude.tooltip, 'Claude also changed the paragraph you were writing in. Yours is kept. Review changes shows both.')
assert.equal(claude.title, 'A paragraph changed in two places')
assert.equal(claude.line, 'Claude changed a paragraph you were writing in. Ritemark kept yours in the document.')
assert.equal(claude.mineLabel, 'Yours, in the document')
assert.equal(claude.theirsLabel, "Claude's")
assert.equal(claude.useTheirs, "Use Claude's")
assert.equal(claude.keepMine, 'Keep mine')
assert.equal(paragraphReviewWords(2, 'Claude').tooltip, 'Claude also changed 2 paragraphs you were writing in. Yours are kept. Review changes shows both versions.')
const other = paragraphReviewWords(1)
assert.equal(other.tooltip, 'Another app saved a copy that changes the paragraph you were writing in. Yours is kept. Review changes shows both.')
assert.equal(other.theirsLabel, 'The other copy')
assert.equal(other.useTheirs, 'Use the other copy')
assert.match(paragraphReviewWords(3).tooltip, /changes 3 paragraphs you were writing in\. Yours are kept\./)

// The button: a conflict in ink with a hairline and the arrows-split icon, never the amber warning; the failed
// sync keeps its own look.
const conflict = parse(renderToStaticMarkup(React.createElement(SyncActionButton, {
  action: { kind: 'conflict', label: 'Review changes', title: other.tooltip, onClick: () => {} },
}))).querySelector('button')
assert.ok(conflict, 'a button')
const conflictClass = conflict.getAttribute('class') ?? ''
assert.ok(conflictClass.includes('text-ink-strong') && conflictClass.includes('border-[var(--r-hairline-strong)]'), 'ink with a hairline')
assert.ok(!conflictClass.includes('--r-warning'), 'not the amber warning')
assert.equal(conflict.getAttribute('aria-label'), 'Review changes')
assert.equal(conflict.textContent.trim(), 'Review changes')

const failed = parse(renderToStaticMarkup(React.createElement(SyncActionButton, {
  action: { kind: 'retry', label: 'Try again', onClick: () => {} },
}))).querySelector('button')
assert.ok((failed?.getAttribute('class') ?? '').includes('text-[var(--r-error)]'), 'the failed sync keeps its look')

// The dialog's two paragraphs (experience 44's frame 3, redrawn in ritemark-dev 5336968): plain quoted blocks, not
// fields. A soft fill, no border, radius 8, padding 10 x 12; the label inside at the top, 11/14 semibold uppercase
// with 0.5 px letter-spacing in muted ink; the paragraph in the editor's font at 14/22 in strong ink, at its full
// length; selectable, never editable.
const quoteMarkup = renderToStaticMarkup(React.createElement(ParagraphQuote, { label: claude.mineLabel, text: 'Line one.\nLine two of a long paragraph.' }))
const quote = parse(quoteMarkup).querySelector('figure')
assert.ok(quote, 'a figure')
const quoteClass = quote.getAttribute('class') ?? ''
for (const token of ['bg-[var(--r-surface-soft)]', 'rounded-[8px]', 'px-3', 'py-[10px]', 'select-text']) assert.ok(quoteClass.includes(token), token)
assert.ok(!/\bborder\b|border-/.test(quoteClass), 'no border')
const label = quote.querySelector('figcaption')
assert.equal(label?.textContent.trim(), 'Yours, in the document', 'the words; CSS makes them uppercase')
const labelClass = label?.getAttribute('class') ?? ''
for (const token of ['text-[11px]', 'leading-[14px]', 'font-semibold', 'uppercase', 'tracking-[0.5px]', 'text-[var(--r-ink-muted)]']) assert.ok(labelClass.includes(token), token)
const paragraph = quote.querySelector('p')
assert.equal(paragraph?.textContent.trim(), 'Line one.\nLine two of a long paragraph.')
const paragraphClass = paragraph?.getAttribute('class') ?? ''
for (const token of ['font-editor', 'text-[14px]', 'leading-[22px]', 'text-[var(--r-ink-strong)]', 'whitespace-pre-wrap']) assert.ok(paragraphClass.includes(token), token)
assert.ok(!/max-h-|overflow-auto/.test(paragraphClass), 'its full length, no scroll box')
assert.ok(!/<input|<textarea|<blockquote|contenteditable/i.test(quoteMarkup), 'never editable, and no blockquote (VS Code\'s webview stylesheet fills those)')

// The fallback question's header (ritemark-dev 8408035): its title alone, no warning icon, as the paragraph dialog.
const headerMarkup = renderToStaticMarkup(React.createElement(Dialog, { open: true }, React.createElement(DocumentConflictHeader, { onClose: () => {} })))
const titleRow = parse(headerMarkup).querySelector('div > div')
assert.ok(titleRow, 'the title row')
assert.equal(titleRow.textContent.trim(), 'Document changed in two places')
assert.equal(titleRow.querySelectorAll('svg').length, 0, 'no icon beside the title')
assert.ok(!headerMarkup.includes('--r-warning'), 'no warning colour')
assert.ok(headerMarkup.includes('aria-label="Close dialog"'), 'the close button stays')

console.log('ok - paragraph review words, the conflict button, the quoted paragraphs and the fallback header')
