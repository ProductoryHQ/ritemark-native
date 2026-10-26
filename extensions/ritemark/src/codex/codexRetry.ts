/**
 * Sprint 143 (#544, R3, R3a): Codex waiting to try again, made visible.
 *
 * When ChatGPT answers a request with 429 (too many requests), Codex waits as
 * long as ChatGPT says (minutes, seen up to 9) and tries again. It tells its
 * client before each wait with an `error` notification (`willRetry: true`),
 * but that notification doesn't say how long the wait is. Codex writes the
 * wait to its own log ("retrying sampling request (1/5 in 418.99s)"), so
 * Ritemark's own app-server process is started with a log filter that lets
 * that one line through on stderr, and the two are paired.
 *
 * Nothing here touches the person's Codex configuration, MCP servers or
 * `~/.codex`; a `RUST_LOG` the person set is left as it is. Pure.
 */

/** Codex's default stderr level, plus the one line that names the wait. */
export const CODEX_RETRY_LOG_FILTER = 'error,codex_core::responses_retry=warn';

/** The environment for Ritemark's own app-server process: the log filter, unless the person set one. */
export function codexAppServerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (typeof env.RUST_LOG === 'string' && env.RUST_LOG.trim()) return env;
  return { ...env, RUST_LOG: CODEX_RETRY_LOG_FILTER };
}

export interface CodexRetryWait {
  attempt: number;
  of: number;
  delayMs: number;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const RETRY_LINE = /retrying sampling request \((\d+)\/(\d+) in ([\d.]+)s\)/;

/** Codex's log line for a wait before trying again, or null. ANSI colours are ignored. */
export function parseCodexRetryLine(line: string): CodexRetryWait | null {
  const match = RETRY_LINE.exec(line.replace(ANSI, ''));
  if (!match) return null;
  const seconds = Number(match[3]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return { attempt: Number(match[1]), of: Number(match[2]), delayMs: Math.round(seconds * 1000) };
}

export interface CodexRetryNotice {
  threadId?: string;
  turnId?: string;
  attempt?: number;
  of?: number;
  httpStatus?: number;
  /** ChatGPT turned the request away: a 429, or Codex's `rateLimitExceeded`. */
  busy: boolean;
}

/**
 * The app-server's `error` notification when Codex will try again
 * (`willRetry: true`), or null for anything else. `willRetry: false` is the
 * turn's own failure, which `turn/completed` carries.
 */
export function parseCodexRetryNotice(params: unknown): CodexRetryNotice | null {
  if (!params || typeof params !== 'object') return null;
  const input = params as Record<string, unknown>;
  if (input.willRetry !== true) return null;
  const error = (input.error && typeof input.error === 'object' ? input.error : {}) as Record<string, unknown>;
  const message = typeof error.message === 'string' ? error.message : '';
  const count = /(\d+)\s*\/\s*(\d+)/.exec(message);
  const info = error.codexErrorInfo;
  let variant: string | undefined;
  let httpStatus: number | undefined;
  if (typeof info === 'string') {
    variant = info;
  } else if (info && typeof info === 'object') {
    const [key, value] = Object.entries(info as Record<string, unknown>)[0] ?? [];
    variant = key;
    const status = value && typeof value === 'object' ? (value as Record<string, unknown>).httpStatusCode : undefined;
    if (typeof status === 'number') httpStatus = status;
  }
  return {
    ...(typeof input.threadId === 'string' ? { threadId: input.threadId } : {}),
    ...(typeof input.turnId === 'string' ? { turnId: input.turnId } : {}),
    ...(count ? { attempt: Number(count[1]), of: Number(count[2]) } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    busy: httpStatus === 429 || variant === 'rateLimitExceeded',
  };
}

/** How long a log line stays the wait of the notification that follows it. */
export const RETRY_LINE_PAIRING_MS = 5_000;
