import * as vscode from 'vscode';
import { RiteMarkEditorProvider } from './ritemarkEditor';
import { ExcelEditorProvider } from './excelEditorProvider';
import { initAPIKeyManager } from './ai/apiKeyManager';
import { initConnectivity } from './ai/connectivity';
import { UnifiedViewProvider } from './views/UnifiedViewProvider';
import { DocumentIndexer } from './rag/indexer';
import { MCPServerManager } from './rag/mcpServer';
import { registerConfigureApiKeyCommand, registerCheckApiKeyCommand } from './commands/configureApiKey';
import { UpdateService, UpdateStorage, scheduleStartupCheck } from './update';

// Export unified view provider for editor access
export let unifiedViewProvider: UnifiedViewProvider;

// RAG infrastructure
let documentIndexer: DocumentIndexer | null = null;
let mcpServer: MCPServerManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Initialize API key manager (must be first)
  initAPIKeyManager(context);

  // Initialize connectivity monitoring (status bar + online detection)
  initConnectivity(context);

  // Initialize update service
  const updateStorage = new UpdateStorage(context.globalState);
  const updateService = new UpdateService(updateStorage);

  // Schedule startup update check (10 second delay)
  scheduleStartupCheck(updateService, updateStorage);

  // Register Unified View Provider (Primary Sidebar / left)
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  unifiedViewProvider = new UnifiedViewProvider(context.extensionUri, workspacePath);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(UnifiedViewProvider.viewType, unifiedViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Auto-show unified panel on startup
  setTimeout(async () => {
    try {
      await vscode.commands.executeCommand('workbench.view.extension.ritemark-ai');
    } catch (e) {
      console.log('Failed to open unified view:', e);
      await vscode.commands.executeCommand('ritemark.unifiedView.focus');
    }
  }, 1500);

  // Register commands
  context.subscriptions.push(
    registerConfigureApiKeyCommand(context),
    registerCheckApiKeyCommand(context)
  );

  // Register show AI panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.showAIPanel', () => {
      vscode.commands.executeCommand('ritemark.unifiedView.focus');
    })
  );

  // Register search command (opens VS Code search)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.openSearch', () => {
      vscode.commands.executeCommand('workbench.view.search');
    })
  );

  // Register AI tool execution command (called from AI panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.executeAITool', (data: {
      toolName: string;
      args: Record<string, unknown>;
      selection: { text: string; isEmpty: boolean; from: number; to: number };
    }) => {
      // Broadcast to active editor via RiteMarkEditorProvider
      RiteMarkEditorProvider.executeAITool(data);
    })
  );

  // Register markdown/CSV custom editor
  context.subscriptions.push(
    RiteMarkEditorProvider.register(context, unifiedViewProvider)
  );

  // Register Excel viewer (read-only)
  context.subscriptions.push(
    ExcelEditorProvider.register(context)
  );

  // Initialize RAG indexer and MCP server (if workspace available)
  if (workspacePath) {
    documentIndexer = new DocumentIndexer({ workspacePath });
    mcpServer = new MCPServerManager({ workspacePath });

    // Start file watcher for auto-indexing
    documentIndexer.startWatching();

    // Update sidebar when index changes
    documentIndexer.onProgress(() => {
      unifiedViewProvider.updateIndexStatus();
    });

    // Register reindex command
    context.subscriptions.push(
      vscode.commands.registerCommand('ritemark.reindexDocuments', async () => {
        if (!documentIndexer) { return; }
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Indexing documents...' },
          async (progress) => {
            const listener = documentIndexer!.onProgress((p) => {
              progress.report({
                message: `${p.processed}/${p.total}: ${p.current}`,
                increment: (1 / Math.max(p.total, 1)) * 100,
              });
            });
            try {
              const result = await documentIndexer!.indexAll();
              if (result.errors.length > 0) {
                vscode.window.showWarningMessage(
                  `Indexed ${result.processed} docs with ${result.errors.length} errors`
                );
              } else {
                vscode.window.showInformationMessage(
                  `Indexed ${result.processed} documents (${documentIndexer!.getStats().totalChunks} chunks)`
                );
              }
              unifiedViewProvider.updateIndexStatus();
            } finally {
              listener.dispose();
            }
          }
        );
      })
    );

    // Register MCP config generation command
    context.subscriptions.push(
      vscode.commands.registerCommand('ritemark.generateMCPConfig', () => {
        mcpServer?.generateClaudeConfig();
      })
    );

    // Auto-index on first activation (with delay to not block startup)
    setTimeout(() => {
      documentIndexer?.indexAll().then(() => {
        unifiedViewProvider.updateIndexStatus();
      }).catch((err) => {
        console.log('[RAG] Initial indexing skipped:', err.message);
      });
    }, 5000);
  }
}

export function deactivate() {
  documentIndexer?.dispose();
  mcpServer?.dispose();
}
