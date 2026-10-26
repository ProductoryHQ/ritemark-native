/**
 * Sprint 127 runtime declarations (R1, R7). Pure — no vscode/network.
 * Run: npx tsx src/ai/modelCatalog/runtimeDeclarations.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { ModelEntry } from './schema';
import {
  buildClaudeRuntimeDeclarations,
  discoveryPickerSettings,
  dropShadowedDeclarations,
  feedPollAction,
  NO_CLAUDE_DECLARATIONS,
  sessionDeclarationFor,
  withBundledDeclarations,
} from './runtimeDeclarations';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { resolveStaticModels } from './resolver';
import { validateCatalog } from './schema';
import { CLAUDE_MODEL_IDS } from '../modelConfig';

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

const AUTO_ROW: ModelEntry = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'auto-row.fixture.json'), 'utf-8')).row;
const CURATED: ModelEntry = { id: 'claude-sonnet-5', label: 'Sonnet 5', description: 'Fast & capable', tier: 'medium', deprecated: false, order: 0 };

test('only rows that ask to be injected are declared', () => {
  const d = buildClaudeRuntimeDeclarations([CURATED, AUTO_ROW]);
  assert.deepStrictEqual(d.pickerOptions, [{ model: 'claude-opus-6', label: 'Opus 6', description: 'Newest Opus model' }]);
  assert.deepStrictEqual(d.envByModel, { 'claude-opus-6': { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000' } });
});

test('nothing to declare yields the shared empty value', () => {
  assert.strictEqual(buildClaudeRuntimeDeclarations([CURATED]), NO_CLAUDE_DECLARATIONS);
  assert.strictEqual(discoveryPickerSettings(NO_CLAUDE_DECLARATIONS), undefined);
});

test('S31: an automated row never carries behavesAs; a curated one may', () => {
  const autoWithProfile: ModelEntry = { ...AUTO_ROW, claudeCode: { inject: true, behavesAs: 'claude-opus-5' } };
  assert.strictEqual(buildClaudeRuntimeDeclarations([autoWithProfile]).pickerOptions[0].behavesAs, undefined);
  const curatedWithProfile: ModelEntry = { ...AUTO_ROW, provenance: 'curated', claudeCode: { inject: true, behavesAs: 'claude-opus-5' } };
  assert.strictEqual(buildClaudeRuntimeDeclarations([curatedWithProfile]).pickerOptions[0].behavesAs, 'claude-opus-5');
});

test('S30/S14: retired rows and malformed ids are never declared', () => {
  const retired: ModelEntry = { ...AUTO_ROW, retired: true };
  const hostile: ModelEntry = { ...AUTO_ROW, id: 'not a model; rm -rf /' };
  assert.strictEqual(buildClaudeRuntimeDeclarations([retired, hostile]), NO_CLAUDE_DECLARATIONS);
});

test('declared options follow catalog order and the signature tracks changes', () => {
  const later: ModelEntry = { ...AUTO_ROW, id: 'claude-sonnet-6', label: 'Sonnet 6', order: -0.5 };
  const d = buildClaudeRuntimeDeclarations([AUTO_ROW, later]);
  assert.deepStrictEqual(d.pickerOptions.map((o) => o.model), ['claude-sonnet-6', 'claude-opus-6']);
  assert.notStrictEqual(d.signature, buildClaudeRuntimeDeclarations([AUTO_ROW]).signature);
  assert.strictEqual(d.signature, buildClaudeRuntimeDeclarations([later, AUTO_ROW]).signature);
});

test('discovery lists every declared model through modelPicker', () => {
  const settings = discoveryPickerSettings(buildClaudeRuntimeDeclarations([AUTO_ROW]));
  assert.deepStrictEqual(settings, { modelPicker: { options: [{ model: 'claude-opus-6', label: 'Opus 6', description: 'Newest Opus model' }] } });
});

test('a session declares only the model it runs, and only when it is declared', () => {
  const d = buildClaudeRuntimeDeclarations([AUTO_ROW]);
  assert.deepStrictEqual(sessionDeclarationFor(d, 'claude-opus-6'), {
    settings: { modelPicker: { options: [{ model: 'claude-opus-6', label: 'Opus 6', description: 'Newest Opus model' }] } },
    env: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000' },
  });
  assert.strictEqual(sessionDeclarationFor(d, 'claude-sonnet-5'), undefined, 'a native model leaves user settings alone');
  assert.strictEqual(sessionDeclarationFor(d, undefined), undefined);
});

test('S3: a natively listed identity shadows the declared row, modulo [1m]', () => {
  const rows = [
    { id: 'opus[1m]', resolvedModel: 'claude-opus-6[1m]' },
    { id: 'claude-opus-6', resolvedModel: 'claude-opus-6' },
    { id: 'sonnet', resolvedModel: 'claude-sonnet-5' },
  ];
  assert.deepStrictEqual(dropShadowedDeclarations(rows, ['claude-opus-6']).map((r) => r.id), ['opus[1m]', 'sonnet']);
});

test('S1: a declared row the runtime does not know natively stays', () => {
  const rows = [
    { id: 'opus[1m]', resolvedModel: 'claude-opus-5[1m]' },
    { id: 'claude-opus-6', resolvedModel: 'claude-opus-6' },
  ];
  assert.deepStrictEqual(dropShadowedDeclarations(rows, ['claude-opus-6']).map((r) => r.id), ['opus[1m]', 'claude-opus-6']);
  assert.deepStrictEqual(dropShadowedDeclarations(rows, []).map((r) => r.id), ['opus[1m]', 'claude-opus-6']);
});

test('S25/R5: the CLI is re-probed only when the declared set changes', () => {
  assert.strictEqual(feedPollAction({ declarationsChanged: false, feedChanged: false, probeAllowed: true }), 'none', '304');
  assert.strictEqual(feedPollAction({ declarationsChanged: false, feedChanged: true, probeAllowed: true }), 'resolve', 'relabel only');
  assert.strictEqual(feedPollAction({ declarationsChanged: true, feedChanged: true, probeAllowed: true }), 'probe', 'new model');
  assert.strictEqual(feedPollAction({ declarationsChanged: true, feedChanged: true, probeAllowed: false }), 'resolve', 'refresh() probes next anyway');
});

// ── Sprint 141 R7: 2.1 declares only what it doesn't know ──────────────────

const FEED_C4808BE = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'feed-c4808be.json'), 'utf-8'));
const BUNDLED_ANTHROPIC = BUNDLED_CATALOG.providers.anthropic!.models;

function declaredFor(feed: unknown, appVersion: string): string[] {
  const rows = resolveStaticModels('anthropic', validateCatalog(feed), null, BUNDLED_CATALOG, appVersion);
  return buildClaudeRuntimeDeclarations(withBundledDeclarations(rows, BUNDLED_ANTHROPIC)).pickerOptions.map((option) => option.model);
}

test('S141 S24: a feed declaring Sonnet 5.5 declares nothing to 2.1\'s Claude Code', () => {
  const refreshed = buildPublishedFeed(BUNDLED_CATALOG, FEED_C4808BE, '2099-01-01T00:00:00Z');
  const rows = resolveStaticModels('anthropic', validateCatalog(refreshed), null, BUNDLED_CATALOG, '2.1.0');
  assert.ok(rows.find((row) => row.id === CLAUDE_MODEL_IDS.SONNET_5_5)?.claudeCode?.inject, 'the refreshed feed does carry the declaration');
  assert.deepStrictEqual(declaredFor(refreshed, '2.1.0'), []);
  const declarations = buildClaudeRuntimeDeclarations(withBundledDeclarations(rows, BUNDLED_ANTHROPIC));
  assert.strictEqual(sessionDeclarationFor(declarations, CLAUDE_MODEL_IDS.SONNET_5_5), undefined, 'no modelPicker and no output cap for its sessions');
});

test('S141 S25: a Claude model the feed adds and 2.1 doesn\'t bundle is still declared (negative)', () => {
  const feed = JSON.parse(JSON.stringify(buildPublishedFeed(BUNDLED_CATALOG, undefined, '2099-01-01T00:00:00Z')));
  feed.providers.anthropic.models.push({ id: 'claude-opus-6', label: 'Opus 6', description: 'Newest Opus model', tier: 'high', deprecated: false, order: 0.5, provenance: 'curated', addedAt: '2099-01-01T00:00:00Z', claudeCode: { inject: true, maxOutputTokens: 64000 } });
  assert.deepStrictEqual(declaredFor(feed, '2.1.0'), ['claude-opus-6']);
});

test('S141 R7: withBundledDeclarations keeps a bundled row\'s own declaration', () => {
  const bundled: ModelEntry[] = [{ ...CURATED, claudeCode: { inject: true, maxOutputTokens: 32000 } }];
  const fromFeed: ModelEntry[] = [{ ...CURATED, claudeCode: { inject: true, maxOutputTokens: 64000 } }];
  assert.deepStrictEqual(withBundledDeclarations(fromFeed, bundled)[0].claudeCode, { inject: true, maxOutputTokens: 32000 });
});

if (failures > 0) {
  console.error(`\nruntimeDeclarations: ${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nruntimeDeclarations: all tests passed');
}
