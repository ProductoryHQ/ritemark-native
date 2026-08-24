/**
 * AgentRunner - Reusable Claude Agent SDK executor
 *
 * Provides two modes:
 * - `runAgent()` — Stateless one-shot execution (used by Flows)
 * - `AgentSession` — Persistent multi-turn session (used by AI sidebar)
 *
 * AgentSession uses the SDK's streaming input pattern: a single long-lived
 * AsyncGenerator feeds messages to the Claude Code process. The process
 * stays warm between turns, so follow-up messages start in ~2-3s instead
 * of ~8-12s (no process re-spawn).
 */

import type {
  AgentExecutionOptions,
  AgentPlanApprovalRequest,
  AgentToolApprovalRequest,
  AgentQuestion,
  AgentSettingSource,
  AgentSessionConfig,
  AgentTurnOptions,
  AgentProgress,
  AgentResult,
  AgentMetrics,
  FileAttachment,
  ModelOption,
  QueryHandle,
  SDKMessage,
  SubagentProgress,
} from './types';
import type { ExplicitThinkingEffort } from '../runtime/thinkingEffort';
import * as path from 'path';
import { traceClaude } from './agentTrace';

// Dynamic import for ES Module SDK (VS Code extensions use CommonJS)
// Using Function constructor to bypass TypeScript's import() → require() transformation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let queryFn: ((options: { prompt: any; options: Record<string, unknown> }) => any) | null = null;

async function getQuery() {
  if (!queryFn) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
    const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
    queryFn = sdk.query as unknown as typeof queryFn;
  }
  return queryFn!;
}

// ── Message building ─────────────────────────────────────────────────

/**
 * Build an SDKUserMessage object with optional file attachments.
 *
 * - Images → `image` content block (base64)
 * - PDFs   → `document` content block (base64)
 * - Text   → prepended to prompt as fenced code block
 */
function buildUserMessage(text: string, attachments?: FileAttachment[]): Record<string, unknown> {
  if (attachments && attachments.length > 0) {
    const content: Array<Record<string, unknown>> = [];
    let textPrefix = '';

    for (const att of attachments) {
      if (att.kind === 'image') {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: att.mediaType, data: att.data },
        });
      } else if (att.kind === 'pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: att.data },
        });
      } else if (att.kind === 'text') {
        // Text files are included inline in the prompt
        textPrefix += `[File: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\`\n\n`;
      }
    }

    const fullText = textPrefix ? textPrefix + text : text;
    content.push({ type: 'text', text: fullText });

    return {
      type: 'user',
      message: { role: 'user', content },
      parent_tool_use_id: null,
      session_id: '',
    };
  }
  return {
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
    session_id: '',
  };
}

/**
 * Wrap a single message as an AsyncIterable (for one-shot query with images).
 */
async function* asSingleMessage(msg: Record<string, unknown>) {
  yield msg;
}

// ── Context overflow detection ────────────────────────────────────────

const CONTEXT_OVERFLOW_PATTERNS = [
  'prompt is too long',
  'prompt too long',
  'context window',
  'context_length_exceeded',
  'too many tokens',
  'maximum context length',
  'exceeds the model',
  'token limit',
];

function isContextOverflowError(str: string): boolean {
  const lower = str.toLowerCase();
  return CONTEXT_OVERFLOW_PATTERNS.some(p => lower.includes(p));
}

// ── Constants ────────────────────────────────────────────────────────

export const DEFAULT_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'AskUserQuestion', 'ExitPlanMode'];
export const DEFAULT_SETTING_SOURCES: AgentSettingSource[] = ['user', 'project', 'local'];

/** Tools that mutate the workspace — gated behind approval in 'ask' mode. */
const MUTATING_TOOLS = new Set(['Bash', 'Write', 'Edit', 'NotebookEdit']);
/**
 * Sprint 103 R2 (audit F7): tools that must NEVER be passed to the SDK as bare
 * `allowedTools` names — a bare allow entry auto-approves the tool and the SDK
 * then skips `canUseTool` entirely. Mutating tools must reach the Ask gate;
 * ExitPlanMode must reach the plan-approval card.
 */
const NEVER_AUTO_ALLOWED = new Set([...MUTATING_TOOLS, 'ExitPlanMode']);
const DEFAULT_TIMEOUT_MINUTES = 15;
// Sprint 103 R2/R4 (audit F4): no ExitPlanMode/plan-mode nudges outside plan
// mode — the always-on reminder made Claude plan autonomously in Auto mode.
// Plan-mode behavior now comes from the SDK's native plan mode +
// PLAN_MODE_INSTRUCTIONS below.
const CLAUDE_LIFECYCLE_APPEND = [
  'LIFECYCLE RULES:',
  '- If you need clarification from the user and AskUserQuestion can represent it, use AskUserQuestion instead of asking in normal assistant text.',
  '- If the user explicitly asked for multiple-choice questions, use AskUserQuestion for them.',
  '- After AskUserQuestion, wait for the user response instead of continuing as if the tool had not paused execution.',
].join('\n');
const CLAUDE_TURN_REMINDER = [
  'Follow the Ritemark lifecycle contract for this turn.',
  'Use AskUserQuestion for multiple-choice clarification when needed.',
].join(' ');
/**
 * Sprint 103 R2: Ritemark's plan-mode voice, delivered via the SDK's
 * `planModeInstructions`. The CLI wraps this with its own read-only
 * enforcement preamble and the ExitPlanMode protocol footer, so this text only
 * carries the Ritemark-specific workflow flavor.
 */
const PLAN_MODE_INSTRUCTIONS = [
  'You are planning a change in a Ritemark markdown workspace (a visual markdown editor, not a code IDE).',
  'Read what you need, then produce a short, reviewable plan of the document changes.',
  'Keep the plan concrete: which files, which sections, what new or changed content.',
].join('\n');

const DEFAULT_EXCLUDED_FOLDERS = [
  '.git',
  'node_modules',
  '.env',
  '.env.*',
  '.vscode',
  '.DS_Store',
  '*.pem',
  '*.key',
  'credentials*',
  'secrets*',
];

/**
 * Build a system prompt suffix for workspace safety boundaries.
 */
function buildSafetyPrefix(workspacePath: string, excludedFolders: string[]): string {
  if (excludedFolders.length === 0) return '';
  const exclusions = excludedFolders.map(f => `  - ${f}`).join('\n');
  return `IMPORTANT: You are working inside this workspace: ${workspacePath}
Do NOT read, write, edit, or delete files matching these patterns:
${exclusions}
If a user asks you to operate on these paths, explain that they are excluded for safety.\n\n`;
}

export function buildClaudeSystemAppend(workspacePath: string, excludedFolders: string[]): string {
  return buildSafetyPrefix(workspacePath, excludedFolders) + CLAUDE_LIFECYCLE_APPEND;
}

