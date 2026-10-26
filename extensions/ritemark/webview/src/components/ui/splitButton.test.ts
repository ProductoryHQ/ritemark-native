/**
 * Sprint 142 (R5, R5b, R5c, R9; #557, #505): one button, in one tone, as pure state; the board's agent button; the
 * ready request's chat reopened; and which focus may open a tooltip.
 *
 * Run: npx tsx webview/src/components/ui/splitButton.test.ts
 */
import assert from 'node:assert/strict'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { SplitButton, splitButtonState } = await import('./split-button')
const { agentSplitState } = await import('../tasks/AgentSplitButton')
const { focusOpensTooltip } = await import('./tooltip')
const { refillOnReopen } = await import('../ai-sidebar/store')

// Disabled and busy are the whole button's, never one half's (framework §3)
assert.deepEqual(splitButtonState({}), { wrapper: {}, mainDisabled: false, menuDisabled: false }, 'at rest')
assert.deepEqual(splitButtonState({ disabled: true }), { wrapper: { 'data-disabled': '' }, mainDisabled: true, menuDisabled: true }, 'disabled: both parts')
assert.deepEqual(splitButtonState({ busy: true }), { wrapper: { 'data-disabled': '', 'data-busy': '', 'aria-busy': true }, mainDisabled: true, menuDisabled: true }, 'busy: both parts, the caret too')
assert.deepEqual(splitButtonState({ on: true }), { wrapper: { 'data-on': '' }, mainDisabled: false, menuDisabled: false }, 'on (dictating): the caret still opens its menu')

// Drawn: one wrapper with its tone, the main part and the caret inside it, no tone on a part of its own
const markup = renderToStaticMarkup(React.createElement(SplitButton, {
  tone: 'primary',
  busy: true,
  main: { label: 'Giving it to Claude…', tooltip: 'Gives the task on the board to Claude', onClick: () => {} },
  menu: { label: 'Ask with', tooltip: 'Choose which AI asks', content: null },
}))
const root = parse(markup).querySelector('.rm-split')
assert.ok(root, 'one wrapper')
assert.equal(root.getAttribute('data-tone'), 'primary')
assert.equal(root.getAttribute('data-busy'), '')
const parts = root.querySelectorAll('button')
assert.equal(parts.length, 2, 'two parts')
assert.ok(parts.every((part) => part.hasAttribute('disabled')), 'busy turns off both parts')
assert.ok(parts[0].classList.contains('rm-split-main') && parts[1].classList.contains('rm-split-more'))
assert.equal(parts[1].getAttribute('aria-label'), 'Ask with')

// The board's agent button (R5c, Q2)
const runtimes = [
  { id: 'claude-code' as const, label: 'Claude', usable: true },
  { id: 'codex' as const, label: 'ChatGPT', usable: false },
  { id: 'opencode' as const, label: 'OpenCode', usable: false },
]
const tip = (agent: string) => `Try this task again with ${agent}`
assert.deepEqual(agentSplitState({ runtimes, selected: 'claude-code', disabled: false, tip }), { disabled: false, mainOpensMenu: false, mainTip: 'Try this task again with Claude', name: 'Claude', anyUsable: true }, 'the chosen agent is ready: the main part runs it')
assert.deepEqual(agentSplitState({ runtimes, selected: 'codex', disabled: false, tip }), { disabled: false, mainOpensMenu: true, mainTip: 'ChatGPT is not ready. Choose another agent.', name: 'ChatGPT', anyUsable: true }, 'not ready, another is: the main part opens the menu, never half disabled')
const signedOut = runtimes.map((runtime) => (runtime.id === 'codex' ? { ...runtime, message: 'ChatGPT is signed out. Sign in and try again.' } : runtime))
assert.equal(agentSplitState({ runtimes: signedOut, selected: 'codex', disabled: false, tip }).mainTip, 'ChatGPT is not ready. Choose another agent. ChatGPT is signed out. Sign in and try again.', "the runtime's own reason after the generic sentence (QA N2)")
assert.equal(agentSplitState({ runtimes, selected: 'claude-code', disabled: true, tip }).disabled, true, 'pending: the whole button')
assert.deepEqual(agentSplitState({ runtimes, selected: 'claude-code', disabled: false, disabledReason: 'Claude is already reviewing this', tip }).mainTip, 'Claude is already reviewing this')
const none = runtimes.map((runtime) => ({ ...runtime, usable: false }))
assert.deepEqual(agentSplitState({ runtimes: none, selected: 'claude-code', disabled: false, tip }), { disabled: true, mainOpensMenu: false, mainTip: 'Set up Claude, ChatGPT or OpenCode in the AI sidebar first', name: 'Claude', anyUsable: false }, 'no agent ready: the whole button off')

// The ready request's chat reopened (R5b): the request back only into an empty box
assert.deepEqual(refillOnReopen('', { text: 'This project is for \nThen write…', cursor: 20 }), { text: 'This project is for \nThen write…', cursor: 20 }, 'cleared: the request comes back')
assert.deepEqual(refillOnReopen('   ', { text: 'abc' }), { text: 'abc', cursor: 3 }, 'only spaces is empty; the cursor at the end when not given')
assert.equal(refillOnReopen('This project is for the board report', { text: 'This project is for ' }), null, 'the person’s own words stay')

// A focus that follows a click opens no tooltip; keyboard focus does (R9)
assert.equal(focusOpensTooltip({ matches: (selector) => selector === ':focus-visible' }), true, 'keyboard focus')
assert.equal(focusOpensTooltip({ matches: () => false }), false, 'a focus after a mouse press')
assert.equal(focusOpensTooltip({ matches: () => { throw new Error('unsupported') } }), true, 'no :focus-visible: as before')
assert.equal(focusOpensTooltip(null), false)

console.log('splitButton: all assertions passed')
