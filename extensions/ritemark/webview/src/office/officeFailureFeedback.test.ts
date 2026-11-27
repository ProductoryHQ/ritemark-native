import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { createWindow } from '@mixmark-io/domino';
import * as React from 'react';

const window = createWindow('<div id="root"></div>');
const { document } = window;
const messages: unknown[] = [];
Object.assign(globalThis, {
  window, document, React, ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }),
});
const cssLoader = `
export async function load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return next(url, context);
}`;
register('data:text/javascript,' + encodeURIComponent(cssLoader), import.meta.url);
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { OfficePreviewApp } = await import('./OfficePreviewApp');

const container = document.getElementById('root')!;
const root = createRoot(container);
flushSync(() => root.render(React.createElement(OfficePreviewApp)));
const feedbackButton = () => Array.from(container.querySelectorAll('button')).find(node => node.textContent === 'Tell us about this');

function show(card: Record<string, unknown>) {
  const event = document.createEvent('Event');
  event.initEvent('message', false, false);
  Object.assign(event, { data: { type: 'loadError', ...card } });
  flushSync(() => window.dispatchEvent(event));
}

function clickFeedback() {
  const button = feedbackButton();
  assert.ok(button);
  const click = document.createEvent('MouseEvent');
  click.initEvent('click', true, true);
  button.dispatchEvent(click);
}

test('Word and PowerPoint read errors offer feedback in the card footer', () => {
  for (const fileType of ['docx', 'pptx']) {
    const title = 'This file is damaged';
    const detail = 'Try opening Example.' + fileType + ' in another app.';
    show({ fileType, title, detail, feedback: true });
    assert.match(container.textContent ?? '', /Tell us about this\s*Try again/);
    clickFeedback();
    assert.deepEqual(messages[messages.length - 1], {
      type: 'office:openFailureFeedback', options: { from: 'failure_card', quote: { title, line: detail } },
    });
  }
});

test('unsafe card text stays out of the feedback bridge', () => {
  for (const detail of ['Could not read project/Private notes.docx', 'TypeError: raw renderer diagnostics']) {
    show({ fileType: 'docx', title: 'This file is damaged', detail, feedback: true });
    clickFeedback();
    assert.deepEqual(messages[messages.length - 1], {
      type: 'office:openFailureFeedback', options: { from: 'failure_card' },
    });
  }
});

test('turned-off notice has no feedback link', () => {
  show({ fileType: 'pptx', title: 'The PowerPoint preview is turned off', detail: 'Open it in another app to see it.' });
  assert.match(container.textContent ?? '', /is turned off/);
  assert.equal(feedbackButton(), undefined);
});

test.after(() => root.unmount());
