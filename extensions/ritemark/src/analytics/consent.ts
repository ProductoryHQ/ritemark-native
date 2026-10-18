/**
 * The one consent gate for usage data (Sprint 133, R7–R9, E1).
 *
 * Nothing is counted before yes (Jarmo, 17 October 2026): every send to
 * PostHog passes `ConsentGate`, the PostHog client is not even created before
 * a yes, and the anonymous id is not written before one either. For someone
 * updating from Ritemark 1, an OK on 1.x's usage-data notice is that yes
 * (Jarmo, 18 October): see `readOneXAnswer`.
 *
 * No `vscode` import: `posthog.ts` wires the gate to the settings, the feature
 * flag and posthog-node, and the tests drive it with fakes.
 */

import type { EventName, EventPayloads } from './events';

export const PRIVACY_POLICY_URL = 'https://ritemark.app/en/privacy/';
export const TERMS_OF_USE_URL = 'https://ritemark.app/en/terms/';

/** `ritemark.analytics.enabled` as the person left it: true is yes, false is no, unset is no answer. */
export type UsageAnswer = 'unknown' | 'yes' | 'no';

/** Where the answer was given; '1.x' is an answer carried over from Ritemark 1. */
export type AnswerSource = 'welcome' | 'settings' | '1.x';

/** `ritemark.analytics.answeredV2` in globalState. */
export interface RecordedAnswer {
  answer: 'yes' | 'no';
  from: AnswerSource;
  at: string;
}

export function usageAnswer(setting: boolean | undefined): UsageAnswer {
  return setting === true ? 'yes' : setting === false ? 'no' : 'unknown';
}

/**
 * What Ritemark 1 stored, read once on a 1.x profile before the gate starts.
 *
 * - Opt Out wrote `ritemark.analytics.enabled: false`, then `hasSeenNotice`.
 * - OK wrote only `hasSeenNotice`. So did the notice's ×, Privacy Policy and
 *   Terms of Use: which button closed it was never stored.
 * - A notice that never closed wrote nothing.
 * - Only a person writes `true`: 1.x never did, and its default was true.
 *
 * Decided by Jarmo, 18 October: a notice closed without Opt Out counts as the
 * OK, so it carries over as a yes (`carryOver`: write it as one).
 */
export function readOneXAnswer(
  setting: boolean | undefined,
  hasSeenNotice: boolean | undefined,
): { answer: UsageAnswer; carryOver: boolean } {
  if (setting === false) return { answer: 'no', carryOver: false };
  if (setting === true) return { answer: 'yes', carryOver: false };
  if (hasSeenNotice === true) return { answer: 'yes', carryOver: true };
  return { answer: 'unknown', carryOver: false };
}

/**
 * `dev` for a run from source, `prod` for an installed app (#338). Installed
 * builds carry a pre-release suffix: the bundled extension is floored to
 * `X.Y.Z-0`, an update is `X.Y.Z-ext.N`. A run from source has the plain
 * `package.json` version, and an extension launched for development is dev
 * whatever its version.
 */
export function buildChannel(version: string, developmentMode: boolean): 'dev' | 'prod' {
  if (developmentMode) return 'dev';
  return /^\d+\.\d+\.\d+-.+$/.test(version) ? 'prod' : 'dev';
}

/** The PostHog calls the gate uses. */
export interface CaptureClient {
  captureImmediate(payload: { distinctId: string; event: string; properties: Record<string, unknown> }): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ConsentDeps {
  /** The person's own value of `ritemark.analytics.enabled` (user settings), never the default. */
  readSetting(): boolean | undefined;
  /** The `analytics` flag and the `ritemark.features.analytics` kill switch: they can only turn analytics off. */
  analyticsAllowed(): boolean;
  /** A PostHog client, or null when the build has no project key. Called only after a yes. */
  createClient(): CaptureClient | null;
  /** The anonymous id, read or created. Called only after a yes. */
  anonymousId(): string;
  /** Properties every event carries: `product_area`, `app_version`, `build_channel`. */
  sharedProperties(): Record<string, unknown>;
  /** `app_session_start`'s properties. */
  sessionProperties(): EventPayloads['app_session_start'];
  log?(message: string, error?: unknown): void;
}

/** The welcome's events, held in memory until the person answers (R8; Jarmo, 18 October). */
export type HeldEventName = 'welcome_shown' | 'ai_signed_in';
interface HeldEvent<T extends HeldEventName = HeldEventName> {
  name: T;
  properties: EventPayloads[T];
}

export class ConsentGate {
  private client: CaptureClient | null = null;
  private distinctId: string | null = null;
  private sessionStarted = false;
  private held: HeldEvent[] = [];

  constructor(private readonly deps: ConsentDeps) {}

  answer(): UsageAnswer {
    return usageAnswer(this.deps.readSetting());
  }

  maySend(): boolean {
    return this.deps.analyticsAllowed() && this.deps.readSetting() === true;
  }

  /** How many welcome events wait for the answer (tests and diagnostics). */
  heldCount(): number {
    return this.held.length;
  }

  /**
   * Call at start and whenever the setting or the kill switch changes. A yes
   * creates the client, sends the session start once and sends the held
   * welcome events; anything else closes the client. A no drops the held
   * events; no answer yet keeps them.
   */
  async refresh(): Promise<void> {
    if (this.maySend()) {
      if (!this.ensureClient()) return;
      if (!this.sessionStarted) {
        this.sessionStarted = true;
        await this.capture('app_session_start', this.deps.sessionProperties());
      }
      const held = this.held;
      this.held = [];
      for (const event of held) await this.capture(event.name, event.properties);
      return;
    }
    if (this.answer() === 'no' || !this.deps.analyticsAllowed()) this.held = [];
    const client = this.client;
    this.client = null;
    this.sessionStarted = false;
    if (client) {
      try {
        await client.shutdown();
      } catch (error) {
        this.deps.log?.('PostHog shutdown failed', error);
      }
    }
  }

  /** Send an event when the answer is yes; otherwise nothing leaves the computer. */
  async track<T extends EventName>(name: T, properties: EventPayloads[T]): Promise<boolean> {
    if (!this.maySend() || !this.ensureClient()) return false;
    return this.capture(name, properties);
  }

  /**
   * The welcome's own events: sent at once after a yes, held in memory while
   * there is no answer, dropped after a no. Nothing is written to disk.
   */
  async trackWelcome<T extends HeldEventName>(name: T, properties: EventPayloads[T]): Promise<'sent' | 'held' | 'dropped'> {
    if (this.maySend()) return (await this.track(name, properties)) ? 'sent' : 'dropped';
    if (this.answer() === 'unknown' && this.deps.analyticsAllowed()) {
      this.held.push({ name, properties } as HeldEvent);
      return 'held';
    }
    return 'dropped';
  }

  /** Drop the held events (the welcome closed without a yes). */
  dropHeld(): void {
    this.held = [];
  }

  async shutdown(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client) await client.shutdown();
  }

  private ensureClient(): boolean {
    if (this.client) return true;
    const client = this.deps.createClient();
    if (!client) return false;
    this.client = client;
    this.distinctId = this.deps.anonymousId();
    return true;
  }

  private async capture(event: string, properties: object): Promise<boolean> {
    if (!this.client || !this.distinctId) return false;
    try {
      await this.client.captureImmediate({
        distinctId: this.distinctId,
        event,
        properties: {
          ...properties,
          ...this.deps.sharedProperties(),
          $process_person_profile: false,
        },
      });
      return true;
    } catch (error) {
      this.deps.log?.('Failed to capture PostHog event', error);
      return false;
    }
  }
}
