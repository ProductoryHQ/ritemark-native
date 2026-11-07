/**
 * Sprint 155 (test keys, Next item 2): the test-channel key fallback.
 *
 * Fails if a saved key stops winning, if the test-key variables are read or removed outside the test channel, if they
 * stay in the extension host's environment after the snapshot (so every child process would inherit them), if a key
 * reaches an agent other than through the BYOK env under its own name (a plan-signed-in Claude Code must get no
 * ANTHROPIC_API_KEY), if a key value can reach a webview payload, a log line or telemetry, if OpenCode doesn't count a
 * test-environment key as ready in the test channel, or if one of the routed readers goes back to reading
 * SecretStorage directly (or the saved-key eye starts answering from the environment).
 *
 * Fake values only. Run: npx tsx src/ai/providerKeys.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
import {
  TEST_KEY_ENV,
  claudeApiKey,
  insightsAnthropicKey,
  keysFromTestEnvironment,
  readByokKeys,
  readProviderKey,
  redactTestKey,
  redactTestKeys,
  snapshotTestKeys,
  testEnvironmentKey,
  type SecretReader,
  type TestKeys,
} from './providerKeys';
import { buildByokEnv, byokProviderFlags } from '../acp/acpKeyEnv';
import { AcpManager } from '../acp/acpManager';
import { claudeRuntimeOptions } from '../agent/AgentRunner';
import { codexAppServerEnv } from '../codex/codexRetry';
import { deriveRuntimeAvailabilities, type RuntimeAvailabilityInput } from '../runtime/availability';
import { SETTINGS_KEY_NAMES, type SettingsKeyName } from '../settings/settingsKeys';
import { buildChannel } from '../analytics/consent';

const FAKE = 'test-not-a-key';
const SAVED = 'saved-not-a-key';
const TEST_KEY_PREFIX = 'RITEMARK_TEST_KEY_';
/** The names an agent or a provider SDK picks up by itself: none of them may come from the launch. */
const STANDARD_NAMES = ['OPENAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY'];

class FakeSecrets implements SecretReader {
  readonly reads: string[] = [];
  constructor(private readonly values: Partial<Record<string, string>> = {}) {}
  async get(key: string) { this.reads.push(key); return this.values[key]; }
}

const keysOf = (entries: Partial<Record<SettingsKeyName, string>>): TestKeys =>
  new Map(Object.entries(entries) as Array<[SettingsKeyName, string]>);
const ALL_FAKE = keysOf(Object.fromEntries(SETTINGS_KEY_NAMES.map((n) => [n, FAKE])));
const NONE = keysOf({});

/** Every test-key variable set to a fake value, plus the channel. */
function env(channel: string | undefined): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const name of Object.values(TEST_KEY_ENV)) out[name] = FAKE;
  if (channel !== undefined) out.RITEMARK_BUILD_CHANNEL = channel;
  return out;
}

/** An environment that records every read and delete of a test-key variable. */
function watched(target: Record<string, string | undefined>) {
  const reads: string[] = [];
  const deletes: string[] = [];
  const proxy = new Proxy(target, {
    get(t, p) { if (typeof p === 'string' && p.startsWith(TEST_KEY_PREFIX)) reads.push(p); return Reflect.get(t, p); },
    has(t, p) { if (typeof p === 'string' && p.startsWith(TEST_KEY_PREFIX)) reads.push(p); return Reflect.has(t, p); },
    deleteProperty(t, p) { if (typeof p === 'string') deletes.push(p); return Reflect.deleteProperty(t, p); },
    ownKeys(t) { reads.push('<ownKeys>'); return Reflect.ownKeys(t); },
  });
  return { proxy, reads, deletes };
}

const testKeyNamesIn = (e: Record<string, string | undefined>) => Object.keys(e).filter((k) => k.startsWith(TEST_KEY_PREFIX));

const NOT_TEST_CHANNELS = [undefined, '', 'prod', 'dev', 'testing', 'stable'];

