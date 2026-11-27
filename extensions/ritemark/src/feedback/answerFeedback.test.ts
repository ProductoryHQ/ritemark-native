import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConsentGate, type CaptureClient } from '../analytics/consent';
import type { AgentId } from '../agent/types';
import type { AssistantMessageEventV1, ConversationLifecycleV1, ConversationRecordV1 } from '../conversations/types';
import { GUIDANCE_KEY, GuidanceStore } from '../guidance/guidanceStore';
import { AnswerFeedbackHost, decodeSidebarFeedbackOpen, findCompletedAnswer } from './answerFeedback';
import type { AnswerReaction } from './answerFeedbackProtocol';

const conversationId = '10000000-0000-4000-8000-000000000001';
const otherConversation = '10000000-0000-4000-8000-000000000002';
const ref = { conversationId, turnId: 'middle-turn' };
const now = '2026-11-27T10:00:00.000Z';
const answer = (turnId: string, sequence: number, terminalStatus: AssistantMessageEventV1['terminalStatus'], runtimeId: AgentId = 'codex'): AssistantMessageEventV1 => ({
  kind: 'assistant-message', eventId: 'event-' + sequence, turnId, sequence, occurredAt: now,
  runtimeId, terminalStatus, content: 'Answer for ' + turnId,
});
function record(
  events: ConversationRecordV1['events'] = [
    answer('first-turn', 1, 'completed', 'claude-code'),
    answer(ref.turnId, 2, 'completed'),
    answer('last-turn', 3, 'completed', 'opencode'),
  ],
  lifecycle: ConversationLifecycleV1 = { state: 'idle' },
): ConversationRecordV1 {
  return {
    schemaVersion: 1, conversationId, scopeId: 'test', title: 'Picking the right answer',
    scope: { kind: 'no-folder', folderUris: [], workspaceFileUri: null },
    createdAt: now, lastActivityAt: now, revision: 1, identityColorSlot: 0,
    bindingGeneration: 1, lifecycle, runtimeSummary: ['claude-code', 'codex', 'opencode'],
    events, composerPreferences: { thinkingEffortByRuntime: {} },
  };
}

function harness(on: boolean, source = record()) {
  let saved: unknown;
  let writes = 0;
  const guidance = new GuidanceStore({
    get: <T>(key: string) => key === GUIDANCE_KEY ? saved as T | undefined : undefined,
    update: async (_key, value) => { saved = value; writes++; },
  }, '2.4.0');
  const events: Parameters<CaptureClient['captureImmediate']>[0][] = [];
  const settings = { active: conversationId, offline: false };
  const gate = new ConsentGate({
    readSetting: () => on,
    analyticsAllowed: () => true,
    createClient: () => ({
      captureImmediate: async (payload) => {
        if (settings.offline) throw new Error('Offline');
        events.push(payload);
      },
      shutdown: async () => {},
    }),
    anonymousId: () => 'consented',
    oneOffId: () => 'one-off',
    sharedProperties: () => ({}),
    sessionProperties: () => ({}),
  });
  const host = new AnswerFeedbackHost({
    guidance,
    activeConversation: () => settings.active,
    readConversation: async (id) => {
      assert.equal(id, conversationId);
      return source;
    },
    trackAnswerReaction: (reaction, ai) => gate.track('ai_answer_reacted', { reaction, ai }),
    sendFeedback: (messages) => gate.sendFeedback(messages),
  });
  return { guidance, host, events, settings, get writes() { return writes; } };
}

function press(host: AnswerFeedbackHost, reaction: AnswerReaction, turn = ref) {
  return host.react({ type: 'agent:answerReaction', ...turn, reaction });
}

