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

  // Auto-open terminal in right sidebar (auxiliary bar) on startup
  setTimeout(async () => {
    try {
      // Show the auxiliary bar (right sidebar) where terminal is registered
      await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
      // Create a new terminal - goes to aux bar per patch 001
      await vscode.commands.executeCommand('workbench.action.terminal.new');
    } catch (e) {
      console.log('Failed to auto-open terminal:', e);
    }
  }, 2500);

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

  // Register reindex command (initializes indexer on-demand if needed)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.reindexDocuments', async () => {
      if (!documentIndexer) {
        const wp = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wp) {
          vscode.window.showWarningMessage('Open a folder first to index documents.');
          return;
        }
        documentIndexer = new DocumentIndexer({ workspacePath: wp });
        documentIndexer.onProgress((p) => {
          unifiedViewProvider.sendIndexProgress(p.processed, p.total, p.current);
        });
      }
      try {
        const result = await documentIndexer!.indexAll();
        unifiedViewProvider.sendIndexDone();
        if (result.errors.length > 0) {
          vscode.window.showWarningMessage(
            `Indexed ${result.processed} docs with ${result.errors.length} errors`
          );
        } else {
          vscode.window.showInformationMessage(
            `Indexed ${result.processed} documents (${documentIndexer!.getStats().totalChunks} chunks)`
          );
        }
      } catch (err) {
        unifiedViewProvider.sendIndexDone();
        const msg = err instanceof Error ? err.message : String(err);
        console.log('[RAG] Indexing error:', msg);
      }
    })
  );

  // Register cancel indexing command
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.cancelIndexing', () => {
      documentIndexer?.cancelIndexing();
    })
  );

  // Register MCP config generation command (initializes on-demand if needed)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.generateMCPConfig', () => {
      if (!mcpServer) {
        const wp = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wp) {
          vscode.window.showWarningMessage('Open a folder first to generate MCP config.');
          return;
        }
        mcpServer = new MCPServerManager({ workspacePath: wp });
      }
      mcpServer.generateClaudeConfig();
    })
  );

  // Initialize RAG indexer and MCP server (if workspace available)
  if (workspacePath) {
    documentIndexer = new DocumentIndexer({ workspacePath });
    mcpServer = new MCPServerManager({ workspacePath });

    // Send progress to sidebar during indexing
    documentIndexer.onProgress((p) => {
      unifiedViewProvider.sendIndexProgress(p.processed, p.total, p.current);
    });

    // Show existing index status on startup (no auto-indexing)
    setTimeout(() => {
      unifiedViewProvider.updateIndexStatus();
    }, 2000);
  }
}

export function deactivate() {
  documentIndexer?.dispose();
  mcpServer?.dispose();
}
