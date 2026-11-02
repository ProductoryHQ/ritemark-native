/**
 * Sprint 148 (R3): chats and tasks as sources, and what the host hands the worker.
 * Run: npx tsx src/search/sources.test.ts
 */
import assert from 'node:assert/strict';
import type { BoardCardView } from '../taskBoard/protocol';
import { enabledPatterns, mergeEvents } from './hostEvents';
import { ChatFeed, chatSource, type ChatFs } from './sources/chats';
import { taskSource, taskState } from './sources/tasks';

const ID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

async function main() {
  // ── A chat record: the person's and the AI's words, nothing else ───────────
  {
    const source = chatSource(
      {
        conversationId: ID,
        title: 'Harbour fees',
        identityColorSlot: 5,
        lastActivityAt: '2026-11-01T09:30:00.000Z',
        events: [
          { kind: 'user-message', eventId: 'u1', turnId: 'turn-1', text: 'How much are the harbour fees?' },
          { kind: 'activity', eventId: 'a1', title: 'Read fees.csv', fileReferences: ['fees.csv'] },
          { kind: 'attention', eventId: 't1', prompt: 'Allow reading?', attentionKind: 'approval' },
          { kind: 'assistant-message', eventId: 'r1', turnId: 'turn-1', runtimeId: 'codex', content: 'They are 120 euros.' },
          { kind: 'dispatch-receipt', eventId: 'd1', dispatchState: 'accepted' },
          { kind: 'user-message', eventId: 'u2', text: 'Background work finished.', origin: 'background-task' },
          { kind: 'assistant-message', eventId: 'r2', content: '   ' },
        ],
      },
      1024,
    )!;
    assert.equal(source.key, `chat:${ID}`);
    assert.equal(source.kind, 'chat');
    assert.equal(source.name, 'Harbour fees');
    assert.equal(source.changedAt, Date.parse('2026-11-01T09:30:00.000Z'));
    assert.deepEqual(source.passages, [
      { text: 'How much are the harbour fees?', at: { eventId: 'u1', speaker: 'you', turnId: 'turn-1' } },
      { text: 'They are 120 euros.', at: { eventId: 'r1', speaker: 'codex', turnId: 'turn-1' } },
    ], 'tool activity, approvals, receipts and the host\'s own lines are left out; each message keeps its turn (PR 2)');
    assert.equal(source.colorSlot, 5, 'the chat keeps its colour on the rail (PR 2)');
    assert.equal(chatSource({ conversationId: ID, title: 't', identityColorSlot: -1, events: [] }, 10)!.colorSlot, undefined, 'no colour for a slot that isn\'t one');
    // At most maxChars of message text, the newest kept.
    const capped = chatSource({ conversationId: ID, title: 't', events: [
      { kind: 'user-message', eventId: 'old', text: 'old '.repeat(100) },
      { kind: 'user-message', eventId: 'new', text: 'newest words' },
    ] }, 20)!;
    assert.deepEqual(capped.passages.map((p) => p.at.eventId), ['old', 'new']);
    assert.ok(capped.passages.reduce((sum, p) => sum + p.text.length, 0) <= 20);
    assert.equal(capped.passages[1].text, 'newest words');
    assert.equal(chatSource({ conversationId: '../escape', title: 'x', events: [] }, 10), null, 'an id that isn\'t one');
    assert.equal(chatSource(null, 10), null);
  }

  // ── The feed: this project's chats only; revisions; deletions; tombstones ──
  {
    const files = new Map<string, string>();
    const fs: ChatFs = {
      readFile: async (target) => {
        const value = files.get(target);
        if (value === undefined) throw new Error('ENOENT');
        return value;
      },
      exists: async (target) => files.has(target),
    };
    const record = (id: string, title: string) => JSON.stringify({ conversationId: id, title, events: [{ kind: 'user-message', eventId: 'e', text: title }] });
    const index = (entries: object[]) => files.set('/store/index.json', JSON.stringify({ schemaVersion: 1, entries }));
    files.set(`/store/records/${ID}.json`, record(ID, 'Mine'));
    files.set(`/store/records/${OTHER}.json`, record(OTHER, 'Another project'));
    index([
      { conversationId: ID, scopeId: 'ps1-mine', revision: 1, integrity: 'verified' },
      { conversationId: OTHER, scopeId: 'ps1-other', revision: 1, integrity: 'verified' },
    ]);
    const feed = new ChatFeed('/store', 'ps1-mine', 1024, fs);
    let refresh = await feed.refresh();
    assert.deepEqual(refresh.upserts.map((s) => s.name), ['Mine'], 'filtered by the project\'s scope');
    refresh = await feed.refresh();
    assert.deepEqual(refresh, { upserts: [], removed: [] }, 'an unchanged revision isn\'t read again');
    files.set(`/store/records/${ID}.json`, record(ID, 'Mine, renamed'));
    index([{ conversationId: ID, scopeId: 'ps1-mine', revision: 2, integrity: 'verified' }]);
    refresh = await feed.refresh();
    assert.deepEqual(refresh.upserts.map((s) => s.name), ['Mine, renamed']);
    index([{ conversationId: ID, scopeId: 'ps1-mine', revision: 3, integrity: 'corrupt' }]);
    refresh = await feed.refresh();
    assert.deepEqual(refresh.removed, [`chat:${ID}`], 'a corrupt chat goes');
    index([{ conversationId: ID, scopeId: 'ps1-mine', revision: 4, integrity: 'verified' }]);
    files.set(`/store/tombstones/${ID}.json`, '{}');
    refresh = await feed.refresh();
    assert.deepEqual(refresh, { upserts: [], removed: [] }, 'a tombstone: never shown');
    files.set('/store/index.json', '{ half-written');
    assert.deepEqual(await feed.refresh(), { upserts: [], removed: [] }, 'an index being written changes nothing');
  }

  // ── Tasks: title, Done when, description; the state in words ───────────────
  {
    const card = (over: Partial<BoardCardView>): BoardCardView => ({
      id: 'c1', title: 'Paint the lighthouse', doneWhen: 'It is white again', stage: 'doing', rank: 'a', description: 'Buy paint.\n\nAsk the keeper.',
      files: [], created: '2026-10-01T00:00:00.000Z', updated: '2026-10-02T00:00:00.000Z', result: null, ask: null, review: null, reviewing: null,
      reviewFailure: null, dropped: false, archived: null, history: [], copiedFrom: null, handoff: null, move: null, call: null, nextUp: false,
      locked: false, checkboxes: { done: 0, total: 0 }, ...over,
    });
    const source = taskSource(card({}));
    assert.equal(source.key, 'task:c1');
    assert.equal(source.where, 'Doing');
    assert.equal(source.changedAt, Date.parse('2026-10-02T00:00:00.000Z'));
    assert.deepEqual(source.passages, [
      { text: 'It is white again', at: { field: 'doneWhen' } },
      { text: 'Buy paint.', at: { field: 'description', block: 0 } },
      { text: 'Ask the keeper.', at: { field: 'description', block: 1 } },
    ]);
    assert.equal(taskState(card({ call: 'needs-you' })), 'Waiting for you');
    assert.equal(taskState(card({ archived: '2026-10-03T00:00:00.000Z' })), 'Archived');
    assert.equal(taskState(card({ stage: 'todo' })), 'To do');
    assert.deepEqual(taskSource(card({ doneWhen: null, description: '' })).passages, []);
  }

  // ── The host's side ─────────────────────────────────────────────────────────
  assert.deepEqual(enabledPatterns({ '**/.ritemark': true, '**/*.log': false, '**/*.js': { when: '$(basename).ts' } }), ['**/.ritemark']);
  assert.deepEqual(enabledPatterns(undefined), []);
  assert.deepEqual(
    mergeEvents([
      { kind: 'created', path: '/a' },
      { kind: 'changed', path: '/a' },
      { kind: 'changed', path: '/b' },
      { kind: 'deleted', path: '/b' },
      { kind: 'deleted', path: '/c' },
      { kind: 'created', path: '/c' },
    ]),
    [{ kind: 'created', path: '/a' }, { kind: 'deleted', path: '/b' }, { kind: 'created', path: '/c' }],
  );

  console.log('sources.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
