/**
 * Sprint 108 R11 — saving a transcript as a document the user owns.
 *
 * Sessions live in the extension's global storage, which the user cannot see,
 * back up, or sync. Saving is therefore the act that makes the work theirs —
 * and because it is theirs, THEY choose where it goes (the folder picker lives
 * in the workbench provider; this module does the writing).
 */

import * as path from 'path';
import * as vscode from 'vscode';
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
 * Write the transcript into a folder the user picked.
 *
 * Re-saving updates the document they already know about; a first save never
 * clobbers an unrelated file that happens to share the name.
 */
export async function saveTranscriptTo(
  store: SessionStore,
  session: TranscriptSession,
  directory: string,
): Promise<string> {
  const savingOverPrevious = Boolean(
    session.exportPath && path.dirname(session.exportPath) === directory,
  );

  const result = await writeTranscriptMarkdown({
    session,
    workspaceRoot: undefined,
    // An absolute folder is honoured as-is by resolveExportDir.
    folderSetting: directory,
    collision: savingOverPrevious ? 'overwrite' : 'unique',
  });

  await store.save({ ...session, exportPath: result.filePath });
  return result.filePath;
}
