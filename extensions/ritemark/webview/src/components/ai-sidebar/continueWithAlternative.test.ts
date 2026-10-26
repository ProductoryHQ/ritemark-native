/**
 * Sprint 143 (#544, R3a): Continue with <AI>, on the waiting line and on the
 * busy card: it stops this turn, continues the chat with the ready AI, and
 * puts the message back in the box. It never sends.
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/continueWithAlternative.test.ts
 */
import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations, selectActiveConversation } from './store';
import { createConversationState } from './conversationState';
import { vscode } from '../../lib/vscode';

const posted: Array<Record<string, unknown>> = [];
const originalPostMessage = vscode.postMessage;
vscode.postMessage = (message: unknown) => { posted.push(message as Record<string, unknown>); };

const conversation = createConversationState('conv-busy', {
  selectedAgent: 'codex',
  codexSelectedModel: 'gpt-test',
  pendingRuntime: { runtimeId: 'codex', modelId: 'gpt-test', mode: 'auto' },
});
conversation.codexConversation = [{
  id: 'turn-1',
  conversationId: 'conv-busy',
  userPrompt: 'Draft Module 4 from the brief\n\nDone when: five questions',
  activities: [],
  streamingText: '',
  isRunning: true,
  retry: { busy: true, retryAt: Date.now() + 419_000, attempt: 1, of: 5 },
  timestamp: Date.now(),
} as never];
hydrateConversations([conversation], conversation.id);
useAISidebarStore.setState({
  models: [{ id: 'claude-sonnet', name: 'Sonnet', description: '' } as never],
  codexModels: [{ id: 'gpt-test', name: 'GPT test', description: '' } as never],
});

useAISidebarStore.getState().continueWithAlternative('claude-code', 'claude-sonnet', conversation.codexConversation[0].userPrompt);

const active = selectActiveConversation(useAISidebarStore.getState())!;
assert.ok(posted.some((message) => message.type === 'agent-cancel' && message.agentId === 'codex'), 'the waiting turn is stopped');
assert.equal(active.codexConversation[0].isRunning, false);
assert.equal(active.selectedAgent, 'claude-code', 'the chat continues with Claude');
assert.equal(useAISidebarStore.getState().composerFill?.text, 'Draft Module 4 from the brief\n\nDone when: five questions', 'the message is back in the box');
assert.ok(!posted.some((message) => message.type === 'agent-execute'), 'nothing is sent');

vscode.postMessage = originalPostMessage;
console.log('continueWithAlternative tests passed.');
