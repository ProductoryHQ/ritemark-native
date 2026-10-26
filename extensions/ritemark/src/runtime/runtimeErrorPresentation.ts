import type { AgentId } from '../agent/types';
import {
  AI_NAMES,
  failureSentence,
  type BillingProvider,
  type ModelNames,
  type RuntimeErrorDetail,
  type RuntimeErrorKind,
} from './turnFailureCopy';

export type { RuntimeErrorDetail, RuntimeErrorKind } from './turnFailureCopy';

export type RuntimeFailureKind = 'authentication' | 'api-key-authentication';

export interface RuntimeErrorPresentation {
  message: string;
  failureKind?: RuntimeFailureKind;
}

const CLAUDE_AUTH_ERROR_PATTERNS = [
  /failed to authenticate/i,
  /oauth session expired/i,
  /oauth token has expired/i,
  /invalid authentication credentials/i,
  /not logged in.*(?:\/login|sign in)/i,
  /please run \/login/i,
];

const CLAUDE_STANDALONE_AUTH_ERROR_PATTERNS = [
  /^failed to authenticate:\s*.+$/i,
  /^oauth session expired(?:\s+and could not be refreshed)?[.!]?$/i,
  /^oauth token has expired[.!]?$/i,
  /^invalid authentication credentials[.!]?$/i,
  /^not logged in.*(?:\/login|sign in)[.!]?$/i,
  /^please run \/login[.!]?$/i,
];

export function isClaudeAuthenticationError(error: string | undefined): boolean {
  if (!error) return false;
  return CLAUDE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(error));
}

/**
 * Recognize a provider diagnostic only when the complete payload is the error.
 *
 * Claude's SDK can occasionally wrap an authentication failure in a nominally
 * successful result envelope. Keeping this matcher anchored and single-line
 * prevents a normal model answer that merely discusses an auth error from
 * being reclassified as a failed turn.
 */
export function standaloneClaudeAuthenticationError(text: string | undefined): string | undefined {
  const diagnostic = text?.trim();
  if (!diagnostic || diagnostic.length > 500 || /[\r\n]/.test(diagnostic)) return undefined;
  return CLAUDE_STANDALONE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(diagnostic))
    ? diagnostic
    : undefined;
}

/** Exact legacy RC shape whose auth method is unambiguously OAuth. */
export function standaloneClaudeOAuthExpirationError(text: string | undefined): string | undefined {
  const diagnostic = standaloneClaudeAuthenticationError(text);
  return diagnostic && /oauth (?:session|token) (?:has )?expired/i.test(diagnostic)
    ? diagnostic
    : undefined;
}

/**
 * Sprint 127 R6: the model a Claude failure says is unavailable — the CLI's own
 * wording (2.1.270) or the API's `not_found_error` — so the transcript can name
 * it instead of showing a raw diagnostic. The Ritemark runtime never passes a
 * `fallbackModel`, so the CLI does not silently switch models on this error.
 */
const CLAUDE_UNAVAILABLE_MODEL_PATTERNS = [
  /There's an issue with the selected model \(([^)\s]+)\)/i,
  /not_found_error[^\n]{0,200}?model:\s*([A-Za-z0-9._[\]-]+)/i,
  /([A-Za-z0-9._[\] -]{1,80}?) is not available\. Your organization restricts model selection/i,
  /((?:Opus|Sonnet|Haiku|Fable) with 1M context) is not available for your account/i,
];

export function claudeUnavailableModel(error: string | undefined): string | undefined {
  if (!error) return undefined;
  for (const pattern of CLAUDE_UNAVAILABLE_MODEL_PATTERNS) {
    const model = pattern.exec(error)?.[1]?.trim();
    if (model) return model;
  }
  return undefined;
}

export function classifyClaudeAuthenticationError(
  error: string | undefined,
  usesApiKey: boolean,
): RuntimeFailureKind | undefined {
  if (!isClaudeAuthenticationError(error)) return undefined;
  return usesApiKey ? 'api-key-authentication' : 'authentication';
}

// ── Sprint 139 (#376, R3–R5, E1): one classifier for all three AIs ──────────

/** The longest sentence a turn shows; a provider's text beyond it is cut at a word. */
const MAX_SENTENCE_CHARS = 500;

