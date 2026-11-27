import assert from 'node:assert/strict';
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
  assert.match(container.textContent ?? '', /Send your message again\.\s*Tell us about this/);
  openFeedback();
  assert.deepEqual(messages, expected({ title: 'ChatGPT couldn’t answer.', line: 'Send your message again.' }));
});

test('unsafe visible diagnostics never enter the feedback payload', () => {
  for (const error of [
    'Could not read /Users/example/file.txt',
    'Could not read ./private/file.txt',
    'Could not read project/private.txt',
    'Request failed at https://example.test/?token=example',
    '{"error":"raw provider payload"}',
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

test.after(() => root.unmount());
