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

const render = (
  preview: Parameters<typeof SourcePreviewBody>[0]['preview'],
  passage = { text: 'Start with the handover', page: 4 } as { text: string; page?: number },
) => parse(renderToStaticMarkup(createElement(SourcePreviewBody, {
  preview, passage, path: 'Operations lead' + (preview && 'extension' in preview ? preview.extension : ''),
  onOpen: () => assert.fail('unexpected open'),
})));

for (const [extension, page, label] of [
  ['.docx', 1, 'Word, page 1'],
  ['.pdf', 2, 'PDF, page 2'],
  ['.pptx', 4, 'PowerPoint, slide 4'],
] as const) {
  const card = render({ name: 'Operations lead', extension, page, quote: 'Start with the handover', missing: false });
  const head = card.querySelector('p');
  assert.equal(head?.text, `Operations lead · ${label}`);
  assert.ok(head?.classList.contains('whitespace-nowrap'));
  assert.ok(head?.querySelector('svg'));
  assert.equal(card.querySelector('blockquote')?.text, '“Start with the handover”');
  const action = card.querySelector('button');
  assert.equal(action?.text, '→Open at this passage');
  assert.ok(action?.classList.contains('hover:underline'));
  assert.ok(action?.classList.contains('rm-focus-ring'));
  assert.equal(action?.hasAttribute('disabled'), false);
  assert.equal(action?.hasAttribute('tabindex'), false);
}

for (const page of [4, undefined]) {
  const missing = render({ name: 'Operations lead', extension: '.docx', missing: true }, { text: 'AI quotation', page });
  assert.equal(missing.querySelector('p')?.text, 'Operations lead · Word');
  assert.ok(missing.text.includes("These words aren't in the document."));
  assert.equal(missing.querySelector('blockquote')?.text, '“AI quotation”');
  assert.ok(missing.querySelector('blockquote')?.classList.contains('text-ink-muted'));
  assert.equal(missing.querySelector('button')?.text, page ? '→Open page 4' : '→Open the document');
  assert.ok(!missing.text.includes('Open at this passage'));
}
assert.equal(render({ error: 'Choose a source file inside the project folder.' }).querySelector('button'), null);

// S30: the controlled card delegates outside-press and Escape dismissal to
// Radix. Both paths call Root.onOpenChange(false), which must clear the card.
let dismissals = 0;
const chatColumn = {} as HTMLElement;
const popover = AnchoredHoverPopover({
  anchor: {} as HTMLElement,
  label: 'Source passage',
  collisionBoundary: chatColumn,
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
assert.equal(content.props.collisionBoundary, chatColumn);
assert.equal(content.props.collisionPadding, 12);
assert.equal(content.props.sticky, 'always');
assert.match(content.props.className, /--radix-popover-content-available-width/);
assert.equal(content.props.onPointerDownOutside, undefined);
popover.props.onOpenChange(false);
assert.equal(dismissals, 1);

// The production card uses the shared popover for the delegated Markdown link.
const source = readFileSync(new URL('./RenderedMarkdown.tsx', import.meta.url), 'utf8');
assert.match(source, /onPointerOver=.*showSource/);
assert.match(source, /onFocus=.*showSource/);
assert.match(source, /<SourcePassageCard[\s\S]*?onClose=\{closeCard\}/);
const sidebar = readFileSync(new URL('./AISidebar.tsx', import.meta.url), 'utf8');
assert.match(sidebar, /ref=\{setConversationColumn\} data-chat-column[\s\S]*?<UnifiedConversationView[\s\S]*?<\/div>\s*<ThreadRail/);
const cardSource = readFileSync(new URL('./SourcePassageCard.tsx', import.meta.url), 'utf8');
assert.match(cardSource, /collisionBoundary=\{anchor\.closest\('\[data-chat-column\]'\)\}/);
const popoverSource = readFileSync(new URL('../ui/popover.tsx', import.meta.url), 'utf8');
assert.match(popoverSource, /event\.key !== 'Tab'[\s\S]*?querySelector\('button:not\(:disabled\)'\)[\s\S]*?action\.focus\(\)/);
console.log('SourcePassageCard: S23 and S30 assertions passed');
