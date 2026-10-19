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
  byokProviderModels?: Record<string, Array<{ id: string; label: string; description: string; hidden?: boolean }>>;
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

/** Sprint 134 (R20): the browser's share question, asked on the AI's sheet about the page in front (#455). */
export interface BrowserShareQuestionMessage {
  type: 'browser:share-question';
  pageId: string;
  /** The page's title, or its address's host when it has none. */
  title: string;
}

/** Sprint 134 (R20): the page in front changed or went before an answer; the question goes. */
export interface BrowserShareQuestionClearMessage {
  type: 'browser:share-question-clear';
}

/** Sprint 134 (R20): the person's answer, from the sheet to the host. */
export interface BrowserShareAnswerMessage {
  type: 'browser:share-answer';
  pageId: string;
  answer: 'share' | 'notNow';
  /** "Share pages I open in Ritemark without asking"; counts only with Share. */
  withoutAsking: boolean;
}

export function decodeBrowserShareAnswer(value: unknown): BrowserShareAnswerMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type !== 'browser:share-answer' || typeof message.pageId !== 'string' || !message.pageId) return null;
  if (message.answer !== 'share' && message.answer !== 'notNow') return null;
  return { type: 'browser:share-answer', pageId: message.pageId, answer: message.answer, withoutAsking: message.withoutAsking === true };
}
