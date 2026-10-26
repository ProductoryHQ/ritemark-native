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
  /** The turn the wait belongs to: the line's `turn_id=`, the same id as the notification's `turnId`. */
  turnId?: string;
}

/** How long a log line and a notification a moment apart still belong together. */
export const RETRY_LINE_PAIRING_MS = 5_000;

/** A wait as the app-server heard it: the line, and when it came. */
export interface CodexRetryWaitHeard extends CodexRetryWait {
  at: number;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const RETRY_LINE = /retrying sampling request \((\d+)\/(\d+) in ([\d.]+)s\)/;
const TURN_ID = /\bturn_id=([0-9A-Za-z-]+)/;

/** Codex's log line for a wait before trying again, or null. ANSI colours are ignored. */
export function parseCodexRetryLine(line: string): CodexRetryWait | null {
  const clean = line.replace(ANSI, '');
  const match = RETRY_LINE.exec(clean);
  if (!match) return null;
  const seconds = Number(match[3]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const turn = TURN_ID.exec(clean);
  return {
    attempt: Number(match[1]),
    of: Number(match[2]),
    delayMs: Math.round(seconds * 1000),
    ...(turn ? { turnId: turn[1] } : {}),
  };
}

/**
 * Whole lines from a stream that arrives in chunks. A chunk need not end at a line's end, so a line split
 * across two chunks is given once, whole, when its end arrives; `flush` gives what is left at the end.
 */
export class LineBuffer {
  private rest = '';

  push(chunk: string): string[] {
    const parts = (this.rest + chunk).split('\n');
    this.rest = parts.pop() ?? '';
    return parts.map((line) => line.replace(/\r$/, ''));
  }

  flush(): string[] {
    const rest = this.rest.replace(/\r$/, '');
    this.rest = '';
    return rest ? [rest] : [];
  }
}

/**
 * Pairs Codex's `error` notification (`willRetry: true`) with the log line that names its wait, turn by turn.
 * The two come on different pipes, in either order, a moment apart; two chats can be waiting at once on the
 * one app-server, so each side is kept by its turn id. When either side has no turn id (an older Codex), it
 * pairs only with the one entry waiting on the other side.
 */
export class CodexRetryPairing<T> {
  private readonly notices = new Map<string, { item: T; at: number }>();
  private readonly waits = new Map<string, CodexRetryWaitHeard>();

  constructor(private readonly windowMs = RETRY_LINE_PAIRING_MS) {}

  /** A notification: the wait already logged for its turn, or null, and then it waits for the line. */
  notice(turnId: string | undefined, item: T, now = Date.now()): CodexRetryWaitHeard | null {
    const wait = this.take(this.waits, turnId ?? '', now);
    if (wait) return wait;
    this.notices.set(turnId ?? '', { item, at: now });
    return null;
  }

  /** A log line: the notification it completes, or null, and then it waits for the notification. */
  wait(wait: CodexRetryWaitHeard, now = Date.now()): T | null {
    const notice = this.take(this.notices, wait.turnId ?? '', now);
    if (notice) return notice.item;
    this.waits.set(wait.turnId ?? '', wait);
    return null;
  }

  private take<V extends { at: number }>(map: Map<string, V>, key: string, now: number): V | null {
    for (const [k, v] of map) {
      if (now - v.at > this.windowMs) map.delete(k);
    }
    let hit = map.get(key);
    let hitKey = key;
    if (!hit && map.size === 1 && (key === '' || map.has(''))) {
      [hitKey, hit] = map.entries().next().value as [string, V];
    }
    if (!hit) return null;
    map.delete(hitKey);
    return hit;
  }
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
