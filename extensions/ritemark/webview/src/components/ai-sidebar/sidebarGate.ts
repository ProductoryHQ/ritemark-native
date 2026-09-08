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
  /** Existing content must never disappear behind an account/setup takeover. */
  hasConversation: boolean;
  /** A provider problem cannot block a different ready provider. */
  hasReadyAlternative: boolean;
  /** Claude selected and its binary/auth is not ready (broken, missing, needs sign-in). */
  needsSetup: boolean;
  showCodexSetup: boolean;
  showOpenCodeSetup: boolean;
  /**
   * The SELECTED runtime's own probe is mid-refresh right now (e.g. a login
   * poll tick, or any other background status recheck). This is distinct from
   * `needsSetup` / `showCodexSetup` / `showOpenCodeSetup`, which already
   * exclude the 'checking' state so a first-load spinner doesn't get treated
   * as "setup needed". `selectedRuntimeChecking` exists only to let a setup
   * view that is ALREADY showing survive that same transient tick — see the
   * sticky check below.
   */
  selectedRuntimeChecking?: boolean;
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

const SETUP_VIEWS: readonly SidebarView[] = ['claude-setup', 'codex-setup', 'opencode-setup'];

/**
 * @param previousView The view this same gate returned last render (default
 * 'chat' for a first call / no history). Used ONLY for the sticky-setup
 * check below; every other branch is a pure function of `i`.
 */
export function sidebarGate(i: SidebarGateInput, previousView: SidebarView = 'chat'): SidebarView {
  // A recoverable failure belongs beside the turn that failed. A setup-status
  // refresh must not flash that card and immediately replace it with a
  // full-sidebar wizard. Starting a new conversation removes this condition,
  // so first-run and empty-thread setup still use the dedicated wizard.
  if (i.ready && i.inlineRecoveryAvailable) return 'chat';
  if (i.ready && i.onboardingNeeded && !i.hasConversation) return 'onboarding';
  if (i.ready && i.needsSetup && !i.hasConversation && !i.hasReadyAlternative) return 'claude-setup';
  if (i.ready && i.showCodexSetup && !i.hasConversation && !i.hasReadyAlternative) return 'codex-setup';
  if (i.ready && i.showOpenCodeSetup && !i.hasConversation && !i.hasReadyAlternative) return 'opencode-setup';

  // Sticky setup surface: a background probe (Codex/Claude login polling,
  // any other status recheck) can report 'checking' for an instant while the
  // user is looking at a setup view. `needsSetup` / `showCodexSetup` /
  // `showOpenCodeSetup` all go false for that instant — with no protection
  // here that flips the gate to 'chat' and back to the setup view a moment
  // later, which is the ~2s onboarding flicker. Once a setup view is already
  // showing, a mere 'checking' tick on the SAME selected runtime must not
  // tear it down; the terminal branches above (or the fallthrough below)
  // still win the moment the runtime becomes usable, a conversation starts,
  // or another provider becomes ready.
  if (
    i.ready
    && i.selectedRuntimeChecking
    && !i.hasConversation
    && !i.hasReadyAlternative
    && SETUP_VIEWS.includes(previousView)
  ) {
    return previousView;
  }

  return 'chat';
}
