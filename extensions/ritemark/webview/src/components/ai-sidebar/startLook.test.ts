/**
 * Sprint 152 (R5, #624): the AI view draws once.
 *
 * The messages arrive as A4 traced them (`research/ai-view-start.md`), in each order they can come in. At every step
 * the view either still shows its starting mark or shows the look it keeps: never the empty chat before "Almost
 * there!", never an AI's own sign-in screen before the chat. On `main` the view drew `sidebarGate`'s answer at every
 * step, which the last block shows is exactly that empty chat and that sign-in screen.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/startLook.test.ts
 */
import assert from 'node:assert/strict'
// The shared derivation, with structural status objects (the sidebar's wrapper wants its full status types)
import { deriveRuntimeAvailabilities } from '../../../../src/runtime/availability'
import { sidebarGate, sidebarGateInput, type SidebarView } from './sidebarGate'
import { startLook, type StartLookInput } from './startLook'
import type { AgentId } from './types'

type Answer = 'checking' | 'ready' | 'needs-auth' | 'needs-configuration' | 'error'

interface State {
  ready: boolean
  bootstrapError: string | null
  selectedAgent: AgentId
  claude: Answer
  codex: Answer
  opencode: Answer
  onboardingStatusKnown: boolean
  hasConversation: boolean
  conversationOnItsWay: boolean
  extrasWaitOver: boolean
}

const start: State = {
  ready: false,
  bootstrapError: null,
  selectedAgent: 'claude-code',
  claude: 'checking',
  codex: 'checking',
  opencode: 'checking',
  onboardingStatusKnown: false,
  hasConversation: false,
  conversationOnItsWay: true,
  extrasWaitOver: false,
}

/** The store's facts for a state, built the way the store builds them from the host's messages. */
function availabilities(state: State) {
  const phase = (answer: Answer) => (answer === 'checking' ? 'checking' as const : answer === 'error' ? 'error' as const : 'ready' as const)
  return deriveRuntimeAvailabilities({
    runtimeHydration: {
      'claude-code': { phase: phase(state.claude), error: state.claude === 'error' ? 'Claude could not be checked.' : null },
      codex: { phase: phase(state.codex), error: state.codex === 'error' ? 'ChatGPT could not be checked.' : null },
      opencode: { phase: phase(state.opencode), error: state.opencode === 'error' ? 'OpenCode could not be checked.' : null },
    },
    setupStatus: state.claude === 'checking' || state.claude === 'error' ? null : { state: state.claude === 'ready' ? 'ready' : 'needs-auth', error: null },
    codexStatus: { state: state.codex === 'ready' ? 'ready' : state.codex === 'needs-auth' ? 'needs-auth' : 'checking', error: null },
    opencodeEnabled: true,
    acpProviders: { google: state.opencode === 'ready', openai: false, anthropic: false, openrouter: false },
    byokProviderModels: state.opencode === 'ready' ? { google: [{ id: 'gemini' }] } : {},
  })
}

/** What the view draws for a state: its starting mark, its failure, or the gate's look. */
function drawn(state: State): 'mark' | 'failed' | SidebarView {
  const facts = {
    ready: state.ready,
    selectedAgent: state.selectedAgent,
    availabilities: availabilities(state),
    onboardingStatusKnown: state.onboardingStatusKnown,
    onboardingDismissed: false,
    hasConversation: state.hasConversation,
    inlineRecoveryAvailable: false,
  }
  const input: StartLookInput = { ...facts, bootstrapError: state.bootstrapError, conversationOnItsWay: state.conversationOnItsWay, extrasWaitOver: state.extrasWaitOver }
  const look = startLook(input)
  return look.look === 'starting' ? 'mark' : look.look === 'failed' ? 'failed' : sidebarGate(sidebarGateInput(facts))
}

/** Plays the steps in order and returns what the view draws after each, with repeats folded. */
function play(...steps: Partial<State>[]): string[] {
  let state = start
  const looks = [drawn(state)]
  for (const step of steps) {
    state = { ...state, ...step }
    const look = drawn(state)
    if (look !== looks[looks.length - 1]) looks.push(look)
  }
  return looks
}

const bootstrap = { ready: true }
const noConversation = { conversationOnItsWay: false }

// Not signed in, Claude chosen (A4's first row): mark, then "Almost there!" once, in every order of the AIs' answers.
for (const order of [
  [{ claude: 'needs-auth' as const }, { codex: 'needs-auth' as const }, { opencode: 'needs-configuration' as const }],
  [{ opencode: 'needs-configuration' as const }, { codex: 'needs-auth' as const }, { claude: 'needs-auth' as const }],
  [{ codex: 'needs-auth' as const }, { claude: 'needs-auth' as const }, { opencode: 'needs-configuration' as const }],
]) {
  assert.deepEqual(play(bootstrap, noConversation, ...order, { onboardingStatusKnown: true }), ['mark', 'onboarding'])
  // The conversation store answering late changes nothing either
  assert.deepEqual(play(bootstrap, ...order, { onboardingStatusKnown: true }, noConversation), ['mark', 'onboarding'])
}
// ChatGPT or OpenCode chosen: the same.
assert.deepEqual(play({ selectedAgent: 'codex' }, bootstrap, noConversation, { codex: 'needs-auth' }, { claude: 'needs-auth' }, { opencode: 'needs-configuration' }, { onboardingStatusKnown: true }), ['mark', 'onboarding'])
assert.deepEqual(play({ selectedAgent: 'opencode' }, bootstrap, noConversation, { opencode: 'needs-configuration' }, { claude: 'needs-auth' }, { codex: 'needs-auth' }, { onboardingStatusKnown: true }), ['mark', 'onboarding'])

