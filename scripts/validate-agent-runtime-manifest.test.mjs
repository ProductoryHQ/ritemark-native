import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateAgentRuntimeManifest } from './validate-agent-runtime-manifest.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const fixture = () => ({
  manifest: readJson('extensions/ritemark/binaries/agents/manifest.json'),
  packageJson: readJson('extensions/ritemark/package.json'),
  packageLock: readJson('extensions/ritemark/package-lock.json'),
});
const validateMutation = mutate => {
  const data = fixture();
  mutate(data);
  return validateAgentRuntimeManifest(data.manifest, data.packageJson, data.packageLock);
};

test('checked-in runtime package manifest and SDK pins are consistent', () => {
  const { manifest, packageJson, packageLock } = fixture();
  assert.deepEqual(validateAgentRuntimeManifest(manifest, packageJson, packageLock), []);
});

test('rejects Claude runtime and SDK patch drift', () => {
  const errors = validateMutation(({ packageJson }) => {
    packageJson.dependencies['@anthropic-ai/claude-agent-sdk'] = '0.3.269';
  });
  assert.ok(errors.some(error => error.includes('approved snapshot 0.3.281')));
  assert.ok(errors.some(error => error.includes('patch mismatch')));
});

test('rejects an unapproved runtime snapshot across all targets', () => {
  const errors = validateMutation(({ manifest }) => {
    for (const row of manifest.runtimes.filter(entry => entry.agent === 'opencode' && entry.component === 'runtime')) row.version = '1.18.29';
  });
  assert.ok(errors.some(error => error.includes('approved snapshot 1.18.30')));
});

test('requires every Claude SDK optional platform package at the exact SDK pin', () => {
  const errors = validateMutation(({ packageLock }) => {
    delete packageLock.packages['node_modules/@anthropic-ai/claude-agent-sdk'].optionalDependencies['@anthropic-ai/claude-agent-sdk-win32-x64'];
    delete packageLock.packages['node_modules/@anthropic-ai/claude-agent-sdk-win32-x64'];
  });
  assert.ok(errors.some(error => error.includes('@anthropic-ai/claude-agent-sdk-win32-x64 must be present')));
});

test('requires the exact Codex package member set for every target', () => {
  const errors = validateMutation(({ manifest }) => {
    manifest.runtimes.find(row => row.agent === 'codex' && row.platform === 'win32').members.pop();
  });
  assert.ok(errors.some(error => error.includes('member count must be 6')));
  assert.ok(errors.some(error => error.includes('is missing windows-sandbox-setup')));
});

test('requires supported Codex smoke arguments', () => {
  const errors = validateMutation(({ manifest }) => {
    const row = manifest.runtimes.find(entry => entry.agent === 'codex' && entry.platform === 'darwin');
    row.members.find(member => member.component === 'code-mode-host').validationArgs = ['--version'];
  });
  assert.ok(errors.some(error => error.includes('code-mode-host') && error.includes('must validate with --help')));
});

test('rejects an unsafe or duplicate installed dependency path', () => {
  const errors = validateMutation(({ manifest }) => {
    const rows = manifest.runtimes.filter(row => row.agent === 'opencode' && row.platform === 'darwin' && row.arch === 'arm64');
    rows.find(row => row.component === 'ripgrep').installPath = '../opencode';
  });
  assert.ok(errors.some(error => error.includes('archive/install path is unsafe')));
});

test('requires the Windows Codex helper executables and forbids them on macOS', () => {
  const errors = validateMutation(({ manifest }) => {
    const windows = manifest.runtimes.find(row => row.agent === 'codex' && row.platform === 'win32');
    const helper = windows.members.find(member => member.component === 'command-runner');
    windows.members = windows.members.filter(member => member.component !== 'command-runner');
    manifest.runtimes.find(row => row.agent === 'codex' && row.platform === 'darwin').members.push(helper);
  });
  assert.ok(errors.some(error => error.includes('is missing command-runner')));
  assert.ok(errors.some(error => error.includes('is not expected')));
});

test('rejects validation arguments on IPC-only Codex helpers', () => {
  const errors = validateMutation(({ manifest }) => {
    const row = manifest.runtimes.find(entry => entry.agent === 'codex' && entry.platform === 'win32');
    row.members.find(member => member.component === 'windows-sandbox-setup').validationArgs = ['--version'];
  });
  assert.ok(errors.some(error => error.includes('windows-sandbox-setup') && error.includes('must not declare validationArgs')));
});

test('rejects stale OpenCode ripgrep and vendor identity', () => {
  const errors = validateMutation(({ manifest }) => {
    const row = manifest.runtimes.find(entry => entry.agent === 'opencode' && entry.component === 'ripgrep');
    row.version = '15.0.0';
    row.vendor = 'other';
  });
  assert.ok(errors.some(error => error.includes('vendor must be BurntSushi')));
  assert.ok(errors.some(error => error.includes('approved snapshot 15.1.0')));
});

test('requires approved license evidence and target architecture', () => {
  const errors = validateMutation(({ manifest }) => {
    const row = manifest.runtimes.find(entry => entry.agent === 'claude' && entry.platform === 'darwin' && entry.arch === 'arm64');
    row.license.noticeUrl = 'https://example.invalid/license';
    row.expectedFileArchPattern = 'Mach-O 64-bit executable x86_64';
  });
  assert.ok(errors.some(error => error.includes('license notice URL')));
  assert.ok(errors.some(error => error.includes('must declare the arm64 architecture')));
});