test('only the active conversation, fixed marks and the latest state of a completed turn are eligible', async () => {
  const { host, settings, events, guidance } = harness(true, record([
    answer(ref.turnId, 2, 'completed'),
    answer('pending', 3, null),
    answer('failed', 4, 'failed'),
    answer('stopped', 5, 'cancelled'),
    { ...answer('blank', 5, 'completed'), content: ' \n ' },
    answer('working', 6, 'completed'),
    answer('reopened', 7, 'completed'),
    { eventId: '8', turnId: 'reopened', sequence: 8, occurredAt: now, runtimeId: 'codex', kind: 'boundary', boundaryKind: 'failed', message: 'Failed continuation' },
  ], { state: 'working', activeTurnId: 'working' }));
  assert.equal(await host.react({ ...ref, reaction: 'surprise' }), null);
  assert.equal(await press(host, 'up', { ...ref, conversationId: '../../somewhere' }), null);
  assert.equal((await press(host, 'up', { ...ref, conversationId: otherConversation }))?.accepted, false);
  for (const turnId of ['unseen', 'pending', 'failed', 'stopped', 'blank', 'working', 'reopened']) {
    assert.equal((await press(host, 'up', { ...ref, turnId }))?.accepted, false, turnId);
    assert.equal((await host.send({ ...ref, turnId, text: 'Words' }))?.sent, false, turnId);
  }
  const pending = press(host, 'up');
  settings.active = otherConversation;
  assert.equal((await pending)?.accepted, false, 'switching during the storage read invalidates the press');
  assert.deepEqual(events, []);
  assert.equal(guidance.read().positiveReaction, undefined);
});

test('snapshots advertise only unambiguous completed answers, including before the first mark', async () => {
  const legacy = { ...answer('legacy', 2, 'completed'), runtimeId: 'legacy-ritemark' as const };
  const { host } = harness(true, record([
    answer('plan', 1, 'completed'),
    legacy,
    answer('plan', 3, 'completed'),
    { eventId: '4', turnId: 'old-execution', sequence: 4, occurredAt: now, runtimeId: 'codex', kind: 'boundary', boundaryKind: 'failed', message: 'Empty plan reply' },
    answer('old-execution', 5, 'completed'),
    { eventId: '6', turnId: 'fresh', sequence: 6, occurredAt: now, runtimeId: 'codex', kind: 'attention', attentionKind: 'plan-review', attentionState: 'pending', prompt: 'Execution progress', summary: null },
    answer('fresh', 7, 'completed'),
    answer('working', 8, 'completed'),
  ], { state: 'working', activeTurnId: 'working' }));
  assert.deepEqual(await host.snapshot(conversationId), {
    type: 'agent:answerReactions', conversationId, reactions: [], eligibleTurnIds: ['fresh'],
  });
  for (const turnId of ['legacy', 'plan', 'old-execution', 'working']) {
    assert.equal((await press(host, 'up', { conversationId, turnId }))?.accepted, false);
  }
  assert.equal((await host.activeAnswer({ conversationId, turnId: 'fresh' }))?.content, 'Answer for fresh');
});

test('stored marks keep the 500 newest globally and drop deleted chats', async () => {
  const { guidance } = harness(false);
  await guidance.changeAnswerReaction(ref, 'up');
  for (let index = 0; index < 499; index++) {
    await guidance.changeAnswerReaction({ conversationId: otherConversation, turnId: String(index) }, 'down');
  }
  await guidance.changeAnswerReaction({ ...ref, turnId: 'newest' }, 'up');
  assert.deepEqual(guidance.answerReactionsOf(conversationId).map(mark => mark.turnId), ['newest']);
  assert.equal(guidance.answerReactionsOf(otherConversation).length, 499);
  await guidance.dropAnswerReactions(otherConversation);
  assert.deepEqual(guidance.answerReactionsOf(otherConversation), []);
  assert.equal(guidance.answerReactionsOf(conversationId).length, 1);
});

test('marks from the grouped store migrate without changing their delivery state', async () => {
  const oldState = {
    v: 1, projects: {}, savedDays: [],
    answerReactions: { [conversationId]: [{ turnId: ref.turnId, reaction: 'down', sent: true }] },
  };
  const guidance = new GuidanceStore({
    get: <T>(key: string) => key === GUIDANCE_KEY ? oldState as T : undefined,
    update: async () => {},
  }, '2.4.0');
  assert.deepEqual(guidance.answerReactionsOf(conversationId), [{ turnId: ref.turnId, reaction: 'down', sent: true }]);
});

