/**
 * Sprint 139 (#376, R3–R5): what a failed turn says, for all three AIs.
 *
 * Pure, with no `vscode` import: the host builds the turn's one sentence from
 * it (the conversation record, comment tasks and task cards keep that
 * sentence), and the AI sheet builds the turn's card from the same data, live
 * and after a restart. The classifier that decides the kind lives in
 * `runtimeErrorPresentation.ts`.
 *
 * People's names only: Claude, ChatGPT, OpenCode. Never Codex.
 */

import type { AgentId } from '../agent/types';
import type { TurnOutcome } from '../analytics/events';

/**
 * The kinds of failure Ritemark tells apart. Stored as `errorKind` on a failed
 * conversation event, beside the sentence. A value an older or newer build
 * doesn't know is dropped when read, never a reason to quarantine the chat.
 *
 * There is no plan refusal kind yet: Claude's refusal for a free plan is
 * matched only once a Claude Free account has been tried (#496, audit A1).
 */
export type RuntimeErrorKind = 'sign-in' | 'limit' | 'model' | 'network' | 'provider';

export const RUNTIME_ERROR_KINDS: readonly RuntimeErrorKind[] = ['sign-in', 'limit', 'model', 'network', 'provider'];

export function isRuntimeErrorKind(value: unknown): value is RuntimeErrorKind {
  return typeof value === 'string' && (RUNTIME_ERROR_KINDS as readonly string[]).includes(value);
}

/** The companies whose API keys OpenCode (or Claude, with a key) runs on. */
export type BillingProvider = 'google' | 'openai' | 'anthropic' | 'openrouter';

const BILLING_PROVIDERS: readonly BillingProvider[] = ['google', 'openai', 'anthropic', 'openrouter'];

/**
 * What ran out: a key's prepaid credits, a key's quota, or a plan's usage limit; or (Sprint 143, #544)
 * `busy`: the provider turned the request away (429) until Codex's retries ran out, which isn't a plan limit.
 */
export type LimitKind = 'credits' | 'quota' | 'plan' | 'busy';

const LIMIT_KINDS: readonly LimitKind[] = ['credits', 'quota', 'plan', 'busy'];

/** What a card needs beyond the kind. Every field is optional and checked when read. */
export interface RuntimeErrorDetail {
  /** `model`: the model id the AI refused. */
  model?: string;
  /** `limit`: whose key ran out; `sign-in` on OpenCode: whose key was refused. */
  billing?: BillingProvider;
  /** `limit`: what ran out. */
  limit?: LimitKind;
  /** `limit` on a plan: when it resets, in the AI's own words ("at 3:05 PM", "in 2 hours"). */
  resetsAt?: string;
  /** `limit`, `busy`: when the service said to try again (ISO time), written in the person's own time format. */
  retryAt?: string;
  /** `provider`: the AI's process ended mid-turn, so the card says it stopped. */
  exited?: true;
}

const MAX_DETAIL_TEXT = 256;

/** Keep only the detail fields this build knows, with values of the right shape. */
export function decodeRuntimeErrorDetail(value: unknown): RuntimeErrorDetail | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const detail: RuntimeErrorDetail = {};
  if (typeof input.model === 'string' && input.model.trim() && input.model.length <= MAX_DETAIL_TEXT) detail.model = input.model;
  if (typeof input.billing === 'string' && (BILLING_PROVIDERS as readonly string[]).includes(input.billing)) {
    detail.billing = input.billing as BillingProvider;
  }
  if (typeof input.limit === 'string' && (LIMIT_KINDS as readonly string[]).includes(input.limit)) detail.limit = input.limit as LimitKind;
  if (typeof input.resetsAt === 'string' && input.resetsAt.trim() && input.resetsAt.length <= 64) detail.resetsAt = input.resetsAt.trim();
  if (typeof input.retryAt === 'string' && input.retryAt.length <= 64 && Number.isFinite(Date.parse(input.retryAt))) detail.retryAt = input.retryAt;
  if (input.exited === true) detail.exited = true;
  return Object.keys(detail).length > 0 ? detail : undefined;
}

