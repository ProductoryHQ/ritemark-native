/**
 * Sprint 108 R1/R13 — the Transcribe activity-bar app.
 *
 * The sidebar is a launcher and a queue (Option B): it imports recordings,
 * shows engine state honestly, runs jobs and lists the library. The transcript
 * itself belongs to the workbench editor (Phase 4).
 *
 * Renders the React bundle via `data-editor-type="transcribe-panel"`, the same
 * route the AI sidebar and Flows panel use — so it gets the shadcn components
 * and Ritemark tokens instead of a second hand-rolled stylesheet.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { EngineRegistry } from '../speech/engineRegistry';
import type { JobManager } from '../speech/JobManager';
import type { SessionStore } from '../speech/SessionStore';
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, classifyInput } from '../speech/audioPrep';
import { probeDurationSec } from '../speech/durationProbe';
import { sessionIdForPath } from '../speech/SessionStore';
import { ensureModelDownloaded } from '../voiceDictation/modelManager';
import type { EngineId, TranscriptionJob, TranscriptSession } from '../speech/types';

/** What a row in the panel needs; deliberately not the whole session. */
interface RecordingSummary {
  sessionId: string;
  audioPath: string;
  audioName: string;
  durationSec: number;
  engine: EngineId;
  speakerCount: number;
  speakerSeparation: TranscriptSession['speakerSeparation'];
  createdAt: string;
  audioMissing: boolean;
  exportPath?: string;
}

/** A file the user picked but has not transcribed yet. */
interface PendingImport {
  audioPath: string;
  audioName: string;
  /** null when it genuinely could not be determined (see durationProbe). */
  durationSec: number | null;
  estimates: Array<{ engineId: string; costUsd: number | null }>;
}

