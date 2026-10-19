/**
 * Sprint 134 (R23): the foot of Ritemark Settings, Advanced settings, opens VS
 * Code's own settings page, with a tooltip that says what is there.
 *
 * Run: npx tsx webview/src/components/settings/advancedSettings.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { ADVANCED_SETTINGS, AdvancedSettingsLink } = await import('./AdvancedSettingsLink')

const source = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf-8')

assert.deepEqual(ADVANCED_SETTINGS, {
  label: 'Advanced settings',
  tooltip: 'Feature switches, updates, excluded folders and every other setting',
  message: 'settings:openAdvanced',
})

// One link-styled button at the foot, single line, named as the spec says.
const markup = renderToStaticMarkup(createElement(AdvancedSettingsLink, { post: () => {} }))
assert.match(markup, /^<footer[^>]*>.*<button[^>]*>Advanced settings<\/button>.*<\/footer>$/s)

// The page shows it last, posting through the bridge, and the host opens VS Code's settings for it.
const page = source('./RitemarkSettings.tsx')
assert.match(page, /<AdvancedSettingsLink post=\{\(type\) => vscode\.postMessage\(\{ type \}\)\} \/>\s*<\/div>\s*\);\s*\}\s*$/m)
const host = source('../../../../src/settings/RitemarkSettingsProvider.ts')
assert.match(host, /case 'settings:openAdvanced':\s*await vscode\.commands\.executeCommand\('workbench\.action\.openSettings'\);/)

console.log('advancedSettings: all passed')
