/**
 * PostHog analytics client for Ritemark.
 *
 * - Anonymous UUID stored in globalState (no PII)
 * - Opt-out via `ritemark.analytics.enabled` setting (checked per-event)
 * - Feature-flag kill-switch via `ritemark.features.analytics`
 * - Project API key loaded from env or product.json (never hardcoded in source)
 * - Flushes on deactivate so no events are lost
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { EventName, EventPayloads } from './events';

interface AnalyticsClient {
  capture(payload: {
    distinctId: string;
    event: string;
    properties: Record<string, unknown>;
  }): void;
  captureImmediate(payload: {
    distinctId: string;
    event: string;
    properties: Record<string, unknown>;
  }): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
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
    }
  ) => AnalyticsClient;
};

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const GLOBAL_STATE_UUID_KEY = 'ritemark.analytics.anonymousId';
const GLOBAL_STATE_NOTICE_KEY = 'ritemark.analytics.hasSeenNotice';
const PRIVACY_POLICY_URL = 'https://www.productory.ai/en/privacy/';
const TERMS_OF_USE_URL = 'https://www.productory.ai/en/terms/';

let client: AnalyticsClient | null = null;
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

  const config = getAnalyticsConfig();
  if (!config) {
    console.log(
      '[Ritemark Analytics] Disabled: no PostHog project key configured. ' +
        'Set RITEMARK_POSTHOG_PROJECT_KEY (and optionally RITEMARK_POSTHOG_HOST) for dev, ' +
        'or inject posthogProjectApiKey/posthogHost into product.json for packaged builds.'
    );
    return;
  }

  // Initialise PostHog client
  client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  client.on('error', (error) => {
    console.warn('[Ritemark Analytics] PostHog error:', error);
  });

  if (process.env.RITEMARK_POSTHOG_DEBUG === '1') {
    client.debug();
  }

  // First-launch notice (shown once)
  const hasSeenNotice = context.globalState.get<boolean>(GLOBAL_STATE_NOTICE_KEY);
  if (!hasSeenNotice) {
    void showFirstLaunchNotice(context).then(() => {
      void trackEvent('app_session_start', {
        version: extensionVersion,
        platform: process.platform,
      });
    });
    return;
  }

  // Fire session start event
  void trackEvent('app_session_start', {
    version: extensionVersion,
    platform: process.platform,
  });
}

/**
 * Track an analytics event.
 * Respects both the settings toggle and the feature-flag kill-switch.
 */
export async function trackEvent<T extends EventName>(
  name: T,
  properties: EventPayloads[T]
): Promise<boolean> {
  if (!isAnalyticsEnabled() || !client || !anonymousId) {
    return false;
  }

  try {
    await client.captureImmediate({
      distinctId: anonymousId,
      event: name,
      properties: {
        ...properties,
        $process_person_profile: false,
        product_area: 'app',
        app_version: extensionVersion,
      },
    });
    return true;
  } catch (error) {
    console.warn('[Ritemark Analytics] Failed to capture PostHog event:', error);
    return false;
  }
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

function getAnalyticsConfig(): { apiKey: string; host: string } | null {
  const envApiKey = process.env.RITEMARK_POSTHOG_PROJECT_KEY?.trim();
  const envHost = process.env.RITEMARK_POSTHOG_HOST?.trim();

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      host: envHost || DEFAULT_POSTHOG_HOST,
    };
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

async function showFirstLaunchNotice(context: vscode.ExtensionContext): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    'Ritemark collects anonymous usage data to improve the product. No personal information is collected.',
    'OK',
    'Opt Out',
    'Privacy Policy',
    'Terms of Use'
  );

  if (choice === 'Opt Out') {
    await vscode.workspace
      .getConfiguration('ritemark')
      .update('analytics.enabled', false, vscode.ConfigurationTarget.Global);
  } else if (choice === 'Privacy Policy') {
    await vscode.env.openExternal(vscode.Uri.parse(PRIVACY_POLICY_URL));
  } else if (choice === 'Terms of Use') {
    await vscode.env.openExternal(vscode.Uri.parse(TERMS_OF_USE_URL));
  }

  context.globalState.update(GLOBAL_STATE_NOTICE_KEY, true);
}
