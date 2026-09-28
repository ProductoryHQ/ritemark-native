import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SHIPPED_FILES,
  changedExternals,
  classifyExtensionPath,
  describeExternal,
} from './list-unshipped-extension-changes.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(scriptsDir, 'list-unshipped-extension-changes.mjs');

const lock = packages => ({ lockfileVersion: 3, packages: { '': { name: 'ritemark' }, ...packages } });
const pkg = (version, extra = {}) => ({ version, integrity: `sha512-${version}`, ...extra });

test('the shipped list is the one release-extension.sh packages', () => {
  const release = fs.readFileSync(path.join(scriptsDir, 'release-extension.sh'), 'utf8');
  const block = release.match(/\nFILES="\$FILES\n([^"]*)"/);
  assert.ok(block, 'release-extension.sh must list its shipped files in a FILES="$FILES ..." block');
  assert.deepEqual(block[1].split('\n').sort(), [...SHIPPED_FILES].sort());
});

test('only changes an extension release rebuilds or ships count as delivered', () => {
  const expected = {
    'src/extension.ts': 'compiled',
    'src/ai/modelCatalog/testdata/auto-row.fixture.json': 'compiled',
    'webview/src/App.tsx': 'compiled',
    'webview/index.html': 'compiled',
    'webview/package-lock.json': 'compiled',
    'esbuild.config.mjs': 'compiled',
    'tsconfig.json': 'compiled',
    'package.json': 'shipped',
    'media/webview.js': 'shipped',
    'media/office-preview.js': 'shipped',
    'media/office-preview.NOTICES.txt': 'shipped',
    'scripts/run-flow-test.ts': 'dev-only',
    '.gitignore': 'dev-only',
    'binaries/agents/manifest.json': 'shell-tier',
    'package-lock.json': 'lockfile',
    'producticons/ritemark-product-icon-theme.json': 'unshipped',
    'producticons/Phosphor-Regular.woff2': 'unshipped',
    'fileicons/ritemark-icon-theme.json': 'unshipped',
    'themes/ritemark-dark.json': 'unshipped',
    'media/home-icon.svg': 'unshipped',
    'media/fonts/SofiaSans-latin.woff2': 'unshipped',
    'media/pdf.worker.min.mjs': 'unshipped',
    'media/drawio/images/drawlogo.svg': 'unshipped',
    'starter-pack/skills/skill-creator/SKILL.md': 'unshipped',
    'binaries/darwin-arm64/whisper-cli': 'unshipped',
    'npm-stubs/anthropic-ai-sdk/index.js': 'unshipped',
    '.npmrc': 'unshipped',
    'templates/a-folder-nobody-classified-yet.md': 'unshipped',
    'package.json.orig': 'unshipped',
    'src.ts': 'unshipped',
  };
  for (const [relPath, kind] of Object.entries(expected)) {
    assert.equal(classifyExtensionPath(relPath), kind, relPath);
  }
});

test('a bumped external is listed with what it pulls in; bundled dependencies are not', () => {
  const sdk = '@anthropic-ai/claude-agent-sdk';
  const base = lock({
    [`node_modules/${sdk}`]: pkg('0.3.270', { optionalDependencies: { [`${sdk}-darwin-arm64`]: '0.3.270' } }),
    [`node_modules/${sdk}-darwin-arm64`]: pkg('0.3.270'),
    'node_modules/marked': pkg('4.3.0'),
  });
  const head = lock({
    [`node_modules/${sdk}`]: pkg('0.3.281', { optionalDependencies: { [`${sdk}-darwin-arm64`]: '0.3.281' } }),
    [`node_modules/${sdk}-darwin-arm64`]: pkg('0.3.281'),
    'node_modules/marked': pkg('4.4.0'),
  });
  const changes = changedExternals(base, head, ['vscode', sdk, 'pdfkit']);
  assert.deepEqual(changes, [{
    name: sdk,
    from: '0.3.270',
    to: '0.3.281',
    rootChanged: true,
    changedDeps: [{ name: `${sdk}-darwin-arm64`, from: '0.3.270', to: '0.3.281' }],
  }]);
  assert.equal(
    describeExternal(changes[0]),
    `${sdk} 0.3.270 -> 0.3.281 (loads from the app's node_modules; 1 package it pulls in changed too)`,
  );
});

