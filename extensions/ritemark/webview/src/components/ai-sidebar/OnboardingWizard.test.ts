/**
 * The AI sheet's sign-in card (Sprint 144, P1). Every button in the onboarding
 * wizard is the shared `Button` from `ui/button.tsx`, which makes an icon the
 * colour of its words in every state (the rule's comment in that file), and
 * each click still reaches the same store action as before.
 *
 * Renders the wizard's three steps to markup and checks:
 * - every <button> carries the shared Button's `data-slot="button"`;
 * - every button sits inside a tooltip trigger (the Tooltip wraps it in a span);
 * - clicking each button by its words runs the action it ran before, once.
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
    return (React.createElement as (...args: unknown[]) => unknown)(type, props, ...children)
  },
}
;(globalThis as unknown as { React: unknown }).React = recordingReact
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { useAISidebarStore } = await import('./store')
const { OnboardingWizard } = await import('./OnboardingWizard')

const calls: string[] = []
const initial = useAISidebarStore.getInitialState()
Object.assign(initial, {
  startLogin: () => { calls.push('startLogin') },
  startCodexLogin: () => { calls.push('startCodexLogin') },
  openApiKeySettings: () => { calls.push('openApiKeySettings') },
  recheckDependencies: () => { calls.push('recheckDependencies') },
  installDependency: (dep: string) => { calls.push(`installDependency:${dep}`) },
  dismissOnboarding: () => { calls.push('dismissOnboarding') },
})

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

function render(status: typeof base, installStates: Record<string, string> = {}) {
  Object.assign(initial, {
    onboardingStatus: status,
    onboardingInstallStates: { git: 'idle', node: 'idle', 'claude-cli': 'idle', 'codex-cli': 'idle', ...installStates },
  })
  clicks = []
  const html = renderToStaticMarkup(createElement(OnboardingWizard))
  const recorded = clicks
  clicks = null
  return { root: parse(html), recorded }
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
}

// Step 3: an AI is ready.
{
  const where = 'step 3'
  const { root, recorded } = render({ ...base, claudeCliInstalled: true, claudeCliAuthenticated: true, anyAgentReady: true })
  assertSharedButtons(root, where)
  calls.length = 0
  click(recorded, 'Get Started', where)
  assert.deepEqual(calls, ['dismissOnboarding'], `${where}: actions`)
}

console.log('OnboardingWizard: every button is the shared Button with a tooltip, and each click reaches its action')
