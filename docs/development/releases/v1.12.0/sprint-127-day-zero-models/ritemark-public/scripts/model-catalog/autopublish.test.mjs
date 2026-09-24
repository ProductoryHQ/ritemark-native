import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { commitMessage, CONFIG_PATH, FEED_PATH, main, publishOnce, STATE_DIR } from './autopublish.mjs';
import { apiModel, FIXTURE, publishedFeed, publisherConfig } from './test-helpers.mjs';

const NOW = Date.parse(FIXTURE.publishedAt);
const HOUR = 60 * 60 * 1000;

function canaryStub(failing = new Set()) {
  const calls = [];
  const runCanary = async (input) => {
    calls.push(input);
    const ok = !failing.has(input.modelId) && !failing.has(`${input.modelId}@${input.cliVersion}`);
    return { cliVersion: input.cliVersion, ok, ...(ok ? {} : { reason: 'the turn did not complete (error_during_execution)' }), durationMs: 4200 };
  };
  return { calls, runCanary };
}

async function publish({ models, failing, config = publisherConfig(), cooldowns = {}, catalog = publishedFeed() }) {
  const canary = canaryStub(failing);
  const listCalls = [];
  const outcome = await publishOnce({
    catalog,
    config,
    cooldowns,
    apiKey: 'test-key',
    listModels: async (input) => { listCalls.push(input); return models; },
    runCanary: canary.runCanary,
    now: NOW,
  });
  return { outcome, canaryCalls: canary.calls, listCalls };
}

test('no new model leaves everything as it was', async () => {
  const catalog = publishedFeed();
  const { outcome, canaryCalls, listCalls } = await publish({ models: [], catalog });
  assert.equal(outcome.catalog, catalog);
  assert.deepEqual(outcome.added, []);
  assert.deepEqual(canaryCalls, []);
  assert.deepEqual(listCalls, [{ apiKey: 'test-key' }]);
});

test('a new model is appended after its canary passes (S16)', async () => {
  const before = publishedFeed();
  const { outcome, canaryCalls } = await publish({ models: [FIXTURE.source], catalog: before });
  assert.deepEqual(outcome.catalog.providers.anthropic.models.at(-1), FIXTURE.row);
  assert.equal(outcome.catalog.providers.anthropic.models.length, before.providers.anthropic.models.length + 1);
  assert.equal(outcome.catalog.updatedAt, FIXTURE.publishedAt);
  assert.equal(outcome.config.watermark, new Date(FIXTURE.source.created_at).toISOString());
  assert.deepEqual(canaryCalls, [{ modelId: FIXTURE.row.id, label: 'Opus 5.5', maxOutputTokens: 64000, cliVersion: '2.1.270', sdkVersion: '0.3.270', apiKey: 'test-key' }]);
  const message = commitMessage(outcome.added);
  assert.match(message, /^feed\(model-catalog\): auto-add claude-opus-5-5\n/);
  assert.match(message, /Claude Code 2\.1\.270 passed in 4\.2 s/);
});

test('a failing canary publishes nothing and cools the candidate down (S17)', async () => {
  const catalog = publishedFeed();
  const config = publisherConfig();
  const { outcome } = await publish({ models: [FIXTURE.source], failing: new Set([FIXTURE.row.id]), catalog, config });
  assert.equal(outcome.catalog, catalog);
  assert.equal(outcome.config, config);
  assert.deepEqual(outcome.cooldowns[FIXTURE.row.id], { failures: 1, retryAfter: NOW + HOUR });
  assert.deepEqual(outcome.failed.map((entry) => entry.model.id), [FIXTURE.row.id]);
});

