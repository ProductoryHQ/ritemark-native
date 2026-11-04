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
const { composeSettings, withPart, afterBase, splitSettings, PENDING_PARTS } = await import('./settingsParts')
const { WaitingMark, MARK_AFTER_MS } = await import('../ui/turning-mark')
const { AdvancedSection } = await import('./AdvancedSection')
/** A row waiting: its status label, nothing drawn yet. */
const WAITING_EMPTY = /role="status" aria-label="([^"]+)" data-waiting="empty"/g
const labels = (markup: string): string[] => [...markup.matchAll(WAITING_EMPTY)].map((match) => match[1])
const { requestSavedKey, afterEyeCloses, closeEye, eyeMustClose, RevealGate } = await import('./apiKeyReveal')
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
// The Experience lead (answer 9, the one loading look): no words while an answer comes. The line is empty for the
// first second, then the kit's turning mark; screen readers hear "Checking <the row>"
assert.deepEqual(labels(waiting), ['Checking Claude', 'Checking ChatGPT'], "Claude's and ChatGPT's lines wait, named for screen readers")
assert.doesNotMatch(waiting, /data-turning-mark/, 'the first second: no mark yet')
assert.doesNotMatch(waiting, /Checking…|Checking\.\.\./, 'no Checking… words')
assert.doesNotMatch(waiting, />Sign in</, 'no Sign in before the answer: it might be signed in')
assert.doesNotMatch(waiting, />Install</, 'no Install before the answer')
assert.match(waiting, />Details…</, 'Details stays')
assert.match(waiting, /data-settings-row="I32 I33 I34/, 'the API keys row draws at once')
assert.equal(partsLine(first.componentStatus, first.pending), null, "Ritemark's parts has no words while it waits")
assert.equal(runtimeLine(first), null, 'nor does where the AI runs from')
assert.equal(runtimeLine(composeSettings(base, { claudeCode, codex })!), null, 'the tools line still out: it waits too')
const advanced = renderToStaticMarkup(createElement(AdvancedSection as never, {
  settings: first, onSetting() {}, onClaude() {}, onCodex() {}, onClearTranscripts() {}, onOpenAllSettings() {},
}))
assert.deepEqual(labels(advanced), ['Checking where the AI runs from', "Checking Ritemark&#x27;s parts", "Checking transcripts&#x27; working files"])
assert.doesNotMatch(advanced, /Checking…/)
// After the second: the mark, still named; the mark is the kit's (ink top, the strong hairline, still under Reduce motion)
const later = renderToStaticMarkup(createElement(WaitingMark, { label: 'Checking Claude', afterMs: 0 }))
assert.match(later, /role="status" aria-label="Checking Claude" data-waiting="mark"/)
assert.match(later, /data-turning-mark/)
assert.match(later, /h-4 w-4/, '16 px')
assert.match(later, /motion-reduce:animate-none/, 'still under Reduce motion')
assert.match(later, /border-top-color:var\(--vscode-foreground\)/, 'ink')
assert.equal(MARK_AFTER_MS, 1000, 'the loading look\'s second')
{
  const source = readFileSync(join(HERE, '../ui/turning-mark.tsx'), 'utf8')
  assert.match(source, /setTimeout\(\(\) => setShown\(true\), afterMs\)/, 'the mark comes once the second is over')
  assert.match(readFileSync(join(HERE, '../ai-sidebar/RuntimeNotice.tsx'), 'utf8'), /<TurningMark \/>/, "RuntimeNotice's chip draws the same mark")
}
const sheet = renderToStaticMarkup(createElement(AiDetailsRows as never, { ai: 'claude', settings: first, codexAuth: { enabled: true }, codexSigningIn: false, testResults: {}, onClaude() {}, onCodex() {}, onKeys() {} }))
assert.deepEqual(labels(sheet), ['Checking Claude'], "Claude's Details waits the same way until its answer")

// --- Fill in: each part fills its own rows, the others still wait ----------------------------------------------
let parts = withPart({}, 'codex', codex)
const half = composeSettings(base, parts)!
assert.equal(half.pending?.codex, undefined, "ChatGPT's answer is in")
assert.equal(half.pending?.claudeCode, true, "Claude's is still out")
const halfRow = accounts(half, { enabled: true, authenticated: true, email: 'test@example.com' })
assert.deepEqual(labels(halfRow), ['Checking Claude'], 'only Claude still waits')
assert.match(halfRow, /Signed in as test@example\.com/)
parts = withPart(withPart(withPart(parts, 'claudeCode', claudeCode), 'environment', null), 'transcriptionStorageBytes', 2048)
const full = composeSettings(base, parts)!
assert.deepEqual(full.pending, {}, 'every part in')
assert.equal(full.transcriptionStorageBytes, 2048)
assert.deepEqual(labels(accounts(full, { enabled: true, authenticated: true })), [], 'every answer in: nothing waits')

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
// The review of #657: a shown saved key goes when the tab is hidden, and when the key is removed elsewhere
{
  const shown = { draft: 'sk-saved', revealed: 'sk-saved', show: true }
  assert.equal(eyeMustClose(shown, { hidden: true, saved: true }), true, 'the tab hidden: the eye closes')
  assert.equal(eyeMustClose(shown, { hidden: false, saved: false }), true, 'the key removed elsewhere: the eye closes')
  assert.equal(eyeMustClose(shown, { hidden: false, saved: true }), false, 'nothing changed: it stays open')
  assert.equal(eyeMustClose({ draft: '', revealed: null, show: false }, { hidden: true, saved: true }), false, 'no eye open: nothing to do')
  assert.deepEqual(closeEye(shown), { draft: '', revealed: null, show: false }, 'the saved key leaves the field and the state')
  // Codex on #657: hidden while the host still answers, then the answer comes: nothing shown or kept
  const waitingEye = { draft: '', revealed: null, show: false, pending: true }
  assert.equal(eyeMustClose(waitingEye, { hidden: true, saved: true }), true, 'a request still out is cancelled on hide')
  assert.equal(eyeMustClose(waitingEye, { hidden: false, saved: false }), true, 'and when the key is removed elsewhere')
  {
    const gate = new RevealGate()
    let draft = ''
    let revealedKey: string | null = null
    let show = false
    const press = async (answer: Promise<string | null>) => {
      const ticket = gate.begin()
      const value = await answer
      if (!gate.accepts(ticket)) return
      if (value) { draft = draft || value; revealedKey = value }
      show = true
    }
    let answer!: (value: string | null) => void
    const pressed = press(new Promise((resolve) => { answer = resolve }))
    gate.cancel() // the tab is hidden while SecretStorage answers
    answer('sk-saved')
    await pressed
    assert.deepEqual({ draft, revealedKey, show }, { draft: '', revealedKey: null, show: false }, 'the late answer is dropped')
    // A fresh press after that works as before
    await press(Promise.resolve('sk-saved'))
    assert.deepEqual({ draft, revealedKey, show }, { draft: 'sk-saved', revealedKey: 'sk-saved', show: true })
  }
  assert.deepEqual(closeEye({ draft: 'sk-typed', revealed: 'sk-saved', show: true }), { draft: 'sk-typed', revealed: null, show: false }, 'a typed key stays, hidden')
  const source = readFileSync(join(HERE, 'ApiKeysSheet.tsx'), 'utf8')
  assert.match(source, /eyeMustClose\(\{ draft, revealed, show, pending: revealing \}, \{ hidden: true, saved \}\)\) shutEye\(\)\s*\}, \[hideEyes\]\)/, 'each open row closes its eye when the tab is hidden')
  assert.match(source, /eyeMustClose\(\{ draft, revealed, show, pending: revealing \}, \{ hidden: false, saved \}\)\) shutEye\(\)\s*\}, \[saved\]\)/, 'and when its key is removed elsewhere')
  assert.match(source, /const shutEye = \(\) => \{\s*\/\/[^\n]*\n\s*gate\.current\.cancel\(\)/, 'closing the eye refuses a request still out')
  assert.match(source, /if \(!gate\.current\.accepts\(ticket\)\) return/, 'a refused answer sets nothing')
  assert.match(source, /setDraft\(\(current\) => current \|\| value\)/, 'text typed while the host answered is kept')
  const page = readFileSync(join(HERE, 'RitemarkSettings.tsx'), 'utf8')
  assert.match(page, /case 'settings:hidden':\s*setHideEyes/, "the host's hidden tab closes the eyes")
  assert.match(page, /document\.visibilityState === 'hidden'\) setHideEyes/, "the page's own visibilitychange too")
  assert.match(page, /hideEyes=\{hideEyes\}/)
  const host = readFileSync(join(HERE, '../../../../src/settings/RitemarkSettingsProvider.ts'), 'utf8')
  assert.match(host, /if \(!visible\) void panel\.webview\.postMessage\(\{ type: 'settings:hidden' \}\)/, 'the host tells the page when the tab is hidden')
}
{
  const source = readFileSync(join(HERE, 'ApiKeysSheet.tsx'), 'utf8')
  const close = source.slice(source.indexOf('const close = () => {\n    gate.current.cancel()'), source.indexOf('const toggleEye'))
  assert.match(close, /setDraft\(''\)/, 'closing the field drops what it showed')
  assert.match(close, /setRevealed\(null\)/, 'closing the field drops the saved key')
  assert.match(source, /if \(!gate\.current\.accepts\(ticket\)\) return/, 'an answer after the field closed is dropped')
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

// The Experience lead's point 2 (§11): the section list's buttons ring only for the keyboard (Sprint 146's input mode)
{
  const tabs = readFileSync(join(HERE, '../ui/tabs.tsx'), 'utf8')
  const css = readFileSync(join(HERE, '../../index.css'), 'utf8')
  assert.match(readFileSync(join(HERE, 'SettingsPage.tsx'), 'utf8'), /<TabsTrigger key=\{item\.id\}/, 'the list is the shared Tabs')
  assert.match(tabs, /rm-focus-ring/, 'its trigger rings through the shared rule')
  assert.doesNotMatch(tabs.slice(tabs.indexOf('const TabsTrigger'), tabs.indexOf('const TabsContent')), /(^|[\s'"])focus:/, 'no plain focus: look on the trigger')
  assert.match(css, /:where\(:root:not\(\[data-input-mode="pointer"\]\)\) \.rm-focus-ring\.rm-focus-ring:focus-visible/, 'the ring is the keyboard mode\'s only')
  assert.match(css, /:where\(:root\[data-input-mode="pointer"\]\) :is\(button, a, summary, \[role\], \[tabindex\]\):focus-visible/, "and a click draws not even Chromium's outline")
}

console.log('settingsHost.test.ts: all assertions passed')
