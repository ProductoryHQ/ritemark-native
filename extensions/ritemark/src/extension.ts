import * as vscode from 'vscode';
import { RitemarkEditorProvider } from './ritemarkEditor';
import { ExcelEditorProvider } from './excelEditorProvider';
import { PdfEditorProvider } from './pdfEditorProvider';
import { initAPIKeyManager } from './ai/apiKeyManager';
import { initConnectivity } from './ai/connectivity';
import { UnifiedViewProvider } from './views/UnifiedViewProvider';
import { FlowsViewProvider } from './flows/FlowsViewProvider';
import { FlowEditorProvider } from './flows/FlowEditorProvider';
import { FlowStorage } from './flows/FlowStorage';
import { RitemarkSettingsProvider } from './settings/RitemarkSettingsProvider';
import { setExtensionContext as setLLMExtensionContext } from './flows/nodes/LLMNodeExecutor';
import { setImageNodeExtensionContext } from './flows/nodes/ImageNodeExecutor';
import { registerFlowTestCommand } from './flows/FlowTestRunner';
import { DocumentIndexer } from './rag/indexer';
import { registerConfigureApiKeyCommand, registerCheckApiKeyCommand } from './commands/configureApiKey';
import { UpdateService, UpdateStorage, scheduleStartupCheck } from './update';
// Feature flags: view visibility controlled by 'when' clauses in package.json

// Export unified view provider for editor access
export let unifiedViewProvider: UnifiedViewProvider;

// Flows view provider
let flowsViewProvider: FlowsViewProvider | null = null;

// Settings provider
let settingsProvider: RitemarkSettingsProvider | null = null;

// RAG infrastructure
let documentIndexer: DocumentIndexer | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Initialize API key manager (must be first)
  initAPIKeyManager(context);

  // Initialize executor contexts (for Gemini API key access)
  setLLMExtensionContext(context);
  setImageNodeExtensionContext(context);

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

  // Register Flows View Provider (always register - visibility controlled by when clause in package.json)
  if (workspacePath) {
    flowsViewProvider = new FlowsViewProvider(context.extensionUri, workspacePath);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(FlowsViewProvider.viewType, flowsViewProvider, {
        webviewOptions: { retainContextWhenHidden: true }
      })
    );
  }

  // AI panel opens via activity bar click, not auto-shown on startup
  // User requested Explorer (folder view) to be default

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

  // Register flow test command
  registerFlowTestCommand(context);

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

  // Register new chat command (clears conversation)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newChat', () => {
      unifiedViewProvider.clearChat();
    })
  );

  // Initialize Settings Provider
  settingsProvider = new RitemarkSettingsProvider(context);

  // Register AI settings command (opens branded settings page)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.aiSettings', () => {
      settingsProvider?.open();
    })
  );

  // Register Flow Editor Provider (visual editor for .flow.json files)
  context.subscriptions.push(
    FlowEditorProvider.register(context)
  );

  // Register Flows commands (always register - menu visibility controlled by when clauses in package.json)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.flows.new', async () => {
      if (!workspacePath) {
        vscode.window.showWarningMessage('Open a folder first to create flows.');
        return;
      }

      // Create a new flow with a unique ID
      const flowStorage = new FlowStorage(workspacePath);
      const newFlow = flowStorage.createNewFlow('New Flow');
      await flowStorage.saveFlow(newFlow);

      // Open the new flow in the editor
      const flowPath = flowStorage.getFlowPath(newFlow.id);
      const uri = vscode.Uri.file(flowPath);
      await vscode.commands.executeCommand('vscode.openWith', uri, FlowEditorProvider.viewType);

      // Refresh the flows list
      await flowsViewProvider?.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.flows.refresh', async () => {
      await flowsViewProvider?.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.flows.settings', () => {
      settingsProvider?.open();
    })
  );

  // Register AI tool execution command (called from AI panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.executeAITool', (data: {
      toolName: string;
      args: Record<string, unknown>;
      selection: { text: string; isEmpty: boolean; from: number; to: number };
    }) => {
      // Broadcast to active editor via RitemarkEditorProvider
      RitemarkEditorProvider.executeAITool(data);
    })
  );

  // Register markdown/CSV custom editor
  context.subscriptions.push(
    RitemarkEditorProvider.register(context, unifiedViewProvider)
  );

  // Register Excel viewer (read-only)
  context.subscriptions.push(
    ExcelEditorProvider.register(context)
  );

  // Register PDF viewer (read-only)
  context.subscriptions.push(
    PdfEditorProvider.register(context)
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
        await documentIndexer.init();
        documentIndexer.onProgress((p) => {
          unifiedViewProvider.sendIndexProgress(p.processed, p.total, p.current);
        });
      }
      try {
        const result = await documentIndexer!.indexAll();
        unifiedViewProvider.sendIndexDone();
        if (result.errors.length > 0) {
          // Show first error, offer to see all
          const firstError = result.errors[0];
          const action = await vscode.window.showWarningMessage(
            `Indexed ${result.processed} docs with ${result.errors.length} error(s). First: ${firstError}`,
            'Show All Errors'
          );
          if (action === 'Show All Errors') {
            const errorList = result.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
            vscode.window.showInformationMessage(errorList, { modal: true });
          }
        } else {
          const stats = await documentIndexer!.getStats();
          vscode.window.showInformationMessage(
            `Indexed ${result.processed} documents (${stats.totalChunks} chunks)`
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

  // Initialize RAG indexer (if workspace available)
  if (workspacePath) {
    documentIndexer = new DocumentIndexer({ workspacePath });

    // Initialize vector store asynchronously
    documentIndexer.init().catch(() => {
      // Vector store init failed - RAG features won't work
    });

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
}
