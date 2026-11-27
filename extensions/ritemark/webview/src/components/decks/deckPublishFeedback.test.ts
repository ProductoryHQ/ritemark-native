import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWindow } from '@mixmark-io/domino';
import * as React from 'react';

const window = createWindow('<div id="root"></div>');
const { document } = window;
const messages: unknown[] = [];
Object.assign(globalThis, {
  window, document, React,
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }),
});
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { DeckPublishFeedbackLink } = await import('./DeckPublishFeedbackLink');
const container = document.getElementById('root')!;
const root = createRoot(container);

test('only the Publish failure notice gets a feedback link', () => {
  const line = "Ritemark couldn't write the page.";
  for (const operation of ['save-pdf', 'publish']) {
    flushSync(() => root.render(React.createElement(DeckPublishFeedbackLink, { operation, line })));
    const button = container.querySelector('button');
    if (operation === 'save-pdf') {
      assert.ok(!button);
      continue;
    }
    assert.equal(button?.textContent, 'Tell us about this');
    const click = document.createEvent('MouseEvent');
    click.initEvent('click', true, true);
    button!.dispatchEvent(click);
    assert.deepEqual(messages[messages.length - 1], {
      type: 'deck/open-failure-feedback',
      options: { from: 'failure_card', quote: { title: "Publish didn't go", line } },
    });
  }
});

test.after(() => root.unmount());
