import assert from 'node:assert/strict';
import {
  claudeUnavailableModel,
  acpTurnErrorCode,
  classifyClaudeAuthenticationError,
  classifyRuntimeError,
  codexTurnErrorCode,
  isClaudeAuthenticationError,
  presentRuntimeError,
  standaloneClaudeAuthenticationError,
  standaloneClaudeOAuthExpirationError,
  unwrapProviderMessage,
} from './runtimeErrorPresentation';
import {
  decodeRuntimeErrorDetail,
  isRuntimeErrorKind,
  trustedBillingUrl,
  turnFailureCard,
  turnOutcome,
} from './turnFailureCopy';

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
  errorKind: 'sign-in',
});

assert.deepEqual(presentRuntimeError('claude-code', 'Please run /login to continue'), {
  message: 'Your Claude session has expired. Sign in again, then resend your message.',
  failureKind: 'authentication',
  errorKind: 'sign-in',
});

assert.equal(classifyClaudeAuthenticationError(rawOAuthError, true), 'api-key-authentication');
assert.deepEqual(presentRuntimeError('claude-code', rawOAuthError, 'api-key-authentication'), {
  message: 'Claude did not accept your API key. Update it in AI Settings, then resend your message.',
  failureKind: 'api-key-authentication',
  errorKind: 'sign-in',
});

assert.deepEqual(presentRuntimeError('claude-code', 'Workspace unavailable'), {
  message: 'Workspace unavailable',
  errorKind: 'provider',
});

