/**
 * Sprint 147 (R1, W1): no setting is lost. The inventory of what Settings sends and writes, held against the page's
 * sources and the host's `handleMessage`. Written first, against the page as it was before the new Settings, so the new
 * page is held to the same list. Removing one message type, setting key or key card from the page, or one case from
 * the host, fails it.
 *
 * Run: npx tsx webview/src/components/settings/settingsInventory.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (path: string): string => readFileSync(path, 'utf8')

/**
 * The 28 message types the page sent before the new Settings (spec R1; `RitemarkSettingsProvider.ts`'s `handleMessage`),
 * and PR 3's one more: `apiKey:reveal`, the saved-key eye asking for its one key (decision 2).
 */
export const PAGE_MESSAGES = [
  'ready', 'openExternal', 'setSetting', 'usageData:set', 'theme:set', 'setApiKey', 'testApiKey',
  'settings:openAdvanced', 'transcription:clearStorage',
  'claude:install', 'claude:repair', 'claude:login', 'claude:cancelLogin', 'claude:enterApiKey', 'claude:logout',
  'claude:reload', 'claude:refreshStatus',
  'codex:startLogin', 'codex:logout', 'codex:refreshStatus', 'codex:cancelLogin', 'codex:repair',
  'updates:checkNow', 'updates:install', 'updates:skipVersion', 'updates:pause', 'updates:resume', 'updates:reload',
  'apiKey:reveal',
] as const
/**
 * What the host sends the page (PR 3): `settings` (no probe), each probe's `settings:part`, the eye's one answer, and
 * today's others. The page must handle each, and the host must still send each.
 */
export const HOST_MESSAGES = [
  'settings', 'settings:part', 'apiKey:revealed', 'codex:authStatus', 'codex:loginStarting', 'testResult',
  'google-docs/settings', 'settings:focus-section', 'settings:hidden',
] as const
/** The parts the host's probes post, each one the page composes (`settingsParts.ts`). */
export const PROBE_PARTS = ['claudeCode', 'codex', 'environment', 'transcriptionStorageBytes', 'updateCenter'] as const
/** Google Docs' five, which the host hands to its controller by their prefix. */
export const GOOGLE_DOCS_MESSAGES = [
  'google-docs/connect', 'google-docs/cancel', 'google-docs/disconnect', 'google-docs/choose-template', 'google-docs/clear-template',
] as const
/** The `ritemark.*` settings the page writes through `setSetting` (its `key`, without `ritemark.`). */
export const SETTING_KEYS = [
  'agentRuntime.preference', 'ai.agentTimeout', 'ai.debugTrace', 'chat.fontSize', 'codex.approvalPolicy',
  'codex.sandboxMode', 'opencode.autoApprove', 'updates.enabled',
] as const
/** The five keys, by their secret's name: each row of the API keys sheet adds, tests, changes and removes its own. */
export const API_KEYS = ['openai-api-key', 'google-ai-key', 'anthropic-api-key', 'openrouter-api-key', 'elevenlabs-api-key'] as const

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** A source with its comments taken out, so a message named only in a comment doesn't count (a URL's // stays). */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/[^\n]*/g, '$1')
}

/** Every settings component's source, tests left out, comments taken out. */
export function pageSource(dir = HERE): string {
  return readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => withoutComments(read(join(dir, file))))
    .join('\n')
}

/**
 * Messages sent from more than one place, by the file that owns each copy: AI accounts' rows, the Details sheets, the
 * page (the keys' two), the Ritemark's parts sheet in Advanced, and Updates. Dropping one copy fails the test even while
 * another remains: a row's sign-in going fails though its Details sheet still has it (Sprint 147, PR 2).
 */
