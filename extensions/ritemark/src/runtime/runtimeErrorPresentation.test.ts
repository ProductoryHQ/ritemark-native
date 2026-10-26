import assert from 'node:assert/strict';
import {
  claudeUnavailableModel,
  acpTurnErrorCode,
  classifyClaudeAuthenticationError,
  classifyRuntimeError,
  codexTurnErrorCode,
  isClaudeAuthenticationError,
  presentRuntimeError,
  serviceRetryAt,
  standaloneClaudeAuthenticationError,
  standaloneClaudeOAuthExpirationError,
  unwrapProviderMessage,
} from './runtimeErrorPresentation';
import {
  continueWithAction,
  failureSentence,
  failureSilencesStatusLine,
  decodeRuntimeErrorDetail,
  isRuntimeErrorKind,
  retryingLine,
  retryingOffersAlternative,
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
  message: "Claude couldn't finish this request. Workspace unavailable. Send your message again.",
  errorKind: 'provider',
});

// Authentication copy must stay runtime-specific: another runtime using a
// similar phrase should keep its own recovery UX.
assert.deepEqual(presentRuntimeError('codex', rawOAuthError), {
  message: `ChatGPT couldn't finish this request. ${rawOAuthError}. Send your message again.`,
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
  "ChatGPT couldn't finish this request. not_found_error model: gpt-x. Send your message again.",
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
  sentence: 'Your ChatGPT sign-in has ended. Sign in, then send your message again.',
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
assert.equal(classifyRuntimeError('codex', "You've hit your usage limit. Try again later.")?.sentence,
  "You've used ChatGPT's limit for now. Try again later.");

// A5. ChatGPT: no connection only without an HTTP status; a server that answered is the provider's own error.
assert.equal(classifyRuntimeError('codex', 'stream disconnected before completion: error sending request', { code: 'responseStreamDisconnected' })?.kind, 'network');
assert.equal(classifyRuntimeError('codex', 'unexpected status 502 Bad Gateway', { code: 'httpConnectionFailed', httpStatus: 502 })?.kind, 'provider');
assert.equal(classifyRuntimeError('codex', 'error sending request for url (https://chatgpt.com/backend-api/codex/responses)')?.sentence,
  "Ritemark couldn't reach ChatGPT. Check your connection, then send your message again.");

// A6. OpenCode: Google's credits (seen 2026-10-24, Jarmo), through OpenCode's ACP wrapper.
const googleCredits = 'Internal error: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.';
assert.deepEqual(classifyRuntimeError('opencode', googleCredits, { turnModel: 'google/gemini-4-argon' }), {
  kind: 'limit',
  sentence: 'Google stopped this request. Your Gemini API credits have run out. Add credits in Google AI Studio, then send your message again.',
  detail: { billing: 'google', limit: 'credits' },
});
assert.equal(unwrapProviderMessage(googleCredits).sentence?.startsWith('Your prepayment credits'), true, 'the ACP wrapper is dropped');

// A7. OpenCode: an OpenAI key out of quota (documented `insufficient_quota` envelope).
assert.deepEqual(
  classifyRuntimeError('opencode', '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}', { turnModel: 'openai/gpt-5.6' }),
  { kind: 'limit', sentence: "OpenAI stopped this request. Your OpenAI API key has reached its quota. Check your plan and billing on OpenAI's platform, then send your message again.", detail: { billing: 'openai', limit: 'quota' } },
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
  sentence: "Claude couldn't finish this request. Your account cannot use this. Send your message again.",
});
// A9. OpenRouter's credits.
assert.equal(classifyRuntimeError('opencode', 'Insufficient credits. Add more using https://openrouter.ai/settings/credits', { turnModel: 'openrouter/qwen3' })?.detail?.billing, 'openrouter');

// A10. OpenCode: a model the provider doesn't serve, by OpenCode's error name, and by provider text.
assert.deepEqual(
  classifyRuntimeError('opencode', 'Internal error: Model not found: google/gemini-9-nope', { code: 'ProviderModelNotFoundError', turnModel: 'google/gemini-9-nope' }),
  { kind: 'model', sentence: "OpenCode couldn't use google/gemini-9-nope. It isn't available right now. Choose another model in the model menu, then send your message again.", detail: { model: 'google/gemini-9-nope' } },
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
  "Claude couldn't finish this request. Internal server error. Send your message again.",
  "anything else: the heading, the provider's sentence once, then the way on",
);
assert.equal(classifyRuntimeError('codex', '{"type":"error","status":500}')?.sentence,
  "ChatGPT couldn't finish this request. Send your message again.", 'with nothing to say, the heading is said once');
assert.equal(unwrapProviderMessage('The API returned invalid_request_error while I was reading.').sentence,
  'The API returned invalid_request_error while I was reading.', 'prose stays as it is');
assert.equal(unwrapProviderMessage('Error: boom\n    at Object.<anonymous> (/x.js:1:1)').sentence, 'Error: boom');
// AcpRuntime's describeAcpTurnError() keeps its one case; the classifier passes its sentence through.
assert.equal(classifyRuntimeError('opencode', 'No model is selected for OpenCode. Pick one in the model selector below the message box, then try again.')?.sentence,
  "OpenCode couldn't finish this request. No model is selected for OpenCode. Pick one in the model selector below the message box, then try again.",
  'words that already give a way on get no second one');
assert.equal(classifyRuntimeError('codex', '   '), undefined);
assert.equal(unwrapProviderMessage('{"error":"Model gpt-x is not available for this workspace."}').sentence,
  'Model gpt-x is not available for this workspace.', 'a plain {"error": "<text>"} body gives its text');
assert.equal(unwrapProviderMessage('{"error":"invalid_request_error"}').sentence, undefined, 'a bare code is not a sentence');
// A truncated envelope, however short, is a payload: never the sentence.
const truncated = '{"type":"error","error":{"message":"Oops it broke';
assert.equal(unwrapProviderMessage(truncated).sentence, undefined);
assert.equal(unwrapProviderMessage(`API Error: 500 ${truncated}`).sentence, undefined, 'after a short prefix too');
assert.equal(classifyRuntimeError('codex', truncated)?.sentence, "ChatGPT couldn't finish this request. Send your message again.");
assert.equal(unwrapProviderMessage('Use {name} in the template.').sentence, 'Use {name} in the template.', 'prose with a brace stays prose');
assert.equal(unwrapProviderMessage('{"error":"x y z","message":"The real sentence."}').sentence, 'The real sentence.', 'message wins');

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
  message: "It isn't available right now. Choose another model in the model menu, then send your message again.",
}, 'the default is the model that failed: no button (S26)');
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'model', detail: { model: 'google/x' }, sentence: '' }), {
  title: "OpenCode couldn't use google/x",
  message: "It isn't available right now. Choose another model in the model menu, then send your message again.",
}, 'OpenCode has no catalog default, so no button (S28)');
assert.deepEqual(turnFailureCard({
  runtimeId: 'codex', kind: 'model', detail: { model: 'gpt-6.1-sol' }, sentence: '', names, fallbackModel: 'gpt-5.6-sol', switchedTo: 'gpt-5.6-sol',
}), { title: 'Now using GPT-5.6 Sol', message: "Send your message again when you're ready.", done: true }, 'after the switch: the new model, with the check');
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'limit', detail: { billing: 'google', limit: 'credits' }, sentence: '' }), {
  title: 'Google stopped this request',
  message: 'Your Gemini API credits have run out. Add credits in Google AI Studio, then send your message again.',
}, 'an untrusted billing host gets words, not a button that would ask first (A3)');
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'limit', detail: { billing: 'openai', limit: 'quota' }, sentence: '' }), {
  title: 'OpenAI stopped this request',
  message: "Your OpenAI API key has reached its quota. Check your plan and billing on OpenAI's platform, then send your message again.",
}, 'each company names where to go');
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'limit', detail: { billing: 'anthropic', limit: 'credits' }, sentence: '' }), {
  title: 'Anthropic stopped this request',
  message: 'Your Anthropic API credits have run out. Add credits in the Claude Console, then send your message again.',
  action: { kind: 'open-billing', label: 'Open Claude Console', tooltip: 'Opens the Claude Console in your browser.', url: 'https://console.anthropic.com/settings/billing' },
});
assert.equal(trustedBillingUrl('anthropic'), 'https://console.anthropic.com/settings/billing');
assert.equal(trustedBillingUrl('google'), undefined);
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'plan', resetsAt: 'at 3:05 PM' }, sentence: '' }), {
  title: "You've used ChatGPT's limit for now",
  message: 'It resets at 3:05 PM.',
}, 'no other AI ready: no button');
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'plan' }, sentence: '', readyAlternative: 'claude-code' }), {
  title: "You've used ChatGPT's limit for now",
  message: 'Try again later.',
  action: { kind: 'use-runtime', label: 'Continue with Claude', tooltip: 'Continue this chat with Claude.', runtimeId: 'claude-code' },
}, 'another AI is ready: Continue with it, as the signed-out card does');
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'plan' }, sentence: '', readyAlternative: 'codex' })?.action, undefined,
  'never the same AI');
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'sign-in', sentence: 's' }), {
  title: 'ChatGPT needs you to sign in again',
  message: 'Your sign-in has ended. Sign in, then send your message again.',
  action: { kind: 'sign-in', label: 'Sign in to ChatGPT', tooltip: "Opens ChatGPT's sign-in page in your browser." },
});
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'sign-in', detail: { billing: 'google' }, sentence: 's' }), {
  title: "Google didn't accept the API key",
  message: 'Check it in AI Settings, then send your message again.',
  action: { kind: 'open-key-settings', label: 'Open AI Settings', tooltip: 'Opens Ritemark Settings, where your API keys are.' },
});
assert.equal(turnFailureCard({ runtimeId: 'opencode', kind: 'sign-in', sentence: 's' })?.title, 'OpenCode needs a working API key', 'the company when known');
assert.equal(failureSentence({ runtimeId: 'opencode', kind: 'sign-in', providerSentence: '' }),
  'OpenCode needs a working API key. Check it in AI Settings, then send your message again.');
