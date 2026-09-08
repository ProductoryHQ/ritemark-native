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

// --- Sticky setup view across a transient 'checking' probe tick ---------
//
// Regression for the Codex onboarding flicker: a background status refresh
// (Codex/Claude login polling, or any other recheck) can report 'checking'
// for an instant while the user is looking at a setup view. The caller
// (AISidebar) computes needsSetup / showCodexSetup / showOpenCodeSetup by
// EXCLUDING the 'checking' state, so on that instant all three go false —
// without the sticky check, the gate falls through to 'chat' and then back
// to the setup view on the next tick once the probe resolves. That is the
// ~2s flicker Jarmo hit. On today's (pre-fix) code this whole block fails,
// because sidebarGate ignores its second argument entirely.

// Codex: already showing codex-setup, then a checking tick with all three
// setup flags now false (as AISidebar would compute them) — must stay put.
assert.equal(
  sidebarGate({ ...base, selectedRuntimeChecking: true }, 'codex-setup'),
  'codex-setup',
  'a transient checking tick must not tear down an already-visible Codex setup view',
)

// Claude: same protection — the "asymmetry" the diagnosis called out (Claude
// setup had no explicit needs-configuration guard either) must not reappear
// as a gap here.
assert.equal(
  sidebarGate({ ...base, selectedRuntimeChecking: true }, 'claude-setup'),
  'claude-setup',
  'a transient checking tick must not tear down an already-visible Claude setup view',
)

// OpenCode: same protection, for consistency across all three setup surfaces.
assert.equal(
  sidebarGate({ ...base, selectedRuntimeChecking: true }, 'opencode-setup'),
  'opencode-setup',
  'a transient checking tick must not tear down an already-visible OpenCode setup view',
)

// A checking tick while chat (or nothing) was previously showing must NOT
// newly enter a setup view — stickiness only preserves a setup view that was
// already visible, it never conjures one out of a bare 'checking' probe.
assert.equal(sidebarGate({ ...base, selectedRuntimeChecking: true }, 'chat'), 'chat')
assert.equal(sidebarGate({ ...base, selectedRuntimeChecking: true }), 'chat')

// A conversation appearing mid-probe still wins over stickiness — existing
// content is never hidden behind a setup takeover, even while checking.
assert.equal(
  sidebarGate({ ...base, selectedRuntimeChecking: true, hasConversation: true }, 'codex-setup'),
  'chat',
)

// A ready alternative appearing mid-probe still wins over stickiness too.
assert.equal(
  sidebarGate({ ...base, selectedRuntimeChecking: true, hasReadyAlternative: true }, 'codex-setup'),
  'chat',
)

// Once the probe actually settles ready (usable), the caller's showCodexSetup
// input would already be false AND selectedRuntimeChecking would be false —
// stickiness only applies to the 'checking' instant, so a settled state falls
// through normally regardless of the stale previousView.
assert.equal(sidebarGate({ ...base }, 'codex-setup'), 'chat')

console.log('sidebarGate tests passed.')