export function buildClaudeTurnPrompt(prompt: string): string {
  return `${CLAUDE_TURN_REMINDER}\n\n${prompt}`;
}

function normalizeAgentQuestion(input: Record<string, unknown>, toolUseId: string): AgentQuestion | null {
  const rawQuestions = input.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return null;
  }

  const questions = rawQuestions.flatMap((rawQuestion) => {
    if (!rawQuestion || typeof rawQuestion !== 'object') {
      return [];
    }

    const question = typeof rawQuestion.question === 'string' ? rawQuestion.question.trim() : '';
    const header = typeof rawQuestion.header === 'string' ? rawQuestion.header.trim() : '';
    const rawOptions = Array.isArray(rawQuestion.options) ? rawQuestion.options : [];
    const options = rawOptions.flatMap((rawOption: unknown) => {
      if (!rawOption || typeof rawOption !== 'object') {
        return [];
      }
      const option = rawOption as { label?: unknown; description?: unknown };
      const label = typeof option.label === 'string' ? option.label.trim() : '';
      if (!label) {
        return [];
      }
      return [{
        label,
        description: typeof option.description === 'string' ? option.description.trim() : '',
      }];
    });

    if (!question || !header || options.length < 2) {
      return [];
    }

    return [{
      header,
      question,
      options,
      multiSelect: rawQuestion.multiSelect === true,
    }];
  });

  if (questions.length === 0) {
    return null;
  }

  return { toolUseId, questions };
}

function resolveSettingSources(settingSources?: AgentSettingSource[]): AgentSettingSource[] {
  return settingSources && settingSources.length > 0
    ? settingSources
    : DEFAULT_SETTING_SOURCES;
}

// ── One-shot execution (for Flows) ──────────────────────────────────

/**
 * Execute an agent task as a one-shot operation.
 * For multi-turn conversations, use AgentSession instead.
 */
export async function runAgent(options: AgentExecutionOptions): Promise<AgentResult> {
  const {
    prompt,
    workspacePath,
    model,
    attachments,
    allowedTools = DEFAULT_TOOLS,
    settingSources,
    excludedFolders = DEFAULT_EXCLUDED_FOLDERS,
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
    abortSignal,
    onProgress,
    pathToClaudeCodeExecutable,
  } = options;

  const emitProgress: ExtendedProgressEmitter = (
    type,
    message,
    tool?,
    file?,
    subagentInfo?
  ) => {
    onProgress?.({
      type,
      message,
      tool,
      file,
      timestamp: Date.now(),
      subagentId: subagentInfo?.subagentId,
      subagentTask: subagentInfo?.subagentTask,
      parentToolUseId: subagentInfo?.parentToolUseId,
    });
  };

  if (!prompt || prompt.trim() === '') {
    throw new Error('Agent prompt is empty');
  }

  const fullPrompt = buildClaudeTurnPrompt(buildSafetyPrefix(workspacePath, excludedFolders) + prompt);

  const abortController = new AbortController();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // Inactivity timeout — resets on each agent activity
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const resetTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  };
  resetTimeout();

  if (abortSignal) {
    if (abortSignal.aborted) {
      if (timeoutId) clearTimeout(timeoutId);
      return {
        text: '',
        filesModified: [],
        metrics: { durationMs: 0, costUsd: null, model: null },
        error: 'Execution cancelled',
      };
    }
    abortSignal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  const metrics: AgentMetrics = { durationMs: 0, costUsd: null, model: null };
  const filesModified: string[] = [];

  try {
    const query = await getQuery();
    const promptPayload = attachments && attachments.length > 0
      ? asSingleMessage(buildUserMessage(fullPrompt, attachments))
      : fullPrompt;
    const stream = query({
      prompt: promptPayload,
      options: {
        cwd: workspacePath,
        ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
        // Model drift fix (Codex review, PR #183): one-shot sessions (flows,
        // daemon) never run modeless — otherwise the CLI resolves the model
        // from the user's personal config. Lazy require: modelCatalog pulls in
        // vscode, which the tsx unit tests cannot load at module scope.
        model: model ?? (require('../ai/modelCatalog') as typeof import('../ai/modelCatalog')).getDefault('anthropic', 'claude-code'),
        settingSources: resolveSettingSources(settingSources),
        // Sprint 103 R2: headless flow runs auto-approve via canUseTool below —
        // same behavior as the old bypassPermissions without the dangerous flag.
        permissionMode: 'acceptEdits',
        allowedTools,
        canUseTool: async (toolName: string) => {
          if (toolName === 'AskUserQuestion') {
            return {
              behavior: 'deny',
              message: 'AskUserQuestion is not available during flow execution.',
            };
          }
          return { behavior: 'allow' };
        },
        abortController,
      },
    });

    let resultText = '';

    for await (const rawMessage of stream) {
      const message = rawMessage as SDKMessage;

      if (abortController.signal.aborted) {
        if (timeoutId) clearTimeout(timeoutId);
        return { text: '', filesModified: [], metrics, error: 'Execution cancelled' };
      }

      // Reset inactivity timeout on any activity
      if (message.type !== 'result') {
        resetTimeout();
      }

      if (message.type === 'system' && message.subtype === 'init') {
        metrics.model = message.model || null;
        emitProgress('init', `Starting Claude (${message.model || 'claude'})`);
      } else if (message.type === 'system' && message.subtype === 'status' && (message as any).status === 'compacting') {
        emitProgress('compacting', 'Vestlus on pikaks läinud — teen varasemast kokkuvõtte...');
      } else if (message.type === 'system' && message.subtype === 'compact_boundary') {
        emitProgress('compacted', 'Varasem vestlus on kokku võetud. Kui midagi olulist puudu, maini seda uuesti.');
      } else if (message.type === 'assistant') {
        processAssistantMessage(message, filesModified, emitProgress, message.parent_tool_use_id);
      } else if (message.type === 'tool_progress' || (message.type === 'system' && message.subtype === 'task_notification')) {
        processSystemMessage(message, emitProgress);
      } else if (message.type === 'result') {
        metrics.durationMs = message.duration_ms || 0;
        metrics.costUsd = message.total_cost_usd ?? null;

        if (message.subtype === 'success') {
          resultText = message.result || '';
          const durationStr = (metrics.durationMs / 1000).toFixed(1);
          emitProgress('done', `Completed in ${durationStr}s`);
        } else {
          const errors = message.errors || [];
          const errorStr = errors.join('; ') || 'Execution failed';
          const progressType = isContextOverflowError(errorStr) ? 'context_overflow' : 'error';
          emitProgress(progressType as AgentProgress['type'], errorStr);
          if (timeoutId) clearTimeout(timeoutId);
          return { text: '', filesModified: [], metrics, error: errorStr };
        }
      }
    }

    if (timeoutId) clearTimeout(timeoutId);
    return {
      text: resultText,
      filesModified: Array.from(new Set(filesModified)),
      metrics,
    };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (abortController.signal.aborted) {
      return { text: '', filesModified: [], metrics, error: 'Execution cancelled or timed out' };
    }

    const progressType = isContextOverflowError(errorMessage) ? 'context_overflow' : 'error';
    emitProgress(progressType as AgentProgress['type'], errorMessage);
    return { text: '', filesModified: [], metrics, error: errorMessage };
  }
}

