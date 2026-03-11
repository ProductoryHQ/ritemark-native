import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RitemarkEditorProvider } from './ritemarkEditor';
import { ExcelEditorProvider } from './excelEditorProvider';
import { PdfEditorProvider } from './pdfEditorProvider';
import { DocxEditorProvider } from './docxEditorProvider';
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
const DEFAULT_DRAFTS_DIR_NAME = 'Ritemark';

function buildCsvTemplate(columns = 10, rows = 20): string {
  const headers = Array.from({ length: columns }, (_, index) => String.fromCharCode(65 + index)).join(',');
  const emptyRows = Array.from({ length: rows }, () => ','.repeat(columns - 1));
  return `${headers}\n${emptyRows.join('\n')}`;
}

function getDraftsDirectory(): string {
  const documentsDir = path.join(os.homedir(), 'Documents');
  const parentDir = fs.existsSync(documentsDir) ? documentsDir : os.homedir();
  const draftsDir = path.join(parentDir, DEFAULT_DRAFTS_DIR_NAME);
  fs.mkdirSync(draftsDir, { recursive: true });
  return draftsDir;
}

function getUniqueDraftPath(extension: string): string {
  const draftsDir = getDraftsDirectory();
  let index = 1;

  while (true) {
    const filename = index === 1 ? `Untitled.${extension}` : `Untitled ${index}.${extension}`;
    const filePath = path.join(draftsDir, filename);
    if (!fs.existsSync(filePath)) {
      return filePath;
    }
    index += 1;
  }
}

async function createDraftAndOpen(
  extension: string,
  viewType: string,
  initialContent?: string
): Promise<void> {
  const filePath = getUniqueDraftPath(extension);
  const uri = vscode.Uri.file(filePath);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(initialContent ?? '', 'utf8'));
  await vscode.commands.executeCommand('vscode.openWith', uri, viewType, {
    preview: false,
    preserveFocus: false,
  });
}

async function promptForFlowWorkspace(): Promise<boolean> {
  const selection = await vscode.window.showInformationMessage(
    'Create a Flow',
    {
      modal: true,
      detail: 'Flows live inside a project folder so they can read files, write outputs, and stay with your workspace.\n\nOpen a folder first, then choose New -> New flow again.',
    },
    'Open Folder'
  );

  if (selection === 'Open Folder') {
    await vscode.commands.executeCommand('vscode.openFolder');
    return true;
  }

  return false;
}

async function createAndOpenWorkspaceFlow(workspacePath: string): Promise<void> {
  const flowStorage = new FlowStorage(workspacePath);
  const newFlow = flowStorage.createNewFlow('New Flow');
  await flowStorage.saveFlow(newFlow);

  const flowPath = flowStorage.getFlowPath(newFlow.id);
  const uri = vscode.Uri.file(flowPath);
  await vscode.commands.executeCommand('vscode.openWith', uri, FlowEditorProvider.viewType);
  await flowsViewProvider?.refresh();
}

