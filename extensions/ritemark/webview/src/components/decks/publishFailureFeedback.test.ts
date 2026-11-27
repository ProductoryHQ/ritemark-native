import { readFileSync } from 'node:fs';
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
const { PublishFailureFeedbackLink } = await import('./PublishFailureFeedbackLink');
const container = document.getElementById('root')!;
const root = createRoot(container);

test('only the Publish failure notice gets a feedback link', () => {
  const line = "Ritemark couldn't write the page.";
  for (const operation of ['save-pdf', 'publish']) {
    flushSync(() => root.render(React.createElement(PublishFailureFeedbackLink, { operation, line })));
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

const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8');

test('the Publish feedback link is omitted from compact and minimum-width layouts', () => {
  assert.match(css, /\[data-theme-compact\][^{}]*\.deck-publish-feedback[^{}]*\{[^}]*display:\s*none/);
  assert.match(css, /\[data-measure-min\][^{}]*\.deck-publish-feedback[^{}]*\{[^}]*display:\s*none/);
});

test('the Publish feedback link stays outside the bar notice live region', () => {
  const notice = view.slice(view.indexOf('<span className="deck-notice"'), view.indexOf('<span className="deck-bar-spacer"'));
  const liveRegion = notice.match(/<span[^>]*role="status" aria-live="polite"[^>]*>[\s\S]*?<\/span>/);
  assert.ok(liveRegion);
  assert.match(liveRegion[0], /className="sr-only"/);
  assert.doesNotMatch(liveRegion[0], /FeedbackLink/);
});

test('the v2.4.0 changelog has one continuous list', () => {
  const changelog = readFileSync(new URL('../../../../../../docs/CHANGELOG.md', import.meta.url), 'utf8');
  const section = changelog.split('## [Unreleased] — v2.4.0')[1]?.split(/\n## /)[0];
  assert.ok(section?.includes('Tell us about this'));
  assert.doesNotMatch(section!, /\n- [^\n]+\n\n- /);
});