// Authentication copy must stay runtime-specific: another runtime using a
// similar phrase should keep its own recovery UX.
assert.deepEqual(presentRuntimeError('codex', rawOAuthError), {
  message: rawOAuthError,
  errorKind: 'provider',
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
// Sprint 139 (R4, S27): Claude's refused model gets the same card as ChatGPT's and OpenCode's.
assert.deepEqual(
  presentRuntimeError('claude-code', "There's an issue with the selected model (claude-opus-5-5). It may not exist or you may not have access to it."),
  {
    message: "Claude couldn't use claude-opus-5-5. It isn't available in Ritemark right now.",
    errorKind: 'model',
    errorDetail: { model: 'claude-opus-5-5' },
  },
);
assert.equal(
  presentRuntimeError('codex', 'not_found_error model: gpt-x')?.message,
  'not_found_error model: gpt-x',
  'other runtimes keep their own diagnostics',
);
console.log('runtimeErrorPresentation: Sprint 127 model-unavailable presentation passes');

// ── Sprint 139 (#376, R3–R5, E1): audit A2's corpus, one fixture per kind × runtime ──

const names = {
  label: (id: string) => ({
    'gpt-6.1-sol': 'GPT-6.1 Sol',
    'gpt-5.6-sol': 'GPT-5.6 Sol',
    'claude-opus-5-5': 'Opus 5.5',
  } as Record<string, string>)[id],
};

// A1. ChatGPT: the #376 envelope (seen 2026-10-01), unwrapped to the model card.
const codexEnvelope = '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-6.1-sol\' model is not supported when using Codex with a ChatGPT account."}}';
assert.deepEqual(classifyRuntimeError('codex', codexEnvelope, { names }), {
  kind: 'model',
  sentence: "ChatGPT couldn't use GPT-6.1 Sol. It isn't available in Ritemark right now.",
  detail: { model: 'gpt-6.1-sol' },
});
assert.ok(!classifyRuntimeError('codex', codexEnvelope)!.sentence.includes('{'), 'no JSON ever reaches the sentence');
assert.ok(!/codex/i.test(classifyRuntimeError('codex', codexEnvelope, { names })!.sentence), "people's names only: ChatGPT, never Codex");

// A2. ChatGPT: the bundled Codex is older than the model (seen in a comment task, 2026-09-14).
assert.deepEqual(
  classifyRuntimeError('codex', '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-6.1-sol\' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}')?.detail,
  { model: 'gpt-6.1-sol' },
);

// A3. ChatGPT: the sign-in ended — by Codex's structured code, and by its own words.
assert.deepEqual(classifyRuntimeError('codex', 'unexpected status 401 Unauthorized', { code: 'unauthorized' }), {
  kind: 'sign-in',
  sentence: 'Your ChatGPT sign-in has ended. Sign in again, then send your message again.',
});
assert.equal(
  classifyRuntimeError('codex', 'Your access token could not be refreshed because your refresh token has expired. Please log out and sign in again.')?.kind,
  'sign-in',
);

// A4. ChatGPT: a plan's usage limit, with its reset time in the AI's own words.
assert.deepEqual(
  classifyRuntimeError('codex', "You've hit your usage limit. Upgrade to Plus to continue using Codex, or try again at 3:05 PM.", { code: 'usageLimitExceeded' }),
  { kind: 'limit', sentence: "You've used ChatGPT's limit for now. It resets at 3:05 PM.", detail: { limit: 'plan', resetsAt: 'at 3:05 PM' } },
);
assert.deepEqual(
  classifyRuntimeError('codex', "You've hit your usage limit. Try again later.")?.detail,
  { limit: 'plan' },
  'no reset time is invented',
);

// A5. ChatGPT: no connection only without an HTTP status; a server that answered is the provider's own error.
assert.equal(classifyRuntimeError('codex', 'stream disconnected before completion: error sending request', { code: 'responseStreamDisconnected' })?.kind, 'network');
assert.equal(classifyRuntimeError('codex', 'unexpected status 502 Bad Gateway', { code: 'httpConnectionFailed', httpStatus: 502 })?.kind, 'provider');
assert.equal(classifyRuntimeError('codex', 'error sending request for url (https://chatgpt.com/backend-api/codex/responses)')?.sentence,
  "Ritemark couldn't reach ChatGPT. Check your connection, then send your message again.");

// A6. OpenCode: Google's credits (seen 2026-10-24, Jarmo), through OpenCode's ACP wrapper.
const googleCredits = 'Internal error: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.';
assert.deepEqual(classifyRuntimeError('opencode', googleCredits, { turnModel: 'google/gemini-4-argon' }), {
  kind: 'limit',
  sentence: 'Google stopped this request: your Gemini API credits have run out.',
  detail: { billing: 'google', limit: 'credits' },
});
assert.equal(unwrapProviderMessage(googleCredits).sentence?.startsWith('Your prepayment credits'), true, 'the ACP wrapper is dropped');

// A7. OpenCode: an OpenAI key out of quota (documented `insufficient_quota` envelope).
assert.deepEqual(
  classifyRuntimeError('opencode', '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}', { turnModel: 'openai/gpt-5.6' }),
  { kind: 'limit', sentence: 'OpenAI stopped this request: your OpenAI API key has reached its quota.', detail: { billing: 'openai', limit: 'quota' } },
);
// Google's 429 uses the same words; the provider comes from the text, else from the model.
assert.equal(
  classifyRuntimeError('opencode', 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits', { turnModel: 'google/gemini-4-argon' })?.detail?.billing,
  'google',
);
// A8. Anthropic's credits, through OpenCode and through Claude with an API key.
assert.deepEqual(
  classifyRuntimeError('opencode', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.', { turnModel: 'anthropic/claude-sonnet-5' })?.detail,
  { billing: 'anthropic', limit: 'credits' },
);
assert.deepEqual(classifyRuntimeError('claude-code', 'Your credit balance is too low to access the Anthropic API.', { code: 'billing_error', usesApiKey: true })?.detail, { billing: 'anthropic', limit: 'credits' });
// With a Claude.ai sign-in a billing error is audit A1's question (#496): nothing is guessed.
assert.deepEqual(classifyRuntimeError('claude-code', 'Your account cannot use this.', { code: 'billing_error' }), {
  kind: 'provider',
  sentence: 'Your account cannot use this.',
});
// A9. OpenRouter's credits.
assert.equal(classifyRuntimeError('opencode', 'Insufficient credits. Add more using https://openrouter.ai/settings/credits', { turnModel: 'openrouter/qwen3' })?.detail?.billing, 'openrouter');

// A10. OpenCode: a model the provider doesn't serve, by OpenCode's error name, and by provider text.
assert.deepEqual(
  classifyRuntimeError('opencode', 'Internal error: Model not found: google/gemini-9-nope', { code: 'ProviderModelNotFoundError', turnModel: 'google/gemini-9-nope' }),
  { kind: 'model', sentence: "OpenCode couldn't use google/gemini-9-nope. It isn't available in Ritemark right now.", detail: { model: 'google/gemini-9-nope' } },
);
assert.equal(classifyRuntimeError('opencode', 'models/gemini-9-nope is not found for API version v1beta, or is not supported for generateContent.')?.detail?.model, 'gemini-9-nope');

// A11. OpenCode: a refused or missing key opens Settings' keys.
assert.deepEqual(classifyRuntimeError('opencode', 'provider authentication required', { code: 'auth_required', turnModel: 'google/gemini-4-argon' }), {
  kind: 'sign-in',
  sentence: "Google didn't accept the API key. Check it in AI Settings, then send your message again.",
  detail: { billing: 'google' },
});
assert.equal(classifyRuntimeError('opencode', 'API key not valid. Please pass a valid API key.', { turnModel: 'google/gemini-4-argon' })?.kind, 'sign-in');

// A12. Claude: a plan's limit (SDK `rate_limit`), and a model the SDK says isn't there.
assert.deepEqual(
  classifyRuntimeError('claude-code', "You've hit your limit · resets 3pm (Europe/Tallinn)", { code: 'rate_limit' })?.detail,
  { limit: 'plan', resetsAt: 'at 3pm (Europe/Tallinn)' },
);
assert.deepEqual(classifyRuntimeError('claude-code', 'model not found', { code: 'model_not_found', turnModel: 'claude-opus-5-5', names })?.sentence,
  "Claude couldn't use Opus 5.5. It isn't available in Ritemark right now.");
assert.equal(classifyRuntimeError('claude-code', 'API Error: Connection error.')?.kind, 'network');
assert.equal(classifyRuntimeError('opencode', 'fetch failed')?.kind, 'network');

// A13. Envelopes unwrapped; ordinary text untouched; nothing to say falls back to one plain sentence.
assert.equal(
  classifyRuntimeError('claude-code', 'API Error: 500 {"type":"error","error":{"type":"api_error","message":"Internal server error"}}')?.sentence,
  'Internal server error',
);
assert.equal(classifyRuntimeError('codex', '{"type":"error","status":500}')?.sentence, "ChatGPT couldn't finish this request.");
assert.equal(unwrapProviderMessage('The API returned invalid_request_error while I was reading.').sentence,
  'The API returned invalid_request_error while I was reading.', 'prose stays as it is');
assert.equal(unwrapProviderMessage('Error: boom\n    at Object.<anonymous> (/x.js:1:1)').sentence, 'Error: boom');
// AcpRuntime's describeAcpTurnError() keeps its one case; the classifier passes its sentence through.
assert.equal(classifyRuntimeError('opencode', 'No model is selected for OpenCode. Pick one in the model selector below the message box, then try again.')?.sentence,
  'No model is selected for OpenCode. Pick one in the model selector below the message box, then try again.');
assert.equal(classifyRuntimeError('codex', '   '), undefined);

// The runtimes' structured codes, read leniently.
assert.deepEqual(codexTurnErrorCode({ message: 'x', codexErrorInfo: 'unauthorized' }), { code: 'unauthorized' });
assert.deepEqual(codexTurnErrorCode({ message: 'x', codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } } }), { code: 'httpConnectionFailed', httpStatus: 502 });
assert.deepEqual(codexTurnErrorCode({ message: 'x', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } } }), { code: 'responseStreamDisconnected' });
assert.deepEqual(codexTurnErrorCode('plain string'), {});
assert.equal(acpTurnErrorCode({ code: -32603, message: 'Internal error: x', data: { errorName: 'ProviderModelNotFoundError' } }), 'ProviderModelNotFoundError');
assert.equal(acpTurnErrorCode({ code: -32000, message: 'provider authentication required' }), 'auth_required');
assert.equal(acpTurnErrorCode(new Error('x')), undefined);
console.log('runtimeErrorPresentation: Sprint 139 classifier corpus passes');

