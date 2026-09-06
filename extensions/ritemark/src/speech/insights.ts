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
import type { InsightsLanguageMetadata } from './insightsLanguage';

export * from './insightsParsing';

export interface GenerateInsightsOptions {
  session: TranscriptSession;
  workspacePath: string;
  language: InsightsLanguageMetadata;
  /**
   * BYOK key for users authenticated by API key rather than a Claude.ai login.
   * The AI sidebar threads this through too; without it those users get a
   * runtime that reports itself unavailable while Settings says it is ready.
   */
  anthropicApiKey?: string;
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
    ...(options.anthropicApiKey ? { anthropicApiKey: options.anthropicApiKey } : {}),
    // NO TOOLS. A transcript is untrusted text — it can contain anything a
    // person said, or anything a meeting participant read aloud from a screen.
    // With the runtime's default tool set plus 'auto', a transcript that looks
    // like an instruction could get Bash/Write/Edit executed without an
    // approval ever being shown. This task needs no tools at all: the
    // transcript is in the prompt and the answer is text.
    availableTools: [],
    allowedTools: [],
    // This prompt is self-contained. Loading CLAUDE.md, plugins, project
    // agents, and personal coding-agent effort defaults only adds unrelated
    // context and made a real 48-minute transcript run consume ~82k input
    // context tokens before producing its memo.
    settingSources: [],
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
      prompt: buildInsightsPrompt(options.session, options.language.resolved),
      timeoutMinutes: 5,
      // This is deterministic extraction, not an open-ended coding task. With
      // provider-controlled Auto a 48-minute transcript spent 15k+ output
      // tokens (mostly reasoning) before returning a ~3k-character memo.
      thinkingEffort: 'low',
    });

    const text = await finished;
    return {
      ...parseInsightsResponse(text, options.session.segments, model, new Date().toISOString()),
      language: options.language,
    };
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
