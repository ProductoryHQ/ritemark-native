/**
 * Sprint 155 (PR 2) — the head's document icon and All chats' meta line, as
 * drawn: the icon only for a chat with a document, its label and its image
 * from the host, the name where it is today without one, and All chats' order
 * by the document in front.
 *
 * Run with `npx tsx webview/src/components/ai-sidebar/chatDocumentRender.test.ts`.
 */
import assert from 'node:assert/strict';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
  get length(): number { return this.data.size; }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { useAISidebarStore } = await import('./store');
const React = await import('react');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { createElement } = React;
const { renderToStaticMarkup } = await import('react-dom/server');
const { ConversationHeader } = await import('./ConversationHeader');
const { ConversationsPanel } = await import('./ConversationsPanel');

const summary = (id: string, title: string, at: string): ConversationSummaryV1 => ({
  conversationId: id,
  scopeId: 'ps1-test',
  title,
  identityColorSlot: 0,
  createdAt: at,
  lastActivityAt: at,
  revision: 1,
  bindingGeneration: 0,
  lifecycle: { state: 'idle' },
  runtimeSummary: ['claude-code'],
  integrity: 'verified',
  lastVerifiedAt: at,
});

// zustand gives server rendering the initial state, so the tests write there
const setStore = (patch: Record<string, unknown>) => { Object.assign(useAISidebarStore.getInitialState(), patch); };

const chats = [
  summary('shorten', 'Shorten the Bar proposal', '2026-11-07T10:03:00.000Z'),
  summary('draft', 'Draft Module 2 and 3', '2026-11-07T10:02:00.000Z'),
  summary('which', 'Which cases suit day two?', '2026-11-07T10:01:00.000Z'),
];
setStore({
  hostConversations: chats,
  pinnedConversationIds: [],
  activeConversationId: 'draft',
  chatDocuments: {
    shorten: { path: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0, iconUri: 'https://file+.vscode-resource/icons/file-text.svg' },
    draft: { path: '/p/Module 2.md', name: 'Module 2.md', more: 2, iconUri: 'https://file+.vscode-resource/icons/file-text.svg' },
  },
  frontDocumentPath: null,
});

// ── the head: icon, label, image, before the name ──
{
  const markup = renderToStaticMarkup(createElement(ConversationHeader));
  assert.match(markup, /aria-label="Changed Module 2\.md and 2 more\. Bring it forward"/, 'the label is the tooltip\'s words plus ". Bring it forward"');
  assert.match(markup, /mask-image:url\(&quot;https:\/\/file\+\.vscode-resource\/icons\/file-text\.svg&quot;\)/, 'the image is the host\'s icon from Ritemark\'s theme');
  assert.ok(markup.indexOf('Bring it forward') < markup.indexOf('Draft Module 2 and 3</h2>'), 'the icon comes before the name');
  assert.doesNotMatch(markup, /title="/, 'no native title');
  const button = markup.match(/<button[^>]*aria-label="Changed[^"]*"[^>]*>/)?.[0] ?? '';
  assert.match(button, /\bsize-6\b/, 'a 24 square');
  assert.match(button, /\bshrink-0\b/, 'the icon never shrinks');
  assert.match(button, /hover:bg-\[var\(--r-accent-soft\)\]/, 'hover: the soft accent fill');
  assert.match(button, /hover:text-\[var\(--r-accent\)\]/, 'hover: the icon in accent');
  assert.match(markup, /class="m-0 min-w-0 flex-1 truncate/, 'a long name keeps its ellipsis');
  // Experience lead: a press never reads weaker than hover: the accent icon on the soft fill, as on hover
  assert.doesNotMatch(button, /active:text-\[var\(--r-accent-deep\)\]/, 'experience fix: no deeper ink on press');
  assert.match(button, /active:bg-\[var\(--r-accent-soft\)\]/, 'the press keeps the soft fill');
  assert.match(button, /active:text-\[var\(--r-accent\)\]/, 'and the accent icon');
  assert.match(button, /focus-visible:!outline-offset-\[-2px\]/, 'the inset focus ring stays');
  // Review finding 5: under forced colors the mask paints in CanvasText, never in a colour the system dropped
  assert.match(markup, /<span[^>]*class="[^"]*\bchat-file-icon\b[^"]*"[^>]*data-file-icon=""|<span[^>]*data-file-icon=""[^>]*class="[^"]*\bchat-file-icon\b/, 'finding 5: the mask carries its forced-colors class');
  const css = (await import('node:fs')).readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  assert.match(css, /\.chat-file-icon\s*\{[^}]*forced-color-adjust:\s*none/, 'finding 5: forced-color-adjust: none');
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*\.chat-file-icon\s*\{[^}]*background-color:\s*CanvasText/, 'finding 5: the mask is CanvasText under forced colors');
}
{
  setStore({ activeConversationId: 'which' });
  const markup = renderToStaticMarkup(createElement(ConversationHeader));
  assert.doesNotMatch(markup, /Bring it forward/, 'a chat that changed nothing has no icon');
  assert.match(markup, /pl-3/, 'and its name starts where it does today');
}

// ── All chats: the meta line and the order ──
const order = (markup: string) => [...markup.matchAll(/aria-label="Open ([^"]+)"/g)].map((match) => match[1]);
{
  const markup = renderToStaticMarkup(createElement(ConversationsPanel));
  assert.deepEqual(order(markup), ['Shorten the Bar proposal', 'Draft Module 2 and 3', 'Which cases suit day two?'], 'nothing in front: by time, as today');
  assert.match(markup, />Module 2\.md<\/span>/, 'the file name');
  assert.match(markup, /Module 2\.md<\/span><\/span><span aria-hidden="true">·<\/span>/, 'then a middle dot');
  const which = markup.slice(markup.indexOf('aria-label="Open Which cases suit day two?"'));
  assert.doesNotMatch(which.slice(0, which.indexOf('aria-label="More actions')), /\.md<\/span>/, 'a chat that changed nothing has no file');
}
{
  setStore({ frontDocumentPath: '/p/Module 2.md' });
  const markup = renderToStaticMarkup(createElement(ConversationsPanel));
  assert.deepEqual(order(markup), ['Draft Module 2 and 3', 'Shorten the Bar proposal', 'Which cases suit day two?'], 'Module 2.md in front: its chat first');
  setStore({ frontDocumentPath: '/p/Advokatuur.md' });
  assert.deepEqual(order(renderToStaticMarkup(createElement(ConversationsPanel))), ['Shorten the Bar proposal', 'Draft Module 2 and 3', 'Which cases suit day two?'], 'the order follows the tab');
}

console.log('chatDocumentRender.test.ts: all passed');
