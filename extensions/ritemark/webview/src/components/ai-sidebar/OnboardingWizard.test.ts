/**
 * The AI sheet's sign-in card (Sprint 144, P1). Every button in the onboarding
 * wizard is the shared `Button` from `ui/button.tsx`, which makes an icon the
 * colour of its words in every state (the rule's comment in that file), and
 * each click still reaches the same store action as before.
 *
 * Renders the wizard's three steps to markup and checks:
 * - every <button> carries the shared Button's `data-slot="button"`;
 * - every button sits inside a tooltip trigger (the Tooltip wraps it in a span);
 * - clicking each button by its words runs the action it ran before, once;
 * - "Installed" and "Ready" are muted ink with their checks in ink, never green.
 *
 * Sprint 160 (#696): each sign-in card draws the Experience lead's seven states from the shared availability and the
 * host's page and line: signed out; signing in, started here or elsewhere alike; the page that didn't open; a
 * sign-in that ended without success; ready; offline. Cancel and "Open the page again" reach their store actions,
 * and Re-check stays in every state.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/OnboardingWizard.test.ts
 */
import assert from 'node:assert/strict'

Object.assign(globalThis, {
  window: { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 400 },
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
// JSX here compiles to `React.createElement`; while `clicks` is set, it keeps
// every element's click handler with the words on it, so the test can click it.
type Clickable = { label: string; onClick: (event: unknown) => unknown }
let clicks: Clickable[] | null = null
// And each Tooltip's words with the words of the button it wraps (Sprint 160)
let tips: Array<{ tip: string; words: string }> | null = null
let TooltipType: unknown = null
function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children)
  return ''
}
const recordingReact = {
  ...React,
  createElement: (type: Parameters<typeof React.createElement>[0], props: Record<string, unknown> | null, ...children: unknown[]) => {
    if (clicks && props && typeof props.onClick === 'function') {
      clicks.push({ label: textOf(children).trim(), onClick: props.onClick as Clickable['onClick'] })
    }
    if (tips && props && type === TooltipType) tips.push({ tip: String(props.label), words: textOf(children).trim() })
    return (React.createElement as (...args: unknown[]) => unknown)(type, props, ...children)
  },
}
;(globalThis as unknown as { React: unknown }).React = recordingReact
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { useAISidebarStore } = await import('./store')
const { OnboardingWizard } = await import('./OnboardingWizard')
TooltipType = (await import('../ui/tooltip')).Tooltip
const { sidebarGate, sidebarGateInput } = await import('./sidebarGate')
const { deriveRuntimeAvailabilities } = await import('./runtimeAvailability')
const { COPY, PLAN_LINES, browserOpened, reopenTip, stopWaitingTip } = await import('../welcome/welcomeCopy')
const { OFFLINE_LINE, homeReopenNotOpened, signInProblem } = await import('../../../../src/welcome/words')

const calls: string[] = []
const initial = useAISidebarStore.getInitialState()
// Sprint 160: the real Cancel and "Open the page again", before the clicks below are pointed at the recorder
const { cancelSignIn: realCancelSignIn, reopenSignIn: realReopenSignIn } = initial
Object.assign(initial, {
  startLogin: () => { calls.push('startLogin') },
  startCodexLogin: () => { calls.push('startCodexLogin') },
  openApiKeySettings: () => { calls.push('openApiKeySettings') },
  recheckDependencies: () => { calls.push('recheckDependencies') },
  installDependency: (dep: string) => { calls.push(`installDependency:${dep}`) },
  dismissOnboarding: () => { calls.push('dismissOnboarding') },
  cancelSignIn: (ai: string) => { calls.push(`cancelSignIn:${ai}`) },
  reopenSignIn: (ai: string) => { calls.push(`reopenSignIn:${ai}`) },
})
// What each render starts from, so one test's sign-in never leaks into the next
const rest = {
  runtimeHydration: initial.runtimeHydration,
  setupStatus: initial.setupStatus,
  codexStatus: initial.codexStatus,
  claudeLoginState: initial.claudeLoginState,
  sheetSignIns: initial.sheetSignIns,
  isOnline: initial.isOnline,
}

