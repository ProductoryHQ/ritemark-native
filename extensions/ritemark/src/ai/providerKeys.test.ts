/**
 * Sprint 155 (test keys, Next item 2): the test-channel key fallback.
 *
 * Fails if a saved key stops winning, if an environment key is read outside the test channel, if a key value can
 * reach a webview payload, a log line or telemetry, if OpenCode doesn't count a test-environment key as ready in the
 * test channel, if the agents' environment doesn't carry it there, or if one of the routed readers goes back to
 * reading SecretStorage directly (or the saved-key eye starts answering from the environment).
 *
 * Fake values only. Run: npx tsx src/ai/providerKeys.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROVIDER_KEY_ENV,
  keysFromTestEnvironment,
  readByokKeys,
  readProviderKey,
  redactTestKey,
  testEnvironmentKey,
  type SecretReader,
} from './providerKeys';
import { buildByokEnv, byokProviderFlags } from '../acp/acpKeyEnv';
import { deriveRuntimeAvailabilities, type RuntimeAvailabilityInput } from '../runtime/availability';
import { SETTINGS_KEY_NAMES, type SettingsKeyName } from '../settings/settingsKeys';
import { buildChannel } from '../analytics/consent';

const FAKE = 'test-not-a-key';
const SAVED = 'saved-not-a-key';

class FakeSecrets implements SecretReader {
  readonly reads: string[] = [];
  constructor(private readonly values: Partial<Record<string, string>> = {}) {}
  async get(key: string) { this.reads.push(key); return this.values[key]; }
}

/** Every provider variable set to a fake value, plus the channel. */
function env(channel: string | undefined): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const name of Object.values(PROVIDER_KEY_ENV)) out[name] = FAKE;
  if (channel !== undefined) out.RITEMARK_BUILD_CHANNEL = channel;
  return out;
}

const TEST = env('test');
const NOT_TEST = [env(undefined), env(''), env('prod'), env('dev'), env('testing'), env('stable')];

