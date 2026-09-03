import assert from 'node:assert/strict';
import {
  classifyClaudeAuthenticationError,
  isClaudeAuthenticationError,
  presentRuntimeError,
  standaloneClaudeAuthenticationError,
  standaloneClaudeOAuthExpirationError,
} from './runtimeErrorPresentation';

const rawOAuthError = 'Failed to authenticate: OAuth session expired and could not be refreshed';

assert.equal(isClaudeAuthenticationError(rawOAuthError), true);
assert.equal(standaloneClaudeAuthenticationError(`  ${rawOAuthError}  `), rawOAuthError);
assert.equal(standaloneClaudeOAuthExpirationError(rawOAuthError), rawOAuthError);
assert.equal(
  standaloneClaudeAuthenticationError(`I can explain this message: ${rawOAuthError}`),
  undefined,
  'normal prose that mentions a provider error must remain model output',
);
assert.equal(
  standaloneClaudeAuthenticationError(`${rawOAuthError}\n\nSign in and try again.`),
  undefined,
  'multi-line model guidance must not be treated as a standalone provider diagnostic',
);
assert.equal(
  standaloneClaudeOAuthExpirationError('Failed to authenticate: invalid authentication credentials'),
  undefined,
  'legacy records cannot infer OAuth from an auth-method-neutral diagnostic',
);
assert.deepEqual(presentRuntimeError('claude-code', rawOAuthError), {
  message: 'Your Claude session has expired. Sign in again, then resend your message.',
  failureKind: 'authentication',
});

assert.deepEqual(presentRuntimeError('claude-code', 'Please run /login to continue'), {
  message: 'Your Claude session has expired. Sign in again, then resend your message.',
  failureKind: 'authentication',
});

assert.equal(classifyClaudeAuthenticationError(rawOAuthError, true), 'api-key-authentication');
assert.deepEqual(presentRuntimeError('claude-code', rawOAuthError, 'api-key-authentication'), {
  message: 'Claude did not accept your API key. Update it in AI Settings, then resend your message.',
  failureKind: 'api-key-authentication',
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
