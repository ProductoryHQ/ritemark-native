/**
 * Sprint 134 (R3, R6, S8–S12, S62): what waits, in a project read from disk.
 * Run: npx tsx src/projects/waiting.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { resolveProjectScope } from '../conversations/projectScope';
import { serializeCard, type Card } from '../taskBoard/cardFile';
import { cardTaskStoreDir, type CardHandoffRecordV1 } from '../taskBoard/CardTaskStore';
import { chatsWaiting, hasUnreadReply, WaitingReader, type ChatIndexEntry } from './waiting';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-waiting-'));
const globalStoragePath = path.join(root, 'globalStorage');
const folderPath = path.join(root, 'Sales proposal Q4');
const folderUri = pathToFileURL(folderPath).toString();
const scopeId = resolveProjectScope({ folderUris: [folderUri] }).scopeId;

function card(id: string, fields: Partial<Card>): void {
  const base: Card = { id, title: `Card ${id}`, stage: 'todo', rank: 'i', files: [], history: [], description: '', ...fields };
  const dir = path.join(folderPath, '.ritemark', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}-card.md`), serializeCard(base));
}

function handoff(cardId: string, state: CardHandoffRecordV1['state'], conversationId: string | null, extra: Partial<CardHandoffRecordV1> = {}): void {
  const dir = cardTaskStoreDir(globalStoragePath, folderPath);
  fs.mkdirSync(dir, { recursive: true });
  const record: CardHandoffRecordV1 = {
    schemaVersion: 1, cardId, taskId: `t-${cardId}`, runtimeId: 'claude-code', conversationId, conversationTitle: null,
    turnId: null, state, since: '2026-10-19T08:00:00.000Z', createdAt: '2026-10-19T07:00:00.000Z', updatedAt: '2026-10-19T08:00:00.000Z', ...extra,
  };
  fs.writeFileSync(path.join(dir, `${cardId}.json`), JSON.stringify(record));
}

function chat(conversationId: string, fields: Partial<ChatIndexEntry> = {}): ChatIndexEntry {
  return { conversationId, scopeId, title: `Chat ${conversationId}`, lastActivityAt: '2026-10-19T09:00:00.000Z', lifecycle: { state: 'idle' }, ...fields };
}

function writeIndex(entries: unknown[] | string): void {
  const dir = path.join(globalStoragePath, 'conversations', 'v1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), typeof entries === 'string' ? entries : JSON.stringify({ schemaVersion: 1, entries }));
}

function writeJson(dir: string, name: string, value: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
}

const alive = new Set([111, 333]);
const isAlive = (pid: number): boolean => alive.has(pid);
let boardOn = true;

async function main(): Promise<void> {
  // ── The unread rule ──
  assert.equal(hasUnreadReply({}), false, 'no marker: read (chats from before this build)');
  assert.equal(hasUnreadReply({ lastReplyAt: '2026-10-19T09:00:00.000Z' }), false);
  assert.equal(hasUnreadReply({ readAt: '2026-10-19T08:00:00.000Z', lastReplyAt: '2026-10-19T09:00:00.000Z' }), true);
  assert.equal(hasUnreadReply({ readAt: '2026-10-19T09:00:00.000Z', lastReplyAt: '2026-10-19T09:00:00.000Z' }), false);

  // ── A board with every kind of call ──
  card('aaaaa1', { stage: 'doing', result: { by: 'claude', at: '2026-10-19T07:30:00.000Z', summary: 'Done', files: [], check: [] } });
  card('aaaaa2', { ask: { by: 'claude', at: '2026-10-19T07:10:00.000Z', question: 'Which?', options: [] } });
  card('aaaaa3', { stage: 'done', archived: '2026-10-19T06:00:00.000Z', ask: { by: 'claude', at: '2026-10-19T07:00:00.000Z', question: 'Old', options: [] } });
  card('aaaaa4', { stage: 'doing', title: 'Card left running' });
  card('aaaaa5', { stage: 'done' });
  card('aaaaa6', { stage: 'doing' });
  handoff('aaaaa4', 'running', 'card-chat');
  handoff('aaaaa6', 'failed', 'card-chat-2', { failure: 'It stopped.' });

  writeIndex([
    chat('c-approval', { lifecycle: { state: 'needs-user', attentionKind: 'approval' }, lastActivityAt: '2026-10-19T09:01:00.000Z' }),
    chat('c-stale', { lifecycle: { state: 'needs-user', attentionKind: 'question' } }),
    chat('c-unread', { readAt: '2026-10-19T08:00:00.000Z', lastReplyAt: '2026-10-19T08:30:00.000Z' }),
    chat('c-read', { readAt: '2026-10-19T09:00:00.000Z', lastReplyAt: '2026-10-19T08:30:00.000Z' }),
    chat('c-old', { lastReplyAt: '2026-10-19T08:30:00.000Z' }),
    chat('card-chat', { readAt: '2026-10-19T08:00:00.000Z', lastReplyAt: '2026-10-19T08:30:00.000Z' }),
    chat('c-elsewhere', { scopeId: 'ps1-another', lifecycle: { state: 'needs-user', attentionKind: 'question' } }),
    { conversationId: 'broken' },
  ]);
  const owners = path.join(globalStoragePath, 'conversations', 'owners');
  writeJson(owners, '111.json', ['c-approval', 'c-elsewhere']);
  writeJson(owners, '222.json', ['c-stale']);

  const reader = new WaitingReader({ globalStoragePath, boardEnabled: () => boardOn, isAlive });

  // S8–S11, S62: in no live window, the card left running is a failed call.
  {
    const waiting = await reader.read(folderUri, folderPath);
    assert.deepEqual(waiting.items.map((item) => `${item.source}:${item.kind}:${'cardId' in item ? item.cardId : item.conversationId}`), [
      'card:decision:aaaaa2',
      'card:review:aaaaa1',
      'card:failed:aaaaa4',
      'card:failed:aaaaa6',
      'chat:reply:c-unread',
      'chat:approval:c-approval',
    ]);
    assert.equal(waiting.tasks, 4);
    assert.equal(waiting.chats, 2, 'a stale question, a read chat, an old chat and a card’s chat are not counted');
    assert.equal(waiting.total, 6);
    assert.equal(waiting.items[2].title, 'Card left running');
  }

  // A live window holds the project: the running card is the agent's move.
  {
    writeJson(path.join(globalStoragePath, 'projects', 'v1', 'windows'), '333.json', { folderUri: folderUri.replace(/\/$/, '') + '/' });
    writeJson(path.join(globalStoragePath, 'projects', 'v1', 'windows'), '444.json', { folderUri: 'file:///elsewhere' });
    const waiting = await reader.read(folderUri, folderPath);
    assert.equal(waiting.tasks, 3);
    assert.ok(!waiting.items.some((item) => item.source === 'card' && item.cardId === 'aaaaa4'));
  }

  // R13, S22: the board flag off counts no tasks; chats still count.
  {
    boardOn = false;
    const waiting = await reader.read(folderUri, folderPath);
    assert.deepEqual([waiting.tasks, waiting.chats, waiting.total], [0, 2, 2]);
    boardOn = true;
  }

  // The open project's live board wins over the files.
  {
    const waiting = await reader.read(folderUri, folderPath, {
      calls: [{ cardId: 'live01', kind: 'needs-you', since: '2026-10-19T06:00:00.000Z' }],
      titleOf: () => 'From the controller',
      conversationIds: new Set(['c-unread', 'card-chat', 'card-chat-2']),
    });
    assert.deepEqual([waiting.tasks, waiting.chats], [1, 1]);
    assert.equal(waiting.items[0].title, 'From the controller');
  }

  // No board at all: zero, never unknown.
  {
    const empty = path.join(root, 'Empty');
    fs.mkdirSync(empty);
    const waiting = await reader.read(pathToFileURL(empty).toString(), empty);
    assert.deepEqual([waiting.tasks, waiting.chats, waiting.total], [0, 0, 0]);
  }

  // A task folder that can't be read: no count, rather than a wrong one.
  if (process.getuid?.() !== 0) {
    const tasks = path.join(folderPath, '.ritemark', 'tasks');
    fs.chmodSync(tasks, 0o000);
    try {
      const waiting = await reader.read(folderUri, folderPath);
      assert.equal(waiting.tasks, undefined);
      assert.equal(waiting.total, undefined);
      assert.equal(waiting.chats, 2, 'its chats are still known');
    } finally {
      fs.chmodSync(tasks, 0o755);
    }
  }

  // An index that can't be read: no count anywhere; none at all: no chats.
  {
    writeIndex('{ not json');
    const broken = await reader.read(folderUri, folderPath);
    assert.equal(broken.chats, undefined);
    assert.equal(broken.total, undefined);
    fs.rmSync(path.join(globalStoragePath, 'conversations', 'v1', 'index.json'));
    const none = await reader.read(folderUri, folderPath);
    assert.equal(none.chats, 0);
  }

  // Other projects are read once per show, then kept for 30 s.
  {
    let now = 1_000;
    const cached = new WaitingReader({ globalStoragePath, boardEnabled: () => true, isAlive, now: () => now });
    const first = await cached.readMany([{ folderUri, folderPath }]);
    card('aaaaa7', { ask: { by: 'claude', at: '2026-10-19T09:30:00.000Z', question: 'New?', options: [] } });
    now += 10_000;
    assert.equal((await cached.readMany([{ folderUri, folderPath }])).get(folderUri)?.tasks, first.get(folderUri)?.tasks);
    now += 25_000;
    assert.equal((await cached.readMany([{ folderUri, folderPath }])).get(folderUri)?.tasks, (first.get(folderUri)?.tasks ?? 0) + 1);
  }

  // Nothing read was written to: no record moved aside, no owner file removed.
  {
    fs.writeFileSync(path.join(cardTaskStoreDir(globalStoragePath, folderPath), 'zzzzzz.json'), '{ not json');
    await reader.read(folderUri, folderPath);
    assert.ok(fs.existsSync(path.join(cardTaskStoreDir(globalStoragePath, folderPath), 'zzzzzz.json')));
    assert.ok(fs.existsSync(path.join(owners, '222.json')), 'a dead window’s claims are skipped, not removed');
  }

  // The chats rule on its own: the scope and a card's chat.
  {
    const items = chatsWaiting([chat('x', { scopeId: 'ps1-other', readAt: 'a', lastReplyAt: 'b' })], scopeId, new Set(), new Set());
    assert.deepEqual(items, []);
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('projects/waiting: all assertions passed');
}

main().catch((error) => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
