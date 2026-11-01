/**
 * Sprint 146 (R4, S23): `scripts/qa/control-states.mjs` reaches every state with real input. It may read and scroll
 * the page, but never clicks or focuses anything by script: no `.click(` and no `.focus(` anywhere in its source, so
 * none can sit in an expression it evaluates in the page. Its input goes through `Input.dispatchMouseEvent` and
 * `Input.dispatchKeyEvent`, and its exit code is 1 or 0, never a count (an exit status wraps at 256).
 *
 * Run: npx tsx webview/src/components/catalogue/controlStatesScript.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', 'scripts', 'qa', 'control-states.mjs')
const source = readFileSync(SCRIPT, 'utf8')

/** Calls that act on the page instead of the window's input (pure, tested). */
export function scriptedInput(text: string): string[] {
  return [...text.matchAll(/\.(click|focus)\s*\(/g)].map((match) => match[0])
}
assert.deepEqual(scriptedInput("d.querySelector('button').click()"), ['.click('])
assert.deepEqual(scriptedInput('el.focus ({ preventScroll: true })'), ['.focus ('])
assert.deepEqual(scriptedInput("await clickAt(x, y); el.scrollIntoView({ block: 'center' })"), [])

assert.deepEqual(scriptedInput(source), [], 'control-states.mjs never clicks or focuses by script')
assert.match(source, /Input\.dispatchMouseEvent/, 'the pointer is the window\'s')
assert.match(source, /Input\.dispatchKeyEvent/, 'the keys are the window\'s')
assert.match(source, /Emulation\.setFocusEmulationEnabled/, 'a hidden window draws its focus as a front one')
assert.match(source, /process\.exit\(bad \? 1 : 0\)/, 'the exit code is 1 or 0, never a count')
assert.doesNotMatch(source, /process\.exit\((?:differing|failures\.length|bad)\)/, 'no count as an exit code')

console.log('controlStatesScript.test.ts: all assertions passed')
