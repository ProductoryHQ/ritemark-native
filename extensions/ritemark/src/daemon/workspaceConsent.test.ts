/**
 * Sprint 107 R2 — workspace consent state tests (D1 Option A, D2 grandfather).
 */
import assert from 'node:assert/strict';
import { getConsentState, setConsentState, type ConsentStore } from './workspaceConsent';

function fakeStore(initial: Record<string, unknown> = {}): ConsentStore & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: <T,>(k: string) => data[k] as T | undefined,
    update: (k, v) => { if (v === undefined) delete data[k]; else data[k] = v; return Promise.resolve(); },
  };
}

const noHistory = { getAllRuns: () => [] };
const withHistory = { getAllRuns: () => [{ taskId: 't', runId: 'r' }] };

// Fresh workspace, no history → undecided (the toast decides).
assert.equal(getConsentState(fakeStore(), noHistory), 'undecided');

// D2 grandfather: existing run history counts as consent.
assert.equal(getConsentState(fakeStore(), withHistory), 'granted');

// An explicit decision beats the grandfather default — both directions.
{
  const s = fakeStore();
  await setConsentState(s, 'declined');
  assert.equal(getConsentState(s, withHistory), 'declined', 'explicit decline wins over history');
  await setConsentState(s, 'granted');
  assert.equal(getConsentState(s, noHistory), 'granted');
}

// Reset to undecided clears the stored value entirely.
{
  const s = fakeStore();
  await setConsentState(s, 'declined');
  await setConsentState(s, 'undecided');
  assert.equal(Object.keys(s.data).length, 0, 'undecided removes the key');
  assert.equal(getConsentState(s, noHistory), 'undecided');
}

console.log('workspaceConsent tests passed.');