/** The names people know the three AIs by. */
export const AI_NAMES: Record<AgentId, string> = {
  'claude-code': 'Claude',
  codex: 'ChatGPT',
  opencode: 'OpenCode',
};

export function aiName(runtimeId: string): string {
  return AI_NAMES[runtimeId as AgentId] ?? 'The AI';
}

interface BillingPage {
  /** Who stopped the request. */
  company: string;
  /** What the credits or quota belong to. */
  product: string;
  /** The page's name, for a button's tooltip. */
  place: string;
  /** Where to go, in words, before ", then send your message again." */
  wayOn: string;
  /** The page itself. */
  url: string;
  /**
   * A trusted link domain in `branding/product.json` opens with no question
   * first, so it gets a button. Any other host would make VS Code ask "Do you
   * want Ritemark to open the external website?" (audit A3), so the card names
   * the place in words instead.
   */
  trusted: boolean;
  /** The button's label, for a trusted page. */
  buttonLabel?: string;
}

export const BILLING_PAGES: Record<BillingProvider, BillingPage> = {
  google: {
    company: 'Google',
    product: 'Gemini API',
    place: 'Google AI Studio',
    wayOn: 'Add credits in Google AI Studio',
    url: 'https://aistudio.google.com/',
    trusted: false,
  },
  openai: {
    company: 'OpenAI',
    product: 'OpenAI API',
    place: "OpenAI's platform",
    wayOn: "Check your plan and billing on OpenAI's platform",
    url: 'https://platform.openai.com/settings/organization/billing',
    trusted: false,
  },
  anthropic: {
    company: 'Anthropic',
    product: 'Anthropic API',
    place: 'the Claude Console',
    wayOn: 'Add credits in the Claude Console',
    url: 'https://console.anthropic.com/settings/billing',
    trusted: true,
    buttonLabel: 'Open Claude Console',
  },
  openrouter: {
    company: 'OpenRouter',
    product: 'OpenRouter',
    place: "OpenRouter's credits page",
    wayOn: "Add credits on OpenRouter's credits page",
    url: 'https://openrouter.ai/settings/credits',
    trusted: false,
  },
};

/** The billing page a card may open: only a trusted one, so it opens with no question. */
export function trustedBillingUrl(provider: string): string | undefined {
  const page = BILLING_PAGES[provider as BillingProvider];
  return page?.trusted ? page.url : undefined;
}

/** Inputs the copy needs that only the catalog knows. */
export interface ModelNames {
  /** The model's label in the catalog ("GPT-6.1 Sol"), or undefined when it isn't listed. */
  label(modelId: string): string | undefined;
}

function modelLabel(names: ModelNames | undefined, modelId: string): string {
  return names?.label(modelId) ?? modelId;
}

/** "Your Gemini API credits have run out", or undefined when the company isn't known. */
function limitReason(detail: RuntimeErrorDetail): string | undefined {
  const page = detail.billing ? BILLING_PAGES[detail.billing] : undefined;
  if (!page) return undefined;
  return detail.limit === 'quota'
    ? `Your ${page.product} key has reached its quota`
    : `Your ${page.product} credits have run out`;
}

/** The words of a card with no button for a model: the person picks one. */
const CHOOSE_ANOTHER_MODEL = "It isn't available right now. Choose another model in the model menu, then send your message again.";
const SEND_AGAIN = 'Send your message again.';

/** The heading of a key the provider refused, by company when known. */
function keyRefusedTitle(detail: RuntimeErrorDetail): string {
  return detail.billing ? `${BILLING_PAGES[detail.billing].company} didn't accept the API key` : 'OpenCode needs a working API key';
}

function couldNotFinish(name: string): string {
  return `${name} couldn't finish this request`;
}

function stoppedUnexpectedly(name: string): string {
  return `${name} stopped unexpectedly`;
}

// ── Sprint 143 (#544, R3a): the AI waiting to try again, and the busy card (experience 13, ritemark-dev 0e6911f) ──

