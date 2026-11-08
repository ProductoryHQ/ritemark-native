/**
 * Sprint 139 (R1, #496): which plans work, before sign-in, in one place.
 *
 * Run: npx tsx webview/src/components/welcome/welcomeCopy.test.ts
 */

import assert from 'node:assert/strict'
import { COPY, OPENCODE_SET_UP_TIP, PLAN_LINES, PROVIDER_NAMES, browserOpened, reopenTip, stopWaitingTip } from './welcomeCopy'

assert.deepEqual(PLAN_LINES, {
  chatgpt: 'Any plan works, free included.',
  claude: 'Needs a paid plan, such as Pro or Max.',
  opencode: 'Open models, with an API key of your own.',
}, "the three lines, facts that don't change with sign-in (the Experience lead, 26 October)")
for (const line of Object.values(PLAN_LINES)) {
  assert.doesNotMatch(line, /sign in/i, 'a line says which plans work, not what to do: the button row says Sign in')
}
assert.equal(new Set(Object.values(PLAN_LINES)).size, 3, 'one line per provider')
assert.equal(COPY.openCodeLine, PLAN_LINES.opencode, "OpenCode's line is unchanged")
assert.ok(!('accountLine' in COPY), 'the shared line that said nothing about plans is gone')

// Sprint 156: frame 2's words, shared with Home's card while it signs in
assert.equal(browserOpened('chatgpt'), 'Your browser opened ChatGPT’s sign-in page.')
assert.equal(stopWaitingTip('chatgpt'), 'Stop waiting for ChatGPT’s sign-in', 'Cancel\'s tooltip (the welcome adds its key, Escape)')
assert.equal(reopenTip('claude'), 'Open Claude’s sign-in page again')
assert.equal(COPY.reopen, 'Did nothing open? Open the page again')
assert.equal(OPENCODE_SET_UP_TIP, 'Add an API key of your own for OpenCode')

const everyWord = JSON.stringify({ COPY, PLAN_LINES, PROVIDER_NAMES, tips: [stopWaitingTip('chatgpt'), reopenTip('chatgpt'), OPENCODE_SET_UP_TIP] })
assert.doesNotMatch(everyWord, /codex/i, "people's names only: ChatGPT, never Codex")

console.log('welcomeCopy.test.ts: all tests passed')
