import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  beginClaudeLogin,
  cancelClaudeLogin,
  isClaudeLoginActive,
} from './claudeLogin';

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for Claude login test state');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Sprint 160 (#696): Claude's "signing in" has one writer, this shared sign-in owner. A poll, a re-check, a saved key
 * or a sign-out elsewhere used to clear it while the sign-in still ran, and the AI's sheet offered Sign in again.
 */
function checkSigningInHasOneWriter(): void {
  const src = join(__dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk(src);
  const writers = files
    .filter((file) => /\bsetClaudeLoginInProgress\(/.test(readFileSync(file, 'utf-8').replace(/export function setClaudeLoginInProgress\(/, '')))
    .map((file) => relative(src, file).split('\\').join('/'));
  assert.deepEqual(writers, ['agent/claudeLogin.ts'], `only claudeLogin.ts writes Claude's signing-in flag (found: ${writers.join(', ')})`);
  assert.ok(!/\bsetClaudeLoginInProgress\b/.test(readFileSync(join(src, 'agent', 'index.ts'), 'utf-8')), 'agent/index.ts no longer exports it');
  // The sheet's and Settings' polls call a sign-in finished only on a Claude.ai sign-in: with a key saved, Claude reads
  // ready on the key from the first tick (#541), while the browser sign-in still runs.
  for (const rel of ['views/UnifiedViewProvider.ts', 'settings/RitemarkSettingsProvider.ts']) {
    const finished = readFileSync(join(src, rel), 'utf-8').split('\n')
      .filter((line) => line.includes("status.state === 'ready'"))
      .map((line) => line.trim());
    assert.ok(
      finished.includes("if (status.state === 'ready' && status.authMethod === 'claude-oauth') {") && !finished.includes("if (status.state === 'ready') {"),
      `${rel}: the poll's finish test (found: ${finished.join(' | ')})`,
    );
  }
}

async function run(): Promise<void> {
  checkSigningInHasOneWriter();

  if (process.platform === 'win32') {
    console.log('claudeLogin tests skipped: POSIX fake binary fixture');
    return;
  }

  const fixtureDir = mkdtempSync(join(tmpdir(), 'ritemark-claude-login-'));
  const quickBinary = join(fixtureDir, 'quick-claude');
  const slowBinary = join(fixtureDir, 'slow-claude');
  writeFileSync(quickBinary, '#!/bin/sh\nexec sleep 0.1\n');
  writeFileSync(slowBinary, '#!/bin/sh\nexec sleep 5\n');
  // Sprint 156 (#694): a login that prints its page's address, then waits for the browser
  const urlBinary = join(fixtureDir, 'url-claude');
  writeFileSync(urlBinary, '#!/bin/sh\necho "Opening https://claude.com/cai/oauth/authorize?code=abc in your browser"\nexec sleep 5\n');
  chmodSync(quickBinary, 0o755);
  chmodSync(slowBinary, 0o755);
  chmodSync(urlBinary, 0o755);

  try {
    let completedA = 0;
    let completedB = 0;
    assert.equal(beginClaudeLogin(quickBinary, { onComplete: () => { completedA += 1; } }), 'started');
    assert.equal(beginClaudeLogin(quickBinary, { onComplete: () => { completedB += 1; } }), 'already-running');
    await waitFor(() => completedA === 1 && completedB === 1);
    assert.equal(isClaudeLoginActive(), false);

    let cancelledA = 0;
    let cancelledB = 0;
    assert.equal(beginClaudeLogin(slowBinary, { onCancel: () => { cancelledA += 1; } }), 'started');
    assert.equal(beginClaudeLogin(slowBinary, { onCancel: () => { cancelledB += 1; } }), 'already-running');
    assert.equal(cancelClaudeLogin(), true);
    assert.equal(cancelledA, 1);
    assert.equal(cancelledB, 1);
    assert.equal(isClaudeLoginActive(), false);

    // Sprint 156 (#694): the page's address printed before a surface joined reaches only a joiner that asks for it
    const PAGE = 'https://claude.com/cai/oauth/authorize?code=abc';
    const urls: Record<'first' | 'asks' | 'ordinary', string[]> = { first: [], asks: [], ordinary: [] };
    assert.equal(beginClaudeLogin(urlBinary, { onUrl: (url) => urls.first.push(url) }), 'started');
    await waitFor(() => urls.first.length === 1);
    assert.deepEqual(urls.first, [PAGE], 'the login that started hears its page');
    assert.equal(beginClaudeLogin(urlBinary, { onUrl: (url) => urls.asks.push(url), replayUrl: true }), 'already-running');
    assert.deepEqual(urls.asks, [PAGE], 'a joiner that asks (Home\'s card) gets the page it missed, at once');
    assert.equal(beginClaudeLogin(urlBinary, { onUrl: (url) => urls.ordinary.push(url) }), 'already-running');
    assert.deepEqual(urls.ordinary, [], 'an ordinary joiner (Settings, the AI\'s sheet) gets nothing, as before: no second toast');
    assert.equal(cancelClaudeLogin(), true);
    assert.deepEqual([urls.first.length, urls.asks.length, urls.ordinary.length], [1, 1, 0], 'nobody hears it twice');
  } finally {
    if (isClaudeLoginActive()) cancelClaudeLogin();
    rmSync(fixtureDir, { recursive: true, force: true });
  }

  console.log('claudeLogin tests passed.');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
