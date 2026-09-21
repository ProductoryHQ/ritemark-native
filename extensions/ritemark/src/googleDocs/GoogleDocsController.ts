/**
 * Google Docs publishing — the controller between webviews and the host
 * (Sprint 119, W5/W6).
 *
 * Webviews capture intent and render projections; this controller owns every
 * decision. Confirmations, progress and results use the host's native modal
 * dialogs and notifications (design decision 2026-09-21): they are accessible,
 * focus-safe and consistent, and they keep a second modal system out of the
 * editor webview.
 *
 * No `vscode` import — the UI, the webview transport and the feature flag are
 * injected, so the whole flow runs in Node tests. `vscodeGoogleDocs.ts`
 * composes it for the extension.
 */

import type { GoogleOAuthClientConfig } from './config';
import type { GoogleAccountService } from './GoogleAccountService';
import type { GoogleDocsBindingStore } from './GoogleDocsBindingStore';
import type { GoogleDocsPublisher, PublishOutcome, SkippedImage } from './GoogleDocsPublisher';
import { decodeEditorRequest, decodeSettingsRequest } from './protocol';
import {
  GOOGLE_DOCS_ERROR_COPY,
  GoogleDocsError,
  docUrlFor,
  type GoogleDocsBindingV1,
  type GoogleDocsDocumentProjection,
  type GoogleDocsSettingsProjection,
  type PublishStage,
} from './types';

export interface GoogleDocsUi {
  withProgress<T>(title: string, task: (report: (message: string) => void) => Promise<T>): Promise<T>;
  /** Native modal. Resolves with the chosen label, or undefined for Cancel. */
  confirm(message: string, detail: string, actions: string[]): Promise<string | undefined>;
  info(message: string, actions?: string[]): Promise<string | undefined>;
  warn(message: string, actions?: string[]): Promise<string | undefined>;
  error(message: string, actions?: string[]): Promise<string | undefined>;
  openExternal(url: string): Promise<boolean>;
  openSettings(): void;
}

export interface GoogleDocsDocumentContext {
  /** Canonical document URI (`file:` for anything publishable). */
  uri: string;
  /** Filesystem path, used to resolve relative images. */
  path: string;
  /** File name without extension, the default title of a new Doc. */
  baseName: string;
}

export interface GoogleDocsControllerDependencies {
  config: GoogleOAuthClientConfig | null;
  account: GoogleAccountService;
  store: GoogleDocsBindingStore;
  publisher: GoogleDocsPublisher;
  ui: GoogleDocsUi;
  isFeatureEnabled(): boolean;
  postToDocument(documentUri: string, projection: GoogleDocsDocumentProjection): void;
  postSettings(projection: GoogleDocsSettingsProjection): void;
  /** Every Markdown document currently open in an editor, for account changes. */
  openDocuments(): string[];
  log?(message: string): void;
}

const STAGE_LABELS: Record<PublishStage, string> = {
  preparing: 'Preparing document',
  'uploading-images': 'Uploading images',
  writing: 'Writing to Google Docs',
  verifying: 'Checking the result',
};

const HIDDEN: GoogleDocsDocumentProjection = {
  state: 'hidden', docUrl: null, title: null, lastSyncedAt: null, boundAccountEmail: null, stage: null,
};

function describeSkipped(skipped: SkippedImage[]): string {
  const names = skipped.slice(0, 3).map((s) => `${s.source.split(/[\\/]/).pop()} (${s.reason})`);
  const more = skipped.length > 3 ? ` and ${skipped.length - 3} more` : '';
  return `${skipped.length === 1 ? 'One image was' : `${skipped.length} images were`} not published: ${names.join('; ')}${more}.`;
}

export class GoogleDocsController {
  private readonly stages = new Map<string, PublishStage>();
  private settingsMessage: string | null = null;

  constructor(private readonly deps: GoogleDocsControllerDependencies) {
    deps.account.onDidChange(() => {
      this.pushSettings();
      for (const uri of deps.openDocuments()) void this.pushDocument(uri);
    });
  }

  // ---------------------------------------------------------------- projections

  settingsProjection(): GoogleDocsSettingsProjection {
    const enabled = this.deps.isFeatureEnabled();
    if (!this.deps.config) {
      return { enabled, state: 'unavailable', email: null, displayName: null, template: null, choosingTemplate: false, message: null };
    }
    const snap = this.deps.account.snapshot();
    return {
      enabled,
      state: snap.status,
      email: snap.identity?.email ?? null,
      displayName: snap.identity?.displayName ?? null,
      template: snap.template ? { name: snap.template.name } : null,
      choosingTemplate: snap.choosingTemplate,
      message: this.settingsMessage,
    };
  }

