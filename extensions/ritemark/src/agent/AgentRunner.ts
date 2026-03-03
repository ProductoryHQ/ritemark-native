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
  AgentSessionConfig,
  AgentTurnOptions,
  AgentProgress,
  AgentResult,
  AgentMetrics,
  FileAttachment,
  QueryHandle,
  SDKMessage,
  SubagentProgress,
} from './types';

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

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
const DEFAULT_TIMEOUT_MINUTES = 15;

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

// ── One-shot execution (for Flows) ──────────────────────────────────

/**
 * Execute an agent task as a one-shot operation.
 * For multi-turn conversations, use AgentSession instead.
 */
export async function runAgent(options: AgentExecutionOptions): Promise<AgentResult> {
  const {
    prompt,
    workspacePath,
    attachments,
    allowedTools = DEFAULT_TOOLS,
    excludedFolders = DEFAULT_EXCLUDED_FOLDERS,
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
    abortSignal,
    onProgress,
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

  const safetyPrefix = buildSafetyPrefix(workspacePath, excludedFolders);
  const fullPrompt = safetyPrefix + prompt;

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
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools,
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
        emitProgress('init', `Starting Claude Code (${message.model || 'claude'})`);
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
          emitProgress('error', errorStr);
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

    emitProgress('error', errorMessage);
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
  private _turnTimeout: ReturnType<typeof setTimeout> | null = null;
  private _turnTimeoutMs = 0;  // Stored so we can reset on activity

  // Config
  private readonly _workspacePath: string;
  private readonly _excludedFolders: string[];
  private readonly _allowedTools: string[];
  private readonly _modelId: string | undefined;
  private readonly _anthropicApiKey: string | undefined;

  constructor(config: AgentSessionConfig) {
    this._workspacePath = config.workspacePath;
    this._excludedFolders = config.excludedFolders || DEFAULT_EXCLUDED_FOLDERS;
    this._allowedTools = config.allowedTools || DEFAULT_TOOLS;
    this._modelId = config.model;
    this._anthropicApiKey = config.anthropicApiKey;
  }

  get isActive(): boolean {
    return this._queryStream !== null && !this._closed;
  }

  /**
   * Send a message to the agent. First call starts the session,
   * subsequent calls feed into the existing warm process (~2-3s).
   */
  async sendMessage(options: AgentTurnOptions): Promise<AgentResult> {
    const { prompt, attachments, activeFile, timeoutMinutes = DEFAULT_TIMEOUT_MINUTES, onProgress } = options;

    if (!prompt || prompt.trim() === '') {
      throw new Error('Agent prompt is empty');
    }

    // Build prompt with active file context (skip if already referenced in path chips)
    let fullPrompt = prompt;
    if (activeFile) {
      const alreadyReferenced = prompt.includes(`[File: ${activeFile.path}]`) ||
        prompt.match(new RegExp(`\\[File:.*/${activeFile.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`));
      if (!alreadyReferenced) {
        let fileContext = `[Currently editing: ${activeFile.path}]`;
        if (activeFile.selection) {
          const selSnippet = activeFile.selection.length > 500
            ? activeFile.selection.substring(0, 500) + '...'
            : activeFile.selection;
          fileContext += `\n[Selected text: ${selSnippet}]`;
        }
        fullPrompt = fileContext + '\n\n' + prompt;
      } else if (activeFile.selection) {
        // File already referenced but selection still useful
        const selSnippet = activeFile.selection.length > 500
          ? activeFile.selection.substring(0, 500) + '...'
          : activeFile.selection;
        fullPrompt = `[Selected text: ${selSnippet}]\n\n` + prompt;
      }
    }

    const userMsg = buildUserMessage(fullPrompt, attachments);
    const turnId = ++this._turnId;

    // Set per-turn state BEFORE starting/enqueueing
    this._turnFilesModified = [];
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

    const resultPromise = new Promise<AgentResult>((resolve) => {
      this._turnResolve = resolve;
    });

    // Per-turn inactivity timeout — resets on each agent activity
    this._turnTimeoutMs = timeoutMinutes * 60 * 1000;
    this._resetTurnTimeout();

    if (!this._queryStream) {
      // First turn — start session with warm process
      await this._startSession(userMsg);
    } else {
      // Follow-up turn — feed into existing warm process
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
    this._queryStream?.interrupt().catch(() => {});
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
    this._closed = true;
    try { this._queryStream?.close(); } catch {}
    this._queryStream = null;
    this._model = null;
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
      this._turnFilesModified = [];
      if (this._turnTimeout) {
        clearTimeout(this._turnTimeout);
        this._turnTimeout = null;
      }
      resolve(result);
    }
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

  private async _startSession(firstMsg: Record<string, unknown>) {
    const query = await getQuery();
    const safetyAppend = buildSafetyPrefix(this._workspacePath, this._excludedFolders);

    const queryOptions: Record<string, unknown> = {
      cwd: this._workspacePath,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: safetyAppend,
      },
      settingSources: ['project'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: this._allowedTools,
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

        // Reset inactivity timeout on any activity from the agent
        if (message.type !== 'result') {
          this._resetTurnTimeout();
        }

        if (message.type === 'system' && message.subtype === 'init') {
          this._model = message.model || null;
          this._emitProgress?.('init', `Starting Claude Code (${message.model || 'claude'})`);
        } else if (message.type === 'system' && message.subtype === 'status' && (message as any).status === 'compacting') {
          this._emitProgress?.('compacting', 'Vestlus on pikaks läinud — teen varasemast kokkuvõtte...');
        } else if (message.type === 'system' && message.subtype === 'compact_boundary') {
          this._emitProgress?.('compacted', 'Varasem vestlus on kokku võetud. Kui midagi olulist puudu, maini seda uuesti.');
        } else if (message.type === 'assistant') {
          processAssistantMessage(
            message,
            this._turnFilesModified,
            this._emitProgress || (() => {}),
            message.parent_tool_use_id
          );
        } else if (message.type === 'tool_progress' || (message.type === 'system' && message.subtype === 'task_notification')) {
          processSystemMessage(message, this._emitProgress || (() => {}));
        } else if (message.type === 'result') {
          // Only resolve if this result matches the current turn
          // (after interrupt + new turn, stale results are ignored)
          if (this._consumerTurnId === this._turnId) {
            const metrics: AgentMetrics = {
              durationMs: message.duration_ms || 0,
              costUsd: message.total_cost_usd ?? null,
              model: this._model,
            };

            if (message.subtype === 'success') {
              const durationStr = (metrics.durationMs / 1000).toFixed(1);
              this._emitProgress?.('done', `Completed in ${durationStr}s`);
              this._forceResolveTurn(this._turnId, {
                text: message.result || '',
                filesModified: Array.from(new Set(this._turnFilesModified)),
                metrics,
              });
            } else {
              const errors = message.errors || [];
              const errorStr = errors.join('; ') || 'Execution failed';
              this._emitProgress?.('error', errorStr);
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
      // Process died — resolve any pending turn
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
  parentToolUseId?: string | null
) {
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const snippet = block.text.substring(0, 150);
      emitProgress('thinking', snippet.length < block.text.length ? snippet + '...' : snippet);
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
        emitProgress('tool_use', 'Entering plan mode');
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
