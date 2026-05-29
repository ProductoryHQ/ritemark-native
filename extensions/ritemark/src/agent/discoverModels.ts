/**
 * Standalone Claude model discovery via the bundled SDK's `supportedModels()`
 * control API. Opens a short-lived `query()` stream with no user prompt,
 * asks the SDK what models it knows about, then closes.
 *
 * Lets the AI sidebar render real model display names (e.g. "Claude Sonnet 4.5")
 * at sidebar open, before the user sends any message — without hardcoding the
 * list in the extension.
 */

import { traceClaude } from './agentTrace';
import type { ModelOption } from './types';

const DISCOVERY_TIMEOUT_MS = 10_000;

interface DiscoverOptions {
  workspacePath: string;
  pathToClaudeCodeExecutable?: string;
  anthropicApiKey?: string;
}

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

/**
 * Yields nothing — blocks forever. We only need the stream alive long enough
 * for `supportedModels()` to round-trip; after that we close it.
 */
async function* blockingPromptStream(): AsyncGenerator<Record<string, unknown>> {
  await new Promise(() => {});
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Query the bundled SDK for the canonical model list. Returns null on any
 * failure so callers can fall back to a hardcoded list without crashing.
 */
export async function discoverClaudeModels(options: DiscoverOptions): Promise<ModelOption[] | null> {
  const query = await getQuery().catch(() => null);
  if (!query) {
    return null;
  }

  const queryOptions: Record<string, unknown> = {
    cwd: options.workspacePath,
    ...(options.pathToClaudeCodeExecutable
      ? { pathToClaudeCodeExecutable: options.pathToClaudeCodeExecutable }
      : {}),
    settingSources: [],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  };

  if (options.anthropicApiKey) {
    queryOptions.env = { ...process.env, ANTHROPIC_API_KEY: options.anthropicApiKey };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stream: any = null;
  try {
    stream = query({
      prompt: blockingPromptStream(),
      options: queryOptions,
    });

    if (!stream || typeof stream.supportedModels !== 'function') {
      traceClaude('sdk', 'discoverClaudeModels: supportedModels() unavailable on bundled SDK');
      return null;
    }

    const models: Array<{ value: string; displayName: string; description: string }> =
      await withTimeout(stream.supportedModels(), DISCOVERY_TIMEOUT_MS, 'supportedModels');

    if (!Array.isArray(models) || models.length === 0) {
      return null;
    }

    traceClaude('sdk', 'discoverClaudeModels: success', {
      count: models.length,
      sample: models.slice(0, 3).map((m) => ({ value: m.value, displayName: m.displayName })),
    });

    return models.map((m) => ({
      id: m.value,
      label: m.displayName,
      description: m.description,
    }));
  } catch (err) {
    traceClaude('sdk', 'discoverClaudeModels: failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    try {
      stream?.close?.();
    } catch {
      // ignore — discovery is best-effort
    }
  }
}
