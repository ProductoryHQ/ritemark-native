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

// The log line, with its colours, as Codex printed it.
const line = '\u001b[2m2026-10-26T21:41:32.778413Z\u001b[0m \u001b[33m WARN\u001b[0m \u001b[2mcodex_core::responses_retry\u001b[0m\u001b[2m:\u001b[0m stream disconnected - retrying sampling request (1/2 in 6.999812083s)... \u001b[3mturn_id\u001b[0m\u001b[2m=\u001b[0m01a17a29-5309';
assert.deepEqual(parseCodexRetryLine(line), { attempt: 1, of: 2, delayMs: 7000 });
// The stall's own line, from Codex's log of 26 October.
assert.deepEqual(parseCodexRetryLine('stream disconnected - retrying sampling request (1/5 in 418.999929584s)... turn_id=x'), { attempt: 1, of: 5, delayMs: 419000 });
assert.equal(parseCodexRetryLine('ERROR codex_models_manager::manager: failed to refresh available models'), null);

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
