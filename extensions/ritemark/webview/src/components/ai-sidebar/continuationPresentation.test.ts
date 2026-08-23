import assert from 'node:assert/strict';
import { continuationPresentation } from './continuationPresentation';

const contextUnavailable = continuationPresentation({
  mode: 'context-unavailable',
  runtimeId: 'codex',
  truncated: false,
  unansweredPriorRequest: false,
});
assert.equal(contextUnavailable.title, 'You can read this conversation, but the agent can’t use its earlier context.');
assert.deepEqual(contextUnavailable.details, []);

const unavailable = continuationPresentation({
  mode: 'runtime-unavailable',
  runtimeId: 'claude-code',
  truncated: false,
  unansweredPriorRequest: false,
});
assert.equal(unavailable.title, 'Claude isn’t available.');
assert.deepEqual(unavailable.details, ['Sign in, choose another agent, or start a new conversation.']);

console.log('continuationPresentation.test.ts: all tests passed');
