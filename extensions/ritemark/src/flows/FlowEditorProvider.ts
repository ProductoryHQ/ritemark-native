/**
 * Flow Editor Provider
 *
 * Custom editor for .flow.json files.
 * Opens flows in a visual React Flow canvas editor.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import OpenAI from 'openai';
import type { Flow, FlowNode, ExecutionContext, ClaudeCodeProgress } from './types';
import { executeLLMNode } from './nodes/LLMNodeExecutor';
import { executeImageNode } from './nodes/ImageNodeExecutor';
import { executeSaveFileNode } from './nodes/SaveFileNodeExecutor';
import { executeClaudeCodeNode } from './nodes/ClaudeCodeNodeExecutor';
import { executeCodexNode } from './nodes/CodexNodeExecutor';
import { isValidFlowSchedule } from './flowSchedule';
import { FlowScheduleState } from './FlowScheduleState';
import { getAPIKeyManager } from '../ai/apiKeyManager';
import {
  OPENAI_LLM_MODELS,
  OPENAI_IMAGE_MODELS,
  GEMINI_LLM_MODELS,
  GEMINI_IMAGE_MODELS,
  DEFAULT_MODELS
} from '../ai/modelConfig';

/**
 * Sanitize a string for use in a filename
 */
function sanitizeForFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/**
 * Extract short ID from flow filename (e.g., "my-flow-x4k9.flow.json" -> "x4k9")
 */
function extractShortId(filename: string): string | null {
  const base = path.basename(filename, '.flow.json');
  const match = base.match(/-([a-z0-9]{4})$/);
  return match ? match[1] : null;
}

