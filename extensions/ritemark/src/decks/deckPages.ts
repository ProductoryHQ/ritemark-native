/**
 * deckPages — a `.deck.md` opened as a deck in the Ritemark editor (Sprint 157, experience 46).
 *
 * The deck is a path-based mode of the one Markdown editor, as card pages and agent files are, not a second editor:
 * VS Code's save-conflict and reload-merge hand-off (patch 014) covers only `ritemark.editor`, so a deck keeps saving,
 * conflicts, the writer's-copy merge and undo exactly as a document does. This is the host's side of the mode:
 *   - which documents open as decks (the flag, a file on disk, the name, and a deck version this build reads);
 *   - the deck view's `deck/*` requests, decoded with exact fields and answered to that one webview.
 *
 * With the flag off nothing here applies: a `.deck.md` opens as an ordinary document, its slide blocks as code.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { isRelativeImagePath } from '../utils/imagePaths';
import { deckModeOf } from './deckMode';
import { isThemePath } from './deckTheme';
import { decodeDeckRequest, DeckProtocolError, type DeckHostMessage, type DeckRequest } from './deckProtocol';

export class DeckPages {
  /** Does this document open as a deck? */
  deckModeFor(document: vscode.TextDocument): boolean {
    return deckModeOf({ flagOn: isEnabled('decks'), scheme: document.uri.scheme, fsPath: document.uri.fsPath, text: document.getText() });
  }

  /** One request from a deck view; the answer goes to that webview only. */
  async handle(document: vscode.TextDocument, webview: vscode.Webview, message: unknown): Promise<void> {
    if (!this.deckModeFor(document)) return;
    let request: DeckRequest;
    try {
      request = decodeDeckRequest(message);
    } catch (error) {
      if (error instanceof DeckProtocolError) {
        console.warn('[Decks] Dropped a malformed request:', error.message);
        return;
      }
      throw error;
    }
    switch (request.type) {
      case 'deck/assets':
        await this.post(webview, { type: 'deck/assets', assets: resolveAssets(document, webview, request.paths) });
        return;
      case 'deck/theme':
        await this.post(webview, { type: 'deck/theme', path: request.path, text: await readTheme(document, request.path) });
        return;
    }
  }

  private async post(webview: vscode.Webview, message: DeckHostMessage): Promise<void> {
    try {
      await webview.postMessage(message);
    } catch {
      // The view closed meanwhile.
    }
  }
}

/**
 * The slides' pictures as webview URIs: only relative paths beside the deck that name a file (the same test the
 * editor's Markdown images use), each with its modified time so a changed picture is drawn again.
 */
function resolveAssets(document: vscode.TextDocument, webview: vscode.Webview, paths: string[]): Record<string, string> {
  const assets: Record<string, string> = {};
  const folder = path.dirname(document.uri.fsPath);
  for (const relative of paths) {
    if (!isRelativeImagePath(relative) || assets[relative]) continue;
    const absolute = path.resolve(folder, relative);
    try {
      const stat = fs.statSync(absolute);
      if (!stat.isFile()) continue;
      assets[relative] = `${webview.asWebviewUri(vscode.Uri.file(absolute)).toString()}?v=${Math.round(stat.mtimeMs)}`;
    } catch {
      // No such picture: the slide draws its empty picture place.
    }
  }
  return assets;
}

/** A theme file is front matter only: anything larger than this is not one. */
const MAX_THEME_BYTES = 64 * 1024;

/**
 * The text of the theme file a deck names, or null. The path is project-relative (`Slide library/Themes/…`), so it is
 * read from the deck's project folder, or the deck's own folder when it has none, and never from outside it.
 */
async function readTheme(document: vscode.TextDocument, themePath: string): Promise<string | null> {
  if (!isThemePath(themePath)) return null;
  const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
  const absolute = path.resolve(root, themePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  try {
    // A link inside the project that points out of it is not followed.
    const [realRoot, realFile] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(absolute)]);
    const realRelative = path.relative(realRoot, realFile);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) return null;
    const stat = await fs.promises.stat(realFile);
    if (!stat.isFile() || stat.size > MAX_THEME_BYTES) return null;
    return await fs.promises.readFile(realFile, 'utf8');
  } catch {
    return null;
  }
}
