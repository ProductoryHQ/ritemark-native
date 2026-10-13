/**
 * W13 (Sprint 130, found on Windows): a turn that a crash or a forced quit
 * left running. Only a clean shutdown recorded it as interrupted, so after a
 * restart the AI sidebar read the turn as running and held the conversation's
 * queue behind it: a task-board card's Retry stayed "Queued for Claude".
 *
 * The whole path: the durable record after the crash, the startup sweep, the
 * projection the sidebar loads for the card's conversation, and whether the
 * sidebar's queue drains.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationController } from './ConversationController';
import { ConversationStore } from './ConversationStore';
import { resolveProjectScope } from './projectScope';
import type { ConversationProjectionV1 } from './protocol';
import { projectionToConversation } from '../../webview/src/components/ai-sidebar/conversationProjection';
import { deriveActivityState } from '../../webview/src/components/ai-sidebar/activityState';
import { isReadyToDrain } from '../../webview/src/components/ai-sidebar/promptQueue';

async function main(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-turns-left-'));
  const scope = resolveProjectScope({ folderUris: ['file:///C:/Users/test/RM130%20Test'], platform: 'win32' });
  const otherScope = resolveProjectScope({ folderUris: ['file:///C:/Users/test/Other'], platform: 'win32' });
  const store = new ConversationStore(temp);
  try {
    // The session that crashed: a card at work, a card waiting on a question,
    // and a turn in another folder's window.
    const before = new ConversationController({ store, currentScope: () => scope });
    const working = await before.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Draft the slides' });
    const accepted = await before.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Book the room' });
    const asking = await before.attentionRuntimeTurn({
      conversationId: accepted.conversationId,
      bindingGeneration: accepted.bindingGeneration,
      runtimeId: 'claude-code',
      attentionKind: 'question',
      prompt: 'Which room?',
    });
    assert.equal(asking.lifecycle.state, 'needs-user');
    const elsewhere = await new ConversationController({ store, currentScope: () => otherScope })
      .acceptRuntimeTurn({ agentId: 'codex', text: 'Runs in the other window' });
    // No prepareForShutdown: the app was killed.

    // A new extension host, before its sweep: the sidebar reads the dead turn
    // as running, and its queue holds the card's Retry.
    const after = new ConversationController({ store, currentScope: () => scope });
    const sidebarState = async (conversationId: string) => {
      const answer = await after.handle({ type: 'conversation/get', requestId: `get-${conversationId}`, conversationId });
      assert.ok(answer.ok && 'conversation' in answer.data && answer.data.conversation, 'the card’s conversation loads');
      const projection = (answer.ok && 'conversation' in answer.data ? answer.data.conversation : null) as ConversationProjectionV1;
      return deriveActivityState(projectionToConversation(projection));
    };
    assert.equal(await sidebarState(working.conversationId), 'running', 'the bug: a turn nothing runs reads as running');
    assert.equal(isReadyToDrain('running'), false);

    // A conversation with a live session in this host is left alone.
    const live = await after.acceptRuntimeTurn({ agentId: 'claude-code', text: 'Started in this session' });

    // The startup sweep.
    const swept = await after.interruptTurnsLeftByRestart((conversationId) => conversationId === live.conversationId);
    assert.deepEqual([...swept].sort(), [working.conversationId, asking.conversationId].sort(), 'both turns the crash left');
    for (const conversationId of swept) {
      const record = await store.get(conversationId);
      assert.deepEqual(record?.lifecycle.state === 'interrupted' ? record.lifecycle.reason : record?.lifecycle.state, 'restart');
      const boundary = record?.events.at(-1);
      assert.equal(boundary?.kind === 'boundary' ? boundary.message : null, 'Ritemark closed while this turn was running.');
    }
    assert.equal((await store.get(live.conversationId))?.lifecycle.state, 'working', 'a live turn keeps running');
    assert.equal((await store.get(elsewhere.conversationId))?.lifecycle.state, 'working', 'another folder’s window owns its turns');

    // The fix: the sidebar's queue drains, so Retry's prompt starts…
    assert.ok(isReadyToDrain(await sidebarState(working.conversationId)), 'Retry starts');
    assert.ok(isReadyToDrain(await sidebarState(asking.conversationId)), 'and after a question too');
    // …as a new turn in the same conversation.
    const retried = await after.acceptRuntimeTurn({ conversationId: working.conversationId, agentId: 'claude-code', text: 'Draft the slides' });
    assert.equal(retried.conversationId, working.conversationId);
    assert.equal(retried.lifecycle.state, 'working');

    console.log('conversations/turnsLeftByRestart: all assertions passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
