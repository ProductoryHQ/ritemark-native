import assert from 'node:assert/strict';
import { MAX_PUBLISH_HTML_BYTES, decodeEditorRequest, decodeSettingsRequest, isGoogleDocsMessage } from './protocol';
import { resolveGoogleOAuthConfig } from './config';

// ── Editor requests ──────────────────────────────────────────────────────────

assert.deepEqual(decodeEditorRequest({ type: 'google-docs/publish', html: '<p>x</p>', title: 'Doc' }),
  { type: 'google-docs/publish', html: '<p>x</p>', title: 'Doc' });
assert.deepEqual(decodeEditorRequest({ type: 'google-docs/publish', html: '<p>x</p>' }),
  { type: 'google-docs/publish', html: '<p>x</p>', title: null }, 'title is optional');
assert.equal(decodeEditorRequest({ type: 'google-docs/publish', html: '<p>x</p>', fileId: 'someone-elses-doc' }), null,
  'a webview cannot name a destination: unknown fields are rejected');
assert.equal(decodeEditorRequest({ type: 'google-docs/publish', html: 42 }), null);
assert.equal(decodeEditorRequest({ type: 'google-docs/publish', html: '', title: 7 }), null);
assert.equal(decodeEditorRequest({ type: 'google-docs/publish', html: 'x'.repeat(MAX_PUBLISH_HTML_BYTES + 1) }), null, 'oversized payloads are refused');
assert.equal((decodeEditorRequest({ type: 'google-docs/publish', html: '', title: 't'.repeat(400) }) as { title: string }).title.length, 250);

for (const type of ['google-docs/open', 'google-docs/unlink', 'google-docs/open-settings', 'google-docs/request-projection']) {
  assert.deepEqual(decodeEditorRequest({ type }), { type });
  assert.equal(decodeEditorRequest({ type, url: 'https://evil.example' }), null, `${type} carries nothing else`);
}
assert.equal(decodeEditorRequest({ type: 'google-docs/connect' }), null, 'Settings actions are not editor actions');
assert.equal(decodeEditorRequest({ type: 'comment-task/accept' }), null);
assert.equal(decodeEditorRequest(null), null);

// ── Settings requests ────────────────────────────────────────────────────────

for (const type of ['google-docs/connect', 'google-docs/cancel', 'google-docs/disconnect', 'google-docs/choose-template', 'google-docs/clear-template']) {
  assert.deepEqual(decodeSettingsRequest({ type }), { type });
  assert.equal(decodeSettingsRequest({ type, token: 'x' }), null);
}
assert.equal(decodeSettingsRequest({ type: 'google-docs/publish', html: '' }), null, 'publishing starts only from an editor');
assert.equal(isGoogleDocsMessage({ type: 'google-docs/anything' }), true);
assert.equal(isGoogleDocsMessage({ type: 'setApiKey' }), false);

// ── OAuth client configuration ───────────────────────────────────────────────

assert.equal(resolveGoogleOAuthConfig({}, {}), null, 'no configuration means "unavailable in this build"');
assert.equal(resolveGoogleOAuthConfig({}, { clientId: 'not-a-google-client', clientSecret: 's' }), null);
assert.equal(resolveGoogleOAuthConfig({}, { clientId: 'x.apps.googleusercontent.com', clientSecret: '' }), null, 'Phase 0: the secret is required');
assert.deepEqual(resolveGoogleOAuthConfig({}, { clientId: 'x.apps.googleusercontent.com', clientSecret: 's' }),
  { clientId: 'x.apps.googleusercontent.com', clientSecret: 's' });
assert.deepEqual(
  resolveGoogleOAuthConfig({ RITEMARK_GOOGLE_CLIENT_ID: 'dev.apps.googleusercontent.com', RITEMARK_GOOGLE_CLIENT_SECRET: 'dev' },
    { clientId: 'x.apps.googleusercontent.com', clientSecret: 's' }),
  { clientId: 'dev.apps.googleusercontent.com', clientSecret: 'dev' },
  'the runtime environment overrides the compiled-in client for development',
);

console.log('googleDocs/protocol: all assertions passed');
