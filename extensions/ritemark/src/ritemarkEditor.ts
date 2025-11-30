import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class RiteMarkEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.editor',
      new RiteMarkEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Get URI for the webview bundle
    const scriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );

    // Get directory of the markdown file for local resource access
    const docDir = vscode.Uri.file(path.dirname(document.uri.fsPath));

    webviewPanel.webview.options = {
      enableScripts: true,
      enableForms: true,  // Enable form inputs and file handling
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        docDir  // Allow loading images from document directory
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, scriptUri);

    // Track if we're currently updating to prevent feedback loops
    let isUpdating = false;

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send the document content
            webviewPanel.webview.postMessage({
              type: 'load',
              content: document.getText()
            });
            return;

          case 'contentChanged':
            // Content changed in editor, update document
            if (!isUpdating) {
              this.updateDocument(document, message.content);
            }
            return;

          case 'saveImage':
            // Save image to ./images/ folder relative to markdown file
            this.saveImage(document, message.dataUrl, message.filename, webviewPanel);
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Update webview when document changes externally
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString() && !isUpdating) {
        isUpdating = true;
        webviewPanel.webview.postMessage({
          type: 'load',
          content: document.getText()
        });
        // Reset flag after a short delay
        setTimeout(() => { isUpdating = false; }, 100);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  private updateDocument(document: vscode.TextDocument, content: string): void {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );
    vscode.workspace.applyEdit(edit);
  }

  private async saveImage(
    document: vscode.TextDocument,
    dataUrl: string,
    filename: string,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Get directory of the markdown file
      const docDir = path.dirname(document.uri.fsPath);
      const imagesDir = path.join(docDir, 'images');

      // Create images folder if it doesn't exist
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Extract base64 data from data URL (format: data:image/png;base64,...)
      const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid image data URL');
      }

      const extension = matches[1];
      const base64Data = matches[2];

      // Ensure filename has correct extension
      const baseName = path.basename(filename, path.extname(filename));
      const finalFilename = `${baseName}.${extension}`;
      const imagePath = path.join(imagesDir, finalFilename);

      // Write image file
      fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));

      // Return relative path for markdown and webview URI for display
      const relativePath = `./images/${finalFilename}`;
      const webviewUri = webviewPanel.webview.asWebviewUri(
        vscode.Uri.file(imagePath)
      ).toString();

      // Send success response to webview with both paths
      webviewPanel.webview.postMessage({
        type: 'imageSaved',
        path: relativePath,        // For markdown storage
        displaySrc: webviewUri     // For editor display
      });
    } catch (error) {
      console.error('Failed to save image:', error);
      webviewPanel.webview.postMessage({
        type: 'imageError',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    // Get nonce for Content Security Policy
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
  <title>RiteMark</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body, #root {
      height: 100%;
      width: 100%;
      overflow: hidden;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #ffffff);
      color: var(--vscode-editor-foreground, #333333);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}">
    // Prevent VS Code from intercepting drops - let them through to our editor
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('drop', (e) => {
      // Don't prevent default here - let the editor handle it
      e.stopPropagation();
    });
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
