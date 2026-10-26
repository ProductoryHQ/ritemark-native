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
import { createHash, randomBytes } from 'crypto';
import { isEnabled } from '../features';
import type { EventName, EventPayloads, TurnOutcome, VoiceSource } from './events';
import { TurnCounter } from './turnCounts';
import { localDay, VOICE_NOTES_KEY, VoiceNotes } from './voiceNotes';
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
/** Sprint 139 (R7, R8): AI turns, counted with no text. */
let turnCounter: TurnCounter | null = null;
/** Sprint 139 (R10): voice captures, and the local list of documents that began with one. */
let voiceNotes: VoiceNotes | null = null;

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
  const channel = buildChannel(extensionVersion, context.extensionMode === vscode.ExtensionMode.Development, process.env);

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
      // Sprint 140 (R13, D6; research/feedback-delivery-audit.md): posthog-node's captureImmediate never rejects:
      // a request that failed after its retries is only emitted as 'error'. So a send counts as accepted only
      // when no error was emitted while it ran, and the feedback sheet can say "sent" only when it was. A feedback
      // send gets a client of its own (consent.ts sendFeedback), so the count it reads is its own send's.
      let errors = 0;
      let lastError: unknown;
      client.on('error', (error) => {
        errors += 1;
        lastError = error;
        console.warn('[Ritemark Analytics] PostHog error:', error);
      });
      if (process.env.RITEMARK_POSTHOG_DEBUG === '1') {
        client.debug();
      }
      return {
        captureImmediate: async (payload) => {
          const before = errors;
          await client.captureImmediate(payload);
          if (errors > before) throw lastError instanceof Error ? lastError : new Error('PostHog did not accept the event');
        },
        shutdown: () => client.shutdown(),
      };
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

  const consent = gate;
  turnCounter = new TurnCounter({
    maySend: () => consent.maySend(),
    firstMessageCounted: () => context.globalState.get<boolean>(FIRST_MESSAGE_KEY) === true,
    markFirstMessageCounted: async () => { await context.globalState.update(FIRST_MESSAGE_KEY, true); },
    track: (name, properties) => consent.track(name, properties),
  });
  voiceNotes = new VoiceNotes({
    read: () => context.globalState.get(VOICE_NOTES_KEY),
    write: async (state) => { await context.globalState.update(VOICE_NOTES_KEY, state); },
    maySend: () => consent.maySend(),
    track: (name, properties) => consent.track(name, properties),
    today: () => localDay(new Date()),
    randomSalt: () => randomBytes(16).toString('hex'),
    hash: (salt, text) => createHash('sha256').update(`${salt}\0${text}`).digest('hex'),
  });
  const notes = voiceNotes;
  // Sprint 139 (R10): a watched document changed, then saved, is "edited again" when the day is later.
  const changedSinceSave = new Set<string>();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ritemark.analytics.enabled') || event.affectsConfiguration('ritemark.features.analytics')) {
        // Turning usage data off clears the voice list at once (R10).
        void gate?.refresh().then(() => notes.prune());
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) return;
      const uri = event.document.uri.toString();
      if (!changedSinceSave.has(uri) && notes.watches(uri)) changedSinceSave.add(uri);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const uri = document.uri.toString();
      if (!changedSinceSave.delete(uri)) return;
      void notes.changedAndSaved(uri);
    }),
  );
  void gate.refresh().then(() => notes.prune());
}

/**
 * Sprint 139 (R8): a person's turn was saved and is about to run. Counts the
 * profile's first message (now after the save, so a message that was never
 * sent isn't counted), once, with usage data on.
 */
export async function countTurnAccepted(turnKey: string, runtimeId: string, continuation: boolean): Promise<void> {
  await turnCounter?.accepted(turnKey, runtimeId, continuation);
}

/** Sprint 139 (R7, R8): a person's turn ended. `agent_used` with its outcome, and `first_reply` for the first. */
export async function countTurnEnded(turnKey: string, runtimeId: string, source: 'chat' | 'flow', outcome: TurnOutcome): Promise<void> {
  await turnCounter?.ended(turnKey, runtimeId, source, outcome);
}

/** Sprint 139 (R10): a dictation put text in a document, or a Transcribe job became text. */
export async function countVoiceCapture(source: VoiceSource, input?: 'recorded' | 'file'): Promise<void> {
  await voiceNotes?.captured(source, input);
}

/** Sprint 139 (R10): watch a document that began with a voice capture, on this computer only. */
export async function rememberVoiceNote(documentUri: vscode.Uri, source: VoiceSource): Promise<void> {
  await voiceNotes?.remember(documentUri.toString(), source);
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
  // Sprint 139 (R10): usage data off clears the voice list at once.
  await voiceNotes?.prune();
}

/** globalState: the profile's first message has been counted (R8). */
const FIRST_MESSAGE_KEY = 'ritemark.analytics.firstMessageSent';

// `first_message_sent` is the turn counter's (`countTurnAccepted`): once per profile, only with usage data
// on when the message is saved; the marker is written only when the event is sent (Sprint 133 R8, Sprint 139).

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
