/**
 * Sprint 156 (experience 35, "With no AI ready"; #690 and the Experience lead's nine answers): with no AI ready,
 * Home's first card signs in. Which AI leads (`leadAi`, `canSignInHere`), the AI the card names (`cardAi`), the card's
 * words for the three kinds of project and each lead (the note is the welcome's plan line, kept equal to the
 * webview's copy), and the AI last seen ready, in its own key: set, cleared only for the AI signed out, bad values
 * ignored, and the test seed read in the test channel only.
 *
 * Run: npx tsx src/guidance/signInCard.test.ts
 */

import assert from 'node:assert/strict';
import { PLAN_LINES as WELCOME_PLAN_LINES } from '../../webview/src/components/welcome/welcomeCopy';
import {
  clearLastReadyAi,
  GUIDANCE_KEY,
  LAST_READY_AI_KEY,
  noteLastReadyAi,
  readLastReadyAi,
  seedLastReadyAiForTest,
  TEST_LAST_READY_AI_ENV,
  type MementoLike,
} from './guidanceStore';
import { AI_NAMES, canSignInHere, cardAi, leadAi, PLAN_LINES, readyRequestWords, signInWords, type AiState, type ReadyKind } from './readyRequest';

type States = Parameters<typeof leadAi>[0]['states'];
const signedOut: States = { 'claude-code': 'sign-in', codex: 'sign-in', opencode: 'set-up' };
const both = { 'claude-code': true, codex: true, opencode: false };

// ── Which AI leads (leadAi) ──

assert.equal(leadAi({ lastReady: undefined, states: signedOut, canSignIn: both }), 'codex', 'ChatGPT leads: any plan works');
assert.equal(leadAi({ lastReady: 'claude-code', states: signedOut, canSignIn: both }), 'claude-code', 'the last ready AI leads when its sign-in has lapsed');
assert.equal(leadAi({ lastReady: 'claude-code', states: { ...signedOut, 'claude-code': 'signing-in' }, canSignIn: both }), 'claude-code', 'a lapsed sign-in that is being redone still leads');
assert.equal(leadAi({ lastReady: 'claude-code', states: { ...signedOut, 'claude-code': 'set-up' }, canSignIn: { ...both, 'claude-code': false } }), 'codex', 'a last ready Claude that now needs repair is not a lapsed sign-in');
assert.equal(leadAi({ lastReady: 'claude-code', states: { ...signedOut, opencode: 'ready' }, canSignIn: both }), 'codex', 'only with no AI ready');
assert.equal(leadAi({ lastReady: 'opencode', states: signedOut, canSignIn: both }), 'codex', 'OpenCode is set up, not signed in: it never lapses');
assert.equal(leadAi({ lastReady: 'codex', states: signedOut, canSignIn: { ...both, codex: false } }), 'claude-code', 'a lapsed ChatGPT that can no longer sign in here does not lead');
assert.equal(leadAi({ lastReady: undefined, states: signedOut, canSignIn: { ...both, codex: false } }), 'claude-code', 'ChatGPT can\'t sign in here: Claude leads');
assert.equal(leadAi({ lastReady: undefined, states: { opencode: 'set-up' }, canSignIn: {} }), 'opencode', 'neither can: Set up OpenCode leads');
assert.equal(leadAi({ lastReady: undefined, states: {}, canSignIn: {} }), 'codex', 'OpenCode off too: ChatGPT, whose press opens AI Settings (review finding 7)');
assert.equal(leadAi({ lastReady: undefined, states: { 'claude-code': 'set-up', codex: 'set-up' }, canSignIn: canSignInHere({ 'claude-code': 'set-up', codex: 'set-up' }, 'bundled') }), 'codex', 'OpenCode with no state never leads');

