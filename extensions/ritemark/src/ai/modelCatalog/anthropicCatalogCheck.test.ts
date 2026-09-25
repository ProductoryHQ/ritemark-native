/**
 * Sprint 127 R10: the pre-release check of Anthropic's Claude Code model catalog.
 * No network — the catalog is a trimmed copy captured on 2026-09-24.
 * Run: npx tsx src/ai/modelCatalog/anthropicCatalogCheck.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  bundledClaudeCodeVersions,
  checkAnthropicCatalog,
  parseAnthropicCatalog,
  type AnthropicCatalog,
} from './anthropicCatalogCheck';
import { BUNDLED_CATALOG } from './bundledCatalog';

let failures = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'anthropic-catalog.sample.json'), 'utf-8'));
const NOW = Date.parse('2026-09-25T00:00:00Z');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'binaries', 'agents', 'manifest.json'), 'utf-8'));
const BUNDLED_IDS = BUNDLED_CATALOG.providers.anthropic!.models.map((model) => model.id);

function sample(): Record<string, any> {
  return JSON.parse(JSON.stringify(SAMPLE));
}

function parsed(): AnthropicCatalog {
  return parseAnthropicCatalog(sample(), NOW);
}

console.log('anthropicCatalogCheck.test.ts');

test('the captured catalog parses: version, expiry and the Claude Code models', () => {
  const catalog = parsed();
  assert.strictEqual(catalog.version, 1088);
  assert.strictEqual(catalog.expiresAt, '2026-10-01T11:21:38Z');
  assert.strictEqual(catalog.models.length, 11);
  const opus = catalog.models.find((model) => model.name === 'Opus 5.5')!;
  assert.strictEqual(opus.section, 'main');
  assert.strictEqual(opus.minClaudeCodeVersion, '2.1.280');
  assert.strictEqual(catalog.models.find((model) => model.name === 'Sonnet 5')!.minClaudeCodeVersion, undefined);
});

test('S38: this repository passes — Claude Code 2.1.281 and the bundled lineup cover the catalog', () => {
  assert.deepStrictEqual(bundledClaudeCodeVersions(MANIFEST), ['2.1.281']);
  const result = checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: bundledClaudeCodeVersions(MANIFEST), bundledModelIds: BUNDLED_IDS });
  assert.deepStrictEqual(result.alerts, []);
  assert.deepStrictEqual(result.warnings, []);
  assert.deepStrictEqual(result.mainModels.map((model) => model.name), ['Opus 5.5', 'Sonnet 5', 'Fable 5.1', 'Haiku 4.5']);
});

test('S39: a Claude Code older than a model minimum raises an alert naming both versions', () => {
  const result = checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: ['2.1.270'], bundledModelIds: BUNDLED_IDS });
  assert.strictEqual(result.alerts.length, 1);
  assert.match(result.alerts[0], /Opus 5\.5 \(claude-opus-5-5\) needs Claude Code 2\.1\.280 or newer, but this build bundles 2\.1\.270/);
});

test('S39: the oldest bundled target decides', () => {
  const result = checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: ['2.1.281', '2.1.250'], bundledModelIds: BUNDLED_IDS });
  assert.strictEqual(result.alerts.length, 2, 'Opus 5.5 (2.1.280) and Fable 5.1 (2.1.251)');
  assert.ok(result.alerts.every((alert) => alert.includes('bundles 2.1.250')));
});

test('S39: version comparison is numeric, not textual', () => {
  const catalog = parsed();
  catalog.models[0].minClaudeCodeVersion = '2.1.99';
  const result = checkAnthropicCatalog({ catalog, claudeCodeVersions: ['2.1.281'], bundledModelIds: BUNDLED_IDS });
  assert.deepStrictEqual(result.alerts, []);
});

test('a missing or malformed manifest version raises an alert', () => {
  assert.strictEqual(checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: [], bundledModelIds: BUNDLED_IDS }).alerts.length, 1);
  assert.match(checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: ['latest'], bundledModelIds: BUNDLED_IDS }).alerts[0], /x\.y\.z Claude Code versions/);
});

test('S38: a main model missing from the bundled lineup is a warning, not an alert', () => {
  const withoutOpus = BUNDLED_IDS.filter((id) => !id.startsWith('claude-opus-5-5'));
  const result = checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: ['2.1.281'], bundledModelIds: withoutOpus });
  assert.deepStrictEqual(result.alerts, []);
  assert.strictEqual(result.warnings.length, 1);
  assert.match(result.warnings[0], /Opus 5\.5 \(claude-opus-5-5\) is in Anthropic's main list but not in Ritemark's bundled lineup/);
});

test('S38: dated snapshots and overflow models do not warn', () => {
  const undatedHaiku = BUNDLED_IDS.map((id) => id.replace(/-\d{8}$/, ''));
  const result = checkAnthropicCatalog({ catalog: parsed(), claudeCodeVersions: ['2.1.281'], bundledModelIds: undatedHaiku });
  assert.deepStrictEqual(result.warnings, [], 'claude-haiku-4-5 matches claude-haiku-4-5-20251001; overflow Opus 4.1 is not required');
});

test('S40: an expired catalog raises an alert', () => {
  assert.throws(() => parseAnthropicCatalog(sample(), Date.parse('2026-10-02T00:00:00Z')), /expired at 2026-10-01T11:21:38Z/);
});

test('S40: a changed format raises an alert naming the problem', () => {
  const cases: Array<[string, (doc: Record<string, any>) => unknown, RegExp]> = [
    ['not an object', () => [], /not a JSON object/],
    ['schema version', (doc) => { doc.schema_version = 2; return doc; }, /schema_version is 2/],
    ['version', (doc) => { doc.version = '1088'; return doc; }, /version is not an integer/],
    ['issued_at', (doc) => { doc.issued_at = 'today'; return doc; }, /issued_at is not a timestamp/],
    ['Claude Code surface', (doc) => { delete doc.surfaces.cc; return doc; }, /surfaces\.cc/],
    ['model list', (doc) => { doc.surfaces.cc.model_selector_config[0].models = []; return doc; }, /missing or empty/],
    ['config id', (doc) => { doc.surfaces.cc.model_selector_config[0].id = 'code'; return doc; }, /missing or empty/],
    ['model id', (doc) => { doc.surfaces.cc.model_selector_config[0].models[0].id = 'Opus 5.5'; return doc; }, /models\[0\]\.id is not a Claude model id/],
    ['model name', (doc) => { delete doc.surfaces.cc.model_selector_config[0].models[1].name; return doc; }, /models\[1\]\.name is missing/],
    ['section', (doc) => { delete doc.surfaces.cc.model_selector_config[0].models[2].section; return doc; }, /models\[2\]\.section is missing/],
    ['minimum version', (doc) => { doc.surfaces.cc.model_selector_config[0].models[0].min_claude_code_version = '2.1'; return doc; }, /min_claude_code_version is not an x\.y\.z version/],
  ];
  for (const [name, mutate, expected] of cases) {
    assert.throws(() => parseAnthropicCatalog(mutate(sample()), NOW), expected, name);
  }
});

test('other surfaces and unknown fields are ignored', () => {
  const doc = sample();
  doc.surfaces.chat.model_selector_config[0].models[0].id = 'not checked';
  doc.surfaces.cc.model_selector_config[0].models[0].new_field = { anything: true };
  assert.strictEqual(parseAnthropicCatalog(doc, NOW).models.length, 11);
});

if (failures > 0) {
  console.error(`anthropicCatalogCheck.test.ts: ${failures} failure(s)`);
  process.exit(1);
}
console.log('anthropicCatalogCheck.test.ts passed');
