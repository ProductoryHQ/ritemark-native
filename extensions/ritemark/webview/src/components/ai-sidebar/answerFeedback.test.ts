import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createWindow } from '@mixmark-io/domino';
import * as React from 'react';

const window = createWindow('<div id="root"></div>');
const { document } = window;
Object.getPrototypeOf(document.querySelectorAll('a')).forEach = Array.prototype.forEach;
Object.defineProperty(window.HTMLElement.prototype, 'dataset', {
  get() {
    const dataset = {};
    Object.defineProperty(this, 'dataset', { value: dataset });
    return dataset;
  },
});
let activeElement: HTMLElement | null = null;
Object.defineProperty(document, 'activeElement', { get: () => activeElement });
for (const element of [window.HTMLTextAreaElement, window.HTMLButtonElement]) {
  Object.defineProperty(element.prototype, 'focus', {
    value(this: HTMLElement) { activeElement = this; },
  });
}
Object.assign(window.HTMLElement.prototype, { scrollIntoView() {} });
const messages: unknown[] = [];
Object.assign(globalThis, {
  window, document, HTMLElement: window.HTMLElement, React,
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message), getState() {}, setState() {} }),
});
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { createConversationState } = await import('./conversationState');
const { useAISidebarStore } = await import('./store');
const { UnifiedConversationView } = await import('./UnifiedConversationView');
const { answerFeedbackStore } = await import('./answerFeedbackState');
const turn = (id: string, timestamp: number) => ({ id, timestamp, userPrompt: 'Prompt', activities: [], isRunning: false });
const done = { status: 'completed' as const };
const conversation = createConversationState('chat', {
  agentConversation: [
    { ...turn('claude-done', 1), isPlan: false, planHandled: true, result: { text: 'Claude answer', filesModified: [] } },
    { ...turn('claude-stopped', 2), isPlan: false, planHandled: true, result: { text: 'Partial', filesModified: [], stopped: true } },
  ],
  codexConversation: [
    { ...turn('codex-done', 3), streamingText: 'Codex answer', result: { status: 'success' } },
    { ...turn('codex-failed', 4), streamingText: 'Partial', result: { status: 'failed', error: 'Failure' } },
    { ...turn('codex-pending', 5), streamingText: 'Partial' },
    { ...turn('opencode-done', 6), runtime: 'opencode', streamingText: 'OpenCode answer', result: done },
  ],
});
const otherChat = createConversationState('other', {
  agentConversation: [conversation.agentConversation[0]],
});
const container = document.getElementById('root')!;
const root = createRoot(container);
const target = { conversationId: 'chat', turnId: 'opencode-done' };
const turnContainer = (id: string) => container.querySelector(`[data-turn-anchor="${id}"]`)?.nextElementSibling;
const doneRow = () => container.querySelector('[data-activity-state="done"]');
const form = () => container.querySelector('form') ?? null;
const button = (within: Element | null | undefined, name: string) =>
  Array.from(within?.querySelectorAll('button') ?? []).find((node) => node.getAttribute('aria-label') === name || node.textContent === name);
const edit = (text: string) => flushSync(() => answerFeedbackStore.getState().edit(target, text));
const click = (node: HTMLButtonElement | undefined) => {
  assert.ok(node);
  node.focus();
  dispatch(node, 'click');
};
function dispatch(node: EventTarget, type: string, key?: string) {
  const event = document.createEvent('Event');
  event.initEvent(type, true, true);
  if (key) Object.assign(event, { key });
  flushSync(() => node.dispatchEvent(event));
}
const reply = (message: Parameters<ReturnType<typeof useAISidebarStore.getState>['handleExtensionMessage']>[0]) =>
  flushSync(() => useAISidebarStore.getState().handleExtensionMessage(message));

