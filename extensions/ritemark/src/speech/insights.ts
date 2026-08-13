/**
 * Sprint 108 R10 — running the insight extraction.
 *
 * A one-shot prompt on the agent runtime the user already has authenticated —
 * no second AI stack with its own key and its own failure modes — with the
 * model id resolved from the catalog rather than written here.
 *
 * The parsing and citation rules live in `insightsParsing.ts`, which imports no
 * `vscode` and is unit tested.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { createRuntime } from '../runtime';
import * as modelCatalog from '../ai/modelCatalog';
import { buildInsightsPrompt, parseInsightsResponse } from './insightsParsing';
import type { TranscriptInsights, TranscriptSession } from './types';

export * from './insightsParsing';

export interface GenerateInsightsOptions {
  session: TranscriptSession;
  workspacePath: string;
  signal?: AbortSignal;
}

/**
 * Run the extraction on the existing Claude Code runtime.
 *
 * A one-shot prompt on the runtime the user already has authenticated, rather
 * than a second AI stack with its own key and its own failure modes.
 */
export async function generateInsights(options: GenerateInsightsOptions): Promise<TranscriptInsights> {
  const model = modelCatalog.getDefault('anthropic', 'claude-code');
  const runtime = createRuntime('claude-code');

  let settle: ((text: string) => void) | null = null;
  let fail: ((error: Error) => void) | null = null;
  const finished = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const session = await runtime.createSession(`transcribe-insights-${options.session.id}`, {
    workspacePath: options.workspacePath,
    model,
    // Read-only work over text we already hold: nothing to approve.
    approvalMode: 'auto',
    onProgress: () => undefined,
    onApprovalRequest: () => undefined,
    // The runtime reports the finished turn here; the promise above is what
    // `generateInsights` actually awaits.
    onComplete: (result) => {
      if (result.error) fail?.(new Error(result.error));
      else settle?.(result.text ?? '');
    },
  });

  const onAbort = (): void => {
    void session.cancel();
    fail?.(new Error('Insights generation cancelled.'));
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    await session.prompt({
      prompt: buildInsightsPrompt(options.session),
      timeoutMinutes: 5,
    });

    const text = await finished;
    return parseInsightsResponse(text, options.session.segments, model, new Date().toISOString());
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    session.dispose();
    runtime.dispose();
  }
}

/** Workspace root for the runtime session, or the recording's folder. */
export function insightsWorkspacePath(session: TranscriptSession): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(session.audioPath);
}
