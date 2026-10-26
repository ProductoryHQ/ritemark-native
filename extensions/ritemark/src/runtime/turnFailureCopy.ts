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

/** What ran out: a key's prepaid credits, a key's quota, or a plan's usage limit. */
export type LimitKind = 'credits' | 'quota' | 'plan';

const LIMIT_KINDS: readonly LimitKind[] = ['credits', 'quota', 'plan'];

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
  /** Where the person adds credits, for the words when there is no button. */
  place: string;
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
    url: 'https://aistudio.google.com/',
    trusted: false,
  },
  openai: {
    company: 'OpenAI',
    product: 'OpenAI API',
    place: "OpenAI's billing settings",
    url: 'https://platform.openai.com/settings/organization/billing',
    trusted: false,
  },
  anthropic: {
    company: 'Anthropic',
    product: 'Anthropic API',
    place: 'the Claude Console',
    url: 'https://console.anthropic.com/settings/billing',
    trusted: true,
    buttonLabel: 'Open Claude Console',
  },
  openrouter: {
    company: 'OpenRouter',
    product: 'OpenRouter',
    place: "OpenRouter's credits page",
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

function limitReason(detail: RuntimeErrorDetail): string | undefined {
  const page = detail.billing ? BILLING_PAGES[detail.billing] : undefined;
  if (!page) return undefined;
  return detail.limit === 'quota'
    ? `your ${page.product} key has reached its quota`
    : `your ${page.product} credits have run out`;
}

/**
 * The turn's one sentence, as the transcript shows it when there is no card
 * and as the conversation record keeps it. `providerSentence` is the
 * provider's own sentence, unwrapped, for the kinds that use it.
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
      if (input.runtimeId === 'codex') return 'Your ChatGPT sign-in has ended. Sign in again, then send your message again.';
      if (input.runtimeId === 'opencode') {
        const company = detail.billing ? BILLING_PAGES[detail.billing].company : "OpenCode's provider";
        return `${company} didn't accept the API key. Check it in AI Settings, then send your message again.`;
      }
      return input.providerSentence;
    case 'model':
      return detail.model
        ? `${name} couldn't use ${modelLabel(input.names, detail.model)}. It isn't available in Ritemark right now.`
        : `${name} couldn't use the chosen model. It isn't available in Ritemark right now.`;
    case 'limit': {
      if (detail.limit === 'plan') {
        return `You've used ${name}'s limit for now.${detail.resetsAt ? ` It resets ${detail.resetsAt}.` : ''}`;
      }
      const reason = limitReason(detail);
      return reason && detail.billing
        ? `${BILLING_PAGES[detail.billing].company} stopped this request: ${reason}.`
        : input.providerSentence;
    }
    case 'network':
      return `Ritemark couldn't reach ${name}. Check your connection, then send your message again.`;
    case 'provider':
    default:
      return input.providerSentence;
  }
}

/** One way on, for a card's single button. */
export type TurnFailureAction =
  | { kind: 'sign-in'; label: string; tooltip: string }
  | { kind: 'open-key-settings'; label: string; tooltip: string }
  | { kind: 'use-model'; label: string; tooltip: string; modelId: string }
  | { kind: 'open-billing'; label: string; tooltip: string; url: string };

export interface TurnFailureCardCopy {
  title: string;
  message: string;
  action?: TurnFailureAction;
}

/**
 * The card a failed turn shows in place of the red line, or null when the
 * turn shows only its sentence (no connection, or the provider's own words).
 *
 * `fallbackModel` is the catalog's default for this AI. `switchedTo` is set
 * once the person took the model card's switch, so the card says so.
 */
export function turnFailureCard(input: {
  runtimeId: AgentId;
  kind: RuntimeErrorKind | undefined;
  detail?: RuntimeErrorDetail;
  sentence: string;
  names?: ModelNames;
  fallbackModel?: string;
  switchedTo?: string;
}): TurnFailureCardCopy | null {
  const name = aiName(input.runtimeId);
  const detail = input.detail ?? {};
  switch (input.kind) {
    case 'sign-in':
      if (input.runtimeId === 'codex') {
        return {
          title: 'ChatGPT needs you to sign in again',
          message: input.sentence,
          action: { kind: 'sign-in', label: 'Sign in to ChatGPT', tooltip: "Opens ChatGPT's sign-in page in your browser." },
        };
      }
      if (input.runtimeId === 'opencode') {
        return {
          title: 'OpenCode needs a working API key',
          message: input.sentence,
          action: { kind: 'open-key-settings', label: 'Open AI Settings', tooltip: 'Opens Ritemark Settings, where your API keys are.' },
        };
      }
      // Claude's sign-in cards stay as they are (by `failureKind`).
      return null;
    case 'model': {
      const failed = detail.model;
      const title = failed ? `${name} couldn't use ${modelLabel(input.names, failed)}` : `${name} couldn't use the chosen model`;
      if (input.switchedTo) {
        return { title, message: `Switched to ${modelLabel(input.names, input.switchedTo)} — send your message again when you're ready.` };
      }
      const fallback = input.fallbackModel && input.fallbackModel !== failed ? input.fallbackModel : undefined;
      if (!fallback) {
        return { title, message: "It isn't available in Ritemark right now. Choose another model in the model menu below." };
      }
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
      if (detail.limit === 'plan') {
        return {
          title: `You've used ${name}'s limit for now`,
          message: detail.resetsAt ? `It resets ${detail.resetsAt}.` : 'Try again later.',
        };
      }
      const page = detail.billing ? BILLING_PAGES[detail.billing] : undefined;
      const reason = limitReason(detail);
      if (!page || !reason) return { title: `${name} stopped this request`, message: input.sentence };
      const said = `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
      if (page.trusted && page.buttonLabel) {
        return {
          title: `${page.company} stopped this request`,
          message: `${said} Add credits, then send your message again.`,
          action: { kind: 'open-billing', label: page.buttonLabel, tooltip: `Opens ${page.place} in your browser.`, url: page.url },
        };
      }
      return {
        title: `${page.company} stopped this request`,
        message: `${said} Add credits in ${page.place}, then send your message again.`,
      };
    }
    case 'network':
    case 'provider':
    default:
      return null;
  }
}

/** Sprint 139 (R8): a turn's outcome, as `first_reply` and `agent_used` name it. */
export type TurnOutcome =
  | 'arrived'
  | 'sign_in'
  | 'plan'
  | 'limit'
  | 'model'
  | 'network'
  | 'provider_error'
  | 'stopped'
  | 'other';

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
