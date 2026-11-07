/**
 * Sprint 155 (test keys, ritemark-dev governance/test-keys.md, Next item 2): the key for one provider, as Ritemark
 * uses it.
 *
 * The saved key (SecretStorage, what Settings writes) always comes first, exactly as before. Only in the test channel
 * (`RITEMARK_BUILD_CHANNEL=test`, our own test launches: `testChannelRequested`, the reading `buildChannel` uses), and
 * only when nothing is saved, the provider's environment variable stands in: the one `scripts/qa/with-test-keys.sh`
 * loads from the test-key vault into that one launch. Outside the test channel this module never reads the variable.
 *
 * A key from the environment is never stored, logged, sent to a webview or put in telemetry: callers hand it only to
 * the provider's own request or an agent process's environment, as they do a saved key. A webview may learn that a
 * key comes from the test environment (`keysFromTestEnvironment`: booleans), never the value.
 *
 * No vscode import, so `providerKeys.test.ts` runs under plain `tsx`.
 */

import { testChannelRequested } from '../analytics/consent';
import type { SettingsKeyName } from '../settings/settingsKeys';
import type { ByokKeys } from '../acp/acpKeyEnv';

/** Each Settings key's environment variable in a test launch (test-keys.md's key table). */
export const PROVIDER_KEY_ENV: Readonly<Record<SettingsKeyName, string>> = {
  'openai-api-key': 'OPENAI_API_KEY',
  'google-ai-key': 'GOOGLE_GENERATIVE_AI_API_KEY',
  'anthropic-api-key': 'ANTHROPIC_API_KEY',
  'openrouter-api-key': 'OPENROUTER_API_KEY',
  'elevenlabs-api-key': 'ELEVENLABS_API_KEY',
};

/** The part of SecretStorage a key read needs. */
export interface SecretReader {
  get(key: string): PromiseLike<string | undefined>;
}

type Env = Record<string, string | undefined>;

/** The test environment's key for `name`: only in the test channel, and only a non-empty value. */
export function testEnvironmentKey(name: SettingsKeyName, env: Env = process.env): string | undefined {
  if (!testChannelRequested(env)) return undefined;
  const value = env[PROVIDER_KEY_ENV[name]]?.trim();
  return value ? value : undefined;
}

/**
 * The key for `name`: the saved one, as `secrets.get` returns it; when none is saved, in the test channel only, the
 * test environment's. A failing secret store still throws, as before.
 */
export async function readProviderKey(
  secrets: SecretReader,
  name: SettingsKeyName,
  env: Env = process.env,
): Promise<string | undefined> {
  const saved = await secrets.get(name);
  if (saved) return saved;
  return testEnvironmentKey(name, env) ?? saved;
}

/**
 * A provider's answer about the test environment's key, safe for the page: in the test channel, the key itself and
 * any masked form of it (a word with `***` that ends in the key's last four characters, as OpenAI's "Incorrect API key
 * provided" shows it) become `[test key]`. Outside the test channel, or with no test environment key, the text is
 * returned unchanged.
 */
export function redactTestKey(text: string, name: SettingsKeyName, env: Env = process.env): string {
  const key = testEnvironmentKey(name, env);
  if (!key) return text;
  const tail = key.slice(-4);
  return text
    .split(key).join('[test key]')
    .replace(/\S*\*{3,}\S*/g, (word) => (word.replace(/[.,;:)\]'"]+$/, '').endsWith(tail) ? '[test key]' : word));
}

/**
 * Which keys the page may say come from the test environment: not saved, allowed, and present there. Booleans only.
 * Outside the test channel every answer is false.
 */
export function keysFromTestEnvironment(
  saved: Readonly<Record<SettingsKeyName, boolean>>,
  allowed: (name: SettingsKeyName) => boolean,
  env: Env = process.env,
): Record<SettingsKeyName, boolean> {
  const out = {} as Record<SettingsKeyName, boolean>;
  for (const name of Object.keys(PROVIDER_KEY_ENV) as SettingsKeyName[]) {
    out[name] = !saved[name] && allowed(name) && testEnvironmentKey(name, env) !== undefined;
  }
  return out;
}

/**
 * OpenCode's four provider keys (Sprint 76 R3a's BYOK), each through `readProviderKey`: what decides whether OpenCode
 * counts as set up and what its process gets (`buildByokEnv`), and Claude's key when it runs on an API key.
 */
export async function readByokKeys(secrets: SecretReader, env: Env = process.env): Promise<ByokKeys> {
  const [openai, google, anthropic, openrouter] = await Promise.all([
    readProviderKey(secrets, 'openai-api-key', env),
    readProviderKey(secrets, 'google-ai-key', env),
    readProviderKey(secrets, 'anthropic-api-key', env),
    readProviderKey(secrets, 'openrouter-api-key', env),
  ]);
  return { openai, google, anthropic, openrouter };
}
