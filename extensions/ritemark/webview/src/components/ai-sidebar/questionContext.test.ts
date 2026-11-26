import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgentProgress, ExtensionMessage } from './types';

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});

const React = await import('react');
Object.assign(globalThis, { React });
const { renderToStaticMarkup } = await import('react-dom/server');
const { useAISidebarStore } = await import('./store');
const { createConversationState } = await import('./conversationState');
const { AgentTurnBlock } = await import('./AgentView');
const { ActivityStatusLine } = await import('./ActivityStatusLine');
const { CodexTurn } = await import('./CodexView');
const { getActiveApprovedPlanForClaude } = await import('./lifecycle');

const prose = 'I will update the opening paragraph and keep the examples intact. '.repeat(3)
  + 'The last section will stay as written.';
const question = 'Should I make the changes as described?';
const item = {
  id: 'choice',
  header: 'Changes',
  question,
  options: [{ label: 'Yes', description: 'Proceed' }, { label: 'Change the plan', description: 'Revise' }],
  multiSelect: false,
};
const conversationId = 'question-context';
const baseTurn = { id: 'turn', userPrompt: 'Review the document', activities: [], isRunning: true, timestamp: 1 };
const store = useAISidebarStore;
const send = (message: ExtensionMessage) => store.getState().handleExtensionMessage(message);
const current = () => store.getState().conversations[conversationId];
const noop = () => {};
function assertBefore(markup: string, card: string, text = prose) {
  const textAt = markup.indexOf(text);
  const cardAt = markup.indexOf(card);
  assert.ok(textAt >= 0 && cardAt > textAt, 'full assistant prose should render above the card');
}

const snippet = prose.slice(0, 150) + '…';
const pending = { toolUseId: 'ask', questions: [item] };
const agentTurn = () => current().agentConversation[0];

function startClaudeTurn(planFirst = false) {
  const conversation = createConversationState(conversationId);
  store.setState({
    activeConversationId: conversationId,
    conversations: {
      [conversationId]: {
        ...conversation,
        pendingRuntime: { ...conversation.pendingRuntime, planFirst },
        agentConversation: [{ ...baseTurn, isPlan: false, planHandled: false }],
      },
    },
  });
}

function progress(type: AgentProgress['type'], message: string, tool?: string) {
  send({ type: 'agent-progress', conversationId, progress: { type, message, tool, timestamp: 1 } });
}

function openQuestion() {
  progress('tool_use', 'Using AskUserQuestion', 'AskUserQuestion');
  send({ type: 'agent-question', conversationId, question: pending });
}

function renderClaude() {
  return renderToStaticMarkup(React.createElement(AgentTurnBlock, {
    turn: agentTurn(),
    isMixedRuntime: false,
    answerAgentQuestion: noop,
    approvePlan: noop,
    rejectPlan: noop,
    handleToolApproval: noop,
  }));
}

test('Claude shows full question context and retains the snippet after completion', () => {
  startClaudeTurn();
  progress('thinking', snippet);
  progress('text', prose);
  openQuestion();
  assertBefore(renderClaude(), question);
  assert.equal(agentTurn().activities[0].message, snippet);

  store.getState().answerAgentQuestion(baseTurn.id, pending, { [question]: 'Yes' });
  assert.equal(agentTurn().assistantText, undefined);
  progress('text', 'Continuing now.');
  const resumed = renderClaude();
  assert.ok(!resumed.includes('Continuing now.'));
  assert.ok(!resumed.includes(prose));
  assert.ok(!resumed.includes(question));

  send({ type: 'agent-result', conversationId, text: 'Changes applied.', filesModified: [] });
  assert.equal(agentTurn().activities[0].message, snippet);
  assert.equal(agentTurn().assistantText, undefined);
  assert.ok(renderClaude().includes('Changes applied.'));
  assert.ok(!renderClaude().includes(prose));
  assert.ok(!renderClaude().includes('Continuing now.'));
});

test('Claude narration stays out of the running transcript without a question', () => {
  startClaudeTurn();
  progress('text', prose);
  assert.ok(!renderClaude().includes(prose), 'buffered narration is hidden before a tool call');
  progress('tool_use', 'Reading the document', 'Read');
  progress('text', prose);
  assert.ok(!renderClaude().includes(prose), 'buffered narration is hidden after a tool call');
});

test('Claude question context starts after the last tool use or result', () => {
  startClaudeTurn();
  const beforeUse = 'I will read the original.';
  const beforeResult = 'Waiting for the read to finish.';
  progress('text', beforeUse);
  progress('tool_use', 'Reading the document', 'Read');
  assert.equal(agentTurn().assistantText, undefined);
  progress('text', beforeResult);
  progress('text', '');
  assert.equal(agentTurn().assistantText, undefined);
  progress('text', prose);
  openQuestion();
  const markup = renderClaude();
  assertBefore(markup, question);
  assert.ok(!markup.includes(beforeUse));
  assert.ok(!markup.includes(beforeResult));
});

