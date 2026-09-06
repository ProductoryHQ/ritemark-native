import assert from 'node:assert/strict';
import { RUNTIME_CAPABILITIES } from '../../../../src/runtime/capabilities';
import { AGENTS } from '../../../../src/agent/types';
import { vscode } from '../../lib/vscode';
import { useAISidebarStore } from './store';
import type { ExtensionMessage } from './types';

const initialState = useAISidebarStore.getState();
const claudeModels = [{
  id: 'claude-opus-5[1m]',
  aliases: ['default', 'opus[1m]'],
  isDefault: true,
  label: 'Opus 5 with 1M context',
  description: 'Best for everyday, complex tasks',
  tier: 'high' as const,
  deprecated: false,
  order: 0,
}];
const codexModels = [{
  id: 'gpt-5.6-sol',
  label: 'GPT-5.6-Sol',
  description: 'Latest frontier agentic coding model.',
  tier: 'high' as const,
  deprecated: false,
  order: 0,
}];

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
}

function bootstrap(generation: number): Extract<ExtensionMessage, { type: 'agent:bootstrap' }> {
  return {
    type: 'agent:bootstrap',
    generation,
    agenticEnabled: true,
    parallelChatsEnabled: true,
    durableAgentConversations: true,
    composerThinkingEffortEnabled: true,
    codexEnabled: true,
    opencodeEnabled: true,
    selectedAgent: 'codex',
    selectedModel: 'opus[1m]',
    agents: Object.values(AGENTS),
    models: claudeModels,
    codexModels,
    byokProviderModels: {},
    hasSeenWelcome: true,
    claudeSdkVersion: '0.3.239',
    runtimeCapabilities: RUNTIME_CAPABILITIES,
  };
}

function deliver(message: ExtensionMessage): void {
  useAISidebarStore.getState().handleExtensionMessage(message);
}

function main(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    deliver({ type: 'ai-key-status', hasKey: true });
    assert.equal(useAISidebarStore.getState().ready, false, 'credential status cannot complete bootstrap');

    deliver(bootstrap(4));
    let state = useAISidebarStore.getState();
    assert.equal(state.ready, true);
    assert.equal(state.bootstrapGeneration, 4);
    assert.equal(state.models[0].id, 'claude-opus-5[1m]');
    assert.equal(state.codexModels[0].id, 'gpt-5.6-sol');
    assert.equal(state.activeConversationId !== null, true);
    assert.equal(state.conversations[state.activeConversationId!].selectedAgent, 'codex');
    assert.equal(
      state.conversations[state.activeConversationId!].selectedModel,
      'claude-opus-5[1m]',
      'a persisted alias is reconciled without waiting for runtime hydration',
    );
    assert.equal(
      state.conversations[state.activeConversationId!].pendingRuntime.modelId,
      'gpt-5.6-sol',
      'Codex bootstrap must bind the Codex model, not the Claude catalog selection',
    );

    deliver({
      type: 'codex:status',
      generation: 4,
      revision: 2,
      status: {
        enabled: true,
        state: 'ready',
        version: '1.2.3',
        authMethod: 'chatgpt',
        email: null,
        plan: null,
        error: null,
        diagnostics: [],
        repairCommand: null,
        binaryPath: '/tmp/codex',
        compatibility: null,
      },
    });
    assert.equal(useAISidebarStore.getState().runtimeHydration.codex.phase, 'ready');

    deliver({
      type: 'agent:runtime-status-error',
      runtimeId: 'codex',
      generation: 3,
      revision: 99,
      error: 'late old-window failure',
    });
    state = useAISidebarStore.getState();
    assert.equal(state.runtimeHydration.codex.phase, 'ready', 'old view generation cannot overwrite the current view');
    assert.equal(state.models.length, 1, 'runtime failure cannot erase Claude catalog');
    assert.equal(state.codexModels.length, 1, 'runtime failure cannot erase Codex catalog');

    deliver({
      type: 'agent:runtime-status-error',
      runtimeId: 'codex',
      generation: 4,
      revision: 1,
      error: 'late older revision',
    });
    assert.equal(useAISidebarStore.getState().runtimeHydration.codex.phase, 'ready', 'older revision cannot win');

    deliver({
      type: 'agent:runtime-status-error',
      runtimeId: 'codex',
      generation: 4,
      revision: 3,
      error: 'Codex keychain check failed',
    });
    state = useAISidebarStore.getState();
    assert.equal(state.runtimeHydration.codex.phase, 'error');
    assert.equal(state.models[0].label, 'Opus 5 with 1M context');
    assert.equal(state.codexModels[0].label, 'GPT-5.6-Sol');

    const staleBootstrap = bootstrap(3);
    staleBootstrap.models = [{ ...claudeModels[0], id: 'stale-old-view-model', label: 'Stale old view model' }];
    deliver(staleBootstrap);
    state = useAISidebarStore.getState();
    assert.equal(state.bootstrapGeneration, 4);
    assert.equal(state.models[0].id, 'claude-opus-5[1m]', 'a late bootstrap from an old view is discarded');

    const activeId = state.activeConversationId!;
    useAISidebarStore.setState({
      conversations: {
        ...state.conversations,
        [activeId]: {
          ...state.conversations[activeId],
          codexConversation: [{
            id: 'existing-turn',
            userPrompt: 'Keep this conversation on Codex',
            streamingText: 'Done',
            activities: [],
            isRunning: false,
            timestamp: 1,
            runtime: 'codex',
          }],
        },
      },
    });

    const refresh = bootstrap(5);
    refresh.selectedAgent = 'claude-code';
    deliver(refresh);
    state = useAISidebarStore.getState();
    assert.equal(
      state.conversations[activeId].selectedAgent,
      'codex',
      'a later app-global status/bootstrap refresh must not rebind a non-empty conversation',
    );

    console.log('Agent sidebar bootstrap store tests passed.');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

main();