test('reaction and Take back are one local transition apiece; analytics uses that turn’s runtime', async () => {
  const { host, guidance, events } = harness(true);
  const simultaneous = await Promise.all([press(host, 'up'), press(host, 'up'), press(host, 'down')]);
  assert.deepEqual(simultaneous.map(result => [result?.accepted, result?.sent]), [[true, true], [false, false], [false, false]]);
  assert.equal((await press(host, 'up'))?.accepted, false);
  assert.equal((await press(host, 'down'))?.accepted, false);
  assert.equal((await press(host, 'none'))?.sent, true);
  assert.equal((await press(host, 'none'))?.accepted, false);
  assert.equal((await press(host, 'down'))?.sent, true);
  assert.deepEqual(events.map(({ event, properties }) => {
    const { $process_person_profile, $geoip_disable, ...payload } = properties!;
    return { event, payload };
  }), [
    { event: 'ai_answer_reacted', payload: { reaction: 'up', ai: 'codex' } },
    { event: 'ai_answer_reacted', payload: { reaction: 'none', ai: 'codex' } },
    { event: 'ai_answer_reacted', payload: { reaction: 'down', ai: 'codex' } },
  ]);
  assert.equal(guidance.read().positiveReaction, true, 'Take back leaves the first earned signal');
  assert.deepEqual((await host.snapshot(conversationId))?.reactions, [{ turnId: ref.turnId, reaction: 'down', sent: true }]);
});

test('usage data off still marks the exact answer and earns the Home signal once', async () => {
  const h = harness(false);
  assert.deepEqual(await press(h.host, 'up'), { type: 'agent:answerReactionResult', ...ref, reaction: 'up', accepted: true, sent: false });
  assert.deepEqual(h.events, []);
  assert.equal(h.guidance.read().positiveReaction, true);
  const writes = h.writes;
  await Promise.all([h.guidance.notePositiveReaction(), h.guidance.notePositiveReaction()]);
  assert.equal(h.writes, writes, 'the Home signal is idempotent');
  assert.deepEqual((await h.host.snapshot(conversationId))?.reactions, [{ turnId: ref.turnId, reaction: 'up', sent: false }]);
  assert.equal(await h.host.snapshot(otherConversation), null);
});

test('straight Send uses the existing sender in both consent states and reports a refused send', async () => {
  for (const on of [true, false]) {
    const h = harness(on);
    assert.equal((await h.host.send({ ...ref, text: '  ' }))?.sent, false);
    assert.equal((await h.host.send({ ...ref, text: 'x'.repeat(2001) }))?.sent, false);
    const responses = await Promise.all([h.host.send({ ...ref, text: '  My words  ' }), h.host.send({ ...ref, text: '  My words  ' })]);
    assert.deepEqual(responses, [true, false].map(sent => ({ type: 'agent:answerFeedbackResult', ...ref, sent })));
    assert.deepEqual(h.events, [{
      event: 'feedback_sent',
      distinctId: on ? 'consented' : 'one-off',
      properties: { message: 'My words', ...(on ? { from: 'thumb' } : {}), $process_person_profile: false, $geoip_disable: true },
    }]);
    h.settings.offline = true;
    assert.equal((await h.host.send({ ...ref, text: 'Retryable' }))?.sent, false);
  }
});

test('Add this answer resolves the selected completed turn, never the chat’s latest answer', () => {
  assert.equal(findCompletedAnswer(record(), ref.turnId)?.content, 'Answer for middle-turn');
  assert.equal(findCompletedAnswer(record(), 'missing'), null);
  assert.equal(findCompletedAnswer(record([answer(ref.turnId, 1, 'completed'), answer(ref.turnId, 2, 'failed')]), ref.turnId), null);
  const options = { from: 'thumb', kind: 'ai-issue', turn: ref, withAnswer: true, text: 'My words' };
  assert.deepEqual(decodeSidebarFeedbackOpen(options), options);
  assert.equal(decodeSidebarFeedbackOpen({ ...options, turn: {} }), null);
  assert.equal(decodeSidebarFeedbackOpen({ from: 'command', withAnswer: true }), null);
  assert.deepEqual(decodeSidebarFeedbackOpen({ from: 'failure_card', quote: { title: 'Sign in', line: 'Try again' }, turn: ref }), {
    from: 'failure_card', quote: { title: 'Sign in', line: 'Try again' },
  });
  assert.deepEqual(decodeSidebarFeedbackOpen({ from: 'failure_card' }), { from: 'failure_card' });
});
