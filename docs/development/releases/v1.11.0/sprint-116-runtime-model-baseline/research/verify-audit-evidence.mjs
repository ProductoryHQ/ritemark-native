// Verify the captured pre-change audit and the approved implementation evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const research = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(research, 'evidence');
const read = async name => JSON.parse(await fs.readFile(path.join(evidence, name), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const baseline = await read('baseline.json');
const errors = [];
const productFiles = {};
for (const [file, expected] of Object.entries(baseline.files)) {
  const actual = digest(await fs.readFile(file));
  productFiles[file] = { expected, actual, unchanged: actual === expected };
}
const productDiff = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'extensions', 'scripts', 'branding'], { encoding: 'utf8' }).trim();
const manifest = await read('candidate-manifest.json');
const artifacts = await read('artifact-results.json');
if (manifest.approved !== false) errors.push('Audit candidate is incorrectly marked approved');
if (manifest.runtimes.length !== 14 || artifacts.length !== 14) errors.push('Incomplete component set');
for (const row of manifest.runtimes) {
  const key = `${row.agent}/${row.component}/${row.platform}-${row.arch}`;
  const found = artifacts.filter(result => result.key === key);
  if (found.length !== 1 || found[0].status !== 'PASS_ARTIFACT' || found[0].sha256 !== row.sha256 || !found[0].publisherIntegrityVerified) errors.push(`Artifact mismatch: ${key}`);
}
const packageManifest = await read('candidate-package-manifest.json');
const installedCount = packageManifest.runtimes.reduce((count, row) => count + (row.members?.length ?? 1), 0);
if (packageManifest.schemaVersion !== '3' || packageManifest.approved !== true || packageManifest.runtimes.length !== 12 || installedCount !== 25) errors.push('Approved package manifest is incomplete');
if (Object.values(packageManifest.assertions ?? {}).some(value => value !== true)) errors.push('Approved package manifest assertions failed');
for (const evidenceName of ['codex-package-layout.json', 'codex-package-usage.json', 'opencode-ripgrep-package.json', 'clean-runtime-stage.json']) {
  if ((await read(evidenceName)).status !== 'PASS') errors.push(`${evidenceName} did not pass`);
}
const finalCancel = await read('codex-session-cancel-final.json');
if (finalCancel.checks?.length !== 2 || finalCancel.checks.some(check => check.status !== 'PASS')) errors.push('Final Codex immediate Stop/resend did not pass');
const baselineTests = await read('baseline-tests.json');
const retries = await read('baseline-webview-retry.json');
const tests = new Map(baselineTests.results.map(row => [row.name, row]));
for (const row of retries.results) tests.set(row.name, row);
if ([...tests.values()].some(row => row.status !== 'PASS')) errors.push('Focused test suite has unresolved failures');
const snapshots = {};
for (const file of (await fs.readdir(evidence)).filter(file => file.endsWith('.json') && file !== 'evidence-integrity.json').sort()) snapshots[file] = digest(await fs.readFile(path.join(evidence, file)));
const report = {
  capturedAt: new Date().toISOString(),
  status: errors.length ? 'FAIL' : 'PASS_AUDIT_AND_IMPLEMENTATION_EVIDENCE',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  productFiles, trackedProductDiff: productDiff ? productDiff.split('\n') : [],
  artifactCount: artifacts.length,
  approvedSourceRows: packageManifest.runtimes.length,
  approvedInstalledFiles: installedCount,
  nativeStartupPasses: artifacts.filter(row => row.startup?.status === 'PASS').length,
  focusedTestFilesPassing: [...tests.keys()].filter(name => name.endsWith('.test.ts')).length,
  baselineCompilePasses: tests.get('TypeScript compile (no emit)')?.status === 'PASS',
  candidateCompilePasses: (await read('candidate-tests.json')).results.every(row => row.status === 'PASS'),
  knownIncompleteChecks: ['Account-specific direct API and BYOK execution', 'Native Intel and Windows execution (CI)', 'Signed application release verification'],
  snapshots, errors,
};
await fs.writeFile(path.join(evidence, 'evidence-integrity.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, productInputsUnchanged: Object.values(productFiles).every(row => row.unchanged), artifactCount: report.artifactCount, nativeStartupPasses: report.nativeStartupPasses, focusedTestFilesPassing: report.focusedTestFilesPassing, baselineCompilePasses: report.baselineCompilePasses, candidateCompilePasses: report.candidateCompilePasses, errors }));
if (errors.length) process.exitCode = 1;