// ── Persistent multi-turn session (for AI sidebar) ──────────────────

/**
 * Persistent agent session using the SDK's streaming input pattern.
 *
 * A single AsyncGenerator feeds user messages to the Claude Code process.
 * The process stays warm between turns — follow-up messages start in ~2-3s
 * instead of ~8-12s (no process re-spawn per turn).
 *
 * Architecture:
 * - `_createMessageStream()`: long-lived generator that yields messages on demand
 * - `_consumeLoop()`: background loop reading SDK output for the session lifetime
 * - `sendMessage()`: pushes a message into the generator, waits for the result
 * - Turn tracking via `_turnId` / `_consumerTurnId` prevents stale results
 *   from resolving the wrong turn after interrupt+resend.
 */
export class AgentSession {
  // Query stream and session state
  private _queryStream: QueryHandle | null = null;
  private _closed = false;
  private _model: string | null = null;

  // Input channel: unbounded queue connecting sendMessage → generator
  private _inputQueue: Array<Record<string, unknown>> = [];
  private _inputWaiter: ((msg: Record<string, unknown>) => void) | null = null;

  // Turn tracking
  private _turnId = 0;           // Incremented by sendMessage
  private _consumerTurnId = 0;   // Set by generator when it yields to SDK
  private _turnResolve: ((result: AgentResult) => void) | null = null;
  private _turnFilesModified: string[] = [];
  private _emitProgress: ExtendedProgressEmitter | null = null;
  private _emitQuestion: ((question: AgentQuestion) => void) | null = null;
  private _emitPlanApproval: ((request: AgentPlanApprovalRequest) => void) | null = null;
  private _emitToolApproval: ((request: AgentToolApprovalRequest) => void) | null = null;
  private _emitDispatchAccepted: (() => void) | null = null;
  private _turnTimeout: ReturnType<typeof setTimeout> | null = null;
  private _turnTimeoutMs = 0;  // Stored so we can reset on activity
  private _planModeActive = false;
  // Pending user decisions, keyed by toolUseId.
  //
  // These MUST be maps, not single slots. The SDK calls canUseTool once per
  // tool_use block, and the model can emit several in one assistant message
  // (e.g. two Writes in Ask mode). With a single slot the second request
  // overwrote the first, whose promise then had no resolver left — that tool
  // call hung until the inactivity timeout fired.
  //
  // toolUseId is Anthropic's server-minted `toolu_...`, unique across sessions
  // and processes, so it is safe as a key even once one process hosts several
  // concurrent conversations.
  private _pendingQuestions = new Map<string, {
    resolve: (answers: Record<string, string>) => void;
    reject: (error: Error) => void;
  }>();
  private _pendingPlanApprovals = new Map<string, {
    resolve: (decision: { approved: boolean; feedback?: string }) => void;
    reject: (error: Error) => void;
  }>();
  private _pendingToolApprovals = new Map<string, {
    resolve: (approved: boolean) => void;
    reject: (error: Error) => void;
  }>();

  // Config
  private readonly _workspacePath: string;
  private readonly _excludedFolders: string[];
  private _allowedTools: string[];
  private readonly _settingSources: AgentSettingSource[];
  private readonly _modelId: string | undefined;
  private readonly _anthropicApiKey: string | undefined;
  private readonly _pathToClaudeCodeExecutable: string | undefined;
  private readonly _resumeSessionId: string | undefined;
  private readonly _onSessionCheckpoint: ((sessionId: string) => void) | undefined;
  private _mcpServers: Record<string, unknown> | undefined;
  private _extraSystemPromptAppend: string | undefined;
  /** Autonomy policy (Sprint 103 R1; mutable per turn via setApprovalMode). */
  private _approvalMode: 'auto' | 'ask' = 'auto';
  /** Plan-first collaboration state (Sprint 103 R1/R2). Cleared on plan approval. */
  private _planFirst = false;
  /** SDK permission mode the live session currently runs in. */
  private _activeSdkMode: string | null = null;
  /** Sprint 103 R7: ms of the current turn spent waiting on the user. */
  private _turnWaitedMs = 0;

  /** Called when SDK reports its available models (after session init) */
  onModelsDiscovered: ((models: ModelOption[]) => void) | null = null;

  constructor(config: AgentSessionConfig) {
    this._workspacePath = config.workspacePath;
    this._excludedFolders = config.excludedFolders || DEFAULT_EXCLUDED_FOLDERS;
    this._allowedTools = config.allowedTools || DEFAULT_TOOLS;
    this._settingSources = resolveSettingSources(config.settingSources);
    this._modelId = config.model;
    this._anthropicApiKey = config.anthropicApiKey;
    this._pathToClaudeCodeExecutable = config.pathToClaudeCodeExecutable;
    this._resumeSessionId = config.resumeSessionId;
    this._onSessionCheckpoint = config.onSessionCheckpoint;
    this._mcpServers = config.mcpServers;
    this._extraSystemPromptAppend = config.extraSystemPromptAppend;
    // Legacy 'plan' normalizes to auto + planFirst (Sprint 103 R1).
    const mode = config.approvalMode ?? 'auto';
    this._approvalMode = mode === 'ask' ? 'ask' : 'auto';
    this._planFirst = config.planFirst === true || mode === 'plan';
  }

  /**
   * Update the autonomy policy and plan-first state (Sprint 103 R1/R3).
   * Safe to call between turns on a LIVE session: when the effective SDK
   * permission mode changes, it is switched in place via the SDK's
   * `setPermissionMode` — no session rebuild, no context loss (audit F8).
   */
  setApprovalMode(mode: 'auto' | 'ask' | 'plan', planFirst?: boolean): void {
    this._approvalMode = mode === 'ask' ? 'ask' : 'auto';
    this._planFirst = planFirst === true || mode === 'plan';
    this._syncSdkPermissionMode();
  }

  /**
   * Map the current policy to an SDK permission mode (Sprint 103 R2/R3, audit §5):
   * - planFirst → 'plan'        (native enforced plan mode)
   * - 'ask'     → 'default'     (mutating tools hit canUseTool)
   * - 'auto'    → 'acceptEdits' (edits auto-approved; the rest auto-allowed in
   *                              canUseTool — NEVER bypassPermissions, whose mere
   *                              availability disables plan-mode enforcement)
   */
  private _sdkModeFor(planFirst = this._planFirst): 'plan' | 'default' | 'acceptEdits' {
    if (planFirst) return 'plan';
    return this._approvalMode === 'ask' ? 'default' : 'acceptEdits';
  }

