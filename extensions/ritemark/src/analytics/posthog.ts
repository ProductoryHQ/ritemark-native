/**
 * PostHog analytics client for Ritemark.
 *
 * - Anonymous UUID stored in globalState (no PII)
 * - Opt-out via `ritemark.analytics.enabled` setting (checked per-event)
 * - Feature-flag kill-switch via `ritemark.features.analytics`
 * - Flushes on deactivate so no events are lost
 */

import * as vscode from 'vscode';
import { PostHog } from 'posthog-node';
import type { EventName, EventPayloads } from './events';

const POSTHOG_API_KEY = 'phc_PLACEHOLDER';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const GLOBAL_STATE_UUID_KEY = 'ritemark.analytics.anonymousId';
const GLOBAL_STATE_NOTICE_KEY = 'ritemark.analytics.hasSeenNotice';

let client: PostHog | null = null;
let anonymousId: string | null = null;
let extensionVersion: string = '';

/**
 * Initialise the analytics subsystem.
 * Call once from `activate()`.
 */
export function initAnalytics(context: vscode.ExtensionContext): void {
  extensionVersion = context.extension.packageJSON.version as string;

  // Read or generate stable anonymous UUID
  let storedId = context.globalState.get<string>(GLOBAL_STATE_UUID_KEY);
  if (!storedId) {
    storedId = generateUUID();
    context.globalState.update(GLOBAL_STATE_UUID_KEY, storedId);
  }
  anonymousId = storedId;

  // Initialise PostHog client
  client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST, flushAt: 10, flushInterval: 30_000 });

  // First-launch notice (shown once)
  const hasSeenNotice = context.globalState.get<boolean>(GLOBAL_STATE_NOTICE_KEY);
  if (!hasSeenNotice) {
    showFirstLaunchNotice(context);
  }

  // Fire session start event
  trackEvent('app_session_start', {
    version: extensionVersion,
    platform: process.platform,
  });
}

/**
 * Track an analytics event.
 * Respects both the settings toggle and the feature-flag kill-switch.
 */
export function trackEvent<T extends EventName>(
  name: T,
  properties: EventPayloads[T]
): void {
  if (!isAnalyticsEnabled() || !client || !anonymousId) {
    return;
  }

  client.capture({
    distinctId: anonymousId,
    event: name,
    properties: {
      ...properties,
      app_version: extensionVersion,
    },
  });
}

/**
 * Flush pending events and shut down the client.
 * Call from `deactivate()`.
 */
export async function shutdownAnalytics(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}

// ── Internals ────────────────────────────────────────────────

function isAnalyticsEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('ritemark');
  const settingEnabled = config.get<boolean>('analytics.enabled', true);
  const flagEnabled = config.get<boolean>('features.analytics', true);
  return settingEnabled && flagEnabled;
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

async function showFirstLaunchNotice(context: vscode.ExtensionContext): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    'Ritemark collects anonymous usage data to improve the product. No personal information is collected.',
    'OK',
    'Opt Out'
  );

  if (choice === 'Opt Out') {
    await vscode.workspace
      .getConfiguration('ritemark')
      .update('analytics.enabled', false, vscode.ConfigurationTarget.Global);
  }

  context.globalState.update(GLOBAL_STATE_NOTICE_KEY, true);
}