test('a candidate that is cooling down is not retried and holds the watermark', async () => {
  const cooldowns = { 'claude-opus-6': { failures: 2, retryAfter: NOW + HOUR } };
  const models = [apiModel('claude-opus-6', '2026-10-01T00:00:00Z'), apiModel('claude-sonnet-6', '2026-10-02T00:00:00Z')];
  const { outcome, canaryCalls } = await publish({ models, cooldowns });
  assert.deepEqual(canaryCalls.map((call) => call.modelId), ['claude-sonnet-6']);
  assert.deepEqual(outcome.added.map((entry) => entry.row.id), ['claude-sonnet-6']);
  assert.ok(Date.parse(outcome.config.watermark) < Date.parse('2026-10-01T00:00:00Z'));
  assert.deepEqual(outcome.cooldowns, cooldowns);
});

test('a passed cooldown is retried and cleared on success', async () => {
  const cooldowns = { 'claude-opus-6': { failures: 1, retryAfter: NOW - 1 } };
  const { outcome } = await publish({ models: [apiModel('claude-opus-6', '2026-10-01T00:00:00Z')], cooldowns });
  assert.deepEqual(outcome.added.map((entry) => entry.row.id), ['claude-opus-6']);
  assert.deepEqual(outcome.cooldowns, {});
});

test('every configured Claude Code version must pass', async () => {
  const config = publisherConfig();
  config.canary.claudeCodeVersions = ['2.1.270', '2.1.281'];
  const { outcome, canaryCalls } = await publish({ models: [apiModel('claude-opus-6', '2026-10-01T00:00:00Z')], config, failing: new Set(['claude-opus-6@2.1.281']) });
  assert.deepEqual(canaryCalls.map((call) => call.cliVersion), ['2.1.270', '2.1.281']);
  assert.deepEqual(outcome.added, []);
  assert.equal(outcome.cooldowns['claude-opus-6'].failures, 1);
});

test('one run adds at most maxAdditionsPerRun models and keeps the rest for the next run', async () => {
  const config = publisherConfig();
  config.maxAdditionsPerRun = 1;
  const models = [apiModel('claude-opus-6', '2026-10-01T00:00:00Z'), apiModel('claude-opus-7', '2026-10-01T00:00:00Z')];
  const { outcome } = await publish({ models, config });
  assert.deepEqual(outcome.added.map((entry) => entry.row.id), ['claude-opus-6']);
  assert.ok(Date.parse(outcome.config.watermark) < Date.parse('2026-10-01T00:00:00Z'));
});

test('a later model of the same family in the same run goes first', async () => {
  const models = [apiModel('claude-opus-6', '2026-10-01T00:00:00Z'), apiModel('claude-opus-7', '2026-10-02T00:00:00Z')];
  const { outcome } = await publish({ models });
  const [six, seven] = outcome.added.map((entry) => entry.row);
  assert.ok(seven.order < six.order);
});

test('one failure does not block another model in the same run', async () => {
  const models = [apiModel('claude-opus-6', '2026-10-01T00:00:00Z'), apiModel('claude-sonnet-6', '2026-10-02T00:00:00Z')];
  const { outcome } = await publish({ models, failing: new Set(['claude-opus-6']) });
  assert.deepEqual(outcome.added.map((entry) => entry.row.id), ['claude-sonnet-6']);
  assert.deepEqual(outcome.failed.map((entry) => entry.model.id), ['claude-opus-6']);
  assert.ok(Date.parse(outcome.config.watermark) < Date.parse('2026-10-01T00:00:00Z'));
});

test('a feed dated in the future stops the run before any canary', async () => {
  const catalog = publishedFeed();
  catalog.updatedAt = new Date(NOW + HOUR).toISOString();
  await assert.rejects(publish({ models: [FIXTURE.source], catalog }), /in the future/);
});

