/**
 * Settings ▸ Sharing (Sprint 119, W7; Sprint 147, R5, experience 15 frame 5): Google Docs as two rows, Your Google
 * account and Template for new Google Docs, with every state the card had (I39, I40).
 *
 * Renders the host's redacted account projection and sends intent only. The shape mirrors
 * `GoogleDocsSettingsProjection` in `src/googleDocs/types.ts`; no token, account id or file id ever reaches this webview.
 */

import { vscode } from '../../lib/vscode';
import { ExternalLink, SettingsGroup, SettingsRow, TipButton } from './SettingsRow';

export interface GoogleDocsSettingsProjection {
  enabled: boolean;
  state: 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'reauthorize';
  email: string | null;
  displayName: string | null;
  template: { name: string } | null;
  choosingTemplate: boolean;
  message: string | null;
}

type GoogleDocsSettingsAction =
  | 'google-docs/connect'
  | 'google-docs/cancel'
  | 'google-docs/disconnect'
  | 'google-docs/choose-template'
  | 'google-docs/clear-template';

const PRIVACY_URL = 'https://ritemark.app/en/privacy/';

function send(type: GoogleDocsSettingsAction) {
  vscode.postMessage({ type });
}

const ABOUT = 'Share a document as a Google Doc, and keep it up to date with Sync. Ritemark opens only the Google Docs it makes, and your template.';

export function GoogleDocsSettingsCard({ projection }: { projection: GoogleDocsSettingsProjection | null }) {
  if (!projection || !projection.enabled) return null;
  const { state } = projection;

  const accountLine = state === 'unavailable'
    ? "Google Docs publishing isn't available in this version of Ritemark."
    : state === 'connecting'
      ? 'Google sign-in opened in your browser. Allow access to finish. Ritemark updates automatically.'
      : state === 'reauthorize'
        ? `Google needs you to sign in again${projection.email ? ` as ${projection.email}` : ''} before Ritemark can publish.`
        : state === 'connected'
          ? `Connected as ${projection.email ?? 'your Google account'}.`
          : ABOUT;

  return (
    <section id="settings-section-google-docs" className="scroll-mt-6">
      <SettingsGroup>Google Docs</SettingsGroup>
      <SettingsRow row="I39" name="Your Google account" line={accountLine}>
        {state === 'disconnected' && (
          <TipButton tip="Opens Google's sign-in in your browser" variant="outline" size="sm" onClick={() => send('google-docs/connect')}>
            Connect
          </TipButton>
        )}
        {state === 'connecting' && (
          <TipButton tip="Stops waiting for Google's sign-in" variant="outline" size="sm" onClick={() => send('google-docs/cancel')}>
            Cancel
          </TipButton>
        )}
        {state === 'reauthorize' && (
          <TipButton tip="Opens Google's sign-in in your browser again" variant="outline" size="sm" onClick={() => send('google-docs/connect')}>
            Reconnect
          </TipButton>
        )}
        {(state === 'connected' || state === 'reauthorize') && (
          <TipButton tip="Forgets your Google account here. Your Google Docs stay." variant="ghost" size="sm" onClick={() => send('google-docs/disconnect')}>
            Disconnect
          </TipButton>
        )}
      </SettingsRow>

      {state === 'connected' && (
        <SettingsRow
          row="I40"
          name="Template for new Google Docs"
          line={projection.choosingTemplate
            ? 'The Google file picker opened in your browser. Choose a Google Doc to use as the template.'
            : projection.template ? projection.template.name : "None: Google Docs' own styles"}
        >
          {projection.choosingTemplate ? (
            <TipButton tip="Stops waiting for the file picker" variant="outline" size="sm" onClick={() => send('google-docs/cancel')}>
              Cancel
            </TipButton>
          ) : (
            <>
              <TipButton tip="Opens Google's file picker in your browser" variant="outline" size="sm" onClick={() => send('google-docs/choose-template')}>
                {projection.template ? 'Change…' : 'Choose…'}
              </TipButton>
              {projection.template && (
                <TipButton tip="New Google Docs use Google Docs' own styles again" variant="ghost" size="sm" onClick={() => send('google-docs/clear-template')}>
                  Clear
                </TipButton>
              )}
            </>
          )}
        </SettingsRow>
      )}

      {projection.message && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-ritemark-error">{projection.message}</p>
      )}

      {state !== 'unavailable' && (
        <p className="mt-2 text-[13px] leading-[18px] text-ink-muted">
          The template applies when a Google Doc is created. Sync replaces only the text of an existing Google Doc,
          so its header and styles stay. Disconnecting never deletes your Google Docs.{' '}
          <ExternalLink url={PRIVACY_URL}>How Ritemark uses Google data</ExternalLink>
        </p>
      )}
    </section>
  );
}