  async documentProjection(documentUri: string): Promise<GoogleDocsDocumentProjection> {
    if (!this.deps.isFeatureEnabled() || !documentUri.startsWith('file:')) return HIDDEN;
    if (!this.deps.config) return { ...HIDDEN, state: 'unavailable' };
    await this.deps.account.load();
    const binding = await this.deps.store.get(documentUri);
    const identity = this.deps.account.identity();
    const base: GoogleDocsDocumentProjection = {
      state: 'unbound',
      docUrl: binding ? docUrlFor(binding.fileId) : null,
      title: binding?.title ?? null,
      lastSyncedAt: binding?.lastSyncedAt ?? null,
      boundAccountEmail: binding?.accountEmail ?? null,
      stage: this.stages.get(documentUri) ?? null,
    };
    if (this.deps.publisher.isBusy(documentUri) || base.stage) return { ...base, state: 'busy' };
    if (!identity) return { ...base, state: 'not-connected' };
    if (!binding) return { ...base, state: 'unbound' };
    if (binding.accountId !== identity.accountId) return { ...base, state: 'account-mismatch' };
    return { ...base, state: 'bound' };
  }

  pushSettings(): void {
    this.deps.postSettings(this.settingsProjection());
  }

  async pushDocument(documentUri: string): Promise<void> {
    try {
      this.deps.postToDocument(documentUri, await this.documentProjection(documentUri));
    } catch (error) {
      this.deps.log?.(`[googleDocs] projection failed: ${String(error)}`);
    }
  }

  // ---------------------------------------------------------------- editor

  /** Returns true when the message was a `google-docs/*` editor message. */
  async handleEditorMessage(document: GoogleDocsDocumentContext, raw: unknown): Promise<boolean> {
    const request = decodeEditorRequest(raw);
    if (!request) return false;
    switch (request.type) {
      case 'google-docs/request-projection':
        await this.pushDocument(document.uri);
        return true;
      case 'google-docs/open-settings':
        this.deps.ui.openSettings();
        return true;
      case 'google-docs/open': {
        const binding = await this.deps.store.get(document.uri);
        if (binding) await this.deps.ui.openExternal(docUrlFor(binding.fileId));
        return true;
      }
      case 'google-docs/unlink':
        await this.unlink(document);
        return true;
      case 'google-docs/publish':
        await this.publish(document, request.html, request.title);
        return true;
    }
  }

  private async unlink(document: GoogleDocsDocumentContext): Promise<void> {
    const binding = await this.deps.store.get(document.uri);
    if (!binding) return;
    const choice = await this.deps.ui.confirm(
      'Remove this publishing link?',
      `Ritemark will forget that this file is published to "${binding.title}". The Google Doc is not deleted, and your Google account stays connected. You can create a new Google Doc from this file afterwards.`,
      ['Remove link'],
    );
    if (choice !== 'Remove link') return;
    await this.deps.store.remove(document.uri);
    await this.pushDocument(document.uri);
  }

  private async publish(document: GoogleDocsDocumentContext, html: string, title: string | null): Promise<void> {
    const { ui } = this.deps;
    if (!this.deps.isFeatureEnabled()) return;
    if (!this.deps.config) { await ui.error(GOOGLE_DOCS_ERROR_COPY['configuration-unavailable']); return; }
    if (!document.uri.startsWith('file:')) { await ui.warn(GOOGLE_DOCS_ERROR_COPY['untitled-document']); return; }

    await this.deps.account.load();
    const snap = this.deps.account.snapshot();
    if (!snap.identity) {
      if (await ui.warn('Connect a Google account to publish to Google Docs.', ['Open Settings']) === 'Open Settings') ui.openSettings();
      return;
    }
    if (snap.status === 'reauthorize') {
      if (await ui.warn(GOOGLE_DOCS_ERROR_COPY['reauthorization-required'], ['Open Settings']) === 'Open Settings') ui.openSettings();
      return;
    }

    const existing = await this.deps.store.get(document.uri);
    const progressTitle = existing ? 'Syncing Google Doc' : 'Creating Google Doc';
    let outcome: PublishOutcome | null = null;
    try {
      outcome = await ui.withProgress(progressTitle, (report) => this.deps.publisher.publish(
        { documentUri: document.uri, documentPath: document.path, html, title: (title || document.baseName).trim() || 'Untitled' },
        {
          confirmFirstSync: (binding) => this.confirmFirstSync(binding),
          confirmRemoteChanged: (binding) => this.confirmRemoteChanged(binding),
        },
        (stage) => {
          this.stages.set(document.uri, stage);
          report(STAGE_LABELS[stage]);
          void this.pushDocument(document.uri);
        },
      ));
    } catch (error) {
      await this.reportError(document, error);
    } finally {
      this.stages.delete(document.uri);
      await this.pushDocument(document.uri);
    }
    if (outcome) await this.reportOutcome(outcome);
  }

  private async confirmFirstSync(binding: GoogleDocsBindingV1): Promise<boolean> {
    const choice = await this.deps.ui.confirm(
      'Sync to Google Docs?',
      `This replaces the contents of "${binding.title}" with the current Ritemark version. Edits made directly in Google Docs will be overwritten.\n\nRitemark asks this once per document. After this, it warns you only if the Google Doc has been edited since your last Sync.`,
      ['Sync'],
    );
    return choice === 'Sync';
  }