async function main() {
  // A developer's own shell may carry provider keys; this run models a with-test-keys.sh launch, which sets none.
  for (const name of [...STANDARD_NAMES, ...Object.values(TEST_KEY_ENV), 'RITEMARK_BUILD_CHANNEL']) delete process.env[name];

  // ── The variable names are Ritemark-only: no tool or SDK reads them by itself ─
  assert.deepEqual(TEST_KEY_ENV, {
    'openai-api-key': 'RITEMARK_TEST_KEY_OPENAI',
    'google-ai-key': 'RITEMARK_TEST_KEY_GOOGLE',
    'anthropic-api-key': 'RITEMARK_TEST_KEY_ANTHROPIC',
    'openrouter-api-key': 'RITEMARK_TEST_KEY_OPENROUTER',
    'elevenlabs-api-key': 'RITEMARK_TEST_KEY_ELEVENLABS',
  });
  assert.deepEqual(Object.keys(TEST_KEY_ENV).sort(), [...SETTINGS_KEY_NAMES].sort(), 'one variable per Settings key');
  // The same reading of the channel as analytics' buildChannel
  assert.equal(buildChannel('2.2.0-0', false, env('test')), 'test');

  // ── Outside the test channel the variables are neither read nor deleted ─────
  for (const channel of NOT_TEST_CHANNELS) {
    const w = watched(env(channel));
    snapshotTestKeys(w.proxy);
    assert.deepEqual(w.reads, [], `channel ${String(channel)}: no test-key variable read`);
    assert.deepEqual(w.deletes, [], `channel ${String(channel)}: nothing deleted`);
    assert.equal(testKeyNamesIn(w.proxy).length, 5, `channel ${String(channel)}: all five still there`);
  }
  // …and the real process environment: left exactly as it was, and nothing comes from it
  process.env.RITEMARK_TEST_KEY_OPENAI = FAKE;
  snapshotTestKeys();
  assert.equal(process.env.RITEMARK_TEST_KEY_OPENAI, FAKE, 'outside the test channel: process.env untouched');
  for (const name of SETTINGS_KEY_NAMES) {
    assert.equal(await readProviderKey(new FakeSecrets(), name), undefined, `${name}: nothing outside the test channel`);
    assert.equal(testEnvironmentKey(name), undefined);
  }
  delete process.env.RITEMARK_TEST_KEY_OPENAI;

  // A blank variable is no key, and is removed all the same
  const blank: Record<string, string | undefined> = { RITEMARK_BUILD_CHANNEL: 'test', RITEMARK_TEST_KEY_GOOGLE: '   ' };
  snapshotTestKeys(blank);
  assert.deepEqual(testKeyNamesIn(blank), [], 'a blank variable is removed');
  assert.equal(testEnvironmentKey('google-ai-key'), undefined, 'a blank variable is no key');

  // ── Order: the saved key first, then (test channel only) the snapshot ───────
  for (const name of SETTINGS_KEY_NAMES) {
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: SAVED }), name, ALL_FAKE), SAVED, `${name}: a saved key wins in the test channel`);
    assert.equal(await readProviderKey(new FakeSecrets(), name, ALL_FAKE), FAKE, `${name}: nothing saved, the test environment's key`);
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: '' }), name, ALL_FAKE), FAKE, `${name}: an empty saved value counts as none`);
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: SAVED }), name, NONE), SAVED, `${name}: saved key unchanged without test keys`);
    assert.equal(await readProviderKey(new FakeSecrets(), name, NONE), undefined, `${name}: none without test keys`);
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: '' }), name, NONE), '', `${name}: an empty saved value is returned as before`);
  }
  // A failing store still throws, as before (no silent fallback past a keychain error)
  await assert.rejects(readProviderKey({ get: async () => { throw new Error('locked'); } }, 'openai-api-key', ALL_FAKE), /locked/);

  // ── The test channel: the snapshot takes the five and empties the environment ─
  // (what `activate` does first, so no child of the extension host inherits them: Claude Code's SDK spreads
  // process.env, Codex gets codexAppServerEnv(process.env), git, MCP servers…)
  Object.assign(process.env, env('test'));
  snapshotTestKeys();
  assert.deepEqual(testKeyNamesIn(process.env), [], 'after the snapshot process.env holds none of the variables');
  for (const name of STANDARD_NAMES) assert.equal(process.env[name], undefined, `${name} is not in process.env`);
  for (const name of SETTINGS_KEY_NAMES) {
    assert.equal(await readProviderKey(new FakeSecrets(), name), FAKE, `${name}: read from the snapshot`);
    assert.equal(await readProviderKey(new FakeSecrets({ [name]: SAVED }), name), SAVED, `${name}: a saved key still wins`);
  }

  // Codex: its app server gets the process env, which now has no key under any name
  const codexEnv = codexAppServerEnv(process.env);
  assert.deepEqual(testKeyNamesIn(codexEnv), [], 'Codex: no test-key variable');
  for (const name of STANDARD_NAMES) assert.equal(codexEnv[name], undefined, `Codex: no ${name}`);

  // Claude Code: ANTHROPIC_API_KEY only when it runs on an API key
  const byok = await readByokKeys(new FakeSecrets());
  for (const plan of ['claude-oauth', null, undefined, 'cli']) {
    assert.equal(claudeApiKey(plan, byok.anthropic), undefined, `authMethod ${String(plan)}: no API key`);
  }
  assert.equal(claudeApiKey('api-key', byok.anthropic), FAKE, 'authMethod api-key: the key');
  const declaration = { env: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000' } };
  const planEnv = claudeRuntimeOptions(claudeApiKey('claude-oauth', byok.anthropic), declaration).env ?? {};
  assert.equal(planEnv.ANTHROPIC_API_KEY, undefined, "a plan-signed-in Claude Code's env has no ANTHROPIC_API_KEY");
  assert.deepEqual(testKeyNamesIn(planEnv), [], "a plan-signed-in Claude Code's env has no test-key variable");
  assert.ok(!Object.values(planEnv).includes(FAKE), "a plan-signed-in Claude Code's env holds no key value");
  assert.equal(claudeRuntimeOptions(claudeApiKey('api-key', byok.anthropic), undefined).env?.ANTHROPIC_API_KEY, FAKE, 'API-key Claude Code gets it');

  // ── Transcribe Insights (second review, finding 2): main's behaviour outside the test channel ─
  // A saved key goes to Insights whatever the sign-in method, and no `claude auth status` runs for it; only a key
  // from the test environment waits on the sign-in method (claudeApiKey).
  {
    let statusCalls = 0;
    const authMethod = (method: string | null) => async () => { statusCalls++; return method; };
    // Outside the test channel (no snapshot), a saved key and a plan sign-in: the saved key, as on main
    assert.equal(await insightsAnthropicKey(new FakeSecrets({ 'anthropic-api-key': SAVED }), authMethod('claude-oauth'), NONE), SAVED, 'Insights: a saved key with a plan sign-in, outside the test channel');
    assert.equal(await insightsAnthropicKey(new FakeSecrets(), authMethod('claude-oauth'), NONE), undefined, 'Insights: no key, outside the test channel');
    assert.equal(await insightsAnthropicKey(new FakeSecrets({ 'anthropic-api-key': '' }), authMethod('api-key'), NONE), '', 'Insights: an empty saved value is returned as on main');
    // The test channel with a saved key: still the saved key, still no sign-in check
    assert.equal(await insightsAnthropicKey(new FakeSecrets({ 'anthropic-api-key': SAVED }), authMethod('claude-oauth'), ALL_FAKE), SAVED, 'Insights: a saved key wins in the test channel too');
    assert.equal(statusCalls, 0, 'Insights: no claude auth status when no test-environment key is involved');
    // The test channel, only the env key: a plan sign-in gets none, an API-key sign-in gets it
    assert.equal(await insightsAnthropicKey(new FakeSecrets(), authMethod('claude-oauth'), ALL_FAKE), undefined, 'Insights: an env key with a plan sign-in gets no key');
    assert.equal(await insightsAnthropicKey(new FakeSecrets(), authMethod('api-key'), ALL_FAKE), FAKE, 'Insights: an env key with an API-key sign-in');
    assert.equal(statusCalls, 2, 'Insights: the sign-in is checked only for the env key');
  }

  // OpenCode: its spawn env gets the Google key under the names it reads, and no test-key variable
  const onlyGemini = keysOf({ 'google-ai-key': FAKE });
  const opencode = new AcpManager({
    binaryPath: process.execPath,
    workspaceRoot: os.tmpdir(),
    byokEnv: buildByokEnv(await readByokKeys(new FakeSecrets(), onlyGemini)),
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    approveWrite: async () => true,
    onProgress: () => undefined,
  } as unknown as ConstructorParameters<typeof AcpManager>[0]);
  const opencodeEnv = (opencode as unknown as { buildSpawnEnv(): NodeJS.ProcessEnv }).buildSpawnEnv();
  assert.equal(opencodeEnv.GOOGLE_GENERATIVE_AI_API_KEY, FAKE, "OpenCode's env gets the Google key");
  assert.equal(opencodeEnv.GEMINI_API_KEY, FAKE);
  assert.deepEqual(testKeyNamesIn(opencodeEnv), [], 'OpenCode: no test-key variable');
  for (const name of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY']) {
    assert.equal(opencodeEnv[name], undefined, `OpenCode: only the keys it was given (${name})`);
  }
  opencode.dispose();

  // ── The webview learns booleans, never the value ────────────────────────────
  const noneSaved = Object.fromEntries(SETTINGS_KEY_NAMES.map((n) => [n, false])) as Record<SettingsKeyName, boolean>;
  const all = () => true;
  const fromEnv = keysFromTestEnvironment(noneSaved, all, ALL_FAKE);
  assert.ok(Object.values(fromEnv).every((v) => v === true));
  assert.ok(!JSON.stringify(fromEnv).includes(FAKE), 'Settings payload: no value');
  assert.equal(keysFromTestEnvironment({ ...noneSaved, 'google-ai-key': true }, all, ALL_FAKE)['google-ai-key'], false, 'a saved key is not "from the test environment"');
  assert.equal(keysFromTestEnvironment(noneSaved, (n) => n !== 'elevenlabs-api-key', ALL_FAKE)['elevenlabs-api-key'], false, 'a row whose flag is off');
  assert.ok(Object.values(keysFromTestEnvironment(noneSaved, all, NONE)).every((v) => v === false));

  const flags = byokProviderFlags(await readByokKeys(new FakeSecrets(), ALL_FAKE));
  assert.deepEqual(flags, { google: true, openai: true, anthropic: true, openrouter: true });
  assert.ok(!JSON.stringify(flags).includes(FAKE), 'sidebar acpProviders payload: no value');

  // A provider's error about the test key reaches the page without it (Settings' Test, Flow steps)
  const longKey = 'sk-proj-test-not-a-key-0123456789abcd';
  const openAiKeys = keysOf({ 'openai-api-key': longKey });
  const openAiError = 'Incorrect API key provided: sk-proj-************************************abcd. You can find your API key at https://platform.openai.com/account/api-keys.';
  const redacted = redactTestKey(openAiError, 'openai-api-key', openAiKeys);
  assert.ok(!redacted.includes('abcd') && redacted.includes('Incorrect API key provided: [test key]'), redacted);
  assert.equal(redactTestKey(`bad key ${longKey}!`, 'openai-api-key', openAiKeys), 'bad key [test key]!');
  assert.equal(redactTestKey('HTTP 401 *** maybe', 'openai-api-key', openAiKeys), 'HTTP 401 *** maybe', 'other words kept');
  assert.equal(redactTestKey(openAiError, 'openai-api-key', NONE), openAiError, 'without test keys: unchanged');
  // Every key at once (a Flow step's error may be about either provider)
  const both = keysOf({ 'openai-api-key': longKey, 'google-ai-key': 'AIza-test-not-a-key-wxyz' });
  const twice = redactTestKeys(`${openAiError} and AIza-test-not-a-key-wxyz`, both);
  assert.ok(!twice.includes('abcd') && !twice.includes('wxyz'), twice);
  assert.equal(redactTestKeys(openAiError, NONE), openAiError);

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
  const testFlags = byokProviderFlags(await readByokKeys(new FakeSecrets(), onlyGemini));
  assert.equal(deriveRuntimeAvailabilities(availabilityInput(testFlags)).opencode.state, 'ready', 'test channel: OpenCode ready on the env key');
  const prodFlags = byokProviderFlags(await readByokKeys(new FakeSecrets(), NONE));
  assert.equal(deriveRuntimeAvailabilities(availabilityInput(prodFlags)).opencode.state, 'needs-configuration', 'outside it: as before');

  // ── Agent processes: the BYOK env carries each key under the agent's own name ─
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets(), onlyGemini)), { GEMINI_API_KEY: FAKE, GOOGLE_GENERATIVE_AI_API_KEY: FAKE });
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets(), ALL_FAKE)), {
    GEMINI_API_KEY: FAKE, GOOGLE_GENERATIVE_AI_API_KEY: FAKE, OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, OPENROUTER_API_KEY: FAKE,
  });
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets(), NONE)), {}, 'without test keys: none injected');
  assert.deepEqual(buildByokEnv(await readByokKeys(new FakeSecrets({ 'google-ai-key': SAVED }), ALL_FAKE)), {
    GEMINI_API_KEY: SAVED, GOOGLE_GENERATIVE_AI_API_KEY: SAVED, OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, OPENROUTER_API_KEY: FAKE,
  }, 'saved Google key wins, the rest from the snapshot');

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
    snapshotTestKeys(env('test'));
    for (const name of SETTINGS_KEY_NAMES) await readProviderKey(new FakeSecrets(), name);
    await readByokKeys(new FakeSecrets());
    keysFromTestEnvironment(noneSaved, all);
    redactTestKeys('text');
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
  assert.ok(!/OPENAI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|ELEVENLABS_API_KEY/.test(moduleSource.replace(/\/\*\*[\s\S]*?\*\//g, '')), 'providerKeys.ts reads no standard name');
  for (const rel of ['analytics/posthog.ts', 'analytics/consent.ts', 'analytics/events.ts']) {
    assert.ok(!/from '[^']*providerKeys'/.test(read(rel)), `${rel}: telemetry never imports the key reader`);
  }

  // activate's first statement takes the snapshot, before anything can spawn a process or read a key
  const extension = read('extension.ts');
  const body = extension.slice(extension.indexOf('export function activate(context: vscode.ExtensionContext) {'));
  const firstStatement = body.split('\n').slice(1).map((l) => l.trim()).find((l) => l && !l.startsWith('//'));
  assert.equal(firstStatement, 'snapshotTestKeys();', `activate starts with the snapshot (found: ${firstStatement})`);

  const routed: Record<string, string[]> = {
    'views/UnifiedViewProvider.ts': ["readByokKeys(this._secrets", "readProviderKey(this._secrets, 'anthropic-api-key')", 'claudeApiKey(claudeStatus.authMethod, byokKeys.anthropic)', 'claudeApiKey((await getSetupStatus()).authMethod, byokKeys.anthropic)'],
    'settings/RitemarkSettingsProvider.ts': [
      "readProviderKey(this.context.secrets, 'openai-api-key')",
      "readProviderKey(this.context.secrets, 'google-ai-key')",
      "readProviderKey(this.context.secrets, 'elevenlabs-api-key')",
      "readProviderKey(this.context.secrets, 'openrouter-api-key')",
      'keysFromTestEnvironment(',
    ],
    'extension.ts': ["readProviderKey(context.secrets, 'openai-api-key')", "readProviderKey(context.secrets, 'google-ai-key')", "readProviderKey(context.secrets, 'anthropic-api-key')"],
    'transcriptWorkbenchProvider.ts': ['insightsAnthropicKey(this._context.secrets, async () => (await getSetupStatus()).authMethod)'],
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
