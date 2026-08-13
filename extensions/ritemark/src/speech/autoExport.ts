/**
 * Sprint 108 R11 — write a Markdown export as soon as a transcription finishes.
 *
 * This is what makes D5 safe. Sessions live in the extension's global storage,
 * which the user cannot see, back up, or sync; if the app is reinstalled, that
 * store goes with it. So every completed transcription immediately produces a
 * file in the workspace that the user owns outright.
 *
 * It never overwrites: an existing file might have been edited by hand, and
 * silently replacing a person's edits is worse than leaving a numbered sibling.
 */

import * as vscode from 'vscode';
import type { JobManager } from './JobManager';
import type { SessionStore } from './SessionStore';
import { DEFAULT_EXPORT_FOLDER, writeTranscriptMarkdown } from './exportTranscript';
import type { TranscriptSession } from './types';

export function exportFolderSetting(): string {
  return vscode.workspace
    .getConfiguration('ritemark')
    .get<string>('transcription.exportFolder', DEFAULT_EXPORT_FOLDER);
}

export function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Export a session and record where it went, so a later manual export updates
 * that same file instead of scattering siblings.
 */
export async function exportSession(
  store: SessionStore,
  session: TranscriptSession,
  collision: 'overwrite' | 'unique',
): Promise<string> {
  const result = await writeTranscriptMarkdown({
    session,
    workspaceRoot: workspaceRoot(),
    folderSetting: exportFolderSetting(),
    collision,
  });

  await store.save({ ...session, exportPath: result.filePath });
  return result.filePath;
}

export function registerAutoExport(jobs: JobManager, store: SessionStore): vscode.Disposable {
  const unsubscribe = jobs.onEvent((event) => {
    if (event.type !== 'job-completed') return;

    void exportSession(store, event.session, 'unique').catch((error) => {
      // A failed export must not look like a failed transcription — the
      // transcript is safe in the session store either way.
      console.warn('[Transcribe] Automatic export failed:', error);
    });
  });

  return { dispose: unsubscribe };
}
