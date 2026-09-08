/**
 * Sprint 107 R4 — sidebar gate tests: a ready Claude with no conversation
 * renders the chat composer directly; there is no welcome-card state at all.
 */
import assert from 'node:assert/strict'
import { hasUndismissedInlineRecovery, sidebarGate } from './sidebarGate'

const base = {
  ready: true,
  inlineRecoveryAvailable: false,
  onboardingNeeded: false,
  hasConversation: false,
  hasReadyAlternative: false,
  needsSetup: false,
  showCodexSetup: false,
  showOpenCodeSetup: false,
}

// R4 contract: Claude ready + no conversation + welcome never seen → chat.
// (Pre-107 this was the "Claude is ready — Get Started" card.)
assert.equal(sidebarGate(base), 'chat')

// needsSetup path (binary missing/broken, auth needed) is untouched.
assert.equal(sidebarGate({ ...base, needsSetup: true }), 'claude-setup')

// A provider-specific account problem must not take over the whole product
// while another provider can accept a turn.
assert.equal(
  sidebarGate({ ...base, needsSetup: true, hasReadyAlternative: true }),
  'chat',
)

// History remains visible even when every provider is currently unavailable.
assert.equal(
  sidebarGate({ ...base, needsSetup: true, hasConversation: true }),
  'chat',
)

// A failed turn with an inline sign-in CTA stays visible after the host
// refreshes Claude setup state to needs-auth. It also wins over first-run
// onboarding because the user already has a concrete failed conversation.
assert.equal(sidebarGate({ ...base, needsSetup: true, inlineRecoveryAvailable: true }), 'chat')
assert.equal(sidebarGate({ ...base, onboardingNeeded: true, needsSetup: true, inlineRecoveryAvailable: true }), 'chat')

const authTurn = { id: 'turn-auth', result: { failureKind: 'authentication' } }
assert.equal(hasUndismissedInlineRecovery(authTurn, []), true)
assert.equal(
  hasUndismissedInlineRecovery(authTurn, ['turn-auth']),
  false,
  'acknowledging a recovered turn must let a later needs-auth state show setup again',
)
assert.equal(
  hasUndismissedInlineRecovery({ id: 'turn-generic', result: { failureKind: 'runtime' } }, []),
  false,
)

// First-run onboarding wins over everything else.
assert.equal(sidebarGate({ ...base, onboardingNeeded: true, needsSetup: true }), 'onboarding')
assert.equal(
  sidebarGate({ ...base, onboardingNeeded: true, needsSetup: true, hasConversation: true }),
  'chat',
)

// Codex / OpenCode setup branches unaffected.
assert.equal(sidebarGate({ ...base, showCodexSetup: true }), 'codex-setup')
assert.equal(sidebarGate({ ...base, showOpenCodeSetup: true }), 'opencode-setup')

// Not-ready sidebar falls through to the chat shell (its own loading state).
assert.equal(sidebarGate({ ...base, ready: false, needsSetup: true }), 'chat')

// --- Sprint 108: no sticky/'checking' compensation left in this gate -----
//
// Pre-108, a background refresh tick (`agent:status-checking`) forced every
// runtime's phase back to 'checking' for the round trip, so this gate needed
// a `selectedRuntimeChecking` + `previousView` sticky branch to stop an
// already-visible setup view from being torn down and redrawn. The root fix
// lives in store.ts: a refresh no longer overwrites a KNOWN phase, so
// `needsSetup` / `showCodexSetup` / `showOpenCodeSetup` / `onboardingNeeded`
// never flip during a refresh in the first place — the caller's inputs to
// this gate are just stable. `sidebarGate` is a pure function of `i` again,
// with no second argument and no 'checking'-shaped branch. The equivalent
// regression coverage (a refresh tick changes nothing) now lives at the
// store level, in bootstrapState.test.ts.

console.log('sidebarGate tests passed.')
