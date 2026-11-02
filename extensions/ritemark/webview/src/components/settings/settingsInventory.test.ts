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

/** The 28 message types the page sends today (spec R1; `RitemarkSettingsProvider.ts`'s `handleMessage`). */
export const PAGE_MESSAGES = [
  'ready', 'openExternal', 'setSetting', 'usageData:set', 'theme:set', 'setApiKey', 'testApiKey',
  'settings:openAdvanced', 'transcription:clearStorage',
  'claude:install', 'claude:repair', 'claude:login', 'claude:cancelLogin', 'claude:enterApiKey', 'claude:logout',
  'claude:reload', 'claude:refreshStatus',
  'codex:startLogin', 'codex:logout', 'codex:refreshStatus', 'codex:cancelLogin', 'codex:repair',
  'updates:checkNow', 'updates:install', 'updates:skipVersion', 'updates:pause', 'updates:resume', 'updates:reload',
] as const
/** Google Docs' five, which the host hands to its controller by their prefix. */
export const GOOGLE_DOCS_MESSAGES = [
  'google-docs/connect', 'google-docs/cancel', 'google-docs/disconnect', 'google-docs/choose-template', 'google-docs/clear-template',
] as const
/** The `ritemark.*` settings the page writes through `setSetting` (its `key`, without `ritemark.`). */
export const SETTING_KEYS = [
  'agentRuntime.preference', 'ai.agentTimeout', 'ai.debugTrace', 'chat.fontSize', 'codex.approvalPolicy',
  'codex.sandboxMode', 'opencode.autoApprove', 'updates.enabled',
] as const
/** The five keys, by their secret's name: each card saves and tests its own. */
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
 * Messages sent from more than one place, by the file that owns each copy: the AI accounts cards (moved whole), the
 * Ritemark's parts sheet in Advanced, and Updates. Dropping one copy fails the test even while another remains.
 */
export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  'RitemarkSettings.tsx': ['claude:install', 'claude:repair', 'claude:reload', 'claude:login', 'claude:refreshStatus', 'claude:cancelLogin', 'claude:enterApiKey', 'claude:logout', 'codex:repair', 'codex:refreshStatus', 'codex:startLogin', 'codex:cancelLogin', 'codex:logout', 'updates:reload'],
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
export function savesAndTestsKey(source: string, name: string): boolean {
  return new RegExp(`handleSaveApiKey\\(\\s*'${escape(name)}'`).test(source) && new RegExp(`handleTestApiKey\\(\\s*'${escape(name)}'`).test(source)
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
    if (!savesAndTestsKey(page, name)) gaps.push(`the page no longer saves and tests ${name}`)
    if (!host.includes(`'${name}'`)) gaps.push(`the host no longer knows ${name}`)
  }
  return gaps
}

const page = pageSource()
const owned = Object.fromEntries(Object.keys(OWNERS).map((file) => [file, withoutComments(read(join(HERE, file)))]))
const host = read(join(HERE, '../../../../src/settings/RitemarkSettingsProvider.ts'))
const googleDocsProtocol = read(join(HERE, '../../../../src/googleDocs/protocol.ts'))

assert.equal(PAGE_MESSAGES.length, 28, 'the 28 message types')
assert.deepEqual(inventoryGaps(page, host, googleDocsProtocol), [], 'every message, setting and key of the inventory has its sender and its handler')
assert.deepEqual(ownerGaps(owned), [], 'each copy of a message sent from more than one place is still sent by its owner')

// E1: the test fails when one is removed, from the page or from the host
const withoutRepair = page.replace(/(type:\s*|\b\w*Action\(\s*|onCodex\(\s*)'codex:repair'/g, "$1'removed'")
assert.deepEqual(inventoryGaps(withoutRepair, host, googleDocsProtocol), ['the page no longer sends codex:repair'])
assert.deepEqual(inventoryGaps(page, host.replace("case 'updates:pause':", ''), googleDocsProtocol), ['the host no longer handles updates:pause'])
assert.deepEqual(
  inventoryGaps(page.replace(/handleSaveApiKey\(\s*'elevenlabs-api-key'/g, 'handleSaveApiKey(undefined'), host, googleDocsProtocol),
  ['the page no longer saves and tests elevenlabs-api-key'],
)
assert.deepEqual(
  inventoryGaps(page.replace(/'ai\.debugTrace'/g, "'gone'"), host, googleDocsProtocol),
  ['the page no longer writes ritemark.ai.debugTrace'],
)

// A message named only in a comment doesn't count
assert.ok(!sends(withoutComments("// vscode.postMessage({ type: 'codex:repair' })\n/* onClaude('claude:install') */"), 'codex:repair'))
assert.ok(!sends(withoutComments("/* onClaude('claude:install') */"), 'claude:install'))
assert.ok(withoutComments("url: 'https://example.com'").includes('https://example.com'), "a URL's // stays")
// Dropping the AI accounts card's copy of claude:repair fails, though Ritemark's parts still sends it
assert.deepEqual(
  ownerGaps({ ...owned, 'RitemarkSettings.tsx': owned['RitemarkSettings.tsx'].replace(/Action\('claude:repair'\)/g, "Action('gone')") }),
  ['RitemarkSettings.tsx no longer sends claude:repair'],
)

console.log(`settingsInventory.test.ts: all assertions passed (${PAGE_MESSAGES.length} messages, ${GOOGLE_DOCS_MESSAGES.length} Google Docs, ${SETTING_KEYS.length} settings, ${API_KEYS.length} keys)`)
