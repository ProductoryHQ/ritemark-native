import assert from 'node:assert/strict';
import { AGENTS } from '../agent/types';
import { RUNTIME_CAPABILITIES } from '../runtime/capabilities';
import { buildAgentSidebarBootstrap, buildLegacyAgentSidebarConfig } from './agentSidebarBootstrap';

const claudeModels = [
  {
    id: 'claude-opus-5[1m]', label: 'Opus 5', description: '', tier: 'high' as const,
    deprecated: false, order: 0, aliases: ['default', 'opus[1m]'], isDefault: true,
  },
  {
    id: 'claude-sonnet-5', label: 'Sonnet 5', description: '', tier: 'medium' as const,
    deprecated: false, order: 1,
  },
];
const codexModels = [{
  id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: '', tier: 'high' as const,
  deprecated: false, order: 0,
}];

function input() {
  return {
    generation: 7,
    agenticEnabled: true,
    parallelChatsEnabled: true,
    durableAgentConversations: true,
    composerThinkingEffortEnabled: true,
    codexEnabled: true,
    opencodeEnabled: true,
    selectedAgent: 'claude-code',
    persistedClaudeModel: 'opus[1m]',
    defaultClaudeModel: 'default',
    agents: Object.values(AGENTS),
    claudeModels,
    codexModels,
    hasSeenWelcome: true,
    workspacePath: '/tmp/project',
    claudeSdkVersion: '0.3.239',
    runtimeCapabilities: RUNTIME_CAPABILITIES,
  };
}

function main(): void {
  const bootstrap = buildAgentSidebarBootstrap(input());
  assert.equal(bootstrap.type, 'agent:bootstrap');
  assert.equal(bootstrap.generation, 7);
  assert.equal(bootstrap.selectedModel, 'claude-opus-5[1m]', 'persisted alias must resolve atomically');
  assert.equal(bootstrap.models.length, 2);

  const legacy = buildLegacyAgentSidebarConfig(bootstrap, {
    agents: [{
      id: 'project:researcher',
      name: 'researcher',
      description: 'Research agent',
      filePath: '/tmp/.claude/agents/researcher.md',
      scope: 'project',
      hasFrontmatter: true,
      isMainAgent: false,
      modifiedAt: 1,
      icon: 'magnifying-glass',
      color: 'indigo',
    }],
    commands: [{
      id: 'project:summarize',
      name: 'summarize',
      description: 'Summarize',
      source: 'commands',
      filePath: '/tmp/.claude/commands/summarize.md',
      scope: 'project',
      hasFrontmatter: true,
      modifiedAt: 1,
      icon: 'file-text',
      color: 'indigo',
    }],
  });
  assert.equal(legacy.type, 'agent:config');
  assert.equal(legacy.discoveredAgents[0].name, 'researcher');
  assert.equal(legacy.discoveredCommands[0].name, 'summarize');

  const stale = buildAgentSidebarBootstrap({ ...input(), persistedClaudeModel: 'removed-model' });
  assert.equal(stale.selectedModel, 'claude-opus-5[1m]', 'stale id must use the canonical default');

  const invalidAgent = buildAgentSidebarBootstrap({ ...input(), selectedAgent: 'removed-agent' });
  assert.equal(invalidAgent.selectedAgent, 'claude-code');

  assert.throws(
    () => buildAgentSidebarBootstrap({ ...input(), claudeModels: [] }),
    /Claude model catalog is empty/,
  );
  assert.throws(
    () => buildAgentSidebarBootstrap({ ...input(), codexModels: [] }),
    /Codex model catalog is empty/,
  );
  assert.doesNotThrow(
    () => buildAgentSidebarBootstrap({ ...input(), codexEnabled: false, codexModels: [] }),
  );
  assert.throws(
    () => buildAgentSidebarBootstrap({ ...input(), agents: [] }),
    /No Agent Chat runtimes are available/,
  );

  console.log('Agent sidebar bootstrap tests passed.');
}

main();
