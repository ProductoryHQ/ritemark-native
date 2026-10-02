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
const { createConversationState } = await import('./conversationState');
const React = await import('react');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { createElement } = React;
const { renderToStaticMarkup } = await import('react-dom/server');
const { ThreadRail } = await import('./ThreadRail');

const conversations = Object.fromEntries(Array.from({ length: 5 }, (_, index) => {
  const id = `conversation-${index}`;
  return [id, createConversationState(id, {
    createdAt: index,
    agentConversation: [{
      id: `turn-${index}`,
      conversationId: id,
      userPrompt: `Prompt ${index}`,
      activities: [],
      isRunning: false,
      isPlan: false,
      planHandled: false,
      timestamp: index,
    }],
  })];
}));
useAISidebarStore.setState({ conversations, activeConversationId: 'conversation-0' });
useAISidebarStore.setState({ showHistoryPanel: true });
useAISidebarStore.getState().switchConversation('conversation-0');
assert.equal(
  useAISidebarStore.getState().showHistoryPanel,
  false,
  'Selecting the already-current conversation closes the panel instead of leaving focus trapped in it',
);

useAISidebarStore.getState().requestNewThread();

assert.equal(Object.keys(useAISidebarStore.getState().conversations).length, 6, 'New is never limited by runtime attachment capacity');
assert.notEqual(useAISidebarStore.getState().activeConversationId, 'conversation-0');

useAISidebarStore.setState({
  hostConversations: [],
  pinnedConversationIds: [],
  activeConversationId: null,
  conversations: {},
  showHistoryPanel: false,
});

const emptyRailMarkup = renderToStaticMarkup(createElement(ThreadRail));
assert.match(
  emptyRailMarkup,
  /class="flex h-full min-h-0 flex-col items-center gap-1 overflow-y-auto/,
  'An empty rail applies the four-pixel gap once on the common controls container',
);
assert.doesNotMatch(
  emptyRailMarkup,
  /\b(?:mb|mt)-1\b/,
  'An empty rail does not double the gap with adjacent button margins',
);

// The rows of the rail's panel (ConversationsPanel). A title has the row's whole width and two
// lines before it is cut; the hover actions are laid over the status line, so they hold none of
// that width. With the actions in the row's flow a title got 59 of 191px at the default width.
const { ConversationRow, EarlierConversationRow } = await import('./ConversationsPanel');
const { conversationPinState } = await import('./conversationActionsModel');
const rowTitle = 'Check the price list against my launch notes.';
const rowSummary: ConversationSummaryV1 = {
  conversationId: 'conversation-row',
  scopeId: 'ps1-test',
  title: rowTitle,
  identityColorSlot: 0,
  createdAt: '2026-10-02T08:00:00.000Z',
  lastActivityAt: '2026-10-02T08:00:00.000Z',
  revision: 1,
  bindingGeneration: 0,
  lifecycle: { state: 'working', activeTurnId: 'turn-row' },
  runtimeSummary: ['claude-code'],
  integrity: 'verified',
  lastVerifiedAt: '2026-10-02T08:00:00.000Z',
};
const noop = () => {};
const projectRowMarkup = renderToStaticMarkup(createElement(ConversationRow, {
  summary: rowSummary,
  pin: conversationPinState(rowSummary.conversationId, rowTitle, []),
  current: true,
  onOpen: noop,
  onRename: noop,
  onPin: noop,
  onDelete: noop,
}));
const earlierRowMarkup = renderToStaticMarkup(createElement(EarlierConversationRow, {
  summary: rowSummary,
  onMove: noop,
  onDelete: noop,
}));
const classesOf = (markup: string, element: RegExp, what: string): string[] => {
  const match = markup.match(element);
  assert.ok(match, `The row renders ${what}`);
  return match[1].split(' ');
};
for (const [row, markup] of [['A project row', projectRowMarkup], ['A "Project unknown" row', earlierRowMarkup]] as const) {
  const title = classesOf(markup, /<div class="([^"]*)">Check the price list against my launch notes\.<\/div>/, 'its title');
  assert.ok(title.includes('line-clamp-2'), `${row}'s title wraps to a second line before it is cut`);
  assert.ok(!title.includes('truncate'), `${row}'s title is not held to a single line`);
  const actions = classesOf(markup, /<div class="([^"]*)"><button type="button" aria-label="(?:Rename|Move) /, 'its hover actions');
  assert.ok(actions.includes('absolute'), `${row}'s hover actions are laid over the row`);
  assert.ok(
    !actions.includes('relative') && !actions.includes('shrink-0'),
    `${row}'s hover actions hold no width in the row's flow, visible or not`,
  );
}
assert.match(
  projectRowMarkup,
  /<span class="whitespace-nowrap">Working<\/span>/,
  'The state is one unbroken piece of text; only "Current" may move to a second line',
);

console.log('threadRail.test.ts: all assertions passed');