function busyTitle(name: string): string {
  return `${name} is busy right now`;
}

const BUSY_BODY = 'It turned this request away several times. Send your message again in a few minutes.';

/** A time of day in the person's own format, with no seconds ("3:12 PM", "15:12"): the locale's short time. */
export function personTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
}

/**
 * The status line while the AI waits to try again after the provider turned the request away: the
 * minutes count down, rounded up; from one minute left "in a minute"; no seconds and no "…". Without the
 * wait's length (a person's own `RUST_LOG`, a Codex that logs it differently), "soon".
 */
export function retryingLine(runtimeId: AgentId, msLeft: number | undefined): string {
  const name = aiName(runtimeId);
  if (msLeft === undefined) return `${name} is busy. Trying again soon.`;
  if (msLeft <= 60_000) return `${name} is busy. Trying again in a minute.`;
  return `${name} is busy. Trying again in ${Math.ceil(msLeft / 60_000)} minutes.`;
}

/** "Continue with Claude" ends the line only while more than a minute is left (R3a). */
export function retryingOffersAlternative(msLeft: number | undefined): boolean {
  return msLeft !== undefined && msLeft > 60_000;
}

/**
 * Continue with <AI>, on the waiting line and on the busy card: it switches this chat and carries the message
 * over. On the line the turn is still waiting, so its tooltip says the wait stops; on the card nothing is
 * waiting any more, so it says where the message goes.
 */
export function continueWithAction(alternative: AgentId, where: 'waiting' | 'card'): { label: string; tooltip: string } {
  const other = aiName(alternative);
  return {
    label: `Continue with ${other}`,
    tooltip: where === 'waiting'
      ? `Stop waiting and continue this chat with ${other}.`
      : `Send your message to ${other} instead.`,
  };
}

/** The provider's own sentence, ending in a stop, or '' when it is only our fallback. */
function providerWords(name: string, providerSentence: string): string {
  const said = providerSentence.trim();
  if (!said || said === `${couldNotFinish(name)}.`) return '';
  return /[.!?]$/.test(said) ? said : `${said}.`;
}

/** The provider's sentence once, then the way on, unless its last words already give one. */
function withSendAgain(said: string): string {
  if (!said) return SEND_AGAIN;
  return /(send your message again|try again(?: later)?)\.$/i.test(said) ? said : `${said} ${SEND_AGAIN}`;
}

/**
 * The turn's one sentence, as the transcript shows it when there is no card
 * and as the conversation record, comment tasks and task cards keep it.
 * `providerSentence` is the provider's own sentence, unwrapped, for the kinds
 * that use it. Each sentence is its card's heading and body, so the words read
 * the same with or without the card.
 */
export function failureSentence(input: {
  runtimeId: AgentId;
  kind: RuntimeErrorKind;
  detail?: RuntimeErrorDetail;
  providerSentence: string;
  names?: ModelNames;
}): string {
  const name = aiName(input.runtimeId);
  const detail = input.detail ?? {};
  switch (input.kind) {
    case 'sign-in':
      if (input.runtimeId === 'codex') return 'Your ChatGPT sign-in has ended. Sign in, then send your message again.';
      if (input.runtimeId === 'opencode') return `${keyRefusedTitle(detail)}. Check it in AI Settings, then send your message again.`;
      return input.providerSentence;
    case 'model': {
      const failed = detail.model ? modelLabel(input.names, detail.model) : 'the chosen model';
      return input.runtimeId === 'opencode'
        ? `${name} couldn't use ${failed}. ${CHOOSE_ANOTHER_MODEL}`
        : `${name} couldn't use ${failed}. It isn't available in Ritemark right now.`;
    }
    case 'limit': {
      if (detail.limit === 'plan') {
        return `You've used ${name}'s limit for now. ${detail.resetsAt ? `It resets ${detail.resetsAt}.` : 'Try again later.'}`;
      }
      if (detail.limit === 'busy') return `${busyTitle(name)}. ${BUSY_BODY}`;
      const reason = limitReason(detail);
      return reason && detail.billing
        ? `${BILLING_PAGES[detail.billing].company} stopped this request. ${reason}. ${BILLING_PAGES[detail.billing].wayOn}, then send your message again.`
        : input.providerSentence;
    }
    case 'network':
      return `Ritemark couldn't reach ${name}. Check your connection, then send your message again.`;
    case 'provider':
    default:
      if (detail.exited) return `${stoppedUnexpectedly(name)}. ${SEND_AGAIN}`;
      return `${couldNotFinish(name)}. ${withSendAgain(providerWords(name, input.providerSentence))}`;
  }
}

