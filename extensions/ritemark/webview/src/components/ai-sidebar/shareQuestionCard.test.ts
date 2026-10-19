/**
 * Sprint 134 (R20, S55): the share question on the AI's sheet: its words per
 * AI (experience 28, frame 1), real buttons and a labelled box for the
 * keyboard and VoiceOver, and the answers it gives.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/shareQuestionCard.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { ShareQuestionCard, shareQuestionWords } = await import('./ShareQuestionCard')

assert.deepEqual(
  [shareQuestionWords('Claude').title, shareQuestionWords('ChatGPT').title, shareQuestionWords('OpenCode').title],
  ['Share this page with Claude?', 'Share this page with ChatGPT?', 'Share this page with OpenCode?'],
)
assert.equal(shareQuestionWords('Claude').line, 'Claude reads the page you have open, so you can ask about it. It cannot click or type on it without asking.')

const markup = renderToStaticMarkup(createElement(ShareQuestionCard, { aiName: 'ChatGPT', pageTitle: 'Ritemark', onAnswer: () => {} }))
const text = markup.replace(/<[^>]+>/g, '|').split('|').map((part) => part.trim()).filter(Boolean)
assert.deepEqual(text, [
  'Share this page with ChatGPT?',
  'Ritemark.',
  'ChatGPT reads the page you have open, so you can ask about it. It cannot click or type on it without asking.',
  'Share this page',
  'Not now',
  'Share pages I open in Ritemark without asking',
])
// A region named by its title; two buttons; the box is a checkbox its words label, unticked.
assert.match(markup, /^<section role="region" aria-labelledby="([^"]+)"[^>]*><h2 id="\1"/)
assert.equal(markup.match(/<button/g)?.length, 2)
const box = markup.match(/<label for="([^"]+)"[^>]*><input id="\1" type="checkbox"([^>]*)\/?>/)
assert.ok(box, 'the box is a labelled checkbox')
assert.doesNotMatch(box[2], /checked/)

console.log('shareQuestionCard: all passed')
