/**
 * A Flow's Gemini LLM step: what Google's answer means (Sprint 141, R5).
 *
 * Pure, so it unit-tests without vscode. `LLMNodeExecutor` calls it for the
 * response it got back.
 */

import { isGoogleModelRefusal, unwrapProviderMessage } from '../../runtime/runtimeErrorPresentation';

/**
 * A step failure whose message is already the sentence a person should read. The
 * LLM step passes it through as it is, without its "LLM error:" prefix.
 */
export class FlowStepError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = 'FlowStepError';
  }
}

/** R5: Google refused the step's model. */
export function modelRefusedSentence(modelLabel: string): string {
  return `Google doesn't offer ${modelLabel} to this API key. Choose another model in this step, then run the Flow again.`;
}

/** R5, revised after A2: thinking used the whole output budget, and no text came back. */
export const MAX_TOKENS_SENTENCE =
  "The answer used up this step's Max tokens before any text came back. Raise Max tokens in this step, then run the Flow again.";

/**
 * The error a failed Gemini call becomes. A refused model gets R5's sentence; any
 * other error keeps Google's own message, unwrapped, once (the step's existing key,
 * quota and rate-limit wording applies to it as before).
 */
export function geminiStepFailure(input: { status: number; body: unknown; model: string; modelLabel: string }): Error {
  const raw = JSON.stringify(input.body ?? {});
  if (isGoogleModelRefusal(input.status, input.body, input.model)) {
    return new FlowStepError(modelRefusedSentence(input.modelLabel), raw);
  }
  const message = (input.body as { error?: { message?: unknown } } | undefined)?.error?.message;
  const sentence = typeof message === 'string' ? unwrapProviderMessage(message).sentence ?? message : undefined;
  return new Error(sentence || `Gemini API error: ${input.status}`);
}

interface GeminiCandidate {
  finishReason?: unknown;
  content?: { parts?: Array<{ text?: unknown; thought?: unknown }> };
}

/**
 * The answer's text. Thought parts are skipped. With no text, an answer that
 * stopped at `MAX_TOKENS` says so; anything else is "No response".
 */
export function geminiAnswerText(result: unknown): string {
  const candidate = (result as { candidates?: GeminiCandidate[] } | undefined)?.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
  if (text) return text;
  if (candidate?.finishReason === 'MAX_TOKENS') throw new FlowStepError(MAX_TOKENS_SENTENCE);
  throw new Error('No response from Gemini API');
}
