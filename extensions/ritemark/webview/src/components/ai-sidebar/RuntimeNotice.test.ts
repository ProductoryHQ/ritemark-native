/**
 * Sprint 145 (#578, R6, S35): a failed turn's done card has no green. Green is only the small "ready" dot (the
 * Experience lead's framework, §3); the done card draws as "You're all set!" does: a plain check in the heading's ink
 * on a quiet chip (soft in Light, muted in Dark), in RuntimeNotice's shape. The success tone is shared, so Claude's "You're signed in" note (the
 * same RuntimeNotice) changes with it.
 *
 * Renders, to markup:
 * - RuntimeNotice's success tone: the chip's colours and icon, and no success colour anywhere;
 * - TurnFailureCard for a failed turn whose model switch was taken (the done card, "Now using …"), through the store;
 * - the same failure before the switch: the warning card, unchanged.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/RuntimeNotice.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

Object.assign(globalThis, {
  window: { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 400 },
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
;(globalThis as unknown as { React: unknown }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { useAISidebarStore } = await import('./store')
const { createConversationState } = await import('./conversationState')
const { RuntimeNotice } = await import('./RuntimeNotice')
const { TurnFailureCard } = await import('./TurnFailureCard')
const { Icon } = await import('../ui/Icon')

/** An icon's drawing, to tell `check` from `check-circle` in the notice's markup. */
const drawing = (name: 'check' | 'check-circle' | 'warning') => parse(renderToStaticMarkup(createElement(Icon, { name, size: 14, tone: 'inherit' }))).querySelector('svg')!.innerHTML

/** The notice's icon chip: the first span holding an svg. */
function chipOf(markup: string) {
  const chip = parse(markup).querySelectorAll('span').find((span) => span.querySelector(':scope > svg'))
  assert.ok(chip, 'the notice has an icon chip')
  return chip
}

function assertDone(markup: string, where: string) {
  const chip = chipOf(markup)
  const style = chip.getAttribute('style') ?? ''
  assert.match(style, /background:var\(--r-done-chip\)/, `${where}: the chip is the done chip's surface`)
  assert.match(style, /color:var\(--r-ink-strong\)/, `${where}: the check is the heading's ink`)
  assert.equal(chip.querySelector('svg')!.innerHTML, drawing('check'), `${where}: a plain check`)
  assert.notEqual(chip.querySelector('svg')!.innerHTML, drawing('check-circle'), `${where}: not a check in a circle`)
  assert.ok(!markup.includes('--r-success'), `${where}: no success colour (green) anywhere`)
  assert.ok(chip.getAttribute('class')?.includes('h-6 w-6') && chip.getAttribute('class')?.includes('rounded-md'), `${where}: RuntimeNotice's chip shape (24, rounded)`)
  assert.equal(parse(markup).querySelector('[role]')?.getAttribute('role'), 'status', `${where}: still a status, not an alert`)
}

// The done chip's surface: soft in Light, where the muted fill vanishes on the white card; muted in Dark, as before
// (the Experience lead, ritemark-dev 486c2da).
{
  const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf-8')
  const chip = [...css.matchAll(/--r-done-chip:\s*var\((--[\w-]+)\);/g)].map((match) => match[1])
  assert.deepEqual(chip, ['--ritemark-surface-soft', '--ritemark-dark-surface-muted'], 'the done chip is soft in Light and muted in Dark')
}

// RuntimeNotice's success tone itself (the signed-in note uses it too).
assertDone(renderToStaticMarkup(createElement(RuntimeNotice, { title: 'You’re signed in to Claude', message: 'Resend your last message.', tone: 'success' })), 'the success tone')

// Rendering to markup reads the store's initial state (zustand's server snapshot), so the cases set it there.
const initial = useAISidebarStore.getInitialState()
function chat(selectedModel: string) {
  const conversation = createConversationState('conv-model', { selectedAgent: 'claude-code', selectedModel })
  Object.assign(initial, { conversations: { [conversation.id]: conversation }, activeConversationId: conversation.id })
}
Object.assign(initial, {
  models: [
    { id: 'claude-default', label: 'Claude Default', description: '' },
    { id: 'claude-old', label: 'Claude Old', description: '' },
  ],
  defaultClaudeModel: 'claude-default',
})

// A failed turn whose model switch was taken (the chat now uses the default): its card is done.
chat('claude-default')
const failed = {
  runtimeId: 'claude-code' as const,
  error: "Claude couldn't use Claude Old.",
  errorKind: 'model' as const,
  errorDetail: { model: 'claude-old' },
  userPrompt: 'Summarise the brief',
}
const done = renderToStaticMarkup(createElement(TurnFailureCard, { ...failed, isLatest: true }))
assert.ok(done.includes('Now using Claude Default'), 'the done card says the switch was taken')
assertDone(done, "the failed turn's done card")

// Before the switch (the chat still on the model that failed): the warning card, offering the switch, keeps its look.
chat('claude-old')
const waiting = renderToStaticMarkup(createElement(TurnFailureCard, { ...failed, isLatest: true }))
assert.ok(parse(waiting).text.includes("Claude couldn't use Claude Old"), 'the card before the switch says what failed')
assert.ok(parse(waiting).text.includes('Use Claude Default'), 'and offers the switch')
const warningChip = chipOf(waiting)
assert.match(warningChip.getAttribute('style') ?? '', /background:var\(--r-warning-soft\);color:var\(--r-warning\)/, 'the warning card is unchanged')
assert.equal(warningChip.querySelector('svg')!.innerHTML, drawing('warning'), 'the warning card keeps its warning icon')

console.log("RuntimeNotice: a failed turn's done card is a check in ink on a quiet chip, with no green")
