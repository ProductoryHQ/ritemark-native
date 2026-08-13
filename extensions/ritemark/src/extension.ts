import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RitemarkEditorProvider } from './ritemarkEditor';
import { ExcelEditorProvider } from './excelEditorProvider';
import { PdfEditorProvider } from './pdfEditorProvider';
import { DocxEditorProvider } from './docxEditorProvider';
import { DrawioEditorProvider } from './drawioEditorProvider';
import { isEnabled } from './features';
import { initAPIKeyManager } from './ai/apiKeyManager';
import { initConnectivity } from './ai/connectivity';
import * as modelCatalog from './ai/modelCatalog';
import { discoverAnthropic, discoverOpenAI, discoverGemini, discoverCodex } from './ai/modelCatalog/providerDiscovery';
import { UnifiedViewProvider } from './views/UnifiedViewProvider';
import { AgentLibraryViewProvider } from './views/AgentLibraryViewProvider';
import { FlowEditorProvider } from './flows/FlowEditorProvider';
import { FlowStorage } from './flows/FlowStorage';
import { createFlowScheduler, FlowScheduler } from './flows/FlowScheduler';
import { RitemarkSettingsProvider } from './settings/RitemarkSettingsProvider';
import { setExtensionContext as setLLMExtensionContext } from './flows/nodes/LLMNodeExecutor';
import { setImageNodeExtensionContext } from './flows/nodes/ImageNodeExecutor';
import { registerFlowTestCommand } from './flows/FlowTestRunner';
import { registerConfigureApiKeyCommand, registerCheckApiKeyCommand } from './commands/configureApiKey';
import {
  UpdateService,
  UpdateStorage,
  scheduleStartupCheck,
  UpdateStatusBar,
  RELAUNCH_COMMAND_ID,
  ActivationIntegrityTracker,
  quarantineVersion,
  confirmActivationAndCleanup
} from './update';
import { initAnalytics, shutdownAnalytics } from './analytics/posthog';
import { registerReactionCommand } from './analytics/reactions';
import { BrowserTerminalLinkProvider } from './browser/BrowserTerminalLinkProvider';
import {
  goBackInIntegratedBrowser,
  goForwardInIntegratedBrowser,
  openEmptyBrowserTab,
  openInIntegratedBrowser,
  openIntegratedBrowserUrlExternally,
  reloadIntegratedBrowser,
  setBrowserHistoryStore,
} from './browser/IntegratedBrowser';
import { BrowserHistoryStore } from './browser/BrowserHistoryStore';
import { BrowserPanelProvider } from './browser/BrowserPanelProvider';
import { initDaemon } from './daemon/index';
import { findStuckMarkdownTabs } from './utils/stickyTabHealer';
// Feature flags: view visibility controlled by 'when' clauses in package.json

// Export unified view provider for editor access
export let unifiedViewProvider: UnifiedViewProvider;

// Agent Library view provider
let agentLibraryViewProvider: AgentLibraryViewProvider | null = null;

// Flows view provider
let flowScheduler: FlowScheduler | null = null;

// Settings provider
let settingsProvider: RitemarkSettingsProvider | null = null;

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
  await agentLibraryViewProvider?.refresh?.();
}

/**
 * Seed Anthropic's skill-creator and Ritemark-authored starters into ~/.claude/
 * on first run, so a brand-new install doesn't open to an empty Agent Library.
 *
 * Detection (all must be true):
 *   - ~/.claude/skills/ is empty or absent
 *   - ~/.claude/agents/ is empty or absent
 *   - ~/.ritemark/starter-pack-seeded marker file does not exist
 *
 * The marker is the durable signal: if a user later clears their library, we
 * do not re-seed — they own their copy. Existing files are never overwritten.
 */