assert.equal(turnFailureCard({ runtimeId: 'claude-code', kind: 'sign-in', sentence: 's' }), null, "Claude's sign-in cards stay as they are");
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'network', sentence: 's' }), {
  title: "Ritemark couldn't reach ChatGPT",
  message: 'Check your connection, then send your message again.',
});
const anythingElse = failureSentence({ runtimeId: 'codex', kind: 'provider', providerSentence: 'The server is busy' });
assert.equal(anythingElse, "ChatGPT couldn't finish this request. The server is busy. Send your message again.");
assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'provider', sentence: anythingElse }), {
  title: "ChatGPT couldn't finish this request",
  message: 'The server is busy. Send your message again.',
}, "the provider's sentence once, under the heading");
const exited = failureSentence({ runtimeId: 'opencode', kind: 'provider', detail: { exited: true }, providerSentence: '' });
assert.equal(exited, 'OpenCode stopped unexpectedly. Send your message again.');
assert.deepEqual(turnFailureCard({ runtimeId: 'opencode', kind: 'provider', detail: { exited: true }, sentence: exited }), {
  title: 'OpenCode stopped unexpectedly',
  message: 'Send your message again.',
});
assert.equal(turnFailureCard({ runtimeId: 'codex', kind: undefined, sentence: 's' }), null, 'a 2.0 record: the sentence alone');