const base = {
  platform: 'darwin' as const,
  wingetAvailable: false,
  gitInstalled: true,
  nodeInstalled: true,
  gitRequired: false,
  nodeRequired: false,
  claudeCliInstalled: false,
  claudeCliAuthenticated: false,
  codexCliInstalled: false,
  codexCliAuthenticated: false,
  hasOpenAiKey: false,
  hasAnthropicKey: false,
  anyAgentReady: false,
}

function render(status: typeof base, installStates: Record<string, string> = {}, store: Record<string, unknown> = {}) {
  Object.assign(initial, rest, {
    onboardingStatus: status,
    onboardingInstallStates: { git: 'idle', node: 'idle', 'claude-cli': 'idle', 'codex-cli': 'idle', ...installStates },
  }, store)
  clicks = []
  tips = []
  const html = renderToStaticMarkup(createElement(OnboardingWizard))
  const recorded = clicks
  const tooltips = tips
  clicks = null
  tips = null
  return { root: parse(html), recorded, tooltips, html }
}

function assertSharedButtons(root: ReturnType<typeof parse>, where: string) {
  const buttons = root.querySelectorAll('button')
  assert.ok(buttons.length > 0, `${where}: no buttons rendered`)
  for (const button of buttons) {
    const words = button.text.trim()
    assert.equal(button.getAttribute('data-slot'), 'button', `${where}: "${words}" is not the shared Button`)
    const parent = button.parentNode as unknown as { tagName?: string; getAttribute?: (name: string) => string | undefined }
    assert.equal(parent.tagName, 'SPAN', `${where}: "${words}" has no tooltip`)
    assert.ok(parent.getAttribute?.('data-state') !== undefined, `${where}: "${words}" is not inside a tooltip trigger`)
  }
}

function click(recorded: Clickable[], words: string, where: string) {
  const target = recorded.find((c) => c.label === words)
  assert.ok(target, `${where}: no button "${words}" (have: ${recorded.map((c) => c.label).join(', ')})`)
  target.onClick({})
}

// Step 1: nothing installed, Git and Node.js asked for, one install failed.
{
  const where = 'step 1'
  const { root, recorded } = render(
    { ...base, gitRequired: true, nodeRequired: true, gitInstalled: false, nodeInstalled: false },
    { 'claude-cli': 'failed' },
  )
  assertSharedButtons(root, where)
  assert.ok(!root.toString().includes('testing-iconPassed'), `${where}: Ready and its check are ink, not green`)
  calls.length = 0
  click(recorded, 'Re-check', where)
  click(recorded, 'Retry', where)
  for (const c of recorded.filter((c) => c.label === 'Install')) c.onClick({})
  assert.deepEqual(calls, [
    'recheckDependencies',
    'installDependency:claude-cli',
    'installDependency:git',
    'installDependency:node',
  ], `${where}: actions (ChatGPT's Install waits for Node.js, so it is a hint, not a button)`)
}

// Step 2: both installed, neither signed in.
{
  const where = 'step 2'
  const { root, recorded } = render({ ...base, claudeCliInstalled: true, codexCliInstalled: true })
  assertSharedButtons(root, where)
  calls.length = 0
  click(recorded, 'Sign in with Claude.ai', where)
  click(recorded, 'Use API key', where)
  click(recorded, 'Sign in with ChatGPT', where)
  click(recorded, 'Re-check', where)
  assert.deepEqual(calls, ['startLogin', 'openApiKeySettings', 'startCodexLogin', 'recheckDependencies'], `${where}: actions`)
  const secondary = root.querySelectorAll('button').find((b) => b.text.trim() === 'Use API key')
  assert.ok(secondary?.getAttribute('class')?.includes('bg-secondary'), `${where}: Use API key is the secondary Button`)
  // "Installed" in muted ink, its check in ink: green is not used for words (the Experience lead, 3c0a2ae).
  const installed = root.querySelectorAll('span').filter((el) => el.text.trim() === 'Installed')
  assert.equal(installed.length, 2, `${where}: Claude and ChatGPT both read Installed`)
  for (const el of installed) assert.ok(el.getAttribute('class')?.includes('--r-ink-muted'), `${where}: Installed is muted ink`)
  assert.ok(!root.toString().includes('testing-iconPassed'), `${where}: no green on the sign-in card`)
  // Sprint 145 (#578): the checks are drawn in the ink their class names (fill="currentColor"); while an Icon's tone
  // was its fill (before #614), these drew in the muted tone.
  const checks = root.querySelectorAll('svg').filter((svg) => svg.getAttribute('class')?.includes('--r-ink-body'))
  assert.equal(checks.length, 2, `${where}: Claude's and ChatGPT's Installed checks`)
  for (const svg of checks) assert.equal(svg.getAttribute('fill'), 'currentColor', `${where}: an Installed check takes its ink`)
}