export class TranscribeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.transcribeView';

  private _view: vscode.WebviewView | null = null;
  private _pending: PendingImport | null = null;
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _registry: EngineRegistry,
    private readonly _jobs: JobManager,
    private readonly _store: SessionStore,
    private readonly _memento: vscode.Memento,
  ) {
    // Jobs outlive the panel (R2), so the provider subscribes once and pushes
    // whatever the webview happens to be there to receive.
    this._disposables.push({
      dispose: this._jobs.onEvent((event) => {
        void this._pushState();
        if (event.type === 'job-completed') {
          void this._onJobCompleted(event.session);
        }
      }),
    });
  }

  dispose(): void {
    for (const disposable of this._disposables) disposable.dispose();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'transcribe:ready':
          void this._pushState();
          break;
        case 'transcribe:pickFile':
          void this._pickFile();
          break;
        case 'transcribe:importPath':
          void this._stageImport(message.path);
          break;
        case 'transcribe:clearPending':
          this._pending = null;
          void this._pushState();
          break;
        case 'transcribe:start':
          void this._start(message.engineId, message.language ?? null);
          break;
        case 'transcribe:cancel':
          this._jobs.cancel(message.jobId);
          break;
        case 'transcribe:openSession':
          void this._openSession(message.sessionId);
          break;
        case 'transcribe:deleteSession':
          void this._deleteSession(message.sessionId);
          break;
        case 'transcribe:relinkSession':
          void this._relinkSession(message.sessionId);
          break;
        case 'transcribe:openExport':
          void this._openExport(message.sessionId);
          break;
        case 'transcribe:downloadModel':
          // Reuses dictation's downloader — same model, same cache, resumable,
          // with the progress notification it already knows how to show.
          void ensureModelDownloaded().then(() => this._pushState());
          break;
        case 'transcribe:openSettings':
          void vscode.commands.executeCommand('ritemark.aiSettings');
          break;
        case 'transcribe:openIssue':
          void vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/ProductoryHQ/ritemark-native/issues/133'),
          );
          break;
      }
    });

    void this._pushState();
  }

  // ── import ────────────────────────────────────────────────────────────────

  private async _pickFile(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Add recording',
      filters: { Audio: AUDIO_EXTENSIONS.map((ext) => ext.slice(1)) },
    });
    if (picked?.[0]) await this._stageImport(picked[0].fsPath);
  }

  /**
   * Validate and measure a file, then hold it as "pending" until the user picks
   * an engine. Nothing runs and nothing uploads before that choice (R4/N2).
   */
  private async _stageImport(audioPath: string): Promise<void> {
    const kind = classifyInput(audioPath);

    if (kind !== 'audio') {
      this._post({
        type: 'transcribe:importRejected',
        fileName: path.basename(audioPath),
        reason:
          kind === 'video'
            ? 'Video files are not supported yet. Export the audio track as .m4a or .mp3 and try again.'
            : `Ritemark cannot read ${path.extname(audioPath) || 'that file type'} as audio. Supported: ${AUDIO_EXTENSIONS.join(', ')}.`,
      });
      return;
    }

    const durationSec = await probeDurationSec(audioPath);
    const estimates = this._registry.supported().map((engine) => ({
      engineId: engine.id,
      costUsd: durationSec === null ? null : engine.estimateCostUsd(durationSec),
    }));

    this._pending = {
      audioPath,
      audioName: path.basename(audioPath),
      durationSec,
      estimates,
    };
    await this._pushState();
  }

  private async _start(engineId: EngineId, language: string | null): Promise<void> {
    const pending = this._pending;
    if (!pending) return;

    this._pending = null;
    await this._memento.update('speech:lastEngineId', engineId);

    this._jobs.enqueue({
      audioPath: pending.audioPath,
      engineId,
      workspaceRoot: currentWorkspaceRoot(),
      // Unknown length is not a blocker: the engine reports the real duration
      // back, and 0 only affects a cost figure we already declined to invent.
      durationSec: pending.durationSec ?? 0,
      language,
    });
    await this._pushState();
  }

  // ── sessions ──────────────────────────────────────────────────────────────

  /** Opens the recording in the Transcript Workbench (R6). */
  private async _openSession(sessionId: string): Promise<void> {
    const session = await this._store.get(sessionId);
    if (!session) return;

    if (session.audioMissing || !fs.existsSync(session.audioPath)) {
      // R12: the transcript is still here; only the recording moved. Say that
      // rather than opening an editor onto a file that is not there.
      vscode.window.showWarningMessage(
        `${path.basename(session.audioPath)} is no longer at its recorded location. The transcript is kept.`,
      );
      return;
    }

    await vscode.commands.executeCommand(
      'vscode.openWith',
      vscode.Uri.file(session.audioPath),
      'ritemark.transcriptWorkbench',
    );
  }

  private async _deleteSession(sessionId: string): Promise<void> {
    const session = await this._store.get(sessionId);
    if (!session) return;

    const confirm = await vscode.window.showWarningMessage(
      `Remove the transcript for ${path.basename(session.audioPath)}?`,
      {
        modal: true,
        detail: 'The transcript, speaker names and corrections are deleted. The recording and any document you saved are not touched.',
      },
      'Remove transcript',
    );
    if (confirm !== 'Remove transcript') return;

    await this._store.delete(sessionId);
    await this._pushState();
  }

  /**
   * R12: point a session at a recording that moved.
   *
   * The transcript was never lost — only the path went stale — so this asks for
   * the file rather than offering to delete anything.
   */
  private async _relinkSession(sessionId: string): Promise<void> {
    const session = await this._store.get(sessionId);
    if (!session) return;

    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Relink recording',
      title: `Find ${path.basename(session.audioPath)}`,
      filters: { Audio: AUDIO_EXTENSIONS.map((ext) => ext.slice(1)) },
    });
    if (!picked?.[0]) return;

    await this._store.relink(sessionId, picked[0].fsPath);
    await this._pushState();
  }

  /**
   * Open the saved document, if the user has saved one.
   *
   * Saving happens in the workbench, where the folder is chosen — this never
   * writes a file behind the user's back.
   */
  private async _openExport(sessionId: string): Promise<void> {
    const session = await this._store.get(sessionId);
    if (!session?.exportPath || !fs.existsSync(session.exportPath)) {
      vscode.window.showInformationMessage(
        'This recording has not been saved as a document yet. Open it and choose Save to document.',
      );
      return;
    }
    await openInRitemark(session.exportPath);
  }

  private async _onJobCompleted(_session: TranscriptSession): Promise<void> {
    await this._pushState();
  }

  // ── state ─────────────────────────────────────────────────────────────────

  private async _pushState(): Promise<void> {
    if (!this._view) return;

    const [engines, sessions] = await Promise.all([
      this._registry.statuses(),
      // Project-scoped: the store is global (D5), but a folder must not show
      // another project's recordings.
      this._store.listForWorkspace(currentWorkspaceRoot()),
    ]);

    const jobs = this._jobs.list();
    const activeJobPaths = new Set(
      jobs.filter((job) => isActive(job)).map((job) => job.audioPath),
    );

    const recordings: RecordingSummary[] = sessions.map((session) => ({
      sessionId: session.id,
      audioPath: session.audioPath,
      audioName: path.basename(session.audioPath),
      durationSec: session.durationSec,
      engine: session.engine,
      speakerCount: session.speakers.length,
      speakerSeparation: session.speakerSeparation,
      createdAt: session.createdAt,
      audioMissing: session.audioMissing === true,
      ...(session.exportPath ? { exportPath: session.exportPath } : {}),
    }));

    const lastEngineId = this._memento.get<string>('speech:lastEngineId');
    const preferred = await this._registry.preferred(lastEngineId);

    this._post({
      type: 'transcribe:state',
      data: {
        engines,
        jobs,
        recordings,
        pending: this._pending,
        preferredEngineId: preferred?.id ?? null,
        platform: process.platform,
        acceptedExtensions: AUDIO_EXTENSIONS,
        videoExtensions: VIDEO_EXTENSIONS,
      },
    });

    // The badge is the whole reason a long job can be left alone (R2).
    //
    // Cleared with `{ value: 0 }` rather than `undefined`, which looks wrong but
    // is the only thing that works: `WebviewViewPane.updateBadge` (upstream)
    // stores the new badge and then only registers an activity `if (badge)` —
    // it never clears the previous activity, so `undefined` leaves a stale
    // count on the activity bar forever. A zero NumberBadge is registered and
    // then hidden by the renderer's `if (total > 0)` check, which clears it.
    //
    // Deliberately not fixed with a VS Code patch: `patches/` is shell-tier, so
    // a three-line upstream fix would turn this sprint into a full app rebuild
    // and notarization for a cosmetic badge.
    const running = jobs.filter((job) => isActive(job)).length;
    this._view.badge =
      running > 0 ? { value: running, tooltip: `${running} transcribing` } : { value: 0, tooltip: '' };
  }

  private _post(message: unknown): void {
    void this._view?.webview.postMessage(message);
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data:;">
  <title>Transcribe</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background) !important;
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="transcribe-panel"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/** The folder a recording belongs to, or null when none is open. */
function currentWorkspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
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

/**
 * Open a Markdown file the way a user expects — in Ritemark's editor.
 *
 * `showTextDocument` would force the plain text editor and show the transcript
 * as raw syntax, which is the opposite of why the export exists.
 */
async function openInRitemark(filePath: string): Promise<void> {
  await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), { preview: false });
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

export { sessionIdForPath };