// Whether Ritemark can sign in to each AI here (ChatGPT: a build without it, the computer's own runtime, its flag off)
assert.deepEqual(canSignInHere(signedOut, 'bundled'), { 'claude-code': true, codex: true, opencode: false });
assert.equal(canSignInHere(signedOut, 'system').codex, false, 'ChatGPT on the computer\'s own runtime');
assert.equal(canSignInHere({ ...signedOut, codex: 'set-up' }, 'bundled').codex, false, 'a build without ChatGPT (it needs repair, not a sign-in)');
assert.equal(canSignInHere({ 'claude-code': 'sign-in', opencode: 'set-up' }, 'bundled').codex, false, 'ChatGPT\'s flag off: no state at all');
assert.equal(canSignInHere({ ...signedOut, 'claude-code': 'checking' }, 'bundled')['claude-code'], true, 'a check in progress doesn\'t move the lead');
assert.equal(canSignInHere({ ...signedOut, 'claude-code': 'set-up' }, 'system')['claude-code'], false);
assert.equal(leadAi({ lastReady: undefined, states: signedOut, canSignIn: canSignInHere(signedOut, 'system') }), 'claude-code', 'the computer\'s own runtime: Claude leads');

// ── The AI the card names with no AI ready (cardAi; it was always Claude, S19) ──

const none = { chosen: undefined, sheetAi: undefined, lastReady: undefined, canSignIn: both };
assert.deepEqual(cardAi({ ...none, states: signedOut }), { ai: 'codex', ready: false }, 'none ready: the card leads with ChatGPT');
assert.deepEqual(cardAi({ ...none, sheetAi: 'claude-code', chosen: 'claude-code', states: signedOut }), { ai: 'codex', ready: false }, 'a sheet\'s or chosen AI that isn\'t ready doesn\'t lead');
assert.deepEqual(cardAi({ ...none, lastReady: 'claude-code', states: signedOut }), { ai: 'claude-code', ready: false }, 'a lapsed Claude leads');
assert.deepEqual(cardAi({ ...none, lastReady: 'claude-code', states: { ...signedOut, codex: 'ready' } }), { ai: 'codex', ready: true }, 'a ready AI is still the request, not a sign-in');

// ── The card's words for three kinds × the leads (the note is the welcome's plan line) ──

assert.deepEqual(PLAN_LINES, WELCOME_PLAN_LINES, 'the host\'s plan lines are the welcome\'s, word for word');
assert.equal(signInWords('ChatGPT'), 'Sign in with ChatGPT');
assert.equal(signInWords('Claude'), 'Sign in with Claude', 'not Claude.ai (answer 4)');
assert.equal(signInWords('OpenCode'), 'Set up OpenCode');
const plan = { ChatGPT: WELCOME_PLAN_LINES.chatgpt, Claude: WELCOME_PLAN_LINES.claude, OpenCode: WELCOME_PLAN_LINES.opencode } as const;
for (const kind of ['files', 'empty', 'sample'] as ReadyKind[]) {
  for (const ai of ['ChatGPT', 'Claude', 'OpenCode'] as const) {
    const ready = readyRequestWords(kind, ai, 'Training work', '3 files: 3 Word documents.');
    const signIn = readyRequestWords(kind, ai, 'Training work', '3 files: 3 Word documents.', false);
    assert.deepEqual(signIn, { ...ready, button: signInWords(ai), note: plan[ai] }, `${kind} × ${ai}: only the button and the note change`);
    assert.match(signIn.body, new RegExp(ai), `${kind} × ${ai}: the body still names the AI`);
  }
}
assert.deepEqual(readyRequestWords('files', 'ChatGPT', 'Training work', null, false), {
  icon: 'folder-simple',
  heading: 'Nothing in this folder was moved or changed',
  body: 'ChatGPT works only inside it.',
  button: 'Sign in with ChatGPT',
  note: 'Any plan works, free included.',
  hide: 'Hide this in Training work',
  busy: null,
}, 'experience 35: the card on a folder with files, ChatGPT leading');
assert.equal(readyRequestWords('empty', 'Claude', 'Board report 2027', null, false).note, 'Needs a paid plan, such as Pro or Max.');
assert.equal(readyRequestWords('sample', 'OpenCode', 'Leadership programme', null, false).button, 'Set up OpenCode');
assert.equal(readyRequestWords('files', AI_NAMES.codex, 'x', null).button, 'Ask ChatGPT what it can do here', 'ready: the request, as before');

// ── The AI last seen ready: its own key (Sprint 156) ──

