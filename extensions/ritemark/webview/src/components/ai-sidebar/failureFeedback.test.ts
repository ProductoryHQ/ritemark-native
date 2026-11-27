import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createWindow } from '@mixmark-io/domino';
import * as React from 'react';

const window = createWindow('<div id="root"></div>');
const { document } = window;
const messages: unknown[] = [];
Object.assign(globalThis, {
  window,
  document,
  React,
  acquireVsCodeApi: () => ({
    postMessage: (message: unknown) => messages.push(message),
    getState: () => undefined,
    setState: () => {},
  }),
});

const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { RuntimeNotice } = await import('./RuntimeNotice');
const { TurnFailureCard } = await import('./TurnFailureCard');
const { useAISidebarStore } = await import('./store');
const { createConversationState } = await import('./conversationState');

const container = document.getElementById('root')!;
const root = createRoot(container);
function render(element: React.ReactElement) {
  messages.length = 0;
  flushSync(() => root.render(element));
}
function openFeedback() {
  const button = Array.from(container.querySelectorAll('button')).find(node => node.textContent === 'Tell us about this');
  assert.ok(button);
  const click = document.createEvent('MouseEvent');
  click.initEvent('click', true, true);
  button.dispatchEvent(click);
}
const expected = (quote?: { title: string; line: string }) => [{
  type: 'agent:openFeedback',
  options: { from: 'failure_card', ...(quote ? { quote } : {}) },
}];

test('failure notice opens feedback with the displayed title and line', () => {
  render(React.createElement(RuntimeNotice, {
    title: 'Claude sign-in didn’t finish',
    message: 'Please try signing in again.',
    feedback: true,
    detail: 'Private diagnostic shown for local troubleshooting',
    primaryAction: { label: 'Try again', tooltip: 'Try again', onAction: () => {} },
  }));
  assert.match(container.textContent ?? '', /Tell us about this\s*Try again/);
  openFeedback();
  assert.deepEqual(messages, expected({ title: 'Claude sign-in didn’t finish', line: 'Please try signing in again.' }));
});

test('classified Codex failure has feedback even without a recovery button', () => {
  render(React.createElement(TurnFailureCard, {
    runtimeId: 'codex', error: 'Private diagnostic', errorKind: 'network', isLatest: false,
  }));
  openFeedback();
  assert.deepEqual(messages, expected({
    title: "Ritemark couldn't reach ChatGPT",
    line: 'Check your connection, then send your message again.',
  }));
});

test('fallback failure links after the line and sends its visible words', () => {
  render(React.createElement(TurnFailureCard, {
    runtimeId: 'codex', error: 'Send your message again.', isLatest: true,
  }));
  assert.match(container.textContent ?? '', /^Send your message again\.\s*Tell us about this$/);
  openFeedback();
  assert.deepEqual(messages, expected({ title: 'ChatGPT couldn’t answer.', line: 'Send your message again.' }));
});

test('ordinary slash wording stays in the feedback quote', () => {
  const title = 'Claude limit';
  for (const message of [
    "You've used Claude's limit for now. It resets at 3pm (Europe/Tallinn).",
    'A/B', 'and/or', '/login', 'Error 404: /v1/messages', 'Open Notes.docx.',
  ]) {
    render(React.createElement(RuntimeNotice, { title, message, feedback: true }));
    openFeedback();
    assert.deepEqual(messages, expected({ title, line: message }), message);
  }
});

test('unsafe visible diagnostics never enter the feedback payload', () => {
  for (const error of [
    'Could not read /Users/example/file.txt', 'Could not read ./private/file.txt',
    'Could not read /a/b', 'Could not read /report.docx', 'Could not read ~/Notes',
    'Could not read ../Notes', 'Could not read a/b/c', 'Could not read dir/file.docx',
    'Could not read project/Private notes.docx',
    String.raw`Could not read C:\Notes`, String.raw`Could not read \\server\share`,
    'Request failed at https://example.test/?token=example', '{"error":"raw provider payload"}',
    'TypeError: raw renderer diagnostics',
  ]) {
    render(React.createElement(TurnFailureCard, {
      runtimeId: 'codex', error, isLatest: true,
    }));
    openFeedback();
    assert.deepEqual(messages, expected());
  }
});

test('successful notices have no failure link', () => {
  render(React.createElement(RuntimeNotice, {
    title: 'You’re signed in', message: 'Send your message again.', tone: 'success',
  }));
  assert.ok(!container.textContent?.includes('Tell us about this'));
});

test('the model switched success card has no failure link', () => {
  useAISidebarStore.setState({
    activeConversationId: 'switched',
    conversations: { switched: createConversationState('switched', { selectedModel: 'fallback' }) },
    defaultClaudeModel: 'fallback',
  });
  render(React.createElement(TurnFailureCard, {
    runtimeId: 'claude-code', error: 'Model unavailable', errorKind: 'model',
    errorDetail: { model: 'unavailable' }, isLatest: true,
  }));
  assert.match(container.textContent ?? '', /Now using fallback/);
  assert.doesNotMatch(container.textContent ?? '', /Tell us about this/);
});

test.after(() => root.unmount());

test('the extension test script includes the failure feedback suite', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
  assert.match(scripts.test, /npx tsx webview\/src\/components\/ai-sidebar\/answerFeedback\.test\.ts && npx tsx webview\/src\/components\/ai-sidebar\/failureFeedback\.test\.ts/);
});
