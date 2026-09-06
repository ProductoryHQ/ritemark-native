import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateAgentRuntimeManifest } from './validate-agent-runtime-manifest.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const fixture = () => ({
  manifest: readJson('extensions/ritemark/binaries/agents/manifest.json'),
  packageJson: readJson('extensions/ritemark/package.json'),
  packageLock: readJson('extensions/ritemark/package-lock.json'),
});

test('checked-in manifest and dependency pins are internally consistent', () => {
  const { manifest, packageJson, packageLock } = fixture();
  assert.deepEqual(validateAgentRuntimeManifest(manifest, packageJson, packageLock), []);
});

test('rejects Claude binary and SDK drift', () => {
  const { manifest, packageJson, packageLock } = fixture();
  packageJson.dependencies['@anthropic-ai/claude-agent-sdk'] = '0.3.240';
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('Claude binary/SDK patch mismatch')));
  assert.ok(errors.some((error) => error.includes('package-lock root Claude SDK pin')));
});

test('rejects an unapproved runtime snapshot even when all platform rows agree', () => {
  const { manifest, packageJson, packageLock } = fixture();
  for (const runtime of manifest.runtimes.filter((entry) => entry.agent === 'codex')) {
    runtime.version = '0.154.0';
    runtime.sourceUrl = runtime.sourceUrl.replace('0.153.0', '0.154.0');
  }
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('version must be approved snapshot 0.153.0')));
});

test('rejects a missing Claude platform package from the lockfile', () => {
  const { manifest, packageJson, packageLock } = fixture();
  delete packageLock.packages['node_modules/@anthropic-ai/claude-agent-sdk'].optionalDependencies['@anthropic-ai/claude-agent-sdk-win32-x64'];
  delete packageLock.packages['node_modules/@anthropic-ai/claude-agent-sdk-win32-x64'];
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('@anthropic-ai/claude-agent-sdk-win32-x64 must be present')));
});

test('rejects a missing Codex code-mode host component', () => {
  const { manifest, packageJson, packageLock } = fixture();
  manifest.runtimes = manifest.runtimes.filter((runtime) => !(
    runtime.agent === 'codex'
    && runtime.component === 'code-mode-host'
    && runtime.platform === 'win32'
  ));
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('manifest must contain 12 runtime component rows')));
  assert.ok(errors.some((error) => error.includes('codex/code-mode-host targets must be')));
});

test('uses a supported smoke argument for each Codex component', () => {
  const { manifest, packageJson, packageLock } = fixture();
  const codeModeHost = manifest.runtimes.find((runtime) => runtime.component === 'code-mode-host');
  codeModeHost.validationArgs = ['--version'];
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('code-mode-host') && error.includes('must validate with --help')));
});

test('rejects component install-name collisions on one target', () => {
  const { manifest, packageJson, packageLock } = fixture();
  const codeModeHost = manifest.runtimes.find((runtime) => (
    runtime.agent === 'codex'
    && runtime.component === 'code-mode-host'
    && runtime.platform === 'darwin'
    && runtime.arch === 'arm64'
  ));
  codeModeHost.installName = 'codex-app-server';
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('darwin-arm64/codex-app-server installName is duplicated')));
});

test('rejects a unique but undiscoverable Codex sidecar install name', () => {
  const { manifest, packageJson, packageLock } = fixture();
  const codeModeHost = manifest.runtimes.find((runtime) => (
    runtime.agent === 'codex'
    && runtime.component === 'code-mode-host'
    && runtime.platform === 'darwin'
    && runtime.arch === 'arm64'
  ));
  codeModeHost.installName = 'codex-code-mode-host-0.153.0';
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('installName must be codex-code-mode-host')));
});

test('rejects stale OpenCode vendor identity', () => {
  const { manifest, packageJson, packageLock } = fixture();
  manifest.runtimes.find((runtime) => runtime.agent === 'opencode').vendor = 'sst';
  const errors = validateAgentRuntimeManifest(manifest, packageJson, packageLock);
  assert.ok(errors.some((error) => error.includes('vendor must be anomalyco')));
});