(async () => {
  const bag = new Map<string, unknown>();
  let writes = 0;
  const memento: MementoLike = { get: <T>(key: string) => bag.get(key) as T | undefined, update: async (key, value) => { writes += 1; bag.set(key, value); } };
  assert.equal(readLastReadyAi(memento), undefined, 'nothing yet');
  await noteLastReadyAi(memento, 'claude-code');
  assert.equal(readLastReadyAi(memento), 'claude-code');
  assert.deepEqual([...bag.keys()], [LAST_READY_AI_KEY], 'its own key, never the guidance record');
  assert.notEqual(LAST_READY_AI_KEY, GUIDANCE_KEY);
  assert.equal(LAST_READY_AI_KEY, 'ritemark.guidance.lastReadyAi');
  assert.equal(bag.get(LAST_READY_AI_KEY), 'claude-code', 'only the AI\'s id');
  await noteLastReadyAi(memento, 'claude-code');
  assert.equal(writes, 1, 'the same AI again writes nothing');

  assert.equal(await clearLastReadyAi(memento, 'codex'), false, 'signing ChatGPT out leaves a remembered Claude');
  assert.equal(readLastReadyAi(memento), 'claude-code');
  assert.equal(await clearLastReadyAi(memento, 'claude-code'), true, 'signing Claude out in Ritemark forgets Claude');
  assert.equal(readLastReadyAi(memento), undefined);

  for (const bad of ['gpt', 7, { ai: 'codex' }, ['codex'], null, '']) {
    bag.set(LAST_READY_AI_KEY, bad);
    assert.equal(readLastReadyAi(memento), undefined, `a bad stored value (${JSON.stringify(bad)}) is ignored`);
  }
  assert.equal(await clearLastReadyAi(memento, 'codex'), false, 'a bad value is no AI to clear');

  // The test seed: read in the test channel only (#681's rule)
  bag.clear();
  for (const env of [
    { [TEST_LAST_READY_AI_ENV]: 'claude-code' },
    { [TEST_LAST_READY_AI_ENV]: 'claude-code', RITEMARK_BUILD_CHANNEL: 'prod' },
    { [TEST_LAST_READY_AI_ENV]: 'claude-code', RITEMARK_BUILD_CHANNEL: 'dev' },
    { [TEST_LAST_READY_AI_ENV]: 'claude-code', RITEMARK_BUILD_CHANNEL: '' },
  ]) {
    assert.equal(await seedLastReadyAiForTest(memento, env), false, `no effect outside the test channel (${env.RITEMARK_BUILD_CHANNEL ?? 'unset'})`);
    assert.equal(bag.size, 0, 'nothing written outside the test channel');
  }
  await noteLastReadyAi(memento, 'codex');
  assert.equal(await seedLastReadyAiForTest(memento, { [TEST_LAST_READY_AI_ENV]: 'claude-code', RITEMARK_BUILD_CHANNEL: 'prod' }), false);
  assert.equal(readLastReadyAi(memento), 'codex', 'outside the test channel a stored AI is left alone');
  assert.equal(await seedLastReadyAiForTest(memento, { [TEST_LAST_READY_AI_ENV]: 'Claude', RITEMARK_BUILD_CHANNEL: 'test' }), false, 'only an AI\'s id seeds');
  assert.equal(await seedLastReadyAiForTest(memento, { RITEMARK_BUILD_CHANNEL: 'test' }), false, 'no seed, nothing changes');
  assert.equal(readLastReadyAi(memento), 'codex');
  assert.equal(await seedLastReadyAiForTest(memento, { [TEST_LAST_READY_AI_ENV]: ' claude-code ', RITEMARK_BUILD_CHANNEL: 'test' }), true, 'the test channel seeds it');
  assert.equal(readLastReadyAi(memento), 'claude-code');
  const lapsedClaude: Record<string, AiState> = { 'claude-code': 'sign-in', codex: 'sign-in', opencode: 'set-up' };
  assert.equal(leadAi({ lastReady: readLastReadyAi(memento), states: lapsedClaude, canSignIn: both }), 'claude-code', 'so a lapsed Claude can be staged');

  console.log('signInCard: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
