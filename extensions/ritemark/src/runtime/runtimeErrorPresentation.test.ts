import assert from 'node:assert/strict';
import {
  claudeUnavailableModel,
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

// Sprint 127 R6 (S29): an unavailable model is named, never a raw diagnostic.
assert.equal(
  claudeUnavailableModel("There's an issue with the selected model (claude-opus-5-5). It may not exist or you may not have access to it. Run /model to pick a different model."),
  'claude-opus-5-5',
);
assert.equal(
  claudeUnavailableModel('API Error: 404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-opus-5-5"}}'),
  'claude-opus-5-5',
);
assert.equal(claudeUnavailableModel('Opus 5.5 is not available. Your organization restricts model selection.'), 'Opus 5.5');
assert.equal(
  claudeUnavailableModel('Opus with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config'),
  'Opus with 1M context',
);
assert.equal(claudeUnavailableModel('Request timed out'), undefined);
assert.deepEqual(
  presentRuntimeError('claude-code', "There's an issue with the selected model (claude-opus-5-5). It may not exist or you may not have access to it."),
  { message: "Claude can't use claude-opus-5-5 with this account. Choose another model in the model menu, then resend your message." },
);
assert.equal(
  presentRuntimeError('codex', 'not_found_error model: gpt-x')?.message,
  'not_found_error model: gpt-x',
  'other runtimes keep their own diagnostics',
);
console.log('runtimeErrorPresentation: Sprint 127 model-unavailable presentation passes');
