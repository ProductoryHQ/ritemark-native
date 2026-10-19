/**
 * PostHog analytics client for Ritemark.
 *
 * - Nothing is sent before a yes (Sprint 133, R7): `ritemark.analytics.enabled`
 *   defaults to false, and every send passes the one gate in `consent.ts`.
 *   Before a yes no client exists, no anonymous id is written and nothing
 *   leaves the computer.
 * - On by default from the welcome (Jarmo, 19 October): its switch shows on,
 *   and leaving the welcome for a project with it on is the yes. Settings
 *   changes it at once. Ritemark 1's notice is retired; an OK on it carries over
 *   as a yes (`consent.ts`).
 * - No location: GeoIP is off for every event.
 * - Feature-flag kill-switch via `ritemark.features.analytics` (off only)
 * - Every event carries `build_channel` (#338)
 * - Project API key loaded from env or product.json (never hardcoded in source); a run
 *   from source uses only the env key

 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isEnabled } from '../features';
import type { EventName, EventPayloads } from './events';
import {
  ConsentGate,
  buildChannel,
  usageAnswer,
  type AnswerSource,
  type CaptureClient,
  type FeedbackEvent,
  type HeldEventName,
  type RecordedAnswer,
  type UsageAnswer,
} from './consent';

interface AnalyticsClient extends CaptureClient {
  debug(enabled?: boolean): void;
  on(event: 'error', listener: (error: unknown) => void): void;
}

const { PostHog } = require('posthog-node') as {
  PostHog: new (
    apiKey: string,
    options: {
      host: string;
      flushAt: number;
      flushInterval: number;
      disableGeoip?: boolean;
    }
  ) => AnalyticsClient;
};

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const GLOBAL_STATE_UUID_KEY = 'ritemark.analytics.anonymousId';
/** Written by Ritemark 1 when its notice closed; read once by the update detection, never written again. */
export const LEGACY_NOTICE_KEY = 'ritemark.analytics.hasSeenNotice';
/** How and where the person answered in 2.0 (`RecordedAnswer`). */
export const ANSWER_KEY = 'ritemark.analytics.answeredV2';

let gate: ConsentGate | null = null;
let extensionContext: vscode.ExtensionContext | null = null;

/** The person's own value of the setting: the default (false) is never mistaken for an answer. */
function readSetting(): boolean | undefined {
  const value = vscode.workspace.getConfiguration('ritemark').inspect<boolean>('analytics.enabled')?.globalValue;
  return typeof value === 'boolean' ? value : undefined;
}

function analyticsAllowed(): boolean {
  return isEnabled('analytics')
    && vscode.workspace.getConfiguration('ritemark').get<boolean>('features.analytics', true);
}

/**
 * Initialise the analytics subsystem.
 * Call once from `activate()`, after the update detection has read Ritemark 1's answer.
 */
export function initAnalytics(context: vscode.ExtensionContext): void {
  extensionContext = context;
  const extensionVersion = context.extension.packageJSON.version as string;
  const channel = buildChannel(extensionVersion, context.extensionMode === vscode.ExtensionMode.Development);

  gate = new ConsentGate({
    readSetting,
    analyticsAllowed,
    createClient: (options) => {
      const config = getAnalyticsConfig(channel === 'prod');
      if (!config) {
        console.log(
          '[Ritemark Analytics] Disabled: no PostHog project key configured. ' +
            'Set RITEMARK_POSTHOG_PROJECT_KEY (and optionally RITEMARK_POSTHOG_HOST) for dev, ' +
            'or inject posthogProjectApiKey/posthogHost into product.json for packaged builds.'
        );
        return null;
      }
      const client = new PostHog(config.apiKey, {
        host: config.host,
        flushAt: 1,
        flushInterval: 0,
        // No location from any event (Jarmo, 19 October, with usage data on by default): the request
        // comes from the person's own computer, so PostHog's GeoIP would place them; every event also
        // carries `$geoip_disable` (consent.ts).
        disableGeoip: true,
      });
      client.on('error', (error) => {
        console.warn('[Ritemark Analytics] PostHog error:', error);
      });
      if (process.env.RITEMARK_POSTHOG_DEBUG === '1') {
        client.debug();
      }
      return client;
    },
    oneOffId: () => generateUUID(),
    anonymousId: () => {
      // Written only after a yes (a 1.x profile already has one).
      let storedId = context.globalState.get<string>(GLOBAL_STATE_UUID_KEY);
      if (!storedId) {
        storedId = generateUUID();
        void context.globalState.update(GLOBAL_STATE_UUID_KEY, storedId);
      }
      return storedId;
    },
    sharedProperties: () => ({
      product_area: 'app',
      app_version: extensionVersion,
      build_channel: channel,
    }),
    sessionProperties: () => ({ version: extensionVersion, platform: process.platform }),
    log: (message, error) => console.warn(`[Ritemark Analytics] ${message}:`, error),
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ritemark.analytics.enabled') || event.affectsConfiguration('ritemark.features.analytics')) {
        void gate?.refresh();
      }
    })
  );
  void gate.refresh();
}

