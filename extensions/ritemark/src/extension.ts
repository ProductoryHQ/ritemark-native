import * as vscode from 'vscode';
import { RiteMarkEditorProvider } from './ritemarkEditor';
import { initAPIKeyManager } from './ai/apiKeyManager';
import { initConnectivity } from './ai/connectivity';
import { AIViewProvider } from './ai/AIViewProvider';
import { registerConfigureApiKeyCommand, registerCheckApiKeyCommand } from './commands/configureApiKey';
import { UpdateService, UpdateStorage, scheduleStartupCheck } from './update';

// Export AI view provider for editor access
export let aiViewProvider: AIViewProvider;

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

  // Register AI View Provider (Secondary Side Bar / right)
  aiViewProvider = new AIViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AIViewProvider.viewType, aiViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Auto-show AI panel on startup
  setTimeout(async () => {
    try {
      // Open AI view in auxiliary bar
      await vscode.commands.executeCommand('workbench.view.extension.ritemark-ai');
    } catch (e) {
      console.log('Failed to open AI view:', e);
      await vscode.commands.executeCommand('ritemark.aiView.focus');
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
      // Focus the AI view
      vscode.commands.executeCommand('ritemark.aiView.focus');
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

  // Register custom editor
  context.subscriptions.push(
    RiteMarkEditorProvider.register(context, aiViewProvider)
  );
}

export function deactivate() {}
