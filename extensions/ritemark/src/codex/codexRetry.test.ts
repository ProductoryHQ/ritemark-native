/**
 * Sprint 143 (#544, R3, R3a): Codex waiting to try again, made visible.
 * The lines and notifications are the ones the bundled app-server (0.163.0)
 * printed and sent against a local 429 endpoint (research/reproductions.md).
 *
 * Run: npx tsx src/codex/codexRetry.test.ts
 */

import assert from 'node:assert/strict';
import {
  CODEX_RETRY_LOG_FILTER,
  CodexRetryPairing,
  LineBuffer,
  codexAppServerEnv,
  parseCodexRetryLine,
  parseCodexRetryNotice,
} from './codexRetry';

// Ritemark's own app-server process gets the log filter, unless the person set RUST_LOG.
assert.equal(codexAppServerEnv({ PATH: '/usr/bin' }).RUST_LOG, CODEX_RETRY_LOG_FILTER);
assert.equal(codexAppServerEnv({ PATH: '/usr/bin' }).PATH, '/usr/bin', 'nothing else changes');
assert.equal(codexAppServerEnv({ RUST_LOG: 'debug' }).RUST_LOG, 'debug', "the person's own filter is left as it is");
assert.equal(codexAppServerEnv({ RUST_LOG: '' }).RUST_LOG, CODEX_RETRY_LOG_FILTER, 'an empty one is no filter');
assert.equal(CODEX_RETRY_LOG_FILTER, 'error,codex_core::responses_retry=warn');

// The log line, with its colours, as Codex printed it. Its turn_id is the notification's turnId.
const line = '\u001b[2m2026-10-26T21:41:32.778413Z\u001b[0m \u001b[33m WARN\u001b[0m \u001b[2mcodex_core::responses_retry\u001b[0m\u001b[2m:\u001b[0m stream disconnected - retrying sampling request (1/2 in 6.999812083s)... \u001b[3mturn_id\u001b[0m\u001b[2m=\u001b[0m01a17a29-5309-7ea1-a40d-f11e60c26b92 \u001b[3mretries\u001b[0m\u001b[2m=\u001b[0m1 \u001b[3mmax_retries\u001b[0m\u001b[2m=\u001b[0m2';
assert.deepEqual(parseCodexRetryLine(line), { attempt: 1, of: 2, delayMs: 7000, turnId: '01a17a29-5309-7ea1-a40d-f11e60c26b92' });
// The stall's own line, from Codex's log of 26 October.
assert.deepEqual(parseCodexRetryLine('stream disconnected - retrying sampling request (1/5 in 418.999929584s)... turn_id=x'), { attempt: 1, of: 5, delayMs: 419000, turnId: 'x' });
// A line with no turn id (an older Codex) still names the wait.
assert.deepEqual(parseCodexRetryLine('retrying sampling request (2/5 in 60s)'), { attempt: 2, of: 5, delayMs: 60000 });
assert.equal(parseCodexRetryLine('ERROR codex_models_manager::manager: failed to refresh available models'), null);

// Stderr by whole lines: a line split across two chunks is given once, whole.
{
  const lines = new LineBuffer();
  assert.deepEqual(lines.push('first line\nretrying sampling request (1/5 in 4'), ['first line']);
  assert.deepEqual(lines.push('18.99s)... turn_id=t1\nsecond\r\nthird'), ['retrying sampling request (1/5 in 418.99s)... turn_id=t1', 'second']);
  assert.deepEqual(lines.flush(), ['third'], 'what is left at the end is a line too');
  assert.deepEqual(lines.flush(), []);
}

// Pairing, turn by turn: two chats waiting at once keep their own waits, in either order.
{
  const pairing = new CodexRetryPairing<string>();
  const heard = (turnId: string | undefined, delayMs: number, at = 1_000) => ({ attempt: 1, of: 5, delayMs, at, ...(turnId ? { turnId } : {}) });
  // Both notifications first, then the lines in the other order.
  assert.equal(pairing.notice('turn-a', 'chat A', 1_000), null);
  assert.equal(pairing.notice('turn-b', 'chat B', 1_100), null);
  assert.equal(pairing.wait(heard('turn-b', 60_000), 1_200), 'chat B', "B's line goes to B");
  assert.equal(pairing.wait(heard('turn-a', 419_000), 1_300), 'chat A', "and A's to A, not swapped");
  // Both lines first, then the notifications in the other order.
  assert.equal(pairing.wait(heard('turn-c', 30_000), 2_000), null);
  assert.equal(pairing.wait(heard('turn-d', 90_000), 2_000), null);
  assert.equal(pairing.notice('turn-d', 'chat D', 2_100)?.delayMs, 90_000);
  assert.equal(pairing.notice('turn-c', 'chat C', 2_200)?.delayMs, 30_000);
  // A line for another turn completes nothing.
  assert.equal(pairing.notice('turn-e', 'chat E', 3_000), null);
  assert.equal(pairing.wait(heard('turn-f', 10_000), 3_100), null);
  // A line older than the window belongs to nothing.
  assert.equal(pairing.notice('turn-f', 'chat F', 3_100 + 6_000), null);
  // No turn id on one side (an older Codex): it pairs only with the one entry waiting.
  const older = new CodexRetryPairing<string>();
  assert.equal(older.notice('turn-g', 'chat G', 1_000), null);
  assert.equal(older.wait(heard(undefined, 20_000), 1_100), 'chat G');
  assert.equal(older.notice('turn-h', 'chat H', 2_000), null);
  assert.equal(older.notice('turn-i', 'chat I', 2_000), null);
  assert.equal(older.wait(heard(undefined, 20_000), 2_100), null, 'two waiting: no guess');
}

// The notification before each wait.
const notice = {
  error: { message: 'Reconnecting... 1/2', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: 429 } }, additionalDetails: 'exceeded retry limit, last status: 429 Too Many Requests', misalignment: null },
  willRetry: true,
  threadId: '01a17a29-5203',
  turnId: '01a17a29-6e83',
};
assert.deepEqual(parseCodexRetryNotice(notice), { threadId: '01a17a29-5203', turnId: '01a17a29-6e83', attempt: 1, of: 2, httpStatus: 429, busy: true });
// Codex's own rate-limit variant is busy too; a dropped connection is a retry, not busy.
assert.equal(parseCodexRetryNotice({ ...notice, error: { message: 'Reconnecting... 1/5', codexErrorInfo: 'rateLimitExceeded' } })?.busy, true);
assert.equal(parseCodexRetryNotice({ ...notice, error: { message: 'Reconnecting... 1/5', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } } } })?.busy, false);
// The turn's final failure is not a retry.
assert.equal(parseCodexRetryNotice({ ...notice, willRetry: false }), null);
assert.equal(parseCodexRetryNotice(null), null);

console.log('codexRetry: all passed');