test.beforeEach(() => {
  flushSync(() => {
    answerFeedbackStore.setState({ entries: {} });
    useAISidebarStore.setState({ conversations: { chat: conversation, other: otherChat }, activeConversationId: 'chat', promptQueues: {} });
    root.render(React.createElement(UnifiedConversationView));
  });
  messages.length = 0;
  activeElement = null;
});
test.afterEach(() => flushSync(() => root.render(null)));
test.after(() => root.unmount());

test('only successful turns across runtimes render controls, with the latest in Done and older controls revealed by hover or keyboard focus', () => {
  assert.ok(button(doneRow(), 'Good answer'));
  assert.ok(button(doneRow(), 'Not right'));
  for (const id of ['claude-done', 'codex-done']) {
    const older = turnContainer(id);
    assert.ok(button(older, 'Good answer'));
    assert.ok(older?.hasAttribute('data-older-answer'));
    assert.ok(older?.querySelector('[data-ai-answer]'));
    assert.ok(older?.querySelector('[data-answer-actions]'));
  }
  for (const id of ['claude-stopped', 'codex-failed', 'codex-pending']) {
    assert.ok(!button(turnContainer(id), 'Good answer'));
  }
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-older-answer\] > \[data-answer-actions\] \{ opacity: 0; \}/);
  assert.match(css, /\[data-older-answer\]:has\(\[data-ai-answer\]:hover\) > \[data-answer-actions\]/);
  assert.match(css, /\[data-older-answer\] > \[data-answer-actions\]:focus-within/);
  assert.ok(!button(doneRow(), 'Tell us about this'));
});

test('an up reaction hides the other thumb and uses the host result for thanks', () => {
  click(button(doneRow(), 'Good answer'));
  click(button(doneRow(), 'Take back'));
  assert.deepEqual(messages, [{ type: 'agent:answerReaction', ...target, reaction: 'up' }]);
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'up', accepted: true, sent: false });
  assert.ok(button(doneRow(), 'Take back'));
  assert.ok(button(doneRow(), 'Tell us more'));
  assert.ok(!button(doneRow(), 'Not right'));
  assert.doesNotMatch(doneRow()?.textContent ?? '', /Thanks\./);
  click(button(doneRow(), 'Take back'));
  assert.deepEqual(messages.pop(), { type: 'agent:answerReaction', ...target, reaction: 'none' });
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'none', accepted: true, sent: false });
  assert.ok(button(doneRow(), 'Not right'));
  click(button(doneRow(), 'Good answer'));
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'up', accepted: true, sent: true });
  assert.match(doneRow()?.textContent ?? '', /Thanks\./);
  click(button(doneRow(), 'Tell us more'));
  assert.ok(form());
});

test('down opens a focused draft with a disabled Send until there are words; Esc and outside clicks dismiss', () => {
  click(button(doneRow(), 'Not right'));
  assert.equal(form()?.querySelector('textarea')?.getAttribute('placeholder'), "What wasn't right?");
  assert.ok(button(form(), 'Send')?.disabled);
  assert.equal(document.activeElement?.nodeName, 'TEXTAREA');
  edit('   ');
  assert.ok(button(form(), 'Send')?.disabled);
  edit('Words');
  assert.equal(button(form(), 'Send')?.disabled, false);
  dispatch(form()!.querySelector('textarea')!, 'keydown', 'Escape');
  assert.ok(!form());
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Take back');
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'down', accepted: true, sent: false });
  click(button(doneRow(), 'Take back'));
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'none', accepted: true, sent: false });
  click(button(doneRow(), 'Not right'));
  assert.ok(form());
  dispatch(container, 'pointerdown');
  assert.ok(!form());
  assert.ok(!messages.some((message) => (message as { type: string }).type === 'agent:sendAnswerFeedback'));
});

