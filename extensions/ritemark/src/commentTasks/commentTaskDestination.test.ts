/**
 * Sprint 155: the comment task's three destination rules, and a new chat's
 * name from the comment.
 *
 * Run: npx tsx src/commentTasks/commentTaskDestination.test.ts
 */
import assert from 'node:assert/strict';
import { chatNameFromComment, pickCommentTaskDestination } from './commentTaskDestination';

const DOC = '/p/docs/Module 2.md';
const OTHER = '/p/docs/Advokatuur.md';
const GONE = '/p/docs/Old notes.md';
const existing = new Set([DOC, OTHER, '/p/docs/Module 3.md']);
const exists = (file: string) => existing.has(file);

// 1. The chat that last changed the document — even when another chat is open.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [
      { conversationId: 'shorten', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] },
      { conversationId: 'draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }, { path: OTHER, changedAt: '2026-11-07T07:00:00Z' }] },
      { conversationId: 'older', changedFiles: [{ path: DOC, changedAt: '2026-11-06T08:00:00Z' }] },
    ],
    pending: [],
    openConversationId: 'shorten',
    exists,
  });
  assert.deepEqual(choice, { rule: 'changed', conversationId: 'draft', changedAt: '2026-11-07T08:00:00Z' }, 'rule 1: the newest change wins');
}

// 2. No chat changed it: the open chat, if it hasn't changed another document.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [{ conversationId: 'cases' }, { conversationId: 'shorten', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }],
    pending: [],
    openConversationId: 'cases',
    exists,
  });
  assert.deepEqual(choice, { rule: 'open', conversationId: 'cases' }, 'rule 2: the open chat that changed nothing');
}

// 2 fails: the open chat changed another document → 3. a new chat.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [{ conversationId: 'shorten', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }],
    pending: [],
    openConversationId: 'shorten',
    exists,
  });
  assert.deepEqual(choice, { rule: 'new' }, 'rule 3: the open chat changed another document');
}

// An old chat (no record of changes) counts as having changed nothing.
{
  const choice = pickCommentTaskDestination({
    document: DOC, chats: [{ conversationId: 'from-2-1' }], pending: [], openConversationId: 'from-2-1', exists,
  });
  assert.deepEqual(choice, { rule: 'open', conversationId: 'from-2-1' }, 'an old chat routes as today');
}

// A gone file never counts: the open chat whose only change is deleted changed nothing.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [{ conversationId: 'open', changedFiles: [{ path: GONE, changedAt: '2026-11-07T09:00:00Z' }] }],
    pending: [],
    openConversationId: 'open',
    exists,
  });
  assert.deepEqual(choice, { rule: 'open', conversationId: 'open' }, 'a deleted file is not another document');
}

// A waiting task is its chat's newest change: a second comment joins it.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [{ conversationId: 'draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
    pending: [{ conversationId: 'new-chat', document: DOC, at: '2026-11-07T10:00:00Z' }],
    openConversationId: 'draft',
    exists,
  });
  assert.equal(choice.rule === 'changed' && choice.conversationId, 'new-chat', 'the pending task’s chat is the newest change');
}

// A pending task for ANOTHER document is the open chat's change too: rule 2 does not pick it.
{
  const choice = pickCommentTaskDestination({
    document: DOC,
    chats: [{ conversationId: 'open' }],
    pending: [{ conversationId: 'open', document: OTHER, at: '2026-11-07T10:00:00Z' }],
    openConversationId: 'open',
    exists,
  });
  assert.deepEqual(choice, { rule: 'new' }, 'a chat working on another document is not reused');
}

// Paths are compared with the host's rule (real paths).
{
  const choice = pickCommentTaskDestination({
    document: '/private/p/docs/Module 2.md',
    chats: [{ conversationId: 'draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
    pending: [],
    openConversationId: null,
    exists,
    samePath: (a, b) => a.replace(/^\/private/, '') === b.replace(/^\/private/, ''),
  });
  assert.equal(choice.rule, 'changed');
}

// The new chat's name: the comment's words, without "@claude", up to six words.
assert.equal(chatNameFromComment('@claude shorter please'), 'Shorter please');
assert.equal(chatNameFromComment('@claude make this much shorter please, thanks a lot'), 'Make this much shorter please, thanks');
assert.equal(chatNameFromComment('Rewrite the intro for lawyers. @codex'), 'Rewrite the intro for lawyers');
assert.equal(chatNameFromComment('  @opencode   '), '');
assert.equal(chatNameFromComment('fix   the\ntable'), 'Fix the table');
// Live check 8 Nov: punctuation right after the mention made a chat named ", list three outcomes as bullets"
assert.equal(chatNameFromComment('@opencode, list three outcomes as bullets'), 'List three outcomes as bullets');
assert.equal(chatNameFromComment('@claude: shorter please'), 'Shorter please');
assert.equal(chatNameFromComment('Please, @codex, tighten the intro'), 'Please, tighten the intro');

console.log('commentTaskDestination tests: all assertions passed');
