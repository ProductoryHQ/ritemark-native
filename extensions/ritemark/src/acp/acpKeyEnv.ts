/**
 * ACP BYOK key → spawn-env mapping
 *
 * Sprint 76 R3a: maps the provider API keys the user has configured in Ritemark
 * Settings (the SAME SecretStorage values the OpenAI / Google AI / Anthropic
 * cards write, plus the new OpenRouter card) to the environment variables the
 * OpenCode agent reads at spawn.
 *
 * Hard invariant (spec R3a): keys are injected into the agent process env only —
 * never written to disk, never serialized into a webview message. This module is
 * vscode-free so it unit-tests with fake key values.
 *
 * Env var mapping:
 *   google     → GEMINI_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY (both expected)
 *   openai     → OPENAI_API_KEY
 *   anthropic  → ANTHROPIC_API_KEY
 *   openrouter → OPENROUTER_API_KEY
 */

/**
 * SecretStorage names that hold the BYOK provider keys — the SAME names the
 * Settings cards write. Sprint 78 (stretch): used to detect which secret
 * changes should refresh the OpenCode provider flags in the AI sidebar.
 */
export const BYOK_SECRET_KEYS: readonly string[] = [
  'openai-api-key',
  'google-ai-key',
  'anthropic-api-key',
  'openrouter-api-key',
];

/** Provider keys read from SecretStorage. Any field may be undefined/empty. */
export interface ByokKeys {
  /** SecretStorage 'google-ai-key'. */
  google?: string;
  /** SecretStorage 'openai-api-key'. */
  openai?: string;
  /** SecretStorage 'anthropic-api-key'. */
  anthropic?: string;
  /** SecretStorage 'openrouter-api-key'. */
  openrouter?: string;
}

/** Which providers are configured — the only key-derived data the webview sees. */
export interface ByokProviderFlags {
  google: boolean;
  openai: boolean;
  anthropic: boolean;
  openrouter: boolean;
}

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build the BYOK env var map from configured keys. Only present keys produce
 * entries (so an unset provider leaves its env vars untouched). The Google key
 * fans out to both GEMINI_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY because
 * OpenCode's Google provider reads the latter while older tooling reads the
 * former (spec R3a).
 */
export function buildByokEnv(keys: ByokKeys): Record<string, string> {
  const env: Record<string, string> = {};
  if (present(keys.google)) {
    env.GEMINI_API_KEY = keys.google;
    env.GOOGLE_GENERATIVE_AI_API_KEY = keys.google;
  }
  if (present(keys.openai)) {
    env.OPENAI_API_KEY = keys.openai;
  }
  if (present(keys.anthropic)) {
    env.ANTHROPIC_API_KEY = keys.anthropic;
  }
  if (present(keys.openrouter)) {
    env.OPENROUTER_API_KEY = keys.openrouter;
  }
  return env;
}

/**
 * Derive the provider-configured booleans (the webview model-picker filter and
 * setup-prompt signal). This is the ONLY key-derived data allowed to cross to
 * the webview — never the key values themselves (spec R3a).
 */
export function byokProviderFlags(keys: ByokKeys): ByokProviderFlags {
  return {
    google: present(keys.google),
    openai: present(keys.openai),
    anthropic: present(keys.anthropic),
    openrouter: present(keys.openrouter),
  };
}
