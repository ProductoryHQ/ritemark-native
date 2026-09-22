#!/usr/bin/env node
/**
 * check-google-oauth-build.mjs — does a built extension bundle carry a usable
 * Google OAuth client? (Sprint 119, Google Docs publishing)
 *
 *   node scripts/check-google-oauth-build.mjs <path/to/out/extension.js>
 *
 * esbuild embeds the client from RITEMARK_GOOGLE_CLIENT_ID / _SECRET as one
 * JSON literal ({"clientId":"…","clientSecret":"…"}). This reads it back from
 * the bundle that will actually ship, so a stale or env-less compile cannot
 * slip into a release. When RITEMARK_GOOGLE_CLIENT_ID is set, the embedded ID
 * must also equal it (a bundle compiled against a different client fails).
 *
 * A bundle with no Google Docs code at all (a source older than v1.12) passes
 * with a note, so the same release harness can still build older commits.
 *
 * Prints no ID or secret. Exit 0 = configured (or feature absent), 1 = not
 * configured, 2 = usage error.
 */

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: check-google-oauth-build.mjs <path/to/out/extension.js>');
  process.exit(2);
}

let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch (error) {
  console.error(`check-google-oauth-build: cannot read ${file}: ${error.message}`);
  process.exit(2);
}

// The editor protocol string exists only in builds that contain the feature.
if (!text.includes('google-docs/request-projection')) {
  console.log('Google OAuth: this bundle has no Google Docs publishing code; nothing to check.');
  process.exit(0);
}

const literals = [...text.matchAll(/"clientId":"([^"]*)","clientSecret":"([^"]*)"/g)];
if (literals.length === 0) {
  console.error('FAIL: Google OAuth client configuration not found in the bundle.');
  process.exit(1);
}

const expectedId = (process.env.RITEMARK_GOOGLE_CLIENT_ID ?? '').trim();
for (const [, clientId, clientSecret] of literals) {
  if (!clientId || !clientSecret) {
    console.error('FAIL: the bundle was compiled without a Google OAuth client — Google Docs publishing would be unavailable.');
    console.error('      Compile with RITEMARK_GOOGLE_CLIENT_ID and RITEMARK_GOOGLE_CLIENT_SECRET set.');
    process.exit(1);
  }
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    console.error('FAIL: the embedded Google OAuth client ID is not a *.apps.googleusercontent.com ID.');
    process.exit(1);
  }
  if (expectedId && clientId !== expectedId) {
    console.error('FAIL: the bundle carries a different Google OAuth client than RITEMARK_GOOGLE_CLIENT_ID (stale compile?).');
    process.exit(1);
  }
}

console.log('OK: Google OAuth client compiled into the bundle.');