/** What the runtime knew besides the text. Structured codes win over any text match. */
export interface RuntimeErrorHints {
  /**
   * A structured error code: Claude's SDK error category (`rate_limit`,
   * `billing_error`, …), Codex's `codexErrorInfo` variant (`usageLimitExceeded`,
   * `unauthorized`, …), or OpenCode's ACP error name (`ProviderModelNotFoundError`).
   */
  code?: string;
  /** The HTTP status that came with the code, when the runtime gave one. */
  httpStatus?: number;
  /** The model the turn ran on (OpenCode: `provider/model`). */
  turnModel?: string;
  /** Claude: the turn ran with an API key, not a Claude.ai sign-in. */
  usesApiKey?: boolean;
  /** The catalog's model labels, for the sentence. */
  names?: ModelNames;
}

export interface ClassifiedRuntimeError {
  kind: RuntimeErrorKind;
  /** One sentence, unwrapped, never JSON. */
  sentence: string;
  /** Claude's two sign-in kinds, unchanged (records accept only these). */
  failureKind?: RuntimeFailureKind;
  detail?: RuntimeErrorDetail;
}

interface UnwrappedError {
  /** The human sentence the provider wrote, or undefined when there is none. */
  sentence: string | undefined;
  /** Every `type`, `code` and `status` value found in an envelope, lower-cased. */
  envelopeCodes: Set<string>;
}

function clampSentence(text: string, max = MAX_SENTENCE_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max);
  const stop = Math.max(window.lastIndexOf('. '), window.lastIndexOf(' '));
  return `${(stop > 40 ? window.slice(0, stop) : window).trimEnd()}…`;
}

function walkEnvelope(value: unknown, codes: Set<string>): string | null {
  let deepest: string | null = null;
  // `{"error": "<text>"}`: the text, when nothing nests a `message` or `detail`.
  let bareError: string | null = null;
  const walk = (node: unknown, depth: number): void => {
    if (depth > 6 || node === null || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'error' && typeof child === 'string' && child.trim() && !/^[a-z_]+$/.test(child.trim())) {
        bareError = child.trim();
      } else if ((key === 'message' || key === 'detail') && typeof child === 'string' && child.trim()) {
        deepest = child.trim();
      } else if ((key === 'type' || key === 'code' || key === 'status') && (typeof child === 'string' || typeof child === 'number')) {
        codes.add(String(child).toLowerCase());
      } else {
        walk(child, depth + 1);
      }
    }
  };
  walk(value, 0);
  return deepest ?? bareError;
}

/**
 * Dig the provider's own sentence out of whatever a runtime reported: a JSON
 * envelope (`{"type":"error","error":{"message":"…"}}`), the same envelope after
 * a short prefix (`API Error: 404 {…}`, `unexpected status 400: {…}`), or the
 * ACP wrapper OpenCode puts round a provider's text (`Internal error: …`).
 * A stack trace keeps its first line only.
 */
