/**
 * Sprint 149, PR 4 (S20a; the plan's finding "the Settings page can write any secret"): the page's `setApiKey`
 * stores and removes only the five keys, each with its row's flag on. It fails if a name off the list, such as the
 * Cloudflare connection's `ritemark.publish.cloudflare.v1`, is ever stored or deleted, and if the host's handler
 * writes a secret by the message's name without going through `applyApiKeyMessage`.
 *
 * Run: npx tsx src/settings/settingsKeys.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SETTINGS_KEY_NAMES, applyApiKeyMessage, type KeySecretsLike } from './settingsKeys';

class RecordingSecrets implements KeySecretsLike {
  readonly stored: Array<[string, string]> = [];
  readonly deleted: string[] = [];
  async store(key: string, value: string) { this.stored.push([key, value]); }
  async delete(key: string) { this.deleted.push(key); }
}

const ON = { opencode: true, transcription: true };
const value = `v${'x'.repeat(30)}`;

const UNLISTED = [
  'ritemark.publish.cloudflare.v1',
  'google-docs-oauth-token',
  'ritemark.googleDocs.account.v1',
  'ritemark.browser.token',
  'OPENAI-API-KEY',
  'openai-api-key ',
  '__proto__',
  'constructor',
  '',
  undefined,
  null,
  42,
  ['openai-api-key'],
  { toString: () => 'openai-api-key' },
];

void (async () => {
  let failed = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.log(`FAIL ${name}\n  ${String(error)}`); }
  };

  await check('an unlisted key name is never stored or deleted', async () => {
    const secrets = new RecordingSecrets();
    for (const key of UNLISTED) {
      assert.equal(await applyApiKeyMessage({ key, value }, ON, secrets), null, `${String(key)} was accepted`);
      assert.equal(await applyApiKeyMessage({ key, value: '' }, ON, secrets), null, `${String(key)} removal was accepted`);
    }
    assert.deepEqual(secrets.stored, [], 'nothing stored');
    assert.deepEqual(secrets.deleted, [], 'nothing deleted');
  });

  await check('each of the five is stored trimmed, and removed by an empty value', async () => {
    const secrets = new RecordingSecrets();
    for (const key of SETTINGS_KEY_NAMES) {
      assert.deepEqual(await applyApiKeyMessage({ key, value: `  ${value}  ` }, ON, secrets), { key, action: 'stored' });
      assert.deepEqual(await applyApiKeyMessage({ key, value: '   ' }, ON, secrets), { key, action: 'removed' });
    }
    assert.deepEqual(secrets.stored, SETTINGS_KEY_NAMES.map((key) => [key, value]));
    assert.deepEqual(secrets.deleted, [...SETTINGS_KEY_NAMES]);
  });

  await check('a flagged key waits for its flag; a value that is not text does nothing', async () => {
    const secrets = new RecordingSecrets();
    assert.equal(await applyApiKeyMessage({ key: 'openrouter-api-key', value }, { opencode: false, transcription: true }, secrets), null);
    assert.equal(await applyApiKeyMessage({ key: 'elevenlabs-api-key', value }, { opencode: true, transcription: false }, secrets), null);
    assert.equal(await applyApiKeyMessage({ key: 'openai-api-key', value: { trim: () => value } }, ON, secrets), null);
    assert.equal(await applyApiKeyMessage({ key: 'openai-api-key' }, ON, secrets), null);
    assert.deepEqual(secrets.stored, []);
    assert.deepEqual(secrets.deleted, []);
  });

  await check('the host\'s setApiKey goes through applyApiKeyMessage and writes no secret by the message\'s name', async () => {
    const source = readFileSync(join(__dirname, 'RitemarkSettingsProvider.ts'), 'utf8');
    const start = source.indexOf("case 'setApiKey':");
    const end = source.indexOf("case 'testApiKey':", start);
    assert.ok(start > 0 && end > start, 'the case is there');
    const body = source.slice(start, end);
    assert.match(body, /applyApiKeyMessage\(message, this\.keyFlags\(\), this\.context\.secrets\)/);
    assert.doesNotMatch(body, /secrets\.(store|delete)\(/, 'no direct write in the case');
    assert.doesNotMatch(source, /secrets\.(store|delete)\(\s*message\./, 'no secret anywhere is written by a message\'s own name');
  });

  if (failed) process.exitCode = 1;
})();