test('an invalid feed stops the run before any canary', async () => {
  const catalog = publishedFeed();
  catalog.providers.anthropic.models[0].id = 'not a model';
  await assert.rejects(publish({ models: [FIXTURE.source], catalog }), /invalid catalog/);
});

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-publish-test-'));
  mkdirSync(join(dir, 'feeds'));
  writeFileSync(join(dir, FEED_PATH), `${JSON.stringify(publishedFeed(), null, 2)}\n`);
  writeFileSync(join(dir, CONFIG_PATH), `${JSON.stringify(publisherConfig(), null, 2)}\n`);
  const output = join(dir, 'github-output.txt');
  writeFileSync(output, '');
  return { dir, output, env: { MODEL_CATALOG_AUTOPUBLISH: 'on', MODEL_CATALOG_ANTHROPIC_API_KEY: 'test-key', GITHUB_OUTPUT: output, RUNNER_TEMP: dir } };
}

const outputs = (file) => Object.fromEntries(readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));

test('the kill switch stops the run before /v1/models (S20)', async () => {
  const { dir } = workspace();
  let listed = false;
  const code = await main({ env: {}, cwd: dir, listModels: async () => { listed = true; return []; }, log: () => {} });
  assert.equal(code, 0);
  assert.equal(listed, false);
});

test('a missing key fails the run', async () => {
  const { dir } = workspace();
  assert.equal(await main({ env: { MODEL_CATALOG_AUTOPUBLISH: 'on' }, cwd: dir, log: () => {} }), 1);
});

test('a publishing run writes the feed, the config and the commit message', async () => {
  const { dir, output, env } = workspace();
  const code = await main({ env, cwd: dir, listModels: async () => [FIXTURE.source], runCanary: canaryStub().runCanary, now: NOW, log: () => {} });
  assert.equal(code, 0);
  const feed = JSON.parse(readFileSync(join(dir, FEED_PATH), 'utf8'));
  assert.deepEqual(feed.providers.anthropic.models.at(-1), FIXTURE.row);
  assert.equal(JSON.parse(readFileSync(join(dir, CONFIG_PATH), 'utf8')).watermark, new Date(FIXTURE.source.created_at).toISOString());
  const result = outputs(output);
  assert.equal(result.changed, 'true');
  assert.equal(result.failed, 'false');
  assert.equal(result.state_changed, 'false');
  assert.match(readFileSync(result.commit_message_file, 'utf8'), /auto-add claude-opus-5-5/);
});

test('a failed canary leaves the feed alone and records the cooldown', async () => {
  const { dir, output, env } = workspace();
  const before = readFileSync(join(dir, FEED_PATH), 'utf8');
  await main({ env, cwd: dir, listModels: async () => [FIXTURE.source], runCanary: canaryStub(new Set([FIXTURE.row.id])).runCanary, now: NOW, log: () => {} });
  assert.equal(readFileSync(join(dir, FEED_PATH), 'utf8'), before);
  const result = outputs(output);
  assert.equal(result.changed, 'false');
  assert.equal(result.failed, 'true');
  assert.equal(result.failed_models, FIXTURE.row.id);
  assert.equal(result.state_changed, 'true');
  assert.equal(JSON.parse(readFileSync(join(dir, STATE_DIR, 'cooldowns.json'), 'utf8'))[FIXTURE.row.id].failures, 1);
});

test('a dry run canaries but writes nothing', async () => {
  const { dir, output } = workspace();
  const before = readFileSync(join(dir, FEED_PATH), 'utf8');
  const env = { MODEL_CATALOG_DRY_RUN: 'true', MODEL_CATALOG_ANTHROPIC_API_KEY: 'test-key', GITHUB_OUTPUT: output, RUNNER_TEMP: dir };
  const canary = canaryStub(new Set([FIXTURE.row.id]));
  await main({ env, cwd: dir, listModels: async () => [FIXTURE.source], runCanary: canary.runCanary, now: NOW, log: () => {} });
  assert.equal(canary.calls.length, 1);
  assert.equal(readFileSync(join(dir, FEED_PATH), 'utf8'), before);
  assert.equal(existsSync(join(dir, STATE_DIR)), false);
  assert.equal(outputs(output).changed, 'false');
});
