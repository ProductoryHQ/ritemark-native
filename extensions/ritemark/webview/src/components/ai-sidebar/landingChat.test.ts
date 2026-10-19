/**
 * Sprint 133 (R6): the welcome's landing opens a new chat with the AI the
 * person signed in with, its message box reading "Ask … about this project".
 * OpenCode's model is known only once the host has said which provider keys
 * are set, so the landing waits for that instead of leaving the chat on Claude.
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/landingChat.test.ts
 */
import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations, selectActiveConversation } from './store';
import { createConversationState } from './conversationState';
import { vscode } from '../../lib/vscode';

const initialState = useAISidebarStore.getState();
const originalPostMessage = vscode.postMessage;
vscode.postMessage = () => undefined;

function reset(): void {
  useAISidebarStore.setState(initialState, true);
  const conversation = createConversationState('conv-1', {
    selectedAgent: 'claude-code',
    pendingRuntime: { runtimeId: 'claude-code', modelId: 'claude-sonnet', mode: 'auto' },
  });
  hydrateConversations([conversation], conversation.id);
  useAISidebarStore.setState({
    models: [{ id: 'claude-sonnet', name: 'Sonnet', description: '' } as never],
    byokProviderModels: { openai: [{ id: 'gpt-test', label: 'GPT test', description: '' }] },
  });
}

function active() {
  return selectActiveConversation(useAISidebarStore.getState())!;
}

// Claude: the chat is on Claude already; the placeholder applies at once.
reset();
useAISidebarStore.getState().handleExtensionMessage({ type: 'landing:new-chat', runtimeId: 'claude-code', placeholder: 'Ask Claude about this project' });
assert.equal(active().pendingRuntime.runtimeId, 'claude-code');
assert.deepEqual(
  useAISidebarStore.getState().landingPlaceholder,
  { conversationId: active().id, runtimeId: 'claude-code', text: 'Ask Claude about this project' },
);
assert.equal(useAISidebarStore.getState().pendingLanding, null);

// OpenCode before its providers are known: the landing waits; the chat is not sent to Claude by mistake later.
reset();
useAISidebarStore.getState().handleExtensionMessage({ type: 'landing:new-chat', runtimeId: 'opencode', placeholder: 'Ask OpenCode about this project' });
assert.equal(useAISidebarStore.getState().landingPlaceholder, null, 'no placeholder yet');
assert.ok(useAISidebarStore.getState().pendingLanding, 'the landing waits');

// The host says which keys are set: the chat moves to OpenCode, with the landing's words.
useAISidebarStore.getState().handleExtensionMessage({
  type: 'acp-providers',
  enabled: true,
  providers: { openai: true, google: false, anthropic: false, openrouter: false },
});
assert.equal(active().pendingRuntime.runtimeId, 'opencode');
assert.equal(active().selectedAgent, 'opencode');
assert.equal(useAISidebarStore.getState().pendingLanding, null);
assert.equal(useAISidebarStore.getState().landingPlaceholder?.text, 'Ask OpenCode about this project');
assert.equal(useAISidebarStore.getState().landingPlaceholder?.runtimeId, 'opencode');

vscode.postMessage = originalPostMessage;
console.log('landingChat tests passed.');
