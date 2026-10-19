/**
 * Sprint 134 (R3, S62): a chat's unread reply. Jarmo, 19 October: "Also unread answers".
 * Run: npx tsx src/conversations/readMarker.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationController } from './ConversationController';
import { ConversationStore } from './ConversationStore';
import { resolveProjectScope } from './projectScope';
import { decodeConversationRecordV1, hasUnreadReply, lastReplyAtOf, type ConversationEventV1 } from './types';

function uuid(value: number): string {
  return `20000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-read-marker-'));
  const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });
  let nextId = 1;
  let clock = Date.parse('2026-10-19T09:00:00.000Z');
  const now = () => new Date(clock);
  const tick = (seconds: number) => { clock += seconds * 1000; };
  const store = new ConversationStore(temp, { randomId: () => uuid(nextId++), now });
  let inFront: string | null = null;
  const controller = new ConversationController({
    store,
    currentScope: () => scope,
    randomId: () => uuid(nextId++),
    now,
    isInFront: (id) => id === inFront,
  });

  try {
    // ── lastReplyAtOf: replies and failures, not a stop or a restart ──
    const base = { eventId: 'e', turnId: 't', sequence: 0, runtimeId: 'claude-code' as const };
    const at = (minute: number) => `2026-10-19T09:0${minute}:00.000Z`;
    const events: ConversationEventV1[] = [
      { ...base, kind: 'assistant-message', occurredAt: at(1), content: 'Hi', terminalStatus: 'completed' },
      { ...base, kind: 'boundary', occurredAt: at(2), boundaryKind: 'failed', message: 'It failed.' },
      { ...base, kind: 'assistant-message', occurredAt: at(3), content: 'Stopped', terminalStatus: 'cancelled' },
      { ...base, kind: 'boundary', occurredAt: at(4), boundaryKind: 'interrupted', message: 'Restart' },
    ];
    assert.equal(lastReplyAtOf(events), at(2));
    assert.equal(lastReplyAtOf([]), undefined);

    async function chatWithReply(text: string): Promise<string> {
      const accepted = await controller.acceptRuntimeTurn({ agentId: 'claude-code', text });
      tick(5);
      await controller.completeRuntimeTurn({
        conversationId: accepted.conversationId,
        bindingGeneration: accepted.bindingGeneration,
        runtimeId: 'claude-code',
        text: `Answer to ${text}`,
        status: 'completed',
      });
      tick(5);
      return accepted.conversationId;
    }
    const summary = async (id: string) => (await store.list(scope.scopeId)).find((entry) => entry.conversationId === id)!;

    // ── A reply that finishes while another chat is in front is unread, in the index too ──
    const away = await chatWithReply('Plan Module 5');
    const unread = await summary(away);
    assert.equal(hasUnreadReply(unread), true);
    assert.ok(unread.readAt! < unread.lastReplyAt!);
    const raw = JSON.parse(fs.readFileSync(path.join(temp, 'index.json'), 'utf8')) as { entries: Array<{ conversationId: string; readAt?: string; lastReplyAt?: string }> };
    const rawEntry = raw.entries.find((entry) => entry.conversationId === away)!;
    assert.equal(hasUnreadReply(rawEntry), true, 'other windows count it from index.json');

    // ── Titled by its first message: the index says so, for Home's quote; a renamed chat is named ──
    assert.equal(unread.titleIsFirstMessage, true);
    assert.equal((rawEntry as { titleIsFirstMessage?: boolean }).titleIsFirstMessage, true);
    const named = await chatWithReply('Draft the venue email. Keep it short.');
    assert.equal((await summary(named)).title, 'Draft the venue email.');
    assert.equal((await summary(named)).titleIsFirstMessage, true, 'the title is the first sentence of the first message');
    const record = (await store.get(named))!;
    await store.checkpoint({ conversationId: named, bindingGeneration: record.bindingGeneration, expectedRevision: record.revision, title: 'Venue email' });
    assert.equal((await summary(named)).titleIsFirstMessage, undefined);

    // ── Shown in front: read; the chat keeps its place in the rail ──
    const before = await store.get(away);
    tick(60);
    await controller.markRead(away);
    const read = await summary(away);
    assert.equal(hasUnreadReply(read), false);
    assert.equal(read.lastActivityAt, before!.lastActivityAt, 'reading is not activity');
    // Nothing unread: nothing written.
    const revision = (await store.get(away))!.revision;
    await controller.markRead(away);
    assert.equal((await store.get(away))!.revision, revision);

    // ── A reply that finishes while its chat is in front is read at once ──
    const accepted = await controller.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Draft the agenda' });
    inFront = accepted.conversationId;
    tick(5);
    await controller.completeRuntimeTurn({
      conversationId: accepted.conversationId,
      bindingGeneration: accepted.bindingGeneration,
      runtimeId: 'claude-code',
      text: 'Here it is',
      status: 'completed',
    });
    assert.equal(hasUnreadReply(await summary(accepted.conversationId)), false);
    inFront = null;

    // ── A turn the person stopped is not an unread reply ──
    const stopped = await controller.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Never mind' });
    tick(5);
    await controller.completeRuntimeTurn({
      conversationId: stopped.conversationId,
      bindingGeneration: stopped.bindingGeneration,
      runtimeId: 'claude-code',
      text: '',
      status: 'cancelled',
    });
    assert.equal(hasUnreadReply(await summary(stopped.conversationId)), false);

    // ── A failed turn is: the person should see it ──
    const failed = await controller.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Try this' });
    tick(5);
    await controller.completeRuntimeTurn({
      conversationId: failed.conversationId,
      bindingGeneration: failed.bindingGeneration,
      runtimeId: 'claude-code',
      text: '',
      status: 'failed',
      error: 'Claude stopped answering.',
    });
    assert.equal(hasUnreadReply(await summary(failed.conversationId)), true);

    // ── A chat from before this build (no marker) counts as read ──
    const old = await store.get(away);
    const { readAt: _readAt, ...withoutMarker } = old!;
    const decoded = decodeConversationRecordV1(withoutMarker);
    assert.equal(decoded.readAt, undefined);
    assert.equal(hasUnreadReply({ lastReplyAt: lastReplyAtOf(decoded.events) }), false);
    // A marker that isn't a time is dropped, not a reason to quarantine the chat.
    assert.equal(decodeConversationRecordV1({ ...old, readAt: 'yesterday' }).readAt, undefined);
  } finally {
    controller.dispose?.();
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log('readMarker.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
