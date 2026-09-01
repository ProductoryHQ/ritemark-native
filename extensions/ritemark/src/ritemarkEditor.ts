import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { parseFrontmatterFromText, serializeFrontmatter, discoverCommands } from './agent/discovery';
import matter from 'gray-matter';
import type { UnifiedViewProvider } from './views/UnifiedViewProvider';
import { exportToPDFV2 } from './export/v2/pdfHtmlExporter';
import { exportToWordV2 } from './export/v2/wordHtmlExporter';
import { saveAsMarkdownHandler, type SaveAsMarkdownPayload } from './export/saveAsMarkdown';
import { DictationController } from './voiceDictation/controller';
import { isEnabled } from './features';
import { isAppInstalled, openInExternalApp, openCsvInExcelWithHints, getSpreadsheetAppName, openMicrophoneSettings } from './utils/openExternal';
import { writeImageRelativeTo, parseImageDataUrl } from './utils/imageWriter';
import { trackEvent } from './analytics/posthog';
import { resolveInternalLinkTarget, isMarkdownFile } from './internalLinkResolver';
import {
  buildWorkspaceFileLinkResult,
  isSearchableFile,
  shouldSkipWorkspacePath,
  sortWorkspaceFileResults,
  type WorkspaceFileLinkResult,
} from './workspaceFileLinks';
import { DocumentSyncCoordinator } from './editorSync/DocumentSyncCoordinator';
import type { DocumentEditPayload, DocumentRenderPayload, DocumentSyncBootstrap } from './editorSync/protocol';
import { versionedWebviewAssetUri } from './views/webviewAssetUri';

// Properties type for front-matter
export interface DocumentProperties {
  [key: string]: unknown;
}

interface SearchWorkspaceFilesMessage {
  type: 'searchWorkspaceFiles';
  requestId?: string;
  query?: string;
  limit?: number;
}

function buildCsvTemplate(columns = 10, rows = 20): string {
  const headers = Array.from({ length: columns }, (_, index) => String.fromCharCode(65 + index)).join(',');
  const emptyRows = Array.from({ length: rows }, () => ','.repeat(columns - 1));
  return `${headers}\n${emptyRows.join('\n')}`;
}

// Sprint 82 R5: find a unique diagram.drawio.svg filename in the given directory
function getUniqueDrawioPath(dir: string): string {
  const base = path.join(dir, 'diagram.drawio.svg');
  if (!fs.existsSync(base)) {
    return base;
  }
  let i = 2;
  while (fs.existsSync(path.join(dir, `diagram-${i}.drawio.svg`))) {
    i++;
  }
  return path.join(dir, `diagram-${i}.drawio.svg`);
}

// Sprint 82 R5: minimal empty .drawio.svg — an SVG whose `content` attribute
// holds an uncompressed empty mxfile, the format draw.io itself exports.
// Verified to load and round-trip in the Phase 0 audit harness.
const EMPTY_DRAWIO_SVG_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="1px" height="1px" viewBox="0 0 1 1" content="&lt;mxfile&gt;&lt;diagram id=&quot;ritemark-diagram&quot; name=&quot;Page-1&quot;&gt;&lt;mxGraphModel dx=&quot;800&quot; dy=&quot;600&quot; grid=&quot;1&quot; gridSize=&quot;10&quot; guides=&quot;1&quot; tooltips=&quot;1&quot; connect=&quot;1&quot; arrows=&quot;1&quot; fold=&quot;1&quot; page=&quot;1&quot; pageScale=&quot;1&quot; pageWidth=&quot;850&quot; pageHeight=&quot;1100&quot; math=&quot;0&quot; shadow=&quot;0&quot;&gt;&lt;root&gt;&lt;mxCell id=&quot;0&quot;/&gt;&lt;mxCell id=&quot;1&quot; parent=&quot;0&quot;/&gt;&lt;/root&gt;&lt;/mxGraphModel&gt;&lt;/diagram&gt;&lt;/mxfile&gt;"><defs/><g/></svg>';

