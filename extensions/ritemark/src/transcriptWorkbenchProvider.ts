/**
 * Sprint 108 R6 — the Transcript Workbench editor.
 *
 * Opening an audio file — from the Transcribe panel or straight from the
 * Explorer — opens this instead of a bare player: waveform, speaker-separated
 * transcript, click-a-line-to-hear-it.
 *
 * `CustomReadonlyEditorProvider` over the AUDIO file (the `pdfEditorProvider`
 * shape), not a text editor over a transcript: the recording is the document,
 * and the transcript is state attached to it. Unlike the PDF provider this
 * never reads the file into memory — an hour of audio is tens of megabytes and
 * the webview streams it by URI (audit A3 confirmed range requests are served).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { EngineRegistry } from './speech/engineRegistry';
import type { JobManager } from './speech/JobManager';
import type { SessionStore } from './speech/SessionStore';
import { sessionIdForPath } from './speech/SessionStore';
import type { EngineId, TranscriptionJob } from './speech/types';
import { trackEvent } from './analytics/posthog';
import { exportSession } from './speech/autoExport';

class AudioDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {
    /* nothing held open — the webview streams the file by URI */
  }
}

export class TranscriptWorkbenchProvider implements vscode.CustomReadonlyEditorProvider<AudioDocument> {
  public static readonly viewType = 'ritemark.transcriptWorkbench';

  private readonly _panels = new Map<string, vscode.WebviewPanel>();
  private readonly _jobSubscription: () => void;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _registry: EngineRegistry,
    private readonly _jobs: JobManager,
    private readonly _store: SessionStore,
  ) {
    // One subscription for every open workbench: a job started from the panel
    // must light up the tab that is showing that recording.
    this._jobSubscription = this._jobs.onEvent(() => {
      for (const [fsPath, panel] of this._panels) {
        void this._push(fsPath, panel);
      }
    });
  }

  dispose(): void {
    this._jobSubscription();
  }

  openCustomDocument(uri: vscode.Uri): AudioDocument {
    return new AudioDocument(uri);
  }

  async resolveCustomEditor(document: AudioDocument, panel: vscode.WebviewPanel): Promise<void> {
    void trackEvent('feature_used', { feature: 'transcript_workbench' });

    const fsPath = document.uri.fsPath;
    this._panels.set(fsPath, panel);

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, 'media'),
        // The recording's own folder, or the <audio> element cannot load it.
        vscode.Uri.file(path.dirname(fsPath)),
      ],
    };
    panel.webview.html = this._getHtml(panel.webview, document.uri);

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'workbench:ready':
          await this._push(fsPath, panel);
          break;
        case 'workbench:transcribe':
          this._jobs.enqueue({
            audioPath: fsPath,
            engineId: message.engineId as EngineId,
            durationSec: typeof message.durationSec === 'number' ? message.durationSec : 0,
            language: null,
          });
          await this._push(fsPath, panel);
          break;
        case 'workbench:renameSpeaker':
          await this._renameSpeaker(fsPath, message.speakerId, message.label);
          break;
        case 'workbench:export':
          await this._export(fsPath, panel);
          break;
        case 'workbench:openSettings':
          await vscode.commands.executeCommand('ritemark.aiSettings');
          break;
      }
    });

    panel.onDidDispose(() => {
      this._panels.delete(fsPath);
    });
  }

  /**
   * R8: renaming is a session-level edit, applied once and persisted, so every
   * segment and every future export agree without touching the transcript text.
   */
  private async _renameSpeaker(fsPath: string, speakerId: string, label: string): Promise<void> {
    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session) return;

    const trimmed = String(label ?? '').trim();
    if (!trimmed) return;

    await this._store.save({
      ...session,
      speakers: session.speakers.map((speaker) =>
        speaker.id === speakerId ? { ...speaker, label: trimmed } : speaker,
      ),
    });

    const panel = this._panels.get(fsPath);
    if (panel) await this._push(fsPath, panel);
  }

  /**
   * R11 — export after corrections.
   *
   * An export already exists (written automatically when the transcription
   * finished), so this asks before replacing it: the user may have edited that
   * file, and their edits are not ours to discard.
   */
  private async _export(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session) return;

    let collision: 'overwrite' | 'unique' = 'unique';

    if (session.exportPath && fs.existsSync(session.exportPath)) {
      const choice = await vscode.window.showWarningMessage(
        `Update ${path.basename(session.exportPath)}?`,
        {
          modal: true,
          detail: 'The existing Markdown export will be replaced with the current transcript, including any speaker names you have changed.',
        },
        'Replace',
        'Save a copy',
      );
      if (!choice) return;
      collision = choice === 'Replace' ? 'overwrite' : 'unique';
    }

    const filePath = await exportSession(this._store, session, collision);
    // `vscode.open`, not `showTextDocument`: the latter forces the plain text
    // editor, and the whole point of exporting is to land in Ritemark's visual
    // markdown editor rather than in a wall of syntax.
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), { preview: false });
    await this._push(fsPath, panel);
  }

  private async _push(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const [session, engines] = await Promise.all([
      this._store.get(sessionIdForPath(fsPath)),
      this._registry.statuses(),
    ]);

    const job = this._jobs
      .list()
      .find((candidate) => candidate.audioPath === fsPath && isActive(candidate));

    void panel.webview.postMessage({
      type: 'workbench:state',
      data: {
        audioUri: panel.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString(),
        audioName: path.basename(fsPath),
        session,
        job: job ?? null,
        engines,
        hasExport: Boolean(session?.exportPath && fs.existsSync(session.exportPath)),
      },
    });
  }

  private _getHtml(webview: vscode.Webview, audioUri: vscode.Uri): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview.js'),
    );
    void audioUri;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data:; media-src ${webview.cspSource} blob:;">
  <title>Transcript</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="transcript-workbench"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function isActive(job: TranscriptionJob): boolean {
  return (
    job.state === 'queued' ||
    job.state === 'preparing' ||
    job.state === 'uploading' ||
    job.state === 'transcribing' ||
    job.state === 'saving'
  );
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