// Step 3: an AI is ready.
{
  const where = 'step 3'
  const { root, recorded } = render({ ...base, claudeCliInstalled: true, claudeCliAuthenticated: true, anyAgentReady: true })
  assertSharedButtons(root, where)
  assert.ok(!root.toString().includes('testing-iconPassed'), `${where}: "You're all set!"'s check is ink, not green`)
  assert.ok(root.toString().includes('text-[var(--r-ink-strong)]'), `${where}: "You're all set!"'s check is the heading's ink, not muted`)
  // Sprint 145 (#578): and it is drawn so: the class colours the check only with fill="currentColor"
  const allSet = root.querySelectorAll('svg').find((svg) => svg.getAttribute('class')?.includes('--r-ink-strong'))
  assert.equal(allSet?.getAttribute('fill'), 'currentColor', `${where}: "You're all set!"'s check is filled with its ink, not the muted tone`)
  calls.length = 0
  click(recorded, 'Get started', where)
  assert.deepEqual(calls, ['dismissOnboarding'], `${where}: actions`)
}

// ── Sprint 160 (#696): the sign-in cards' seven states (the Experience lead, 15 November) ──

const both = { ...base, claudeCliInstalled: true, codexCliInstalled: true }
const hydrated = {
  'claude-code': { phase: 'ready', error: null, refreshing: false },
  codex: { phase: 'ready', error: null, refreshing: false },
  opencode: { phase: 'ready', error: null, refreshing: false },
}
function setup(state: string) {
  return { cliInstalled: true, runnable: true, authenticated: state === 'ready', authMethod: null, state, diagnostics: [], repairAction: null, error: null }
}
function codex(state: string) {
  return { enabled: true, state, version: null, authMethod: null, email: null, plan: null, error: null, diagnostics: [], repairCommand: null, binaryPath: null, compatibility: null }
}
const signedOut = { runtimeHydration: hydrated, setupStatus: setup('needs-auth'), codexStatus: codex('needs-auth') }
const noLine = { page: false, line: null }
type Root = ReturnType<typeof parse>

/** The buttons in order, with whether each is disabled. */
function buttons(root: Root) {
  return root.querySelectorAll('button').map((button) => ({ words: button.text.trim(), disabled: button.hasAttribute('disabled') }))
}
function words(root: Root, text: string) {
  return root.querySelectorAll('p').filter((p) => p.text.trim() === text)
}
/** A card by its title. */
function card(root: Root, title: string) {
  const heading = root.querySelectorAll('div').find((el) => el.text.trim() === title && el.getAttribute('class')?.includes('font-semibold'))
  assert.ok(heading, `no card "${title}"`)
  return heading.parentNode as unknown as Root
}

// 1. Signed out: as before, each card under its plan line
{
  const where = 'state 1'
  const { root, recorded } = render(both, {}, signedOut)
  assertSharedButtons(root, where)
  assert.deepEqual(buttons(root), [
    { words: 'Sign in with Claude.ai', disabled: false },
    { words: 'Use API key', disabled: false },
    { words: 'Sign in with ChatGPT', disabled: false },
    { words: 'Re-check', disabled: false },
  ], `${where}: the buttons as before`)
  assert.equal(words(card(root, 'Sign in to Claude'), PLAN_LINES.claude).length, 1, `${where}: Claude's plan line`)
  assert.equal(words(card(root, 'Sign in to ChatGPT'), PLAN_LINES.chatgpt).length, 1, `${where}: ChatGPT's plan line`)
  assert.ok(!root.text.includes(COPY.signingIn) && !root.text.includes(OFFLINE_LINE), `${where}: nothing waits, nothing offline`)
  calls.length = 0
  click(recorded, 'Sign in with Claude.ai', where)
  click(recorded, 'Sign in with ChatGPT', where)
  assert.deepEqual(calls, ['startLogin', 'startCodexLogin'], `${where}: actions`)
}

