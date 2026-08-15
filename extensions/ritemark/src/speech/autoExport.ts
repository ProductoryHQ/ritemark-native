/**
 * Sprint 108 R11 — saving a transcript as a document the user owns.
 *
 * Sessions live in the extension's global storage, which the user cannot see,
 * back up, or sync. Saving is therefore the act that makes the work theirs —
 * and because it is theirs, THEY choose where it goes (the folder picker lives
 * in the workbench provider; this module does the writing).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { SessionStore } from './SessionStore';
import { DEFAULT_EXPORT_FOLDER, exportFileName, writeTranscriptMarkdown } from './exportTranscript';
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
): Promise<string | null> {
  const target = path.join(directory, exportFileName(session));

  // The document is the user's, and they may have edited it after saving.
  // Replacing it without asking destroys that work, so overwriting is always
  // an explicit choice — never inferred from "same folder as last time".
  let collision: 'overwrite' | 'unique' = 'unique';

  if (fs.existsSync(target)) {
    const choice = await vscode.window.showWarningMessage(
      `${path.basename(target)} already exists.`,
      {
        modal: true,
        detail:
          'Replacing it discards any edits you made to that document. Saving a copy keeps both.',
      },
      'Replace',
      'Save a copy',
    );
    if (!choice) return null;
    collision = choice === 'Replace' ? 'overwrite' : 'unique';
  }

  const result = await writeTranscriptMarkdown({
    session,
    workspaceRoot: undefined,
    // An absolute folder is honoured as-is by resolveExportDir.
    folderSetting: directory,
    collision,
    // 'overwrite' targets the session's remembered export; here the user chose
    // this folder and this name, so aim at exactly that file.
    overwriteTarget: target,
  });

  await store.save({ ...session, exportPath: result.filePath });
  return result.filePath;
}
