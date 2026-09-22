/**
 * Settings → Google Docs (Sprint 119, W7).
 *
 * Renders the host's redacted account projection and sends intent only. The
 * shape mirrors `GoogleDocsSettingsProjection` in `src/googleDocs/types.ts`;
 * no token, account id or file id ever reaches this webview.
 */

import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { vscode } from '../../lib/vscode';

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

export function GoogleDocsSettingsCard({ projection }: { projection: GoogleDocsSettingsProjection | null }) {
  if (!projection || !projection.enabled) return null;
  const { state } = projection;

  return (
    <section id="settings-section-google-docs" className="mb-8 scroll-mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="cloud-arrow-up" size={20} className="text-ink-strong" />
        <h2 className="text-lg font-semibold text-ink-strong">
          Google Docs
        </h2>
      </div>

      <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium text-ink-strong">Google account</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-accent-soft text-accent-deep">
              Experimental
            </span>
          </div>
          {state === 'connected' && (
            <span className="flex items-center gap-1 text-xs text-ritemark-success">
              <Icon name="check" size={12} />
              Connected
            </span>
          )}
        </div>

        {state === 'unavailable' && (
          <p className="text-xs text-ink-muted">
            Google Docs publishing isn&apos;t available in this version of Ritemark.
          </p>
        )}

        {state === 'disconnected' && (
          <>
            <p className="text-xs text-ink-muted mb-3">
              Publish Markdown documents as Google Docs and keep them up to date with Sync.
              Ritemark can open only the Google Docs it creates and the template you choose.
            </p>
            <Button onClick={() => send('google-docs/connect')} size="lg">
              Connect Google account
            </Button>
          </>
        )}

        {state === 'connecting' && (
          <>
            <p className="text-xs text-ink-muted mb-3">
              Google sign-in opened in your browser. Allow access to finish. Ritemark updates automatically.
            </p>
            <Button onClick={() => send('google-docs/cancel')} variant="secondary" size="lg">
              Cancel sign-in
            </Button>
          </>
        )}

        {state === 'reauthorize' && (
          <>
            <div className="text-xs p-2 mb-3 rounded bg-ritemark-error-soft text-ritemark-error">
              <span className="flex items-center gap-1">
                <Icon name="warning" size={12} />
                Google needs you to sign in again{projection.email ? ` as ${projection.email}` : ''} before Ritemark can publish.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => send('google-docs/connect')} size="lg">
                Reconnect
              </Button>
              <Button onClick={() => send('google-docs/disconnect')} variant="secondary" size="lg">
                Disconnect
              </Button>
            </div>
          </>
        )}

        {state === 'connected' && (
          <>
            <div className="space-y-2 mb-3 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Account:</span>
                <span className="text-ink-strong font-mono truncate">{projection.email}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Template for new Google Docs:</span>
                <span className="text-ink-strong truncate">
                  {projection.template ? projection.template.name : 'None (Google Docs default styles)'}
                </span>
              </div>
            </div>

            {projection.choosingTemplate ? (
              <>
                <p className="text-xs text-ink-muted mb-3">
                  The Google file picker opened in your browser. Choose a Google Doc to use as the template.
                </p>
                <Button onClick={() => send('google-docs/cancel')} variant="secondary" size="lg">
                  Cancel
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => send('google-docs/choose-template')} variant="secondary" size="lg">
                  {projection.template ? 'Change template' : 'Choose template'}
                </Button>
                {projection.template && (
                  <Button onClick={() => send('google-docs/clear-template')} variant="secondary" size="lg">
                    Remove template
                  </Button>
                )}
                <Button onClick={() => send('google-docs/disconnect')} variant="secondary" size="lg">
                  Disconnect
                </Button>
              </div>
            )}
          </>
        )}

        {projection.message && (
          <div className="text-xs p-2 mt-3 rounded bg-ritemark-error-soft text-ritemark-error">
            <span className="flex items-center gap-1">
              <Icon name="x" size={12} /> {projection.message}
            </span>
          </div>
        )}

        {state !== 'unavailable' && (
          <p className="text-xs text-ink-muted mt-3">
            The template applies when a Google Doc is created. Sync replaces only the text of an existing Google Doc,
            so its header and styles stay. Disconnecting never deletes your Google Docs.{' '}
            <a href={PRIVACY_URL} className="text-accent-deep hover:underline">
              How Ritemark uses Google data
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
