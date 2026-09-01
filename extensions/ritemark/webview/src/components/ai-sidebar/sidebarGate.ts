/**
 * sidebarGate — Sprint 107 R4: the pure decision for which top-level view the
 * AI sidebar renders. Extracted from AISidebar.tsx's render ternary so the
 * contract "a ready Claude with no conversation goes STRAIGHT to chat — no
 * 'Claude is ready' welcome card" is unit-testable.
 */

export type SidebarView = 'onboarding' | 'claude-setup' | 'codex-setup' | 'opencode-setup' | 'chat';

export interface SidebarGateInput {
  ready: boolean;
  /** The active transcript already contains the recovery action for its failed turn. */
  inlineRecoveryAvailable: boolean;
  /** First run, no agent ready yet, wizard not dismissed. */
  onboardingNeeded: boolean;
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

export function sidebarGate(i: SidebarGateInput): SidebarView {
  // A recoverable failure belongs beside the turn that failed. A setup-status
  // refresh must not flash that card and immediately replace it with a
  // full-sidebar wizard. Starting a new conversation removes this condition,
  // so first-run and empty-thread setup still use the dedicated wizard.
  if (i.ready && i.inlineRecoveryAvailable) return 'chat';
  if (i.ready && i.onboardingNeeded) return 'onboarding';
  if (i.ready && i.needsSetup) return 'claude-setup';
  if (i.ready && i.showCodexSetup) return 'codex-setup';
  if (i.ready && i.showOpenCodeSetup) return 'opencode-setup';
  return 'chat';
}
