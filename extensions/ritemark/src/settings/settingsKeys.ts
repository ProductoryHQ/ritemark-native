/**
 * Sprint 147, PR 3 (High; decision 2): the API keys Settings may save, remove, test or show, by their secret's name.
 *
 * The page's `setApiKey` used to save any secret name it was sent (Sprint 149's audit). Every key message is held to
 * this list now, and to the flag that shows its row, so a page can't write, read or remove another secret
 * (Google Docs' tokens, the browser's, a runtime's). No vscode import, so the tests run under plain `tsx`.
 */

/** The five keys, as SecretStorage holds them. These same values power the OpenCode runtime (Sprint 76 R3a). */
export const SETTINGS_KEY_NAMES = [
  'openai-api-key',
  'google-ai-key',
  'anthropic-api-key',
  'openrouter-api-key',
  'elevenlabs-api-key',
] as const;

export type SettingsKeyName = (typeof SETTINGS_KEY_NAMES)[number];

export interface SettingsKeyFlags {
  /** `opencode-integration`: the OpenRouter row. */
  opencode: boolean;
  /** `transcription-workbench`: the ElevenLabs row. */
  transcription: boolean;
}

/** A key name the page may act on: one of the five, and its row's flag on (Sprint 76 R7, Sprint 108 R4). */
export function settingsKeyAllowed(name: unknown, flags: SettingsKeyFlags): name is SettingsKeyName {
  if (typeof name !== 'string' || !(SETTINGS_KEY_NAMES as readonly string[]).includes(name)) return false;
  if (name === 'openrouter-api-key') return flags.opencode;
  if (name === 'elevenlabs-api-key') return flags.transcription;
  return true;
}

/** One of the five, whatever the flags: a change to it elsewhere redraws which keys are saved. */
export function isSettingsKeyName(name: unknown): name is SettingsKeyName {
  return typeof name === 'string' && (SETTINGS_KEY_NAMES as readonly string[]).includes(name);
}

/** The part of SecretStorage the page's key messages may touch. */
export interface KeySecretsLike {
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

/**
 * The page's `setApiKey`, applied (Sprint 149, PR 4): a non-empty value is stored trimmed, an empty one removes the
 * key. Only one of the five keys, with its row's flag on, is ever written or removed; anything else
 * (`ritemark.publish.cloudflare.v1`, Google's tokens, a name made up by a page) answers null and touches nothing.
 * `settingsKeys.test.ts` holds it to that.
 */
export async function applyApiKeyMessage(
  message: { key?: unknown; value?: unknown },
  flags: SettingsKeyFlags,
  secrets: KeySecretsLike,
): Promise<{ key: SettingsKeyName; action: 'stored' | 'removed' } | null> {
  const key = message.key;
  if (!settingsKeyAllowed(key, flags) || typeof message.value !== 'string') return null;
  const value = message.value.trim();
  if (value) {
    await secrets.store(key, value);
    return { key, action: 'stored' };
  }
  await secrets.delete(key);
  return { key, action: 'removed' };
}