test('a new message and a chat switch dismiss the unsent draft', () => {
  click(button(doneRow(), 'Not right'));
  edit('Keep this draft');
  flushSync(() => useAISidebarStore.setState({
    conversations: {
      chat: { ...conversation, codexConversation: [...conversation.codexConversation, { ...turn('new', 7), isRunning: true, streamingText: '' }] },
      other: otherChat,
    },
  }));
  assert.ok(!form());
  assert.deepEqual(messages, [{ type: 'agent:answerReaction', ...target, reaction: 'down' }]);
  flushSync(() => useAISidebarStore.setState({ conversations: { chat: conversation, other: otherChat } }));
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'down', accepted: true, sent: false });
  assert.ok(!form());
  click(button(turnContainer('claude-done'), 'Not right'));
  assert.ok(form());
  flushSync(() => useAISidebarStore.setState({ activeConversationId: 'other' }));
  assert.ok(!form());
  flushSync(() => useAISidebarStore.setState({ activeConversationId: 'chat' }));
  assert.ok(!form());
});

test('a queued follow-up dismisses an older draft before the queued turn starts', () => {
  const older = { conversationId: 'chat', turnId: 'claude-done' };
  click(button(turnContainer(older.turnId), 'Not right'));
  assert.ok(form());
  flushSync(() => useAISidebarStore.setState({
    promptQueues: { chat: [{
      id: 'queued', conversationId: 'chat', runtimeId: 'codex', autonomy: 'auto',
      planFirst: false, thinkingEffort: 'auto', prompt: 'Next', displayText: 'Next',
      source: 'composer', status: 'queued', createdAt: 7,
    }] },
  }));
  assert.ok(!form());
  assert.deepEqual(messages, [{ type: 'agent:answerReaction', ...older, reaction: 'down' }]);
});

test('failed Send keeps the words and Add this answer opens the sheet for the selected older answer', () => {
  const older = { conversationId: 'chat', turnId: 'claude-done' };
  click(button(turnContainer(older.turnId), 'Not right'));
  flushSync(() => answerFeedbackStore.getState().edit(older, ' A correction '));
  dispatch(form()!, 'submit');
  assert.deepEqual(messages.pop(), { type: 'agent:sendAnswerFeedback', ...older, text: 'A correction' });
  reply({ type: 'agent:answerFeedbackResult', ...older, sent: false });
  assert.equal(form()?.querySelector('textarea')?.value, ' A correction ');
  assert.match(form()?.textContent ?? '', /It didn't go/);
  click(button(form(), 'Add this answer…'));
  assert.deepEqual(messages.pop(), { type: 'agent:openFeedback', options: { from: 'thumb', kind: 'ai-issue', turn: older, withAnswer: true, text: ' A correction ' } });
  assert.ok(!form());
});

test('a delivered message closes the draft and shows thanks even when the mark was never sent', () => {
  click(button(doneRow(), 'Not right'));
  reply({ type: 'agent:answerReactionResult', ...target, reaction: 'down', accepted: true, sent: false });
  edit('A correction');
  dispatch(form()!, 'submit');
  dispatch(form()!, 'submit');
  assert.deepEqual(messages.filter((message) => (message as { type: string }).type === 'agent:sendAnswerFeedback'),
    [{ type: 'agent:sendAnswerFeedback', ...target, text: 'A correction' }]);
  reply({ type: 'agent:answerFeedbackResult', ...target, sent: true });
  assert.ok(!form());
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Take back');
  assert.match(doneRow()?.textContent ?? '', /Thanks\./);
});

test('restored marks are scoped to the conversation and an empty snapshot clears them', () => {
  reply({ type: 'agent:answerReactions', conversationId: 'chat', reactions: [{ turnId: target.turnId, reaction: 'up', sent: true }] });
  assert.ok(button(doneRow(), 'Take back'));
  assert.match(doneRow()?.textContent ?? '', /Thanks\./);
  reply({ type: 'agent:answerReactions', conversationId: 'other', reactions: [] });
  assert.ok(button(doneRow(), 'Take back'));
  reply({ type: 'agent:answerReactions', conversationId: 'chat', reactions: [] });
  assert.ok(button(doneRow(), 'Good answer'));
});