export class RitemarkEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ritemark.editor';

  // Track all active webview panels for broadcasting tool execution
  private static activeWebviews: Set<vscode.Webview> = new Set();

  /**
   * Sprint 105 (#165): push a comment-task status update to every open editor
   * webview. Each editor filters by its own documentPath, so broadcasting is
   * safe and avoids a path→webview registry.
   */
  public static broadcastCommentTaskStatus(payload: {
    documentPath: string; commentIds: string[]; status: 'queued' | 'running' | 'done' | 'failed' | 'cleared';
  }): void {
    for (const webview of RitemarkEditorProvider.activeWebviews) {
      webview.postMessage({ type: 'comment:task-status', ...payload }).then(undefined, () => {});
    }
  }

  /** Resolvers for insertDiagram waiting on the webview's imageInserted ack. */
  private pendingInsertAcks: Map<string, () => void> = new Map();
  private static _unifiedViewProvider: UnifiedViewProvider | null = null;
  private static _wordCountStatusBar: vscode.StatusBarItem | null = null;

  private readonly documentSync: DocumentSyncCoordinator;

  // Voice dictation controller
  private dictationController: DictationController | null = null;

  public static register(
    context: vscode.ExtensionContext,
    unifiedViewProvider: UnifiedViewProvider
  ): vscode.Disposable {
    RitemarkEditorProvider._unifiedViewProvider = unifiedViewProvider;

    // Create word count status bar item (to the left of AI status, priority 101)
    RitemarkEditorProvider._wordCountStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      101 // Higher priority = more to the left
    );
    RitemarkEditorProvider._wordCountStatusBar.name = 'Ritemark Word Count';
    RitemarkEditorProvider._wordCountStatusBar.text = '0 words';
    RitemarkEditorProvider._wordCountStatusBar.tooltip = 'Word count';
    context.subscriptions.push(RitemarkEditorProvider._wordCountStatusBar);

    return vscode.window.registerCustomEditorProvider(
      RitemarkEditorProvider.viewType,
      new RitemarkEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
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
    for (const webview of RitemarkEditorProvider.activeWebviews) {
      webview.postMessage({
        type: 'ai-widget',
        toolName: data.toolName,
        args: data.args,
        selection: data.selection
      });
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.documentSync = new DocumentSyncCoordinator(context, {
      buildPayload: (document, webview) => this.buildSyncPayload(document, webview),
      serializeEdit: (document, payload) => this.serializeSyncEdit(document, payload),
    });
  }

  /**
   * Determine file type from extension
   */
  private getFileType(filePath: string): 'markdown' | 'csv' | 'xlsx' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') return 'csv';
    if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
    return 'markdown';
  }

  /**
   * Build load message payload based on file type
   */
  private buildLoadMessage(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Record<string, unknown> {
    const filePath = document.uri.fsPath;
    const fileType = this.getFileType(filePath);
    const filename = path.basename(filePath);

    if (fileType === 'xlsx') {
      // Excel: bypass TextDocument, read binary directly and Base64 encode
      const buffer = fs.readFileSync(filePath);
      return {
        type: 'load',
        fileType: 'xlsx',
        filename,
        content: buffer.toString('base64'),
        encoding: 'base64',
        sizeBytes: buffer.length
      };
    }

    if (fileType === 'csv') {
      // CSV: use TextDocument content (UTF-8 text)
      const content = document.getText();
      return {
        type: 'load',
        fileType: 'csv',
        filename,
        content,
        sizeBytes: Buffer.byteLength(content, 'utf8')
      };
    }

    // Markdown: existing flow with added fields
    const parsed = this.extractFrontMatter(document.getText());
    const imageMappings = this.transformImagePaths(
      parsed.content,
      document.uri,
      webview
    );

    const isAgentMode = /[\/\\]\.claude[\/\\]agents[\/\\][^\/\\]+\.md$/.test(filePath);
    const agentFields: Record<string, unknown> = {};

    if (isAgentMode) {
      const fm = parseFrontmatterFromText(document.getText());
      const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
      const flowsDir = workspaceRoot ? path.join(workspaceRoot, '.ritemark', 'flows') : null;

      let flowStems: string[] = [];
      if (flowsDir) {
        try {
          const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.flow.json'));
          flowStems = files.map(f => path.basename(f, '.flow.json'));
        } catch { /* no flows dir */ }
      }

      const skills = discoverCommands(workspaceRoot).filter(c => c.source === 'skills');

      agentFields.isAgentMode = true;
      agentFields.agentFrontmatter = fm;
      agentFields.agentFlows = flowStems;
      agentFields.agentSkills = skills;
    }

    return {
      type: 'load',
      fileType: 'markdown',
      filename,
      content: parsed.content,
      properties: parsed.properties,
      hasProperties: parsed.hasProperties,
      imageMappings,
      features: {
        voiceDictation: isEnabled('voice-dictation'),
        markdownExport: isEnabled('markdown-export'),
        saveAsMarkdownFromPreview: isEnabled('save-as-markdown-from-preview'),
        commentCallouts: isEnabled('comment-callouts')
      },
      ...agentFields,
    };
  }

  private buildSyncPayload(document: vscode.TextDocument, webview: vscode.Webview): DocumentRenderPayload {
    const message = this.buildLoadMessage(document, webview);
    const { type: _type, ...payload } = message;
    return payload as DocumentRenderPayload;
  }

  private serializeSyncEdit(document: vscode.TextDocument, payload: DocumentEditPayload): string {
    const fileType = this.getFileType(document.uri.fsPath);
    if (payload.fileType !== fileType) {
      throw new Error('Document edit file type does not match the open editor.');
    }
    return payload.fileType === 'markdown'
      ? this.serializeFrontMatter(payload.properties, payload.content)
      : payload.content;
  }

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
        // Convert to webview URI. The mtime version param busts the webview's
        // cache when the file content changed since the last render (pairs
        // with the live 'imageRefreshed' watcher in resolveCustomTextEditor).
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.file(absolutePath)
        ).toString();
        let version = '';
        try { version = `?v=${Math.round(fs.statSync(absolutePath).mtimeMs)}`; } catch { /* keep unversioned */ }
        imageMappings[imagePath] = `${webviewUri}${version}`;
      }
    }

    return imageMappings;
  }

  private async handleSearchWorkspaceFiles(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    message: SearchWorkspaceFilesMessage
  ): Promise<void> {
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    const query = typeof message.query === 'string' ? message.query : '';
    const limit = Math.max(1, Math.min(50, Number(message.limit) || 20));

    if (document.isUntitled || document.uri.scheme !== 'file' || !document.uri.fsPath) {
      void webview.postMessage({
        type: 'workspaceFileSearchResults',
        requestId,
        results: [],
        unavailableReason: 'Save this document before linking local files.',
      });
      return;
    }

    try {
      const results = await this.searchWorkspaceFiles(document.uri.fsPath, query, limit);
      void webview.postMessage({
        type: 'workspaceFileSearchResults',
        requestId,
        results,
      });
    } catch (error) {
      console.warn('[Ritemark] Workspace file search failed:', error);
      void webview.postMessage({
        type: 'workspaceFileSearchResults',
        requestId,
        results: [],
        unavailableReason: 'File search is unavailable right now.',
      });
    }
  }

  private async searchWorkspaceFiles(
    documentPath: string,
    query: string,
    limit: number
  ): Promise<WorkspaceFileLinkResult[]> {
    const candidates: WorkspaceFileLinkResult[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    if (workspaceFolders.length > 0) {
      const uris = await vscode.workspace.findFiles(
        '**/*',
        '{**/.git/**,**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/.next/**,**/.turbo/**,**/coverage/**,**/VSCode-*/**,**/*.app/**}',
        1200
      );

      for (const uri of uris) {
        if (uri.scheme !== 'file') continue;
        const filePath = uri.fsPath;
        if (filePath === documentPath) continue;
        if (!isSearchableFile(filePath) || shouldSkipWorkspacePath(filePath)) continue;

        const workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
        candidates.push(buildWorkspaceFileLinkResult(documentPath, filePath, workspaceRoot));
      }
    } else {
      candidates.push(...this.findNearbyFiles(path.dirname(documentPath), documentPath, 1200));
    }

    return sortWorkspaceFileResults(candidates, query).slice(0, limit);
  }

  private findNearbyFiles(
    rootDir: string,
    documentPath: string,
    maxFiles: number
  ): WorkspaceFileLinkResult[] {
    const results: WorkspaceFileLinkResult[] = [];
    const stack = [rootDir];

    while (stack.length > 0 && results.length < maxFiles) {
      const currentDir = stack.pop();
      if (!currentDir || shouldSkipWorkspacePath(currentDir)) continue;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const filePath = path.join(currentDir, entry.name);
        if (shouldSkipWorkspacePath(filePath)) continue;

        if (entry.isDirectory()) {
          stack.push(filePath);
          continue;
        }

        if (!entry.isFile() || filePath === documentPath || !isSearchableFile(filePath)) {
          continue;
        }

        results.push(buildWorkspaceFileLinkResult(documentPath, filePath, rootDir));
        if (results.length >= maxFiles) break;
      }
    }

    return results;
  }

  private openSafeExternalTarget(rawUrl: unknown): void {
    if (typeof rawUrl !== 'string') return;

    const trimmed = rawUrl.trim();
    if (!trimmed) return;

    let externalUrl = trimmed;
    if (/^https?:\/\//i.test(trimmed)) {
      externalUrl = trimmed.replace(/^HTTPS?:\/\//i, match => match.toLowerCase());
    } else if (/^[^\s@/]+\.[^\s@/]+/.test(trimmed) && !trimmed.includes('/') && !trimmed.startsWith('.')) {
      externalUrl = `https://${trimmed}`;
    } else {
      return;
    }

    try {
      const parsed = vscode.Uri.parse(externalUrl);
      if (parsed.scheme === 'http' || parsed.scheme === 'https') {
        void vscode.env.openExternal(parsed);
      }
    } catch {
      // Ignore malformed external targets. Relative document links are handled in-editor.
    }
  }

  /**
   * Sprint 72 R7: open the file pointed to by an internal Markdown link.
   *
   * The webview posts this when the user Cmd/Ctrl-clicks a link whose
   * `classifyLinkTarget(href).kind === 'internal'`. We resolve the target
   * relative to the sending document, validate workspace containment via
   * `resolveInternalLinkTarget`, and either open the file or surface a
   * non-blocking notification.
   */
  private async openInternalLink(document: vscode.TextDocument, rawHref: unknown): Promise<void> {
    if (typeof rawHref !== 'string') return;
    const href = rawHref.trim();
    if (!href) return;
    if (document.uri.scheme !== 'file') {
      // We can only resolve relative paths against on-disk documents.
      void vscode.window.showWarningMessage(
        'Save this document to disk before following internal links.'
      );
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const result = await resolveInternalLinkTarget({
      documentPath: document.uri.fsPath,
      href,
      workspaceFolderPath: workspaceFolder?.uri.fsPath,
    });

    if (result.rejection === 'out-of-workspace') {
      const scope = result.containmentScope === 'workspace' ? 'workspace' : 'current document folder';
      void vscode.window.showWarningMessage(
        `Link target is outside the ${scope}: ${href}`
      );
      return;
    }

    if (result.rejection === 'not-found') {
      void vscode.window.showInformationMessage(`File not found: ${href}`);
      return;
    }

    const targetUri = vscode.Uri.file(result.realPath);
    try {
      if (isMarkdownFile(result.realPath)) {
        // Dispatch through Ritemark's custom editor so navigation feels
        // continuous within the app. The viewType (`ritemark.editor`)
        // matches the registration in `package.json` — using anything
        // else (e.g. `ritemark.markdownEditor`) silently falls back to
        // VS Code's default text editor.
        await vscode.commands.executeCommand(
          'vscode.openWith',
          targetUri,
          'ritemark.editor'
        );
      } else {
        // Defer to VS Code's default opener for everything else.
        await vscode.commands.executeCommand('vscode.open', targetUri);
      }
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Could not open ${href}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    if (document.isUntitled && this.getFileType(document.uri.fsPath) === 'csv' && document.getText().trim().length === 0) {
      await this.initializeUntitledCsv(document);
    }

    // Track which editor type was opened
    void trackEvent('feature_used', {
      feature: this.getFileType(document.uri.fsPath) === 'csv' ? 'csv_editor' : 'editor',
    });

    // Get URI for the webview bundle. Append a `?v=<mtime>` cache-buster (same
    // trick as image resources) so a rebuilt bundle is actually reloaded — the
    // webview otherwise serves a cached copy across window reloads.
    const scriptPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js');
    const scriptBaseUri = webviewPanel.webview.asWebviewUri(scriptPath).toString();
    const scriptUri = versionedWebviewAssetUri(scriptBaseUri, scriptPath.fsPath);

    // Debug logging for Windows path issues
    console.log('[Ritemark] Extension URI:', this.context.extensionUri.toString());
    console.log('[Ritemark] Script path:', scriptPath.toString());
    console.log('[Ritemark] Script URI:', scriptUri.toString());

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

    const syncBootstrap = this.documentSync.prepareView(document, webviewPanel);
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, scriptUri, syncBootstrap);

    // Track if webview is disposed to prevent accessing disposed webview
    let isDisposed = false;

    // Store reference to webview before it might get disposed
    const webview = webviewPanel.webview;

    // Add this webview to active set for AI tool broadcasts
    RitemarkEditorProvider.activeWebviews.add(webview);

    // Show word count status bar only for markdown files
    const fileType = this.getFileType(document.uri.fsPath);
    if (fileType === 'markdown') {
      RitemarkEditorProvider._wordCountStatusBar?.show();
    }

    // Sprint 82 polish: when an image file under the document's folder changes
    // on disk (e.g. a .drawio.svg saved from the diagram editor), refresh the
    // embedded image in place. The webview swaps the matching image node's src
    // for a cache-busted URI; the markdown itself is untouched (turndown
    // serializes from the title attribute, which keeps the relative path).
    const imageWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(docDir, '**/*.{png,jpg,jpeg,gif,svg,webp}')
    );
    imageWatcher.onDidChange((uri) => {
      if (isDisposed) { return; }
      const rel = path.relative(path.dirname(document.uri.fsPath), uri.fsPath).split(path.sep).join('/');
      if (!document.getText().includes(rel)) { return; }
      void webview.postMessage({
        type: 'imageRefreshed',
        path: `./${rel}`,
        displaySrc: `${webview.asWebviewUri(uri).toString()}?v=${Date.now()}`
      });
    });

    // Handle messages from the webview
    webview.onDidReceiveMessage(
      message => {
        // Don't process messages if webview is disposed
        if (isDisposed) {
          return;
        }

        if (this.documentSync.handles(message)) {
          this.documentSync.handle(document, webview, message);
          return;
        }

        // Gate all dictation messages with a single check
        if (message.type.startsWith('dictation:') && !isEnabled('voice-dictation')) {
          // Don't respond to stop/cancel with error - prevents infinite loop
          if (message.type === 'dictation:stop') {
            return;
          }
          webview.postMessage({ type: 'dictation:error', error: 'Voice dictation is not available' });
          return;
        }

        switch (message.type) {
          case 'ready':
            // Legacy/non-editable viewers do not participate in document sync.
            webview.postMessage(this.buildLoadMessage(document, webview));
            return;

          case 'searchWorkspaceFiles':
            void this.handleSearchWorkspaceFiles(document, webview, message as SearchWorkspaceFilesMessage);
            return;

          case 'contentChanged': {
            // Legacy fallback for viewers without the Sprint 115 sync bootstrap.
            const fileType = this.getFileType(document.uri.fsPath);
            if (fileType === 'markdown') {
              const fullContent = this.serializeFrontMatter(
                message.properties as DocumentProperties | undefined,
                message.content as string
              );
              this.updateDocument(document, fullContent);
            } else if (fileType === 'csv') {
              this.updateDocument(document, message.content as string);
            }
            return;
          }

          case 'propertiesChanged':
            if (this.getFileType(document.uri.fsPath) === 'markdown') {
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
            this.saveImage(document, message.dataUrl, message.filename, webview);
            return;

          case 'selectImageFile':
            // Open file picker for image selection
            this.selectImageFile(document, webview);
            return;

          case 'resizeImage':
            // Resize image file (user confirmed resize in webview)
            this.resizeImage(document, message.relativePath, message.dataUrl);
            return;

          case 'insertDiagram':
            // Sprint 82 R5: create a new .drawio.svg in ./images/ and open its editor
            this.insertDiagram(document, webview);
            return;

          case 'imageInserted':
            // Webview confirms an imageSaved insert reached the editor doc
            this.pendingInsertAcks.get(message.path)?.();
            return;

          case 'openDrawioDiagram':
            // Sprint 82 R4: click-to-edit a draw.io diagram from the markdown preview
            this.openDrawioDiagram(document, message.relativePath);
            return;

          case 'selectionChanged':
            // Forward selection and document content to AI panel
            if (RitemarkEditorProvider._unifiedViewProvider) {
              RitemarkEditorProvider._unifiedViewProvider.sendSelection(
                message.selection,
                document.getText()
              );
            }
            return;

          // ===== Voice Dictation Handlers =====
          case 'dictation:prepare':
            // Check if model is downloaded, show download dialog if not
            this.handlePrepareDictation(webview, message.language as string);
            return;

          case 'dictation:start':
            // Start voice dictation
            if (!this.dictationController) {
              this.dictationController = new DictationController(webview, this.context);
            }
            this.dictationController.startDictation(message.language as string || 'en');
            return;

          case 'dictation:audioChunk':
            // Handle incoming audio chunk (base64 WAV)
            if (this.dictationController) {
              this.dictationController.handleAudioChunk(message.audio as string);
            }
            return;

          case 'dictation:stop':
            // Stop voice dictation and get transcription
            if (this.dictationController) {
              this.dictationController.stopDictation();
            }
            return;

          case 'dictation:getModelStatus':
            this.getModelStatus(webview);
            return;

          case 'dictation:removeModel':
            this.removeModel(webview);
            return;
          // ===== End Voice Dictation =====

          case 'system:openMicSettings':
            openMicrophoneSettings();
            return;

          case 'ai-configure-key':
            // Open settings to configure API key
            vscode.commands.executeCommand('workbench.action.openSettings', 'ritemark.openaiApiKey');
            return;

          case 'comment:send-to-ai': {
            // Sprint 94 (#81): relay an agent-assigned comment to the AI sidebar.
            // Sprint 105 (#164/#165): carry the stable comment ids + document
            // path so the sidebar can correlate queue/task status back here.
            // Lazy require avoids a load-time circular import with ./extension.
            const agentId = message.agentId as string | undefined;
            const prompt = message.prompt as string | undefined;
            if (agentId && prompt) {
              const ext = require('./extension') as typeof import('./extension');
              ext.unifiedViewProvider?.submitCommentPrompt(agentId, prompt, {
                commentIds: Array.isArray(message.commentIds) ? message.commentIds as string[] : undefined,
                documentPath: vscode.workspace.asRelativePath(document.uri, false),
              });
            }
            return;
          }

          case 'wordCountChanged':
            // Update word count in status bar
            if (RitemarkEditorProvider._wordCountStatusBar) {
              const count = message.wordCount || 0;
              RitemarkEditorProvider._wordCountStatusBar.text = `${count} ${count === 1 ? 'word' : 'words'}`;
            }
            return;

          case 'exportPDF':
            // Export document to PDF (V2 HTML contract with markdown fallback)
            void trackEvent('feature_used', { feature: 'export_pdf' });
            exportToPDFV2(
              {
                html: (message.html as string) || '',
                markdownFallback: (message.content as string) || '',
                properties: (message.properties as DocumentProperties) || {},
                templateId: message.templateId as string | undefined,
              },
              document.uri
            );
            return;

          case 'exportWord':
            // Export document to Word (V2 HTML contract with markdown fallback)
            void trackEvent('feature_used', { feature: 'export_word' });
            exportToWordV2(
              {
                html: (message.html as string) || '',
                markdownFallback: (message.markdown as string) || (message.content as string) || '',
                properties: (message.properties as DocumentProperties) || {},
                templateId: message.templateId as string | undefined,
              },
              document.uri
            );
            return;

          case 'saveAsMarkdown':
            // Save converted markdown payload (from DOCX/PDF preview) to disk.
            void saveAsMarkdownHandler(
              message.payload as SaveAsMarkdownPayload,
              document.uri,
              webview
            );
            return;

          case 'mermaid:downloadImage':
            // Save mermaid diagram PNG via OS Save As dialog (same pattern as exportWord).
            void trackEvent('feature_used', { feature: 'mermaid_download' });
            this.downloadMermaidImage(
              document,
              (message.dataUrl as string) || '',
              (message.filename as string) || 'mermaid-diagram.png'
            );
            return;

          case 'checkExcel':
            // Check if Excel is installed
            this.checkExcelInstalled().then(hasExcel => {
              if (!isDisposed) {
                webview.postMessage({
                  type: 'excelStatus',
                  hasExcel
                });
              }
            });
            return;

          case 'openInExternalApp':
            // Open file in external app (Excel or Numbers)
            const app = message.app as string;
            this.openInExternalApp(document.uri.fsPath, app);
            return;

          case 'openExternal':
            // Open only explicit external browser targets.
            this.openSafeExternalTarget(message.url);
            return;

          case 'openInternalLink':
            // Sprint 72 R7: Cmd/Ctrl-click on an internal Markdown link.
            // Resolve relative to this document, enforce workspace
            // containment, and dispatch to Ritemark (for .md) or VS Code's
            // default opener (everything else).
            if (typeof message.href === 'string') {
              void this.openInternalLink(document, message.href);
            }
            return;

          case 'copyToClipboard':
            if (typeof message.text === 'string') {
              void vscode.env.clipboard.writeText(message.text);
            }
            return;

          case 'readClipboard':
            void vscode.env.clipboard.readText().then((text) => {
              void webview.postMessage({ type: 'clipboardText', text });
            });
            return;

          case 'applyFrontmatter': {
            // Agent mode: write updated frontmatter back to file, preserve body
            const currentParsed = this.extractFrontMatter(document.getText());
            const newYaml = serializeFrontmatter(message.frontmatter);
            const newFull = newYaml + '\n' + currentParsed.content;
            this.updateDocument(document, newFull);
            return;
          }

          case 'createAgentFlow': {
            void (async () => {
              const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
              if (!workspaceRoot || !message.name) return;
              const flowsDir = path.join(workspaceRoot, '.ritemark', 'flows');
              try {
                await fsp.mkdir(flowsDir, { recursive: true });
                const stem = String(message.name).replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
                const flowPath = path.join(flowsDir, `${stem}.flow.json`);
                if (!fs.existsSync(flowPath)) {
                  await fsp.writeFile(flowPath, JSON.stringify({ id: stem, name: message.name, nodes: [], edges: [] }, null, 2));
                }
                const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.flow.json'));
                void webview.postMessage({ type: 'agentFlowsUpdated', flows: files.map(f => path.basename(f, '.flow.json')) });
              } catch { /* ignore */ }
            })();
            return;
          }
        }
      },
      undefined,
      this.context.subscriptions
    );

    webviewPanel.onDidDispose(() => {
      // Mark as disposed FIRST to prevent any message handlers from running
      isDisposed = true;

      // Remove from active set using stored reference
      RitemarkEditorProvider.activeWebviews.delete(webview);
      imageWatcher.dispose();
      this.documentSync.disposeView(document, webview);

      // Hide word count if no more Ritemark editors are open
      if (RitemarkEditorProvider.activeWebviews.size === 0) {
        RitemarkEditorProvider._wordCountStatusBar?.hide();
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
    void vscode.workspace.applyEdit(edit);
  }

  private async initializeUntitledCsv(document: vscode.TextDocument): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = document.lineAt(Math.max(0, document.lineCount - 1));
    edit.replace(document.uri, new vscode.Range(new vscode.Position(0, 0), lastLine.range.end), buildCsvTemplate());
    await vscode.workspace.applyEdit(edit);
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

  private async downloadMermaidImage(
    document: vscode.TextDocument,
    dataUrl: string,
    filename: string
  ): Promise<void> {
    try {
      const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        vscode.window.showErrorMessage('Mermaid download failed: invalid image data');
        return;
      }
      const ext = matches[1];
      const base64Data = matches[2];

      const docName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
      const safeName = filename || `${docName}-mermaid.${ext}`;
      const defaultUri = vscode.Uri.file(
        path.join(path.dirname(document.uri.fsPath), safeName)
      );

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { [`${ext.toUpperCase()} Image`]: [ext] },
        title: 'Save mermaid diagram',
        saveLabel: 'Save',
      });
      if (!saveUri) return;

      fs.writeFileSync(saveUri.fsPath, Buffer.from(base64Data, 'base64'));
    } catch (error) {
      console.error('Failed to download mermaid image:', error);
      vscode.window.showErrorMessage(
        `Failed to save mermaid diagram: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async saveImage(
    document: vscode.TextDocument,
    dataUrl: string,
    filename: string,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      // Parse the data URL (handles svg+xml and other compound subtypes).
      const parsed = parseImageDataUrl(dataUrl);
      if (!parsed) {
        throw new Error('Invalid image data URL');
      }

      const { extension, base64: base64Data } = parsed;

      const docDir = path.dirname(document.uri.fsPath);
      const imagesDir = path.join(docDir, 'images');
      const rawBaseName = path.basename(filename, path.extname(filename));

      const finalFilename = writeImageRelativeTo(
        imagesDir,
        `${rawBaseName}.${extension}`,
        base64Data
      );

      // Return relative path for markdown and webview URI for display
      const relativePath = `./images/${finalFilename}`;
      const webviewUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(imagesDir, finalFilename))
      ).toString();

      // Send success response to webview with both paths
      webview.postMessage({
        type: 'imageSaved',
        path: relativePath,        // For markdown storage
        displaySrc: webviewUri     // For editor display
      });
    } catch (error) {
      console.error('Failed to save image:', error);
      webview.postMessage({
        type: 'imageError',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resize an image file (called after user confirms resize in webview)
   * The webview has already resized the image using Canvas, we just save it
   */
  private async resizeImage(
    document: vscode.TextDocument,
    relativePath: string,
    dataUrl: string
  ): Promise<void> {
    try {
      // Get full path from relative path
      const docDir = path.dirname(document.uri.fsPath);
      const imagePath = path.join(docDir, relativePath);

      // Verify the file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${relativePath}`);
      }

      // Parse the data URL (handles svg+xml and other compound subtypes).
      const parsed = parseImageDataUrl(dataUrl);
      if (!parsed) {
        throw new Error('Invalid image data URL');
      }

      // Overwrite the original file with resized image
      fs.writeFileSync(imagePath, Buffer.from(parsed.base64, 'base64'));
    } catch (error) {
      console.error('Failed to resize image:', error);
      vscode.window.showErrorMessage(
        `Failed to resize image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sprint 82 R5: create a new empty .drawio.svg in ./images/ relative to the
   * markdown file, insert its image reference via the existing imageSaved flow,
   * and open the draw.io editor for it.
   */
  private async insertDiagram(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      const imagesDir = path.join(path.dirname(document.uri.fsPath), 'images');
      await fsp.mkdir(imagesDir, { recursive: true });

      const diagramPath = getUniqueDrawioPath(imagesDir);
      await fsp.writeFile(diagramPath, EMPTY_DRAWIO_SVG_TEMPLATE, 'utf-8');

      // Reuse the imageSaved flow: the webview inserts an image node at the
      // pending slash-command position with title = relative path.
      const relativePath = `./images/${path.basename(diagramPath)}`;
      const webviewUri = webview.asWebviewUri(vscode.Uri.file(diagramPath)).toString();

      // Wait for the webview to ack the insert before opening the diagram
      // editor: openWith steals focus from the markdown editor, so the insert
      // must reach the TextDocument coordinator before the source view hides.
      const inserted = new Promise<void>((resolve) => {
        this.pendingInsertAcks.set(relativePath, resolve);
      });
      webview.postMessage({
        type: 'imageSaved',
        path: relativePath,
        displaySrc: webviewUri
      });
      await Promise.race([
        inserted,
        new Promise<void>((resolve) => setTimeout(resolve, 2000))
      ]);
      this.pendingInsertAcks.delete(relativePath);

      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.file(diagramPath),
        'ritemark.drawioEditor'
      );
    } catch (error) {
      console.error('Failed to insert diagram:', error);
      webview.postMessage({
        type: 'imageError',
        error: error instanceof Error ? error.message : 'Failed to insert diagram'
      });
    }
  }

  /**
   * Sprint 82 R4: open a .drawio.svg referenced from the markdown preview in
   * the draw.io editor tab (or focus the existing tab for that file).
   */
  private async openDrawioDiagram(
    document: vscode.TextDocument,
    relativePath: string
  ): Promise<void> {
    try {
      const absPath = path.resolve(path.dirname(document.uri.fsPath), relativePath);
      if (!fs.existsSync(absPath)) {
        vscode.window.showErrorMessage(`Diagram file not found: ${relativePath}`);
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.file(absPath),
        'ritemark.drawioEditor'
      );
    } catch (error) {
      console.error('Failed to open draw.io diagram:', error);
      vscode.window.showErrorMessage(
        `Failed to open diagram: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Select an image file from the file system and send it to the webview
   */
  private async selectImageFile(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      const result = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
        },
        title: 'Select Image'
      });

      if (!result || result.length === 0) {
        // User cancelled - send cancellation message
        webview.postMessage({ type: 'imageSelectionCancelled' });
        return;
      }

      const selectedFile = result[0];

      // Read file as base64
      const fileBuffer = fs.readFileSync(selectedFile.fsPath);
      const base64Data = fileBuffer.toString('base64');

      // Determine MIME type from extension
      const ext = path.extname(selectedFile.fsPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      const mimeType = mimeTypes[ext] || 'image/png';

      // Create data URL
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      const filename = path.basename(selectedFile.fsPath);

      // Use existing saveImage flow
      await this.saveImage(document, dataUrl, filename, webview);
    } catch (error) {
      console.error('Failed to select image:', error);
      webview.postMessage({
        type: 'imageError',
        error: error instanceof Error ? error.message : 'Failed to select image'
      });
    }
  }

  private getHtml(
    webview: vscode.Webview,
    scriptUri: string,
    syncBootstrap?: Omit<DocumentSyncBootstrap, 'viewEpoch'>,
  ): string {
    // Get nonce for Content Security Policy
    const nonce = this.getNonce();
    const bootstrapJson = syncBootstrap
      ? JSON.stringify(syncBootstrap).replace(/</g, '\\u003c')
      : undefined;
    const bootstrapScript = bootstrapJson
      ? `<script nonce="${nonce}">
    window.__ritemarkDocumentSync = {
      ...${bootstrapJson},
      viewEpoch: globalThis.crypto?.randomUUID?.() ?? 'view-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    };
  </script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data: blob:; connect-src ${webview.cspSource};">
  <title>Ritemark</title>
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
  ${bootstrapScript}
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

  /**
   * Handle dictation preparation - check model and download if needed
   */
  private async handlePrepareDictation(webview: vscode.Webview, language: string): Promise<void> {
    try {
      const { isModelDownloaded, ensureModelDownloaded } = await import('./voiceDictation/modelManager');

      // Check if model needs download
      const wasAlreadyDownloaded = isModelDownloaded();

      // This will show download dialog if needed
      const result = await ensureModelDownloaded();

      if (result.success) {
        if (wasAlreadyDownloaded) {
          // Model was already there, ready to go
          webview.postMessage({ type: 'dictation:ready' });
        } else {
          // Model was just downloaded - reset to idle, user should click again
          webview.postMessage({ type: 'dictation:cancelled' });
        }
      } else {
        // User cancelled or download failed
        webview.postMessage({ type: 'dictation:cancelled' });
      }
    } catch (error) {
      console.error('[Ritemark] Dictation prepare error:', error);
      webview.postMessage({
        type: 'dictation:error',
        error: 'Failed to prepare voice dictation'
      });
    }
  }

  /**
   * Check if Microsoft Excel is installed
   */
  private async checkExcelInstalled(): Promise<boolean> {
    return isAppInstalled('Microsoft Excel');
  }

  /**
   * Open file in external application
   * @param filePath Absolute path to the file
   * @param app App identifier ('excel' or 'numbers')
   */
  private async openInExternalApp(filePath: string, app: string): Promise<void> {
    try {
      const hasExcel = app === 'excel';
      const appName = getSpreadsheetAppName(hasExcel);

      if (hasExcel && filePath.toLowerCase().endsWith('.csv')) {
        await openCsvInExcelWithHints(filePath, appName);
      } else {
        await openInExternalApp(filePath, appName);
      }

      vscode.window.showInformationMessage(`Opening in ${appName}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open in ${app}: ${errorMessage}`);
    }
  }

  /**
   * Get model download status and send to webview
   */
  private async getModelStatus(webview: vscode.Webview): Promise<void> {
    try {
      const { isModelDownloaded, getModelPath, AVAILABLE_MODELS } = await import('./voiceDictation/modelManager');
      const modelPath = getModelPath();
      const downloaded = isModelDownloaded();

      // Get model filename from path
      const modelFilename = path.basename(modelPath);
      const modelInfo = AVAILABLE_MODELS[modelFilename];

      let sizeBytes = 0;
      if (downloaded) {
        try {
          const stats = fs.statSync(modelPath);
          sizeBytes = stats.size;
        } catch {
          // Ignore errors getting size
        }
      }

      // Check if dictation is currently active
      const isDictationActive = this.dictationController?.isActive() ?? false;

      webview.postMessage({
        type: 'dictation:modelStatus',
        status: {
          downloaded,
          sizeBytes,
          path: modelPath,
          modelName: modelInfo?.name || modelFilename.replace('ggml-', '').replace('.bin', ''),
          modelSizeDisplay: modelInfo?.sizeDisplay || '',
          isDictationActive
        }
      });
    } catch (error) {
      console.error('[Ritemark] Failed to get model status:', error);
      webview.postMessage({
        type: 'dictation:modelStatus',
        status: {
          downloaded: false,
          sizeBytes: 0,
          path: '',
          modelName: 'unknown',
          modelSizeDisplay: '',
          isDictationActive: false
        }
      });
    }
  }

  /**
   * Remove downloaded model and notify webview
   */
  private async removeModel(webview: vscode.Webview): Promise<void> {
    try {
      const { getModelPath } = await import('./voiceDictation/modelManager');
      const modelPath = getModelPath();

      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
        vscode.window.showInformationMessage('Voice model removed successfully.');
      }

      // Also remove partial download if exists
      const partialPath = modelPath + '.partial';
      if (fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath);
      }

      webview.postMessage({
        type: 'dictation:modelRemoved',
        success: true
      });
    } catch (error) {
      console.error('[Ritemark] Failed to remove model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to remove model: ${errorMessage}`);
      webview.postMessage({
        type: 'dictation:modelRemoved',
        success: false,
        error: errorMessage
      });
    }
  }
}