  /** Push the effective SDK mode to a live session when it changed. */
  private _syncSdkPermissionMode(): void {
    if (!this._queryStream || this._closed) return;
    const next = this._sdkModeFor();
    if (next === this._activeSdkMode) return;
    this._activeSdkMode = next;
    traceClaude('lifecycle', 'setPermissionMode', { mode: next });
    (this._queryStream as unknown as { setPermissionMode?: (m: string) => Promise<void> })
      .setPermissionMode?.(next)
      ?.catch((err: unknown) => traceClaude('lifecycle', 'setPermissionMode failed', {
        error: err instanceof Error ? err.message : String(err),
      }));
  }

  /**
   * Replace the MCP servers exposed to the agent. Takes effect on the NEXT
   * session start — does not affect an already-running session. The
   * `mcpServers` option is passed to the SDK query at session init.
   */
  setMcpServers(servers: Record<string, unknown> | undefined): void {
    this._mcpServers = servers;
  }

  /**
   * Replace the allowed tools list. Like `setMcpServers`, takes effect on
   * the next session start. Used by Sprint 69 to opt browser-action tool
   * names into the allow-list when browser control is active.
   */
  setAllowedTools(tools: string[]): void {
    this._allowedTools = tools;
  }

  get isActive(): boolean {
    return this._queryStream !== null && !this._closed;
  }

  /**
   * Send a message to the agent. First call starts the session,
   * subsequent calls feed into the existing warm process (~2-3s).
   */
  async sendMessage(options: AgentTurnOptions): Promise<AgentResult> {
    const {
      prompt,
      attachments,
      activeFile,
      timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
      onProgress,
      onQuestion,
      onPlanApproval,
      onToolApproval,
      onDispatchAccepted,
      thinkingEffort = 'auto',
      onThinkingEffortApplied,
    } = options;

    if (!prompt || prompt.trim() === '') {
      throw new Error('Agent prompt is empty');
    }

    // Build prompt with active file context (skip if already referenced in path chips)
    let fullPrompt = buildClaudeTurnPrompt(prompt);
    if (activeFile) {
      const alreadyReferenced = fullPrompt.includes(`[File: ${activeFile.path}]`) ||
        fullPrompt.match(new RegExp(`\\[File:.*/${activeFile.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`));
      if (!alreadyReferenced) {
        let fileContext = `[Currently editing: ${activeFile.path}]`;
        if (activeFile.selection) {
          const selSnippet = activeFile.selection.length > 500
            ? activeFile.selection.substring(0, 500) + '...'
            : activeFile.selection;
          fileContext += `\n[Selected text: ${selSnippet}]`;
        }
        fullPrompt = fileContext + '\n\n' + fullPrompt;
      } else if (activeFile.selection) {
        // File already referenced but selection still useful
        const selSnippet = activeFile.selection.length > 500
          ? activeFile.selection.substring(0, 500) + '...'
          : activeFile.selection;
        fullPrompt = `[Selected text: ${selSnippet}]\n\n` + fullPrompt;
      }
    }

    const userMsg = buildUserMessage(fullPrompt, attachments);
    const turnId = ++this._turnId;
    traceClaude('execution', 'sendMessage', {
      turnId,
      model: this._modelId ?? this._model,
      promptPreview: prompt.slice(0, 200),
      attachmentCount: attachments?.length ?? 0,
      activeFile: activeFile?.path ?? null,
    });

    // Set per-turn state BEFORE starting/enqueueing
    this._turnFilesModified = [];
    this._turnWaitedMs = 0;
    // In a plan-first turn the whole phase is plan context (native plan mode);
    // otherwise plan state only activates on a model-initiated EnterPlanMode.
    this._planModeActive = this._planFirst;
    this._clearPendingQuestion();
    this._clearPendingPlanApproval();
    this._clearPendingToolApproval();
    this._emitProgress = (type, message, tool?, file?, subagentInfo?) => {
      onProgress?.({
        type,
        message,
        tool,
        file,
        timestamp: Date.now(),
        subagentId: subagentInfo?.subagentId,
        subagentTask: subagentInfo?.subagentTask,
        parentToolUseId: subagentInfo?.parentToolUseId,
      });
    };
    this._emitQuestion = onQuestion || null;
    this._emitPlanApproval = onPlanApproval || null;
    this._emitToolApproval = onToolApproval || null;
    this._emitDispatchAccepted = onDispatchAccepted || null;

    const resultPromise = new Promise<AgentResult>((resolve) => {
      this._turnResolve = resolve;
    });

    // Per-turn inactivity timeout — resets on each agent activity
    this._turnTimeoutMs = timeoutMinutes * 60 * 1000;
    this._resetTurnTimeout();

    if (!this._queryStream) {
      // First turn — start session with warm process
      await this._startSession(userMsg, thinkingEffort);
      // The SDK accepted the flag, but only hook payloads expose a truthful
      // post-downgrade level. Do not echo the requested value as provider fact.
      onThinkingEffortApplied?.();
    } else {
      // Follow-up turn — feed into existing warm process
      const applyFlagSettings = this._queryStream.applyFlagSettings;
      if (!applyFlagSettings) {
        throw new Error('Claude runtime does not support changing thinking effort on a warm session');
      }
      await applyFlagSettings.call(this._queryStream, {
        effortLevel: thinkingEffort === 'auto' ? null : thinkingEffort,
      });
      onThinkingEffortApplied?.();
      this._emitProgress('init', `Continuing (${this._model || 'claude'})`);
      this._enqueueInput(userMsg);
    }

    return resultPromise;
  }

  /**
   * Cancel the current turn. Sends interrupt to the agent; the consumer
   * loop will receive the interrupted result. We also force-resolve the
   * turn promise immediately so the UI isn't blocked.
   */
  interrupt(): void {
    const turnId = this._turnId;
    traceClaude('lifecycle', 'interrupt', { turnId });
    this._queryStream?.interrupt().catch(() => {});
    this._clearPendingQuestion('Execution cancelled');
    this._clearPendingPlanApproval('Execution cancelled');
    this._clearPendingToolApproval('Execution cancelled');
    this._forceResolveTurn(turnId, {
      text: '',
      filesModified: [],
      metrics: { durationMs: 0, costUsd: null, model: this._model },
      error: 'Execution cancelled',
    });
  }

  /**
   * Close the session entirely. Kills the process and resets all state.
   */
  close(): void {
    traceClaude('lifecycle', 'close', {
      active: this.isActive,
      currentTurnId: this._turnId,
    });
    this._closed = true;
    try { this._queryStream?.close(); } catch {}
    this._queryStream = null;
    this._model = null;
    this._clearPendingQuestion('Session closed');
    this._clearPendingPlanApproval('Session closed');
    this._clearPendingToolApproval('Session closed');
    this._forceResolveTurn(this._turnId, {
      text: '',
      filesModified: [],
      metrics: { durationMs: 0, costUsd: null, model: null },
      error: 'Session closed',
    });
    // Unblock any pending dequeue
    this._inputWaiter?.({} as Record<string, unknown>);
    this._inputWaiter = null;
    this._inputQueue = [];
  }

