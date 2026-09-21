/**
 * Composes Google Docs publishing for the extension host (Sprint 119).
 *
 * Everything with behaviour lives in the vscode-free modules beside this one;
 * this file only supplies the real SecretStorage, global state, system
 * browser, native dialogs and webview transport. The editor provider and the
 * Settings page reach the feature through `googleDocs` exported from
 * `extension.ts`.
 */

import * as vscode from 'vscode';
import { resolveGoogleOAuthConfig } from './config';
import { GoogleAccountService } from './GoogleAccountService';
import { GoogleDocsBindingStore, googleDocsStoreDir } from './GoogleDocsBindingStore';
import { GoogleDocsController, type GoogleDocsUi } from './GoogleDocsController';
import { GoogleDocsPublisher } from './GoogleDocsPublisher';
import { GoogleOAuthFlow } from './oauth';
import type { GoogleDocsDocumentProjection, GoogleDocsSettingsProjection } from './types';

export interface GoogleDocsTransport {
  postToDocument(documentUri: string, projection: GoogleDocsDocumentProjection): void;
  openDocuments(): string[];
}

export interface GoogleDocsFeature {
  controller: GoogleDocsController;
  /** The editor provider plugs in here once it exists. */
  setDocumentTransport(transport: GoogleDocsTransport): void;
  /** The Settings page plugs in here while it is open. */
  setSettingsListener(listener: ((projection: GoogleDocsSettingsProjection) => void) | null): void;
}

export function createGoogleDocsFeature(
  context: vscode.ExtensionContext,
  isFeatureEnabled: () => boolean,
  log: (message: string) => void,
): GoogleDocsFeature {
  const config = resolveGoogleOAuthConfig();
  let documentTransport: GoogleDocsTransport | null = null;
  let settingsListener: ((projection: GoogleDocsSettingsProjection) => void) | null = null;

  const oauth = new GoogleOAuthFlow({
    // Absent config builds a flow that is never started: the controller
    // answers "unavailable in this build" before reaching it.
    config: config ?? { clientId: '', clientSecret: '' },
    openExternal: async (url) => vscode.env.openExternal(vscode.Uri.parse(url, true)),
  });
  const account = new GoogleAccountService({ secrets: context.secrets, state: context.globalState, oauth });
  const store = new GoogleDocsBindingStore(googleDocsStoreDir(context.globalStorageUri.fsPath));
  const publisher = new GoogleDocsPublisher({ account, store });

  const ui: GoogleDocsUi = {
    withProgress: (title, task) => Promise.resolve(vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: false },
      (progress) => task((message) => progress.report({ message })),
    )),
    confirm: async (message, detail, actions) => vscode.window.showWarningMessage(message, { modal: true, detail }, ...actions),
    info: async (message, actions = []) => vscode.window.showInformationMessage(message, ...actions),
    warn: async (message, actions = []) => vscode.window.showWarningMessage(message, ...actions),
    error: async (message, actions = []) => vscode.window.showErrorMessage(message, ...actions),
    openExternal: async (url) => vscode.env.openExternal(vscode.Uri.parse(url, true)),
    openSettings: () => { void vscode.commands.executeCommand('ritemark.aiSettings'); },
  };

  const controller = new GoogleDocsController({
    config,
    account,
    store,
    publisher,
    ui,
    isFeatureEnabled,
    postToDocument: (uri, projection) => documentTransport?.postToDocument(uri, projection),
    postSettings: (projection) => settingsListener?.(projection),
    openDocuments: () => documentTransport?.openDocuments() ?? [],
    log,
  });

  void account.load().catch((error: unknown) => log(`[googleDocs] could not read the stored account: ${String(error)}`));

  return {
    controller,
    setDocumentTransport: (transport) => { documentTransport = transport; },
    setSettingsListener: (listener) => { settingsListener = listener; },
  };
}
