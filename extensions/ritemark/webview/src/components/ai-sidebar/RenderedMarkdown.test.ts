// Run from extensions/ritemark with node --import tsx.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWindow } from '@mixmark-io/domino';
import * as React from 'react';

const window = createWindow('<div id="root"></div>');
const { document } = window;
// Domino lacks NodeList.forEach and HTMLElement.dataset.
Object.getPrototypeOf(document.querySelectorAll('a')).forEach = Array.prototype.forEach;
Object.defineProperty(window.HTMLElement.prototype, 'dataset', {
  get() {
    const dataset = {};
    Object.defineProperty(this, 'dataset', { value: dataset });
    return dataset;
  },
});
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
const { RenderedMarkdown } = await import('./RenderedMarkdown');

const links = [
  ['web', 'https://example.com/', { type: 'openExternal', url: 'https://example.com/' }],
  ['file', 'notes.md', { type: 'chat:open-file', filePath: 'notes.md' }],
  ['unsupported', 'mailto:hello@example.com', {
    type: 'chat:link-unsupported', scheme: 'mailto', href: 'mailto:hello@example.com',
  }],
] as const;

const container = document.getElementById('root');
assert.ok(container);
const root = createRoot(container);
flushSync(() => root.render(React.createElement(RenderedMarkdown, {
  content: links.map(([label, href]) => `[${label}](${href})`).join('\n'),
})));

for (const [label, href, expected] of links) {
  test(`${label} click is handled only by chat`, () => {
    messages.length = 0;
    let documentClicks = 0;
    const onClick = () => { documentClicks++; };
    // Domino bubbles to document, which stands in for VS Code’s window listener.
    document.addEventListener('click', onClick);
    try {
      const anchor = container.querySelector(`a[href="${href}"]`);
      assert.ok(anchor);
      const click = document.createEvent('MouseEvent');
      click.initEvent('click', true, true);
      anchor.dispatchEvent(click);
      assert.deepEqual(messages, [expected]);
      assert.equal(documentClicks, 0);
      assert.equal(click.defaultPrevented, true);
    } finally {
      document.removeEventListener('click', onClick);
    }
  });
}

test.after(() => {
  root.unmount();
});