/** One way on, for a card's single button. */
export type TurnFailureAction =
  | { kind: 'sign-in'; label: string; tooltip: string }
  | { kind: 'open-key-settings'; label: string; tooltip: string }
  | { kind: 'use-model'; label: string; tooltip: string; modelId: string }
  /** `carryMessage` (Sprint 143, the busy card): the failed message goes back in the box after the switch. */
  | { kind: 'use-runtime'; label: string; tooltip: string; runtimeId: AgentId; carryMessage?: true }
  | { kind: 'open-billing'; label: string; tooltip: string; url: string };

export interface TurnFailureCardCopy {
  title: string;
  message: string;
  action?: TurnFailureAction;
  /** The card says the way on was taken (the model switch), with the green check. */
  done?: true;
}

/**
 * The card a failed turn shows in place of the red line, or null when there
 * is no kind to draw it from (a chat saved by 2.0, or Claude's sign-in, whose
 * cards go by `failureKind`).
 *
 * `fallbackModel` is the catalog's default for this AI. `switchedTo` is set
 * once the person took the model card's switch, so the card says so.
 * `readyAlternative` is another AI that is ready now, for the plan limit's
 * Continue with, as the signed-out card's Use ChatGPT.
 */
export function turnFailureCard(input: {
  runtimeId: AgentId;
  kind: RuntimeErrorKind | undefined;
  detail?: RuntimeErrorDetail;
  sentence: string;
  names?: ModelNames;
  fallbackModel?: string;
  switchedTo?: string;
  readyAlternative?: AgentId;
  /** Sprint 143: how a time of day is written; the person's own format by default (tests pass a fixed one). */
  formatTime?: (iso: string) => string;
}): TurnFailureCardCopy | null {
  const name = aiName(input.runtimeId);
  const detail = input.detail ?? {};
  switch (input.kind) {
    case 'sign-in':
      if (input.runtimeId === 'codex') {
        return {
          title: 'ChatGPT needs you to sign in again',
          message: 'Your sign-in has ended. Sign in, then send your message again.',
          action: { kind: 'sign-in', label: 'Sign in to ChatGPT', tooltip: "Opens ChatGPT's sign-in page in your browser." },
        };
      }
      if (input.runtimeId === 'opencode') {
        return {
          title: keyRefusedTitle(detail),
          message: 'Check it in AI Settings, then send your message again.',
          action: { kind: 'open-key-settings', label: 'Open AI Settings', tooltip: 'Opens Ritemark Settings, where your API keys are.' },
        };
      }
      // Claude's sign-in cards stay as they are (by `failureKind`).
      return null;
    case 'model': {
      const failed = detail.model;
      if (input.switchedTo) {
        return { title: `Now using ${modelLabel(input.names, input.switchedTo)}`, message: "Send your message again when you're ready.", done: true };
      }
      const title = failed ? `${name} couldn't use ${modelLabel(input.names, failed)}` : `${name} couldn't use the chosen model`;
      const fallback = input.fallbackModel && input.fallbackModel !== failed ? input.fallbackModel : undefined;
      if (!fallback) return { title, message: CHOOSE_ANOTHER_MODEL };
      const fallbackLabel = modelLabel(input.names, fallback);
      return {
        title,
        message: `It isn't available in Ritemark right now. Switch to ${fallbackLabel}, then send your message again.`,
        action: {
          kind: 'use-model',
          label: `Use ${fallbackLabel}`,
          tooltip: `Switch this chat to ${fallbackLabel}. You'll need to send your message again.`,
          modelId: fallback,
        },
      };
    }
    case 'limit': {
      if (detail.limit === 'busy') {
        // Sprint 143 (#544, R3a): the retries ended in a 429 that isn't a plan limit.
        const alternative = input.readyAlternative && input.readyAlternative !== input.runtimeId ? input.readyAlternative : undefined;
        return {
          title: busyTitle(name),
          message: detail.retryAt
            ? `It turned this request away several times. Send your message again after ${(input.formatTime ?? personTime)(detail.retryAt)}.`
            : BUSY_BODY,
          ...(alternative ? { action: { kind: 'use-runtime' as const, ...continueWithAction(alternative, 'card'), runtimeId: alternative, carryMessage: true } } : {}),
        };
      }
      if (detail.limit === 'plan') {
        const alternative = input.readyAlternative && input.readyAlternative !== input.runtimeId ? input.readyAlternative : undefined;
        return {
          title: `You've used ${name}'s limit for now`,
          message: detail.resetsAt ? `It resets ${detail.resetsAt}.` : 'Try again later.',
          ...(alternative ? {
            action: {
              kind: 'use-runtime' as const,
              label: `Continue with ${aiName(alternative)}`,
              tooltip: `Continue this chat with ${aiName(alternative)}.`,
              runtimeId: alternative,
            },
          } : {}),
        };
      }
      const page = detail.billing ? BILLING_PAGES[detail.billing] : undefined;
      const reason = limitReason(detail);
      if (!page || !reason) return { title: `${name} stopped this request`, message: input.sentence };
      const message = `${reason}. ${page.wayOn}, then send your message again.`;
      if (page.trusted && page.buttonLabel) {
        return {
          title: `${page.company} stopped this request`,
          message,
          action: { kind: 'open-billing', label: page.buttonLabel, tooltip: `Opens ${page.place} in your browser.`, url: page.url },
        };
      }
      return { title: `${page.company} stopped this request`, message };
    }
    case 'network':
      return { title: `Ritemark couldn't reach ${name}`, message: 'Check your connection, then send your message again.' };
    case 'provider': {
      if (detail.exited) return { title: stoppedUnexpectedly(name), message: SEND_AGAIN };
      // The record keeps "<AI> couldn't finish this request. <their words> Send your message again.";
      // the card's heading is the first part, its body the rest.
      const heading = `${couldNotFinish(name)}. `;
      const body = input.sentence.startsWith(heading) ? input.sentence.slice(heading.length) : withSendAgain(providerWords(name, input.sentence));
      return { title: couldNotFinish(name), message: body };
    }
    default:
      return null;
  }
}

/**
 * Sprint 139 (R3): under a card with a way on (sign-in, model, limit), the
 * status line says nothing. Under any other failed turn it says "Failed".
 */
export function failureSilencesStatusLine(runtimeId: AgentId, kind: RuntimeErrorKind | undefined, detail?: RuntimeErrorDetail): boolean {
  if (kind !== 'sign-in' && kind !== 'model' && kind !== 'limit') return false;
  // Sprint 143 (#544, R3a): under the busy card the status line says "Failed".
  if (kind === 'limit' && detail?.limit === 'busy') return false;
  return turnFailureCard({ runtimeId, kind, sentence: '' }) !== null;
}

/** Sprint 139 (R8): a turn's outcome, as `first_reply` and `agent_used` name it. */
export type { TurnOutcome } from '../analytics/events';

export function turnOutcome(status: 'completed' | 'failed' | 'cancelled', kind: RuntimeErrorKind | undefined): TurnOutcome {
  if (status === 'completed') return 'arrived';
  if (status === 'cancelled') return 'stopped';
  switch (kind) {
    case 'sign-in': return 'sign_in';
    case 'limit': return 'limit';
    case 'model': return 'model';
    case 'network': return 'network';
    case 'provider': return 'provider_error';
    default: return 'other';
  }
}
