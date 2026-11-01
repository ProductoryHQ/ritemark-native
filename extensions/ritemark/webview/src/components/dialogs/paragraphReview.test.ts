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

console.log('ok - paragraph review words and the conflict button')
