/**
 * Sprint 155 (PR 2) — the words of a chat's document icon, and All chats'
 * order by the document in front.
 *
 * Run with `npx tsx webview/src/components/ai-sidebar/chatDocument.test.ts`.
 */
import assert from 'node:assert/strict';
import { chatDocumentLabel, chatDocumentTooltip, orderByFrontDocument, type ChatDocumentView } from './chatDocument';

const one: ChatDocumentView = { path: '/p/Advokatuur.md', openPath: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0, iconUri: 'x' };
const several: ChatDocumentView = { path: '/p/Module 2.md', openPath: '/p/Module 2.md', name: 'Module 2.md', more: 2, iconUri: 'y' };

assert.equal(chatDocumentTooltip(one), 'Changed Advokatuur.md');
assert.equal(chatDocumentTooltip(several), 'Changed Module 2.md and 2 more');
assert.equal(chatDocumentTooltip({ ...several, more: 1 }), 'Changed Module 2.md and 1 more');
assert.equal(chatDocumentLabel(one), 'Changed Advokatuur.md. Bring it forward');
assert.equal(chatDocumentLabel(several), 'Changed Module 2.md and 2 more. Bring it forward');

// ── All chats: the chats whose icon is the document in front come first, the rest as they were ──
const rows = [{ conversationId: 'shorten' }, { conversationId: 'draft' }, { conversationId: 'which' }, { conversationId: 'also' }];
const documents: Record<string, ChatDocumentView> = {
  shorten: one,
  draft: several,
  also: { ...one, more: 3 },
};
const ids = (list: { conversationId: string }[]) => list.map((row) => row.conversationId);
assert.deepEqual(ids(orderByFrontDocument(rows, documents, null)), ['shorten', 'draft', 'which', 'also'], 'nothing in front: the order as it was');
assert.deepEqual(ids(orderByFrontDocument(rows, documents, '/p/Module 2.md')), ['draft', 'shorten', 'which', 'also'], 'Module 2.md in front: its chat first');
assert.deepEqual(ids(orderByFrontDocument(rows, documents, '/p/Advokatuur.md')), ['shorten', 'also', 'draft', 'which'], 'two chats for the front document keep their own order');
assert.deepEqual(ids(orderByFrontDocument(rows, documents, '/p/Other.md')), ['shorten', 'draft', 'which', 'also'], 'a document no chat changed last: as it was');
// The tab changes back: the order follows
assert.deepEqual(ids(orderByFrontDocument(rows, documents, '/p/Module 2.md')), ['draft', 'shorten', 'which', 'also']);
// Only the icon's document counts: a chat that changed Advokatuur.md before Module 2.md isn't moved up for Advokatuur.md
assert.ok(!ids(orderByFrontDocument(rows, documents, '/p/Advokatuur.md')).slice(0, 2).includes('draft'));
assert.equal(orderByFrontDocument(rows, documents, null), rows, 'the same list when nothing moves');

console.log('chatDocument.test.ts: all passed');
