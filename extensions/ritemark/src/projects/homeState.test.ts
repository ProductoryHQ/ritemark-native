/**
 * Sprint 134 (R3, R4, R8, R13; S13, S22, S28, S39): Home's state from what the
 * host read. Which files show under Last changed and by what name, in what
 * order and how many; what waits (cards, hand-offs, chats) and with which AI;
 * the other projects' line.
 * Run: npx tsx src/projects/homeState.test.ts
 */

import assert from 'node:assert/strict';
import * as path from 'path';
import { callsOf } from '../taskBoard/BoardController';
import type { Card } from '../taskBoard/cardFile';
import type { CardHandoffRecordV1 } from '../taskBoard/CardTaskStore';
import { aiNameOf, kindOf, othersOf, RECENT_EXTENSIONS, RECENT_LIMIT, recentItems, waitingItems, type ChangedFile, showWhatMoved, switchNoteEndsOnHost, SWITCH_NOTE_SETTLE_MS } from './homeState';
import { decodeHomeRequest } from './protocol';
import { cardItems, chatsWaiting, handoffViewsFor, summarize, type ChatIndexEntry, type ProjectWaiting } from './waiting';

const folder = path.resolve(path.sep, 'projects', 'Leadership programme');
const at = (...parts: string[]) => path.join(folder, ...parts);
const T = Date.parse('2026-10-19T09:00:00.000Z');
const minutes = (n: number) => T - n * 60_000;

// ── Which files Ritemark lists: the kinds it opens (HomePanel's search pattern) ──

