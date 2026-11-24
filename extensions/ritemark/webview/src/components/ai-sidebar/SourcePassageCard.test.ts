/** Sprint 173 S23 and S30. Run: npx tsx webview/src/components/ai-sidebar/SourcePassageCard.test.ts */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const React = await import('react');
Object.assign(globalThis, {
  React,
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
});
const { createElement, createRef } = React;
const { renderToStaticMarkup } = await import('react-dom/server');
const { parse } = await import('node-html-parser');
const { SourcePreviewBody } = await import('./SourcePassageCard');
const { AnchoredHoverPopover, Popover, PopoverContent } = await import('../ui/popover');

const render = (preview: Parameters<typeof SourcePreviewBody>[0]['preview']) =>
  parse(renderToStaticMarkup(createElement(SourcePreviewBody, { preview, onOpen: () => assert.fail('unexpected open') })));

const card = render({
  name: 'Interview – head of operations.docx', unit: 'Page 4', quote: 'Start with the handover', missing: false,
});
assert.match(card.text, /Interview – head of operations\.docx.*Page 4/);
assert.equal(card.querySelector('blockquote')?.text, '“Start with the handover”');
assert.equal(card.querySelector('button')?.text, 'Open at this passage');

const missing = render({ name: 'Report.pdf', unit: 'Page 4', missing: true });
assert.match(missing.text, /These words couldn't be found in the document/);
assert.equal(missing.querySelector('blockquote'), null);
assert.equal(render({ error: 'Choose a source file inside the project folder.' }).querySelector('button'), null);

// S30: the controlled card delegates outside-press and Escape dismissal to
// Radix. Both paths call Root.onOpenChange(false), which must clear the card.
let dismissals = 0;
const popover = AnchoredHoverPopover({
  anchor: {} as HTMLElement,
  label: 'Source passage',
  contentRef: createRef<HTMLDivElement>(),
  children: null,
  onClose: () => { dismissals++; },
  onPointerEnter: () => {},
  onPointerLeave: () => {},
});
assert.equal(popover.type, Popover);
assert.equal(popover.props.open, true);
const [, content] = popover.props.children;
assert.equal(content.type, PopoverContent);
assert.equal(content.props.onPointerDownOutside, undefined);
popover.props.onOpenChange(false);
assert.equal(dismissals, 1);

// The production card uses the shared popover for the delegated Markdown link.
const source = readFileSync(new URL('./RenderedMarkdown.tsx', import.meta.url), 'utf8');
assert.match(source, /onPointerOver=.*showSource/);
assert.match(source, /onFocus=.*showSource/);
assert.match(source, /<SourcePassageCard[\s\S]*?onClose=\{closeCard\}/);
console.log('SourcePassageCard: S23 and S30 assertions passed');