/**
 * Send feedback the person chose to send: with usage data on, as any event; with it off, only these events, with a
 * one-off id and no location (Sprint 133, G3). Never turns usage data on.
 */
export async function sendFeedback(events: ReadonlyArray<FeedbackEvent>): Promise<boolean> {
  return gate ? gate.sendFeedback(events) : false;
}

/**
 * Track an analytics event. Sent only after the person's yes; otherwise
 * nothing leaves the computer.
 */
export async function trackEvent<T extends EventName>(
  name: T,
  properties: EventPayloads[T]
): Promise<boolean> {
  return gate ? gate.track(name, properties) : false;
}

/** The welcome's events: held in memory until the answer (R8). */
export async function trackWelcomeEvent<T extends HeldEventName>(
  name: T,
  properties: EventPayloads[T]
): Promise<void> {
  await gate?.trackWelcome(name, properties);
}

/** Drop the welcome's held events (it closed without a yes). */
export function dropHeldWelcomeEvents(): void {
  gate?.dropHeld();
}

export interface UsageDataState {
  on: boolean;
  answer: UsageAnswer;
  /** The yes or no was carried over from Ritemark 1 and not changed since. */
  fromRitemark1: boolean;
}

export function usageDataState(): UsageDataState {
  const answer = usageAnswer(readSetting());
  const recorded = extensionContext?.globalState.get<RecordedAnswer>(ANSWER_KEY);
  return {
    on: answer === 'yes',
    answer,
    fromRitemark1: recorded?.from === '1.x' && recorded.answer === (answer === 'yes' ? 'yes' : 'no'),
  };
}

/**
 * The person's answer, from the welcome's switch or Settings. Takes effect at
 * once: a yes starts sending (and sends the held welcome events), a no stops.
 */
export async function setUsageData(on: boolean, from: AnswerSource): Promise<void> {
  const recorded: RecordedAnswer = { answer: on ? 'yes' : 'no', from, at: new Date().toISOString() };
  await extensionContext?.globalState.update(ANSWER_KEY, recorded);
  await vscode.workspace.getConfiguration('ritemark').update('analytics.enabled', on, vscode.ConfigurationTarget.Global);
  await gate?.refresh();
}

/** globalState: the profile's first message has been counted (R8). */
const FIRST_MESSAGE_KEY = 'ritemark.analytics.firstMessageSent';

/**
 * `first_message_sent`, once per profile, and only when usage data is on when
 * the message is sent. The marker is written only when the event is sent, so
 * nothing about it is stored before a yes.
 */
export async function trackFirstMessageSent(runtimeId: string): Promise<void> {
  const context = extensionContext;
  if (!context || !gate?.maySend() || context.globalState.get<boolean>(FIRST_MESSAGE_KEY)) return;
  const provider = runtimeId === 'claude-code' ? 'claude' : runtimeId === 'codex' ? 'chatgpt' : runtimeId === 'opencode' ? 'opencode' : null;
  if (!provider) return;
  await context.globalState.update(FIRST_MESSAGE_KEY, true);
  await gate.track('first_message_sent', { provider });
}

/**
 * Flush pending events and shut down the client.
 * Call from `deactivate()`.
 */
export async function shutdownAnalytics(): Promise<void> {
  await gate?.shutdown();
}

// ── Internals ────────────────────────────────────────────────

function getAnalyticsConfig(productKeyAllowed: boolean): { apiKey: string; host: string } | null {
  const envApiKey = process.env.RITEMARK_POSTHOG_PROJECT_KEY?.trim();
  const envHost = process.env.RITEMARK_POSTHOG_HOST?.trim();

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      host: envHost || DEFAULT_POSTHOG_HOST,
    };
  }

  // A run from source sends only to a key given for it (Sprint 133, R9): with usage data on by
  // default, a dev or automation profile that finishes the welcome must not reach Ritemark's project.
  if (!productKeyAllowed) {
    return null;
  }

  try {
    const productJsonPath = path.join(vscode.env.appRoot, 'product.json');
    const raw = fs.readFileSync(productJsonPath, 'utf-8');
    const product = JSON.parse(raw) as {
      posthogProjectApiKey?: string;
      posthogHost?: string;
    };
    const apiKey = product.posthogProjectApiKey?.trim();
    if (apiKey) {
      return {
        apiKey,
        host: product.posthogHost?.trim() || DEFAULT_POSTHOG_HOST,
      };
    }
  } catch (error) {
    console.warn('[Ritemark Analytics] Failed to read PostHog config from product.json:', error);
  }

  return null;
}

function generateUUID(): string {
  // crypto.randomUUID is available in Node 19+; fallback for older runtimes
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