  // ── Model discovery ────────────────────────────────────────────────

  private async _fetchSupportedModels() {
    try {
      const qs = this._queryStream as any;
      if (qs && typeof qs.supportedModels === 'function') {
        const models: Array<{
          value: string;
          resolvedModel?: string;
          displayName: string;
          description: string;
          supportsEffort?: boolean;
          supportedEffortLevels?: ExplicitThinkingEffort[];
          supportsAdaptiveThinking?: boolean;
        }> = await qs.supportedModels();
        if (models?.length && this.onModelsDiscovered) {
          this.onModelsDiscovered(models.map(m => ({
            id: m.value,
            label: m.displayName,
            description: m.description,
            resolvedModel: m.resolvedModel,
            supportsEffort: m.supportsEffort,
            supportedEffortLevels: m.supportedEffortLevels,
            supportsAdaptiveThinking: m.supportsAdaptiveThinking,
          })));
        }
      }
    } catch {
      // Non-critical — fallback models remain in the UI
    }
  }

  // ── Timeout management ──────────────────────────────────────────────

  /**
   * Reset the per-turn inactivity timeout. Called on each agent activity
   * (tool calls, messages) so the agent only times out if truly idle.
   */
  private _resetTurnTimeout() {
    if (this._turnTimeout) {
      clearTimeout(this._turnTimeout);
      this._turnTimeout = null;
    }
    if (this._turnTimeoutMs > 0) {
      const turnId = this._turnId;
      this._turnTimeout = setTimeout(() => {
        this._emitProgress?.('error', 'Turn timed out');
        this._forceResolveTurn(turnId, {
          text: '',
          filesModified: [],
          metrics: { durationMs: 0, costUsd: null, model: this._model },
          error: 'Turn timed out',
        });
        this._queryStream?.interrupt().catch(() => {});
      }, this._turnTimeoutMs);
    }
  }

  // ── Turn resolution ─────────────────────────────────────────────────

  /**
   * Resolve the current turn's promise, guarded by turnId to prevent
   * stale results from resolving the wrong turn after interrupt+resend.
   */
  private _forceResolveTurn(turnId: number, result: AgentResult) {
    if (this._turnResolve && turnId === this._turnId) {
      const resolve = this._turnResolve;
      this._turnResolve = null;
      this._emitProgress = null;
      this._emitQuestion = null;
      this._emitPlanApproval = null;
      this._emitToolApproval = null;
      this._turnFilesModified = [];
      this._planModeActive = false;
      if (this._turnTimeout) {
        clearTimeout(this._turnTimeout);
        this._turnTimeout = null;
      }
      resolve(result);
    }
  }

  answerQuestion(toolUseId: string, answers: Record<string, string>): boolean {
    traceClaude('lifecycle', 'answerQuestion', {
      toolUseId,
      answerKeys: Object.keys(answers),
    });
    const pending = this._pendingQuestions.get(toolUseId);
    if (!pending) {
      traceClaude('lifecycle', 'answerQuestion missed pending state', { toolUseId });
      return false;
    }

    this._pendingQuestions.delete(toolUseId);
    pending.resolve(answers);
    return true;
  }

  answerPlanApproval(toolUseId: string, approved: boolean, feedback?: string): boolean {
    traceClaude('lifecycle', 'answerPlanApproval', {
      toolUseId,
      approved,
      hasFeedback: Boolean(feedback?.trim()),
    });
    const pending = this._pendingPlanApprovals.get(toolUseId);
    if (!pending) {
      traceClaude('lifecycle', 'answerPlanApproval missed pending state', { toolUseId });
      return false;
    }

    this._pendingPlanApprovals.delete(toolUseId);
    pending.resolve({ approved, feedback });
    return true;
  }

  /** Answer a mutating-tool approval (Write/Edit/Bash) emitted in 'ask' mode. */
  answerToolApproval(toolUseId: string, approved: boolean): boolean {
    traceClaude('lifecycle', 'answerToolApproval', { toolUseId, approved });
    const pending = this._pendingToolApprovals.get(toolUseId);
    if (!pending) {
      traceClaude('lifecycle', 'answerToolApproval missed pending state', { toolUseId });
      return false;
    }
    this._pendingToolApprovals.delete(toolUseId);
    pending.resolve(approved);
    return true;
  }

  // ── Input channel ───────────────────────────────────────────────────

  private _enqueueInput(msg: Record<string, unknown>) {
    if (this._inputWaiter) {
      const resolve = this._inputWaiter;
      this._inputWaiter = null;
      resolve(msg);
    } else {
      this._inputQueue.push(msg);
    }
  }

  private _dequeueInput(): Promise<Record<string, unknown>> {
    if (this._inputQueue.length > 0) {
      return Promise.resolve(this._inputQueue.shift()!);
    }
    return new Promise((resolve) => {
      this._inputWaiter = resolve;
    });
  }

  /**
   * Long-lived AsyncGenerator that yields user messages on demand.
   * The SDK reads from this generator — between yields the process
   * stays warm, waiting for the next message.
   */
  private async *_createMessageStream(
    firstMsg: Record<string, unknown>
  ): AsyncGenerator<Record<string, unknown>> {
    this._consumerTurnId = 1;
    yield firstMsg;
    while (!this._closed) {
      const msg = await this._dequeueInput();
      if (this._closed) return;
      this._consumerTurnId++;
      yield msg;
    }
  }

  // ── Session lifecycle ───────────────────────────────────────────────