function seedStarterPackOnFirstRun(extensionPath: string): void {
  try {
    const userClaudeRoot = path.join(os.homedir(), '.claude');
    const skillsDir = path.join(userClaudeRoot, 'skills');
    const agentsDir = path.join(userClaudeRoot, 'agents');
    const markerPath = path.join(os.homedir(), '.ritemark', 'starter-pack-seeded');

    if (fs.existsSync(markerPath)) return;
    const skillsBusy = fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length > 0;
    const agentsBusy = fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length > 0;
    if (skillsBusy || agentsBusy) return;

    const starterRoot = path.join(extensionPath, 'starter-pack');
    if (!fs.existsSync(starterRoot)) return;

    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    const copySkills = path.join(starterRoot, 'skills');
    if (fs.existsSync(copySkills)) {
      for (const entry of fs.readdirSync(copySkills, { withFileTypes: true })) {
        const target = path.join(skillsDir, entry.name);
        if (fs.existsSync(target)) continue;
        copyRecursive(path.join(copySkills, entry.name), target);
      }
    }
    const copyAgents = path.join(starterRoot, 'agents');
    if (fs.existsSync(copyAgents)) {
      for (const entry of fs.readdirSync(copyAgents, { withFileTypes: true })) {
        const target = path.join(agentsDir, entry.name);
        if (fs.existsSync(target)) continue;
        copyRecursive(path.join(copyAgents, entry.name), target);
      }
    }

    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ seededAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (err) {
    // Best-effort: a failed seed should never block extension activation.
    // Marker file is intentionally not written so the next launch retries.
    console.warn('[Ritemark] starter-pack seed failed:', err);
  }
}

function copyRecursive(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      copyRecursive(path.join(src, entry.name), path.join(dest, entry.name));
    }
  } else if (stat.isFile()) {
    fs.copyFileSync(src, dest);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // === Theme & branding: fresh install, version upgrade, or design-foundation migration ===
  const currentVersion = context.extension.packageJSON.version as string;

  // Sprint 93 R9: rollback safety. If THIS exact version already started
  // activating on a prior launch but never confirmed success (a runtime
  // crash mid-activation), quarantine it now so the next restart falls
  // through to the kept N-1 version via VS Code's own extension-directory
  // dedup (confirmed in tasks.md W3.4). See activationIntegrity.ts for the
  // documented limitation on load-time (syntax error) failures.
  const activationIntegrity = new ActivationIntegrityTracker(context.globalState);
  const versionQuarantinedThisLaunch = activationIntegrity.didPreviousAttemptFail(currentVersion);
  if (versionQuarantinedThisLaunch) {
    console.warn(`Ritemark: ${currentVersion} failed to activate on the previous attempt — quarantining and requesting reload.`);
    void quarantineVersion(currentVersion).then(() => {
      void vscode.window.showWarningMessage(
        `Ritemark ${currentVersion} failed to start correctly last time. Reverting to the previous version.`,
        'Reload Window'
      ).then(selection => {
        if (selection === 'Reload Window') {
          void vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    });
  }
  void activationIntegrity.setLastAttemptedVersion(currentVersion);
  const designFoundationsThemeMigration = 'sprint-52-design-foundations-v1';
  const lastThemeVersion = context.globalState.get<string>('ritemark.themeAppliedVersion');
  const lastDesignThemeMigration = context.globalState.get<string>('ritemark.designFoundationsThemeMigration');
  if (lastThemeVersion !== currentVersion || lastDesignThemeMigration !== designFoundationsThemeMigration) {
    setTimeout(async () => {
      const wb = vscode.workspace.getConfiguration('workbench');
      const win = vscode.workspace.getConfiguration('window');
      await win.update('autoDetectColorScheme', true, vscode.ConfigurationTarget.Global);
      await wb.update('iconTheme', 'ritemark-icons', vscode.ConfigurationTarget.Global);
      await wb.update('preferredLightColorTheme', 'ritemark-light', vscode.ConfigurationTarget.Global);
      await wb.update('preferredDarkColorTheme', 'ritemark-dark', vscode.ConfigurationTarget.Global);
      context.globalState.update('ritemark.themeAppliedVersion', currentVersion);
      context.globalState.update('ritemark.designFoundationsThemeMigration', designFoundationsThemeMigration);
    }, 1500);
  }

  // === Sprint 107 R3: one-shot sticky markdown-tab healer ===
  // Profiles bitten by the pre-R1 bug can have .md files permanently pinned
  // open in the PLAIN TEXT editor. Once per profile (globalState marker,
  // same pattern as the theme migration above), reopen every file-scheme
  // .md/.markdown TEXT tab in Ritemark's editor, best-effort preserving
  // active state and view column. Named tradeoff (spec R3): a deliberate
  // per-tab "Reopen With → Text Editor" choice is lost once, silently.
  const stickyTabHealerVersion = 'sprint-107-v1';
  if (context.globalState.get<string>('ritemark.stickyTabHealerVersion') !== stickyTabHealerVersion) {
    setTimeout(async () => {
      try {
        const resolveTextInput = (input: unknown): { path: string } | null =>
          input instanceof vscode.TabInputText && input.uri.scheme === 'file'
            ? input.uri
            : null;
        const candidates = findStuckMarkdownTabs(vscode.window.tabGroups.all, resolveTextInput);
        for (const candidate of candidates) {
          await vscode.commands.executeCommand('vscode.openWith', candidate.uri, 'ritemark.editor', {
            preview: false,
            preserveFocus: !candidate.isActive,
            viewColumn: candidate.viewColumn,
          });
        }
      } catch {
        // Inert on any failure — the healer must never produce user-visible noise.
      }
      void context.globalState.update('ritemark.stickyTabHealerVersion', stickyTabHealerVersion);
    }, 1500 /* after editor-group restore settles */);
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

  // Focus AI panel after extension views register (terminal init finishes first and grabs focus).
  setTimeout(() => {
    vscode.commands.executeCommand('ritemark.unifiedView.focus');
  }, 4000);

  // Initialize API key manager (must be first)
  initAPIKeyManager(context);

  // Initialize executor contexts (for Gemini API key access)
  setLLMExtensionContext(context);
  setImageNodeExtensionContext(context);

  // Initialize connectivity monitoring (status bar + online detection)
  initConnectivity(context);

  // Initialize analytics (anonymous usage tracking + reactions)
  initAnalytics(context);
  registerReactionCommand(context);

  // Initialize scheduled tasks daemon (Sprint 80)
  const daemon = initDaemon(context, () => agentLibraryViewProvider);

  // Initialize update service
  const updateStorage = new UpdateStorage(context.globalState);
  const updateStatusBar = new UpdateStatusBar();
  context.subscriptions.push(updateStatusBar);
  const updateService = new UpdateService(updateStorage, (version) => updateStatusBar.show(version));

  // Sprint 93 R7: clicking the "Relaunch to update" status-bar item reloads
  // the window. No confirmation dialog — the staged version is already the
  // active one on disk (atomic-rename in userExtensionInstaller.ts), so
  // there's no separate "activate" step short of a reload.
  context.subscriptions.push(
    vscode.commands.registerCommand(RELAUNCH_COMMAND_ID, () => {
      void vscode.commands.executeCommand('workbench.action.reloadWindow');
    })
  );

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

  // Model catalog (Sprint 89, GH #109): resolve model lists via live provider probes
  // → remote catalog (ritemark-public) → on-disk cache → bundled baseline. The live
  // provider uses the user's own API keys (Anthropic /v1/models is provider-cadence and
  // supersedes the bundled SDK's supportedModels()). Never throws; getModels()/getDefault()
  // serve the bundled floor immediately.
  modelCatalog.setDiscoveryProvider(async () => {
    const results: modelCatalog.DiscoveryResults = {};
    results.codex = await discoverCodex();
    results.anthropic = await discoverAnthropic({ apiKey: (await context.secrets.get('anthropic-api-key')) ?? null });
    results.openai = await discoverOpenAI((await context.secrets.get('openai-api-key')) ?? null);
    results.gemini = await discoverGemini((await context.secrets.get('google-ai-key')) ?? null);
    return results;
  });
  void modelCatalog.activate(context).catch((err) => console.warn('[modelCatalog] activate failed', err));
  // Push refreshed model lists to the sidebar when the catalog resolves (spec R1/R4).
  context.subscriptions.push(
    modelCatalog.onUpdate(() => unifiedViewProvider?.notifyModelCatalogUpdated())
  );

  // First-run starter-pack seeding — must run before the provider's first
  // discovery so seeded items appear immediately in the sidebar.
  seedStarterPackOnFirstRun(context.extensionPath);

  // Sprint 106 (#74): Home / first-task launcher — persistent re-entry point.
  // Flag-gated (home-launcher, experimental kill-switch); reuses existing
  // commands only, no duplicate creation logic.
  // Sprint 106 (#74): the Home view is contributed unconditionally (a
  // when-gated sole view left the container hidden via hideIfEmpty before the
  // context key could be set). The provider itself honors the kill-switch: with
  // the flag off it renders a one-line disabled notice instead of the launcher.
  {
    const { HomeViewProvider } = require('./views/HomeViewProvider') as typeof import('./views/HomeViewProvider');
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(HomeViewProvider.viewType, new HomeViewProvider(context.extensionUri, isEnabled('home-launcher'))),
    );
  }

  // Sprint 108: Transcribe. Flag-gated (D4 ships it on Windows too — only the
  // on-device engine is macOS-only, and the registry says so rather than the
  // whole view disappearing). Jobs live in the subsystem, not the view, so a
  // running transcription survives the panel being closed.
  if (isEnabled('transcription-workbench')) {
    const { createSpeechSubsystem } = require('./speech') as typeof import('./speech');
    const { TranscribeViewProvider } = require('./views/TranscribeViewProvider') as typeof import('./views/TranscribeViewProvider');

    const speech = createSpeechSubsystem(context);
    void speech.jobs.recoverInterrupted();

    const transcribeViewProvider = new TranscribeViewProvider(
      context.extensionUri,
      speech.registry,
      speech.jobs,
      speech.store,
      context.globalState,
    );
    context.subscriptions.push(
      transcribeViewProvider,
      vscode.window.registerWebviewViewProvider(TranscribeViewProvider.viewType, transcribeViewProvider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
    );
  }

  // Register Agent Library View Provider
  agentLibraryViewProvider = new AgentLibraryViewProvider(context.extensionUri, workspacePath, daemon.store, daemon);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentLibraryViewProvider.viewType, agentLibraryViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  // Live-refresh the Agent Library SCHEDULED section when daemon runs change
  daemon.onRunsChanged(() => agentLibraryViewProvider?.refresh());

  // === File watchers for Agent Library auto-refresh ===
  // Workspace-side: VS Code's watcher catches .claude/ changes inside the workspace.
  if (workspacePath) {
    const workspaceClaudeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspacePath, '.claude/{agents,skills,commands}/**/*.md')
    );
    const refreshLib = () => agentLibraryViewProvider?.refresh();
    workspaceClaudeWatcher.onDidCreate(refreshLib);
    workspaceClaudeWatcher.onDidChange(refreshLib);
    workspaceClaudeWatcher.onDidDelete(refreshLib);
    context.subscriptions.push(workspaceClaudeWatcher);
  }

  // User-side: ~/.claude/ is outside the workspace, so VS Code's watcher won't see it.
  // Use Node's fs.watch with recursive mode, falling back to polling on systems
  // (e.g. some Linux distros) that don't support recursive watch.
  try {
    const userClaudeRoot = path.join(os.homedir(), '.claude');
    if (fs.existsSync(userClaudeRoot)) {
      try {
        const userWatcher = fs.watch(userClaudeRoot, { recursive: true }, () => {
          agentLibraryViewProvider?.refresh();
        });
        context.subscriptions.push({ dispose: () => userWatcher.close() });
      } catch {
        const pollInterval = setInterval(() => {
          agentLibraryViewProvider?.refresh();
        }, 5000);
        context.subscriptions.push({ dispose: () => clearInterval(pollInterval) });
      }
    }
  } catch {
    // best-effort; failure here is non-fatal.
  }

  // FlowsViewProvider sidebar panel removed (Sprint 77 R3): flows now appear
  // as a section inside the Agent Library. FlowsViewProvider class is kept for
  // use as the flow editor target.
  if (workspacePath) {
    flowScheduler = createFlowScheduler(context, workspacePath, {
      onRuntimeStateChanged: async () => {
        await agentLibraryViewProvider?.refresh?.();
      },
    });
    flowScheduler.start();
    context.subscriptions.push(flowScheduler);
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

  // Manual explorer refresh — exposed as a title-bar button so users have a
  // visible "kick the tree" affordance when fsevents misses an external change
  // (rare but real on deep paths with spaces / unicode). Same plumbing as the
  // automatic post-agent refresh.
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.explorer.refresh', () => {
      void vscode.commands
        .executeCommand('workbench.files.action.refreshFilesExplorer')
        .then(undefined, () => undefined);
    })
  );

  // Register new chat command (clears conversation)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newChat', () => {
      unifiedViewProvider.clearChat();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.pinAgent', (agentId: string, filePath: string) => {
      unifiedViewProvider.pinAgent(agentId, filePath);
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
      await agentLibraryViewProvider?.refresh?.();
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

  // Register draw.io diagram editor (Sprint 82)
  if (isEnabled('drawio-diagrams')) {
    context.subscriptions.push(
      DrawioEditorProvider.register(context)
    );
  }

  // ---------------------------------------------------------------------------
  // Browser tab (Sprint 65)
  // ---------------------------------------------------------------------------

  // Sprint 65 pivot: use the shell-level Electron BrowserView implementation
  // (`workbench.action.browser.*`) rather than the extension webview/iframe
  // prototype. Real webContents can render external sites and workspace file://
  // URLs without iframe embedding restrictions.

  // HTML opener: handled at the workbench-level editor resolver (patch 010,
  // BrowserEditorResolverContribution). The previous extension-side reactive
  // listener (BrowserHtmlOpenRedirector) caused visible text-tab flicker
  // before redirecting; the resolver intercepts the open at the resolver
  // layer so the text editor never opens in the first place.

  // Browser history store + Activity Bar panel (Indigo-Editorial webview).
  const browserHistoryStore = new BrowserHistoryStore(context.globalState);
  setBrowserHistoryStore(browserHistoryStore);
  const browserPanelProvider = new BrowserPanelProvider(browserHistoryStore, context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BrowserPanelProvider.viewId,
      browserPanelProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    browserPanelProvider,
    browserHistoryStore,
    { dispose: () => setBrowserHistoryStore(undefined) }
  );

  context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider(
      new BrowserTerminalLinkProvider(openInIntegratedBrowser)
    )
  );

  // Command: open URL via input box
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.openUrl', async () => {
      const raw = await vscode.window.showInputBox({
        prompt: 'Enter a URL to open in Ritemark Browser',
        placeHolder: 'https://…, localhost:PORT, or file:///…',
        validateInput: (value) => {
          if (!value.trim()) return 'URL must not be empty.';
          return null;
        },
      });
      if (!raw) return;
      try {
        await openInIntegratedBrowser(raw);
      } catch (err) {
        void vscode.window.showErrorMessage(
          err instanceof Error ? err.message : String(err)
        );
      }
    })
  );

  // Command: go back in active browser tab
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.back', async () => {
      await goBackInIntegratedBrowser();
    })
  );

  // Command: go forward in active browser tab
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.forward', async () => {
      await goForwardInIntegratedBrowser();
    })
  );

  // Command: refresh active browser tab
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.refresh', async () => {
      await reloadIntegratedBrowser();
    })
  );

  // Command: open current browser URL externally, or a manually entered URL if
  // invoked outside an active browser editor.
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.openInSystemBrowser', async () => {
      try {
        await openIntegratedBrowserUrlExternally();
      } catch {
        const raw = await vscode.window.showInputBox({
          prompt: 'URL to open in system browser',
          placeHolder: 'https://…',
        });
        if (raw) await openIntegratedBrowserUrlExternally(raw);
      }
    })
  );

  // Command: open .html file as plain text (right-click "Open as Text")
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ritemark.browser.openAsText',
      (uri?: vscode.Uri) => {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target) return;
        // Explicit text-editor open via `vscode.openWith` with the built-in
        // 'default' editor ID. The workbench-level HTML resolver matches by
        // priority, not editor ID, so passing 'default' here bypasses it.
        void vscode.commands.executeCommand('vscode.openWith', target, 'default');
      }
    )
  );

  // Command: open .html file in the native Electron BrowserView.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ritemark.browser.openInBrowser',
      async (uri?: vscode.Uri) => {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target) return;
        try {
          await openInIntegratedBrowser(target);
        } catch (err) {
          void vscode.window.showErrorMessage(
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    )
  );

  // Command: open empty browser tab (Activity Bar "New Tab" button).
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.newTab', async () => {
      await openEmptyBrowserTab();
    })
  );

  // Commands: open / remove / clear Recent URLs from the Activity Bar panel.
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.browser.history.open', async (url: string) => {
      if (!url) return;
      try {
        await openInIntegratedBrowser(url);
      } catch (err) {
        void vscode.window.showErrorMessage(
          err instanceof Error ? err.message : String(err)
        );
      }
    }),
    vscode.commands.registerCommand('ritemark.browser.history.clearAll', async () => {
      await browserHistoryStore.clear();
    })
  );

  // Sprint 93 R9: activate() reached its end with no synchronous throw —
  // confirm this version and trim old installs down to N-1 (current +
  // previously-confirmed), never just "the newest one." Skip when this same
  // launch already quarantined the current version (a prior-attempt failure):
  // its directory was just deleted, so it must not be re-recorded as
  // confirmed-good — otherwise state and disk would disagree.
  if (!versionQuarantinedThisLaunch) {
    void confirmActivationAndCleanup(activationIntegrity, currentVersion);
  }
}

export async function deactivate() {
  await shutdownAnalytics();
}
