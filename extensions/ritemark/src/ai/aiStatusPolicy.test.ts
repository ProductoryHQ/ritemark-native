/**
 * The status bar's AI item, every state (Sprint 144, P3, S32): the Experience lead's words (experience 13), Offline
 * first, each AI's name, words only (no dot in 2.1), and no "AI", "service" or "connected" except in "No AI yet".
 *
 * Run: npx tsx src/ai/aiStatusPolicy.test.ts
 */
import assert from 'node:assert/strict';
import { describeAiStatus, type AiStatusInput } from './aiStatusPolicy';

const base: AiStatusInput = { online: true, internetAnswered: true, label: 'Claude', usable: true, signInEnded: false, planRefused: false, anyUsable: true };

assert.deepEqual(describeAiStatus(base), { state: 'ready', text: 'Claude ready', tooltip: 'Signed in to Claude' });
for (const label of ['ChatGPT', 'OpenCode']) {
  assert.equal(describeAiStatus({ ...base, label }).text, `${label} ready`, `${label} is named`);
}

// Before the internet's first answer a signed-in AI is not "ready": the item claims nothing (drawn hidden). The states
// that don't claim the internet works are unchanged.
assert.deepEqual(describeAiStatus({ ...base, internetAnswered: false }), { state: 'waiting', text: '', tooltip: '' });
assert.equal(describeAiStatus({ ...base, internetAnswered: false, usable: false, anyUsable: false }).state, 'no-ai');
assert.equal(describeAiStatus({ ...base, internetAnswered: false, signInEnded: true }).state, 'sign-in-again');

// Offline comes before every other state.
for (const over of [{}, { usable: false, anyUsable: false }, { signInEnded: true }, { planRefused: true }]) {
  assert.deepEqual(describeAiStatus({ ...base, ...over, online: false }), {
    state: 'offline',
    text: 'Offline',
    tooltip: 'No internet. Your documents work as usual and save on this computer.',
  });
}

assert.deepEqual(describeAiStatus({ ...base, usable: false, anyUsable: false }), {
  state: 'no-ai', text: 'No AI yet', tooltip: 'Sign in to an AI to work with it here',
});
assert.deepEqual(describeAiStatus({ ...base, usable: false, anyUsable: true }), {
  state: 'sign-in', text: 'Claude: sign in', tooltip: 'Sign in to Claude to work with it here',
}, 'never signed in, another AI is: no "again"');
assert.deepEqual(describeAiStatus({ ...base, signInEnded: true }), {
  state: 'sign-in-again', text: 'Claude: sign in again', tooltip: 'Your Claude sign-in has ended',
}, 'a sign-in that ended wins over a status that still says signed in');
assert.deepEqual(describeAiStatus({ ...base, planRefused: true }), {
  state: 'paid-plan', text: 'Claude needs a paid plan', tooltip: "Your Claude plan doesn't include working in Ritemark",
});

// The words never say "AI", "service" or "connected", except the No AI yet state's own words (its text and the
// Experience lead's tooltip, "Sign in to an AI to work with it here").
const inputs: AiStatusInput[] = [];
for (const online of [true, false]) for (const internetAnswered of [true, false]) for (const usable of [true, false]) for (const signInEnded of [true, false])
  for (const planRefused of [true, false]) for (const anyUsable of [true, false]) for (const label of ['Claude', 'ChatGPT', 'OpenCode'])
    inputs.push({ online, internetAnswered, usable, signInEnded, planRefused, anyUsable, label });
for (const input of inputs) {
  const view = describeAiStatus(input);
  for (const words of [view.text, view.tooltip]) {
    const checked = view.state === 'no-ai' ? '' : words;
    assert.ok(!/\bAI\b|service|connected/i.test(checked), `"${words}" says what it must not`);
  }
  // Only a plan refusal says "needs a paid plan"; nothing sends one before #496's classifier.
  if (view.state === 'paid-plan') assert.equal(input.planRefused, true);
  // "Ready" only once the internet has answered.
  if (view.state === 'ready') assert.equal(input.internetAnswered && input.online, true);
  // Words only in 2.1: the view carries no dot (the Experience lead, 3c0a2ae).
  assert.deepEqual(Object.keys(view).sort(), ['state', 'text', 'tooltip']);
}

console.log('aiStatusPolicy.test.ts passed');