// No em dash in any card or sentence, and never Codex.
for (const runtimeId of ['claude-code', 'codex', 'opencode'] as const) {
  for (const kind of ['sign-in', 'limit', 'model', 'network', 'provider'] as const) {
    for (const detail of [undefined, { model: 'm' }, { limit: 'plan' as const }, { billing: 'google' as const, limit: 'credits' as const }, { exited: true as const }]) {
      const sentence = failureSentence({ runtimeId, kind, detail, providerSentence: 'Their words.' });
      const card = turnFailureCard({ runtimeId, kind, detail, sentence, fallbackModel: 'f', switchedTo: kind === 'model' ? 'f' : undefined });
      const words = JSON.stringify({ sentence, card });
      assert.ok(!words.includes('\u2014'), `no em dash: ${words}`);
      assert.ok(!/codex/i.test(words), `never Codex: ${words}`);
    }
  }
}

// The status line says nothing under a card with a way on, and "Failed" under any other (R3).
assert.equal(failureSilencesStatusLine('codex', 'model'), true);
assert.equal(failureSilencesStatusLine('opencode', 'limit'), true);
assert.equal(failureSilencesStatusLine('codex', 'sign-in'), true);
assert.equal(failureSilencesStatusLine('claude-code', 'sign-in'), false, "Claude's sign-in card is AgentResponse's (by failureKind)");
assert.equal(failureSilencesStatusLine('claude-code', 'network'), false);
assert.equal(failureSilencesStatusLine('codex', 'provider'), false);
assert.equal(failureSilencesStatusLine('codex', undefined), false);

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
assert.deepEqual(decodeRuntimeErrorDetail({ exited: true }), { exited: true });
assert.equal(decodeRuntimeErrorDetail({ exited: 'yes' }), undefined);
assert.equal(decodeRuntimeErrorDetail({ model: 'x'.repeat(300) }), undefined);
console.log('runtimeErrorPresentation: Sprint 139 card copy passes');

