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
const { usageDataLine } = await import('./UsageDataSection')
const { claudeRow, chatgptRow, opencodeRow, savedKeyCount } = await import('./AiAccountsSection')
const { AiDetailsRows, AiDetailsFoot, detailsLede } = await import('./AiDetailsSheet')
const { ApiKeysRows, API_KEY_ROWS, keyStateLine, OPENCODE_INTRO } = await import('./ApiKeysSheet')
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
  'ai-accounts': ['I7', 'I8', 'I9', 'I10', 'I13', 'I20', 'I21', 'I22', 'I23', 'I24', 'I30', 'I32', 'I33', 'I34', 'I35', 'I36', 'I37', 'I38', 'I59'],
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

// PR 2 (R3): the rows, the Details sheets and the API keys sheet, from recorded payloads
const keysSheet = (settings = payload(), extra: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(createElement(ApiKeysRows as never, { settings, testing: {}, results: {}, onSave() {}, onTest() {}, ...extra }))
const details = (ai: 'claude' | 'chatgpt' | 'opencode', settings = payload(), codexAuth: object = { enabled: true, authenticated: true, email: 'test@example.com', plan: 'plus', credits: { used: 2, limit: 10 } }, extra: Record<string, unknown> = {}): string => {
  const props = { ai, settings, codexAuth, codexSigningIn: false, testResults: {}, onClaude() {}, onCodex() {}, onKeys() {}, onDone() {}, ...extra }
  return renderToStaticMarkup(createElement(AiDetailsRows as never, props)) + renderToStaticMarkup(createElement(AiDetailsFoot as never, props))
}
const claudeStatus = (over: object) => ({ ...payload().componentStatus.claudeCode, ...over }) as Settings['componentStatus']['claudeCode']

// Claude's row in every state (answer 9): one line, one button; Details… on each, so no state's fuller actions are lost
assert.deepEqual(claudeRow(claudeStatus({})), { line: 'Signed in with your Claude account', ready: true })
assert.deepEqual(claudeRow(claudeStatus({ state: 'needs-auth', authMethod: null })), { line: 'Needs a paid plan, such as Pro or Max.', ready: false })
assert.equal(claudeRow(claudeStatus({ state: 'not-installed' })).line, 'Not on this computer yet.')
assert.equal(claudeRow(claudeStatus({ state: 'broken' })).line, "Claude isn't working. Repair it to use it again.")
assert.equal(claudeRow(claudeStatus({ state: 'broken', repairAction: 'reload' })).line, 'Repaired. Ritemark reloads its window to finish.')
assert.equal(claudeRow(claudeStatus({ state: 'auth-in-progress' })).line, 'Your browser opened Claude’s sign-in page.')
assert.deepEqual(claudeRow(claudeStatus({ state: 'needs-auth', authMethod: 'api-key' })), { line: 'Uses your Anthropic API key', ready: true })
const rowButtons: [object, string][] = [
  [{ state: 'not-installed' }, '>Install<'], [{ state: 'broken' }, '>Repair<'], [{ state: 'broken', repairAction: 'reload' }, '>Reload window<'],
  [{ state: 'auth-in-progress' }, '>Cancel<'], [{ state: 'needs-auth', authMethod: null }, '>Sign in<'], [{}, '>Ready<'],
]
for (const [over, button] of rowButtons) {
  const markup = draw('ai-accounts', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus(over) } }))
  assert.ok(markup.includes(button), `Claude's row ${JSON.stringify(over)} has ${button}`)
  assert.ok(markup.includes('>Details…<'), 'Details… on the row')
}
assert.doesNotMatch(accounts, /amber|rose-|Experimental|Codex/, 'no amber or red on a row; ChatGPT, never Codex')