  private async _startSession(
    firstMsg: Record<string, unknown>,
    thinkingEffort: AgentTurnOptions['thinkingEffort'],
  ) {
    const query = await getQuery();
    const safetyAppend = buildClaudeSystemAppend(this._workspacePath, this._excludedFolders);
    const fullAppend = this._extraSystemPromptAppend
      ? `${safetyAppend}\n\n${this._extraSystemPromptAppend}`
      : safetyAppend;

    // Sprint 103 R2 (audit F7): a bare allowedTools name auto-approves the tool
    // and the SDK then NEVER calls canUseTool for it. Mutating tools must reach
    // the Ask gate and ExitPlanMode must reach the plan-approval card, so both
    // are excluded here. In 'acceptEdits' (Auto) file edits are auto-approved by
    // the mode itself; everything else falls through to canUseTool, where Auto
    // auto-allows.
    const sdkAllowedTools = this._allowedTools.filter((t) => !NEVER_AUTO_ALLOWED.has(t));

    const permissionMode = this._sdkModeFor();
    this._activeSdkMode = permissionMode;

    const queryOptions: Record<string, unknown> = {
      cwd: this._workspacePath,
      ...(this._pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable: this._pathToClaudeCodeExecutable } : {}),
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: fullAppend,
      },
      settingSources: this._settingSources,
      // Sprint 103 R2: never 'bypassPermissions' and never
      // allowDangerouslySkipPermissions — bypass availability alone disables
      // native plan-mode enforcement (audit §4).
      permissionMode,
      planModeInstructions: PLAN_MODE_INSTRUCTIONS,
      allowedTools: sdkAllowedTools,
      canUseTool: this._handleCanUseTool.bind(this),
      ...(this._mcpServers ? { mcpServers: this._mcpServers } : {}),
      ...(this._resumeSessionId ? { resume: this._resumeSessionId } : {}),
      ...(thinkingEffort && thinkingEffort !== 'auto' ? { effort: thinkingEffort } : {}),
    };

    if (this._modelId) {
      queryOptions.model = this._modelId;
    }

    // Pass Anthropic API key from Ritemark settings if available
    if (this._anthropicApiKey) {
      queryOptions.env = {
        ...process.env,
        ANTHROPIC_API_KEY: this._anthropicApiKey,
      };
    }

    this._queryStream = query({
      prompt: this._createMessageStream(firstMsg),
      options: queryOptions,
    }) as QueryHandle;
    traceClaude('execution', 'session started', {
      model: this._modelId ?? null,
      settingSources: this._settingSources,
      allowedTools: this._allowedTools,
      workspacePath: this._workspacePath,
    });

    // Start background consumer (runs for session lifetime)
    this._consumeLoop().catch(() => {});
  }

  /**
   * Background loop consuming SDK messages for the session lifetime.
   * On each `result` message, resolves the current turn's promise.
   * Between turns, the loop blocks on `.next()` (SDK waiting for input).
   */
  private async _consumeLoop() {
    try {
      for await (const rawMessage of this._queryStream!) {
        if (this._closed) break;
        const message = rawMessage as SDKMessage;

        // The SDK has now produced provider-originated evidence for this turn.
        // This is deliberately later than enqueueing the prompt.
        this._emitDispatchAccepted?.();
        this._emitDispatchAccepted = null;

        // Reset inactivity timeout on any activity from the agent
        if (message.type !== 'result') {
          this._resetTurnTimeout();
        }

        if (message.type === 'system' && message.subtype === 'init') {
          traceClaude('sdk', 'system:init', {
            model: message.model ?? null,
            sessionId: message.session_id ?? null,
          });
          this._model = message.model || null;
          if (message.session_id) this._onSessionCheckpoint?.(message.session_id);
          // Model truth (2026-08-05): the CLI reports the model it ACTUALLY
          // resolved (may carry a "[1m]" 1M-context suffix). If we pinned one
          // and got another, say so in the transcript — silent drift between
          // the UI label and the running model is never acceptable.
          const actualModel = (message.model || '') as string;
          const normalizedActual = actualModel.replace(/\[1m\]$/, '');
          if (this._modelId && actualModel && normalizedActual !== this._modelId) {
            this._emitProgress?.('init',
              `Model mismatch — running on ${actualModel}, but ${this._modelId} was requested. The runtime could not apply the requested model.`);
          } else {
            this._emitProgress?.('init', `Starting Claude (${actualModel || 'claude'})`);
          }
          // Fetch supported models from the SDK session
          this._fetchSupportedModels();
        } else if (message.type === 'system' && message.subtype === 'status' && (message as any).status === 'compacting') {
          traceClaude('sdk', 'system:status', { status: (message as any).status });
          this._emitProgress?.('compacting', 'Vestlus on pikaks läinud — teen varasemast kokkuvõtte...');
        } else if (message.type === 'system' && message.subtype === 'compact_boundary') {
          traceClaude('sdk', 'system:compact_boundary');
          this._emitProgress?.('compacted', 'Varasem vestlus on kokku võetud. Kui midagi olulist puudu, maini seda uuesti.');
        } else if (message.type === 'assistant') {
          traceClaude('sdk', 'assistant message', summarizeAssistantMessage(message));
          processAssistantMessage(
            message,
            this._turnFilesModified,
            this._emitProgress || (() => {}),
            message.parent_tool_use_id,
            this._planModeActive,
            this._planFirst
          );
          this._planModeActive = updatePlanModeState(message, this._planModeActive);
        } else if (message.type === 'tool_progress' || (message.type === 'system' && message.subtype === 'task_notification')) {
          traceClaude('sdk', 'tool/system progress', {
            type: message.type,
            subtype: message.subtype,
            toolName: message.tool_name ?? null,
            status: message.status ?? null,
          });
          processSystemMessage(message, this._emitProgress || (() => {}));
        } else if (message.type === 'result') {
          traceClaude('sdk', 'result', {
            subtype: message.subtype,
            durationMs: message.duration_ms ?? null,
            errors: message.errors ?? [],
          });
          // Only resolve if this result matches the current turn
          // (after interrupt + new turn, stale results are ignored)
          if (this._consumerTurnId === this._turnId) {
            const metrics: AgentMetrics = {
              durationMs: message.duration_ms || 0,
              costUsd: message.total_cost_usd ?? null,
              model: this._model,
              waitedMs: this._turnWaitedMs,
            };

            if (message.subtype === 'success') {
              // Sprint 103 R7: the headline number is agent working time —
              // waiting on the user (plan review, questions, approvals) is
              // reported separately via metrics.waitedMs.
              const activeMs = Math.max(0, metrics.durationMs - this._turnWaitedMs);
              const durationStr = (activeMs / 1000).toFixed(1);
              this._emitProgress?.('done', `Completed in ${durationStr}s`);
              this._forceResolveTurn(this._turnId, {
                text: message.result || '',
                filesModified: this._workspaceFilesModified(),
                metrics,
              });
            } else {
              const errors = message.errors || [];
              const errorStr = errors.join('; ') || 'Execution failed';
              const progressType = isContextOverflowError(errorStr) ? 'context_overflow' : 'error';
              this._emitProgress?.(progressType as AgentProgress['type'], errorStr);
              this._forceResolveTurn(this._turnId, {
                text: '',
                filesModified: [],
                metrics,
                error: errorStr,
              });
            }
          }
          // Stale result from an interrupted turn — already force-resolved, ignore
        }
      }
    } catch (error) {
      if (this._closed) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      traceClaude('sdk', 'consumeLoop error', { error: errorMessage });
      const progressType = isContextOverflowError(errorMessage) ? 'context_overflow' : 'error';
      // Process died — resolve any pending turn
      this._emitProgress?.(progressType as AgentProgress['type'], errorMessage);
      this._forceResolveTurn(this._turnId, {
        text: '',
        filesModified: [],
        metrics: { durationMs: 0, costUsd: null, model: this._model },
        error: errorMessage,
      });
    } finally {
      this._queryStream = null;
      if (this._turnTimeout) {
        clearTimeout(this._turnTimeout);
        this._turnTimeout = null;
      }
    }
  }

  private async _handleCanUseTool(
    toolName: string,
    input: Record<string, unknown>,
    options: { signal: AbortSignal; toolUseID: string }
  ): Promise<
    { behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: Array<Record<string, unknown>> }
    | { behavior: 'deny'; message: string; interrupt?: boolean }
  > {
    if (toolName === 'ExitPlanMode') {
      traceClaude('tool', 'ExitPlanMode requested', {
        toolUseId: options.toolUseID,
        input,
      });
      if (!this._emitPlanApproval) {
        return {
          behavior: 'deny',
          message: 'Plan approval UI is unavailable for this session.',
          interrupt: true,
        };
      }

      const waitStart = Date.now();
      try {
        const decision = await new Promise<{ approved: boolean; feedback?: string }>((resolve, reject) => {
          this._pendingPlanApprovals.set(options.toolUseID, { resolve, reject });

          this._emitPlanApproval?.({
            toolUseId: options.toolUseID,
            plan: typeof input.plan === 'string' ? input.plan : '',
          });
          traceClaude('tool', 'ExitPlanMode emitted approval request', {
            toolUseId: options.toolUseID,
            planLength: typeof input.plan === 'string' ? input.plan.length : 0,
          });

          options.signal.addEventListener('abort', () => {
            this._pendingPlanApprovals.delete(options.toolUseID);
            reject(new Error('Plan approval cancelled'));
          }, { once: true });
        });

        if (decision.approved) {
          // Sprint 103 R2: approving the plan clears plan-first and moves the
          // SESSION into the user's autonomy mode in the same response, so
          // execution continues immediately (verified by the Phase 0 spike).
          this._planModeActive = false;
          this._planFirst = false;
          const nextMode = this._sdkModeFor(false);
          this._activeSdkMode = nextMode;
          traceClaude('tool', 'ExitPlanMode approved', { toolUseId: options.toolUseID, nextMode });
          return {
            behavior: 'allow',
            updatedInput: input,
            updatedPermissions: [{ type: 'setMode', mode: nextMode, destination: 'session' }],
          };
        }

        // "Keep planning": the deny message carries the user's feedback and the
        // session stays in plan mode (R2).
        return {
          behavior: 'deny',
          message: decision.feedback?.trim() || 'Plan rejected by user.',
        };
      } catch (error) {
        traceClaude('tool', 'ExitPlanMode failed', {
          toolUseId: options.toolUseID,
          error: error instanceof Error ? error.message : 'Plan approval failed',
        });
        return {
          behavior: 'deny',
          message: error instanceof Error ? error.message : 'Plan approval failed',
          interrupt: true,
        };
      } finally {
        this._turnWaitedMs += Date.now() - waitStart;
      }
    }

    // Sprint 103 R2 defense-in-depth: during a plan phase (requested via the
    // Plan chip OR entered autonomously by the model) no mutating tool may run
    // before plan approval. The CLI already blocks these in native plan mode
    // (spike assert B); this keeps the guarantee even if routing changes.
    if ((this._planFirst || this._planModeActive) && MUTATING_TOOLS.has(toolName)) {
      traceClaude('tool', 'plan-phase mutating tool denied', { toolName, toolUseId: options.toolUseID });
      return {
        behavior: 'deny',
        message: 'Ritemark plan phase: file changes and commands wait for plan approval.',
      };
    }

    // Unified 'ask' approval: gate mutating tools before they run. Read/Glob/Grep
    // and everything else stay auto-allowed. 'auto' mode skips this gate.
    if (this._approvalMode === 'ask' && MUTATING_TOOLS.has(toolName)) {
      if (!this._emitToolApproval) {
        return { behavior: 'allow' }; // No approval UI wired — fail open, don't freeze the turn.
      }
      const kind: AgentToolApprovalRequest['kind'] = toolName === 'Bash' ? 'shell-command' : 'file-write';
      const approvalWaitStart = Date.now();
      const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;
      const command = typeof input.command === 'string' ? input.command : undefined;
      try {
        const approved = await new Promise<boolean>((resolve, reject) => {
          this._pendingToolApprovals.set(options.toolUseID, { resolve, reject });
          this._emitToolApproval?.({ toolUseId: options.toolUseID, kind, filePath, command });
          options.signal.addEventListener('abort', () => {
            this._pendingToolApprovals.delete(options.toolUseID);
            reject(new Error('Tool approval cancelled'));
          }, { once: true });
        });
        return approved
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: 'User rejected this action.' };
      } catch (error) {
        return {
          behavior: 'deny',
          message: error instanceof Error ? error.message : 'Tool approval failed',
        };
      } finally {
        this._turnWaitedMs += Date.now() - approvalWaitStart;
      }
    }

    if (toolName !== 'AskUserQuestion') {
      return { behavior: 'allow' };
    }

    const question = normalizeAgentQuestion(input, options.toolUseID);
    traceClaude('tool', 'AskUserQuestion requested', {
      toolUseId: options.toolUseID,
      questionCount: question?.questions.length ?? 0,
    });
    if (!question) {
      return {
        behavior: 'deny',
        message: 'AskUserQuestion payload was invalid.',
      };
    }

    if (!this._emitQuestion) {
      return {
        behavior: 'deny',
        message: 'Question UI is unavailable for this session.',
        interrupt: true,
      };
    }

    const questionWaitStart = Date.now();
    try {
      const answers = await new Promise<Record<string, string>>((resolve, reject) => {
        this._pendingQuestions.set(options.toolUseID, { resolve, reject });

        this._emitQuestion?.(question);
        traceClaude('tool', 'AskUserQuestion emitted question', {
          toolUseId: options.toolUseID,
          questionHeaders: question.questions.map((item) => item.header),
        });

        options.signal.addEventListener('abort', () => {
          this._pendingQuestions.delete(options.toolUseID);
          reject(new Error('AskUserQuestion cancelled'));
        }, { once: true });
      });

      return {
        behavior: 'allow',
        updatedInput: {
          ...input,
          answers,
        },
      };
    } catch (error) {
      traceClaude('tool', 'AskUserQuestion failed', {
        toolUseId: options.toolUseID,
        error: error instanceof Error ? error.message : 'AskUserQuestion failed',
      });
      return {
        behavior: 'deny',
        message: error instanceof Error ? error.message : 'AskUserQuestion failed',
        interrupt: true,
      };
    } finally {
      this._turnWaitedMs += Date.now() - questionWaitStart;
    }
  }

  /**
   * Sprint 103 R7 (audit F11): "Modified N files" counts only workspace files.
   * Runtime-internal writes (e.g. `~/.claude/plans/*`) are real Write tool
   * calls but not part of the user's document set.
   *
   * Both the raw and the realpath-resolved workspace roots are accepted:
   * on macOS `/tmp` (and some user dirs) are symlinks, and the model may
   * report either form.
   */
  private _workspaceFilesModified(): string[] {
    const roots = new Set<string>([this._workspacePath]);
    try {
      roots.add(require('fs').realpathSync(this._workspacePath));
    } catch { /* workspace gone — keep the raw root */ }
    const prefixes = Array.from(roots).map((r) => (r.endsWith(path.sep) ? r : r + path.sep));
    return Array.from(new Set(this._turnFilesModified))
      .filter((f) => prefixes.some((p) => f.startsWith(p)));
  }

  private _clearPendingQuestion(message = 'Question cancelled') {
    const pending = Array.from(this._pendingQuestions.values());
    this._pendingQuestions.clear();
    for (const { reject } of pending) {
      reject(new Error(message));
    }
  }

  private _clearPendingPlanApproval(message = 'Plan approval cancelled') {
    const pending = Array.from(this._pendingPlanApprovals.values());
    this._pendingPlanApprovals.clear();
    for (const { reject } of pending) {
      reject(new Error(message));
    }
  }

  private _clearPendingToolApproval(message = 'Tool approval cancelled') {
    const pending = Array.from(this._pendingToolApprovals.values());
    this._pendingToolApprovals.clear();
    for (const { reject } of pending) {
      reject(new Error(message));
    }
  }
}