// ── Sprint 143 (#544, R3a): the busy card and the waiting line (experience 13, ritemark-dev 0e6911f) ──
{
  // The final error the app-server gave after the retries against the local 429 endpoint.
  const final = { message: 'exceeded retry limit, last status: 429 Too Many Requests', codexErrorInfo: { responseTooManyFailedAttempts: { httpStatusCode: 429 } } };
  const hints = codexTurnErrorCode(final);
  assert.deepEqual(hints, { code: 'responseTooManyFailedAttempts', httpStatus: 429 });
  const busy = classifyRuntimeError('codex', final.message, hints);
  assert.equal(busy?.kind, 'limit');
  assert.deepEqual(busy?.detail, { limit: 'busy' });
  assert.equal(busy?.sentence, 'ChatGPT is busy right now. It turned this request away several times. Send your message again in a few minutes.');
  assert.doesNotMatch(busy?.sentence ?? '', /exceeded retry limit|429/);
  // Codex's own rate-limit variant, and a 429 on the stream, are busy too.
  assert.deepEqual(classifyRuntimeError('codex', 'Rate limit reached', { code: 'rateLimitExceeded' })?.detail, { limit: 'busy' });
  assert.deepEqual(classifyRuntimeError('codex', 'x', { code: 'responseStreamDisconnected', httpStatus: 429 })?.detail, { limit: 'busy' });
  // A plan's limit keeps its own card.
  assert.deepEqual(classifyRuntimeError('codex', "You've hit your usage limit. Try again later.", { code: 'usageLimitExceeded' })?.detail, { limit: 'plan' });
  // A time from the service.
  const at = classifyRuntimeError('codex', 'Rate limit reached. Please try again in 6m59s.', { code: 'rateLimitExceeded' })?.detail?.retryAt;
  assert.ok(at && Math.abs(Date.parse(at) - Date.now() - 419_000) < 5_000, 'six minutes fifty-nine from now');
  assert.equal(serviceRetryAt('Please try again in 420 seconds.', 0), new Date(420_000).toISOString());
  assert.equal(serviceRetryAt('try again in 7 minutes', 0), new Date(420_000).toISOString());
  assert.equal(serviceRetryAt('try again later', 0), undefined);
  // "at …": a time of day is the person's own (local), one already past is tomorrow's; a zone or a date is kept.
  {
    const now = new Date(2026, 9, 27, 14, 0, 0).getTime();
    assert.equal(serviceRetryAt('Rate limit reached. Please try again at 3:12 PM.', now), new Date(2026, 9, 27, 15, 12).toISOString());
    assert.equal(serviceRetryAt('try again at 15:12', now), new Date(2026, 9, 27, 15, 12).toISOString());
    assert.equal(serviceRetryAt('try again at 3pm', now), new Date(2026, 9, 27, 15, 0).toISOString());
    assert.equal(serviceRetryAt('try again at 3:12 p.m.', now), new Date(2026, 9, 27, 15, 12).toISOString());
    assert.equal(serviceRetryAt('try again at 12:05 AM', now), new Date(2026, 9, 28, 0, 5).toISOString(), 'past today: tomorrow');
    assert.equal(serviceRetryAt('try again at 9:30', now), new Date(2026, 9, 28, 9, 30).toISOString(), 'past today: tomorrow');
    assert.equal(serviceRetryAt('try again at 3', now), undefined, 'a number alone is not a time');
    assert.equal(serviceRetryAt('try again at 3 apples', now), undefined);
    assert.equal(serviceRetryAt('try again at 25:00', now), undefined);
    const utcNow = Date.UTC(2026, 9, 27, 12, 0, 0);
    assert.equal(serviceRetryAt('Please try again at 13:12 UTC.', utcNow), new Date(Date.UTC(2026, 9, 27, 13, 12)).toISOString());
    assert.equal(serviceRetryAt('try again at 2026-10-27T13:12:00Z', utcNow), '2026-10-27T13:12:00.000Z');
    assert.equal(serviceRetryAt('try again at 2026-10-25T13:12:00Z', utcNow), undefined, 'a time already gone');
    assert.equal(serviceRetryAt('try again at 2026-11-05T13:12:00Z', utcNow), undefined, 'more than a day away');
  }

  // The card: without a time, with one, with another AI ready; the status line says "Failed" under it.
  assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'busy' }, sentence: '' }), {
    title: 'ChatGPT is busy right now',
    message: 'It turned this request away several times. Send your message again in a few minutes.',
  });
  assert.equal(
    turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'busy', retryAt: '2026-10-27T13:12:00.000Z' }, sentence: '', formatTime: () => '3:12 PM' })?.message,
    'It turned this request away several times. Send your message again after 3:12 PM.',
  );
  assert.deepEqual(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'busy' }, sentence: '', readyAlternative: 'claude-code' })?.action, {
    kind: 'use-runtime',
    label: 'Continue with Claude',
    tooltip: 'Send your message to Claude instead.',
    runtimeId: 'claude-code',
    carryMessage: true,
  }, 'on the card nothing is waiting, so the tooltip says where the message goes');
  // On the waiting line the turn is still waiting: its tooltip says the wait stops.
  assert.deepEqual(continueWithAction('claude-code', 'waiting'), { label: 'Continue with Claude', tooltip: 'Stop waiting and continue this chat with Claude.' });
  assert.deepEqual(continueWithAction('opencode', 'card'), { label: 'Continue with OpenCode', tooltip: 'Send your message to OpenCode instead.' });
  assert.equal(turnFailureCard({ runtimeId: 'codex', kind: 'limit', detail: { limit: 'busy' }, sentence: '', readyAlternative: 'codex' })?.action, undefined, 'never the same AI');
  assert.equal(failureSilencesStatusLine('codex', 'limit', { limit: 'busy' }), false, '"Failed" under the busy card');
  assert.equal(failureSilencesStatusLine('codex', 'limit', { limit: 'plan' }), true, 'the plan card keeps the line silent');
  assert.deepEqual(decodeRuntimeErrorDetail({ limit: 'busy', retryAt: '2026-10-27T13:12:00.000Z' }), { limit: 'busy', retryAt: '2026-10-27T13:12:00.000Z' });
  assert.deepEqual(decodeRuntimeErrorDetail({ limit: 'busy', retryAt: 'soon' }), { limit: 'busy' });
  assert.equal(turnOutcome('failed', 'limit'), 'limit');

  // The waiting line counts down in whole minutes, rounded up; "in a minute" from one minute left; no seconds, no "…".
  assert.equal(retryingLine('codex', 419_000), 'ChatGPT is busy. Trying again in 7 minutes.');
  assert.equal(retryingLine('codex', 360_001), 'ChatGPT is busy. Trying again in 7 minutes.');
  assert.equal(retryingLine('codex', 360_000), 'ChatGPT is busy. Trying again in 6 minutes.');
  assert.equal(retryingLine('codex', 61_000), 'ChatGPT is busy. Trying again in 2 minutes.');
  assert.equal(retryingLine('codex', 60_000), 'ChatGPT is busy. Trying again in a minute.');
  assert.equal(retryingLine('codex', 0), 'ChatGPT is busy. Trying again in a minute.');
  assert.equal(retryingLine('codex', undefined), 'ChatGPT is busy. Trying again soon.', 'the length unknown');
  assert.equal(retryingLine('opencode', 120_000), 'OpenCode is busy. Trying again in 2 minutes.', "the AI's own name");
  for (const ms of [419_000, 60_000, undefined]) assert.doesNotMatch(retryingLine('codex', ms), /…|seconds| s\b|Codex/);
  // Continue with <AI> only while more than a minute is left.
  assert.equal(retryingOffersAlternative(419_000), true);
  assert.equal(retryingOffersAlternative(60_000), false);
  assert.equal(retryingOffersAlternative(undefined), false);
  console.log('runtimeErrorPresentation: Sprint 143 busy card and waiting line pass');
}
