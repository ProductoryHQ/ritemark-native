import type { AgentId, AgentInfo } from '../agent/types';
import type { ModelEntry } from '../ai/modelCatalog';
import { findModelEntry } from '../ai/modelCatalog/resolver';
import type { RuntimeCapabilities } from '../runtime/capabilities';
import type { AgentSidebarBootstrapMessage } from './agentSidebarProtocol';

export interface AgentSidebarBootstrapInput {
  generation: number;
  agenticEnabled: boolean;
  parallelChatsEnabled: boolean;
  durableAgentConversations: boolean;
  composerThinkingEffortEnabled: boolean;
  codexEnabled: boolean;
  opencodeEnabled: boolean;
  selectedAgent: string;
  persistedClaudeModel: string;
  defaultClaudeModel: string;
  agents: AgentInfo[];
  claudeModels: ModelEntry[];
  codexModels: ModelEntry[];
  byokProviderModels?: Record<string, Array<{ id: string; label: string; description: string }>>;
  hasSeenWelcome: boolean;
  workspacePath?: string;
  claudeSdkVersion: string | null;
  runtimeCapabilities: Record<AgentId, RuntimeCapabilities>;
}

export class AgentSidebarBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSidebarBootstrapError';
  }
}

/**
 * Build the atomic Agent Chat bootstrap from already-available local state.
 * This function is intentionally pure: runtime, credential, network, process,
 * and filesystem work belong to post-bootstrap hydration.
 */
export function buildAgentSidebarBootstrap(input: AgentSidebarBootstrapInput): AgentSidebarBootstrapMessage {
  if (input.claudeModels.length === 0) {
    throw new AgentSidebarBootstrapError('Claude model catalog is empty.');
  }
  if (input.codexEnabled && input.codexModels.length === 0) {
    throw new AgentSidebarBootstrapError('Codex model catalog is empty.');
  }
  if (input.agents.length === 0) {
    throw new AgentSidebarBootstrapError('No Agent Chat runtimes are available.');
  }

  const selectedAgent = input.agents.some((agent) => agent.id === input.selectedAgent)
    ? input.selectedAgent as AgentId
    : input.agents[0].id;
  const selectedModel = findModelEntry(input.claudeModels, input.persistedClaudeModel)?.id
    ?? findModelEntry(input.claudeModels, input.defaultClaudeModel)?.id
    ?? input.claudeModels[0].id;

  return {
    type: 'agent:bootstrap',
    generation: input.generation,
    agenticEnabled: input.agenticEnabled,
    parallelChatsEnabled: input.parallelChatsEnabled,
    durableAgentConversations: input.durableAgentConversations,
    composerThinkingEffortEnabled: input.composerThinkingEffortEnabled,
    codexEnabled: input.codexEnabled,
    opencodeEnabled: input.opencodeEnabled,
    selectedAgent,
    selectedModel,
    agents: input.agents,
    models: input.claudeModels,
    codexModels: input.codexModels,
    byokProviderModels: input.byokProviderModels,
    hasSeenWelcome: input.hasSeenWelcome,
    workspacePath: input.workspacePath,
    claudeSdkVersion: input.claudeSdkVersion,
    runtimeCapabilities: input.runtimeCapabilities,
  };
}
