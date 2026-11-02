/**
 * Sprint 134 (R23): VS Code's own settings page has a way in from Ritemark Settings, with a tooltip that says what is
 * there. Since Sprint 147 it is Advanced's More tools: All settings (experience 15, frame 3).
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
  label: 'All settings',
  tooltip: 'Feature switches, updates, excluded folders and every other setting',
  message: 'settings:openAdvanced',
})

// One link-styled button in More tools' line, single line, named as the drawing says.
const markup = renderToStaticMarkup(createElement(AdvancedSettingsLink, { post: () => {} }))
assert.match(markup, /More tools:.*<button[^>]*>All settings<\/button>.*every setting as one long list\./s)

// Advanced shows it, posting through the page's bridge, and the host opens VS Code's settings for it.
assert.match(source('./AdvancedSection.tsx'), /<AdvancedSettingsLink post=\{onOpenAllSettings\} \/>/)
assert.match(source('./RitemarkSettings.tsx'), /onOpenAllSettings=\{\(type\) => vscode\.postMessage\(\{ type \}\)\}/)
const host = source('../../../../src/settings/RitemarkSettingsProvider.ts')
assert.match(host, /case 'settings:openAdvanced':\s*await vscode\.commands\.executeCommand\('workbench\.action\.openSettings'\);/)

console.log('advancedSettings: all passed')