test('dependencies resolve the way Node loads them: a nested copy wins over the hoisted one', () => {
  const base = lock({
    'node_modules/pdfkit': pkg('0.17.2', { dependencies: { fontkit: '^2.0.4' } }),
    'node_modules/pdfkit/node_modules/fontkit': pkg('2.0.4'),
    'node_modules/fontkit': pkg('1.9.0'),
    'node_modules/zod': pkg('4.1.0'),
    'node_modules/@agentclientprotocol/sdk': pkg('1.4.0', { peerDependencies: { zod: '^4.0.0' } }),
  });
  const head = lock({
    'node_modules/pdfkit': pkg('0.17.2', { dependencies: { fontkit: '^2.0.4' } }),
    'node_modules/pdfkit/node_modules/fontkit': pkg('2.0.5'),
    'node_modules/fontkit': pkg('1.9.1'),
    'node_modules/zod': pkg('4.2.0'),
    'node_modules/@agentclientprotocol/sdk': pkg('1.4.0', { peerDependencies: { zod: '^4.0.0' } }),
  });
  const lines = changedExternals(base, head, ['pdfkit', '@agentclientprotocol/sdk']).map(describeExternal);
  assert.deepEqual(lines, [
    "pdfkit 0.17.2 (loads from the app's node_modules), pulls in changed fontkit 2.0.4 -> 2.0.5",
    "@agentclientprotocol/sdk 1.4.0 (loads from the app's node_modules), pulls in changed zod 4.1.0 -> 4.2.0",
  ]);
});

test('a new external is listed; an unchanged one is not', () => {
  const base = lock({ 'node_modules/pdfkit': pkg('0.17.2') });
  const head = lock({ 'node_modules/pdfkit': pkg('0.17.2'), 'node_modules/sharp': pkg('0.34.0') });
  assert.deepEqual(changedExternals(base, head, ['pdfkit', 'sharp']).map(describeExternal), [
    "sharp absent -> 0.34.0 (loads from the app's node_modules)",
  ]);
});

test('same version with a different package still counts as a change', () => {
  const base = lock({ 'node_modules/pdfkit': pkg('0.17.2') });
  const head = lock({ 'node_modules/pdfkit': pkg('0.17.2', { integrity: 'sha512-rebuilt' }) });
  assert.deepEqual(changedExternals(base, head, ['pdfkit']).map(describeExternal), [
    "pdfkit 0.17.2 repackaged (loads from the app's node_modules)",
  ]);
});

test('the CLI lists what changed since a ref and an extension release would not carry', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'unshipped-extension-changes-'));
  try {
    const git = (...args) => execFileSync('git', [
      '-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args,
    ], { cwd: repo, stdio: 'ignore' });
    const write = (relPath, content) => {
      const file = path.join(repo, 'extensions/ritemark', relPath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    const run = ref => spawnSync('node', [cli, '--ref', ref], { cwd: repo, encoding: 'utf8' });

    write('esbuild.config.mjs', "export const external = ['vscode', 'pdfkit'];\n");
    write('package-lock.json', JSON.stringify(lock({ 'node_modules/pdfkit': pkg('0.17.2'), 'node_modules/marked': pkg('4.3.0') })));
    write('src/extension.ts', 'export {};\n');
    write('producticons/ritemark-product-icon-theme.json', '{}\n');
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'shell release');
    git('tag', 'v1.0.0');

    assert.equal(run('v1.0.0').stdout, '', 'nothing changed yet');

    write('src/extension.ts', 'export const changed = true;\n');
    write('scripts/dev-tool.ts', 'export {};\n');
    write('producticons/ritemark-product-icon-theme.json', '{"weight":"400"}\n');
    write('package-lock.json', JSON.stringify(lock({ 'node_modules/pdfkit': pkg('0.17.3'), 'node_modules/marked': pkg('4.4.0') })));
    git('add', '-A');
    git('commit', '-qm', 'fixes');

    const result = run('v1.0.0');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'extensions/ritemark/producticons/ritemark-product-icon-theme.json',
      "pdfkit 0.17.2 -> 0.17.3 (loads from the app's node_modules)",
    ]);

    const badRef = run('no-such-ref');
    assert.equal(badRef.status, 1);
    assert.match(badRef.stderr, /no-such-ref/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
