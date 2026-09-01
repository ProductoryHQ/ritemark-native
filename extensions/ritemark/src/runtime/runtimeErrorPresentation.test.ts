import assert from 'node:assert/strict';
import {
  isClaudeAuthenticationError,
  presentRuntimeError,
} from './runtimeErrorPresentation';

const rawOAuthError = 'Failed to authenticate: OAuth session expired and could not be refreshed';

assert.equal(isClaudeAuthenticationError(rawOAuthError), true);
assert.deepEqual(presentRuntimeError('claude-code', rawOAuthError), {
  message: 'Your Claude session has expired. Sign in again, then resend your message.',
  failureKind: 'authentication',
});

assert.deepEqual(presentRuntimeError('claude-code', 'Please run /login to continue'), {
  message: 'Your Claude session has expired. Sign in again, then resend your message.',
  failureKind: 'authentication',
});

assert.deepEqual(presentRuntimeError('claude-code', 'Workspace unavailable'), {
  message: 'Workspace unavailable',
});

// Authentication copy must stay runtime-specific: another runtime using a
// similar phrase should keep its own recovery UX.
assert.deepEqual(presentRuntimeError('codex', rawOAuthError), {
  message: rawOAuthError,
});

console.log('runtimeErrorPresentation tests passed.');
