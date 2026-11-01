/**
 * Sprint 146 (R4, S23): `scripts/qa/control-states.mjs` reaches every state with real input. It may read and scroll
 * the page, but never clicks or focuses anything by script: no `.click(` and no `.focus(` anywhere in its source, so
 * none can sit in an expression it evaluates in the page. Its input goes through `Input.dispatchMouseEvent` and
 * `Input.dispatchKeyEvent`, and its exit code is 1 or 0, never a count (an exit status wraps at 256). An approved image
 * no cell made (a state deleted or renamed) fails a full comparison (Codex on #621).
 *
 * Run: npx tsx webview/src/components/catalogue/controlStatesScript.test.ts
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const QA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', 'scripts', 'qa')
const SCRIPT = join(QA, 'control-states.mjs')
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

// ── An approved image with no state: a fixture folder ─────────────────────────
const { unmatchedApprovedImages } = await import(pathToFileURL(join(QA, 'control-states-baseline.mjs')).href)
const folder = mkdtempSync(join(tmpdir(), 'rm-control-baseline-'))
try {
  for (const file of ['light-button-default-rest.png', 'dark-button-default-rest.png', 'light-gone-default-rest.png', 'dark-gone-default-rest.png', 'README.md']) {
    writeFileSync(join(folder, file), '')
  }
  // The catalogue now has the button's rest state only: the "gone" row was deleted or renamed
  const expected = (themes: string[]) => themes.map((name) => `${name}-button-default-rest.png`)
  const allThemes = ['light', 'dark']
  assert.deepEqual(
    unmatchedApprovedImages(folder, expected(allThemes), { themes: allThemes, allThemes }),
    ['dark-gone-default-rest.png', 'light-gone-default-rest.png'],
    "a full run fails on each approved image no cell made, and reads only the PNGs",
  )
  assert.deepEqual(
    unmatchedApprovedImages(folder, expected(allThemes), { themes: allThemes, allThemes, only: ['button'] }),
    [],
    'a run of named rows (--only) checks nothing: the other rows are rightly not in it',
  )
  assert.deepEqual(
    unmatchedApprovedImages(folder, expected(['dark']), { themes: ['dark'], allThemes }),
    ['dark-gone-default-rest.png'],
    "a run of one theme (--themes dark) checks that theme's images only",
  )
  assert.deepEqual(
    unmatchedApprovedImages(folder, [...expected(allThemes), 'light-gone-default-rest.png', 'dark-gone-default-rest.png'], { themes: allThemes, allThemes }),
    [],
    'every approved image has its cell: nothing to report',
  )
} finally {
  rmSync(folder, { recursive: true, force: true })
}
assert.match(source, /unmatchedApprovedImages\(baseline, expected, \{ themes, allThemes: Object\.keys\(THEME_LABEL\), only \}\)/, 'the comparison asks for them')
assert.match(source, /const bad = differing \+ unmatched \+/, 'and fails on them')

console.log('controlStatesScript.test.ts: all assertions passed')
