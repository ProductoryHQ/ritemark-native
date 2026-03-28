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
  'ai_model_used',
  'reaction_submitted',
  'feedback_sent',
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
  ai_model_used: { model: 'gpt-4o', provider: 'openai' },
  reaction_submitted: { reaction: 'love_it', message: 'Great app!' },
  feedback_sent: { message: 'Please add dark mode', reaction: 'good' },
};

assert.ok(_payloadCheck, 'All payload shapes should be valid');

// ── 2. Opt-out logic (pure extraction) ──────────────────────

/**
 * Pure version of the opt-out check used in posthog.ts.
 * Tests that both the setting and the feature flag must be true.
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

// ── 4. Reaction choices ─────────────────────────────────────

const REACTION_VALUES = ['love_it', 'good', 'okay', 'needs_work'];

// All values should be non-empty snake_case strings
for (const value of REACTION_VALUES) {
  assert.match(value, /^[a-z_]+$/, `Reaction value should be snake_case: ${value}`);
}

// Should have exactly 4 choices
assert.strictEqual(REACTION_VALUES.length, 4, 'Should have exactly 4 reaction choices');

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
