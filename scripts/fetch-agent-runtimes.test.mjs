/**
 * The `file(1)` drift guard.
 *
 * libmagic reorders and extends its description across versions and hosts, so
 * an exact-substring match on the manifest's `expectedFileArchPattern` turns a
 * cosmetic change in a runner image into a release-blocking build failure. That
 * has now happened twice: v1.6.3 (five commits to unpick) and v1.11.0, where a
 * Windows runner answered "…6.00 (console), x86-64, 8 sections" against a
 * pattern expecting "(console) x86-64, for MS Windows".
 *
 * The real outputs below are the evidence from those two incidents. They are
 * here so the next drift is caught by a test rather than by a failed release.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { architectureTokens } from './fetch-agent-runtimes.mjs';

function matches(pattern, output) {
  const tokens = architectureTokens(pattern);
  assert.ok(tokens.length > 0, `pattern yielded no tokens: ${pattern}`);
  return tokens.every((token) => new RegExp(token.replace('+', '\\+'), 'i').test(output));
}

test('accepts every real file(1) phrasing seen on a Windows runner', () => {
  const pattern = 'PE32+ executable (console) x86-64, for MS Windows';
  for (const output of [
    'PE32+ executable (console) x86-64, for MS Windows',                    // the pattern itself
    'PE32+ executable for MS Windows 6.00 (console), x86-64, 7 sections',   // v1.6.3
    'PE32+ executable for MS Windows 6.00 (console), x86-64, 8 sections',   // v1.11.0
  ]) {
    assert.ok(matches(pattern, output), `should accept: ${output}`);
  }
});

test('accepts the GUI variant under the same drift', () => {
  assert.ok(matches(
    'PE32+ executable (GUI) x86-64, for MS Windows',
    'PE32+ executable for MS Windows 6.00 (GUI), x86-64, 8 sections',
  ));
});

test('accepts the macOS patterns unchanged', () => {
  assert.ok(matches('Mach-O 64-bit executable arm64', 'Mach-O 64-bit executable arm64'));
  assert.ok(matches('Mach-O 64-bit executable x86_64', 'Mach-O 64-bit executable x86_64'));
});

// The point of tolerating drift is NOT to stop checking. A 32-bit binary or the
// wrong CPU must still fail the build — that is what this guard is for.
test('still rejects a genuine architecture mismatch', () => {
  assert.equal(
    matches('PE32+ executable (console) x86-64, for MS Windows',
            'PE32 executable (console) Intel 80386, for MS Windows'),
    false,
    'PE32 is not PE32+, and Intel 80386 is not x86-64',
  );
  assert.equal(
    matches('Mach-O 64-bit executable x86_64', 'Mach-O 64-bit executable arm64'),
    false,
    'an arm64 slice must not satisfy an x86_64 expectation',
  );
});

test('an empty pattern yields no tokens, so the caller skips the check', () => {
  assert.deepEqual(architectureTokens(''), []);
});
