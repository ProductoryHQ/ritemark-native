/**
 * Sprint 147, PR 3 (R10, R11; #593, #460): Settings draws first, then fills in, and follows changes made elsewhere.
 *
 * The page draws from `settings`, which needs no probe. Each slow answer (Claude's state, ChatGPT's, the tools line,
 * transcript storage, the first update check) is a probe that posts its own part as it finishes:
 * - all of an open's probes start together, after the page's `ready`, once per open (`SettingsProbeScheduler.runOnce`);
 * - a probe that fails, or hangs past `PROBE_TIMEOUT_MS`, posts its fallback, and never holds the others or the page;
 * - when a part is asked for again (a status event, the tab back in view), the newest answer wins: an older run that
 *   ends later is dropped, so a slow probe can't draw a stale state over a fresh one.
 *
 * Which change elsewhere redraws what (A2, `research/stale-settings.md`) is here too, as plain functions. No vscode
 * import, so the tests run under plain `tsx`.
 */

/** The page's parts that need a probe; `settings:part` carries one of them. */
export type SettingsPartName = 'claudeCode' | 'codex' | 'environment' | 'transcriptionStorageBytes' | 'updateCenter';

export const ALL_PARTS: readonly SettingsPartName[] = ['claudeCode', 'codex', 'environment', 'transcriptionStorageBytes', 'updateCenter'];

export interface SettingsProbe<T = unknown> {
  part: SettingsPartName;
  run: () => Promise<T>;
  /** What the part shows when the probe fails, so its row stops saying Checking…. */
  fallback: (error: unknown) => T;
  /** Posts the part (and anything else it answers, such as ChatGPT's `codex:authStatus`). */
  deliver: (value: T) => void;
}

export interface ProbeTiming {
  part: SettingsPartName;
  /** When it ended, in ms since the scheduler's origin (the panel's creation). */
  endedMs: number;
  /** Its own time. */
  ms: number;
  ok: boolean;
}

/** A probe that hasn't answered by then draws its fallback, so no row says Checking… for good. */
export const PROBE_TIMEOUT_MS = 30_000;

export class SettingsProbeScheduler {
  private readonly latest = new Map<SettingsPartName, number>();
  private sequence = 0;
  private opened = false;
  private running = 0;
  private lastEnded = 0;

  constructor(
    private readonly origin: number,
    private readonly now: () => number = Date.now,
    private readonly timeoutMs: number = PROBE_TIMEOUT_MS,
  ) {}

  /** The open's run: the first call starts every probe; later calls (the page sent `ready` again) start none. */
  runOnce(probes: readonly SettingsProbe[]): Promise<ProbeTiming[]> | null {
    if (this.opened) return null;
    this.opened = true;
    return this.run(probes);
  }

  /** Whether the open's run has started. */
  get started(): boolean {
    return this.opened;
  }

  /** Whether any probe is still out. */
  get busy(): boolean {
    return this.running > 0;
  }

  /** When the last probe ended (the scheduler's clock), 0 before any. */
  get lastEndedAt(): number {
    return this.lastEnded;
  }

  /** Starts each probe at once, in parallel; each delivers on its own, and only if no newer run of its part began. */
  run(probes: readonly SettingsProbe[]): Promise<ProbeTiming[]> {
    return Promise.all(probes.map((probe) => this.runOne(probe)));
  }

  private async runOne<T>(probe: SettingsProbe<T>): Promise<ProbeTiming> {
    const ticket = ++this.sequence;
    this.latest.set(probe.part, ticket);
    this.running += 1;
    const started = this.now();
    let value: T;
    let ok = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      value = await Promise.race([
        probe.run(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('No answer in time')), this.timeoutMs);
        }),
      ]);
    } catch (error) {
      ok = false;
      value = probe.fallback(error);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const ended = this.now();
    this.running -= 1;
    this.lastEnded = ended;
    if (this.latest.get(probe.part) === ticket) {
      try {
        probe.deliver(value);
      } catch {
        // A closed panel's post: nothing to draw
      }
    }
    return { part: probe.part, endedMs: ended - this.origin, ms: ended - started, ok };
  }
}

/** R10's one line per open, with no words, names or paths: `settings: drawn <ms>, filled <ms>, slowest <step> <ms>`. */
export function settingsSummaryLine(drawnMs: number, timings: readonly ProbeTiming[]): string {
  const filled = timings.reduce((max, timing) => Math.max(max, timing.endedMs), drawnMs);
  const slowest = timings.reduce<ProbeTiming | null>((max, timing) => (!max || timing.ms > max.ms ? timing : max), null);
  const slow = slowest ? `${slowest.part} ${Math.round(slowest.ms)}` : 'none 0';
  return `settings: drawn ${Math.round(drawnMs)}, filled ${Math.round(filled)}, slowest ${slow}`;
}