export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  'AiAccountsSection.tsx': ['claude:install', 'claude:repair', 'claude:reload', 'claude:login', 'claude:cancelLogin', 'codex:repair', 'codex:startLogin', 'codex:cancelLogin'],
  'AiDetailsSheet.tsx': ['claude:install', 'claude:repair', 'claude:reload', 'claude:login', 'claude:refreshStatus', 'claude:cancelLogin', 'claude:enterApiKey', 'claude:logout', 'codex:repair', 'codex:refreshStatus', 'codex:startLogin', 'codex:cancelLogin', 'codex:logout', 'updates:reload'],
  'RitemarkSettings.tsx': ['setApiKey', 'testApiKey'],
  'AdvancedSection.tsx': ['claude:install', 'claude:repair', 'claude:reload', 'claude:login', 'claude:refreshStatus', 'codex:repair', 'codex:refreshStatus', 'codex:startLogin'],
  'UpdatesSection.tsx': ['updates:checkNow', 'updates:install', 'updates:skipVersion', 'updates:pause', 'updates:resume', 'updates:reload'],
}
export function ownerGaps(sources: Record<string, string>): string[] {
  const gaps: string[] = []
  for (const [file, types] of Object.entries(OWNERS)) {
    for (const type of types) if (!sends(sources[file] ?? '', type)) gaps.push(`${file} no longer sends ${type}`)
  }
  return gaps
}

/** Where a page sends a message type: a posted `type`, an action helper's argument, or a named message constant. */
export function sends(source: string, type: string): boolean {
  return new RegExp(`(type:\\s*|message:\\s*|\\b(?:\\w*Action|send|onClaude|onCodex)\\(\\s*)'${escape(type)}'`).test(source)
}
export function writesSetting(source: string, key: string): boolean {
  return new RegExp(`(handleSettingChange|handleToggle|onSetting)\\(\\s*'${escape(key)}'`).test(source)
}
/** A key has its row on the API keys sheet (`API_KEY_ROWS`), by its secret's name. */
export function hasKeyRow(sheet: string, name: string): boolean {
  return new RegExp(`\\bname:\\s*'${escape(name)}'`).test(sheet)
}
/**
 * Each key row's actions (PR 2): Add and Change save (`onSave(row.name, draft)`), Remove key saves an empty value
 * (`onSave(row.name, '')`, I37), Test tests (`onTest(row.name)`), Get a key opens the service's page; the page hands
 * the sheet today's `setApiKey` and `testApiKey` senders.
 */
export function keySheetGaps(sheet: string, page: string): string[] {
  const gaps: string[] = []
  if (!/onSave\(\s*row\.name,\s*draft\s*\)/.test(sheet)) gaps.push('a key row no longer saves its key')
  if (!/onSave\(\s*row\.name,\s*''\s*\)/.test(sheet)) gaps.push('a key row no longer removes its key')
  if (!/onTest\(\s*row\.name\s*\)/.test(sheet)) gaps.push('a key row no longer tests its key')
  if (!/<ExternalLink url=\{row\.url\}/.test(sheet)) gaps.push("a key row no longer links to the service's keys")
  if (!/aria-label=\{show \? 'Hide the key' : 'Show the key'\}/.test(sheet)) gaps.push("a key's field no longer has its eye")
  if (!/onSave=\{handleSaveApiKey\}/.test(page) || !/onTest=\{handleTestApiKey\}/.test(page)) gaps.push('the page no longer hands the sheet its key senders')
  return gaps
}
export function inventoryGaps(page: string, host: string, googleDocsProtocol: string): string[] {
  const gaps: string[] = []
  for (const type of PAGE_MESSAGES) {
    if (!sends(page, type)) gaps.push(`the page no longer sends ${type}`)
    if (!new RegExp(`case '${escape(type)}':`).test(host)) gaps.push(`the host no longer handles ${type}`)
  }
  for (const type of GOOGLE_DOCS_MESSAGES) {
    if (!sends(page, type)) gaps.push(`the page no longer sends ${type}`)
    if (!googleDocsProtocol.includes(`'${type}'`)) gaps.push(`Google Docs' protocol no longer has ${type}`)
  }
  if (!host.includes("startsWith('google-docs/')")) gaps.push("the host no longer routes google-docs/ messages")
  for (const key of SETTING_KEYS) if (!writesSetting(page, key)) gaps.push(`the page no longer writes ritemark.${key}`)
  for (const name of API_KEYS) {
    if (!hasKeyRow(page, name)) gaps.push(`the API keys sheet no longer has ${name}`)
    if (!host.includes(`'${name}'`)) gaps.push(`the host no longer knows ${name}`)
  }
  return gaps
}

