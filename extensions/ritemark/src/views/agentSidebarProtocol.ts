import type { AgentId, AgentInfo } from '../agent/types';
import type { DiscoveredAgent, DiscoveredCommand } from '../agent/discovery';
import type { ModelEntry } from '../ai/modelCatalog';
import type { RuntimeCapabilities } from '../runtime/capabilities';
import type { SignInProblem } from '../welcome/words';
import type { LoginPollEnd } from '../codex/codexStatusEvents';

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
  /** Sprint 139 (R4): the catalog's Claude default (`modelCatalog.getDefault`), for the refused-model card. */
  defaultClaudeModel?: string;
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

/** Sprint 160 (#696): the two AIs whose sign-in the AI's sheet runs and shows ("Almost there!"). */
export type SheetSignInAi = 'claude' | 'chatgpt';

/**
 * Sprint 160 (#696): the line a sign-in card on the sheet shows. A sign-in that ended without success says why
 * (`signInProblem`'s 'failed', 'timed-out' and 'could-not-start'); 'not-opened' is "Open the page again" finding no
 * page to open while the sign-in still waits (`homeReopenNotOpened`).
 */
export type SheetSignInLine = Exclude<SignInProblem, 'not-ready'>;

/**
 * Sprint 160 (#696): what a sign-in card on the sheet shows beyond the AI's state, from the host. `page`: the running
 * sign-in's page is known, so "Open the page again" can open it. Never the page's address itself.
 */
export interface SheetSignInMessage {
  type: 'onboarding:sign-in';
  ai: SheetSignInAi;
  page: boolean;
  line: SheetSignInLine | null;
}

/** What the sheet keeps of it, per AI. */
export type SheetSignInView = Pick<SheetSignInMessage, 'page' | 'line'>;

/**
 * Pictures with ChatGPT (the Experience lead on #800): a ChatGPT item opened the sheet on ChatGPT's sign-in card, so
 * the card takes one soft accent ring for `SIGN_IN_ATTENTION_MS` (none with reduced motion), to be found at once.
 */
export interface SheetSignInAttentionMessage {
  type: 'onboarding:sign-in-attention';
  ai: SheetSignInAi;
}

/** How long the ring shows. */
export const SIGN_IN_ATTENTION_MS = 1_500;

/** The AI whose card is to be found, from a host message; null for anything else. */
export function signInAttentionOf(message: unknown): SheetSignInAi | null {
  if (!message || typeof message !== 'object') return null;
  const value = message as { type?: unknown; ai?: unknown };
  if (value.type !== 'onboarding:sign-in-attention') return null;
  return value.ai === 'claude' || value.ai === 'chatgpt' ? value.ai : null;
}

/** Whether a ring that started at `since` (ms) still shows at `now`. */
export function signInAttentionShows(since: number | null | undefined, now: number): boolean {
  return typeof since === 'number' && now >= since && now - since < SIGN_IN_ATTENTION_MS;
}

/** Sprint 160 (#696): the card's Cancel and its "Open the page again", from the sheet to the host. */
export interface SheetSignInRequest {
  type: 'onboarding:cancel-sign-in' | 'onboarding:reopen-sign-in';
  ai: SheetSignInAi;
}

/**
 * Sprint 160 (#696): the ChatGPT card's line when its sign-in's poll ends. The 2-minute give-up says "not finished in
 * time" only for a login whose page opened here; Settings' own login (another app-server, which says it started before
 * its login has a page) just ends. Ready and a stop leave no line.
 */
export function sheetLineForCodexPollEnd(end: LoginPollEnd, pageOpened: boolean): SheetSignInLine | null {
  if (end === 'failed') return 'failed';
  return end === 'gave-up' && pageOpened ? 'timed-out' : null;
}

export function decodeSheetSignInRequest(value: unknown): SheetSignInRequest | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type !== 'onboarding:cancel-sign-in' && message.type !== 'onboarding:reopen-sign-in') return null;
  if (message.ai !== 'claude' && message.ai !== 'chatgpt') return null;
  return { type: message.type, ai: message.ai };
}
