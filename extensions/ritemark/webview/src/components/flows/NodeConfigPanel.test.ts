/**
 * Sprint 145 R5 (#580): a step without its key says one sentence in its panel, with the fix as a link to Settings.
 *
 * The AI step and the image step draw it with one piece (`StepKeyNotice`), from the host's `flow:models` answer
 * (`stepKeyAnswer` in `src/flows/flowModelDefaults.ts`): the sentence, then "Add it in Settings" as a link button
 * that asks the host to open Settings at that key. No warning sign. The tooltip's words come from the same answer;
 * Radix renders the tooltip only on hover, so the dev-instance run checks it (S30–S32).
 *
 * Run: npx tsx webview/src/components/flows/NodeConfigPanel.test.ts
 */
import assert from 'node:assert/strict'

const posted: unknown[] = []
Object.assign(globalThis, {
  window: { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1440 },
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => posted.push(message), getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
;(globalThis as unknown as { React: unknown }).React = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { StepKeyNotice } = await import('./NodeConfigPanel')
const { OPENAI_KEY_NEEDED, GOOGLE_AI_KEY_NEEDED, stepKeyAnswer } = await import('../../../../src/flows/flowModelDefaults')

for (const copy of [OPENAI_KEY_NEEDED, GOOGLE_AI_KEY_NEEDED]) {
  const answer = stepKeyAnswer(copy)
  const html = renderToStaticMarkup(React.createElement(StepKeyNotice, { text: answer.error, action: answer.errorAction }))
  const root = parse(`<p>${html}</p>`)
  const text = root.textContent.replace(/\s+/g, ' ').trim()
  assert.equal(text, `${copy.text} ${copy.action}`, 'the sentence, then the link, as one line')
  assert.ok(!/⚠/.test(text), 'no warning sign')
  const buttons = root.querySelectorAll('button')
  assert.equal(buttons.length, 1, 'one control: the link')
  assert.equal(buttons[0].textContent.trim(), 'Add it in Settings')
  assert.equal(buttons[0].getAttribute('type'), 'button')
  assert.ok(!buttons[0].hasAttribute('title'), 'a tooltip, never a native title')
}

console.log('NodeConfigPanel.test.ts passed')