/** PR 3: each host message is still posted by the host and handled by the page; each probe part is posted and composed. */
export function hostMessageGaps(page: string, host: string, parts: string): string[] {
  const gaps: string[] = []
  for (const type of HOST_MESSAGES) {
    if (!new RegExp(`type:\\s*'${escape(type)}'`).test(host)) gaps.push(`the host no longer sends ${type}`)
    if (!new RegExp(`(case\\s*|type\\s*!==\\s*|type\\s*===\\s*)'${escape(type)}'`).test(page)) gaps.push(`the page no longer handles ${type}`)
  }
  for (const part of PROBE_PARTS) {
    if (!new RegExp(`part:\\s*'${escape(part)}'`).test(host)) gaps.push(`the host no longer probes ${part}`)
    if (!parts.includes(`'${part}'`)) gaps.push(`the page no longer composes ${part}`)
  }
  return gaps
}

/**
 * PR 3 (decision 2): no saved key's value in `settings`, and every key message held to the five names. A host that
 * sends a value again, or saves a name it was sent without the list, fails.
 */
export function keyHandlingGaps(host: string, keys: string): string[] {
  const gaps: string[] = []
  const base = host.slice(host.indexOf('private async sendBaseSettings('), host.indexOf('private async savedKeys('))
  if (!base) gaps.push('the host no longer has sendBaseSettings')
  if (/\b(openai|google|anthropic|openrouter|elevenlabs)Key:/.test(base)) gaps.push("the host's settings carry a key's value")
  for (const name of API_KEYS) if (!keys.includes(`'${name}'`)) gaps.push(`the key list no longer has ${name}`)
  const setter = host.slice(host.indexOf("case 'setApiKey':"), host.indexOf("case 'testApiKey':"))
  if (!/if \(!settingsKeyAllowed\(message\.key, this\.keyFlags\(\)\)\)/.test(setter)) gaps.push('setApiKey saves a name off the list')
  if (!/settingsKeyAllowed\(key, this\.keyFlags\(\)\)/.test(host.slice(host.indexOf('private async revealApiKey(')))) gaps.push('the eye answers a name off the list')
  const settingSetter = host.slice(host.indexOf("case 'setSetting':"), host.indexOf("case 'usageData:set':"))
  if (!/if \(pageSettingAllowed\(message\.key\)/.test(settingSetter)) gaps.push('setSetting writes a key off the list')
  return gaps
}

const page = pageSource()
const owned = Object.fromEntries(Object.keys(OWNERS).map((file) => [file, withoutComments(read(join(HERE, file)))]))
const host = read(join(HERE, '../../../../src/settings/RitemarkSettingsProvider.ts'))
const sheet = withoutComments(read(join(HERE, 'ApiKeysSheet.tsx')))
const googleDocsProtocol = read(join(HERE, '../../../../src/googleDocs/protocol.ts'))
const keysSource = read(join(HERE, '../../../../src/settings/settingsKeys.ts'))
const partsSource = withoutComments(read(join(HERE, 'settingsParts.ts')))

assert.equal(PAGE_MESSAGES.length, 29, "the 28 message types, and PR 3's apiKey:reveal")
assert.deepEqual(hostMessageGaps(page, host, partsSource), [], 'every host message is sent and handled; every part probed and composed')
assert.deepEqual(keyHandlingGaps(host, keysSource), [], 'no key value in settings; every key message held to the five names')
// E1 for PR 3: each check fails when its line goes
assert.deepEqual(hostMessageGaps(page.replace("case 'settings:part':", ''), host, partsSource), ['the page no longer handles settings:part'])
assert.deepEqual(hostMessageGaps(page, host.replace(/part: 'environment'/g, "part: 'gone'"), partsSource), ['the host no longer probes environment'])
assert.deepEqual(keyHandlingGaps(host.replace("openaiKeyConfigured: saved['openai-api-key'],", "openaiKey: 'x', openaiKeyConfigured: true,"), keysSource), ["the host's settings carry a key's value"])
assert.deepEqual(keyHandlingGaps(host.replace('if (!settingsKeyAllowed(message.key, this.keyFlags())) {', 'if (!message.key) {'), keysSource), ['setApiKey saves a name off the list'])
assert.deepEqual(keyHandlingGaps(host.replace('if (pageSettingAllowed(message.key)', 'if (message.key'), keysSource), ['setSetting writes a key off the list'])
// setSetting's list holds every setting the page writes (the review of #657)
{
  const probes = read(join(HERE, '../../../../src/settings/settingsProbes.ts'))
  const list = probes.slice(probes.indexOf('export const PAGE_SETTING_KEYS'), probes.indexOf('] as const', probes.indexOf('export const PAGE_SETTING_KEYS')))
  for (const key of SETTING_KEYS) assert.ok(list.includes(`'${key}'`), `setSetting may write ritemark.${key}`)
}
assert.deepEqual(inventoryGaps(page, host, googleDocsProtocol), [], 'every message, setting and key of the inventory has its sender and its handler')
assert.deepEqual(ownerGaps(owned), [], 'each copy of a message sent from more than one place is still sent by its owner')
assert.deepEqual(keySheetGaps(sheet, owned['RitemarkSettings.tsx']), [], "each key row adds, tests, changes, removes and links, with today's messages")

// E1: the test fails when one is removed, from the page or from the host
const withoutRepair = page.replace(/(type:\s*|\b\w*Action\(\s*|onCodex\(\s*)'codex:repair'/g, "$1'removed'")
assert.deepEqual(inventoryGaps(withoutRepair, host, googleDocsProtocol), ['the page no longer sends codex:repair'])
assert.deepEqual(inventoryGaps(page, host.replace("case 'updates:pause':", ''), googleDocsProtocol), ['the host no longer handles updates:pause'])
assert.deepEqual(
  inventoryGaps(page.replace(/name:\s*'elevenlabs-api-key'/g, 'name: undefined'), host, googleDocsProtocol),
  ['the API keys sheet no longer has elevenlabs-api-key'],
)
// PR 2: a key row's Remove key, Test or eye going fails, and so does the page's key sender
assert.deepEqual(keySheetGaps(sheet.replace(/onSave\(row\.name, ''\)/g, 'close()'), owned['RitemarkSettings.tsx']), ['a key row no longer removes its key'])
assert.deepEqual(keySheetGaps(sheet.replace(/onTest\(row\.name\)/g, 'close()'), owned['RitemarkSettings.tsx']), ['a key row no longer tests its key'])
assert.deepEqual(keySheetGaps(sheet.replace(/aria-label=\{show \? 'Hide the key' : 'Show the key'\}/g, ''), owned['RitemarkSettings.tsx']), ["a key's field no longer has its eye"])
assert.deepEqual(
  ownerGaps({ ...owned, 'RitemarkSettings.tsx': owned['RitemarkSettings.tsx'].replace("type: 'testApiKey'", "type: 'gone'") }),
  ['RitemarkSettings.tsx no longer sends testApiKey'],
)
// PR 2: a sign-in action going from a row fails, though the Details sheet still has it; and from the sheet alone
assert.deepEqual(
  ownerGaps({ ...owned, 'AiAccountsSection.tsx': owned['AiAccountsSection.tsx'].replace(/onCodex\('codex:startLogin'\)/g, "onCodex('gone')") }),
  ['AiAccountsSection.tsx no longer sends codex:startLogin'],
)
assert.deepEqual(
  ownerGaps({ ...owned, 'AiDetailsSheet.tsx': owned['AiDetailsSheet.tsx'].replace(/onClaude\('claude:enterApiKey'\)/g, "onClaude('gone')") }),
  ['AiDetailsSheet.tsx no longer sends claude:enterApiKey'],
)
assert.deepEqual(
  inventoryGaps(page.replace(/'ai\.debugTrace'/g, "'gone'"), host, googleDocsProtocol),
  ['the page no longer writes ritemark.ai.debugTrace'],
)

// A message named only in a comment doesn't count
assert.ok(!sends(withoutComments("// vscode.postMessage({ type: 'codex:repair' })\n/* onClaude('claude:install') */"), 'codex:repair'))
assert.ok(!sends(withoutComments("/* onClaude('claude:install') */"), 'claude:install'))
assert.ok(withoutComments("url: 'https://example.com'").includes('https://example.com'), "a URL's // stays")
// Dropping the Details sheet's copy of claude:repair fails, though the row and Ritemark's parts still send it
assert.deepEqual(
  ownerGaps({ ...owned, 'AiDetailsSheet.tsx': owned['AiDetailsSheet.tsx'].replace(/onClaude\('claude:repair'\)/g, "onClaude('gone')") }),
  ['AiDetailsSheet.tsx no longer sends claude:repair'],
)

console.log(`settingsInventory.test.ts: all assertions passed (${PAGE_MESSAGES.length} messages, ${HOST_MESSAGES.length} from the host, ${GOOGLE_DOCS_MESSAGES.length} Google Docs, ${SETTING_KEYS.length} settings, ${API_KEYS.length} keys)`)
