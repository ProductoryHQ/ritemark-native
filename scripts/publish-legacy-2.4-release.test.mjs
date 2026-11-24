import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./publish-legacy-2.4-release.sh', import.meta.url));

function run(...args) {
  const result = spawnSync('/bin/bash', [script, ...args], {
    encoding: 'utf8',
    env: { PATH: '/nonexistent' },
  });
  assert.ifError(result.error);
  return result;
}

test('requires opt-in even for a valid 2.4 release', () => {
  const result = run('2.4.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Usage: .* --also-legacy-repo/m);
});

test('refuses versions outside the full 2.4 series before publishing', () => {
  for (const version of ['2.3.9', '2.5.0', '2.4.0-ext.1', '2.4.0-rc.1']) {
    const result = run(version, '--also-legacy-repo');
    assert.equal(result.status, 1, version);
    assert.equal(result.stderr.trim(), 'Only full 2.4.x releases can be copied.', version);
  }
});

test('help explains who the copy is for', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /only to move pre-2\.4 installs/);
});