// 2. Signing in, started on the sheet: the press waits at once, before the host's status says so
const startedHere = { ...signedOut, claudeLoginState: 'pending', sheetSignIns: { claude: { page: true, line: null }, chatgpt: noLine } }
{
  const where = 'state 2'
  const { root, recorded, tooltips } = render(both, {}, startedHere)
  assertSharedButtons(root, where)
  assert.deepEqual(buttons(root), [
    { words: COPY.signingIn, disabled: true },
    { words: COPY.cancel, disabled: false },
    { words: 'Use API key', disabled: false },
    { words: COPY.reopen, disabled: false },
    { words: 'Sign in with ChatGPT', disabled: false },
    { words: 'Re-check', disabled: false },
  ], `${where}: the main button waits, a quiet Cancel follows it, Use API key stays, the page can open again; the other AI's Sign in stays`)
  const claude = card(root, 'Sign in to Claude')
  assert.equal(words(claude, browserOpened('claude')).length, 1, `${where}: the plan line says the browser opened the page`)
  assert.ok(!claude.text.includes(PLAN_LINES.claude), `${where}: in place of the plan line`)
  assert.equal(claude.getAttribute('aria-busy'), 'true', `${where}: the card is busy`)
  assert.ok(claude.querySelectorAll('svg').some((svg) => svg.getAttribute('class')?.includes('animate-spin')), `${where}: with the spinner`)
  const cancel = root.querySelectorAll('button').find((b) => b.text.trim() === COPY.cancel)
  assert.ok(cancel?.getAttribute('class')?.includes('hover:bg-surface-soft') && !cancel.getAttribute('class')?.includes('bg-primary'), `${where}: Cancel is the quiet (ghost) Button`)
  const tipOf = (w: string) => tooltips.find((t) => t.words === w)?.tip
  assert.equal(tipOf(COPY.cancel), stopWaitingTip('claude'), `${where}: Cancel's tooltip is Home's`)
  assert.equal(tipOf(COPY.reopen), reopenTip('claude'), `${where}: "Open the page again"'s tooltip is Home's`)
  assert.equal(tipOf(COPY.signingIn), browserOpened('claude'), `${where}: the waiting button says why it waits`)
  for (const t of tooltips) assert.ok(t.tip && t.tip !== 'undefined', `${where}: "${t.words}" has a tooltip`)
  calls.length = 0
  click(recorded, COPY.cancel, where)
  click(recorded, COPY.reopen, where)
  click(recorded, 'Use API key', where)
  click(recorded, 'Re-check', where)
  assert.ok(!recorded.some((c) => c.label === 'Sign in with Claude.ai'), `${where}: Claude's Sign in is not offered again`)
  assert.deepEqual(calls, ['cancelSignIn:claude', 'reopenSignIn:claude', 'openApiKeySettings', 'recheckDependencies'], `${where}: actions`)

  // "Open the page again" only while the page is known
  const unknown = render(both, {}, { ...startedHere, sheetSignIns: { claude: noLine, chatgpt: noLine } })
  assert.ok(!unknown.root.text.includes(COPY.reopen), `${where}: no "Open the page again" before the page is known`)
  assert.ok(unknown.root.text.includes(COPY.signingIn), `${where}: and it still waits`)
}

// 3. Signing in, started elsewhere (Home, the welcome, Settings): exactly as 2; the card doesn't say where it began
{
  const where = 'state 3'
  const elsewhere = render(both, {}, { ...signedOut, setupStatus: setup('auth-in-progress'), sheetSignIns: startedHere.sheetSignIns })
  const here = render(both, {}, startedHere)
  assertSharedButtons(elsewhere.root, where)
  assert.equal(elsewhere.html, here.html, `${where}: drawn exactly as a sign-in started on the sheet`)
}

