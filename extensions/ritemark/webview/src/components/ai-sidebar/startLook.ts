/**
 * startLook — Sprint 152 (R5, #624): whether the AI view knows its settled look yet.
 *
 * The view draws once: the chat, or the sign-in. Until the messages it gets make that certain, it shows the turning
 * mark it took over from the shell (A4: before this, a person who isn't signed in saw "Loading...", "Preparing Agent
 * Chat…", the empty chat and the AI's own sign-in screen go by in about 1.5 s before "Almost there!"). This decides
 * only when; `sidebarGate` still decides which look.
 *
 * What makes the look certain (A4, `research/ai-view-start.md`):
 * - the bootstrap (`ready`); before it nothing is known;
 * - a conversation open at the start is the chat whatever the AIs answer, so a restore on its way is waited for;
 * - the chosen AI usable: the chat; still being checked: not known yet;
 * - the chosen AI not usable: the chat if another AI is (`hasReadyAlternative`), so every AI's answer is waited for;
 * - no AI usable: "Almost there!" needs `onboarding:status`, which the host sends once Claude's and ChatGPT's checks
 *   have both answered, and never when one of them failed.
 * The conversation and the onboarding status are waited for only so long (`extrasWaitOver`): a lost answer must not
 * leave the mark turning, so after the grace the view draws what the gate says with what is known.
 *
 * A failed bootstrap is a look of its own (`failed`): the view couldn't start.
 */

import type { AgentId } from './types';
import type { RuntimeAvailabilities } from './runtimeAvailability';

export type StartLook =
  | { look: 'starting'; waitingFor: 'bootstrap' | 'ai' | 'conversation' | 'onboarding' }
  | { look: 'failed' }
  | { look: 'settled' };

/** How long the view waits for a restored conversation or the onboarding status once every AI has answered. */
export const START_EXTRAS_GRACE_MS = 2000;

/** After this long in its own check the view says so, under the mark (the Experience lead's answer 5). */
export const START_SLOW_AFTER_MS = 10_000;

export interface StartLookInput {
  ready: boolean;
  bootstrapError: string | null;
  selectedAgent: AgentId;
  availabilities: RuntimeAvailabilities;
  /** The open conversation has turns (or a legacy transcript): the gate's `hasConversation`. */
  hasConversation: boolean;
  inlineRecoveryAvailable: boolean;
  /** The conversation store hasn't answered `conversation/initialize`, or a conversation it opens is on its way. */
  conversationOnItsWay: boolean;
  onboardingStatusKnown: boolean;
  onboardingDismissed: boolean;
  /** The grace for the conversation and the onboarding status has run out. */
  extrasWaitOver: boolean;
}

export function startLook(input: StartLookInput): StartLook {
  if (!input.ready) return input.bootstrapError ? { look: 'failed' } : { look: 'starting', waitingFor: 'bootstrap' };
  if (input.hasConversation || input.inlineRecoveryAvailable) return { look: 'settled' };

  const selected = input.availabilities[input.selectedAgent];
  if (selected.usable) return { look: 'settled' };
  if (selected.state === 'checking') return { look: 'starting', waitingFor: 'ai' };
  const others = (Object.keys(input.availabilities) as AgentId[]).filter((id) => id !== input.selectedAgent);
  if (others.some((id) => input.availabilities[id].usable)) return { look: 'settled' };
  if (others.some((id) => input.availabilities[id].state === 'checking')) return { look: 'starting', waitingFor: 'ai' };

  // No AI can take a turn: the look is the sign-in, unless a conversation lands first
  if (input.extrasWaitOver) return { look: 'settled' };
  if (input.conversationOnItsWay) return { look: 'starting', waitingFor: 'conversation' };
  const onboardingWillCome = input.availabilities['claude-code'].state !== 'error' && input.availabilities.codex.state !== 'error';
  if (!input.onboardingStatusKnown && !input.onboardingDismissed && onboardingWillCome) return { look: 'starting', waitingFor: 'onboarding' };
  return { look: 'settled' };
}