for (const decision of ['approvePlan', 'rejectPlan'] as const) {
  test(`Claude keeps an earlier plan out of question context after ${decision}`, () => {
    startClaudeTurn(true);
    const draft = 'Planning notes.';
    const plan = 'PLAN BODY: step one, step two.';
    const detail = 'Need one detail.';
    progress('plan_text', draft);
    if (decision === 'approvePlan') progress('plan_ready', 'Plan ready for review');
    send({ type: 'agent-plan-approval', conversationId, request: { toolUseId: 'plan', plan } });
    store.getState()[decision](baseTurn.id);
    assert.equal(agentTurn().assistantText, undefined);
    if (decision === 'approvePlan') progress('text', '');
    progress('text', detail);
    openQuestion();

    const markup = renderClaude();
    assertBefore(markup, question, detail);
    assert.ok(!markup.includes(draft));
    assert.ok(!markup.includes(plan));
    assert.equal(agentTurn().planText, plan);
    if (decision === 'approvePlan') {
      assert.equal(getActiveApprovedPlanForClaude([agentTurn()])?.planText, plan);
    }
  });
}

test('Claude shows fresh plan text above a question when no other tool intervenes', () => {
  startClaudeTurn(true);
  progress('plan_text', prose);
  openQuestion();
  const markup = renderClaude();
  assertBefore(markup, question);
  assert.equal(markup.split(prose).length - 1, 1);
});

for (const runtime of ['codex', 'opencode'] as const) {
  test(`${runtime} renders streaming text before its input card`, () => {
    store.setState({
      activeConversationId: conversationId,
      conversations: {
        [conversationId]: {
          ...createConversationState(conversationId),
          codexConversation: [{ ...baseTurn, runtime, streamingText: '' }],
        },
      },
    });
    send({ type: 'codex-streaming', conversationId, delta: prose, messageId: 'before' });
    if (runtime === 'codex') {
      send({ type: 'codex-question', conversationId, requestId: 'ask', questions: [item] });
    } else {
      send({ type: 'agent-approval-request', conversationId, agentId: runtime, requestId: 'acp-1',
        kind: 'permission', command: question });
    }
    const render = () => renderToStaticMarkup(React.createElement(CodexTurn, {
      turn: current().codexConversation[0],
      isMixedRuntime: false,
      onApprove: noop,
      onReject: noop,
      onAnswerQuestion: noop,
      onApprovePlan: noop,
      onDiscardPlan: noop,
    }));
    assertBefore(render(), question);

    if (runtime === 'codex') {
      store.getState().answerCodexQuestion(baseTurn.id, { requestId: 'ask', questions: [item] }, { choice: 'Yes' });
    } else {
      store.getState().handleCodexApproval('acp-1', true);
    }
    send({ type: 'codex-streaming', conversationId, delta: 'Continuing now.', messageId: 'after' });
    const resumed = render();
    assert.ok(resumed.includes('Continuing now.'));
    assert.equal(resumed.split(prose).length - 1, 1);
    assert.ok(!resumed.includes(question));
  });
}

test('Claude renders the collapsed S17 read summary below the completed answer', () => {
  startClaudeTurn();
  progress('tool_use', 'Using ToolSearch', 'ToolSearch');
  for (const [index, interview] of ['Riverside', 'Customer service', 'Operations', 'Harbour Street'].entries()) {
    const step = { id: String(index), kind: 'read' as const, path: `Interviews/${interview}.docx` };
    const base = { type: 'tool_use' as const, tool: 'mcp__ritemark_documents__read_document', message: '', timestamp: index };
    send({ type: 'agent-progress', conversationId, progress: { ...base, step } });
    send({ type: 'agent-progress', conversationId, progress: { ...base, step: { ...step, status: 'completed' } } });
  }
  assert.equal(agentTurn().activities.length, 4);
  assert.doesNotMatch(renderClaude(), /Read 4 Word documents/);
  progress('done', 'Completed in 9.8s');

  const text = 'The interviews recommend asking how we can help.';
  send({
    type: 'agent-result', conversationId, text,
    metrics: { durationMs: 9800, waitedMs: 2000, costUsd: null, model: null },
  });
  const markup = renderClaude();
  assertBefore(markup, 'Read 4 Word documents · 8s', text);
  assert.match(markup, /<details class="[^"]*"><summary[^>]*>Read 4 Word documents · 8s<\/summary>/);
  assert.doesNotMatch(markup, /ToolSearch|Completed in 9\.8s/);
  // Zustand reads the initial snapshot during server rendering.
  Object.assign(store.getInitialState(), store.getState());
  assert.match(renderToStaticMarkup(React.createElement(ActivityStatusLine)), /Done in 8s/);
});