export function unwrapProviderMessage(raw: string | undefined): UnwrappedError {
  const envelopeCodes = new Set<string>();
  let text = (raw ?? '').trim();
  if (!text) return { sentence: undefined, envelopeCodes };
  // OpenCode's ACP `RequestError.internalError(data, message)` (bundled OpenCode, audit A2).
  text = text.replace(/^Internal error:\s+(?=\S)/i, '');

  const braceAt = text.search(/[[{]/);
  if (braceAt >= 0 && braceAt <= 60) {
    const prefix = text.slice(0, braceAt).trim();
    try {
      const parsed = JSON.parse(text.slice(braceAt));
      const inner = walkEnvelope(parsed, envelopeCodes);
      for (const status of prefix.match(/\b[45]\d\d\b/g) ?? []) envelopeCodes.add(status);
      if (inner) {
        // An envelope inside the envelope (a provider's body quoted in a message).
        const nested = inner.startsWith('{') ? unwrapProviderMessage(inner) : null;
        if (nested?.sentence) {
          for (const code of nested.envelopeCodes) envelopeCodes.add(code);
          return { sentence: nested.sentence, envelopeCodes };
        }
        return { sentence: clampSentence(inner), envelopeCodes };
      }
      return { sentence: undefined, envelopeCodes };
    } catch {
      // Not JSON after all. Text that starts like an envelope is a payload cut short
      // (`{"type":"error","error":{"message":"Oops it bro`), never a sentence.
      if (/^[[{]\s*["[{]/.test(text.slice(braceAt))) return { sentence: undefined, envelopeCodes };
      // Otherwise read it as text.
    }
  }

  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  if (!firstLine || /^\s*at\s/.test(firstLine)) return { sentence: undefined, envelopeCodes };
  // Braces and quote soup mean a payload, not prose.
  if (/[{}]/.test(firstLine) && firstLine.length > 120) return { sentence: undefined, envelopeCodes };
  return { sentence: clampSentence(firstLine), envelopeCodes };
}

/** The provider of an OpenCode model id (`google/gemini-…` → google). */
function billingProviderOfModel(model: string | undefined): BillingProvider | undefined {
  const vendor = model?.replace(/^opencode:/, '').split('/')[0]?.toLowerCase();
  return vendor === 'google' || vendor === 'openai' || vendor === 'anthropic' || vendor === 'openrouter'
    ? vendor
    : undefined;
}

/**
 * Model refusals, each from an error seen or read in the bundled runtime
 * (audit A2's corpus). The first capture group is the model.
 */
const MODEL_REFUSED_PATTERNS: Array<{ runtimes: AgentId[]; pattern: RegExp }> = [
  // Codex, #376 (seen 2026-10-01): the ChatGPT account can't run this model in Codex.
  { runtimes: ['codex'], pattern: /The '([^']{1,120})' model is not supported when using Codex/i },
  // Codex, seen in a comment task 2026-09-14: the bundled Codex is older than the model.
  { runtimes: ['codex'], pattern: /The '([^']{1,120})' model requires a newer version of Codex/i },
  // OpenCode's own ProviderModelNotFoundError text (bundled OpenCode, error.chain.modelNotFound).
  { runtimes: ['opencode'], pattern: /Model not found:\s*([\w./:@-]{1,160})/i },
  // Providers' documented model-not-found bodies, passed on by OpenCode.
  { runtimes: ['opencode'], pattern: /models\/([\w.-]{1,120}) is not found/i },
  { runtimes: ['opencode'], pattern: /The model `([^`]{1,120})` does not exist/i },
  { runtimes: ['opencode'], pattern: /([\w./:-]{1,160}) is not a valid model ID/i },
];

const KEY_REFUSED_PATTERNS: RegExp[] = [
  /provider authentication required/i, // OpenCode's ACPAuthRequiredError
  /API key not valid/i, // Google
  /Incorrect API key provided/i, // OpenAI
  /invalid x-api-key/i, // Anthropic
  /No auth credentials found/i, // OpenRouter
];

const CODEX_SIGN_IN_PATTERNS: RegExp[] = [
  // The bundled Codex's own words when its ChatGPT token can't be renewed.
  /access token could not be refreshed/i,
  /refresh token (?:has expired|was already used|was rejected)/i,
  /please (?:log out and )?sign in again/i,
];

// Words for "couldn't connect" in the runtimes and in Node, including OpenCode's own list of network failures.
const NETWORK_PATTERNS: RegExp[] = [
  /\b(?:ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ENETDOWN)\b/,
  /getaddrinfo/i,
  /^(?:API Error:\s*)?Connection error\.?$/i,
  /^fetch failed$/i,
  /error sending request for url/i,
  /network connection was lost|network request failed|failed to fetch/i,
];

const CODEX_NETWORK_CODES = new Set(['httpconnectionfailed', 'responsestreamconnectionfailed', 'responsestreamdisconnected']);

/** "try again at 3:05 PM." → "at 3:05 PM"; "resets 3pm (Europe/Tallinn)" → "at 3pm (Europe/Tallinn)". */
function resetClause(text: string): string | undefined {
  const tryAgain = /try again (at|in) ([^.\n]{1,48}?)(?:\.\s|\.$|$)/i.exec(text);
  if (tryAgain) return `${tryAgain[1].toLowerCase()} ${tryAgain[2].trim()}`;
  const resets = /\bresets? (at |in )?([^.·\n]{1,48}?)(?:[.·\n]|$)/i.exec(text);
  if (resets) return `${(resets[1] ?? 'at ').toLowerCase()}${resets[2].trim()}`;
  return undefined;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Sprint 143 (#544, R3a): when the service said to try again, as an ISO time, from its own words. Either
 * "in …" ("Please try again in 6m59s", "try again in 420 seconds", "in 7 minutes") or "at …" ("try again at
 * 3:12 PM", "at 15:12", "at 13:12 UTC", "at 2026-10-27T13:12:00Z"). A time of day with no zone is the
 * person's own; one already past is tomorrow's. Undefined when it didn't say, or said more than a day away.
 */
export function serviceRetryAt(text: string, now = Date.now()): string | undefined {
  return retryIn(text, now) ?? retryAtTime(text, now);
}

function retryIn(text: string, now: number): string | undefined {
  const match = /try again in\s+((?:\d+(?:\.\d+)?\s*(?:h|hours?|m|min|minutes?|s|sec|seconds?)\s*)+)/i.exec(text);
  if (!match) return undefined;
  let seconds = 0;
  for (const part of match[1].matchAll(/(\d+(?:\.\d+)?)\s*(h|hours?|m|min|minutes?|s|sec|seconds?)/gi)) {
    const value = Number(part[1]);
    const unit = part[2].toLowerCase();
    seconds += unit.startsWith('h') ? value * 3600 : unit.startsWith('m') ? value * 60 : value;
  }
  if (!(seconds > 0) || seconds > 24 * 3600) return undefined;
  return new Date(now + Math.ceil(seconds) * 1000).toISOString();
}

function retryAtTime(text: string, now: number): string | undefined {
  const iso = /try again (?:at|after)\s+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)/i.exec(text);
  if (iso) {
    const at = Date.parse(iso[1].replace(' ', 'T'));
    return Number.isFinite(at) && at > now && at - now <= DAY_MS ? new Date(at).toISOString() : undefined;
  }
  const clock = /try again (?:at|after)\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(?:([ap])\.?\s?m\b\.?)?\s*(UTC|GMT|Z\b)?/i.exec(text);
  if (!clock) return undefined;
  const [, h, m, s, half, utc] = clock;
  // "at 3" alone is not a time; "at 3pm" and "at 15:00" are.
  if (m === undefined && !half) return undefined;
  let hours = Number(h);
  const minutes = Number(m ?? 0);
  const seconds = Number(s ?? 0);
  if (half) {
    if (hours < 1 || hours > 12) return undefined;
    hours = (hours % 12) + (half.toLowerCase() === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
  const day = new Date(now);
  const on = (plusDays: number) => utc
    ? Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + plusDays, hours, minutes, seconds)
    : new Date(day.getFullYear(), day.getMonth(), day.getDate() + plusDays, hours, minutes, seconds).getTime();
  let at = on(0);
  if (at <= now) at = on(1);
  return at - now <= DAY_MS + 3600_000 ? new Date(at).toISOString() : undefined;
}

function finish(
  agentId: AgentId,
  kind: RuntimeErrorKind,
  providerSentence: string,
  hints: RuntimeErrorHints | undefined,
  detail?: RuntimeErrorDetail,
  failureKind?: RuntimeFailureKind,
): ClassifiedRuntimeError {
  const sentence = failureSentence({ runtimeId: agentId, kind, detail, providerSentence, names: hints?.names });
  return {
    kind,
    sentence,
    ...(failureKind ? { failureKind } : {}),
    ...(detail && Object.keys(detail).length > 0 ? { detail } : {}),
  };
}

/**
 * Turn a runtime's terminal error into a kind and one sentence. Only a turn's
 * terminal error ever reaches this — never an answer's text — so an answer that
 * talks about an error stays an answer.
 *
 * Order: a structured code from the runtime; then the provider's envelope,
 * unwrapped; then anchored matchers built from errors that were seen (audit A2);
 * else the provider's own sentence as kind `provider`. Anything unmatched still
 * shows once, unwrapped, never as JSON.
 */
export function classifyRuntimeError(
  agentId: AgentId,
  raw: string | undefined,
  hints?: RuntimeErrorHints & { failureKind?: RuntimeFailureKind },
): ClassifiedRuntimeError | undefined {
  if (!raw?.trim()) return undefined;
  const code = hints?.code?.trim().toLowerCase();
  const { sentence: unwrapped, envelopeCodes } = unwrapProviderMessage(raw);
  const name = AI_NAMES[agentId] ?? 'The AI';
  const providerSentence = unwrapped ?? `${name} couldn't finish this request.`;
  const haystack = `${unwrapped ?? ''}\n${raw}`;

  // 1. Claude's two sign-in kinds, as before (Sprint 127, v1.10.0 RC).
  if (agentId === 'claude-code') {
    const failureKind = hints?.failureKind
      ?? (code === 'authentication_failed' ? (hints?.usesApiKey ? 'api-key-authentication' : 'authentication') : undefined)
      ?? classifyClaudeAuthenticationError(raw, hints?.usesApiKey === true);
    if (failureKind === 'authentication') {
      return { kind: 'sign-in', sentence: 'Your Claude session has expired. Sign in again, then resend your message.', failureKind };
    }
    if (failureKind === 'api-key-authentication') {
      return { kind: 'sign-in', sentence: 'Claude did not accept your API key. Update it in AI Settings, then resend your message.', failureKind };
    }
  }

  // 2. Structured codes.
  if (agentId === 'claude-code' && code) {
    if (code === 'model_not_found') {
      const model = claudeUnavailableModel(raw) ?? hints?.turnModel;
      return finish(agentId, 'model', providerSentence, hints, model ? { model } : undefined);
    }
    if (code === 'rate_limit') {
      const resetsAt = resetClause(haystack);
      return finish(agentId, 'limit', providerSentence, hints, { limit: 'plan', ...(resetsAt ? { resetsAt } : {}) });
    }
    // With a Claude.ai sign-in, what a billing error means is audit A1's question (#496): no guess here.
    if (code === 'billing_error' && hints?.usesApiKey) {
      return finish(agentId, 'limit', providerSentence, hints, { billing: 'anthropic', limit: 'credits' });
    }
  }
  if (agentId === 'codex' && code) {
    if (code === 'unauthorized') return finish(agentId, 'sign-in', providerSentence, hints);
    if (code === 'usagelimitexceeded') {
      const resetsAt = resetClause(haystack);
      return finish(agentId, 'limit', providerSentence, hints, { limit: 'plan', ...(resetsAt ? { resetsAt } : {}) });
    }
    // Sprint 143 (#544, R3a): ChatGPT turned the request away (429) until Codex's retries ran out; not a plan limit.
    if (code === 'ratelimitexceeded'
      || ((code === 'responsetoomanyfailedattempts' || code === 'responsestreamdisconnected') && hints?.httpStatus === 429)) {
      const retryAt = serviceRetryAt(haystack);
      return finish(agentId, 'limit', providerSentence, hints, { limit: 'busy', ...(retryAt ? { retryAt } : {}) });
    }
    if (CODEX_NETWORK_CODES.has(code) && hints?.httpStatus === undefined) {
      return finish(agentId, 'network', providerSentence, hints);
    }
  }
  if (agentId === 'opencode' && code) {
    if (code === 'providermodelnotfounderror') {
      const model = MODEL_REFUSED_PATTERNS
        .filter((entry) => entry.runtimes.includes('opencode'))
        .map((entry) => entry.pattern.exec(haystack)?.[1])
        .find(Boolean) ?? hints?.turnModel;
      return finish(agentId, 'model', providerSentence, hints, model ? { model } : undefined);
    }
    if (code === 'providerautherror' || code === 'acpauthrequirederror' || code === 'auth_required') {
      const billing = billingProviderOfModel(hints?.turnModel);
      return finish(agentId, 'sign-in', providerSentence, hints, billing ? { billing } : undefined);
    }
  }

  // 3. Anchored matchers from the corpus.
  if (agentId === 'claude-code') {
    const unavailable = claudeUnavailableModel(raw);
    if (unavailable) return finish(agentId, 'model', providerSentence, hints, { model: unavailable });
  }
  for (const { runtimes, pattern } of MODEL_REFUSED_PATTERNS) {
    if (!runtimes.includes(agentId)) continue;
    const model = pattern.exec(haystack)?.[1]?.trim();
    if (model) return finish(agentId, 'model', providerSentence, hints, { model });
  }
  if (agentId === 'codex' && CODEX_SIGN_IN_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return finish(agentId, 'sign-in', providerSentence, hints);
  }
  if (agentId === 'codex' && /You've hit your usage limit/i.test(haystack)) {
    const resetsAt = resetClause(haystack);
    return finish(agentId, 'limit', providerSentence, hints, { limit: 'plan', ...(resetsAt ? { resetsAt } : {}) });
  }

  // Keys, credits and quotas: OpenCode's providers, and Claude with an API key.
  if (agentId === 'opencode' || (agentId === 'claude-code' && hints?.usesApiKey)) {
    const modelProvider = agentId === 'claude-code' ? 'anthropic' : billingProviderOfModel(hints?.turnModel);
    if (agentId === 'opencode' && KEY_REFUSED_PATTERNS.some((pattern) => pattern.test(haystack))) {
      return finish(agentId, 'sign-in', providerSentence, hints, modelProvider ? { billing: modelProvider } : undefined);
    }
    // Google, seen 2026-10-24 (Jarmo): "Your prepayment credits are depleted. Please go to AI Studio …".
    if (/prepayment credits are depleted/i.test(haystack)) {
      return finish(agentId, 'limit', providerSentence, hints, { billing: 'google', limit: 'credits' });
    }
    // Anthropic's documented billing error.
    if (/credit balance is too low/i.test(haystack)) {
      return finish(agentId, 'limit', providerSentence, hints, { billing: 'anthropic', limit: 'credits' });
    }
    // OpenRouter's documented 402.
    if ((modelProvider === 'openrouter' || /openrouter/i.test(haystack)) && /insufficient credits|requires more credits/i.test(haystack)) {
      return finish(agentId, 'limit', providerSentence, hints, { billing: 'openrouter', limit: 'credits' });
    }
    // OpenAI's `insufficient_quota`, and Google's and OpenAI's shared "exceeded your current quota".
    const quota = envelopeCodes.has('insufficient_quota') || /insufficient_quota/.test(raw)
      || /exceeded your current quota/i.test(haystack) || /RESOURCE_EXHAUSTED/.test(raw);
    if (quota) {
      const billing = /ai\.google\.dev|generativelanguage|gemini/i.test(haystack) || /RESOURCE_EXHAUSTED/.test(raw)
        ? 'google'
        : /platform\.openai\.com|insufficient_quota/i.test(haystack)
          ? 'openai'
          : modelProvider;
      if (billing) return finish(agentId, 'limit', providerSentence, hints, { billing, limit: 'quota' });
    }
  }

  if (NETWORK_PATTERNS.some((pattern) => pattern.test(unwrapped ?? raw.trim()))) {
    return finish(agentId, 'network', providerSentence, hints);
  }

  // 4. Anything else: the provider's own sentence.
  return finish(agentId, 'provider', providerSentence, hints);
}

export interface RuntimeErrorPresentationV2 extends RuntimeErrorPresentation {
  errorKind?: RuntimeErrorKind;
  errorDetail?: RuntimeErrorDetail;
}

/**
 * Convert provider/runtime failures into stable user-facing categories.
 *
 * The raw provider error remains in the turn's activity trace for diagnostics;
 * the transcript gets one sentence that says what happened and what to do.
 */
export function presentRuntimeError(
  agentId: AgentId,
  error: string | undefined,
  failureKind?: RuntimeFailureKind,
  hints?: RuntimeErrorHints,
): RuntimeErrorPresentationV2 | undefined {
  const classified = classifyRuntimeError(agentId, error, { ...hints, failureKind });
  if (!classified) return undefined;
  return {
    message: classified.sentence,
    ...(classified.failureKind ? { failureKind: classified.failureKind } : {}),
    errorKind: classified.kind,
    ...(classified.detail ? { errorDetail: classified.detail } : {}),
  };
}

/**
 * Sprint 139 (E1): the structured part of a Codex turn error. The bundled
 * app-server's `TurnError` carries `codexErrorInfo` beside `message`: a plain
 * variant (`"unauthorized"`, `"usageLimitExceeded"`, …) or one with data
 * (`{ "httpConnectionFailed": { "httpStatusCode": 502 } }`). Read leniently: a
 * shape this build doesn't know gives no code, and the text still classifies.
 */
export function codexTurnErrorCode(error: unknown): { code?: string; httpStatus?: number } {
  if (!error || typeof error !== 'object') return {};
  const info = (error as { codexErrorInfo?: unknown }).codexErrorInfo;
  if (typeof info === 'string' && info.trim()) return { code: info.trim() };
  if (info && typeof info === 'object' && !Array.isArray(info)) {
    const [variant, data] = Object.entries(info as Record<string, unknown>)[0] ?? [];
    if (!variant) return {};
    const status = data && typeof data === 'object' ? (data as { httpStatusCode?: unknown }).httpStatusCode : undefined;
    return {
      code: variant,
      ...(typeof status === 'number' && Number.isFinite(status) ? { httpStatus: status } : {}),
    };
  }
  return {};
}

/**
 * Sprint 139 (E1): what OpenCode's ACP error says besides its text. The bundled
 * OpenCode answers a provider failure with `RequestError.internalError({ errorName }, message)`
 * and a missing or refused key with `authRequired` (JSON-RPC -32000). The
 * classifier reads the name before any text.
 */
export function acpTurnErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const { code, data } = err as { code?: unknown; data?: unknown };
  const errorName = data && typeof data === 'object' ? (data as { errorName?: unknown }).errorName : undefined;
  if (typeof errorName === 'string' && errorName.trim()) return errorName.trim();
  if (code === -32000) return 'auth_required';
  return undefined;
}
