/**
 * Sprint 155 (test keys, ritemark-dev governance/test-keys.md, Next item 2): the key for one provider, as Ritemark
 * uses it.
 *
 * The saved key (SecretStorage, what Settings writes) always comes first, exactly as before. Only in the test channel
 * (`RITEMARK_BUILD_CHANNEL=test`, our own test launches: `testChannelRequested`, the reading `buildChannel` uses), and
 * only when nothing is saved, the test environment's key stands in.
 *
 * Where it comes from: `scripts/qa/with-test-keys.sh` loads each key from the test-key vault into the one launch it
 * runs, under a Ritemark-only name (`TEST_KEY_ENV`: `RITEMARK_TEST_KEY_OPENAI`…), never the provider's standard name
 * (`OPENAI_API_KEY`…), which Claude Code, Codex, git hooks, MCP servers and a terminal's `env` would all pick up by
 * themselves. `activate` calls `snapshotTestKeys()` first: in the test channel it copies the five variables into this
 * module's private map and deletes them from the extension host's `process.env`, so no process the extension host
 * starts inherits them. Outside the test channel it neither reads nor deletes them, and every reader here answers as
 * if there were none. (The main process and the processes it starts, terminals among them, still hold the
 * `RITEMARK_TEST_KEY_*` names: see the script.)
 *
 * A key reaches an agent only through the BYOK env (`buildByokEnv`, from `readByokKeys`), under the name that agent
 * reads: OpenCode's provider names; Claude Code's `ANTHROPIC_API_KEY` only when it runs on an API key
 * (`claudeApiKey`); Codex none, as with a saved key.
 *
 * A key from the environment is never stored, logged, sent to a webview or put in telemetry: callers hand it only to
 * the provider's own request or an agent process's environment, as they do a saved key. A webview may learn that a
 * key comes from the test environment (`keysFromTestEnvironment`: booleans), never the value; a provider's error is
 * redacted before it is shown (`redactTestKey`, `redactTestKeys`).
 *
 * No vscode import, so `providerKeys.test.ts` runs under plain `tsx`.
 */

import { testChannelRequested } from '../analytics/consent';
import type { SettingsKeyName } from '../settings/settingsKeys';
import type { ByokKeys } from '../acp/acpKeyEnv';

/** Each Settings key's variable in a test launch: Ritemark-only names, which no tool reads by itself. */
export const TEST_KEY_ENV: Readonly<Record<SettingsKeyName, string>> = {
  'openai-api-key': 'RITEMARK_TEST_KEY_OPENAI',
  'google-ai-key': 'RITEMARK_TEST_KEY_GOOGLE',
  'anthropic-api-key': 'RITEMARK_TEST_KEY_ANTHROPIC',
  'openrouter-api-key': 'RITEMARK_TEST_KEY_OPENROUTER',
  'elevenlabs-api-key': 'RITEMARK_TEST_KEY_ELEVENLABS',
};

/** The test environment's keys, by Settings key. */
export type TestKeys = ReadonlyMap<SettingsKeyName, string>;

/** The part of SecretStorage a key read needs. */
export interface SecretReader {
  get(key: string): PromiseLike<string | undefined>;
}

type Env = Record<string, string | undefined>;

/** What `snapshotTestKeys` took: empty outside the test channel. Never exported, never iterated into a message. */
const snapshot = new Map<SettingsKeyName, string>();

/**
 * Once, first thing in `activate`: in the test channel only, take the five test-key variables out of `env` (the
 * extension host's `process.env`) into this module. Each is deleted, a blank one too; a non-blank one is kept. Outside
 * the test channel `env` is neither read past the channel nor changed.
 */
export function snapshotTestKeys(env: Env = process.env): void {
  if (!testChannelRequested(env)) return;
  for (const name of Object.keys(TEST_KEY_ENV) as SettingsKeyName[]) {
    const variable = TEST_KEY_ENV[name];
    const value = env[variable]?.trim();
    delete env[variable];
    if (value) snapshot.set(name, value);
  }
}

/** The test environment's key for `name`: only what the snapshot took in the test channel, a non-empty value. */
export function testEnvironmentKey(name: SettingsKeyName, keys: TestKeys = snapshot): string | undefined {
  const value = keys.get(name);
  return value ? value : undefined;
}

/**
 * The key for `name`: the saved one, as `secrets.get` returns it; when none is saved, in the test channel only, the
 * test environment's. A failing secret store still throws, as before.
 */
export async function readProviderKey(
  secrets: SecretReader,
  name: SettingsKeyName,
  keys: TestKeys = snapshot,
): Promise<string | undefined> {
  const saved = await secrets.get(name);
  if (saved) return saved;
  return testEnvironmentKey(name, keys) ?? saved;
}

/**
 * A provider's answer about the test environment's key, safe for the page or a log: the key itself and any masked
 * form of it (a word with `***` that ends in the key's last four characters, as OpenAI's "Incorrect API key provided"
 * shows it) become `[test key]`. With no test environment key (outside the test channel), the text is unchanged.
 */
export function redactTestKey(text: string, name: SettingsKeyName, keys: TestKeys = snapshot): string {
  const key = testEnvironmentKey(name, keys);
  if (!key) return text;
  const tail = key.slice(-4);
  return text
    .split(key).join('[test key]')
    .replace(/\S*\*{3,}\S*/g, (word) => (word.replace(/[.,;:)\]'"]+$/, '').endsWith(tail) ? '[test key]' : word));
}

/** `redactTestKey` for every test environment key at once: for an error that may be about any provider. */
export function redactTestKeys(text: string, keys: TestKeys = snapshot): string {
  let out = text;
  for (const name of Object.keys(TEST_KEY_ENV) as SettingsKeyName[]) out = redactTestKey(out, name, keys);
  return out;
}

/**
 * Which keys the page may say come from the test environment: not saved, allowed, and present there. Booleans only.
 * Outside the test channel every answer is false.
 */
export function keysFromTestEnvironment(
  saved: Readonly<Record<SettingsKeyName, boolean>>,
  allowed: (name: SettingsKeyName) => boolean,
  keys: TestKeys = snapshot,
): Record<SettingsKeyName, boolean> {
  const out = {} as Record<SettingsKeyName, boolean>;
  for (const name of Object.keys(TEST_KEY_ENV) as SettingsKeyName[]) {
    out[name] = !saved[name] && allowed(name) && testEnvironmentKey(name, keys) !== undefined;
  }
  return out;
}

/**
 * OpenCode's four provider keys (Sprint 76 R3a's BYOK), each through `readProviderKey`: what decides whether OpenCode
 * counts as set up and what its process gets (`buildByokEnv`), and Claude's key when it runs on an API key.
 */
export async function readByokKeys(secrets: SecretReader, keys: TestKeys = snapshot): Promise<ByokKeys> {
  const [openai, google, anthropic, openrouter] = await Promise.all([
    readProviderKey(secrets, 'openai-api-key', keys),
    readProviderKey(secrets, 'google-ai-key', keys),
    readProviderKey(secrets, 'anthropic-api-key', keys),
    readProviderKey(secrets, 'openrouter-api-key', keys),
  ]);
  return { openai, google, anthropic, openrouter };
}

/**
 * The Anthropic key a Claude Code process gets: only when Claude runs on an API key (`authMethod === 'api-key'`). A
 * plan-signed-in Claude Code gets none, so a saved or test key never switches it to the API key.
 */
export function claudeApiKey(authMethod: string | null | undefined, anthropicKey: string | undefined): string | undefined {
  return authMethod === 'api-key' ? anthropicKey : undefined;
}
