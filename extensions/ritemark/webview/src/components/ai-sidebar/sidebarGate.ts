/**
 * sidebarGate — Sprint 107 R4: the pure decision for which top-level view the
 * AI sidebar renders. Extracted from AISidebar.tsx's render ternary so the
 * contract "a ready Claude with no conversation goes STRAIGHT to chat — no
 * 'Claude is ready' welcome card" is unit-testable.
 *
 * Sprint 108: this used to also carry a `selectedRuntimeChecking` sticky
 * branch that kept an already-visible setup view up during a transient
 * refresh tick. That was a symptom-level compensation for a store bug: a
 * background re-check (`agent:status-checking`) overwrote a runtime's LAST
 * KNOWN phase with 'checking', so every input here (`needsSetup`,
 * `showCodexSetup`, `onboardingNeeded`, ...) would flicker false/true for the
 * duration of the round trip. The root fix (see `runtimeHydration` in
 * store.ts) makes a refresh leave the known phase alone, so none of this
 * gate's inputs move during a re-check any more — the sticky branch is
 * removed rather than kept alongside the real fix.
 */

import type { AgentId } from './types';
import { listReadyAlternatives, type RuntimeAvailabilities } from './runtimeAvailability';

export type SidebarView = 'onboarding' | 'claude-setup' | 'codex-setup' | 'opencode-setup' | 'chat';

export interface SidebarGateInput {
  ready: boolean;
  /** The active transcript already contains the recovery action for its failed turn. */
  inlineRecoveryAvailable: boolean;
  /** First run, no agent ready yet, wizard not dismissed. */
  onboardingNeeded: boolean;
  /** Existing content must never disappear behind an account/setup takeover. */
  hasConversation: boolean;
  /** A provider problem cannot block a different ready provider. */
  hasReadyAlternative: boolean;
  /** Claude selected and its binary/auth is not ready (broken, missing, needs sign-in). */
  needsSetup: boolean;
  showCodexSetup: boolean;
  showOpenCodeSetup: boolean;
}

/** A dismissed historical failure must no longer suppress the setup surface. */
export function hasUndismissedInlineRecovery(
  latestTurn: { id: string; result?: { failureKind?: string } } | undefined,
  dismissedTurnIds: readonly string[],
): boolean {
  const failureKind = latestTurn?.result?.failureKind;
  return Boolean(
    latestTurn
      && !dismissedTurnIds.includes(latestTurn.id)
      && (failureKind === 'authentication' || failureKind === 'api-key-authentication'),
  );
}

/** What `AISidebar` knows, in the shape the gate's inputs are derived from (Sprint 152: shared with startLook's tests). */
export interface SidebarFacts {
  ready: boolean;
  selectedAgent: AgentId;
  availabilities: RuntimeAvailabilities;
  onboardingStatusKnown: boolean;
  onboardingDismissed: boolean;
  hasConversation: boolean;
  inlineRecoveryAvailable: boolean;
}

/** The gate's inputs from the sidebar's facts: the derivation `AISidebar` used to do inline. */
export function sidebarGateInput(facts: SidebarFacts): SidebarGateInput {
  const selected = facts.availabilities[facts.selectedAgent];
  const known = selected.state !== 'checking' && selected.state !== 'error';
  return {
    ready: facts.ready,
    inlineRecoveryAvailable: facts.inlineRecoveryAvailable,
    onboardingNeeded: facts.onboardingStatusKnown
      && !Object.values(facts.availabilities).some((availability) => availability.usable)
      && !facts.onboardingDismissed,
    hasConversation: facts.hasConversation,
    hasReadyAlternative: listReadyAlternatives(facts.availabilities, facts.selectedAgent).length > 0,
    needsSetup: facts.selectedAgent === 'claude-code' && known && !selected.usable,
    showCodexSetup: facts.selectedAgent === 'codex' && known && !selected.usable,
    // OpenCode zero-key: no conversation yet and no provider configured
    showOpenCodeSetup: facts.selectedAgent === 'opencode' && known && !selected.usable
      && !facts.hasConversation && selected.state === 'needs-configuration',
  };
}

export function sidebarGate(i: SidebarGateInput): SidebarView {
  // A recoverable failure belongs beside the turn that failed. A setup-status
  // refresh must not flash that card and immediately replace it with a
  // full-sidebar wizard. Starting a new conversation removes this condition,
  // so first-run and empty-thread setup still use the dedicated wizard.
  if (i.ready && i.inlineRecoveryAvailable) return 'chat';
  if (i.ready && i.onboardingNeeded && !i.hasConversation) return 'onboarding';
  if (i.ready && i.needsSetup && !i.hasConversation && !i.hasReadyAlternative) return 'claude-setup';
  if (i.ready && i.showCodexSetup && !i.hasConversation && !i.hasReadyAlternative) return 'codex-setup';
  if (i.ready && i.showOpenCodeSetup && !i.hasConversation && !i.hasReadyAlternative) return 'opencode-setup';

  return 'chat';
}
