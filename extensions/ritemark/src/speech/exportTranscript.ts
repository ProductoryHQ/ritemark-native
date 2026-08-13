/**
 * Sprint 108 R11 — writing the transcript out as Markdown.
 *
 * This is the load-bearing half of D5. Sessions live in hidden app storage, so
 * without an export the user's hour of corrections exists only somewhere they
 * cannot see, back up, or sync. Every completed transcription therefore writes
 * a Markdown file automatically — the session is the working copy, the .md is
 * the thing they own.
 *
 * Path resolution is pure and injected, so the "where does it land" rules can
 * be tested without a workspace.
 */

import { existsSync } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { sessionToMarkdown, exportFileName } from './transcriptMarkdown';
import type { TranscriptSession } from './types';

export const DEFAULT_EXPORT_FOLDER = 'Transcripts';

/**
 * Where a transcript should be written.
 *
 * With a workspace open: `<workspace>/<folder>/<name>.md`. Without one: beside
 * the recording, because a file the user cannot find is not an export. An
 * absolute folder setting is honoured as-is.
 */
export function resolveExportDir(options: {
  audioPath: string;
  workspaceRoot: string | undefined;
  folderSetting: string;
}): string {
  const folder = options.folderSetting.trim() || DEFAULT_EXPORT_FOLDER;

  if (path.isAbsolute(folder)) return folder;
  if (options.workspaceRoot) return path.join(options.workspaceRoot, folder);
  return path.dirname(options.audioPath);
}

/**
 * A path that will not clobber an existing file: `name.md`, then `name-2.md`.
 *
 * `exists` is injected so this can be tested, and so the auto-export path can
 * reuse it without a second implementation drifting away.
 */
export function uniqueExportPath(preferred: string, exists: (candidate: string) => boolean): string {
  if (!exists(preferred)) return preferred;

  const dir = path.dirname(preferred);
  const ext = path.extname(preferred);
  const base = path.basename(preferred, ext);

  for (let i = 2; i < 1000; i++) {
    const candidate = path.join(dir, `${base}-${i}${ext}`);
    if (!exists(candidate)) return candidate;
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

export interface ExportOptions {
  session: TranscriptSession;
  workspaceRoot: string | undefined;
  folderSetting: string;
  /**
   * 'overwrite' replaces the session's previous export (the manual button,
   * after the user has confirmed); 'unique' never touches an existing file
   * (the automatic export on completion, which must not silently replace
   * anything the user may have edited).
   */
  collision: 'overwrite' | 'unique';
}

export interface ExportResult {
  filePath: string;
  overwritten: boolean;
}

export async function writeTranscriptMarkdown(options: ExportOptions): Promise<ExportResult> {
  const dir = resolveExportDir({
    audioPath: options.session.audioPath,
    workspaceRoot: options.workspaceRoot,
    folderSetting: options.folderSetting,
  });
  await fsp.mkdir(dir, { recursive: true });

  const preferred = path.join(dir, exportFileName(options.session));

  let target = preferred;
  let overwritten = false;

  if (options.collision === 'overwrite') {
    // Re-exporting after corrections should update the file the user already
    // knows about, not scatter numbered siblings around their folder.
    target = options.session.exportPath ?? preferred;
    overwritten = await fileExists(target);
  } else {
    target = uniqueExportPath(preferred, existsSync);
  }

  await fsp.writeFile(target, sessionToMarkdown(options.session), 'utf-8');
  return { filePath: target, overwritten };
}

async function fileExists(candidate: string): Promise<boolean> {
  try {
    await fsp.access(candidate);
    return true;
  } catch {
    return false;
  }
}