// ChatGPT's row (I20–I24)
assert.equal(chatgptRow({ enabled: true }, false).line, 'Not signed in. Any plan works, free included.')
assert.equal(chatgptRow({ enabled: true, error: 'Port busy' }, false).note, 'Port busy')
assert.equal(chatgptRow({ enabled: true }, true).line, 'Your browser opened ChatGPT’s sign-in page.')
assert.equal(chatgptRow({ enabled: true, binaryMissing: true }, false).line, 'Not on this computer yet.')
assert.equal(chatgptRow({ enabled: true, binaryBroken: true }, false).line, "ChatGPT isn't working. Repair it to use it again.")
assert.deepEqual(chatgptRow({ enabled: true, authenticated: true, email: 'a@b.c' }, false), { line: 'Signed in as a@b.c', ready: true })
const signedOut = renderToStaticMarkup(createElement(RitemarkSettings as never, { initial: { settings: payload(), section: 'ai-accounts', codexAuth: { enabled: true } } }))
assert.match(signedOut, /Not signed in\. Any plan works, free included\./)
assert.match(signedOut, />Sign in</)

// OpenCode's row (answer 6): Ready with a saved key whose last test didn't fail, naming the key
assert.deepEqual(opencodeRow(payload(), {}), { line: 'Open models, with an API key of your own.', ready: false })
assert.deepEqual(opencodeRow(payload({ openrouterKeyConfigured: true }), {}), { line: 'Open models, with your OpenRouter key', ready: true, key: 'OpenRouter' })
assert.equal(opencodeRow(payload({ openrouterKeyConfigured: true }), { openrouter: { key: 'openrouter', success: false, error: 'bad' } }).line, "Your OpenRouter key didn't work. Add another or change it.")
assert.equal(opencodeRow(payload({ openrouterKeyConfigured: true, anthropicKeyConfigured: true }), { openrouter: { key: 'openrouter', success: false } }).key, 'Anthropic')
assert.match(accounts, />Set up</)
assert.equal(savedKeyCount(payload({ openaiKeyConfigured: true, elevenlabsKeyConfigured: true })), 2)
assert.match(accounts, /None saved\./)
assert.match(accounts, />Open…</)

// Claude's Details sheet (frame 8): each state keeps its fuller actions
const claudeReady = details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ binaryPath: '/x/claude', diagnostics: ['Found it'] }) } }))
for (const words of ['With Claude.ai', 'Billed to your Claude plan', '>Use an API key instead<', 'Claude 2.1.0', '>Check again<', 'Chats, tasks and flows', '>Learn more<', 'Technical details', 'Runs from /x/claude', 'Found it', '>Sign out<', '>Repair Claude<', '>Done<']) {
  assert.ok(claudeReady.includes(words), `Claude's sheet: ${words}`)
}
assert.match(detailsLede('claude', payload(), { enabled: true }), /Signed in with your Claude account/)
const claudeKey = details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ authMethod: 'api-key' }) } }))
assert.ok(claudeKey.includes('>Use Claude.ai sign-in<') && !claudeKey.includes('>Sign out<'), 'an API key in use: Use Claude.ai sign-in (I16)')
const claudeOut = details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ state: 'needs-auth', authMethod: null }) } }))
for (const words of ['>Sign in with Claude.ai<', '>Use an API key instead<', 'Get one at Anthropic']) assert.ok(claudeOut.includes(words), `signed out: ${words}`)
assert.ok(details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ state: 'auth-in-progress' }) } })).includes('>Cancel sign-in<'))
assert.ok(details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ state: 'not-installed' }) } })).includes('>Install Claude<'))
assert.ok(details('claude', payload({ componentStatus: { ...payload().componentStatus, claudeCode: claudeStatus({ state: 'broken', repairAction: 'reload' }) } })).includes('>Reload window<'))

