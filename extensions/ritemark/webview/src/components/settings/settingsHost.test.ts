/**
 * Sprint 147, PR 3 (R10, decision 2): the page's side of the host change. It draws from `settings` alone, each part
 * fills its rows in, and a row still waiting reads Checking…; the saved-key eye asks for one key and drops it.
 *
 * Run: npx tsx webview/src/components/settings/settingsHost.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { composeSettings, withPart, afterBase, splitSettings, CHECKING, PENDING_PARTS } = await import('./settingsParts')
const { requestSavedKey, afterEyeCloses } = await import('./apiKeyReveal')
const { AiAccountsSection } = await import('./AiAccountsSection')
const { AiDetailsRows } = await import('./AiDetailsSheet')
const { partsLine, runtimeLine } = await import('./AdvancedSection')
const { ApiKeysRows, SAVED_KEY_PLACEHOLDER } = await import('./ApiKeysSheet')
type Settings = import('./RitemarkSettings').SettingsData
type Base = import('./settingsParts').SettingsBase

const HERE = dirname(fileURLToPath(import.meta.url))

const voiceModel = { installed: true, modelName: 'large-v3-turbo', filename: 'ggml.bin', managedBy: 'ritemark' as const, sizeBytes: 1, sizeDisplay: '1 B' }
const updateCenter = {
  state: 'up-to-date' as const, currentAppVersion: '2.2.0', currentExtensionVersion: '2.2.0', updatesEnabled: true,
  lastCheckedAt: 1, lastSuccessfulCheckAt: 1, lastFailedCheckAt: 0, skippedVersion: '', snoozeUntil: 0,
  pendingRestartVersion: '', feedSource: 'feed' as const,
}
const base: Base = {
  codexIntegration: true, codexApprovalPolicy: 'on-request', codexSandboxMode: 'workspace-write', agentRuntimePreference: 'bundled',
  usageData: { on: true, fromRitemark1: false }, updatesEnabled: true, agentTimeout: 15, debugTrace: false,
  openaiKeyConfigured: true, googleKeyConfigured: false, anthropicKeyConfigured: false, opencodeEnabled: true, opencodeAutoApprove: false,
  openrouterEnabled: true, openrouterKeyConfigured: false, transcriptionEnabled: true, elevenlabsKeyConfigured: false, chatFontSize: 13,
  googleDocs: null, currentTheme: 'ritemark-light', availableThemes: [], updateCenter, voiceModel,
}
const runtimeStatus = { runtime: 'installed' as const, source: 'bundled' as const, auth: 'ready' as const }
const claudeCode: Settings['componentStatus']['claudeCode'] = {
  installed: true, runnable: true, authenticated: true, version: '2.1.0', sdkVersion: '0.3.310', binaryPath: '/x/claude',
  authMethod: 'claude-oauth', managedBy: 'user', state: 'ready', error: null, diagnostics: [], repairAction: null, runtimeStatus,
}
const codex: Settings['componentStatus']['codex'] = {
  installed: true, version: '0.50', managedBy: 'user', state: 'ready', error: null, diagnostics: [], repairCommand: null, compatibility: null, runtimeStatus,
}

// --- Draw first: `settings` alone draws the page; every probe's rows wait ----------------------------------------
assert.equal(composeSettings(null, {}), null, 'nothing before settings')
const first = composeSettings(base, {})!
assert.deepEqual(Object.keys(first.pending ?? {}).sort(), [...PENDING_PARTS].sort(), 'every probed part waits')
assert.equal(first.agentTimeout, 15, 'the settings themselves draw at once')
assert.equal(first.openaiKeyConfigured, true, 'which keys are saved draws at once')
assert.equal(first.updateCenter.state, 'up-to-date', "the update snapshot draws at once")
assert.equal(first.componentStatus.voiceModel.installed, true, 'the voice model draws at once (no probe)')

const accounts = (settings: Settings, codexAuth: object = { enabled: true }) => renderToStaticMarkup(createElement(AiAccountsSection as never, {
  settings, codexAuth, codexSigningIn: false, testResults: {}, onClaude() {}, onCodex() {}, onDetails() {}, onKeys() {},
}))
const waiting = accounts(first)
assert.equal((waiting.match(new RegExp(CHECKING, 'g')) ?? []).length, 2, "Claude's and ChatGPT's rows say Checking…")
assert.doesNotMatch(waiting, />Sign in</, 'no Sign in before the answer: it might be signed in')
assert.doesNotMatch(waiting, />Install</, 'no Install before the answer')
assert.match(waiting, />Details…</, 'Details stays')
assert.match(waiting, /data-settings-row="I32 I33 I34/, 'the API keys row draws at once')
assert.equal(partsLine(first.componentStatus, first.pending), CHECKING)
assert.equal(runtimeLine(first), `Now: ${CHECKING}`)
const sheet = renderToStaticMarkup(createElement(AiDetailsRows as never, { ai: 'claude', settings: first, codexAuth: { enabled: true }, codexSigningIn: false, testResults: {}, onClaude() {}, onCodex() {}, onKeys() {} }))
assert.match(sheet, new RegExp(CHECKING), "Claude's Details says Checking… until its answer")

// --- Fill in: each part fills its own rows, the others still wait ----------------------------------------------
let parts = withPart({}, 'codex', codex)
const half = composeSettings(base, parts)!
assert.equal(half.pending?.codex, undefined, "ChatGPT's answer is in")
assert.equal(half.pending?.claudeCode, true, "Claude's is still out")
const halfRow = accounts(half, { enabled: true, authenticated: true, email: 'test@example.com' })
assert.equal((halfRow.match(new RegExp(CHECKING, 'g')) ?? []).length, 1, 'only Claude still checks')
assert.match(halfRow, /Signed in as test@example\.com/)
parts = withPart(withPart(withPart(parts, 'claudeCode', claudeCode), 'environment', null), 'transcriptionStorageBytes', 2048)
const full = composeSettings(base, parts)!
assert.deepEqual(full.pending, {}, 'every part in')
assert.equal(full.transcriptionStorageBytes, 2048)
assert.doesNotMatch(accounts(full, { enabled: true, authenticated: true }), new RegExp(CHECKING))

// A first update check's answer shows until settings comes again, whose snapshot is newer
parts = withPart(parts, 'updateCenter', { ...updateCenter, state: 'update-available' })
assert.equal(composeSettings(base, parts)!.updateCenter.state, 'update-available')
assert.equal(composeSettings(base, afterBase(parts))!.updateCenter.state, 'up-to-date', 'settings again: its snapshot wins')
assert.equal(afterBase(parts).claudeCode, claudeCode, 'settings again keeps every other part (no redraw to Checking…)')

// A recorded full payload splits and composes back to itself
const split = splitSettings(full)
assert.deepEqual(composeSettings(split.base, split.parts), full)

// --- The eye asks for one key, and only that key --------------------------------------------------------------
{
  const posted: unknown[] = []
  let handler: ((data: unknown) => void) | null = null
  const port = {
    post: (message: unknown) => posted.push(message),
    listen: (h: (data: unknown) => void) => { handler = h; return () => { handler = null } },
  }
  const asked = requestSavedKey('openai-api-key', port)
  assert.equal(posted.length, 1, 'one request')
  const request = posted[0] as { type: string; key: string; requestId: string }
  assert.equal(request.type, 'apiKey:reveal')
  assert.equal(request.key, 'openai-api-key', 'for that one key')
  handler!({ type: 'apiKey:revealed', requestId: 'someone-else', value: 'sk-wrong' })
  handler!({ type: 'apiKey:revealed', requestId: request.requestId, value: 'sk-saved' })
  assert.equal(await asked, 'sk-saved')
  assert.equal(handler, null, 'it stops listening once answered')

  const none = requestSavedKey('openai-api-key', port)
  handler!({ type: 'apiKey:revealed', requestId: (posted[1] as { requestId: string }).requestId, value: null })
  assert.equal(await none, null, 'no saved key: nothing shown')
  assert.equal(await requestSavedKey('openai-api-key', { post() {}, listen: () => () => {} }, 10), null, 'no answer: nothing shown')
}
// Closing the eye drops the saved key; a key typed over it stays, hidden
assert.equal(afterEyeCloses('sk-saved', 'sk-saved'), '')
assert.equal(afterEyeCloses('sk-new', 'sk-saved'), 'sk-new')
assert.equal(afterEyeCloses('sk-new', null), 'sk-new')
{
  const source = readFileSync(join(HERE, 'ApiKeysSheet.tsx'), 'utf8')
  const close = source.slice(source.indexOf('const close = () => {\n    openedAt'), source.indexOf('const toggleEye'))
  assert.match(close, /setDraft\(''\)/, 'closing the field drops what it showed')
  assert.match(close, /setRevealed\(null\)/, 'closing the field drops the saved key')
  assert.match(source, /if \(ticket !== openedAt\.current\) return/, 'an answer after the field closed is dropped')
  assert.match(source, /if \(saved && !draft && onReveal\)/, 'only a saved key, with an empty field, is asked for')
  assert.doesNotMatch(source, /settings\[row\.value\]/, 'the field never fills from the page\'s data')
  // The sheet's rows live only while it is open (Radix unmounts closed content): closing the sheet drops the state
  assert.doesNotMatch(readFileSync(join(HERE, '../ui/dialog.tsx'), 'utf8'), /forceMount/)
  const page = readFileSync(join(HERE, 'RitemarkSettings.tsx'), 'utf8')
  assert.match(page, /onReveal=\{\(name\) => requestSavedKey\(name, revealPort\)\}/, 'the sheet asks the host through the eye')
}
// A saved key's row draws no value, and its field's placeholder says the eye shows it
const savedRow = renderToStaticMarkup(createElement(ApiKeysRows as never, { settings: full, testing: {}, results: {}, onSave() {}, onTest() {}, onReveal: async () => 'sk-x' }))
assert.doesNotMatch(savedRow, /sk-x/)
assert.ok(SAVED_KEY_PLACEHOLDER.includes('eye'))

console.log('settingsHost.test.ts: all assertions passed')