// ── Sprint 139 (R3–R5): the cards, from the kind and its data ──

assert.deepEqual(turnFailureCard({
  runtimeId: 'codex', kind: 'model', detail: { model: 'gpt-6.1-sol' }, sentence: '', names, fallbackModel: 'gpt-5.6-sol',
}), {
  title: "ChatGPT couldn't use GPT-6.1 Sol",
  message: "It isn't available in Ritemark right now. Switch to GPT-5.6 Sol, then send your message again.",
  action: {
    kind: 'use-model',
    label: 'Use GPT-5.6 Sol',
    tooltip: "Switch this chat to GPT-5.6 Sol. You'll need to send your message again.",
    modelId: 'gpt-5.6-sol',
  },
});
assert.deepEqual(turnFailureCard({
  runtimeId: 'codex', kind: 'model', detail: { model: 'gpt-5.6-sol' }, sentence: '', names, fallbackModel: 'gpt-5.6-sol',
}), {
  title: "ChatGPT couldn't use GPT-5.6 Sol",
  message: "It isn't available in Ritemark right now. Choose another model in the model menu below.",
}, 'the default is the model that failed: no button (S26)');
assert.equal(turnFailureCard({ runtimeId: 'opencode', kind: 'model', detail: { model: 'google/x' }, sentence: '' })?.action, undefined,
  'OpenCode has no catalog default, so no button (S28)');
