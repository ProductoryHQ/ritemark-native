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
} from './runtimeDeclarations';

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

if (failures > 0) {
  console.error(`\nruntimeDeclarations: ${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nruntimeDeclarations: all tests passed');
}
