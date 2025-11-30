import * as vscode from 'vscode';

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
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(document.getText(), document.fileName);

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'update':
            this.updateDocument(document, message.content);
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Update webview when document changes externally
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        webviewPanel.webview.postMessage({
          type: 'update',
          content: document.getText()
        });
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

  private getHtml(content: string, fileName: string): string {
    const name = fileName.split('/').pop() || 'Untitled';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RiteMark</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
      border-radius: 6px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: var(--vscode-foreground, #cccccc);
    }
    .badge {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #ffffff);
      border-radius: 10px;
      margin-left: auto;
    }
    .file-name {
      font-size: 14px;
      color: var(--vscode-descriptionForeground, #8c8c8c);
      margin-bottom: 24px;
    }
    .content {
      background: var(--vscode-input-background, #252526);
      padding: 24px;
      border-radius: 8px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      white-space: pre-wrap;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 14px;
      min-height: 200px;
      max-height: 60vh;
      overflow-y: auto;
    }
    .info {
      margin-top: 24px;
      padding: 16px;
      background: var(--vscode-textBlockQuote-background, #2d2d2d);
      border-left: 3px solid #4285f4;
      border-radius: 0 4px 4px 0;
      font-size: 13px;
    }
    .info strong {
      color: #4285f4;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo"></div>
    <h1>RiteMark Editor</h1>
    <span class="badge">POC v0.1</span>
  </div>
  <div class="file-name">${this.escapeHtml(name)}</div>
  <div class="content">${this.escapeHtml(content)}</div>
  <div class="info">
    <strong>Prototype Mode</strong><br>
    This is the RiteMark editor proof-of-concept. Full WYSIWYG editing coming in Sprint 2.
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
