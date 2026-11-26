import assert from 'node:assert/strict';
import { decodeConversationRecordV1, type LiveDeckStep } from '../../../../src/conversations/types';
import { projectConversation } from '../../../../src/conversations/protocol';
import { projectionToConversation } from './conversationProjection';
import { hydrateConversations, useAISidebarStore } from './store';
import type { AgentProgress } from './types';

const React = await import('react');
Object.assign(globalThis, { React });
const { renderToStaticMarkup } = await import('react-dom/server');
const { UnifiedConversationView } = await import('./UnifiedConversationView');

const id = '00000000-0000-4000-8000-000000000001';
const at = '2026-11-24T10:00:00.000Z';
const answer = 'I saved the deck.';
const steps: LiveDeckStep[] = [
  { type: 'live_deck_updated', message: 'Updated the page' },
  { type: 'live_deck_paused', message: 'The page waits: slide 6 has what looks like a key' },
];
const activity: AgentProgress = { type: 'tool_use', tool: 'Edit', message: 'Editing', timestamp: 1 };

function render() {
  // Zustand uses the initial snapshot for server rendering.
  Object.assign(useAISidebarStore.getInitialState(), useAISidebarStore.getState());
  return renderToStaticMarkup(React.createElement(UnifiedConversationView));
}

function checkLines(markup: string) {
  assert.match(markup, /data-activity-state="done"/);
  for (const { message } of steps) {
    const offset = markup.indexOf(message);
    assert.ok(markup.indexOf(answer) >= 0 && markup.indexOf(answer) < offset, markup);
    assert.ok(offset < markup.indexOf('data-activity-state="done"'));
    assert.equal(markup.lastIndexOf(message), offset, 'one line per step');
    assert.ok(offset > markup.lastIndexOf('</details>'), 'the step follows Claude’s Activity fold');
    assert.ok(offset > markup.lastIndexOf('action completed'), 'the step follows the ChatGPT or OpenCode Activity fold');
  }
}

for (const runtimeId of ['claude-code', 'codex', 'opencode'] as const) {
  const user = {
    kind: 'user-message', eventId: 'user', turnId: 'turn', sequence: 0,
    occurredAt: at, runtimeId, text: 'Fix the deck', mode: 'agent', attachments: [],
  };
  const assistant = {
    kind: 'assistant-message', eventId: 'assistant', turnId: 'turn', sequence: 1,
    occurredAt: at, runtimeId, content: answer, terminalStatus: 'completed',
    activeDurationMs: 1200, liveDeckSteps: steps,
  };
  const base = {
    schemaVersion: 1, conversationId: id,
    scopeId: 'ps1-0000000000000000000000000000000000000000',
    scope: { kind: 'single-root', workspaceFileUri: null, folderUris: ['file:///project'] },
    title: 'Fix the deck', identityColorSlot: 0, createdAt: at, lastActivityAt: at,
    revision: 2, bindingGeneration: 0, runtimeSummary: [runtimeId], composerPreferences: {},
  };
  const running = decodeConversationRecordV1({
    ...base, lifecycle: { state: 'working', activeTurnId: 'turn' }, events: [user],
  });
  const live = projectionToConversation(projectConversation(running));
  const turn = (live.agentConversation[0] ?? live.codexConversation[0]);
  const starting = `Starting ${runtimeId}`;
  turn.activities.push(
    { type: 'init', message: starting, timestamp: 0 },
    activity,
    { type: 'done', message: 'Completed in 1.2s', timestamp: 2 },
  );
  if ('streamingText' in turn) turn.streamingText = answer;
  hydrateConversations([live], id);
  useAISidebarStore.setState({ conversationRolloutMode: 'host-canonical' });
  useAISidebarStore.getState().handleExtensionMessage(runtimeId === 'claude-code'
    ? { type: 'agent-result', conversationId: id, text: answer, liveDeckSteps: steps }
    : { type: 'codex-result', conversationId: id, status: 'completed', liveDeckSteps: steps });
  const liveMarkup = render();
  assert.match(liveMarkup, runtimeId === 'claude-code' ? /Activity \(1 steps/ : /1 action completed/);
  assert.ok(!liveMarkup.includes(starting));
  assert.doesNotMatch(liveMarkup, /Completed in 1\.2s/);
  checkLines(liveMarkup);

  const record = decodeConversationRecordV1(JSON.parse(JSON.stringify({
    ...base, lifecycle: { state: 'idle' }, events: [user, assistant],
  })));
  const restored = projectionToConversation(projectConversation(record));
  const restoredTurn = restored.agentConversation[0] ?? restored.codexConversation[0];
  assert.deepEqual(restoredTurn.result?.liveDeckSteps, steps);
  hydrateConversations([restored], id);
  checkLines(render());
}

console.log('Live deck steps render and restore outside Activity for all three runtimes.');