  private async confirmRemoteChanged(binding: GoogleDocsBindingV1): Promise<boolean> {
    const choice = await this.deps.ui.confirm(
      'The Google Doc was edited after your last Sync',
      `Someone changed "${binding.title}" in Google Docs. Syncing replaces those changes with the current Ritemark version — Ritemark can't merge them.`,
      ['Overwrite with Ritemark', 'Open Google Doc'],
    );
    if (choice === 'Open Google Doc') await this.deps.ui.openExternal(docUrlFor(binding.fileId));
    return choice === 'Overwrite with Ritemark';
  }

  private async reportOutcome(outcome: PublishOutcome): Promise<void> {
    const { ui } = this.deps;
    if (outcome.kind === 'cancelled') return;
    const url = docUrlFor(outcome.binding.fileId);
    const message = outcome.kind === 'created'
      ? `Google Doc created: "${outcome.binding.title}". Future Syncs update this same document.`
      : outcome.kind === 'synced'
        ? `Google Doc synced: "${outcome.binding.title}".`
        : `"${outcome.binding.title}" is already up to date.`;
    const skipped = outcome.kind === 'up-to-date' ? [] : outcome.skippedImages;
    const choice = skipped.length
      ? await ui.warn(`${message} ${describeSkipped(skipped)}`, ['Open Google Doc'])
      : await ui.info(message, ['Open Google Doc']);
    if (choice === 'Open Google Doc') await ui.openExternal(url);
  }

  private async reportError(document: GoogleDocsDocumentContext, error: unknown): Promise<void> {
    const { ui } = this.deps;
    const e = error instanceof GoogleDocsError ? error : new GoogleDocsError('unexpected', String(error));
    this.deps.log?.(`[googleDocs] publish failed (${e.code}): ${e.message}`);
    if (e.code === 'cancelled') return;
    const copy = GOOGLE_DOCS_ERROR_COPY[e.code];
    switch (e.code) {
      case 'reauthorization-required':
      case 'account-mismatch':
      case 'template-unavailable':
      case 'not-connected':
        if (await ui.error(copy, ['Open Settings']) === 'Open Settings') ui.openSettings();
        return;
      case 'target-not-found':
      case 'target-trashed': {
        const actions = e.details.docUrl ? ['Open Google Doc', 'Remove publishing link'] : ['Remove publishing link'];
        const choice = await ui.error(copy, actions);
        if (choice === 'Open Google Doc' && e.details.docUrl) await ui.openExternal(e.details.docUrl);
        if (choice === 'Remove publishing link') await this.unlink(document);
        return;
      }
      case 'local-binding-failed':
      case 'verification-required': {
        const choice = await ui.error(copy, e.details.docUrl ? ['Open Google Doc'] : []);
        if (choice === 'Open Google Doc' && e.details.docUrl) await ui.openExternal(e.details.docUrl);
        return;
      }
      case 'rate-limited': {
        const wait = e.details.retryAfterSeconds ? ` Google asked to wait about ${e.details.retryAfterSeconds} seconds.` : '';
        await ui.error(`${copy}${wait}`);
        return;
      }
      default:
        await ui.error(copy);
    }
  }

  // ---------------------------------------------------------------- settings

  /** Returns true when the message was a `google-docs/*` Settings message. */
  async handleSettingsMessage(raw: unknown): Promise<boolean> {
    const request = decodeSettingsRequest(raw);
    if (!request) return false;
    if (!this.deps.config) { this.pushSettings(); return true; }
    this.settingsMessage = null;
    try {
      switch (request.type) {
        case 'google-docs/connect':
          await this.deps.account.connect();
          break;
        case 'google-docs/cancel':
          this.deps.account.cancel();
          break;
        case 'google-docs/disconnect':
          await this.deps.account.disconnect();
          break;
        case 'google-docs/choose-template':
          await this.deps.account.chooseTemplate();
          break;
        case 'google-docs/clear-template':
          await this.deps.account.clearTemplate();
          break;
      }
    } catch (error) {
      const e = error instanceof GoogleDocsError ? error : new GoogleDocsError('unexpected', String(error));
      this.deps.log?.(`[googleDocs] settings action failed (${e.code}): ${e.message}`);
      this.settingsMessage = e.code === 'cancelled' ? null
        : e.code === 'account-mismatch' ? 'That template was chosen in a different Google account. Choose it in the connected account.'
        : GOOGLE_DOCS_ERROR_COPY[e.code];
    }
    this.pushSettings();
    return true;
  }

  // ---------------------------------------------------------------- renames

  async documentRenamed(oldUri: string, newUri: string): Promise<void> {
    const outcome = await this.deps.store.rename(oldUri, newUri);
    if (outcome === 'collision') {
      // Two Google Docs now claim one path; Ritemark does not choose (R6).
      await this.deps.ui.warn('The renamed file already has its own Google Docs link, so the old link was not moved. Both Google Docs are unchanged.');
    }
    if (outcome !== 'none') await this.pushDocument(newUri);
  }
}