async function main() {
  // ── The variable names are test-keys.md's ───────────────────────────────────
  assert.deepEqual(PROVIDER_KEY_ENV, {
    'openai-api-key': 'OPENAI_API_KEY',
    'google-ai-key': 'GOOGLE_GENERATIVE_AI_API_KEY',
    'anthropic-api-key': 'ANTHROPIC_API_KEY',
    'openrouter-api-key': 'OPENROUTER_API_KEY',
    'elevenlabs-api-key': 'ELEVENLABS_API_KEY',
  });
  assert.deepEqual(Object.keys(PROVIDER_KEY_ENV).sort(), [...SETTINGS_KEY_NAMES].sort(), 'one variable per Settings key');
  // The same reading of the channel as analytics' buildChannel
  assert.equal(buildChannel('2.2.0-0', false, TEST), 'test');

  // ── Order: the saved key first, then (test channel only) the environment ────
  for (const name of SETTINGS_KEY_NAMES) {
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: SAVED }), name, TEST), SAVED, `${name}: a saved key wins in the test channel`);
    assert.equal(await readProviderKey(new FakeSecrets(), name, TEST), FAKE, `${name}: nothing saved, the test environment's key`);
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: '' }), name, TEST), FAKE, `${name}: an empty saved value counts as none`);
    for (const e of NOT_TEST) {
      assert.equal(await readProviderKey(new FakeSecrets({ [name]: SAVED }), name, e), SAVED, `${name}: saved key unchanged outside the test channel`);
      assert.equal(await readProviderKey(new FakeSecrets(), name, e), undefined, `${name}: env key ignored with channel ${String(e.RITEMARK_BUILD_CHANNEL)}`);
      assert.equal(await readProviderKey(new FakeSecrets({ [name]: '' }), name, e), '', `${name}: an empty saved value is returned as before`);
      assert.equal(testEnvironmentKey(name, e), undefined);
    }
  }
  // A blank variable is no key; the channel must be set, not just the key
  assert.equal(testEnvironmentKey('google-ai-key', { RITEMARK_BUILD_CHANNEL: 'test', GOOGLE_GENERATIVE_AI_API_KEY: '   ' }), undefined);
  assert.equal(testEnvironmentKey('google-ai-key', { GOOGLE_GENERATIVE_AI_API_KEY: FAKE }), undefined);
  // A failing store still throws, as before (no silent fallback past a keychain error)
  await assert.rejects(readProviderKey({ get: async () => { throw new Error('locked'); } }, 'openai-api-key', TEST), /locked/);
  // The default environment is the process's: unset here, so nothing comes from it
  const before = process.env.RITEMARK_BUILD_CHANNEL;
  delete process.env.RITEMARK_BUILD_CHANNEL;
  process.env.OPENAI_API_KEY = FAKE;
  assert.equal(await readProviderKey(new FakeSecrets(), 'openai-api-key'), undefined, 'process.env outside the test channel is ignored');
  process.env.RITEMARK_BUILD_CHANNEL = 'test';
  assert.equal(await readProviderKey(new FakeSecrets(), 'openai-api-key'), FAKE, 'process.env in the test channel');
  if (before === undefined) delete process.env.RITEMARK_BUILD_CHANNEL; else process.env.RITEMARK_BUILD_CHANNEL = before;
  delete process.env.OPENAI_API_KEY;

  // ── The webview learns booleans, never the value ────────────────────────────
  const noneSaved = Object.fromEntries(SETTINGS_KEY_NAMES.map((n) => [n, false])) as Record<SettingsKeyName, boolean>;
  const all = () => true;
  const fromEnv = keysFromTestEnvironment(noneSaved, all, TEST);
  assert.ok(Object.values(fromEnv).every((v) => v === true));
  assert.ok(!JSON.stringify(fromEnv).includes(FAKE), 'Settings payload: no value');
  assert.equal(keysFromTestEnvironment({ ...noneSaved, 'google-ai-key': true }, all, TEST)['google-ai-key'], false, 'a saved key is not "from the test environment"');
  assert.equal(keysFromTestEnvironment(noneSaved, (n) => n !== 'elevenlabs-api-key', TEST)['elevenlabs-api-key'], false, 'a row whose flag is off');
  for (const e of NOT_TEST) assert.ok(Object.values(keysFromTestEnvironment(noneSaved, all, e)).every((v) => v === false));

  const byok = await readByokKeys(new FakeSecrets(), TEST);
  const flags = byokProviderFlags(byok);
  assert.deepEqual(flags, { google: true, openai: true, anthropic: true, openrouter: true });
  assert.ok(!JSON.stringify(flags).includes(FAKE), 'sidebar acpProviders payload: no value');

  // A provider's error about the test key reaches the page without it (Settings' Test)
  const longKey = 'sk-proj-test-not-a-key-0123456789abcd';
  const keyEnv = { RITEMARK_BUILD_CHANNEL: 'test', OPENAI_API_KEY: longKey };
  const openAiError = 'Incorrect API key provided: sk-proj-************************************abcd. You can find your API key at https://platform.openai.com/account/api-keys.';
  const redacted = redactTestKey(openAiError, 'openai-api-key', keyEnv);
  assert.ok(!redacted.includes('abcd') && redacted.includes('Incorrect API key provided: [test key]'), redacted);
  assert.equal(redactTestKey(`bad key ${longKey}!`, 'openai-api-key', keyEnv), 'bad key [test key]!');
  assert.equal(redactTestKey('HTTP 401 *** maybe', 'openai-api-key', keyEnv), 'HTTP 401 *** maybe', 'other words kept');
  for (const e of NOT_TEST) assert.equal(redactTestKey(openAiError, 'openai-api-key', { ...e, OPENAI_API_KEY: longKey }), openAiError, 'outside the test channel: unchanged');

  // ── Availability: OpenCode counts a test-environment key as ready ───────────
  const availabilityInput = (acpProviders: RuntimeAvailabilityInput['acpProviders']): RuntimeAvailabilityInput => ({
    runtimeHydration: {
      'claude-code': { phase: 'ready', error: null },
      codex: { phase: 'ready', error: null },
      opencode: { phase: 'ready', error: null },
    },
    setupStatus: { state: 'ready', error: null },
    codexStatus: { state: 'ready', error: null },
    opencodeEnabled: true,
    acpProviders,
    byokProviderModels: { google: [{ id: 'gemini-x' }] },
  });
  const onlyGemini = { RITEMARK_BUILD_CHANNEL: 'test', GOOGLE_GENERATIVE_AI_API_KEY: FAKE };
  const testFlags = byokProviderFlags(await readByokKeys(new FakeSecrets(), onlyGemini));
  assert.equal(deriveRuntimeAvailabilities(availabilityInput(testFlags)).opencode.state, 'ready', 'test channel: OpenCode ready on the env key');
  const prodFlags = byokProviderFlags(await readByokKeys(new FakeSecrets(), { GOOGLE_GENERATIVE_AI_API_KEY: FAKE }));
  assert.equal(deriveRuntimeAvailabilities(availabilityInput(prodFlags)).opencode.state, 'needs-configuration', 'outside it: as before');

  // ── Agent processes: the key reaches OpenCode's (and Claude's API-key) environment ─
  const agentEnv = buildByokEnv(await readByokKeys(new FakeSecrets(), onlyGemini));
  assert.deepEqual(agentEnv, { GEMINI_API_KEY: FAKE, GOOGLE_GENERATIVE_AI_API_KEY: FAKE });
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets(), TEST)), {
    GEMINI_API_KEY: FAKE, GOOGLE_GENERATIVE_AI_API_KEY: FAKE, OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, OPENROUTER_API_KEY: FAKE,
  });
  for (const e of NOT_TEST) assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets(), e)), {}, 'outside the test channel: no env key injected');
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets({ 'google-ai-key': SAVED }), TEST)), {
    GEMINI_API_KEY: SAVED, GOOGLE_GENERATIVE_AI_API_KEY: SAVED, OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, OPENROUTER_API_KEY: FAKE,
  }, 'saved Google key wins, the rest from the environment');

  // ── Logs: nothing the fallback does writes a line ───────────────────────────
  const lines: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  const original = methods.map((m) => console[m]);
  methods.forEach((m) => { (console as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); }; });
  const writes: string[] = [];
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  (process.stdout as unknown as { write: unknown }).write = (chunk: unknown) => { writes.push(String(chunk)); return true; };
  (process.stderr as unknown as { write: unknown }).write = (chunk: unknown) => { writes.push(String(chunk)); return true; };
  try {
    for (const name of SETTINGS_KEY_NAMES) await readProviderKey(new FakeSecrets(), name, TEST);
    await readByokKeys(new FakeSecrets(), TEST);
    keysFromTestEnvironment(noneSaved, all, TEST);
  } finally {
    methods.forEach((m, i) => { (console as unknown as Record<string, unknown>)[m] = original[i]; });
    (process.stdout as unknown as { write: unknown }).write = stdout;
    (process.stderr as unknown as { write: unknown }).write = stderr;
  }
  assert.deepEqual(lines, [], 'no console line');
  assert.deepEqual(writes, [], 'no stdout/stderr write');

  // ── Source: the module logs nothing and sends nothing; the readers go through it ─
  const root = join(__dirname, '..');
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
  const moduleSource = read('ai/providerKeys.ts');
  assert.ok(!/console\.|postMessage|capture|telemetry\(|writeFile|secrets\.store/.test(moduleSource.replace(/\/\*\*[\s\S]*?\*\//g, '')), 'providerKeys.ts: no log, message, telemetry, file or store');
  for (const rel of ['analytics/posthog.ts', 'analytics/consent.ts', 'analytics/events.ts']) {
    assert.ok(!/from '[^']*providerKeys'/.test(read(rel)), `${rel}: telemetry never imports the key reader`);
  }

  const routed: Record<string, string[]> = {
    'views/UnifiedViewProvider.ts': ["readByokKeys(this._secrets", "readProviderKey(this._secrets, 'anthropic-api-key')"],
    'settings/RitemarkSettingsProvider.ts': [
      "readProviderKey(this.context.secrets, 'openai-api-key')",
      "readProviderKey(this.context.secrets, 'google-ai-key')",
      "readProviderKey(this.context.secrets, 'elevenlabs-api-key')",
      "readProviderKey(this.context.secrets, 'openrouter-api-key')",
      'keysFromTestEnvironment(',
    ],
    'extension.ts': ["readProviderKey(context.secrets, 'openai-api-key')", "readProviderKey(context.secrets, 'google-ai-key')", "readProviderKey(context.secrets, 'anthropic-api-key')"],
    'transcriptWorkbenchProvider.ts': ["readProviderKey(this._context.secrets, 'anthropic-api-key')"],
    'speech/index.ts': ["readProviderKey(context.secrets, 'elevenlabs-api-key')"],
    'ai/apiKeyManager.ts': ['readProviderKey(this.secrets, API_KEY_ID)'],
    'flows/FlowEditorProvider.ts': ['readProviderKey(this.context.secrets, stepKeySecret(provider))', 'readProviderKey(this.context.secrets, STEP_KEY_SECRETS.gemini)'],
    'flows/nodes/LLMNodeExecutor.ts': ['readProviderKey(extensionContext.secrets, STEP_KEY_SECRETS.gemini)'],
    'flows/nodes/ImageNodeExecutor.ts': ['readProviderKey(extensionContext.secrets, STEP_KEY_SECRETS.gemini)'],
  };
  for (const [rel, needles] of Object.entries(routed)) {
    const source = read(rel);
    for (const needle of needles) assert.ok(source.includes(needle), `${rel} reads through the fallback: ${needle}`);
  }
  // No reader left that takes one of the five keys straight from SecretStorage by name
  const direct = /secrets\.get\(\s*(?:'(?:openai-api-key|google-ai-key|anthropic-api-key|openrouter-api-key|elevenlabs-api-key)'|STEP_KEY_SECRETS|stepKeySecret)/;
  for (const rel of Object.keys(routed)) assert.ok(!direct.test(read(rel)), `${rel}: no direct read of a provider key`);

  // The saved-key eye and the "saved" booleans stay saved-only: the env value never goes to the page
  const settings = read('settings/RitemarkSettingsProvider.ts');
  const reveal = settings.slice(settings.indexOf('private async revealApiKey'), settings.indexOf('private updateFallback'));
  assert.ok(reveal.includes('await this.context.secrets.get(key)') && !reveal.includes('readProviderKey'), 'the eye answers only a saved key');
  const savedKeys = settings.slice(settings.indexOf('private async savedKeys'), settings.indexOf('private async revealApiKey'));
  assert.ok(savedKeys.includes('this.context.secrets.get(name)') && !savedKeys.includes('readProviderKey'), '"Saved" means saved');
  const manager = read('ai/apiKeyManager.ts');
  const masked = manager.slice(manager.indexOf('async getMaskedKey'), manager.indexOf('Singleton instance'));
  assert.ok(masked.includes('this.secrets.get(API_KEY_ID)') && !masked.includes('getAPIKey()'), 'the masked key shows only a saved key');
  assert.ok(read('commands/configureApiKey.ts').includes('hasSavedAPIKey()'), 'the command that updates or deletes the saved key asks about the saved one');

  console.log('providerKeys: all assertions passed');
}

main().catch((error) => { console.error(error); process.exit(1); });