assert.equal(turnFailureCard({
  runtimeId: 'codex', kind: 'model', detail: { model: 'gpt-6.1-sol' }, sentence: '', names, fallbackModel: 'gpt-5.6-sol', switchedTo: 'gpt-5.6-sol',
})?.message, "Switched to GPT-5.6 Sol — send your message again when you're ready.");
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'limit', detail: { billing: 'google', limit: 'credits' }, sentence: '' }), {
  title: 'Google stopped this request',
  message: 'Your Gemini API credits have run out. Add credits in Google AI Studio, then send your message again.',
}, 'an untrusted billing host gets words, not a button that would ask first (A3)');
assert.equal(turnFailureCard({ runtimeId: 'opencode', kind: 'limit', detail: { billing: 'anthropic', limit: 'credits' }, sentence: '' })?.action?.kind, 'open-billing');
assert.equal(trustedBillingUrl('anthropic'), 'https://console.anthropic.com/settings/billing');
assert.equal(trustedBillingUrl('google'), undefined);
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'plan', resetsAt: 'at 3:05 PM' }, sentence: '' }), {
  title: "You've used ChatGPT's limit for now",
  message: 'It resets at 3:05 PM.',
});
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: 'sign-in', sentence: 's' })?.action?.label, 'Sign in to ChatGPT');
assert.equal(turnFailureCard({ runtimeId: 'opencode', kind: 'sign-in', sentence: 's' })?.action?.kind, 'open-key-settings');
assert.equal(turnFailureCard({ runtimeId: 'claude-code', kind: 'sign-in', sentence: 's' }), null, "Claude's sign-in cards stay as they are");
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: 'network', sentence: 's' }), null, 'no connection: the sentence alone');
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: 'provider', sentence: 's' }), null);
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: undefined, sentence: 's' }), null, 'a 2.0 record: the sentence alone');

// The outcome counts (R8) come from the same kinds.
assert.equal(turnOutcome('completed', undefined), 'arrived');
assert.equal(turnOutcome('cancelled', 'network'), 'stopped');
assert.equal(turnOutcome('failed', 'sign-in'), 'sign_in');
assert.equal(turnOutcome('failed', 'provider'), 'provider_error');
assert.equal(turnOutcome('failed', undefined), 'other');

// Records: unknown kinds and details are dropped, never an error (E2).
assert.equal(isRuntimeErrorKind('plan'), false, 'no plan kind before audit A1');
assert.equal(isRuntimeErrorKind('model'), true);
assert.deepEqual(decodeRuntimeErrorDetail({ model: 'gpt-x', billing: 'aws', limit: 'tokens', resetsAt: 42, future: true }), { model: 'gpt-x' });
assert.equal(decodeRuntimeErrorDetail('nope'), undefined);
assert.equal(decodeRuntimeErrorDetail({ model: 'x'.repeat(300) }), undefined);
console.log('runtimeErrorPresentation: Sprint 139 card copy passes');
