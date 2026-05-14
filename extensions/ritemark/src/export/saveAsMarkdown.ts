import * as vscode from 'vscode';
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
      for (const img of payload.images) {
        writeImageRelativeTo(imagesDir, img.filename, img.base64);
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to save as Markdown: ${message}`);
    webview.postMessage({
      type: 'saveAsMarkdownResult',
      success: false,
      error: message,
    } satisfies SaveAsMarkdownResult);
  }
}
