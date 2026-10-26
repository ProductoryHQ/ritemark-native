/**
 * Sprint 143 (#511, R6, S26): the person's message keeps its line breaks in
 * the bubble every AI's view draws (a task card's title, Done when and Files).
 *
 * Run: npx tsx webview/src/components/ai-sidebar/chatBubbles.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { UserPromptBubble } = await import('./ChatBubbles')

const card = 'Draft Module 4 from the brief\n\nDone when: Module 4 has the case, five questions and a closing exercise\n\nFiles: Brief.md, Modules/Module 4.md'
const markup = renderToStaticMarkup(createElement(UserPromptBubble, { activeFilePath: '/p/Brief.md', activeFileLabel: 'Draft Module 4 from the brief', children: card }))

const text = markup.match(/<div class="([^"]*)" data-user-prompt-text="true">([\s\S]*?)<\/div>/)
assert.ok(text, `the message is in its own element: ${markup}`)
assert.match(text[1], /\bwhitespace-pre-wrap\b/, 'its line breaks are kept')
assert.match(text[1], /overflow-wrap:anywhere/, 'a long path wraps')
assert.equal(text[2], card.replace(/&/g, '&amp;'), 'the text is unchanged, newlines included')
// The task mark's row above it is not in the pre-wrap element.
assert.ok(markup.indexOf('Draft Module 4 from the brief') < markup.indexOf('data-user-prompt-text'), 'the label row comes first')

console.log('chatBubbles: all passed')
