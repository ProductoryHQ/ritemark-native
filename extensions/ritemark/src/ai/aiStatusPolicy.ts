/**
 * The status bar's AI item: what it says (Sprint 144, P3). Pure, so every state is a unit test.
 *
 * Until 2.1 the item read "AI Ready" whenever the internet answered, even with no AI signed in, so it claimed what it
 * never checked (`connectivity.ts`). It now names the AI the person's next message goes to (the open chat's, or the
 * one a new chat starts with) and says only what Ritemark knows. The words are the Experience lead's (experience 13,
 * ritemark-dev 55bf49c and b058692):
 * - Offline comes before every other state: a grey dot and "Offline", no warning background.
 * - "Claude needs a paid plan", with an amber dot, from a plan refusal (#496's classifier; nothing sends it yet).
 * - "Claude: sign in again" when the open chat's last turn on that AI failed on sign-in, until a message goes through.
 * - "Claude ready", with a green dot, when that AI is signed in and the internet answers.
 * - "No AI yet", with no dot, when no AI is signed in or set up.
 * - "Claude: sign in" when that AI was never signed in but another AI is ("again" is only for a sign-in that ended).
 * The words never say "AI", "service" or "connected", except "No AI yet" itself.
 */

export type AiStatusDot = 'green' | 'grey' | 'amber';

export type AiStatusState = 'offline' | 'paid-plan' | 'sign-in-again' | 'ready' | 'no-ai' | 'sign-in';

export interface AiStatusInput {
  /** The internet answers (the connectivity probe's verdict). */
  online: boolean;
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
  /** The dot left of the words; null hides it. */
  dot: AiStatusDot | null;
}

export function describeAiStatus(input: AiStatusInput): AiStatusView {
  const { label } = input;
  if (!input.online) {
    return {
      state: 'offline',
      text: 'Offline',
      tooltip: 'No internet. Your documents work as usual and save on this computer.',
      dot: 'grey',
    };
  }
  if (input.planRefused) {
    return {
      state: 'paid-plan',
      text: `${label} needs a paid plan`,
      tooltip: `Your ${label} plan doesn't include working in Ritemark`,
      dot: 'amber',
    };
  }
  if (input.signInEnded) {
    return { state: 'sign-in-again', text: `${label}: sign in again`, tooltip: `Your ${label} sign-in has ended`, dot: null };
  }
  if (input.usable) {
    return { state: 'ready', text: `${label} ready`, tooltip: `Signed in to ${label}`, dot: 'green' };
  }
  if (!input.anyUsable) {
    return { state: 'no-ai', text: 'No AI yet', tooltip: 'Sign in to an AI to work with it here', dot: null };
  }
  return { state: 'sign-in', text: `${label}: sign in`, tooltip: `Sign in to ${label} to work with it here`, dot: null };
}