// Signed in: the chat as soon as the chosen AI answers ready, whatever is still being checked.
assert.deepEqual(play(bootstrap, { claude: 'ready' }, { codex: 'needs-auth' }, noConversation), ['mark', 'chat'])
assert.deepEqual(play({ selectedAgent: 'codex' }, bootstrap, { codex: 'ready' }), ['mark', 'chat'])
assert.deepEqual(play({ selectedAgent: 'opencode' }, bootstrap, { opencode: 'ready' }), ['mark', 'chat'])

// The chosen AI signed out, another signed in: the chat, with no sign-in screen before it.
assert.deepEqual(play(bootstrap, noConversation, { claude: 'needs-auth' }, { opencode: 'needs-configuration' }, { codex: 'ready' }), ['mark', 'chat'])

// Nobody signed in, with a conversation open from last time: the chat, never the sign-in first.
assert.deepEqual(play(bootstrap, { claude: 'needs-auth' }, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }, { onboardingStatusKnown: true }, { hasConversation: true, conversationOnItsWay: false }), ['mark', 'chat'])

// Another AI's check hangs after the chosen one answered: the grace, then the chosen AI's sign-in, not the mark for ever.
assert.deepEqual(startLook({ ...start, ready: true, availabilities: availabilities({ ...start, claude: 'needs-auth', opencode: 'needs-configuration' }), onboardingDismissed: false, inlineRecoveryAvailable: false }), { look: 'starting', waitingFor: 'other-ai' })
assert.deepEqual(play(bootstrap, noConversation, { claude: 'needs-auth' }, { opencode: 'needs-configuration' }, { extrasWaitOver: true }), ['mark', 'claude-setup'])
// The chosen AI's own check is never cut short: it is the look's own answer.
assert.deepEqual(play(bootstrap, noConversation, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }, { extrasWaitOver: true }), ['mark'])

// A lost answer doesn't keep the mark turning: after the grace the gate draws what is known.
assert.deepEqual(play(bootstrap, noConversation, { claude: 'needs-auth' }, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }, { extrasWaitOver: true }), ['mark', 'claude-setup'])
assert.deepEqual(play(bootstrap, { claude: 'needs-auth' }, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }, { onboardingStatusKnown: true }, { extrasWaitOver: true }), ['mark', 'onboarding'])
// A check that failed sends no onboarding status: nothing to wait for. The chat says the check failed (RuntimeAvailabilityNotice).
assert.deepEqual(play(bootstrap, noConversation, { claude: 'error' }, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }), ['mark', 'chat'])

// The view can't start: the mark, then its failure (not a chat).
assert.deepEqual(play({ bootstrapError: 'Agent Chat could not load its local configuration. Try again.' }), ['mark', 'failed'])
assert.deepEqual(startLook({ ...start, ready: false, bootstrapError: null, availabilities: availabilities(start), onboardingDismissed: false, inlineRecoveryAvailable: false }), { look: 'starting', waitingFor: 'bootstrap' })

// --- main's view: the gate alone, at the same steps -------------------------------------------------------------------
// Before the deciding answer it drew the empty chat, then the AI's own sign-in screen, then "Almost there!" (#624).
function playGateAlone(...steps: Partial<State>[]): string[] {
  let state = { ...start, ready: true }
  const view = (s: State) => sidebarGate(sidebarGateInput({ ready: s.ready, selectedAgent: s.selectedAgent, availabilities: availabilities(s), onboardingStatusKnown: s.onboardingStatusKnown, onboardingDismissed: false, hasConversation: s.hasConversation, inlineRecoveryAvailable: false }))
  const looks = [view(state)]
  for (const step of steps) {
    state = { ...state, ...step }
    if (view(state) !== looks[looks.length - 1]) looks.push(view(state))
  }
  return looks
}
assert.deepEqual(playGateAlone({ claude: 'needs-auth' }, { codex: 'needs-auth' }, { opencode: 'needs-configuration' }, { onboardingStatusKnown: true }), ['chat', 'claude-setup', 'onboarding'])
assert.deepEqual(playGateAlone({ claude: 'needs-auth' }, { opencode: 'needs-configuration' }, { codex: 'ready' }), ['chat', 'claude-setup', 'chat'])

console.log('ai-sidebar/startLook: all assertions passed')