// ---------------------------------------------------------------------------------------------------------------
// A2: what a change elsewhere redraws
// ---------------------------------------------------------------------------------------------------------------

/** Every setting the page shows, so a change in All settings or `settings.json` redraws it (R11; A2 rows 5–6). */
export const PAGE_CONFIG_KEYS = [
  'ritemark.agentRuntime.preference',
  'ritemark.ai.agentTimeout',
  'ritemark.ai.debugTrace',
  'ritemark.chat.fontSize',
  'ritemark.codex.approvalPolicy',
  'ritemark.codex.sandboxMode',
  'ritemark.opencode.autoApprove',
  'ritemark.updates.enabled',
  'ritemark.analytics.enabled',
  'workbench.colorTheme',
  'window.autoDetectColorScheme',
] as const;

/**
 * The settings the page writes through `setSetting`, without `ritemark.` (the review of #657: it wrote any key it was
 * sent). Each is one of `PAGE_CONFIG_KEYS`; usage data has its own message (`usageData:set`), the theme its own.
 */
export const PAGE_SETTING_KEYS = [
  'agentRuntime.preference',
  'ai.agentTimeout',
  'ai.debugTrace',
  'chat.fontSize',
  'codex.approvalPolicy',
  'codex.sandboxMode',
  'opencode.autoApprove',
  'updates.enabled',
] as const;

export type PageSettingKey = (typeof PAGE_SETTING_KEYS)[number];

/** A `setSetting` key the page may write. */
export function pageSettingAllowed(key: unknown): key is PageSettingKey {
  return typeof key === 'string'
    && (PAGE_SETTING_KEYS as readonly string[]).includes(key)
    && (PAGE_CONFIG_KEYS as readonly string[]).includes(`ritemark.${key}`);
}

export interface FollowAction {
  /** Send `settings` again (no probe). */
  base: boolean;
  /** Parts to ask again. */
  parts: SettingsPartName[];
  /** Which binary each AI runs changed: the AIs' cached states are stale everywhere, not only here. */
  runtimeChanged: boolean;
}

const NOTHING: FollowAction = { base: false, parts: [], runtimeChanged: false };

/** A configuration change: `affects` is the event's `affectsConfiguration`. */
export function configChangeAction(affects: (section: string) => boolean): FollowAction {
  if (!PAGE_CONFIG_KEYS.some((key) => affects(key))) return NOTHING;
  const runtimeChanged = affects('ritemark.agentRuntime.preference');
  return {
    base: true,
    // The runtime choice moves which Claude and ChatGPT run, and so the tools line (Git, Node.js)
    parts: runtimeChanged ? ['claudeCode', 'codex', 'environment'] : [],
    runtimeChanged,
  };
}

/** A secret saved or removed anywhere (the welcome, Configure API Key, the guidance, this page): one of the five. */
export function secretChangeAction(key: string, isKeyName: (name: string) => boolean): FollowAction {
  if (!isKeyName(key)) return NOTHING;
  // Claude without signing in uses the Anthropic key: its row follows the key
  return { base: true, parts: key === 'anthropic-api-key' ? ['claudeCode'] : [], runtimeChanged: false };
}

/** Claude's status event, from the welcome, the AI's sheet, its sign-in or this page. */
export function claudeEventParts(): SettingsPartName[] {
  return ['claudeCode', 'environment'];
}

/** ChatGPT's status event, from the AI's sheet, its runtime or this page. */
export function codexEventParts(): SettingsPartName[] {
  return ['codex'];
}

/** What no event reports (a sign-in in a terminal, an update handled from the bell) is checked when the tab is shown again. */
export const RECHECK_PARTS: readonly SettingsPartName[] = ['claudeCode', 'codex', 'environment'];

/** At most one check per this many ms, so flicking between tabs doesn't start a probe run each time. */
export const RECHECK_MIN_GAP_MS = 30_000;

/**
 * The tab came back into view: check again when the open's run has begun, nothing is still out, and the last answer
 * is older than the gap. A tab that was never hidden, or one still filling in, isn't checked.
 */
export function shouldRecheckOnView(state: {
  visible: boolean;
  wasVisible: boolean;
  started: boolean;
  busy: boolean;
  lastEndedAt: number;
  now: number;
}): boolean {
  if (!state.visible || state.wasVisible || !state.started || state.busy) return false;
  return state.now - state.lastEndedAt >= RECHECK_MIN_GAP_MS;
}
