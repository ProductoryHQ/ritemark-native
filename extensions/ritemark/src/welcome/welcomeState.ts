/**
 * The welcome's state and its transitions (Sprint 133, R1–R5, E2). Pure: no
 * `vscode` import. The host feeds it what each provider's check answers and
 * what the person does; the page draws what it returns.
 */

import type { RuntimeAvailability } from '../runtime/availability';
import type { AccountProviderId, ProviderView, WelcomeKind, WelcomeProviderId } from './protocol';
import { CHECK_TIMED_OUT, signInEnded, signInProblem, type SignInProblem } from './words';

/** A check with no answer after this shows Try again (R4: a cold first start can take 15 s). */
export const CHECK_TIMEOUT_MS = 20_000;

export const PROVIDER_ORDER: readonly WelcomeProviderId[] = ['chatgpt', 'claude', 'opencode'];

/** What one provider's check said, or that it has not said anything yet. */
export type CheckResult =
  | { kind: 'pending' }
  | { kind: 'timed-out' }
  | { kind: 'offline' }
  | { kind: 'answered'; availability: RuntimeAvailability; method: 'account' | 'api_key' | null; signInEnded: boolean };

export interface ProviderMemory {
  check: CheckResult;
  /** A sign-in the welcome started and that is still open in the browser. */
  signingIn: boolean;
  /** The last sign-in's problem, shown until the next attempt. */
  problem: SignInProblem | null;
}

export function initialMemory(): ProviderMemory {
  return { check: { kind: 'pending' }, signingIn: false, problem: null };
}

/** The card or row for one provider. */
export function providerView(id: WelcomeProviderId, memory: ProviderMemory): ProviderView {
  const base = { id, reason: null, retry: false, method: null } satisfies Partial<ProviderView>;
  if (memory.signingIn) return { ...base, phase: 'signing-in' };
  const problem = memory.problem ? signInProblem(id, memory.problem) : null;
  const check = memory.check;
  switch (check.kind) {
    case 'pending':
      return { ...base, phase: 'checking', reason: problem };
    case 'timed-out':
      return { ...base, phase: 'sign-in', reason: CHECK_TIMED_OUT, retry: true };
    case 'offline':
      return { ...base, phase: 'not-checked' };
    case 'answered': {
      const { state } = check.availability;
      if (state === 'ready') return { ...base, phase: 'ready', method: check.method ?? (id === 'opencode' ? 'api_key' : 'account') };
      if (state === 'checking') return { ...base, phase: 'checking', reason: problem };
      if (state === 'auth-in-progress') return { ...base, phase: 'checking' };
      if (state === 'needs-auth' || state === 'needs-configuration') {
        return { ...base, phase: 'sign-in', reason: problem ?? (check.signInEnded ? signInEnded(id) : null) };
      }
      if (state === 'error') return { ...base, phase: 'sign-in', reason: CHECK_TIMED_OUT, retry: true };
      // not-installed, broken, disabled
      return { ...base, phase: 'unavailable', reason: signInProblem(id, 'not-ready') };
    }
  }
}

/**
 * The update sheet's rows (R10, experience 32): Claude and ChatGPT, the two
 * AIs signed in with an account, each with its state; OpenCode too once it
 * is set up. Add another offers the rest.
 */
export function updateRows(views: readonly ProviderView[]): ProviderView[] {
  return views
    .filter((view) => view.id !== 'opencode' || view.phase === 'ready')
    .sort((a, b) => updateRowOrder(a.id) - updateRowOrder(b.id));
}

function updateRowOrder(id: WelcomeProviderId): number {
  return id === 'claude' ? 0 : id === 'chatgpt' ? 1 : 2;
}

/** Map a runtime to the provider people know it by. */
export function providerOfRuntime(runtimeId: string): WelcomeProviderId | null {
  return runtimeId === 'claude-code' ? 'claude' : runtimeId === 'codex' ? 'chatgpt' : runtimeId === 'opencode' ? 'opencode' : null;
}

export function runtimeOfProvider(provider: WelcomeProviderId): 'claude-code' | 'codex' | 'opencode' {
  return provider === 'claude' ? 'claude-code' : provider === 'chatgpt' ? 'codex' : 'opencode';
}

export interface StepInput {
  kind: WelcomeKind;
  step: 1 | 2;
  readyProvider: WelcomeProviderId | null;
}

/**
 * A provider became ready from the welcome (R3): the fresh welcome moves to
 * step 2 and says "Signed in to …"; the update sheet only updates its row.
 */
export function afterProviderReady(state: StepInput, provider: WelcomeProviderId): StepInput {
  if (state.kind !== 'fresh') return { ...state, readyProvider: state.readyProvider ?? provider };
  return { ...state, step: 2, readyProvider: provider };
}

/** Skip for now (R2): step 2 with no AI. Step 2 has no skip. */
export function afterSkip(state: StepInput): StepInput {
  return state.kind === 'fresh' ? { ...state, step: 2, readyProvider: null } : state;
}

/** Whether a provider's sign-in is the welcome's own (Claude and ChatGPT), or a set-up sheet (OpenCode). */
export function isAccountProvider(id: WelcomeProviderId): id is AccountProviderId {
  return id === 'claude' || id === 'chatgpt';
}

/** The line under step 2's options: the AI's name follows the one signed in. */
export function projectLine(readyProvider: WelcomeProviderId | null): string {
  const who = readyProvider === 'claude' ? 'Claude' : readyProvider === 'chatgpt' ? 'ChatGPT' : readyProvider === 'opencode' ? 'OpenCode' : 'Your AI';
  return `A project is a folder on this computer. ${who} works only inside it.`;
}
