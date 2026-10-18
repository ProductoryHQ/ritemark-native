/**
 * The welcome's words for what went wrong (Sprint 133, R3, R4): one sentence
 * each, what happened and what to do. No error codes, and never
 * "authenticated", "runtime" or Codex (experience 2, decisions 2 and 4).
 */

import type { WelcomeProviderId } from './protocol';

export const PROVIDER_NAMES: Record<WelcomeProviderId, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  opencode: 'OpenCode',
};

export type SignInProblem = 'failed' | 'timed-out' | 'could-not-start' | 'not-ready' | 'not-opened';

export function signInProblem(provider: WelcomeProviderId, problem: SignInProblem): string {
  const name = PROVIDER_NAMES[provider];
  switch (problem) {
    case 'failed': return `The sign-in to ${name} didn’t finish. Sign in again when you’re ready.`;
    case 'timed-out': return `The sign-in page wasn’t finished in time. Sign in again when you’re ready.`;
    case 'could-not-start': return `${name}’s sign-in couldn’t start. Try again in a moment.`;
    case 'not-ready': return `${name} can’t start on this computer yet. Open Settings to repair it.`;
    case 'not-opened': return `${name}’s sign-in page didn’t open. Sign in again to open it.`;
  }
}

/** A sign-in that ended (experience 32, frame 3). */
export function signInEnded(provider: WelcomeProviderId): string {
  return `Your sign-in has ended. Sign in again to use ${PROVIDER_NAMES[provider]} here.`;
}

export const CHECK_TIMED_OUT = 'Couldn’t check. Try again.';

export const OFFLINE_LINE = 'You are offline. Your sign-ins are checked when you are back online.';

export function folderGone(name: string): string {
  return `The folder “${name}” isn’t there any more. Choose where your work is.`;
}

export const FOLDER_OPEN_FAILED = 'Ritemark couldn’t open that folder. Choose another one.';