// ChatGPT's Details sheet: e-mail, plan and credits; Sign out; a broken install's repair command and Reload window (I24–I27)
const chatgptIn = details('chatgpt')
for (const words of ['As test@example.com', 'ChatGPT Plus', '$8.00 of $10.00 API credits left', 'ChatGPT 0.50.0', 'Chats, flows and the task board', '>Learn more<', '>Sign out<', '>Repair ChatGPT<']) {
  assert.ok(chatgptIn.includes(words), `ChatGPT's sheet: ${words}`)
}
const chatgptBroken = details('chatgpt', payload(), { enabled: true, binaryBroken: true, repairCommand: 'npm i -g @openai/codex', error: 'It failed' })
for (const words of ['npm i -g @openai/codex', 'It failed', '>Reload window<', '>Repair ChatGPT<']) assert.ok(chatgptBroken.includes(words), `broken: ${words}`)
assert.ok(details('chatgpt', payload(), { enabled: true }, { codexSigningIn: true }).includes('>Cancel sign-in<'))
assert.ok(details('chatgpt', payload(), { enabled: true }).includes('>Sign in with ChatGPT<'))
assert.doesNotMatch(chatgptIn + chatgptBroken, /Codex/, 'ChatGPT, never Codex, in every visible word')
// OpenCode's sheet (answer 1): Uses with Keys…, Used for, no Sign out
const opencodeSheet = details('opencode', payload({ openrouterKeyConfigured: true }))
assert.ok(opencodeSheet.includes('Your OpenRouter key') && opencodeSheet.includes('>Keys…<') && !opencodeSheet.includes('Sign out'))

