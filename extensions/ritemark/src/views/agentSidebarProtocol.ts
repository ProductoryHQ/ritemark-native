import type { AgentId, AgentInfo } from '../agent/types';
import type { DiscoveredAgent, DiscoveredCommand } from '../agent/discovery';
import type { ModelEntry } from '../ai/modelCatalog';
import type { RuntimeCapabilities } from '../runtime/capabilities';

export interface AgentSidebarBootstrapMessage {
  type: 'agent:bootstrap';
  generation: number;
  agenticEnabled: boolean;
  parallelChatsEnabled: boolean;
  durableAgentConversations: boolean;
  composerThinkingEffortEnabled: boolean;
  codexEnabled: boolean;
  opencodeEnabled: boolean;
  selectedAgent: AgentId;
  selectedModel: string;
  agents: AgentInfo[];
  models: ModelEntry[];
  codexModels: ModelEntry[];
  byokProviderModels?: Record<string, Array<{ id: string; label: string; description: string }>>;
  hasSeenWelcome: boolean;
  workspacePath?: string;
  claudeSdkVersion: string | null;
  runtimeCapabilities: Record<AgentId, RuntimeCapabilities>;
}

export interface AgentSidebarBootstrapErrorMessage {
  type: 'agent:bootstrap-error';
  generation: number;
  error: string;
}

export interface AgentSidebarDiscoveryMessage {
  type: 'agent:discovery';
  generation: number;
  revision: number;
  agents: DiscoveredAgent[];
  commands: DiscoveredCommand[];
  error?: string;
}

export interface AgentSidebarStatusCheckingMessage {
  type: 'agent:status-checking';
  runtimeId: AgentId;
  generation: number;
  revision: number;
}

export interface AgentSidebarRuntimeStatusErrorMessage {
  type: 'agent:runtime-status-error';
  runtimeId: AgentId;
  generation: number;
  revision: number;
  error: string;
}

export type AgentSidebarProtocolMessage =
  | AgentSidebarBootstrapMessage
  | AgentSidebarBootstrapErrorMessage
  | AgentSidebarDiscoveryMessage
  | AgentSidebarStatusCheckingMessage
  | AgentSidebarRuntimeStatusErrorMessage;
