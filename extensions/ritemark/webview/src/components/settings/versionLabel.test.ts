/**
 * Sprint 145 (R7, #595, S37): Settings' versions line reads "Extension 2.2.0", not the bundled copy's floored
 * "2.2.0-0". Only a bare "-0" at the end goes: an update's own "-ext.N" and any other value show as they are.
 * The update code keeps the floored value for its comparison (S38 is its own tests, unchanged).
 *
 * Run: npx tsx webview/src/components/settings/versionLabel.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extensionVersionLabel } from './versionLabel'

const cases: Array<[string, string]> = [
  ['2.2.0-0', '2.2.0'], // the production build's floor (scripts/floor-bundled-extension.sh)
  ['2.2.0-ext.1', '2.2.0-ext.1'], // an over-the-air update's own version
  ['2.2.0-ext.10', '2.2.0-ext.10'],
  ['2.2.0', '2.2.0'], // a dev build reads its source version
  ['2.2.0-10', '2.2.0-10'], // not a bare -0
  ['2.2.0-ext.0', '2.2.0-ext.0'],
  ['0.0.0', '0.0.0'], // versionService's fallback
  ['', ''],
]
for (const [version, expected] of cases) {
  assert.equal(extensionVersionLabel(version), expected, `"${version}" shows as "${expected}"`)
}

// The versions line passes the extension's version through it, and nothing else on the page does: the version an
// update will activate and the update on offer are -ext.N values, shown as they are.
const page = readFileSync(fileURLToPath(new URL('./RitemarkSettings.tsx', import.meta.url)), 'utf-8')
assert.match(
  page,
  /App \{settings\.updateCenter\.currentAppVersion\} · Extension \{extensionVersionLabel\(settings\.updateCenter\.currentExtensionVersion\)\}/,
  'the versions line shows the extension version through the label',
)
assert.equal(page.match(/extensionVersionLabel\(/g)?.length, 1, 'the label is used once, for the installed extension')
assert.match(page, /Extension \{settings\.updateCenter\.pendingRestartVersion\} is installed/, 'a pending update shows its own version')
assert.match(page, /\{settings\.updateCenter\.availableUpdate\.version\}/, 'the update on offer shows its own version')

// The update code still compares the floored version: Settings' host reads it unchanged.
const updateService = readFileSync(fileURLToPath(new URL('../../../../src/update/updateService.ts', import.meta.url)), 'utf-8')
assert.match(updateService, /currentExtensionVersion: getCurrentVersion\(\),/, 'the host sends the floored version as it is')

console.log('versionLabel: all passed')
