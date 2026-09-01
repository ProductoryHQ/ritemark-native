/**
 * Sprint 107 R4 — sidebar gate tests: a ready Claude with no conversation
 * renders the chat composer directly; there is no welcome-card state at all.
 */
import assert from 'node:assert/strict'
import { sidebarGate } from './sidebarGate'

const base = {
  ready: true,
  inlineRecoveryAvailable: false,
  onboardingNeeded: false,
  needsSetup: false,
  showCodexSetup: false,
  showOpenCodeSetup: false,
}

// R4 contract: Claude ready + no conversation + welcome never seen → chat.
// (Pre-107 this was the "Claude is ready — Get Started" card.)
assert.equal(sidebarGate(base), 'chat')

// needsSetup path (binary missing/broken, auth needed) is untouched.
assert.equal(sidebarGate({ ...base, needsSetup: true }), 'claude-setup')

// A failed turn with an inline sign-in CTA stays visible after the host
// refreshes Claude setup state to needs-auth. It also wins over first-run
// onboarding because the user already has a concrete failed conversation.
assert.equal(sidebarGate({ ...base, needsSetup: true, inlineRecoveryAvailable: true }), 'chat')
assert.equal(sidebarGate({ ...base, onboardingNeeded: true, needsSetup: true, inlineRecoveryAvailable: true }), 'chat')

// First-run onboarding wins over everything else.
assert.equal(sidebarGate({ ...base, onboardingNeeded: true, needsSetup: true }), 'onboarding')

// Codex / OpenCode setup branches unaffected.
assert.equal(sidebarGate({ ...base, showCodexSetup: true }), 'codex-setup')
assert.equal(sidebarGate({ ...base, showOpenCodeSetup: true }), 'opencode-setup')

// Not-ready sidebar falls through to the chat shell (its own loading state).
assert.equal(sidebarGate({ ...base, ready: false, needsSetup: true }), 'chat')

console.log('sidebarGate tests passed.')