// ── Shared helpers ──────────────────────────────────────────────────

/**
 * Extended progress callback that can include subagent info
 */
type ExtendedProgressEmitter = (
  type: AgentProgress['type'],
  message: string,
  tool?: string,
  file?: string,
  subagentInfo?: { subagentId?: string; subagentTask?: string; parentToolUseId?: string }
) => void;

/**
 * Parse assistant message content blocks for tool usage and thinking
 */
function processAssistantMessage(
  message: SDKMessage,
  filesModified: string[],
  emitProgress: ExtendedProgressEmitter,
  parentToolUseId?: string | null,
  planModeActive = false,
  planFirstRequested = false
) {
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      if (planModeActive && !parentToolUseId) {
        emitProgress('plan_text', block.text);
      } else {
        const snippet = block.text.substring(0, 150);
        emitProgress('thinking', snippet.length < block.text.length ? snippet + '...' : snippet);
      }
    } else if (block.type === 'tool_use') {
      const input = block.input as {
        file_path?: string;
        command?: string;
        pattern?: string;
        description?: string;
        prompt?: string;
        subagent_type?: string;
      } | undefined;
      let toolMessage = `Using ${block.name}`;

      if (block.name === 'ExitPlanMode') {
        emitProgress('plan_ready', 'Plan ready for review');
        continue;
      } else if (block.name === 'EnterPlanMode') {
        // Sprint 103 R4: a model-initiated plan phase is surfaced as a
        // first-class labeled event, never a silent ticker line (audit F4/F5).
        if (planFirstRequested) {
          emitProgress('tool_use', 'Entering plan mode');
        } else {
          emitProgress('plan_autonomous', 'Claude chose to plan first');
        }
        continue;
      } else if (block.name === 'Agent' || block.name === 'Task') {
        // Subagent spawned! Emit special event
        const taskDesc = input?.description || input?.prompt?.substring(0, 100) || 'Running subagent';
        const agentType = input?.subagent_type || 'subagent';
        emitProgress(
          'subagent_start',
          taskDesc,
          block.name,
          undefined,
          {
            subagentId: block.id,
            subagentTask: taskDesc,
            parentToolUseId: block.id,
          }
        );
        continue;
      } else if (block.name === 'Write' && input?.file_path) {
        toolMessage = `Writing: ${input.file_path.split('/').pop()}`;
        filesModified.push(input.file_path);
      } else if (block.name === 'Edit' && input?.file_path) {
        toolMessage = `Editing: ${input.file_path.split('/').pop()}`;
        filesModified.push(input.file_path);
      } else if (block.name === 'Read' && input?.file_path) {
        toolMessage = `Reading: ${input.file_path.split('/').pop()}`;
      } else if (block.name === 'Bash' && input?.command) {
        const cmd = input.command.substring(0, 50);
        toolMessage = `Running: ${cmd}${input.command.length > 50 ? '...' : ''}`;
      } else if (block.name === 'Glob' && input?.pattern) {
        toolMessage = `Searching: ${input.pattern}`;
      } else if (block.name === 'Grep' && input?.pattern) {
        toolMessage = `Searching for: ${input.pattern}`;
      }

      // If this is a subagent activity (has parent_tool_use_id), tag it
      if (parentToolUseId) {
        emitProgress('subagent_progress', toolMessage, block.name, input?.file_path, {
          parentToolUseId,
        });
      } else {
        emitProgress('tool_use', toolMessage, block.name, input?.file_path);
      }
    }
  }
}