// 4. "Open the page again" found no page: Home's line, while the sign-in still waits
{
  const where = 'state 4'
  const { root } = render(both, {}, { ...signedOut, setupStatus: setup('auth-in-progress'), sheetSignIns: { claude: { page: false, line: 'not-opened' }, chatgpt: noLine } })
  assertSharedButtons(root, where)
  const claude = card(root, 'Sign in to Claude')
  assert.equal(words(claude, homeReopenNotOpened('claude')).length, 1, `${where}: "${homeReopenNotOpened('claude')}"`)
  assert.equal(claude.text.includes(COPY.signingIn) && claude.text.includes(COPY.cancel), true, `${where}: still waiting, Cancel there to press`)
  assert.ok(!root.text.includes(COPY.reopen), `${where}: with no page known, no "Open the page again"`)
}

// 5. Ended without success: back to signed out, the plan line replaced by why
for (const ended of ['failed', 'timed-out', 'could-not-start'] as const) {
  const where = `state 5 (${ended})`
  const { root } = render(both, {}, { ...signedOut, sheetSignIns: { claude: { page: false, line: ended }, chatgpt: { page: false, line: ended } } })
  assertSharedButtons(root, where)
  const claude = card(root, 'Sign in to Claude')
  assert.equal(words(claude, signInProblem('claude', ended)).length, 1, `${where}: Claude's line says why`)
  assert.ok(!claude.text.includes(PLAN_LINES.claude), `${where}: in place of the plan line`)
  assert.equal(words(card(root, 'Sign in to ChatGPT'), signInProblem('chatgpt', ended)).length, 1, `${where}: and ChatGPT's`)
  assert.deepEqual(buttons(root).filter((b) => b.words.startsWith('Sign in')), [
    { words: 'Sign in with Claude.ai', disabled: false },
    { words: 'Sign in with ChatGPT', disabled: false },
  ], `${where}: Sign in is back`)
}
{
  // A sign-in that waits shows frame 2's line, never the last one's reason; "didn't open" never outlives the wait
  const waiting = render(both, {}, { ...signedOut, setupStatus: setup('auth-in-progress'), sheetSignIns: { claude: { page: false, line: 'failed' }, chatgpt: noLine } })
  assert.ok(!waiting.root.text.includes(signInProblem('claude', 'failed')), 'state 5: a new sign-in hides the last one\'s reason')
  const after = render(both, {}, { ...signedOut, sheetSignIns: { claude: { page: false, line: 'not-opened' }, chatgpt: noLine } })
  assert.equal(words(card(after.root, 'Sign in to Claude'), PLAN_LINES.claude).length, 1, 'state 5: "didn\'t open" goes with the wait')
}

// 6. Ready: "Almost there!" gives way to the chat, with no card between, even while the other AI still signs in
{
  const facts = (setupState: string, codexState: string) => sidebarGate(sidebarGateInput({
    ready: true,
    selectedAgent: 'claude-code',
    availabilities: deriveRuntimeAvailabilities({
      runtimeHydration: hydrated as never,
      setupStatus: setup(setupState) as never,
      codexStatus: codex(codexState) as never,
      opencodeEnabled: false,
      acpProviders: {},
    }),
    onboardingStatusKnown: true,
    onboardingDismissed: false,
    hasConversation: false,
    inlineRecoveryAvailable: false,
  }))
  assert.equal(facts('auth-in-progress', 'needs-auth'), 'onboarding', 'state 6: while Claude signs in, the sheet shows its card')
  assert.equal(facts('ready', 'auth-in-progress'), 'chat', 'state 6: Claude ready: the chat, though ChatGPT still signs in')
}

// 7. Offline: the line once, Sign in waits for the connection, a key does not; a running sign-in keeps waiting
{
  const where = 'state 7'
  const { root, tooltips } = render(both, {}, { ...signedOut, isOnline: false })
  assertSharedButtons(root, where)
  assert.equal(root.querySelectorAll('p').filter((p) => p.text.includes(OFFLINE_LINE)).length, 1, `${where}: the offline line, once`)
  const intro = root.querySelectorAll('p').findIndex((p) => p.text.trim() === 'Sign in to start using AI in Ritemark.')
  assert.ok(root.querySelectorAll('p')[intro + 1]?.text.includes(OFFLINE_LINE), `${where}: under "Sign in to start using AI in Ritemark."`)
  assert.deepEqual(buttons(root), [
    { words: 'Sign in with Claude.ai', disabled: true },
    { words: 'Use API key', disabled: false },
    { words: 'Sign in with ChatGPT', disabled: true },
    { words: 'Re-check', disabled: false },
  ], `${where}: Sign in disabled, Use API key and Re-check not`)
  assert.equal(tooltips.find((t) => t.words === 'Sign in with Claude.ai')?.tip, 'Claude sign-in needs an internet connection.', `${where}: the disabled Sign in says why`)

  const running = render(both, {}, { ...signedOut, isOnline: false, setupStatus: setup('auth-in-progress'), sheetSignIns: startedHere.sheetSignIns })
  assertSharedButtons(running.root, where)
  assert.deepEqual(buttons(running.root).slice(0, 2), [
    { words: COPY.signingIn, disabled: true },
    { words: COPY.cancel, disabled: false },
  ], `${where}: a sign-in already running keeps its waiting look`)
}

