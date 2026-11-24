import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import * as vscode from 'vscode';
import type { DocumentReadRequest, DocumentReadResult } from '../documents/documentRead';
import { samePath } from '../utils/pathIdentity';
import { resolveProjectDocument } from '../documents/projectPath';
import { findOpenForPassage, findRequests, type FindNavigation } from '../search/findAtPassage';
import type { SourcePassage, SourcePreview } from '../../webview/src/utils/sourcePassage';

export type ReadSource = (request: DocumentReadRequest) => Promise<DocumentReadResult>;

const projectOnly = 'Choose a source file inside the project folder.';
const sourceUnavailable = 'This source file could not be found or opened.';
const roots = () => (vscode.workspace.workspaceFolders ?? [])
  .filter(({ uri }) => uri.scheme === 'file').map(({ uri }) => uri.fsPath);

async function resolveSource(rawPath: string): Promise<{ path: string } | { error: string }> {
  const resolved = await resolveProjectDocument(rawPath, roots());
  if (!resolved.ok) return { error: resolved.reason === 'missing' ? sourceUnavailable : projectOnly };
  if (!(await stat(resolved.path).catch(() => null))?.isFile()) return { error: sourceUnavailable };
  return { path: resolved.path };
}

export async function previewSourcePassage(rawPath: string, passage: SourcePassage, read: ReadSource): Promise<SourcePreview> {
  const resolved = await resolveSource(rawPath);
  if ('error' in resolved) return resolved;
  try {
    const { location } = await read({ path: resolved.path, passage });
    const current = await resolveProjectDocument(rawPath, roots());
    if (!current.ok || !samePath(current.path, resolved.path)) return { error: projectOnly };
    const page = location?.page ?? passage.page;
    const unit = page ? `${extname(resolved.path).toLowerCase() === '.pptx' ? 'Slide' : 'Page'} ${page}` : undefined;
    const quote = location && 'text' in location ? location.displayText ?? location.text : undefined;
    return { name: basename(resolved.path), unit, quote, missing: !!passage.text && !quote };
  } catch {
    return { error: sourceUnavailable };
  }
}

export async function openSourcePassage(rawPath: string, passage: SourcePassage, read: ReadSource): Promise<string | undefined> {
  const resolved = await resolveSource(rawPath);
  if ('error' in resolved) {
    void vscode.window.showWarningMessage(resolved.error);
    return;
  }

  const extension = extname(resolved.path).toLowerCase();
  let navigation: FindNavigation | null = null;
  let missing = false;
  if (extension === '.pptx' && passage.page) {
    navigation = { type: 'find:slide', page: passage.page };
  } else if (extension === '.pdf' || (passage.text && ['.docx', '.md', '.markdown'].includes(extension))) {
    const { location } = await read({ path: resolved.path, passage });
    if (location) {
      navigation = 'text' in location
        ? findOpenForPassage(location.text, location.occurrence, location.page)
        : { type: 'find:page', page: location.page };
    }
    if (!navigation) {
      navigation = { type: 'find:top' };
      missing = !!passage.text;
    }
  }

  // Resolve again after an asynchronous read. The project or the link target may have changed.
  const current = await resolveProjectDocument(rawPath, roots());
  if (!current.ok || !samePath(current.path, resolved.path)) {
    void vscode.window.showWarningMessage('Choose a source file inside the project folder.');
    return;
  }
  const uri = vscode.Uri.file(resolved.path);
  await vscode.commands.executeCommand('vscode.open', uri);
  if (navigation) findRequests.request(uri.toString(), navigation);
  if (missing) void vscode.window.showInformationMessage("Couldn't find these words. Opened at the top.");
  return resolved.path;
}