export function activate(context: vscode.ExtensionContext) {
  // === Theme & branding: only on fresh install or version upgrade ===
  const currentVersion = context.extension.packageJSON.version as string;
  const lastThemeVersion = context.globalState.get<string>('ritemark.themeAppliedVersion');
  if (lastThemeVersion !== currentVersion) {
    setTimeout(async () => {
      const wb = vscode.workspace.getConfiguration('workbench');
      const win = vscode.workspace.getConfiguration('window');
      await win.update('autoDetectColorScheme', false, vscode.ConfigurationTarget.Global);
      await wb.update('colorTheme', 'ritemark-light', vscode.ConfigurationTarget.Global);
      await wb.update('iconTheme', 'ritemark-icons', vscode.ConfigurationTarget.Global);
      await wb.update('preferredLightColorTheme', 'ritemark-light', vscode.ConfigurationTarget.Global);
      await wb.update('preferredDarkColorTheme', 'ritemark-light', vscode.ConfigurationTarget.Global);
      context.globalState.update('ritemark.themeAppliedVersion', currentVersion);
    }, 1500);
  }

  // === Layout settings: EVERY startup ===
  // NOTE: terminal.integrated.defaultLocation defaults to 'view' in VS Code core +
  // package.json configurationDefaults. Do NOT write it here — it was previously set
  // to 'editor' by mistake, which overrode the correct default.
  // AI panel location is enforced in VS Code core (viewDescriptorService.ts patch).
  (async () => {
    try {
      const wb = vscode.workspace.getConfiguration('workbench');
      await wb.update('layoutControl.enabled', true, vscode.ConfigurationTarget.Global);
      await wb.update('layoutControl.type', 'toggles', vscode.ConfigurationTarget.Global);

      // Fix for users who had the old 'editor' value written by previous versions
      const terminal = vscode.workspace.getConfiguration('terminal.integrated');
      const current = terminal.get<string>('defaultLocation');
      if (current === 'editor') {
        await terminal.update('defaultLocation', undefined, vscode.ConfigurationTarget.Global);
      }
    } catch (e) {
      console.error('Ritemark: failed to set layout defaults', e);
    }
  })();

  // Focus Ritemark AI tab in auxiliary bar (instead of terminal).
  // Standalone timeout — terminal init steals focus, so we re-focus after it settles.
  setTimeout(() => {
    console.log('[Ritemark] Focusing AI view in auxiliary bar');
    vscode.commands.executeCommand('ritemark.unifiedView.focus');
  }, 4000);

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
  scheduleStartupCheck(updateService);

  // Register Unified View Provider (Primary Sidebar / left)
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  unifiedViewProvider = new UnifiedViewProvider(context.extensionUri, workspacePath, context.secrets);
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

  // Auto-open terminal in right sidebar only if no terminal exists yet
  setTimeout(async () => {
    try {
      if (vscode.window.terminals.length === 0) {
        await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
        await vscode.commands.executeCommand('workbench.action.terminal.new');
      }
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

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newDocument', async () => {
      await createDraftAndOpen('md', RitemarkEditorProvider.viewType);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newTable', async () => {
      await createDraftAndOpen('csv', RitemarkEditorProvider.viewType, buildCsvTemplate());
    })
  );

  // Initialize Settings Provider
  settingsProvider = new RitemarkSettingsProvider(context, updateService);
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(RitemarkSettingsProvider.viewType, settingsProvider),
    { dispose: () => settingsProvider?.dispose() }
  );

  // Register chat history command (toggles history panel in webview)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.chatHistory', () => {
      unifiedViewProvider.toggleHistoryPanel();
    })
  );

  // Register AI settings command (opens branded settings page)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.aiSettings', () => {
      settingsProvider?.open();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.codexLogin', async () => {
      await settingsProvider?.startCodexLoginFromCommand();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.claudeLogin', async () => {
      await settingsProvider?.startClaudeLoginFromCommand();
    })
  );

  // Register health status command (used by Welcome page health check)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.getHealthStatus', async () => {
      return settingsProvider?.getHealthStatus() ?? null;
    })
  );

  // Register "Send to AI Chat" — Explorer context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.sendToChat', (uri: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      const uris = selectedUris ?? (uri ? [uri] : []);
      const paths = uris.map(u => u.fsPath);
      if (paths.length > 0) {
        unifiedViewProvider.sendFilePaths(paths);
        vscode.commands.executeCommand('ritemark.unifiedView.focus');
      }
    })
  );

  // Register Flow Editor Provider (visual editor for .flow.json files)
  context.subscriptions.push(
    FlowEditorProvider.register(context)
  );

  // Register Flows commands (always register - menu visibility controlled by when clauses in package.json)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.flows.new', async () => {
      const activeWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!activeWorkspacePath) {
        await promptForFlowWorkspace();
        return;
      }

      await createAndOpenWorkspaceFlow(activeWorkspacePath);
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

  // Register DOCX viewer (read-only)
  context.subscriptions.push(
    DocxEditorProvider.register(context)
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
