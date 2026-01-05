import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import matter from 'gray-matter';
import type { AIViewProvider } from './ai/AIViewProvider';

// Properties type for front-matter
export interface DocumentProperties {
  [key: string]: unknown;
}

export class RiteMarkEditorProvider implements vscode.CustomTextEditorProvider {
  // Track all active webview panels for broadcasting tool execution
  private static activeWebviews: Set<vscode.Webview> = new Set();
  private static _aiViewProvider: AIViewProvider | null = null;
  private static _wordCountStatusBar: vscode.StatusBarItem | null = null;

  public static register(
    context: vscode.ExtensionContext,
    aiViewProvider: AIViewProvider
  ): vscode.Disposable {
    RiteMarkEditorProvider._aiViewProvider = aiViewProvider;

    // Create word count status bar item (to the left of AI status, priority 101)
    RiteMarkEditorProvider._wordCountStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      101 // Higher priority = more to the left
    );
    RiteMarkEditorProvider._wordCountStatusBar.name = 'RiteMark Word Count';
    RiteMarkEditorProvider._wordCountStatusBar.text = '0 words';
    RiteMarkEditorProvider._wordCountStatusBar.tooltip = 'Word count';
    context.subscriptions.push(RiteMarkEditorProvider._wordCountStatusBar);

    return vscode.window.registerCustomEditorProvider(
      'ritemark.editor',
      new RiteMarkEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  /**
   * Execute AI tool in all active editor webviews
   * Called from AI panel via command
   */
  public static executeAITool(data: {
    toolName: string;
    args: Record<string, unknown>;
    selection: { text: string; isEmpty: boolean; from: number; to: number };
  }) {
    // Broadcast to all active webviews
    for (const webview of RiteMarkEditorProvider.activeWebviews) {
      webview.postMessage({
        type: 'ai-widget',
        toolName: data.toolName,
        args: data.args,
        selection: data.selection
      });
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Transform relative image paths in markdown to webview URIs
   * Returns both the original content and a mapping of relative paths to webview URIs
   */
  private transformImagePaths(
    markdown: string,
    documentUri: vscode.Uri,
    webview: vscode.Webview
  ): Record<string, string> {
    const imageMappings: Record<string, string> = {};
    const docDir = path.dirname(documentUri.fsPath);

    // Match markdown images: ![alt](path)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = imageRegex.exec(markdown)) !== null) {
      const imagePath = match[2];

      // Only process relative paths (starting with ./ or ../)
      if (!imagePath.startsWith('./') && !imagePath.startsWith('../')) {
        continue;
      }

      // Skip if already mapped
      if (imageMappings[imagePath]) {
        continue;
      }

      // Resolve relative path to absolute
      const absolutePath = path.resolve(docDir, imagePath);

      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        // Convert to webview URI
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.file(absolutePath)
        ).toString();

        imageMappings[imagePath] = webviewUri;
      }
    }

    return imageMappings;
  }

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

    // Add this webview to active set for AI tool broadcasts
    RiteMarkEditorProvider.activeWebviews.add(webviewPanel.webview);

    // Show word count status bar when RiteMark editor is opened
    RiteMarkEditorProvider._wordCountStatusBar?.show();

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send the document content with properties
            const parsed = this.extractFrontMatter(document.getText());
            // Transform image paths to webview URIs for display
            const imageMappings = this.transformImagePaths(
              parsed.content,
              document.uri,
              webviewPanel.webview
            );
            webviewPanel.webview.postMessage({
              type: 'load',
              content: parsed.content,
              properties: parsed.properties,
              hasProperties: parsed.hasProperties,
              imageMappings: imageMappings
            });
            return;

          case 'contentChanged':
            // Content changed in editor, update document with front-matter
            if (!isUpdating) {
              const fullContent = this.serializeFrontMatter(
                message.properties as DocumentProperties | undefined,
                message.content as string
              );
              this.updateDocument(document, fullContent);
            }
            return;

          case 'propertiesChanged':
            // Properties changed without content change, update document
            if (!isUpdating) {
              const currentParsed = this.extractFrontMatter(document.getText());
              const newContent = this.serializeFrontMatter(
                message.properties as DocumentProperties,
                currentParsed.content
              );
              this.updateDocument(document, newContent);
            }
            return;

          case 'saveImage':
            // Save image to ./images/ folder relative to markdown file
            this.saveImage(document, message.dataUrl, message.filename, webviewPanel);
            return;

          case 'selectionChanged':
            // Forward selection and document content to AI panel
            if (RiteMarkEditorProvider._aiViewProvider) {
              RiteMarkEditorProvider._aiViewProvider.sendSelection(
                message.selection,
                document.getText()
              );
            }
            return;

          case 'ai-configure-key':
            // Open settings to configure API key
            vscode.commands.executeCommand('workbench.action.openSettings', 'ritemark.openaiApiKey');
            return;

          case 'wordCountChanged':
            // Update word count in status bar
            if (RiteMarkEditorProvider._wordCountStatusBar) {
              const count = message.wordCount || 0;
              RiteMarkEditorProvider._wordCountStatusBar.text = `${count} ${count === 1 ? 'word' : 'words'}`;
            }
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
        const parsed = this.extractFrontMatter(document.getText());
        // Transform image paths to webview URIs for display
        const mappings = this.transformImagePaths(
          parsed.content,
          document.uri,
          webviewPanel.webview
        );
        webviewPanel.webview.postMessage({
          type: 'load',
          content: parsed.content,
          properties: parsed.properties,
          hasProperties: parsed.hasProperties,
          imageMappings: mappings
        });
        // Reset flag after a short delay
        setTimeout(() => { isUpdating = false; }, 100);
      }
    });

    webviewPanel.onDidDispose(() => {
      // Remove from active set
      RiteMarkEditorProvider.activeWebviews.delete(webviewPanel.webview);
      changeDocumentSubscription.dispose();

      // Hide word count if no more RiteMark editors are open
      if (RiteMarkEditorProvider.activeWebviews.size === 0) {
        RiteMarkEditorProvider._wordCountStatusBar?.hide();
      }
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

  /**
   * Extract front-matter (YAML) from markdown content
   */
  private extractFrontMatter(rawContent: string): {
    content: string;
    properties: DocumentProperties;
    hasProperties: boolean;
  } {
    try {
      const parsed = matter(rawContent);
      return {
        content: parsed.content,
        properties: parsed.data as DocumentProperties,
        hasProperties: Object.keys(parsed.data).length > 0
      };
    } catch {
      // If parsing fails, return content as-is with empty properties
      return {
        content: rawContent,
        properties: {},
        hasProperties: false
      };
    }
  }

  /**
   * Serialize properties and content back to markdown with front-matter
   */
  private serializeFrontMatter(
    properties: DocumentProperties | undefined,
    content: string
  ): string {
    // If no properties or empty properties, return content only
    if (!properties || Object.keys(properties).length === 0) {
      return content;
    }

    // Use gray-matter to stringify with YAML front-matter
    return matter.stringify(content, properties);
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