// ChatGPT's state 2: its own card waits; Claude's is unchanged
{
  const where = 'ChatGPT state 2'
  const { root, recorded, tooltips } = render(both, {}, { ...signedOut, codexStatus: codex('auth-in-progress'), sheetSignIns: { claude: noLine, chatgpt: { page: true, line: null } } })
  assertSharedButtons(root, where)
  assert.deepEqual(buttons(root), [
    { words: 'Sign in with Claude.ai', disabled: false },
    { words: 'Use API key', disabled: false },
    { words: COPY.signingIn, disabled: true },
    { words: COPY.cancel, disabled: false },
    { words: COPY.reopen, disabled: false },
    { words: 'Re-check', disabled: false },
  ], `${where}: ChatGPT waits, Claude's Sign in stays`)
  assert.equal(words(card(root, 'Sign in to ChatGPT'), browserOpened('chatgpt')).length, 1, `${where}: its line`)
  assert.equal(tooltips.find((t) => t.words === COPY.cancel)?.tip, stopWaitingTip('chatgpt'), `${where}: Cancel's tooltip names ChatGPT`)
  calls.length = 0
  click(recorded, COPY.cancel, where)
  click(recorded, COPY.reopen, where)
  assert.deepEqual(calls, ['cancelSignIn:chatgpt', 'reopenSignIn:chatgpt'], `${where}: actions`)
}

// The store's Cancel stops waiting at once, as Home's card does, and tells the host which AI; the host's status follows
{
  const posted: unknown[] = []
  const { vscode } = await import('../../lib/vscode')
  const send = vscode.postMessage
  vscode.postMessage = (message: unknown) => { posted.push(message) }
  try {
    useAISidebarStore.setState({ setupStatus: setup('auth-in-progress') as never, claudeLoginState: 'pending', codexStatus: codex('auth-in-progress') as never })
    realCancelSignIn('claude')
    assert.equal(useAISidebarStore.getState().setupStatus?.state, 'needs-auth', "Cancel: Claude's card stops waiting at once")
    assert.equal(useAISidebarStore.getState().claudeLoginState, 'idle', 'Cancel: and the press that started it is over')
    assert.equal(useAISidebarStore.getState().codexStatus.state, 'auth-in-progress', "Cancel: ChatGPT's sign-in is not touched")
    realCancelSignIn('chatgpt')
    assert.equal(useAISidebarStore.getState().codexStatus.state, 'needs-auth', "Cancel: ChatGPT's card stops waiting at once")
    realReopenSignIn('claude')
    assert.deepEqual(posted, [
      { type: 'onboarding:cancel-sign-in', ai: 'claude' },
      { type: 'onboarding:cancel-sign-in', ai: 'chatgpt' },
      { type: 'onboarding:reopen-sign-in', ai: 'claude' },
    ], 'the host hears which card was pressed')
    // A late press on a card that no longer waits changes nothing on the page
    useAISidebarStore.setState({ setupStatus: setup('needs-auth') as never, claudeLoginState: 'error' })
    realCancelSignIn('claude')
    assert.equal(useAISidebarStore.getState().claudeLoginState, 'error', 'Cancel: a finished press keeps its own state')
  } finally {
    vscode.postMessage = send
  }
}

console.log('OnboardingWizard: every button is the shared Button with a tooltip, and each click reaches its action')
console.log('OnboardingWizard: the sign-in cards draw states 1–7, Cancel and "Open the page again" reach their actions, Re-check stays')
