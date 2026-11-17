/**
 * Sprint 160 (#686): a turn that stopped at a usage limit says so after it.
 * - The summary (and so the index) carries the failure's kind, so the rail and
 *   the chat list say "Limit reached" instead of "Interrupted". Older builds drop it.
 * - The next message, with or without a model switch, no longer adds "The
 *   previous agent did not return a saved answer.": the failed turn has a
 *   recorded end. A turn a restart ended still gets the line.
 *
 * Run: npx tsx src/conversations/usageLimit.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ConversationController } from './ConversationController';
import { ConversationStore } from './ConversationStore';
import { buildNormalizedContextPack } from './contextPack';
import { resolveProjectScope } from './projectScope';
import { decodeLastFailure, lastFailureOf, summarizeConversationRecord, type ConversationRecordV1 } from './types';
import { transcriptRestoredState } from '../runtime/continuation';
import { makeTempDir } from '../testing/tempDir';

function uuid(value: number): string {
  return `30000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

const LIMIT_SENTENCE = "You've used Gemini 3.8 Flash's limit for now. Try again later, or use another model.";

async function run(): Promise<void> {
  const temp = makeTempDir('ritemark-usage-limit-');
  const scope = resolveProjectScope({ folderUris: ['file:///p'], platform: 'darwin' });
  let nextId = 1;
  let clock = Date.parse('2026-11-16T01:00:00.000Z');
  const now = () => new Date(clock);
  const randomId = () => uuid(nextId++);
  const store = new ConversationStore(temp, { randomId, now });
  const controller = new ConversationController({ store, currentScope: () => scope, randomId, now });

  /** The context the next message's fresh session gets, as the host builds it. */
  const nextMessageState = (record: ConversationRecordV1) => {
    const user = [...record.events].reverse().find((event) => event.kind === 'user-message');
    assert.ok(user);
    const context = buildNormalizedContextPack(record, { beforeEventId: user.eventId });
    assert.ok(context);
    return transcriptRestoredState(context);
  };

  // ── A first turn answers; the second stops at Gemini's usage limit ──
  const first = await controller.acceptRuntimeTurn({ agentId: 'opencode', text: 'Summarise the notes' });
  clock += 10_000;
  await controller.completeRuntimeTurn({
    conversationId: first.conversationId, bindingGeneration: first.bindingGeneration, runtimeId: 'opencode', text: 'Here it is.', status: 'completed',
  });
  const second = await controller.acceptRuntimeTurn({ conversationId: first.conversationId, bindingGeneration: first.bindingGeneration, agentId: 'opencode', text: 'Now shorten it' });
  clock += 70_000;
  const failed = await controller.completeRuntimeTurn({
    conversationId: first.conversationId,
    bindingGeneration: second.bindingGeneration,
    runtimeId: 'opencode',
    text: '',
    status: 'failed',
    error: LIMIT_SENTENCE,
    errorKind: 'limit',
    errorDetail: { limit: 'plan', model: 'google/gemini-3.8-flash', retryAt: new Date(clock + 41_000).toISOString() },
  });
  assert.equal(failed.lifecycle.state, 'interrupted');
  // The model too: OpenCode's rail tooltip names it (the Experience lead, 16 November).
  const FLASH_LIMIT = { runtimeId: 'opencode', kind: 'limit', limit: 'plan', model: 'google/gemini-3.8-flash' };
  assert.deepEqual(lastFailureOf(failed), FLASH_LIMIT);

  // ── The summary carries it, through the index and a fresh store ──
  assert.deepEqual(summarizeConversationRecord(failed, 'now').lastFailure, FLASH_LIMIT);
  const freshStore = new ConversationStore(temp, { randomId, now });
  const listed = (await freshStore.list(scope.scopeId)).find((entry) => entry.conversationId === first.conversationId);
  assert.deepEqual(listed?.lastFailure, FLASH_LIMIT, 'read back from the index');

  // An index written before Sprint 160 has no field, and a malformed one is dropped; neither quarantines a chat.
  const indexFile = path.join(temp, 'index.json');
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { entries: Array<Record<string, unknown>> };
  for (const entry of index.entries) delete entry.lastFailure;
  fs.writeFileSync(indexFile, JSON.stringify(index));
  const olderIndex = await new ConversationStore(temp, { randomId, now }).list(scope.scopeId);
  assert.equal(olderIndex.length, 1);
  assert.equal(olderIndex[0].integrity, 'verified');
  assert.deepEqual(olderIndex[0].lastFailure, FLASH_LIMIT, 'this build fills it in again from the record');
  for (const odd of [{ runtimeId: 'legacy-ritemark', kind: 'limit' }, { runtimeId: 'opencode', kind: 'plan' }, 'limit', null, []]) {
    assert.equal(decodeLastFailure(odd), undefined, JSON.stringify(odd));
  }
  assert.deepEqual(decodeLastFailure({ runtimeId: 'codex', kind: 'limit', limit: 'later' }), { runtimeId: 'codex', kind: 'limit' }, 'an unknown limit is dropped, the kind kept');
  for (const model of [42, '', ' ', 'x'.repeat(257)]) {
    assert.deepEqual(decodeLastFailure({ runtimeId: 'opencode', kind: 'limit', limit: 'plan', model }), { runtimeId: 'opencode', kind: 'limit', limit: 'plan' }, `a model of ${JSON.stringify(model).slice(0, 12)} is dropped`);
  }

  // ── The next message: no "did not return a saved answer", with or without a model switch ──
  const retry = await controller.acceptRuntimeTurn({ conversationId: first.conversationId, bindingGeneration: failed.bindingGeneration, agentId: 'opencode', text: 'Try once more' });
  assert.equal(nextMessageState(retry).unansweredPriorRequest, false, 'the same model');
  assert.equal(retry.events.some((event) => event.kind === 'boundary' && /did not return a saved answer/.test(event.message)), false);
  assert.equal(lastFailureOf(retry), undefined, 'a new turn clears the mark');
  clock += 5_000;
  const failedAgain = await controller.completeRuntimeTurn({
    conversationId: first.conversationId, bindingGeneration: retry.bindingGeneration, runtimeId: 'opencode', text: '', status: 'failed',
    error: LIMIT_SENTENCE, errorKind: 'limit', errorDetail: { limit: 'plan', model: 'google/gemini-3.8-flash' },
  });
  // Another AI: the switch's own boundary says "Continuing with Claude" without the line.
  const handoff = await controller.acceptRuntimeTurn({ conversationId: first.conversationId, bindingGeneration: failedAgain.bindingGeneration, agentId: 'claude-code', text: 'You try' });
  assert.equal(nextMessageState(handoff).unansweredPriorRequest, false, 'another AI');
  const switchBoundary = handoff.events.filter((event) => event.kind === 'boundary' && event.boundaryKind === 'context-restored').at(-1);
  assert.match(switchBoundary?.kind === 'boundary' ? switchBoundary.message : '', /^Continuing with Claude\. Previous messages were included as context\.$/);

  // ── A completed answer clears the mark; a stop or a restart never sets it ──
  clock += 5_000;
  const answered = await controller.completeRuntimeTurn({
    conversationId: first.conversationId, bindingGeneration: handoff.bindingGeneration, runtimeId: 'claude-code', text: 'Shorter now.', status: 'completed',
  });
  assert.equal(summarizeConversationRecord(answered, 'now').lastFailure, undefined);

  // ── A turn a restart ended still gives the line ──
  const left = await controller.acceptRuntimeTurn({ conversationId: first.conversationId, bindingGeneration: answered.bindingGeneration, agentId: 'opencode', text: 'One more pass' });
  await controller.interruptRuntimeAttachments([first.conversationId], 'restart');
  const afterRestart = await store.get(first.conversationId);
  assert.ok(afterRestart);
  assert.deepEqual(afterRestart.lifecycle, { state: 'interrupted', turnId: left.lifecycle.state === 'working' ? left.lifecycle.activeTurnId : '', reason: 'restart' });
  assert.equal(lastFailureOf(afterRestart), undefined, 'a restart is not a failure');
  const resumed = await controller.acceptRuntimeTurn({ conversationId: first.conversationId, bindingGeneration: afterRestart.bindingGeneration, agentId: 'opencode', text: 'Again, please' });
  assert.equal(nextMessageState(resumed).unansweredPriorRequest, true, 'a restart has no recorded end');

  console.log('usageLimit tests: all assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
