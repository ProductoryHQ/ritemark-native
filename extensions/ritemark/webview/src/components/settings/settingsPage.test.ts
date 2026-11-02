/**
 * Sprint 147 (R1, R2, W1, W2): the new Settings, drawn from recorded payloads. Each inventory row the page draws has
 * its place in its section (`data-settings-row`), with the existing flags gating the same rows; the five ways in land
 * on their new places (I61); a stored value no control offers shows as it is (R1); no native select or hand-rolled
 * button is left on the page (R9).
 *
 * Run: npx tsx webview/src/components/settings/settingsPage.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { RitemarkSettings } = await import('./RitemarkSettings')
const { SETTINGS_SECTIONS, LEGACY_SECTION_LANDINGS, landingFor, isKnownLanding, FIRST_SECTION } = await import('./settingsSections')
const { chatSizeLine } = await import('./AppearanceSection')
const { quietChoices, partsLine, runtimeLine } = await import('./AdvancedSection')
const { checkNowLine, versionLine, whenText } = await import('./UpdatesSection')
type Settings = import('./RitemarkSettings').SettingsData
type Section = import('./settingsSections').SettingsSectionId

const HERE = dirname(fileURLToPath(import.meta.url))

const runtime = { runtime: 'installed', source: 'bundled', auth: 'ready' } as const
function payload(over: Partial<Settings> = {}): Settings {
  return {
    codexIntegration: true,
    codexApprovalPolicy: 'untrusted',
    codexSandboxMode: 'workspace-write',
    agentRuntimePreference: 'bundled',
    environment: { gitInstalled: true, nodeInstalled: true, gitRequired: false, nodeRequired: false, restartRequired: false },
    usageData: { on: true, fromRitemark1: false },
    updatesEnabled: true,
    agentTimeout: 15,
    debugTrace: false,
    openaiKey: '', openaiKeyConfigured: false,
    googleKey: '', googleKeyConfigured: false,
    anthropicKey: '', anthropicKeyConfigured: false,
    opencodeEnabled: true,
    opencodeAutoApprove: false,
    openrouterEnabled: true,
    openrouterKey: '', openrouterKeyConfigured: false,
    transcriptionEnabled: true,
    elevenlabsKey: '', elevenlabsKeyConfigured: false,
    transcriptionStorageBytes: 128 * 1024 * 1024,
    chatFontSize: 13,
    googleDocs: { enabled: true, state: 'connected', email: 'test@example.com', displayName: null, template: null, choosingTemplate: false, message: null },
    currentTheme: 'ritemark-light',
    availableThemes: [
      { id: 'ritemark-light', label: 'Ritemark Light', description: '', kind: 'light' },
      { id: 'ritemark-dark', label: 'Ritemark Dark', description: '', kind: 'dark' },
    ],
    updateCenter: {
      state: 'update-available', currentAppVersion: '2.1.0', currentExtensionVersion: '2.1.0', updatesEnabled: true,
      lastCheckedAt: 1, lastSuccessfulCheckAt: 1, lastFailedCheckAt: 0, skippedVersion: '', snoozeUntil: 0, pendingRestartVersion: '',
      availableUpdate: { action: 'extension', version: '2.1.1', summary: 'Fixes.', downloadSize: 3_300_000 },
      feedSource: 'feed',
    },
    componentStatus: {
      voiceModel: { installed: true, modelName: 'Whisper', filename: 'w.bin', managedBy: 'ritemark', sizeBytes: 1, sizeDisplay: '1 MB' },
      claudeCode: {
        installed: true, runnable: true, authenticated: true, version: '2.1.0', sdkVersion: '0.3.310', binaryPath: null,
        authMethod: 'claude-oauth', managedBy: 'user', state: 'ready', error: null, diagnostics: [], repairAction: null, runtimeStatus: runtime,
      },
      codex: {
        installed: true, version: '0.50.0', managedBy: 'user', state: 'ready', error: null, diagnostics: [], repairCommand: null,
        compatibility: null, runtimeStatus: runtime,
      },
    },
    ...over,
  }
}

const draw = (section: Section, settings = payload()): string =>
  renderToStaticMarkup(createElement(RitemarkSettings as (props: { initial: { settings: Settings; section: Section } }) => ReturnType<typeof RitemarkSettings>, { initial: { settings, section } }))
const rows = (markup: string): Set<string> =>
  new Set([...markup.matchAll(/data-settings-row="([^"]+)"/g)].flatMap((match) => match[1].split(' ')))

// R2: the six sections, in the drawing's order, and the first one when no way in names one
assert.deepEqual(SETTINGS_SECTIONS.map((section) => section.name), ['AI accounts', 'Appearance', 'Sharing', 'Usage data', 'Updates', 'Advanced'])
assert.equal(FIRST_SECTION, 'ai-accounts')
const accounts = draw('ai-accounts')
for (const section of SETTINGS_SECTIONS) assert.ok(accounts.includes(`data-settings-section="${section.id}"`), `${section.name} is in the list`)
assert.match(accounts, /aria-orientation="vertical"/, 'the list is the shared Tabs, vertical')
assert.match(accounts, /<h2[^>]*>AI accounts<\/h2>/)

// R1: each inventory row the page draws, in its section, with every flag on
const EXPECTED: Record<Section, string[]> = {
  'ai-accounts': ['I7', 'I12', 'I19', 'I20', 'I27', 'I30', 'I32', 'I33', 'I34', 'I35', 'I36', 'I37', 'I38', 'I59'],
  appearance: ['I1', 'I2'],
  sharing: ['I39', 'I40'],
  'usage-data': ['I43', 'I44'],
  updates: ['I45', 'I47', 'I48', 'I51', 'I53', 'I55'],
  advanced: ['I3', 'I4', 'I5', 'I6', 'I17', 'I28', 'I29', 'I31', 'I41', 'I42', 'I56', 'I57', 'I58', 'I60'],
}
for (const [section, expected] of Object.entries(EXPECTED) as [Section, string[]][]) {
  const found = rows(draw(section))
  const missing = expected.filter((row) => !found.has(row))
  assert.deepEqual(missing, [], `${section} draws ${expected.join(', ')}`)
}

// The flags gate the same rows as before (R1): ChatGPT's two Advanced rows, OpenCode's, the OpenRouter key, Transcribe's
const flagsOff = payload({ codexIntegration: false, opencodeEnabled: false, openrouterEnabled: false, transcriptionEnabled: false, googleDocs: null })
const advancedOff = rows(draw('advanced', flagsOff))
for (const row of ['I28', 'I29', 'I31', 'I58']) assert.ok(!advancedOff.has(row), `${row} hides with its flag off`)
const accountsOff = rows(draw('ai-accounts', flagsOff))
for (const row of ['I30', 'I35', 'I36']) assert.ok(!accountsOff.has(row), `${row} hides with its flag off`)
assert.ok(!rows(draw('sharing', flagsOff)).has('I39'), "Google Docs' rows hide with google-docs-publishing off")

// Each key card saves and tests its own key; the eye stays (decision 2, Jarmo, 2 November)
for (const id of ['openai-api-key', 'google-ai-key', 'elevenlabs-api-key']) assert.ok(accounts.includes(`id="settings-section-${id}"`), `${id}'s card`)
assert.equal((accounts.match(/aria-label="Show the key"/g) ?? []).length, 5, 'each of the five key fields has its eye')

// Updates: the update card in plain words, and the reminders' place (answer 3)
const updates = draw('updates')
assert.match(updates, /Ritemark 2\.1\.1 is ready/)
assert.match(updates, />Remind me in 7 days</)
assert.match(updates, />Skip this version</)
const skipped = draw('updates', payload({ updateCenter: { ...payload().updateCenter, skippedVersion: '2.1.1' } }))
assert.match(skipped, /You skipped this version/)
assert.match(skipped, />Turn reminders back on</)
const paused = draw('updates', payload({ updateCenter: { ...payload().updateCenter, availableUpdate: undefined, state: 'paused', snoozeUntil: Date.UTC(2026, 10, 8) } }))
assert.ok(rows(paused).has('I50'), 'paused reminders keep a row with no update shown')
const restart = draw('updates', payload({ updateCenter: { ...payload().updateCenter, pendingRestartVersion: '2.1.1-ext.1' } }))
assert.ok(rows(restart).has('I52') && rows(restart).has('I53'), 'a reload waiting and an update on offer show together, as on the old page')
const failed = draw('updates', payload({ updateCenter: { ...payload().updateCenter, availableUpdate: undefined, state: 'error', error: 'offline' } }))
assert.match(failed, /Could not check for updates: offline/)

// R1: a stored value no control offers shows as it is, never rewritten
assert.equal(chatSizeLine(13), 'In every chat, with any AI')
assert.equal(chatSizeLine(16), '16 px, set in All settings')
const size16 = draw('appearance', payload({ chatFontSize: 16 }))
assert.match(size16, /16 px, set in All settings/)
assert.doesNotMatch(size16.slice(size16.indexOf('Text size in chats')), /type="radio"[^>]*checked=""/, 'no step is chosen for 16')
assert.deepEqual(quietChoices(15), [5, 10, 15, 20, 30, 45, 60])
assert.deepEqual(quietChoices(22), [5, 10, 15, 20, 22, 30, 45, 60])

// Advanced's lines say what runs and what is found
assert.equal(runtimeLine(payload()), "Now: Claude and ChatGPT from Ritemark's own. This computer has Git.")
assert.match(runtimeLine(payload({ agentRuntimePreference: 'system' })), /wasn't found, so Ritemark's own runs instead/)
assert.equal(partsLine(payload().componentStatus), 'The voice model, Claude and ChatGPT: all ready')
assert.equal(partsLine({ ...payload().componentStatus, codex: { ...payload().componentStatus.codex, state: 'broken' } }), 'ChatGPT needs a repair')
assert.equal(versionLine(payload().updateCenter), "App 2.1.0 · Extension 2.1.0 · from Ritemark's release feed")
assert.equal(checkNowLine({ ...payload().updateCenter, lastSuccessfulCheckAt: 0 }), 'No check has worked yet. None failed.')
assert.equal(whenText(0), 'never')
assert.match(whenText(Date.now()), /^today at /)

// I61: today's five names land on the new places, each on a row the page draws
assert.deepEqual(Object.keys(LEGACY_SECTION_LANDINGS).sort(), ['google-ai-key', 'google-docs', 'openai-api-key', 'transcription', 'usage-data'])
for (const [name, landing] of Object.entries(LEGACY_SECTION_LANDINGS)) {
  if (!landing.anchor) continue
  assert.ok(draw(landing.section).includes(`id="${landing.anchor}"`), `${name} lands on #${landing.anchor} in ${landing.section}`)
}
assert.deepEqual(landingFor('transcription'), { section: 'advanced', anchor: 'settings-section-transcription' })
assert.deepEqual(landingFor('usage-data'), { section: 'usage-data' })
assert.deepEqual(landingFor(undefined), { section: 'ai-accounts' })
assert.deepEqual(landingFor('nonsense'), { section: 'ai-accounts' })
// The page moves only for a name it knows (as the old page: an unknown name moved nothing)
assert.equal(isKnownLanding('transcription'), true)
assert.equal(isKnownLanding('advanced'), true)
assert.equal(isKnownLanding('nonsense'), false)
assert.equal(isKnownLanding(undefined), false)
assert.match(readFileSync(join(HERE, 'RitemarkSettings.tsx'), 'utf8'), /if \(!isKnownLanding\(message\.section\)\) break;/)
// The host's list of names and the page's agree
const host = readFileSync(join(HERE, '../../../../src/settings/RitemarkSettingsProvider.ts'), 'utf8')
const hostNames = (/export type SettingsSection = ([^;]+);/.exec(host)?.[1] ?? '').match(/'[^']+'/g)?.map((name) => name.slice(1, -1)).sort()
assert.deepEqual(hostNames, Object.keys(LEGACY_SECTION_LANDINGS).sort(), 'every name the host opens Settings at has a landing')

// R9: no native select, hand-rolled button or bare link left on the page's sources
const sources = readdirSync(HERE).filter((file) => file.endsWith('.tsx')).map((file) => [file, readFileSync(join(HERE, file), 'utf8')] as const)
for (const [file, source] of sources) {
  assert.ok(!/<select[\s>]/.test(source), `${file}: no native select`)
  assert.ok(!/<button[\s>]/.test(source), `${file}: no hand-rolled button`)
  assert.ok(!/<a\s[^>]*href=/.test(source), `${file}: links open through the host`)
  assert.ok(!/<[a-z][\w-]*\s[^<>]*\btitle=["{]/.test(source), `${file}: no native title on an element`)
}

console.log('settingsPage.test.ts: all assertions passed')
