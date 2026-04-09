/**
 * Codex Node Executor
 *
 * Executes autonomous coding tasks using OpenAI Codex CLI.
 * Communicates via JSON-RPC with the `codex app-server` process.
 */

import type { FlowNode, ExecutionContext, ProgressCallback } from '../types';
import { CodexAppServer } from '../../codex';
import { isEnabled } from '../../features/featureGate';
import { interpolateVariables } from './interpolate';

/**
 * Codex Node configuration
 */
export interface CodexNodeData {
  label: string;
  prompt: string;
  model: string;
  timeout: number; // in minutes (1-60)
}

/**
 * Codex execution result — same shape as ClaudeCodeResult
 */
export interface CodexResult {
  text: string;
  files: string[];
  error?: string;
}

/**
 * Execute Codex node using Codex CLI app-server
 */
export async function executeCodexNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal,
  onProgress?: ProgressCallback
): Promise<CodexResult> {
  console.log('[Codex] Starting execution for node:', node.id);

  // Check feature flag
  if (!isEnabled('codex-integration')) {
    throw new Error(
      'Codex integration is disabled. Enable it in Settings > Features > Codex Integration.'
    );
  }

  const data = node.data as unknown as CodexNodeData;

  // Validate configuration
  if (!data.prompt || data.prompt.trim() === '') {
    console.error('[Codex] Missing prompt');
    throw new Error('Codex node missing prompt');
  }

  // Interpolate variables in prompt
  const interpolatedPrompt = interpolateVariables(data.prompt, context);
  console.log('[Codex] Interpolated prompt:', interpolatedPrompt.substring(0, 100) + '...');

  // Create a dedicated app-server instance for flow execution
  const appServer = new CodexAppServer();

  try {
    // Initialize app-server (starts binary + handshake)
    onProgress?.({ type: 'init', message: 'Starting Codex...' });
    await appServer.ensureInitialized();

    // Check authentication
    const accountResponse = await appServer.getAccount();
    if (!accountResponse || !accountResponse.account) {
      throw new Error(
        'Codex is not authenticated. Open the AI sidebar and log in with your ChatGPT account.'
      );
    }

    // Start a thread
    const threadResult = await appServer.threadStart({
      cwd: context.workspacePath,
    });
    const threadId = threadResult.thread.id;

    // Start a turn with the prompt
    onProgress?.({ type: 'thinking', message: 'Codex is working...' });
    const turnResult = await appServer.turnStart(
      threadId,
      interpolatedPrompt,
      data.model || undefined
    );
    const turnId = turnResult.turn.id;

    // Collect results
    const textChunks: string[] = [];
    const files: string[] = [];

    return await new Promise<CodexResult>((resolve, reject) => {
      const timeoutMs = (data.timeout || 5) * 60 * 1000;
      const timer = setTimeout(() => {
        appServer.turnInterrupt(threadId, turnId).catch(() => {});
        cleanup();
        resolve({
          text: textChunks.join(''),
          files,
          error: `Codex timed out after ${data.timeout || 5} minutes`,
        });
      }, timeoutMs);

      // Handle abort
      const onAbort = () => {
        appServer.turnInterrupt(threadId, turnId).catch(() => {});
        cleanup();
        resolve({
          text: textChunks.join(''),
          files,
          error: 'Execution cancelled',
        });
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      // Listen for streaming text
      const onDelta = (params: { delta: string }) => {
        textChunks.push(params.delta);
        onProgress?.({ type: 'text', message: params.delta });
      };

      // Listen for tool use (items)
      const onItemStarted = (params: { item: { type: string; id: string; text?: string } }) => {
        const item = params.item;
        if (item.type === 'tool_call' || item.type === 'function_call') {
          onProgress?.({ type: 'tool_use', message: `Using tool: ${item.id}` });
        }
      };

      // Listen for completed items to track modified files
      const onItemCompleted = (params: { item: { type: string; id: string; text?: string } }) => {
        const item = params.item;
        if (item.type === 'file_change' && item.text) {
          files.push(item.text);
        }
      };

      // Auto-approve all requests in flow context
      const onServerRequest = (request: { id: string | number; method: string; params: unknown }) => {
        appServer.sendApprovalResponse(request.id, 'accept');
        onProgress?.({ type: 'tool_use', message: 'Auto-approved action' });
      };

      // Turn completed
      const onTurnCompleted = (params: { turn: { id: string; status: string; error: unknown } }) => {
        cleanup();
        const text = textChunks.join('');
        const turnError = params.turn.error
          ? String((params.turn.error as Record<string, unknown>).message || params.turn.error)
          : undefined;

        onProgress?.({ type: 'done', message: 'Codex completed' });
        resolve({
          text: text || 'Codex completed the task.',
          files,
          error: turnError,
        });
      };

      const onExit = (code: number | null) => {
        cleanup();
        resolve({
          text: textChunks.join(''),
          files,
          error: `Codex app-server exited unexpectedly (code: ${code})`,
        });
      };

      function cleanup() {
        clearTimeout(timer);
        abortSignal?.removeEventListener('abort', onAbort);
        appServer.removeListener('item/agentMessage/delta', onDelta);
        appServer.removeListener('item/started', onItemStarted);
        appServer.removeListener('item/completed', onItemCompleted);
        appServer.removeListener('server-request', onServerRequest);
        appServer.removeListener('turn/completed', onTurnCompleted);
        appServer.removeListener('exit', onExit);
      }

      appServer.on('item/agentMessage/delta', onDelta);
      appServer.on('item/started', onItemStarted);
      appServer.on('item/completed', onItemCompleted);
      appServer.on('server-request', onServerRequest);
      appServer.on('turn/completed', onTurnCompleted);
      appServer.on('exit', onExit);
    });
  } finally {
    // Always dispose the app-server instance
    appServer.dispose();
  }
}
