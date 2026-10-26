/**
 * Sprint 139 (R1, #496): which plans work, before sign-in, in one place.
 *
 * Run: npx tsx webview/src/components/welcome/welcomeCopy.test.ts
 */

import assert from 'node:assert/strict'
import { COPY, PLAN_LINES, PROVIDER_NAMES } from './welcomeCopy'

assert.deepEqual(PLAN_LINES, {
  chatgpt: 'Sign in with any plan, free included.',
  claude: 'Sign in with a paid plan, such as Pro or Max.',
  opencode: 'Open models, with an API key of your own.',
}, "the three lines, in Jarmo's words (shape decision, 21 October)")
assert.equal(new Set(Object.values(PLAN_LINES)).size, 3, 'one line per provider')
assert.equal(COPY.openCodeLine, PLAN_LINES.opencode, "OpenCode's line is unchanged")
assert.ok(!('accountLine' in COPY), 'the shared line that said nothing about plans is gone')

const everyWord = JSON.stringify({ COPY, PLAN_LINES, PROVIDER_NAMES })
assert.doesNotMatch(everyWord, /codex/i, "people's names only: ChatGPT, never Codex")

console.log('welcomeCopy.test.ts: all tests passed')
