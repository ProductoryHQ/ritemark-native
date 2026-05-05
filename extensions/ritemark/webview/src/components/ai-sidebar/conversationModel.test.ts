import assert from 'node:assert/strict';
import {
  normalizeSavedConversation,
  getRuntimeSummary,
  getActiveRunningRun,
} from './conversationModel';
import type { SavedConversationRaw } from './conversationModel';
import type { AgentConversationTurn, CodexConversationTurn, ChatMessage } from './types';

// ── Factories ──────────────────────────────────────────────────────────

function makeClaudeTurn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: 'claude-turn-1',
    userPrompt: 'Do the thing',
    activities: [],
    isRunning: false,
    isPlan: false,
    planHandled: false,
    timestamp: 1000,
    ...overrides,
  };
}

function makeCodexTurn(overrides: Partial<CodexConversationTurn> = {}): CodexConversationTurn {
  return {
    id: 'codex-turn-1',
    userPrompt: 'Do the codex thing',
    streamingText: '',
    activities: [],
    isRunning: false,
    timestamp: 2000,
    ...overrides,
  };
}

function makeChatMessage(role: 'user' | 'assistant', content: string, ts = 500): ChatMessage {
  return { id: `msg-${ts}`, role, content, timestamp: ts };
}

function baseRaw(overrides: Partial<SavedConversationRaw> = {}): SavedConversationRaw {
  return {
    id: 'conv-1',
    title: 'Test',
    agentId: 'claude-code',
    createdAt: 100,
    updatedAt: 9000,
    agentConversation: [],
    codexConversation: [],
    chatMessages: [],
    conversationHistory: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

function testClaudeOnly() {
  const turn1 = makeClaudeTurn({ id: 'c1', timestamp: 1000 });
  const turn2 = makeClaudeTurn({ id: 'c2', timestamp: 2000, userPrompt: 'Second' });
  const doc = normalizeSavedConversation(
    baseRaw({ agentConversation: [turn1, turn2] })
  );

  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.runs.length, 2);
  assert.equal(doc.runs[0].runtimeId, 'claude-code');
  assert.equal(doc.runs[1].runtimeId, 'claude-code');
  assert.equal(doc.runs[0].id, 'c1');
  assert.equal(
    (doc.runs[0] as { providerTurn: AgentConversationTurn }).providerTurn,
    turn1
  );
}

function testCodexOnly() {
  const turn = makeCodexTurn({ id: 'x1', timestamp: 3000 });
  const doc = normalizeSavedConversation(
    baseRaw({ agentId: 'codex', codexConversation: [turn] })
  );

  assert.equal(doc.runs.length, 1);
  assert.equal(doc.runs[0].runtimeId, 'codex');
  assert.equal(doc.runs[0].id, 'x1');
  assert.equal(
    (doc.runs[0] as { providerTurn: CodexConversationTurn }).providerTurn,
    turn
  );
}

function testLegacyRitemarkAgent() {
  const messages = [
    makeChatMessage('user', 'Hello', 100),
    makeChatMessage('assistant', 'Hi there', 200),
    makeChatMessage('user', 'Thanks', 300),
  ];
  const doc = normalizeSavedConversation(
    baseRaw({
      agentId: 'ritemark-agent',
      chatMessages: messages,
      conversationHistory: [{ role: 'user', content: 'Hello' }],
    })
  );

  assert.equal(doc.runs.length, 1);
  assert.equal(doc.runs[0].runtimeId, 'legacy-ritemark');
  assert.equal(doc.runs[0].status, 'complete');
  const providerTurn = (doc.runs[0] as { providerTurn: { messages: ChatMessage[] } }).providerTurn;
  assert.equal(providerTurn.messages.length, 3);
}

function testMixedRuntimes() {
  // Codex turn at ts=1000, Claude turn at ts=2000 — expect merged in order
  const claudeTurn = makeClaudeTurn({ id: 'c1', timestamp: 2000 });
  const codexTurn = makeCodexTurn({ id: 'x1', timestamp: 1000 });

  const doc = normalizeSavedConversation(
    baseRaw({
      agentId: 'claude-code',
      agentConversation: [claudeTurn],
      codexConversation: [codexTurn],
    })
  );

  assert.equal(doc.runs.length, 2);
  // Sorted by timestamp: codex first, claude second
  assert.equal(doc.runs[0].runtimeId, 'codex');
  assert.equal(doc.runs[0].id, 'x1');
  assert.equal(doc.runs[1].runtimeId, 'claude-code');
  assert.equal(doc.runs[1].id, 'c1');
}

function testMissingTimestamps() {
  // turns with timestamp: 0 — must not crash, order preserved
  const turn1 = makeClaudeTurn({ id: 'c1', timestamp: 0 });
  const turn2 = makeClaudeTurn({ id: 'c2', timestamp: 0, userPrompt: 'Second' });
  let doc: ReturnType<typeof normalizeSavedConversation>;
  assert.doesNotThrow(() => {
    doc = normalizeSavedConversation(baseRaw({ agentConversation: [turn1, turn2] }));
  });
  assert.equal(doc!.runs.length, 2);
}

function testGetRuntimeSummaryMultiple() {
  const claudeTurn = makeClaudeTurn({ timestamp: 1000 });
  const codexTurn = makeCodexTurn({ timestamp: 2000 });
  const doc = normalizeSavedConversation(
    baseRaw({ agentConversation: [claudeTurn], codexConversation: [codexTurn] })
  );

  const summary = getRuntimeSummary(doc);
  assert.ok(summary.includes('claude-code'), 'summary must include claude-code');
  assert.ok(summary.includes('codex'), 'summary must include codex');
  // No duplicates
  assert.equal(summary.length, new Set(summary).size);
}

function testGetRuntimeSummaryLegacyOnly() {
  const messages = [makeChatMessage('user', 'Hi', 100)];
  const doc = normalizeSavedConversation(
    baseRaw({ agentId: 'ritemark-agent', chatMessages: messages })
  );

  const summary = getRuntimeSummary(doc);
  assert.deepEqual(summary, ['legacy-ritemark']);
}

function testGetActiveRunningRunFound() {
  const runningTurn = makeClaudeTurn({ id: 'r1', isRunning: true, timestamp: 1000 });
  const doneTurn = makeClaudeTurn({ id: 'r2', timestamp: 2000 });
  const doc = normalizeSavedConversation(
    baseRaw({ agentConversation: [doneTurn, runningTurn] })
  );

  const active = getActiveRunningRun(doc);
  assert.ok(active !== undefined, 'should find active run');
  assert.equal(active!.status, 'running');
}

function testGetActiveRunningRunNotFound() {
  const turn1 = makeClaudeTurn({ id: 'c1', timestamp: 1000 });
  const turn2 = makeClaudeTurn({ id: 'c2', timestamp: 2000 });
  const doc = normalizeSavedConversation(
    baseRaw({ agentConversation: [turn1, turn2] })
  );

  const active = getActiveRunningRun(doc);
  assert.equal(active, undefined);
}

function main() {
  testClaudeOnly();
  testCodexOnly();
  testLegacyRitemarkAgent();
  testMixedRuntimes();
  testMissingTimestamps();
  testGetRuntimeSummaryMultiple();
  testGetRuntimeSummaryLegacyOnly();
  testGetActiveRunningRunFound();
  testGetActiveRunningRunNotFound();
  console.log('conversationModel tests passed.');
}

main();
