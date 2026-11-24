import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import * as vscode from 'vscode';
import type { DocumentReadRequest, DocumentReadResult } from '../documents/documentRead';
import { samePath } from '../utils/pathIdentity';
import { resolveProjectDocument } from '../documents/projectPath';
import { findOpenForPassage, findRequests, type FindNavigation } from '../search/findAtPassage';
import type { SourcePassage } from '../../webview/src/utils/sourcePassage';

export type ReadSource = (request: DocumentReadRequest) => Promise<DocumentReadResult>;

export async function openSourcePassage(rawPath: string, passage: SourcePassage, read: ReadSource): Promise<void> {
  const roots = () => (vscode.workspace.workspaceFolders ?? [])
    .filter(({ uri }) => uri.scheme === 'file').map(({ uri }) => uri.fsPath);
  const resolved = await resolveProjectDocument(rawPath, roots());
  if (!resolved.ok || !(await stat(resolved.path).catch(() => null))?.isFile()) {
    void vscode.window.showWarningMessage(resolved.ok || resolved.reason === 'missing'
      ? 'This source file could not be found or opened.'
      : 'Choose a source file inside the project folder.');
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
}
