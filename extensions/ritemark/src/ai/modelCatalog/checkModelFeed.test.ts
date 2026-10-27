/**
 * Sprint 141 R9: `scripts/check-model-feed.ts` passes a good candidate and fails a
 * bad one. Runs the script against the working tree only (`--refs ''`), so it needs
 * no release tags. Run: npx tsx src/ai/modelCatalog/checkModelFeed.test.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { CODEX_MODEL_IDS } from '../modelConfig';

const extensionRoot = path.resolve(__dirname, '../../..');
const script = path.join(extensionRoot, 'scripts', 'check-model-feed.ts');
const tsx = path.join(extensionRoot, 'node_modules', '.bin', 'tsx');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm141-check-'));

function run(candidate: unknown, extra: string[] = []): { status: number | null; out: string } {
  const file = path.join(dir, `candidate-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(candidate));
  const result = spawnSync(tsx, [script, '--candidate', file, '--refs', '', ...extra], { encoding: 'utf8', cwd: extensionRoot });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

const good = JSON.parse(JSON.stringify(buildPublishedFeed(BUNDLED_CATALOG, undefined, '2099-01-01T00:00:00Z')));
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

test('S32: a good candidate passes, with a report for the working tree', () => {
  const { status, out } = run(good, ['--current', path.join(__dirname, 'testdata', 'feed-c4808be.json')]);
  assert.equal(status, 0, out);
  assert.match(out, /## working tree \(app [\d.]+, getDefault: listed-or-first\)/);
  assert.match(out, /OK: every release accepts the candidate/);
});

test('S33: a candidate the validator rejects fails (negative)', () => {
  const bad = JSON.parse(JSON.stringify(good));
  bad.providers.codex.models[0].tier = 'extreme';
  const { status, out } = run(bad);
  assert.equal(status, 1, out);
  assert.match(out, /working tree, \*:\*\* its validator rejects the candidate/);
});

test('S34: a default that falls back to the first row fails, unless accepted (negative)', () => {
  const gated = JSON.parse(JSON.stringify(good));
  gated.providers.codex.models.find((row: { id: string }) => row.id === CODEX_MODEL_IDS.SOL_6_1).minAppVersion = '99.0.0';
  const current = path.join(dir, 'current.json');
  fs.writeFileSync(current, JSON.stringify(good));
  const failed = run(gated, ['--current', current]);
  assert.equal(failed.status, 1, failed.out);
  assert.match(failed.out, /working tree, codex:\*\* the codex default now resolves as first-row/);
  const accepted = run(gated, ['--current', current, '--accept', 'working tree:codex']);
  assert.equal(accepted.status, 0, accepted.out);
});

fs.rmSync(dir, { recursive: true, force: true });
if (failures > 0) {
  console.error(`\ncheckModelFeed: ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\ncheckModelFeed: all tests passed');