export class FlowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ritemark.flowEditor';

  private static activeWebviews: Set<vscode.Webview> = new Set();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      FlowEditorProvider.viewType,
      new FlowEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Get URI for the webview bundle (same bundle as main editor)
    const scriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );

    // Get workspace path for file operations
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    webviewPanel.webview.options = {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, scriptUri);

    // Track if we're currently updating to prevent feedback loops
    let isUpdating = false;
    let isDisposed = false;

    const webview = webviewPanel.webview;
    FlowEditorProvider.activeWebviews.add(webview);

    // Handle messages from webview
    webview.onDidReceiveMessage(
      async (message) => {
        if (isDisposed) return;

        switch (message.type) {
          case 'ready':
            // Webview is ready, send model config and flow data
            this.sendModelConfig(webview);
            this.sendFeatureFlags(webview);
            this.sendFlowData(document, webview, workspacePath);
            return;

          case 'flow:save':
            // Save flow changes (autosave)
            if (!isUpdating) {
              isUpdating = true;
              try {
                await this.updateDocument(document, message.flow, webview);
                // Signal save complete so webview marks clean
                webview.postMessage({ type: 'flow:saved' });
                // Re-validate and send updated warnings
                const saveWarnings = this.validateFlow(message.flow);
                webview.postMessage({ type: 'flow:validation', warnings: saveWarnings });
                void this.sendScheduleStatus(document, webview);
                // Refresh flows list in sidebar
                vscode.commands.executeCommand('ritemark.flows.refresh');
              } finally {
                isUpdating = false;
              }
            }
            return;

          case 'flow:requestSave':
            // User explicitly requested save (Cmd+S)
            await document.save();
            webview.postMessage({ type: 'flow:saved' });
            return;

          case 'flow:validate':
            // Validate flow and return warnings
            const warnings = this.validateFlow(message.flow);
            webview.postMessage({ type: 'flow:validation', warnings });
            return;

          case 'flow:openFile':
            // Open a file in VS Code
            const uri = vscode.Uri.file(path.join(workspacePath, message.path));
            vscode.commands.executeCommand('vscode.open', uri);
            return;

          case 'flow:run':
            // Execute the flow with step-by-step progress
            this.executeFlowWithProgress(
              message.id,
              message.inputs || {},
              workspacePath,
              webview,
              document
            );
            return;

          case 'flow:getModels':
            // Fetch available models from API
            this.fetchModels(message.provider, message.type || 'llm', webview);
            return;

          case 'flow:pickFile':
            // Show file picker dialog
            this.showFilePicker(message.inputId, message.label, workspacePath, webview);
            return;

          case 'flow:pickFolder':
            // Show folder picker dialog for Save File node
            this.showFolderPicker(message.field, workspacePath, webview);
            return;

          case 'flow:getScheduleStatus':
            void this.sendScheduleStatus(document, webview);
            return;

          case 'codex:getModels':
            // Return available Codex models
            try {
              const { getCodexModels } = require('../codex');
              const models = getCodexModels();
              webview.postMessage({ type: 'codex:modelsResult', models });
            } catch {
              webview.postMessage({ type: 'codex:modelsResult', models: [] });
            }
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Note: We don't listen to onDidChangeTextDocument because:
    // 1. The webview is the source of truth
    // 2. Document changes are caused by our own saves
    // 3. Reloading on change causes feedback loops (blinking)
    // External changes (git, other editors) require reopening the file.

    webviewPanel.onDidDispose(() => {
      isDisposed = true;
      FlowEditorProvider.activeWebviews.delete(webview);
    });
  }

  /**
   * Parse and send flow data to webview
   */
  private sendFlowData(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    workspacePath: string
  ): void {
    try {
      const content = document.getText();
      const flow: Flow = content.trim() ? JSON.parse(content) : this.createEmptyFlow();

      // Validate and include warnings
      const warnings = this.validateFlow(flow);

      webview.postMessage({
        type: 'flow:load',
        flow,
        workspacePath,
        warnings,
        filename: path.basename(document.uri.fsPath),
      });
      void this.sendScheduleStatus(document, webview);
    } catch (err) {
      console.error('[FlowEditorProvider] Failed to parse flow:', err);
      webview.postMessage({
        type: 'flow:error',
        error: `Invalid flow JSON: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Send model configuration to webview
   * This allows webview to use the same model config as extension
   */
  private sendModelConfig(webview: vscode.Webview): void {
    webview.postMessage({
      type: 'flow:modelConfig',
      config: {
        openaiLLM: OPENAI_LLM_MODELS.map(m => ({ id: m.id, name: m.name })),
        openaiImage: OPENAI_IMAGE_MODELS.filter(m => !m.deprecated).map(m => ({ id: m.id, name: m.name })),
        geminiLLM: GEMINI_LLM_MODELS.map(m => ({ id: m.id, name: m.name })),
        geminiImage: GEMINI_IMAGE_MODELS.map(m => ({ id: m.id, name: m.name })),
        defaults: DEFAULT_MODELS,
      },
    });
  }

  private sendFeatureFlags(webview: vscode.Webview): void {
    const { isEnabled } =
      require('../features/featureGate') as typeof import('../features/featureGate');

    webview.postMessage({
      type: 'flow:featureFlags',
      flags: {
        scheduledFlowRuns: isEnabled('scheduled-flow-runs'),
      },
    });
  }

  private async sendScheduleStatus(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    const scheduleState = new FlowScheduleState(this.context.workspaceState);
    const status = await scheduleState.get(document.uri.fsPath);

    webview.postMessage({
      type: 'flow:scheduleStatus',
      status,
    });
  }

  /**
   * Update document with new flow content
   * If flow name changed, rename the file to match
   */
  private async updateDocument(
    document: vscode.TextDocument,
    flow: Flow,
    webview?: vscode.Webview
  ): Promise<void> {
    const scheduleState = new FlowScheduleState(this.context.workspaceState);

    // Update modified timestamp
    flow.modified = new Date().toISOString();

    // Check if we need to rename the file based on flow name change
    const currentFilename = path.basename(document.uri.fsPath, '.flow.json');
    const shortId = extractShortId(document.uri.fsPath);
    const sanitizedName = sanitizeForFilename(flow.name) || 'flow';
    const expectedFilename = shortId ? `${sanitizedName}-${shortId}` : sanitizedName;

    if (shortId && currentFilename !== expectedFilename) {
      // Name changed - rename file using WorkspaceEdit (smoother than close/reopen)
      const oldPath = document.uri.fsPath;
      const dir = path.dirname(document.uri.fsPath);
      const newPath = path.join(dir, `${expectedFilename}.flow.json`);
      const newUri = vscode.Uri.file(newPath);

      // Update flow ID to match new filename
      flow.id = expectedFilename;

      // First update the content
      const content = JSON.stringify(flow, null, 2);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        content
      );
      await vscode.workspace.applyEdit(edit);

      // Then rename the file (VS Code handles editor update)
      const renameEdit = new vscode.WorkspaceEdit();
      renameEdit.renameFile(document.uri, newUri);
      await vscode.workspace.applyEdit(renameEdit);

      if (!flow.schedule) {
        await scheduleState.clear(oldPath);
      } else {
        await scheduleState.migrate(oldPath, newPath);
      }

      // Notify webview of the rename (new ID)
      if (webview) {
        webview.postMessage({ type: 'flow:renamed', newId: flow.id });
      }
    } else {
      // No rename needed - just update content
      const content = JSON.stringify(flow, null, 2);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        content
      );
      await vscode.workspace.applyEdit(edit);

      if (!flow.schedule) {
        await scheduleState.clear(document.uri.fsPath);
      }
    }
  }

  /**
   * Validate flow and return warnings (per Jarmo's decision: warn but allow save)
   */
  private validateFlow(flow: Flow): string[] {
    const warnings: string[] = [];

    if (!flow) return ['Flow is empty'];

    // Check for empty name
    if (!flow.name?.trim()) {
      warnings.push('Flow has no name');
    }

    // Check for nodes
    if (!flow.nodes || flow.nodes.length === 0) {
      warnings.push('Flow has no nodes');
    }

    if (flow.schedule && !isValidFlowSchedule(flow.schedule)) {
      warnings.push('Flow schedule is invalid');
    }

    // Check for cycles using topological sort
    if (flow.nodes && flow.edges) {
      const hasCycle = this.detectCycle(flow);
      if (hasCycle) {
        warnings.push('Flow contains a cycle - execution may fail');
      }
    }

    // Check for disconnected nodes (nodes with no edges)
    if (flow.nodes && flow.edges && flow.nodes.length > 1) {
      const connectedNodes = new Set<string>();
      for (const edge of flow.edges) {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
      const disconnected = flow.nodes.filter(
        (n) => !connectedNodes.has(n.id)
      );
      if (disconnected.length > 0) {
        const nodeNames = disconnected
          .map((n) => `"${(n.data as { label?: string }).label || n.id}"`)
          .join(', ');
        warnings.push(
          `Unconnected node${disconnected.length > 1 ? 's' : ''}: ${nodeNames}`
        );
      }
    }

    // Check for LLM nodes missing prompts
    for (const node of flow.nodes || []) {
      if (node.type === 'llm-prompt') {
        const data = node.data as { userPrompt?: string };
        if (!data.userPrompt?.trim()) {
          warnings.push(`LLM node "${(node.data as { label?: string }).label || node.id}" has no user prompt`);
        }
      }

      // Check for Image nodes missing prompts
      if (node.type === 'image-prompt') {
        const data = node.data as { prompt?: string };
        if (!data.prompt?.trim()) {
          warnings.push(`Image node "${(node.data as { label?: string }).label || node.id}" has no prompt`);
        }
      }

      // Check for Save File nodes missing source
      if (node.type === 'save-file') {
        const data = node.data as { sourceNodeId?: string; content?: string };
        if (!data.sourceNodeId && !data.content) {
          warnings.push(`Save File node "${(node.data as { label?: string }).label || node.id}" has no source node or content`);
        }
      }
    }

    return warnings;
  }

  /**
   * Detect cycles in the flow graph
   */
  private detectCycle(flow: Flow): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const graph = new Map<string, string[]>();
    for (const node of flow.nodes) {
      graph.set(node.id, []);
    }
    for (const edge of flow.edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    }

    const hasCycleFrom = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      for (const neighbor of graph.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (hasCycleFrom(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of flow.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleFrom(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Execute flow with step-by-step progress messages
   */
  private async executeFlowWithProgress(
    flowId: string,
    inputs: Record<string, unknown>,
    workspacePath: string,
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): Promise<void> {
    try {
      // Parse flow from document
      const content = document.getText();
      const flow: Flow = JSON.parse(content);

      // Get execution order (topological sort)
      const order = this.getExecutionOrder(flow.nodes, flow.edges);

      // Build input labels map (label -> value)
      const inputLabels = new Map<string, string>();
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        const triggerInputs = (triggerNode.data as { inputs?: Array<{ id: string; label: string }> }).inputs || [];
        for (const input of triggerInputs) {
          const value = inputs[input.label] ?? inputs[input.id];
          if (value !== undefined) {
            inputLabels.set(input.label, String(value));
          }
        }
      }

      // Build node labels map (label -> nodeId)
      const nodeLabels = new Map<string, string>();
      for (const node of flow.nodes) {
        const label = (node.data as { label?: string }).label;
        if (label) {
          nodeLabels.set(label, node.id);
        }
      }

      // Build execution context
      const context: ExecutionContext = {
        inputs,
        outputs: new Map(),
        workspacePath,
        inputLabels,
        nodeLabels,
      };

      // Execute nodes sequentially
      for (const nodeId of order) {
        const node = flow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const label = (node.data as { label?: string }).label || node.id;

        // Signal step start
        webview.postMessage({
          type: 'flow:stepStart',
          nodeId: node.id,
        });

        try {
          // Execute the node (pass webview for Claude Code progress)
          const output = await this.executeNode(node, context, webview);
          context.outputs.set(nodeId, output);

          // Signal step complete
          webview.postMessage({
            type: 'flow:stepComplete',
            nodeId: node.id,
            output: typeof output === 'string'
              ? output
              : output ? JSON.stringify(output) : null,
          });
        } catch (err) {
          // Signal step error
          webview.postMessage({
            type: 'flow:stepError',
            nodeId: node.id,
            error: err instanceof Error ? err.message : String(err),
          });

          // Signal overall flow error
          webview.postMessage({
            type: 'flow:error',
            error: `Failed at "${label}": ${err instanceof Error ? err.message : String(err)}`,
          });
          return;
        }
      }

      // Signal flow complete
      webview.postMessage({
        type: 'flow:complete',
        outputs: Object.fromEntries(context.outputs),
      });
    } catch (err) {
      webview.postMessage({
        type: 'flow:error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    context: ExecutionContext,
    webview?: vscode.Webview
  ): Promise<unknown> {
    switch (node.type) {
      case 'trigger':
        // Trigger node provides inputs to the flow - return inputs object
        return context.inputs;

      case 'llm-prompt':
        return await executeLLMNode(node, context);

      case 'image-prompt':
        return await executeImageNode(node, context);

      case 'save-file':
        return await executeSaveFileNode(node, context);

      case 'claude-code': {
        // Create progress callback that posts to webview
        const onProgress = webview
          ? (progress: ClaudeCodeProgress) => {
              webview.postMessage({
                type: 'flow:claudeCodeProgress',
                nodeId: node.id,
                progress,
              });
            }
          : undefined;

        return await executeClaudeCodeNode(node, context, undefined, onProgress);
      }

      case 'codex': {
        const onProgress = webview
          ? (progress: ClaudeCodeProgress) => {
              webview.postMessage({
                type: 'flow:codexProgress',
                nodeId: node.id,
                progress,
              });
            }
          : undefined;

        return await executeCodexNode(node, context, undefined, onProgress);
      }

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Get execution order using topological sort
   */
  private getExecutionOrder(
    nodes: FlowNode[],
    edges: { source: string; target: string }[]
  ): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return order;
  }

  /**
   * Create an empty flow structure with default Trigger node
   */
  private createEmptyFlow(): Flow {
    const now = new Date().toISOString();
    const triggerId = `node-${Date.now()}`;
    const inputId = `input-${Date.now()}`;
    const shortId = Math.random().toString(36).slice(2, 6);

    return {
      id: `untitled-flow-${shortId}`,
      name: 'Untitled Flow',
      description: '',
      version: 1,
      created: now,
      modified: now,
      inputs: [
        {
          id: inputId,
          type: 'text',
          label: 'Input',
          required: true,
        },
      ],
      nodes: [
        {
          id: triggerId,
          type: 'trigger',
          position: { x: 250, y: 50 },
          data: {
            label: 'Trigger',
            inputs: [
              {
                id: inputId,
                type: 'text',
                label: 'Input',
                required: true,
                defaultValue: '',
              },
            ],
          },
        },
      ],
      edges: [],
    };
  }

  /**
   * Fetch available models from provider API
   */
  private async fetchModels(
    provider: 'openai' | 'gemini',
    modelType: 'llm' | 'image',
    webview: vscode.Webview
  ): Promise<void> {
    try {
      let models: Array<{ id: string; name: string }>;

      if (provider === 'openai') {
        models = modelType === 'image'
          ? await this.fetchOpenAIImageModels()
          : await this.fetchOpenAIModels();
      } else {
        models = modelType === 'image'
          ? await this.fetchGeminiImageModels()
          : await this.fetchGeminiModels();
      }

      webview.postMessage({ type: 'flow:models', provider, modelType, models });
    } catch (err) {
      console.error(`[FlowEditorProvider] Failed to fetch ${provider} ${modelType} models:`, err);
      webview.postMessage({
        type: 'flow:models',
        provider,
        modelType,
        models: [],
        error: err instanceof Error ? err.message : 'Failed to fetch models'
      });
    }
  }

  /**
   * Show file picker dialog and send result back to webview
   */
  private async showFilePicker(
    inputId: string,
    label: string,
    workspacePath: string,
    webview: vscode.Webview
  ): Promise<void> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: `Select ${label}`,
      defaultUri: workspacePath ? vscode.Uri.file(workspacePath) : undefined,
      filters: {
        'Documents': ['md', 'txt', 'json', 'csv', 'xml', 'html', 'pdf'],
        'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
        'Code': ['ts', 'js', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb'],
        'All Files': ['*']
      }
    };

    const fileUri = await vscode.window.showOpenDialog(options);

    if (fileUri && fileUri[0]) {
      webview.postMessage({
        type: 'flow:filePicked',
        inputId,
        filePath: fileUri[0].fsPath,
      });
    }
  }

  /**
   * Show folder picker for Save File node
   */
  private async showFolderPicker(
    field: string,
    workspacePath: string,
    webview: vscode.Webview
  ): Promise<void> {
    const options: vscode.OpenDialogOptions = {
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Folder',
      defaultUri: workspacePath ? vscode.Uri.file(workspacePath) : undefined,
    };

    const folderUri = await vscode.window.showOpenDialog(options);

    if (folderUri && folderUri[0]) {
      // Make path relative to workspace
      let folderPath = folderUri[0].fsPath;
      if (workspacePath && folderPath.startsWith(workspacePath)) {
        folderPath = folderPath.substring(workspacePath.length + 1); // +1 for the slash
      }

      webview.postMessage({
        type: 'flow:folderPicked',
        field,
        folderPath,
      });
    }
  }

  /**
   * Fetch OpenAI LLM models
   */
  private async fetchOpenAIModels(): Promise<Array<{ id: string; name: string }>> {
    const apiKeyManager = getAPIKeyManager();
    const apiKey = await apiKeyManager.getAPIKey();

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.models.list();

    // Filter for chat models only and sort
    const chatModels = response.data
      .filter(m =>
        m.id.includes('gpt') ||
        m.id.includes('o1') ||
        m.id.includes('o3')
      )
      .filter(m =>
        !m.id.includes('instruct') &&
        !m.id.includes('vision') &&
        !m.id.includes('audio') &&
        !m.id.includes('realtime') &&
        !m.id.includes('tts') &&
        !m.id.includes('whisper') &&
        !m.id.includes('embedding') &&
        !m.id.includes('davinci') &&
        !m.id.includes('babbage') &&
        !m.id.includes('search') &&
        !m.id.includes('image')
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(m => ({
        id: m.id,
        name: this.formatModelName(m.id)
      }));

    return chatModels;
  }

  /**
   * Fetch OpenAI Image models
   */
  private async fetchOpenAIImageModels(): Promise<Array<{ id: string; name: string }>> {
    const apiKeyManager = getAPIKeyManager();
    const apiKey = await apiKeyManager.getAPIKey();

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.models.list();

    // Filter for image models
    const imageModels = response.data
      .filter(m =>
        m.id.includes('dall-e') ||
        m.id.includes('gpt-image') ||
        m.id.includes('image')
      )
      .sort((a, b) => {
        // Put gpt-image models first, then dall-e
        if (a.id.includes('gpt-image') && !b.id.includes('gpt-image')) return -1;
        if (!a.id.includes('gpt-image') && b.id.includes('gpt-image')) return 1;
        return a.id.localeCompare(b.id);
      })
      .map(m => ({
        id: m.id,
        name: this.formatImageModelName(m.id)
      }));

    return imageModels;
  }

  /**
   * Fetch Gemini models
   */
  private async fetchGeminiModels(): Promise<Array<{ id: string; name: string }>> {
    const apiKey = await this.context.secrets.get('google-ai-key');

    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Use v1beta to include preview models like Gemini 3
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Filter for generative models and format
    const models = (data.models || [])
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string; displayName?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', '')
      }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

    return models;
  }

  /**
   * Fetch Gemini Image models
   */
  private async fetchGeminiImageModels(): Promise<Array<{ id: string; name: string }>> {
    const apiKey = await this.context.secrets.get('google-ai-key');

    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Use v1beta to include preview models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Filter for image generation models (Imagen, Gemini image models)
    const models = (data.models || [])
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
        m.name.includes('imagen') ||
        m.name.includes('image') ||
        m.supportedGenerationMethods?.includes('generateImage')
      )
      .map((m: { name: string; displayName?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || this.formatImageModelName(m.name.replace('models/', ''))
      }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

    return models;
  }

  /**
   * Format model ID to display name
   */
  private formatModelName(id: string): string {
    // Common patterns
    const formatted = id
      .replace('gpt-', 'GPT-')
      .replace('o1-', 'o1-')
      .replace('o3-', 'o3-')
      .replace('-preview', ' Preview')
      .replace('-mini', ' Mini')
      .replace('-turbo', ' Turbo');
    return formatted;
  }

  /**
   * Format image model ID to display name
   */
  private formatImageModelName(id: string): string {
    const formatted = id
      .replace('dall-e-', 'DALL-E ')
      .replace('gpt-image-', 'GPT Image ')
      .replace('imagen-', 'Imagen ')
      .replace('-preview', ' Preview')
      .replace('-latest', ' Latest');
    return formatted;
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; connect-src https://api.openai.com https://generativelanguage.googleapis.com;">
  <title>Flow Editor</title>
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
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="flow"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
