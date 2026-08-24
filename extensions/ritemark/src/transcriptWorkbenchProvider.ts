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
import { probeDurationSec } from './speech/durationProbe';
import type { EngineId, TranscriptionJob } from './speech/types';
import { trackEvent } from './analytics/posthog';
import { saveTranscriptTo } from './speech/autoExport';
import { generateInsights, insightsWorkspacePath } from './speech/insights';
import { getSetupStatus } from './agent/setup';
import { resolveInsightsLanguage, type InsightsLanguageSelection } from './speech/insightsLanguage';
import {
  InsightsTargetError,
  insightsToMarkdown,
  normalizeInsightsTargetPath,
  suggestedInsightsFileName,
  validateInsightsTargetPath,
  writeInsightsDocumentExclusive,
} from './speech/insightsMarkdown';
import { normalizeSpeakerLabel } from './speech/speakerNames';
import {
  parseTranscriptWorkbenchRequest,
  type InsightsDocumentResult,
} from './speech/workbenchProtocol';

/** Remembers the folder chosen last time, so Save opens where they were. */
const LAST_SAVE_DIR_KEY = 'speech:lastSaveDir';
const LAST_INSIGHTS_SAVE_DIR_KEY = 'speech:lastInsightsSaveDir';

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
  /** In-flight insight runs, so a second click cancels rather than stacks. */
  private readonly _insightRuns = new Map<string, AbortController>();

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

    panel.webview.onDidReceiveMessage(async (rawMessage) => {
      let message;
      try {
        message = parseTranscriptWorkbenchRequest(rawMessage);
      } catch (error) {
        void panel.webview.postMessage({
          type: 'workbench:insightsState',
          state: 'failed',
          message: error instanceof Error ? error.message : 'Invalid workbench request.',
        });
        return;
      }
      switch (message.type) {
        case 'workbench:ready':
          await this._push(fsPath, panel);
          break;
        case 'workbench:transcribe':
          await this._startTranscription(fsPath, panel, message.engineId);
          break;
        case 'workbench:renameSpeaker':
          await this._renameSpeaker(fsPath, message.speakerId, message.label);
          break;
        case 'workbench:save':
          await this._save(fsPath, panel);
          break;
        case 'workbench:openDocument':
          await this._openDocument(fsPath, panel);
          break;
        case 'workbench:generateInsights':
          await this._generateInsights(fsPath, panel, message.language);
          break;
        case 'workbench:cancelInsights':
          this._insightRuns.get(fsPath)?.abort();
          break;
        case 'workbench:createInsightsDocument':
          await this._createInsightsDocument(fsPath, panel);
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

    const normalized = normalizeSpeakerLabel(label);
    if (!normalized) return;

    await this._store.save({
      ...session,
      speakers: session.speakers.map((speaker) =>
        speaker.id === speakerId ? { ...speaker, label: normalized } : speaker,
      ),
    });

    const panel = this._panels.get(fsPath);
    if (panel) await this._push(fsPath, panel);
  }

  /**
   * Start a transcription from the workbench.
   *
   * R4/N2: an upload needs informed consent, and it needs it HERE too. The
   * panel shows duration and cost before anything leaves the machine; a
   * "Transcribe with ElevenLabs" click in this tab must not be a quieter route
   * to the same upload.
   */
  private async _startTranscription(
    fsPath: string,
    panel: vscode.WebviewPanel,
    engineId: EngineId,
  ): Promise<void> {
    // Probed host-side so this produces the same metadata as the panel path.
    const durationSec = await probeDurationSec(fsPath);

    const engine = this._registry.get(engineId);
    if (!engine.isLocal) {
      const cost = durationSec === null ? null : engine.estimateCostUsd(durationSec);
      const length = durationSec === null ? 'This recording' : formatMinutes(durationSec);
      const price =
        cost === null
          ? 'ElevenLabs charges about $0.22 per hour; the length could not be read, so the cost cannot be estimated up front.'
          : `Estimated cost: $${cost.toFixed(2)}.`;

      const choice = await vscode.window.showWarningMessage(
        `Upload ${path.basename(fsPath)} to ${engine.label}?`,
        {
          modal: true,
          detail: `${length} of audio will be sent to ${engine.label} for transcription. ${price}\n\nOn-device transcription keeps the audio on this machine, but cannot separate speakers.`,
        },
        'Upload and transcribe',
      );
      if (choice !== 'Upload and transcribe') return;
    }

    this._jobs.enqueue({
      audioPath: fsPath,
      engineId,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
      durationSec: durationSec ?? 0,
      language: null,
    });
    await this._push(fsPath, panel);
  }

  /**
   * R10 — generate the summary/decisions/actions/quotes.
   *
   * Runs on the existing agent runtime and stores the result on the session, so
   * it survives reopening and reaches the saved document.
   */
  private async _generateInsights(
    fsPath: string,
    panel: vscode.WebviewPanel,
    selectedLanguage: InsightsLanguageSelection,
  ): Promise<void> {
    if (this._insightRuns.has(fsPath)) return;

    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session || session.segments.length === 0) return;

    const controller = new AbortController();
    this._insightRuns.set(fsPath, controller);
    void panel.webview.postMessage({ type: 'workbench:insightsState', state: 'generating' });

    try {
      const insights = await generateInsights({
        session,
        workspacePath: insightsWorkspacePath(session),
        language: {
          selected: selectedLanguage,
          resolved: resolveInsightsLanguage(selectedLanguage, session.language),
        },
        anthropicApiKey: await this._context.secrets.get('anthropic-api-key'),
        signal: controller.signal,
      });

      // Re-read: a speaker rename may have landed while the model was thinking.
      const latest = (await this._store.get(session.id)) ?? session;
      await this._store.save({ ...latest, insights });
      void panel.webview.postMessage({ type: 'workbench:insightsState', state: 'idle' });
    } catch (error) {
      void panel.webview.postMessage({
        type: 'workbench:insightsState',
        state: controller.signal.aborted ? 'idle' : 'failed',
        ...(controller.signal.aborted
          ? {}
          : { message: error instanceof Error ? error.message : 'Could not generate insights.' }),
      });
    } finally {
      this._insightRuns.delete(fsPath);
      await this._push(fsPath, panel);
    }
  }

  /** R3: create an Insights snapshot without entering the transcript save path. */
  private async _createInsightsDocument(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session?.insights) return;

    const remembered = this._context.globalState.get<string>(LAST_INSIGHTS_SAVE_DIR_KEY);
    const linkedDir = session.exportPath ? path.dirname(session.exportPath) : undefined;
    const fallback = linkedDir
      ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      ?? path.dirname(fsPath);
    const defaultDir = remembered && fs.existsSync(remembered) ? remembered : fallback;
    const suggestedName = suggestedInsightsFileName(session);

    for (;;) {
      const picked = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(defaultDir, suggestedName)),
        filters: { Markdown: ['md'] },
        saveLabel: 'Create insights document',
        title: 'Create insights document',
      });
      if (!picked) {
        this._postInsightsDocumentResult(panel, 'cancelled');
        return;
      }

      let target: string;
      try {
        target = normalizeInsightsTargetPath(picked.fsPath);
        await validateInsightsTargetPath(target, session.exportPath);
        await writeInsightsDocumentExclusive(target, insightsToMarkdown(session, session.insights));
      } catch (error) {
        if (
          error instanceof InsightsTargetError ||
          (error as NodeJS.ErrnoException).code === 'EEXIST'
        ) {
          await vscode.window.showWarningMessage(
            error instanceof InsightsTargetError
              ? error.message
              : 'Choose a new filename. Insights documents do not replace existing files.',
          );
          continue;
        }
        void vscode.window.showErrorMessage(
          `Could not create the Insights document: ${error instanceof Error ? error.message : 'Unknown write error.'}`,
        );
        this._postInsightsDocumentResult(panel, 'failed');
        return;
      }

      await this._context.globalState.update(LAST_INSIGHTS_SAVE_DIR_KEY, path.dirname(target));
      this._postInsightsDocumentResult(panel, 'success');
      void vscode.window.showInformationMessage(
        `Insights saved to ${path.basename(target)}.`,
        'Open',
      ).then((choice) => {
        if (choice === 'Open') {
          return vscode.commands.executeCommand('vscode.open', vscode.Uri.file(target), { preview: false });
        }
        return undefined;
      });
      return;
    }
  }

  private _postInsightsDocumentResult(
    panel: vscode.WebviewPanel,
    status: InsightsDocumentResult['status'],
  ): void {
    const message: InsightsDocumentResult = { type: 'workbench:insightsDocumentResult', status };
    void panel.webview.postMessage(message);
  }

  /**
   * R11 — save the transcript as a document the user owns.
   *
   * Asks where it goes. The transcript belongs to the user, so they choose the
   * folder rather than discovering it in one we picked; the choice is
   * remembered so the next save opens in the same place.
   *
   * Deliberately does NOT steal focus afterwards — the saved document stays
   * linked in the header, so it can be opened when wanted rather than now.
   */
  private async _save(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session) return;

    const remembered = this._context.globalState.get<string>(LAST_SAVE_DIR_KEY);
    const fallback = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(fsPath);
    const defaultDir = remembered && fs.existsSync(remembered) ? remembered : fallback;

    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(defaultDir),
      openLabel: 'Save here',
      title: `Save ${path.basename(fsPath)} transcript to…`,
    });
    if (!picked?.[0]) return;

    const dir = picked[0].fsPath;
    await this._context.globalState.update(LAST_SAVE_DIR_KEY, dir);

    const filePath = await saveTranscriptTo(this._store, session, dir);
    if (!filePath) return; // the user declined the overwrite
    void vscode.window.showInformationMessage(`Transcript saved to ${path.basename(filePath)}.`);
    await this._push(fsPath, panel);
  }

  /** Open the saved document. The link only exists when there is one. */
  private async _openDocument(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const session = await this._store.get(sessionIdForPath(fsPath));
    if (!session?.exportPath) return;

    if (!fs.existsSync(session.exportPath)) {
      // Moved or deleted since it was saved: say so and drop the stale link
      // rather than opening an editor onto nothing.
      void vscode.window.showWarningMessage(
        `${path.basename(session.exportPath)} is no longer where it was saved. Save it again to create a new copy.`,
      );
      await this._store.save({ ...session, exportPath: undefined });
      await this._push(fsPath, panel);
      return;
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(session.exportPath), { preview: false });
  }

  private async _push(fsPath: string, panel: vscode.WebviewPanel): Promise<void> {
    const [session, engines, runtimeReady] = await Promise.all([
      this._store.get(sessionIdForPath(fsPath)),
      this._registry.statuses(),
      // R10: with no runtime configured the rail explains what to set up
      // rather than offering a button that fails.
      getSetupStatus()
        .then((status) => status.authenticated)
        .catch(() => false),
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
        savedDocument:
          session?.exportPath && fs.existsSync(session.exportPath)
            ? { name: path.basename(session.exportPath), path: session.exportPath }
            : null,
        runtimeReady,
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

/** `47 min` / `1 h 12 min` — for a sentence the user reads before spending. */
function formatMinutes(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
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
