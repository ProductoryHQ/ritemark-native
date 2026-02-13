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
const DEFAULT_TIMEOUT_MINUTES = 5;

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

  const emitProgress = (
    type: AgentProgress['type'],
    message: string,
    tool?: string,
    file?: string
  ) => {
    onProgress?.({ type, message, tool, file, timestamp: Date.now() });
  };

  if (!prompt || prompt.trim() === '') {
    throw new Error('Agent prompt is empty');
  }

  const safetyPrefix = buildSafetyPrefix(workspacePath, excludedFolders);
  const fullPrompt = safetyPrefix + prompt;

  const abortController = new AbortController();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
        return { text: '', filesModified: [], metrics, error: 'Execution cancelled' };
      }

      if (message.type === 'system' && message.subtype === 'init') {
        metrics.model = message.model || null;
        emitProgress('init', `Starting Claude Code (${message.model || 'claude'})`);
      } else if (message.type === 'assistant') {
        processAssistantMessage(message, filesModified, emitProgress);
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
          clearTimeout(timeoutId);
          return { text: '', filesModified: [], metrics, error: errorStr };
        }
      }
    }

    clearTimeout(timeoutId);
    return {
      text: resultText,
      filesModified: [...new Set(filesModified)],
      metrics,
    };
  } catch (error) {
    clearTimeout(timeoutId);
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
  private _emitProgress: ((type: AgentProgress['type'], msg: string, tool?: string, file?: string) => void) | null = null;
  private _turnTimeout: ReturnType<typeof setTimeout> | null = null;

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

    // Build prompt with active file context
    let fullPrompt = prompt;
    if (activeFile) {
      let fileContext = `[Currently editing: ${activeFile.path}]`;
      if (activeFile.selection) {
        const selSnippet = activeFile.selection.length > 500
          ? activeFile.selection.substring(0, 500) + '...'
          : activeFile.selection;
        fileContext += `\n[Selected text: ${selSnippet}]`;
      }
      fullPrompt = fileContext + '\n\n' + prompt;
    }

    const userMsg = buildUserMessage(fullPrompt, attachments);
    const turnId = ++this._turnId;

    // Set per-turn state BEFORE starting/enqueueing
    this._turnFilesModified = [];
    this._emitProgress = (type, message, tool?, file?) => {
      onProgress?.({ type, message, tool, file, timestamp: Date.now() });
    };

    const resultPromise = new Promise<AgentResult>((resolve) => {
      this._turnResolve = resolve;
    });

    // Per-turn timeout
    if (timeoutMinutes > 0) {
      this._turnTimeout = setTimeout(() => {
        this._emitProgress?.('error', 'Turn timed out');
        this._forceResolveTurn(turnId, {
          text: '',
          filesModified: [],
          metrics: { durationMs: 0, costUsd: null, model: this._model },
          error: 'Turn timed out',
        });
        this._queryStream?.interrupt().catch(() => {});
      }, timeoutMinutes * 60 * 1000);
    }

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

        if (message.type === 'system' && message.subtype === 'init') {
          this._model = message.model || null;
          this._emitProgress?.('init', `Starting Claude Code (${message.model || 'claude'})`);
        } else if (message.type === 'assistant') {
          processAssistantMessage(
            message,
            this._turnFilesModified,
            this._emitProgress || (() => {})
          );
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
                filesModified: [...new Set(this._turnFilesModified)],
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
 * Parse assistant message content blocks for tool usage and thinking
 */
function processAssistantMessage(
  message: SDKMessage,
  filesModified: string[],
  emitProgress: (type: AgentProgress['type'], message: string, tool?: string, file?: string) => void
) {
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const snippet = block.text.substring(0, 150);
      emitProgress('thinking', snippet.length < block.text.length ? snippet + '...' : snippet);
    } else if (block.type === 'tool_use') {
      const input = block.input as { file_path?: string; command?: string; pattern?: string } | undefined;
      let toolMessage = `Using ${block.name}`;

      if (block.name === 'ExitPlanMode') {
        emitProgress('plan_ready', 'Plan ready for review');
        continue;
      } else if (block.name === 'EnterPlanMode') {
        emitProgress('tool_use', 'Entering plan mode');
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

      emitProgress('tool_use', toolMessage, block.name, input?.file_path);
    }
  }
}
