/**
 * Unit tests for Ritemark Analytics.
 *
 * Tests the core logic without vscode or PostHog dependencies
 * by extracting and testing the pure functions.
 *
 * Run: npx tsx src/analytics/analytics.test.ts
 */

import assert from 'node:assert/strict';
import type { EventName, EventPayloads } from './events';

// ── 1. Event type coverage ──────────────────────────────────

const ALL_EVENT_NAMES: EventName[] = [
  'app_session_start',
  'feature_used',
  'agent_used',
  'feedback_sent',
  'welcome_shown',
  'ai_signed_in',
  'project_opened',
  'first_message_sent',
  'ready_request_used',
  'starting_point_used',
  'made_something',
  'feedback_opened',
  'first_reply',
  'voice_captured',
  'voice_note_edited',
];

// Verify every event name is a valid string (compile-time + runtime)
for (const name of ALL_EVENT_NAMES) {
  assert.ok(typeof name === 'string' && name.length > 0, `Event name should be a non-empty string: ${name}`);
}

// Verify payload shapes match (compile-time type check — if this compiles, types are correct)
const _payloadCheck: {
  [K in EventName]: EventPayloads[K];
} = {
  app_session_start: { version: '1.0.0', platform: 'darwin' },
  feature_used: { feature: 'editor' },
  agent_used: { agent: 'claude', source: 'chat', outcome: 'arrived' },
  feedback_sent: { message: 'Please add dark mode' },
  welcome_shown: { kind: 'fresh' },
  ai_signed_in: { provider: 'chatgpt', method: 'account' },
  project_opened: { source: 'sample', has_ai: false },
  first_message_sent: { provider: 'opencode' },
  ready_request_used: { kind: 'what_is_here', provider: 'chatgpt' },
  starting_point_used: { place: 'word_or_pdf', edited: true, provider: 'claude' },
  made_something: { how: 'new_document', after_ready_request: false },
  feedback_opened: { from: 'ai_info' },
  first_reply: { provider: 'chatgpt', outcome: 'provider_error' },
  voice_captured: { source: 'transcribe', input: 'recorded' },
  voice_note_edited: { source: 'dictation', days_since_capture: 3 },
};

assert.ok(_payloadCheck, 'All payload shapes should be valid');

// Sprint 133 (R8): the welcome's four events carry no path, name, file,
// message, account or e-mail: their only properties are these.
const WELCOME_EVENT_KEYS: Record<string, string[]> = {
  welcome_shown: ['kind'],
  ai_signed_in: ['provider', 'method'],
  project_opened: ['source', 'has_ai'],
  first_message_sent: ['provider'],
};
// Sprint 140 (R15, S69): the first day's counts carry no words, names, paths, file counts, accounts or addresses.
Object.assign(WELCOME_EVENT_KEYS, {
  ready_request_used: ['kind', 'provider'],
  starting_point_used: ['place', 'edited', 'provider'],
  made_something: ['how', 'after_ready_request'],
  feedback_opened: ['from'],
});
for (const [event, keys] of Object.entries(WELCOME_EVENT_KEYS)) {
  assert.deepEqual(Object.keys(_payloadCheck[event as EventName]).sort(), [...keys].sort(), `${event} has only ${keys.join(', ')}`);
  for (const key of keys) {
    assert.doesNotMatch(key, /path|name|file|message|account|email|folder/i, `${event}.${key} names nothing personal`);
  }
}

// Sprint 139 (R7–R11, S56): the new counts carry only the properties the privacy page lists, and nothing
// that names a person, a document or what was said.
const SPRINT_139_EVENT_KEYS: Record<string, string[]> = {
  agent_used: ['agent', 'source', 'outcome'],
  first_reply: ['provider', 'outcome'],
  voice_captured: ['source', 'input'],
  voice_note_edited: ['source', 'days_since_capture'],
};
for (const [event, keys] of Object.entries(SPRINT_139_EVENT_KEYS)) {
  assert.deepEqual(Object.keys(_payloadCheck[event as EventName]).sort(), [...keys].sort(), `${event} has only ${keys.join(', ')}`);
  for (const key of keys) {
    assert.doesNotMatch(key, /path|name|file|message|account|email|folder|model|text|project|language|length/i, `${event}.${key} names nothing personal`);
  }
}

// ── 2. Setting and kill switch (the gate itself is tested in consent.test.ts) ──

/**
 * Both the person's yes and the feature flag must be true. Since Sprint 133
 * the setting defaults to false: nothing is counted before a yes.
 */
function isAnalyticsEnabledPure(settingEnabled: boolean, flagEnabled: boolean): boolean {
  return settingEnabled && flagEnabled;
}

// Both on → enabled
assert.strictEqual(isAnalyticsEnabledPure(true, true), true, 'Should be enabled when both setting and flag are true');

// Setting off → disabled
assert.strictEqual(isAnalyticsEnabledPure(false, true), false, 'Should be disabled when setting is false');

// Flag off → disabled (kill-switch)
assert.strictEqual(isAnalyticsEnabledPure(true, false), false, 'Should be disabled when feature flag is false');

// Both off → disabled
assert.strictEqual(isAnalyticsEnabledPure(false, false), false, 'Should be disabled when both are false');

// ── 3. UUID generation ──────────────────────────────────────

/**
 * Same UUID generator used in posthog.ts.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const uuid1 = generateUUID();
const uuid2 = generateUUID();

// Valid UUID v4 format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert.match(uuid1, uuidRegex, `UUID should match v4 format: ${uuid1}`);
assert.match(uuid2, uuidRegex, `UUID should match v4 format: ${uuid2}`);

// UUIDs should be unique
assert.notStrictEqual(uuid1, uuid2, 'Two generated UUIDs should be different');

// ── 4. (Sprint 140: the four reaction choices retired with `reaction_submitted`) ──

// ── 5. Track event suppression logic ────────────────────────

/**
 * Simulates trackEvent behaviour: if analytics is disabled or client/id is missing,
 * the event should NOT be captured.
 */
function shouldCapture(
  analyticsEnabled: boolean,
  clientExists: boolean,
  anonymousIdExists: boolean
): boolean {
  return analyticsEnabled && clientExists && anonymousIdExists;
}

assert.strictEqual(shouldCapture(true, true, true), true, 'Should capture when everything is available');
assert.strictEqual(shouldCapture(false, true, true), false, 'Should NOT capture when analytics disabled');
assert.strictEqual(shouldCapture(true, false, true), false, 'Should NOT capture when client is null');
assert.strictEqual(shouldCapture(true, true, false), false, 'Should NOT capture when anonymousId is null');

// ── Done ─────────────────────────────────────────────────────

console.log('✓ All analytics tests passed');