// The API keys sheet (frame 9): the five rows in the drawing's order, Not added with Get a key and Add
assert.deepEqual(API_KEY_ROWS.map((row) => row.label), ['OpenAI', 'Anthropic', 'Google AI', 'OpenRouter', 'ElevenLabs'])
const emptyKeys = keysSheet()
for (const row of API_KEY_ROWS) assert.ok(emptyKeys.includes(`id="settings-section-${row.name}"`), `${row.label}'s row`)
assert.equal((emptyKeys.match(/>Not added</g) ?? []).length, 5)
assert.equal((emptyKeys.match(/>Add</g) ?? []).length, 5)
assert.equal((emptyKeys.match(/Get a key/g) ?? []).length, 5)
// A saved key: Saved, Test and Change; Saved · it works after a passing Test; the error after a failing one
const savedKeys = keysSheet(payload({ openaiKeyConfigured: true, openaiKey: 'sk-recorded' }), { results: { openai: { key: 'openai', success: true } } })
assert.match(savedKeys, /Saved · it works/)
assert.match(savedKeys, />Test</)
assert.match(savedKeys, />Change</)
assert.doesNotMatch(savedKeys, /sk-recorded/, 'a saved key is never drawn until Change and its eye')
assert.equal(keyStateLine(true, { key: 'openai', success: false, error: 'Invalid' }), "Saved · it didn't work")
assert.equal(keyStateLine(true, undefined), 'Saved')
assert.match(keysSheet(payload({ anthropicKeyConfigured: true }), { results: { anthropic: { key: 'anthropic', success: false, error: 'Invalid key' } } }), /Invalid key/)
assert.match(keysSheet(payload({ googleKeyConfigured: true }), { testing: { google: true } }), /aria-busy="true"/)
// The flags hide the same rows as before; OpenCode's Set up says what it needs
const keysOff = keysSheet(payload({ openrouterEnabled: false, transcriptionEnabled: false }))
assert.ok(!keysOff.includes('settings-section-openrouter-api-key') && !keysOff.includes('settings-section-elevenlabs-api-key'))
assert.ok(keysSheet(payload(), { forOpenCode: true }).includes(OPENCODE_INTRO))
assert.ok(!keysSheet().includes(OPENCODE_INTRO))
// Ritemark's parts: a state that needs the person reads in words, with no amber dot (the lead's note for PR 2)
assert.doesNotMatch(readFileSync(join(HERE, 'AdvancedSection.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''), /amber|animate-pulse/)

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

// I43: the usage data switch, the person's consent: the welcome's words in each state, and the same message as main
assert.equal(usageDataLine({ on: true, fromRitemark1: false }), 'On. Never your documents, chats or names.')
assert.equal(usageDataLine({ on: true, fromRitemark1: true }), 'On, as you chose in Ritemark 1. Never your documents, chats or names.')
assert.equal(usageDataLine({ on: false, fromRitemark1: false }), 'Off. Never your documents, chats or names.')
assert.equal(usageDataLine(undefined), 'Off. Never your documents, chats or names.')
for (const on of [true, false]) {
  const markup = draw('usage-data', payload({ usageData: { on, fromRitemark1: false } }))
  assert.match(markup, on ? /On\. Never your documents, chats or names\./ : /Off\. Never your documents, chats or names\./)
  assert.match(markup, new RegExp(`role="switch"[^>]*aria-checked="${on}"[^>]*aria-label="Share anonymous usage data"|aria-label="Share anonymous usage data"[^>]*aria-checked="${on}"|role="switch" aria-checked="${on}"`))
}
assert.match(
  readFileSync(join(HERE, 'RitemarkSettings.tsx'), 'utf8'),
  /<UsageDataSection[\s\S]*?onChange=\{\(value\) => \{[\s\S]*?usageData: \{ on: value, fromRitemark1: false \}[\s\S]*?vscode\.postMessage\(\{ type: 'usageData:set', on: value \}\);/,
  'the switch sends usageData:set with its new value, as main did',
)

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
// Codex on #644: a part that needs a sign-in is never "all ready"
{
  const base = payload().componentStatus
  const claude = (over: object) => ({ ...base, claudeCode: { ...base.claudeCode, ...over } })
  const chatgpt = (auth: 'sign_in_required' | 'error') => ({ ...base, codex: { ...base.codex, runtimeStatus: { ...base.codex.runtimeStatus, auth } } })
  const cases: [string, typeof base, string][] = [
    ['Claude needs-auth', claude({ state: 'needs-auth', runtimeStatus: { ...runtime, auth: 'sign_in_required' } }), 'Claude needs you to sign in'],
    ['Claude auth-in-progress', claude({ state: 'auth-in-progress' }), 'Claude is signing in'],
    ['Claude account error', claude({ runtimeStatus: { ...runtime, auth: 'error' } }), "Claude's account couldn't be checked"],
    ['ChatGPT sign_in_required', chatgpt('sign_in_required'), 'ChatGPT needs you to sign in'],
    ['ChatGPT error', chatgpt('error'), "ChatGPT's account couldn't be checked"],
  ]
  for (const [name, status, line] of cases) {
    assert.notEqual(partsLine(status), 'The voice model, Claude and ChatGPT: all ready', `${name} is not all ready`)
    assert.equal(partsLine(status), line, name)
  }
}
assert.equal(versionLine(payload().updateCenter), "App 2.1.0 · Extension 2.1.0 · from Ritemark's release feed")
assert.equal(checkNowLine({ ...payload().updateCenter, lastSuccessfulCheckAt: 0 }), 'No check has worked yet. None failed.')
assert.equal(whenText(0), 'never')
assert.match(whenText(Date.now()), /^today at /)

// I61: today's five names land on the new places, each on a row the page draws
assert.deepEqual(Object.keys(LEGACY_SECTION_LANDINGS).sort(), ['google-ai-key', 'google-docs', 'openai-api-key', 'transcription', 'usage-data'])
for (const [name, landing] of Object.entries(LEGACY_SECTION_LANDINGS)) {
  if (!landing.anchor) continue
  // A key's way in opens the API keys sheet at its row
  const where = landing.keyRow ? keysSheet() : draw(landing.section)
  assert.ok(where.includes(`id="${landing.anchor}"`), `${name} lands on #${landing.anchor} in ${landing.keyRow ? 'the API keys sheet' : landing.section}`)
}
assert.match(readFileSync(join(HERE, 'RitemarkSettings.tsx'), 'utf8'), /if \(landing\.keyRow\) \{[\s\S]*?setKeys\(\{ open: true, focus: landing\.keyRow/)
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
