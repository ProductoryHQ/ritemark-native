/**
 * Sprint 133 (R2–R5, E2): the welcome's provider states and steps, and the
 * protocol's decoder.
 * Run: npx tsx src/welcome/welcomeState.test.ts
 */

import assert from 'node:assert/strict';
import type { RuntimeAvailability } from '../runtime/availability';
import { decodeWelcomeRequest } from './protocol';
import {
  afterProviderReady,
  afterSkip,
  initialMemory,
  projectLine,
  providerOfRuntime,
  providerView,
  runtimeOfProvider,
  updateRows,
  type ProviderMemory,
} from './welcomeState';
import { CHECK_TIMED_OUT } from './words';

const avail = (state: RuntimeAvailability['state']): RuntimeAvailability => ({ state, usable: state === 'ready', detail: null });
const answered = (state: RuntimeAvailability['state'], extra: Partial<{ method: 'account' | 'api_key' | null; signInEnded: boolean }> = {}): ProviderMemory => ({
  ...initialMemory(),
  check: { kind: 'answered', availability: avail(state), method: extra.method ?? null, signInEnded: extra.signInEnded ?? false },
});

// ── R4: each state as its check answers ──
assert.equal(providerView('claude', initialMemory()).phase, 'checking', 'Checking… until the check answers');
assert.deepEqual(providerView('claude', answered('ready')), { id: 'claude', phase: 'ready', reason: null, retry: false, method: 'account' });
assert.equal(providerView('claude', answered('ready', { method: 'api_key' })).method, 'api_key');
assert.equal(providerView('opencode', answered('ready')).method, 'api_key');
assert.deepEqual(providerView('chatgpt', answered('needs-auth')), { id: 'chatgpt', phase: 'sign-in', reason: null, retry: false, method: null });
assert.equal(providerView('chatgpt', answered('needs-auth', { signInEnded: true })).reason, 'Your sign-in has ended. Sign in again to use ChatGPT here.', 'S36');
assert.equal(providerView('opencode', answered('needs-configuration')).phase, 'sign-in', 'OpenCode: Set up');
assert.deepEqual(providerView('claude', { ...initialMemory(), check: { kind: 'timed-out' } }), { id: 'claude', phase: 'sign-in', reason: CHECK_TIMED_OUT, retry: true, method: null }, 'S15');
assert.equal(providerView('claude', { ...initialMemory(), check: { kind: 'offline' } }).phase, 'not-checked', 'S16');
assert.equal(providerView('claude', answered('broken')).phase, 'unavailable');
assert.equal(providerView('claude', answered('error')).retry, true);

// ── R3: signing in, and what happened when it did not finish ──
assert.equal(providerView('claude', { ...answered('needs-auth'), signingIn: true }).phase, 'signing-in');
const failed = providerView('claude', { ...answered('needs-auth'), problem: 'failed' });
assert.equal(failed.phase, 'sign-in');
assert.ok(failed.reason && !/error|code|authenticat|codex/i.test(failed.reason), 'one sentence, no codes, no "authenticated"');
for (const id of ['claude', 'chatgpt', 'opencode'] as const) {
  for (const problem of ['failed', 'timed-out', 'could-not-start', 'not-ready'] as const) {
    const reason = providerView(id, { ...answered('needs-auth'), problem }).reason ?? '';
    assert.doesNotMatch(reason, /codex|authenticat|runtime/i, `${id} ${problem}: people's words`);
  }
}

// ── The update sheet's rows ──
const views = [providerView('chatgpt', answered('needs-auth', { signInEnded: true })), providerView('claude', answered('ready')), providerView('opencode', answered('needs-configuration'))];
assert.deepEqual(updateRows(views).map((v) => v.id), ['claude', 'chatgpt'], 'Claude, then ChatGPT; OpenCode only once set up');
assert.deepEqual(updateRows([...views.slice(0, 2), providerView('opencode', answered('ready'))]).map((v) => v.id), ['claude', 'chatgpt', 'opencode']);

// ── Steps ──
assert.deepEqual(afterProviderReady({ kind: 'fresh', step: 1, readyProvider: null }, 'claude'), { kind: 'fresh', step: 2, readyProvider: 'claude' }, 'S8');
assert.deepEqual(afterProviderReady({ kind: 'update', step: 1, readyProvider: null }, 'chatgpt'), { kind: 'update', step: 1, readyProvider: 'chatgpt' });
assert.deepEqual(afterSkip({ kind: 'fresh', step: 1, readyProvider: null }), { kind: 'fresh', step: 2, readyProvider: null }, 'S6');
assert.equal(projectLine('claude'), 'A project is a folder on this computer. Claude works only inside it.');
assert.equal(projectLine(null), 'A project is a folder on this computer. Your AI works only inside it.', 'S6: no AI named');

assert.equal(providerOfRuntime('codex'), 'chatgpt');
assert.equal(runtimeOfProvider('chatgpt'), 'codex');
assert.equal(providerOfRuntime('other'), null);

// ── The protocol: exact fields, nothing else ──
assert.deepEqual(decodeWelcomeRequest({ type: 'welcome/sign-in', provider: 'claude' }), { ok: true, request: { type: 'welcome/sign-in', provider: 'claude' } });
assert.equal(decodeWelcomeRequest({ type: 'welcome/sign-in', provider: 'opencode' }).ok, false, 'OpenCode has no sign-in');
assert.equal(decodeWelcomeRequest({ type: 'welcome/sign-in', provider: 'claude', extra: 1 }).ok, false, 'unknown fields are refused');
assert.equal(decodeWelcomeRequest({ type: 'welcome/skip', provider: 'claude' }).ok, false);
assert.equal(decodeWelcomeRequest({ type: 'welcome/usage-data', on: 'yes' }).ok, false);
assert.deepEqual(decodeWelcomeRequest({ type: 'welcome/usage-data', on: true }), { ok: true, request: { type: 'welcome/usage-data', on: true } });
assert.equal(decodeWelcomeRequest({ type: 'welcome/save-keys', target: 'claude', keys: { 'openai-api-key': 'sk' } }).ok, false, 'no OpenAI key as a way to use ChatGPT');
assert.equal(decodeWelcomeRequest({ type: 'welcome/save-keys', target: 'opencode', keys: { 'openai-api-key': 'sk', 'google-ai-key': 'AIza' } }).ok, true);
assert.equal(decodeWelcomeRequest({ type: 'welcome/save-keys', target: 'opencode', keys: { 'elevenlabs-api-key': 'x' } }).ok, false);
assert.equal(decodeWelcomeRequest({ type: 'welcome/create-project', name: 'x'.repeat(5000) }).ok, false);
assert.equal(decodeWelcomeRequest({ type: 'welcome/open-link', link: 'https://evil' }).ok, false, 'links are named, never URLs');
assert.equal(decodeWelcomeRequest({ type: 'nope' }).ok, false);
assert.equal(decodeWelcomeRequest(null).ok, false);

console.log('✓ welcomeState and protocol tests passed');
