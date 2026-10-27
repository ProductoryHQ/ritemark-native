/**
 * The status bar's AI item: what it says (Sprint 144, P3). Pure, so every state is a unit test.
 *
 * Until 2.1 the item read "AI Ready" whenever the internet answered, even with no AI signed in, so it claimed what it
 * never checked (`connectivity.ts`). It now names the AI the person's next message goes to (the open chat's, or the
 * one a new chat starts with) and says only what Ritemark knows. The words are the Experience lead's (experience 13,
 * ritemark-dev 55bf49c and b058692):
 * - Offline comes before every other state: "Offline", no warning background.
 * - "Claude needs a paid plan" from a plan refusal (#496's classifier; nothing sends it yet).
 * - "Claude: sign in again" when the open chat's last turn on that AI failed on sign-in, until a message goes through.
 * - "Claude ready" when that AI is signed in and the internet has answered. Until the internet's first answer the
 *   item claims nothing for a signed-in AI (state `waiting`, drawn hidden): connectivity starts on a guess of online,
 *   and an offline start keeps that guess until its second failed round (QA, Sprint 144).
 * - "No AI yet" when no AI is signed in or set up.
 * - "Claude: sign in" when that AI was never signed in but another AI is ("again" is only for a sign-in that ended).
 * The words never say "AI", "service" or "connected", except "No AI yet" itself.
 *
 * In 2.1 the item is its words only (the Experience lead, experience 13, 3c0a2ae). A coloured dot may come back in 2.2,
 * but only when one status bar item can draw it 6 px from its words with one hover; VS Code's items can't today.
 */

export type AiStatusState = 'offline' | 'paid-plan' | 'sign-in-again' | 'waiting' | 'ready' | 'no-ai' | 'sign-in';

export interface AiStatusInput {
  /** The internet answers (the connectivity probe's verdict). */
  online: boolean;
  /** The internet has answered at least once (a probe round succeeded); before that, `online` is a guess. */
  internetAnswered: boolean;
  /** The AI the next message goes to, by its label: Claude, ChatGPT or OpenCode. */
  label: string;
  /** That AI can take a turn (its runtime availability is usable). */
  usable: boolean;
  /** The open chat's last turn on that AI failed on sign-in. */
  signInEnded: boolean;
  /** That AI refused for the person's plan. Nothing sends this before #496's classifier has the kind. */
  planRefused: boolean;
  /** Some AI is signed in or set up. */
  anyUsable: boolean;
}

export interface AiStatusView {
  state: AiStatusState;
  text: string;
  tooltip: string;
}

export function describeAiStatus(input: AiStatusInput): AiStatusView {
  const { label } = input;
  if (!input.online) {
    return {
      state: 'offline',
      text: 'Offline',
      tooltip: 'No internet. Your documents work as usual and save on this computer.',
    };
  }
  if (input.planRefused) {
    return {
      state: 'paid-plan',
      text: `${label} needs a paid plan`,
      tooltip: `Your ${label} plan doesn't include working in Ritemark`,
    };
  }
  if (input.signInEnded) {
    return { state: 'sign-in-again', text: `${label}: sign in again`, tooltip: `Your ${label} sign-in has ended` };
  }
  if (input.usable) {
    if (!input.internetAnswered) return { state: 'waiting', text: '', tooltip: '' };
    return { state: 'ready', text: `${label} ready`, tooltip: `Signed in to ${label}` };
  }
  if (!input.anyUsable) {
    return { state: 'no-ai', text: 'No AI yet', tooltip: 'Sign in to an AI to work with it here' };
  }
  return { state: 'sign-in', text: `${label}: sign in`, tooltip: `Sign in to ${label} to work with it here` };
}
