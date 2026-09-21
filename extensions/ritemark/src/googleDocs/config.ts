/**
 * Google installed-app OAuth client configuration (Sprint 119, R2).
 *
 * Google's installed-app guidance treats a distributed desktop app as unable
 * to keep a client secret, and Phase 0 proved the token endpoint still
 * requires one (`client_secret is missing`). So both values are *public build
 * configuration*: injected at compile time by esbuild's `define` from
 * RITEMARK_GOOGLE_CLIENT_ID / RITEMARK_GOOGLE_CLIENT_SECRET, never committed,
 * and never treated as a security boundary. The real secrets are the user's
 * tokens and the per-attempt PKCE verifier.
 *
 * A build without them still runs; the Settings card then reports that Google
 * Docs publishing is unavailable in this build instead of failing at Connect.
 */

declare const __RITEMARK_GOOGLE_OAUTH__: string | undefined;

export interface GoogleOAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

function fromBuild(): Partial<GoogleOAuthClientConfig> {
  try {
    if (typeof __RITEMARK_GOOGLE_OAUTH__ === 'string') {
      return JSON.parse(__RITEMARK_GOOGLE_OAUTH__) as Partial<GoogleOAuthClientConfig>;
    }
  } catch {
    // A malformed define is treated exactly like an absent one.
  }
  return {};
}

/**
 * Runtime environment wins over the compiled-in value, so a developer can run
 * RunDev against a different client without recompiling.
 */
export function resolveGoogleOAuthConfig(
  env: Record<string, string | undefined> = process.env,
  build: Partial<GoogleOAuthClientConfig> = fromBuild(),
): GoogleOAuthClientConfig | null {
  const clientId = (env.RITEMARK_GOOGLE_CLIENT_ID || build.clientId || '').trim();
  const clientSecret = (env.RITEMARK_GOOGLE_CLIENT_SECRET || build.clientSecret || '').trim();
  if (!clientId.endsWith('.apps.googleusercontent.com') || !clientSecret) return null;
  return { clientId, clientSecret };
}
