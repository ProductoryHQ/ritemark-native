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

// Sprint 143 (#551, R2, S6): ChatGPT's list arrives late (25 s): the landing still lands on ChatGPT,
// never left on Claude by a timer.
{
  reset();
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  try {
    useAISidebarStore.setState({ codexModels: [] });
    useAISidebarStore.getState().handleExtensionMessage({ type: 'landing:new-chat', runtimeId: 'codex', placeholder: 'Ask ChatGPT about this project' });
    assert.ok(useAISidebarStore.getState().pendingLanding, 'waits for ChatGPT\'s list');
    clock += 25_000;
    useAISidebarStore.getState().handleExtensionMessage({ type: 'ai-stopped' });
    assert.ok(useAISidebarStore.getState().pendingLanding, 'still waiting after 25 s: no timer for a local list');
    useAISidebarStore.setState({ codexModels: [{ id: 'gpt-test', name: 'GPT test', description: '' } as never] });
    useAISidebarStore.getState().handleExtensionMessage({ type: 'ai-stopped' });
    assert.equal(active().selectedAgent, 'codex', 'the chat is on ChatGPT');
    assert.equal(useAISidebarStore.getState().landingPlaceholder?.text, 'Ask ChatGPT about this project');
  } finally {
    Date.now = realNow;
  }
}

// OpenCode with no provider after 20 s gives up as before, and tells the host's log why.
{
  reset();
  const posted: Array<Record<string, unknown>> = [];
  vscode.postMessage = (message: unknown) => { posted.push(message as Record<string, unknown>); };
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  try {
    useAISidebarStore.getState().handleExtensionMessage({ type: 'landing:new-chat', runtimeId: 'opencode', placeholder: 'Ask OpenCode about this project' });
    clock += 21_000;
    useAISidebarStore.getState().handleExtensionMessage({ type: 'ai-stopped' });
    assert.equal(useAISidebarStore.getState().pendingLanding, null, 'OpenCode gave up');
    assert.ok(posted.some((message) => message.type === 'landing/dropped' && message.runtimeId === 'opencode'), 'the host hears why');
  } finally {
    Date.now = realNow;
    vscode.postMessage = () => undefined;
  }
}

// A status bar click brings the requested AI to a fresh chat and focuses the composer.
{
  const frames: FrameRequestCallback[] = [];
  let focusCount = 0;
  Object.assign(globalThis, {
    requestAnimationFrame: (frame: FrameRequestCallback) => frames.push(frame),
    document: { querySelector: (selector: string) => {
      assert.equal(selector, 'textarea[aria-label="Message"]');
      return { focus: () => focusCount++ };
    } },
  });
  const click = (runtimeId: 'claude-code' | 'codex') => {
    focusCount = 0;
    useAISidebarStore.getState().handleExtensionMessage({ type: 'landing:new-chat', runtimeId, fromStatus: true });
    while (frames.length) frames.shift()!(0);
    assert.equal(focusCount, 1);
  };
  try {
    reset();
    useAISidebarStore.setState({ codexModels: [{ id: 'gpt-test', name: 'GPT test', description: '' } as never] });
    useAISidebarStore.getState().restoreActiveConversation({
      chatMessages: [{ id: 'earlier', role: 'user', content: 'Earlier turn', timestamp: 1 }],
    });
    click('codex');
    assert.notEqual(active().id, 'conv-1');
    assert.equal(active().selectedAgent, 'codex');
    assert.equal(active().pendingRuntime.runtimeId, 'codex');
    assert.equal(useAISidebarStore.getState().conversations['conv-1'].chatMessages[0].content, 'Earlier turn');

    const emptyId = active().id;
    // On a cold open, the mounted composer consumes the fill and focuses itself.
    const fill = useAISidebarStore.getState().composerFill;
    assert.equal(fill?.conversationId, emptyId);
    assert.equal(fill?.text, '');
    assert.equal(fill?.cursor, 0);
    useAISidebarStore.getState().takeComposerFill();
    click('codex');
    assert.equal(active().id, emptyId, 'the blank chat with that AI is the new chat: focus only');
    const emptyThreads = () => Object.values(useAISidebarStore.getState().conversations)
      .filter((c) => c.chatMessages.length === 0).length;
    assert.equal(emptyThreads(), 1, 'R10: never a second empty thread');
    useAISidebarStore.getState().takeComposerFill();

    useAISidebarStore.getState().setComposerDraft(emptyId, 'Unsent draft');
    useAISidebarStore.getState().setComposerEmpty(false);
    click('claude-code');
    assert.equal(active().id, emptyId);
    assert.equal(active().selectedAgent, 'codex');
    assert.equal(useAISidebarStore.getState().composerDrafts[emptyId], 'Unsent draft');

    useAISidebarStore.getState().setComposerDraft(emptyId, '');
    useAISidebarStore.getState().setComposerEmpty(true);
    click('claude-code');
    assert.equal(active().id, emptyId, 'a blank chat with another AI is reused, not doubled (R10)');
    assert.equal(active().selectedAgent, 'claude-code', 'and takes the clicked AI');
    assert.equal(emptyThreads(), 1, 'R10: still one empty thread');

    reset();
    useAISidebarStore.setState({ codexModels: [] });
    click('codex');
    assert.equal(emptyThreads(), 1, 'a closed column with a blank chat: still one empty thread');
    assert.equal(active().pendingRuntime.runtimeId, 'codex', 'the chat starts on ChatGPT while its models load');
    assert.ok(useAISidebarStore.getState().pendingLanding);
    useAISidebarStore.setState({ codexModels: [{ id: 'gpt-test', name: 'GPT test', description: '' } as never] });
    useAISidebarStore.getState().handleExtensionMessage({ type: 'ai-stopped' });
    assert.equal(active().pendingRuntime.modelId, 'gpt-test');
  } finally {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'document');
  }
}

vscode.postMessage = originalPostMessage;
console.log('landingChat tests passed.');
