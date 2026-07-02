import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { writeImageRelativeTo } from '../utils/imageWriter';
import { trackEvent } from '../analytics/posthog';

export interface SaveAsMarkdownImage {
  filename: string;
  contentType: string;
  base64: string;
}

export interface SaveAsMarkdownPayload {
  markdown: string;
  defaultFilename: string;
  source: 'docx' | 'pdf';
  images?: SaveAsMarkdownImage[];
  warnings?: string[];
}

export interface SaveAsMarkdownResult {
  type: 'saveAsMarkdownResult';
  success: boolean;
  filename?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Save a converted markdown payload to disk via VS Code Save As dialog.
 * Writes extracted images to a sibling ./images/ folder using the same
 * sanitization as the paste-flow saveImage handler, opens the resulting .md
 * in Ritemark's editor, and posts a `saveAsMarkdownResult` message back to
 * the webview for the toast.
 */
export async function saveAsMarkdownHandler(
  payload: SaveAsMarkdownPayload,
  sourceUri: vscode.Uri,
  webview: vscode.Webview
): Promise<void> {
  const sourceDir = path.dirname(sourceUri.fsPath);
  const defaultUri = vscode.Uri.file(path.join(sourceDir, payload.defaultFilename));

  // Full paths of image files THIS save newly created — used to roll back on
  // failure so a partial save leaves no orphaned images behind (issue #76).
  // Pre-existing user files are never added here, so they are never removed.
  const createdImagePaths: string[] = [];

  try {
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { Markdown: ['md'] },
      saveLabel: 'Save as Markdown',
    });

    if (!saveUri) {
      webview.postMessage({
        type: 'saveAsMarkdownResult',
        success: false,
        error: 'cancelled',
      } satisfies SaveAsMarkdownResult);
      return;
    }

    const targetDir = path.dirname(saveUri.fsPath);

    if (payload.images && payload.images.length > 0) {
      const imagesDir = path.join(targetDir, 'images');
      // Snapshot what already lived in images/ so rollback only ever removes
      // files this save created, never the user's pre-existing images.
      const preExisting = fs.existsSync(imagesDir)
        ? new Set(fs.readdirSync(imagesDir))
        : new Set<string>();
      for (const img of payload.images) {
        // Webview's buildExtractedImageFilename already produced a canonical
        // `<sanitized>--image-N.ext`. Re-sanitizing here would collapse the
        // `--` separator and break the relative-path link in the saved .md.
        const written = writeImageRelativeTo(imagesDir, img.filename, img.base64, { skipSanitize: true });
        if (!preExisting.has(written)) {
          createdImagePaths.push(path.join(imagesDir, written));
        }
      }
    }

    await vscode.workspace.fs.writeFile(
      saveUri,
      Buffer.from(payload.markdown, 'utf8')
    );

    void trackEvent('feature_used', {
      feature: 'save_as_markdown',
      source: payload.source,
    });

    await vscode.commands.executeCommand(
      'vscode.openWith',
      saveUri,
      'ritemark.editor'
    );

    webview.postMessage({
      type: 'saveAsMarkdownResult',
      success: true,
      filename: path.basename(saveUri.fsPath),
      warnings: payload.warnings ?? [],
    } satisfies SaveAsMarkdownResult);
  } catch (error) {
    // Roll back any images this save created so a failed save leaves no partial
    // state on disk (issue #76). Best-effort — unlink errors must not mask the
    // original failure reported to the user.
    for (const imagePath of createdImagePaths) {
      try {
        fs.unlinkSync(imagePath);
      } catch {
        // ignore — file may already be gone or locked
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to save as Markdown: ${message}`);
    webview.postMessage({
      type: 'saveAsMarkdownResult',
      success: false,
      error: message,
    } satisfies SaveAsMarkdownResult);
  }
}
