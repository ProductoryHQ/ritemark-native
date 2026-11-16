/**
 * Sprint 160 (#696): the AI sheet's sign-in card messages.
 * - The sheet's Cancel and "Open the page again" are decoded only for the two AIs the sheet signs in.
 * - ChatGPT's card line when its sign-in's poll ends (review of #730): the 2-minute give-up says "not finished in time"
 *   only for a login whose page opened here, never for Settings' own login, which says it started before it has a page.
 *
 * Run: npx tsx src/views/agentSidebarProtocol.test.ts
 */
import assert from 'node:assert/strict';
import { decodeSheetSignInRequest, sheetLineForCodexPollEnd } from './agentSidebarProtocol';

assert.deepEqual(decodeSheetSignInRequest({ type: 'onboarding:cancel-sign-in', ai: 'claude' }), { type: 'onboarding:cancel-sign-in', ai: 'claude' });
assert.deepEqual(decodeSheetSignInRequest({ type: 'onboarding:reopen-sign-in', ai: 'chatgpt', extra: 1 }), { type: 'onboarding:reopen-sign-in', ai: 'chatgpt' }, 'only the known fields');
assert.equal(decodeSheetSignInRequest({ type: 'onboarding:cancel-sign-in', ai: 'opencode' }), null, 'OpenCode has no sign-in to cancel');
assert.equal(decodeSheetSignInRequest({ type: 'onboarding:recheck', ai: 'claude' }), null);
assert.equal(decodeSheetSignInRequest(null), null);

assert.equal(sheetLineForCodexPollEnd('failed', true), 'failed', 'Codex said the login failed');
assert.equal(sheetLineForCodexPollEnd('gave-up', true), 'timed-out', 'the page opened here and wasn\'t finished in 2 minutes');
assert.equal(sheetLineForCodexPollEnd('gave-up', false), null, 'a login with no page here (Settings\') just ends');
assert.equal(sheetLineForCodexPollEnd('ready', true), null);
assert.equal(sheetLineForCodexPollEnd('stopped', true), null, 'a Cancel or a sign-out leaves no line');

console.log('agentSidebarProtocol.test.ts: the sheet\'s sign-in messages and lines');