assert.deepEqual([...RECENT_EXTENSIONS], ['.md', '.markdown', '.txt', '.pdf', '.docx', '.doc', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.drawio', '.flow']);
assert.equal(RECENT_LIMIT, 5);
assert.deepEqual(
  ['Plan.md', 'NOTES.MD', 'a.markdown', 'log.txt', 'Brief.pdf', 'Offer.docx', 'old.doc', 'data.csv', 'Budget.xlsx', 'b.xls', 'Deck.pptx', 'd.ppt', 'Map.drawio', 'Weekly.flow', 'Weekly.flow.json', 'WEEKLY.FLOW.JSON', 'data.json', 'photo.png', 'Makefile', '.md'].map(kindOf),
  ['markdown', 'markdown', 'markdown', 'markdown', 'pdf', 'word', 'word', 'sheet', 'sheet', 'sheet', 'slides', 'slides', 'drawing', 'flow', 'flow', 'flow', 'other', 'other', 'other', 'other'],
);

// ── The AI's name: ChatGPT, never Codex (R22) ──

assert.deepEqual(['claude-code', 'codex', 'opencode', 'ritemark-agent', '', null, undefined].map(aiNameOf), ['Claude', 'ChatGPT', 'OpenCode', null, null, null, null]);

// ── Last changed (R4, R8, S13, S28) ──

const files: ChangedFile[] = [
  { path: at('Outline.md'), changedAt: minutes(5) },
  { path: at('AGENTS.md'), changedAt: minutes(1) },
  { path: at('CLAUDE.md'), changedAt: minutes(0) }, // Ritemark's pointer: left out
  { path: at('Modules', 'Week 1', 'Session notes.md'), changedAt: minutes(30) },
  { path: at('Modules', 'AGENTS.md'), changedAt: minutes(40) }, // a subfolder's is only a file
  { path: at('Budget.xlsx'), changedAt: minutes(60) },
  { path: at('README'), changedAt: minutes(2000) },
];
const pointers = new Set([at('CLAUDE.md'), at('Modules', 'CLAUDE.md')]);
const full = recentItems(folder, files, pointers, 10);
assert.deepEqual(full.map(({ item }) => [item.name, item.extension, item.folder, item.kind, item.about]), [
  ['About this project', '', null, 'markdown', true],
  ['Outline', '.md', null, 'markdown', false],
  ['Session notes', '.md', 'Modules/Week 1', 'markdown', false],
  ['AGENTS', '.md', 'Modules', 'markdown', false],
  ['Budget', '.xlsx', null, 'sheet', false],
  ['README', '', null, 'other', false],
], 'newest first; About this project for the root AGENTS.md; the pointer CLAUDE.md left out');
// S15: an id is the file's, not its place in the list: opaque, and the same after the list reorders.
assert.ok(full.every(({ item }) => /^file:[0-9a-f]{16}$/.test(item.id)));
const reordered = recentItems(folder, files.map((file) => (file.path === at('Budget.xlsx') ? { ...file, changedAt: minutes(-5) } : file)), pointers, 10);
assert.equal(reordered[0].path, at('Budget.xlsx'));
assert.equal(reordered[0].item.id, full.find(({ path: filePath }) => filePath === at('Budget.xlsx'))!.item.id);
assert.deepEqual(full.map(({ path: filePath }) => filePath), [at('AGENTS.md'), at('Outline.md'), at('Modules', 'Week 1', 'Session notes.md'), at('Modules', 'AGENTS.md'), at('Budget.xlsx'), at('README')],
  'the host keeps each id’s path');
assert.equal(full[0].item.changedAt, '2026-10-19T08:59:00.000Z');

// The default limit, and the person's own CLAUDE.md (not the pointer) is a document like any other.
assert.deepEqual(recentItems(folder, files, new Set()).map(({ item }) => item.name), ['CLAUDE', 'About this project', 'Outline', 'Session notes', 'AGENTS']);
assert.equal(recentItems(folder, files, pointers, 2).length, 2);
// Names match without regard to case; a CLAUDE.md in a subfolder is never the pointer.
assert.deepEqual(recentItems(folder, [
  { path: at('agents.md'), changedAt: minutes(1) },
  { path: at('claude.md'), changedAt: minutes(2) },
  { path: at('Modules', 'CLAUDE.md'), changedAt: minutes(3) },
], new Set([at('claude.md'), at('Modules', 'CLAUDE.md')])).map(({ item }) => [item.name, item.folder, item.about]), [
  ['About this project', null, true],
  ['CLAUDE', 'Modules', false],
]);
// Equal times: by path, so the order never flickers; the input is not reordered.
const tied = [{ path: at('b.md'), changedAt: T }, { path: at('a.md'), changedAt: T }];
assert.deepEqual(recentItems(folder, tied, new Set()).map(({ item }) => item.name), ['a', 'b']);
assert.equal(tied[0].path, at('b.md'));
// An empty project lists nothing (S39); its ids still reach the host's decoder.
assert.deepEqual(recentItems(folder, [], new Set()), []);
for (const { item } of full) assert.equal(decodeHomeRequest({ type: 'home/open-recent', id: item.id }).ok, true, item.id);

// ── What waits (R3, R4): cards first, most urgent first, then chats ──

const card = (id: string, title: string, fields: Partial<Card> = {}): Card => ({ id, title, stage: 'doing', rank: 'i', files: [], history: [], description: '', ...fields });
const record = (cardId: string, state: CardHandoffRecordV1['state'], extra: Partial<CardHandoffRecordV1> = {}): CardHandoffRecordV1 => ({
  schemaVersion: 1, cardId, taskId: `t-${cardId}`, runtimeId: 'codex', conversationId: `conv-${cardId}`, conversationTitle: null,
  turnId: null, state, since: '2026-10-19T08:00:00.000Z', createdAt: '2026-10-19T07:00:00.000Z', updatedAt: '2026-10-19T08:00:00.000Z', ...extra,
});
// The board's four calls, through the board's own rules: a hand-off that asks the person,
// a card's question, a result to review, and a hand-off that was interrupted.
const cards = [
  card('hand02', 'Summarise the survey'),
  card('revi01', 'Read the brief', { result: { by: 'claude-code', at: '2026-10-19T08:20:00.000Z', summary: 'Done', files: [], check: [] } }),
  card('deci01', 'Pick a venue', { ask: { by: 'claude-code', at: '2026-10-19T08:10:00.000Z', question: 'Which one?', options: [] } }),
  card('hand01', 'Draft the agenda'),
  card('quiet1', 'Nothing to do', { stage: 'todo' }),
  card('done01', 'Finished', { stage: 'done', ask: { by: 'codex', at: '2026-10-19T08:00:00.000Z', question: 'Old', options: [] } }),
];
const handoffs = handoffViewsFor([record('hand01', 'needs-user', { needs: 'approval' }), record('hand02', 'interrupted')], true);
const tasks = cardItems(callsOf(cards, handoffs), (id) => cards.find((one) => one.id === id)?.title ?? '');
const scopeId = 'scope-leadership';
const chat = (conversationId: string, fields: Partial<ChatIndexEntry>): ChatIndexEntry => ({
  conversationId, scopeId, title: `Chat ${conversationId}`, lastActivityAt: '2026-10-19T08:30:00.000Z', lifecycle: { state: 'idle' }, ...fields,
});
const chats = chatsWaiting([
  chat('c-approval', { title: 'Budget check', lifecycle: { state: 'needs-user', attentionKind: 'approval' }, runtimeSummary: ['claude-code', 'codex'], lastActivityAt: '2026-10-19T08:31:00.000Z' }),
  chat('c-question', { title: 'Venue ideas', lifecycle: { state: 'needs-user', attentionKind: 'question' }, runtimeSummary: ['claude-code'], lastActivityAt: '2026-10-19T08:32:00.000Z' }),
  chat('c-plan', { title: 'Week 2 plan', lifecycle: { state: 'needs-user', attentionKind: 'plan-review' }, runtimeSummary: ['opencode'], lastActivityAt: '2026-10-19T08:33:00.000Z' }),
  chat('c-unread', { title: 'Speaker bios', readAt: '2026-10-19T08:00:00.000Z', lastReplyAt: '2026-10-19T08:34:00.000Z' }),
  chat('c-read', { title: 'Read already', readAt: '2026-10-19T08:40:00.000Z', lastReplyAt: '2026-10-19T08:34:00.000Z', runtimeSummary: ['codex'] }),
  chat('conv-hand01', { title: 'The card’s own chat', lifecycle: { state: 'needs-user', attentionKind: 'approval' } }), // counted through its card
], scopeId, new Set(['c-approval', 'c-question', 'c-plan', 'conv-hand01']), new Set(['conv-hand01', 'conv-hand02']));
const here = summarize(tasks, chats);
const items = waitingItems(here);
assert.deepEqual(items.map((item) => [item.id, item.source, item.kind, item.title, item.ai, item.since]), [
  ['card:hand01', 'card', 'needs-you', 'Draft the agenda', null, '2026-10-19T08:00:00.000Z'],
  ['card:deci01', 'card', 'decision', 'Pick a venue', null, '2026-10-19T08:10:00.000Z'],
  ['card:revi01', 'card', 'review', 'Read the brief', null, '2026-10-19T08:20:00.000Z'],
  ['card:hand02', 'card', 'failed', 'Summarise the survey', null, '2026-10-19T08:00:00.000Z'],
  ['chat:c-approval', 'chat', 'approval', 'Budget check', 'ChatGPT', '2026-10-19T08:31:00.000Z'],
  ['chat:c-question', 'chat', 'question', 'Venue ideas', 'Claude', '2026-10-19T08:32:00.000Z'],
  ['chat:c-plan', 'chat', 'plan-review', 'Week 2 plan', 'OpenCode', '2026-10-19T08:33:00.000Z'],
  ['chat:c-unread', 'chat', 'reply', 'Speaker bios', null, '2026-10-19T08:34:00.000Z'],
]);
assert.equal(here.total, items.length);
// No detail line is known on the host today: a question reads "Claude asks you something in …".
assert.ok(items.every((item) => item.detail === null));
assert.ok(!JSON.stringify(items).includes('Codex'), 'ChatGPT, never Codex');
for (const item of items) assert.equal(decodeHomeRequest({ type: 'home/open-waiting', id: item.id }).ok, true, item.id);

// The board off or unreadable (R13, S22): no card items, chats still listed; nothing at all → none.
assert.deepEqual(waitingItems(summarize([], chats)).map((item) => item.source), ['chat', 'chat', 'chat', 'chat']);
const unreadable = summarize(undefined, chats);
assert.equal(unreadable.total, undefined, 'a board that can’t be read: no number');
assert.equal(waitingItems(unreadable).length, 4);
assert.deepEqual(waitingItems(summarize([], [])), []);

// ── The other projects' line (R3, S9) ──

const waits = (total: number | undefined): ProjectWaiting => ({ tasks: total, chats: 0, total, items: [] });
assert.deepEqual(othersOf([]), [], 'no other projects: nothing to say');
assert.deepEqual(othersOf([
  { name: 'Sales proposal Q4', waiting: waits(2) },
  { name: 'Board report 2026', waiting: waits(0) },
  { name: 'Unreadable', waiting: waits(undefined) },
  { name: 'Not read yet', waiting: undefined },
  { name: 'Research: hybrid work', waiting: waits(1) },
]), [{ name: 'Sales proposal Q4', count: 2 }, { name: 'Research: hybrid work', count: 1 }], 'in the list’s order; nothing waiting and unknown left out');
assert.deepEqual(othersOf([{ name: 'Quiet', waiting: waits(0) }]), []);
assert.equal(othersOf([{ name: 'A', waiting: undefined }, { name: 'B', waiting: waits(undefined) }]), null, 'none can be counted: unknown, not zero');

// R11/S35: What moved, for a profile from Ritemark 1 (the welcome records { at }), until Got it.
assert.equal(showWhatMoved({ at: '2026-10-19T08:00:00.000Z' }, undefined), true);
assert.equal(showWhatMoved(true, undefined), true);
assert.equal(showWhatMoved({ at: '2026-10-19T08:00:00.000Z' }, true), false, 'Got it');
assert.equal(showWhatMoved(undefined, undefined), false, 'a fresh profile never sees it');

// Sprint 142 (R3, #557): the host ends the switch note for a tab chosen or a message sent, once the window has settled
assert.equal(switchNoteEndsOnHost('home-hidden', null), false, 'not before the note was shown');
assert.equal(switchNoteEndsOnHost('home-hidden', SWITCH_NOTE_SETTLE_MS - 1), false, 'the window settling after the switch');
assert.equal(switchNoteEndsOnHost('home-hidden', SWITCH_NOTE_SETTLE_MS + 500), true, 'another tab chosen');
assert.equal(switchNoteEndsOnHost('turn-accepted', 4000), true, 'a message sent on the AI’s sheet');

console.log('projects/homeState: all assertions passed');