function summarizeAssistantMessage(message: SDKMessage): { blocks: Array<Record<string, unknown>> } {
  const content = Array.isArray(message.message?.content) ? message.message?.content : [];
  return {
    blocks: content.map((block) => ({
      type: block.type,
      name: block.name,
      id: block.id,
      textPreview: typeof block.text === 'string' ? block.text.slice(0, 120) : undefined,
    })),
  };
}

function updatePlanModeState(message: SDKMessage, currentState: boolean): boolean {
  const content = message.message?.content;
  if (!Array.isArray(content)) {
    return currentState;
  }

  let nextState = currentState;
  for (const block of content) {
    if (block.type !== 'tool_use') {
      continue;
    }

    if (block.name === 'EnterPlanMode') {
      nextState = true;
    }
  }

  return nextState;
}

/**
 * Process SDK messages that are not assistant messages but provide progress info.
 * This includes tool_progress and task_notification messages for subagent tracking.
 */
function processSystemMessage(
  message: SDKMessage,
  emitProgress: ExtendedProgressEmitter
) {
  // Handle tool_progress messages (elapsed time for long-running tools)
  if (message.type === 'tool_progress') {
    const toolName = message.tool_name || 'Tool';
    const elapsed = message.elapsed_time_seconds || 0;
    const parentId = message.parent_tool_use_id;

    if (parentId) {
      // This is subagent activity
      emitProgress('subagent_progress', `${toolName} running (${elapsed}s)`, toolName, undefined, {
        parentToolUseId: parentId,
      });
    }
  }

  // Handle task_notification messages (subagent completion)
  if (message.type === 'system' && message.subtype === 'task_notification') {
    const taskId = message.task_id || '';
    const status = message.status || 'completed';
    const summary = message.summary || 'Task completed';

    emitProgress('subagent_done', summary, 'Task', undefined, {
      subagentId: taskId,
    });
  }
}
