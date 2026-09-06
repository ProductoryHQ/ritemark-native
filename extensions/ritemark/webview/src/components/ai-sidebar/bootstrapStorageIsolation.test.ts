import assert from 'node:assert/strict';
import { RUNTIME_CAPABILITIES } from '../../../../src/runtime/capabilities';
import { AGENTS } from '../../../../src/agent/types';

class QuotaStorage implements Storage {
  private readonly data = new Map<string, string>([
    ['ritemark-chat-metadata', JSON.stringify([{
      id: 'legacy-large',
      title: 'Large legacy conversation',
      agentId: 'claude-code',
      createdAt: 1,
      updatedAt: 2,
    }])],
    ['ritemark-chat-legacy-large', JSON.stringify({ id: 'legacy-large', payload: 'x'.repeat(1024) })],
  ]);

  writes = 0;
  get length(): number { return this.data.size; }
  clear(): void { throw new Error('bootstrap must not clear legacy storage'); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(_key: string): void { throw new Error('bootstrap must not remove legacy storage'); }
  setItem(_key: string, _value: string): void {
    this.writes += 1;
    throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
  }
}

async function main(): Promise<void> {
  const quotaStorage = new QuotaStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = quotaStorage;
  const posted: unknown[] = [];
  (globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: unknown) => { posted.push(message); },
    getState: () => null,
    setState: () => undefined,
  });

  const [{ vscode }, { useAISidebarStore }] = await Promise.all([
    import('../../lib/vscode'),
    import('./store'),
  ]);
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message) => { posted.push(message); };

  try {
    assert.doesNotThrow(() => {
      useAISidebarStore.getState().handleExtensionMessage({
        type: 'agent:bootstrap',
        generation: 1,
        agenticEnabled: true,
        parallelChatsEnabled: true,
        durableAgentConversations: true,
        composerThinkingEffortEnabled: true,
        codexEnabled: true,
        opencodeEnabled: true,
        selectedAgent: 'codex',
        selectedModel: 'claude-opus-5[1m]',
        workspacePath: '/tmp/quota-workspace',
        agents: Object.values(AGENTS),
        models: [{
          id: 'claude-opus-5[1m]',
          label: 'Opus 5 with 1M context',
          description: 'Claude model',
          tier: 'high',
          deprecated: false,
          order: 0,
        }],
        codexModels: [{
          id: 'gpt-5.6-sol',
          label: 'GPT-5.6-Sol',
          description: 'Codex model',
          tier: 'high',
          deprecated: false,
          order: 0,
        }],
        byokProviderModels: {},
        hasSeenWelcome: true,
        claudeSdkVersion: '0.3.239',
        runtimeCapabilities: RUNTIME_CAPABILITIES,
      });
    }, 'conversation storage failure must not escape the atomic bootstrap handler');

    const state = useAISidebarStore.getState();
    assert.equal(state.ready, true);
    assert.equal(state.bootstrapGeneration, 1);
    assert.equal(state.models[0]?.id, 'claude-opus-5[1m]');
    assert.equal(state.codexModels[0]?.id, 'gpt-5.6-sol');
    assert.equal(quotaStorage.writes, 0, 'bootstrap must not write legacy storage');
    assert.equal(
      posted.some((message) => (message as { type?: string }).type === 'conversation/initialize'),
      true,
      'conversation initialization remains an independent post-bootstrap hydration request',
    );

    assert.doesNotThrow(() => {
      useAISidebarStore.getState().handleExtensionMessage({
        type: 'conversation/result',
        requestId: 'initialize-1',
        operation: 'conversation/initialize',
        ok: true,
        data: {
          scopeId: 'scope-1',
          scope: {},
          scopeLabel: 'Quota workspace',
          rolloutMode: 'host-canonical',
          selectedConversationId: null,
          conversations: [],
          earlierConversations: [],
        },
      } as never);
    }, 'host-canonical cutover may inventory but never write quota-full legacy storage');
    assert.equal(useAISidebarStore.getState().ready, true);
    assert.equal(useAISidebarStore.getState().conversationRolloutMode, 'host-canonical');
    assert.equal(quotaStorage.writes, 0, 'host-canonical initialization performs zero legacy writes');

    console.log('bootstrapStorageIsolation.test.ts: storage-full Agent Chat bootstrap passed');
  } finally {
    vscode.postMessage = originalPostMessage;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
