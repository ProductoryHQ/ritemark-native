import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { RitemarkEditorProvider } from './ritemarkEditor';
import { ExcelEditorProvider } from './excelEditorProvider';
import { PdfEditorProvider } from './pdfEditorProvider';
import { OfficePreviewProvider, POWERPOINT_FORMAT, WORD_FORMAT } from './officePreview/officePreviewProvider';
import { DrawioEditorProvider } from './drawioEditorProvider';
import { isEnabled } from './features';
import { initAPIKeyManager } from './ai/apiKeyManager';
import { initConnectivity } from './ai/connectivity';
import { initAiStatusItem } from './ai/aiStatusItem';
import * as modelCatalog from './ai/modelCatalog';
import { discoverAnthropic, discoverOpenAI, discoverGemini, discoverCodex } from './ai/modelCatalog/providerDiscovery';
import { getSetupStatus } from './agent/setup';
import { CodexManager } from './codex/codexManager';
import { UnifiedViewProvider } from './views/UnifiedViewProvider';
import { registerFeedback } from './feedback/feedbackSheet';
import { registerFeedbackStatusBar } from './feedback/feedbackStatusBar';
import { GuidanceHost } from './guidance/GuidanceHost';
import { madeSomething } from './guidance/madeSomething';
import { CommentTaskStore, commentTaskStoreDir } from './commentTasks/CommentTaskStore';
import { CommentTaskController } from './commentTasks/CommentTaskController';
import { registerTaskBoard, type TaskBoardHost } from './taskBoard/taskBoardHost';
import { registerProjects, type ProjectsHost } from './projects/projectsHost';
import { registerProjectSearch } from './search/SearchHost';
import { buildCommentTaskPrompt } from './commentTasks/commentTaskPrompt';
import { createGoogleDocsFeature, type GoogleDocsFeature } from './googleDocs/vscodeGoogleDocs';
import { AgentLibraryViewProvider } from './views/AgentLibraryViewProvider';
import { FlowEditorProvider } from './flows/FlowEditorProvider';
import { FlowStorage } from './flows/FlowStorage';
import { createFlowScheduler, FlowScheduler } from './flows/FlowScheduler';
import { RitemarkSettingsProvider, isSettingsSection } from './settings/RitemarkSettingsProvider';
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
} from './browser/IntegratedBrowser';
import { BrowserHistoryStore } from './browser/BrowserHistoryStore';
import { BrowserNavigationRecorder, DID_NAVIGATE_COMMAND } from './browser/browserNavigationRecorder';
import { BrowserPanelProvider } from './browser/BrowserPanelProvider';
import { initDaemon } from './daemon/index';
import { findReplacedTextTab, findStuckMarkdownTabs } from './utils/stickyTabHealer';
import { registerProjectHeadCommands } from './views/projectHeadCommands';
import { prepareWelcome, registerWelcome, type WelcomeHost } from './welcome/welcomeHost';
import { newDocumentFolder, nextUntitledPath } from './newDocumentLocation';
// Feature flags: view visibility controlled by 'when' clauses in package.json

// Export unified view provider for editor access
export let unifiedViewProvider: UnifiedViewProvider;

/**
 * Sprint 117 (#292): the host-owned comment-task ledger and its controller.
 * Exported the same way as `unifiedViewProvider` so the custom editor provider
 * can route `comment-task/*` messages without a circular import at load time.
 */
export let commentTaskStore: CommentTaskStore | undefined;
export let commentTaskController: CommentTaskController | undefined;

/**
 * Sprint 119: Google Docs publishing. Exported like the comment-task stack so
 * the editor provider and the Settings page reach one controller without a
 * circular import at load time.
 */
export let googleDocs: GoogleDocsFeature | undefined;
/** The task board (Sprint 130): the Ritemark editor asks it which documents are card pages. */
export let taskBoard: TaskBoardHost | undefined;

// Agent Library view provider
let agentLibraryViewProvider: AgentLibraryViewProvider | null = null;

// Flows view provider
let flowScheduler: FlowScheduler | null = null;

// Settings provider
let settingsProvider: RitemarkSettingsProvider | null = null;

// The welcome (Sprint 133)
let welcomeHost: WelcomeHost | null = null;
let projectsHost: ProjectsHost | null = null;

// Sprint 118: Transcribe panel, so shutdown can close an in-progress recording cleanly
let transcribeView: { prepareForShutdown(): Promise<void> } | null = null;

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

/** The folder chosen in the tree (the shell's New File rule), when the shell has the command and it is a file folder. */
async function getChosenTreeFolder(): Promise<string | undefined> {
  try {
    const folder = await vscode.commands.executeCommand<vscode.Uri | undefined>('_ritemark.files.chosenFolder');
    return folder?.scheme === 'file' ? folder.fsPath : undefined;
  } catch {
    return undefined;
  }
}

/** Text and Table: in the project (the folder chosen in the tree, else its root), or the drafts folder with no project open. */
async function getNewDocumentFolder(): Promise<string> {
  const projectRoots = (vscode.workspace.workspaceFolders ?? [])
    .filter(folder => folder.uri.scheme === 'file')
    .map(folder => folder.uri.fsPath);
  const chosen = projectRoots.length > 0 ? await getChosenTreeFolder() : undefined;
  return newDocumentFolder(projectRoots, chosen) ?? getDraftsDirectory();
}

async function createDraftAndOpen(
  extension: string,
  viewType: string,
  initialContent?: string
): Promise<void> {
  const folder = await getNewDocumentFolder();
  let filePath = nextUntitledPath(folder, extension, fs.existsSync);
  // Never over an existing file: 'wx' fails if a file of that name appeared meanwhile, and the next name is tried
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.writeFile(filePath, initialContent ?? '', { encoding: 'utf8', flag: 'wx' });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt >= 2) {
        throw error;
      }
      filePath = nextUntitledPath(folder, extension, fs.existsSync);
    }
  }
  const uri = vscode.Uri.file(filePath);
  madeSomething.noteDraft(filePath); // Sprint 140 (R15): a new document, counted when first saved
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

  // Sprint 133 (R7, R10): someone new or someone updating from Ritemark 1, decided once
  // per profile before the activation keys are confirmed; Ritemark 1's usage-data answer
  // is carried over before analytics starts.
  const welcomeProfileKind = prepareWelcome(context);

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
  // Ritemark's themes are set up once per profile (Sprint 52). A theme the person chooses afterwards is theirs and
  // survives every update: this used to run again whenever the version changed, which reset a hand-chosen theme on
  // each update (Ritemark 2.0, R16, S45).
  const designFoundationsThemeMigration = 'sprint-52-design-foundations-v1';
  const lastDesignThemeMigration = context.globalState.get<string>('ritemark.designFoundationsThemeMigration');
  if (lastDesignThemeMigration !== designFoundationsThemeMigration) {
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
  // per-tab "Reopen With → Text Editor" choice is lost once, silently. Since
  // Sprint 133 (#429) it replaces the text tab, so the file ends with one tab.
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
          // Sprint 133 (R11, #429): replace the text tab instead of leaving it beside the Ritemark tab.
          // Found again after the open: the host may have replaced the tab objects meanwhile.
          if (candidate.replace) {
            const textTab = findReplacedTextTab(vscode.window.tabGroups.all, resolveTextInput, {
              path: candidate.uri.path,
              viewColumn: candidate.viewColumn,
            });
            if (textTab) {
              await vscode.window.tabGroups.close(textTab, true).then(undefined, (error: unknown) => {
                console.warn('[Ritemark] the healer could not close the text tab', error);
              });
            }
          }
        }
      } catch {
        // Inert on any failure — the healer must never produce user-visible noise.
      }
      void context.globalState.update('ritemark.stickyTabHealerVersion', stickyTabHealerVersion);
    }, 1500 /* after editor-group restore settles */);
  }

  // === Layout settings: EVERY startup ===
  // A terminal is a tab in 2.0 (Sprint 132, R8): terminal.integrated.defaultLocation
  // is 'editor' in package.json configurationDefaults, so it is not reset here.
  // AI panel location is enforced in VS Code core (viewDescriptorService.ts patch).
  (async () => {
    try {
      const wb = vscode.workspace.getConfiguration('workbench');
      await wb.update('layoutControl.enabled', true, vscode.ConfigurationTarget.Global);
      await wb.update('layoutControl.type', 'toggles', vscode.ConfigurationTarget.Global);
    } catch (e) {
      console.error('Ritemark: failed to set layout defaults', e);
    }
  })();

  // Show the AI panel after extension views register (terminal init finishes first and grabs focus).
  // Not while the welcome is open: it is alone in the window (Sprint 133, R1). It shows the column without taking the
  // keyboard from what has it, a document or a terminal (Sprint 144, P5).
  setTimeout(() => {
    if (welcomeHost?.isOpen()) return;
    vscode.commands.executeCommand('ritemark.unifiedView.focus', { preserveFocus: true });
  }, 4000);

  // Initialize API key manager (must be first)
  initAPIKeyManager(context);

  // Initialize executor contexts (for Gemini API key access)
  setLLMExtensionContext(context);
  setImageNodeExtensionContext(context);

  // Initialize connectivity monitoring (online detection; the status bar's AI item reads it, below)
  initConnectivity(context);

  // Initialize analytics: nothing is sent before the person's yes, on by default from the welcome (Sprint 133, R7)
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
  unifiedViewProvider = new UnifiedViewProvider(context.extensionUri, workspacePath, context.secrets, context.globalStorageUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(UnifiedViewProvider.viewType, unifiedViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    unifiedViewProvider,
  );

  // The status bar's AI item (Sprint 144, P3): the AI the next message goes to, and what Ritemark knows about it.
  initAiStatusItem(context, {
    runtimeAvailability: (runtimeId) => unifiedViewProvider.runtimeAvailability(runtimeId),
    openChat: () => unifiedViewProvider.openChatReport(),
    onDidChangeOpenChat: (listener) => unifiedViewProvider.onDidChangeOpenChat(listener),
    onDidUpdateModels: (listener) => modelCatalog.onUpdate(() => listener()),
  });

  // ── The feedback door (Sprint 140, R10–R13; was Sprint 126's AI output reporting) ──
  // Microsoft Store policy 11.16 wants a discoverable, working way to report
  // inappropriate generated output. "Send feedback" in the status bar is on
  // screen from launch, its tooltip names AI issues, and its sheet (patch 018)
  // has the AI-issue box; AI information keeps its labelled "Report an AI issue".
  registerFeedback(context, {
    appVersion: String(context.extension.packageJSON.version ?? 'unknown'),
    lastAnswer: () => unifiedViewProvider.lastAnswerOfOpenChat(),
    openReportWindow: () => unifiedViewProvider.openReportWindow(),
  });
  registerFeedbackStatusBar(context);

  // ── Comment tasks (Sprint 117, #292) ───────────────────────────────────────
  // One host-owned ledger for "send this comment to an agent". Composed here,
  // next to the conversation stack, so the editor provider and the AI sidebar
  // both talk to the SAME controller instead of relaying prompts to each other.
  commentTaskStore = new CommentTaskStore(commentTaskStoreDir(context.globalStorageUri.fsPath));
  commentTaskController = new CommentTaskController({
    store: commentTaskStore,
    isFeatureEnabled: () => isEnabled('comment-callouts'),
    buildPrompt: (document, comments) => buildCommentTaskPrompt(document.displayPath, comments),
    publishProjection: (documentUri, tasks) => {
      RitemarkEditorProvider.publishCommentTaskProjection(documentUri, tasks);
    },
    // Task and turn ids must be UUIDs — the record codec rejects anything else.
    randomId: () => randomUUID(),
    ...unifiedViewProvider.commentTaskHostDependencies(),
  });
  unifiedViewProvider.attachCommentTaskController(commentTaskController);
  // Work a crash or a quit abandoned mid-flight becomes an honest `interrupted`
  // with a Retry, instead of a comment that says "working" forever. Then the
  // retention sweep (30 days / 500 records). Runs in the background; failures
  // are logged, never thrown.
  void commentTaskController.sweepOnActivation((message, error) => {
    console.warn(`[commentTasks] ${message}`, error);
  });

  // ── Task board (Sprint 130, #119) ───────────────────────────────────────────
  // One board per window for the project folder: cards in `.ritemark/tasks/`,
  // the Tasks side bar, the Task board tab, the badge and the two commands.
  taskBoard = registerTaskBoard({
    context,
    runtimeAvailability: (runtimeId) => unifiedViewProvider.runtimeAvailability(runtimeId),
    cardSidebar: unifiedViewProvider.cardTaskHostDependencies(),
    attachTaskListener: (listener) => unifiedViewProvider.attachTaskListener(listener),
    oneShotSettings: (runtimeId) => unifiedViewProvider.oneShotSettings(runtimeId),
  });

  // ── Search, the words layer (Sprint 148, #591) ─────────────────────────────
  // The index of this window's project, in its own worker thread, and its results
  // view in Documents. It starts on the box's first words, or 5 s after activation
  // on a shell that draws the box (R4); the head's Search row runs it (below).
  const projectSearch = registerProjectSearch({
    context,
    taskBoard,
    boardEnabled: () => isEnabled('task-board'),
    opens: {
      openConversation: (conversationId, reveal) => unifiedViewProvider.openConversation(conversationId, reveal),
      openCard: async (cardId) => {
        if (isEnabled('task-board')) await taskBoard?.cardPages?.open({ cardId, preserveFocus: true });
      },
    },
  });

  // ── Google Docs publishing (Sprint 119) ────────────────────────────────────
  // Always composed, even with the flag off: flag-off hides the surfaces but
  // keeps the account and document links readable, so turning it back on
  // restores them without a network call (R10).
  googleDocs = createGoogleDocsFeature(
    context,
    () => isEnabled('google-docs-publishing'),
    (message) => console.log(message),
  );

  // Model catalog (Sprint 89, GH #109): resolve model lists via live provider probes
  // → remote catalog (ritemark-public) → on-disk cache → bundled baseline. The live
  // provider uses the user's own API keys (Anthropic /v1/models is provider-cadence and
  // supersedes the bundled SDK's supportedModels()). Never throws; getModels()/getDefault()
  // serve the bundled floor immediately.
  modelCatalog.setDiscoveryProvider(async () => {
    const results: modelCatalog.DiscoveryResults = {};
    const claudeSetup = await getSetupStatus();
    results.codex = await discoverCodex(await new CodexManager().getVersion());
    // Sprint 127 R2: the Claude list describes the account that runs requests —
    // /v1/models only when Claude Code itself runs on Ritemark's API key
    // (same rule as UnifiedViewProvider's session setup); otherwise the
    // runtime's own list plus the models the catalog declares to it (R1).
    results.anthropic = await discoverAnthropic({
      apiKey: claudeSetup.authMethod === 'api-key'
        ? (await context.secrets.get('anthropic-api-key')) ?? null
        : null,
      workspacePath,
      binaryPath: claudeSetup.binaryPath,
      declarations: modelCatalog.getClaudeRuntimeDeclarations(),
    });
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

  // Sprint 134 (Ritemark 2.0, step 3): the project at the centre. Home's place holds the projects list
  // (in 1.x's Home launcher's slot, `ritemark.homeView`), Home is the project's own first tab, Home and
  // Tasks are the first two tabs, and switching projects asks first while a chat works.
  // Sprint 140: the first day's guidance: Home's one card, the empty sheet's starting place, the day-one counts.
  const guidanceFolder = vscode.workspace.workspaceFolders?.[0];
  const guidance = guidanceFolder?.uri.scheme === 'file' && !vscode.workspace.workspaceFile ? new GuidanceHost({
    context,
    folder: guidanceFolder,
    runtimeAvailability: (runtimeId) => unifiedViewProvider.runtimeAvailability(runtimeId),
    startChat: (request) => unifiedViewProvider.startChat(request),
    startCodexSignIn: (onStatus) => unifiedViewProvider.startCodexSignIn(onStatus),
    stopCodexSignIn: () => unifiedViewProvider.stopCodexSignIn(),
    give: async (cardId, runtimeId) => {
      const board = isEnabled('task-board') ? taskBoard?.controller ?? null : null;
      if (!board) return null;
      const answer = await board.give(cardId, runtimeId);
      return answer.ok ? { ok: true } : { ok: false, message: answer.message };
    },
    hasWorkingTurn: () => unifiedViewProvider.hasWorkingTurn(),
    setStartingPlace: (place, hasAbout) => unifiedViewProvider.setStartingPlace(place, hasAbout),
    onTurnAccepted: (listener) => unifiedViewProvider.onTurnAccepted(listener),
    onChatOrigin: (listener) => unifiedViewProvider.onChatOrigin(listener),
    openConversation: (conversationId) => unifiedViewProvider.openConversation(conversationId),
  }) : null;
  if (guidance) context.subscriptions.push(guidance);

  projectsHost = registerProjects({
    context,
    taskBoard,
    boardEnabled: () => isEnabled('task-board'),
    openConversation: (conversationId) => unifiedViewProvider.openConversation(conversationId),
    workingChats: () => unifiedViewProvider.workingChats(),
    stopWorkingChats: () => unifiedViewProvider.stopWorkingChats(),
    guidance,
    onTurnAccepted: (listener) => unifiedViewProvider.onTurnAccepted(() => listener()),
  });

  // Sprint 108: Transcribe. Flag-gated (D4 ships it on Windows too). Where the
  // on-device engine can't run, the registry says so rather than the whole view
  // disappearing (Sprint 129: it runs on Windows and Intel Macs as well). Jobs live in the subsystem, not the view, so a
  // running transcription survives the panel being closed.
  if (isEnabled('transcription-workbench')) {
    const { createSpeechSubsystem } = require('./speech') as typeof import('./speech');
    const { TranscribeViewProvider } = require('./views/TranscribeViewProvider') as typeof import('./views/TranscribeViewProvider');

    const { TranscriptWorkbenchProvider } = require('./transcriptWorkbenchProvider') as typeof import('./transcriptWorkbenchProvider');

    const { setTranscriptDocumentResolver } = require('./speech/activeTranscript') as typeof import('./speech/activeTranscript');

    const speech = createSpeechSubsystem(context);
    void speech.jobs.recoverInterrupted();

    // So "ask Claude about this recording" means the transcript, not the
    // unreadable .m4a the workbench tab is technically showing.
    setTranscriptDocumentResolver((audioPath) => speech.store.getSavedDocumentSync(audioPath));


    const workbenchProvider = new TranscriptWorkbenchProvider(
      context,
      speech.registry,
      speech.jobs,
      speech.store,
    );
    context.subscriptions.push(
      workbenchProvider,
      vscode.window.registerCustomEditorProvider(TranscriptWorkbenchProvider.viewType, workbenchProvider, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }),
    );

    const transcribeViewProvider = new TranscribeViewProvider(
      context.extensionUri,
      speech.registry,
      speech.jobs,
      speech.store,
      context.globalState,
      workbenchProvider,
    );
    transcribeView = transcribeViewProvider;
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
  // Ritemark 2.0 (experience 31): New and Search at the head of the Agents column
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.agentLibrary.newAgent', () => agentLibraryViewProvider?.openCreate('agent')),
    vscode.commands.registerCommand('ritemark.agentLibrary.newSkill', () => agentLibraryViewProvider?.openCreate('skill')),
    vscode.commands.registerCommand('ritemark.agentLibrary.newCommand', () => agentLibraryViewProvider?.openCreate('command')),
    vscode.commands.registerCommand('ritemark.agentLibrary.search', () => agentLibraryViewProvider?.focusSearch()),
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
        // Only the Agent Library's own folders: Claude Code writes its sessions under
        // ~/.claude/projects all the time, and each write refreshed the library.
        const userWatcher = fs.watch(userClaudeRoot, { recursive: true }, (_event, filename) => {
          const top = String(filename ?? '').split(/[\\/]/)[0];
          if (!filename || top === 'agents' || top === 'skills' || top === 'commands') {
            agentLibraryViewProvider?.refresh();
          }
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
  // No terminal opens by itself (Sprint 132, R8): the tab row's + and Ctrl+` make one.

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

  // Cmd+Z / Cmd+Shift+Z inside the Ritemark editor: the webview's ProseMirror
  // history handles the keystroke natively, but the webview host forwards every
  // keydown to the workbench, where the built-in `undo`/`redo` commands reach the
  // custom editor's text-document undo stack (each sync applyEdit is an undo
  // stop there). Two stacks undoing one keystroke fought through the sync
  // coordinator: a phantom first Cmd+Z, lost Enters, duplicated items on redo.
  // Shadow the built-in commands while a Ritemark editor is active and no
  // workbench input has focus, so the editor's own history is the only one.
  // A removal rule (`-undo`) does not reach the built-in binding; a positive
  // binding with a `when` clause does.
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.editor.undoHandledByEditor', () => undefined),
    vscode.commands.registerCommand('ritemark.editor.redoHandledByEditor', () => undefined),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newDocument', async () => {
      await createDraftAndOpen('md', RitemarkEditorProvider.viewType);
    }),
    // Sprint 134 (R8): File ▸ Share, the Share menu of the document in front.
    vscode.commands.registerCommand('ritemark.document.share', () => {
      RitemarkEditorProvider.openShareMenu();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.newTable', async () => {
      await createDraftAndOpen('csv', RitemarkEditorProvider.viewType, buildCsvTemplate());
    })
  );

  // The left column's head: its menus' entries (Ritemark 2.0, Sprint 132); the Search row runs Ritemark's search (Sprint 148)
  registerProjectHeadCommands(context, { search: (arg) => projectSearch.runSearchRow(arg) });

  // Initialize Settings Provider
  settingsProvider = new RitemarkSettingsProvider(context, updateService);
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(RitemarkSettingsProvider.viewType, settingsProvider),
    { dispose: () => settingsProvider?.dispose() }
  );

  // The welcome (Sprint 133): a window with no folder opens on one sheet, and the
  // landing after it reloads into a folder. Its checks and sign-ins are the AI sheet's.
  welcomeHost = registerWelcome(context, welcomeProfileKind, {
    runtimeAvailability: (runtimeId) => unifiedViewProvider.runtimeAvailability(runtimeId),
    startCodexSignIn: (onStatus) => unifiedViewProvider.startCodexSignIn(onStatus),
    stopCodexSignIn: () => unifiedViewProvider.stopCodexSignIn(),
    verifyCodexSignIn: () => unifiedViewProvider.verifyCodexSignIn(),
    openLandingChat: (runtimeId, placeholder) => unifiedViewProvider.openLandingChat(runtimeId, placeholder),
  }, projectsHost ? {
    ready: projectsHost.ready,
    entries: () => projectsHost!.projectList.entries(vscode.workspace.workspaceFolders?.[0]?.uri.toString()),
    revealHome: () => projectsHost!.revealHome(),
  } : undefined);

  // Sprint 144 (P5, #569): in a project window the AI column comes back with the window. The layout starts it hidden
  // and only the 4 s focus above brought it back, so Home laid out at full width and reflowed when it came (measured:
  // 3.2-4.6 s after Home on every switch). The later focus still runs, for the terminal's sake. Never beside the welcome,
  // which is alone in a window with no folder and in the update welcome (Sprint 133, R1): it opens after an await, so
  // ask whether it may open, not whether it is open.
  // It shows the column and leaves the keyboard where it is, as the task board's handoff does (UnifiedViewProvider).
  if (vscode.workspace.workspaceFolders?.length && !welcomeHost?.mayOpenAtStart()) {
    void vscode.commands.executeCommand('ritemark.unifiedView.focus', { preserveFocus: true });
  }

  // Register chat history command (toggles history panel in webview)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.chatHistory', () => {
      unifiedViewProvider.toggleHistoryPanel();
    })
  );

  // Register AI settings command (opens branded settings page)
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.aiSettings', (section?: unknown) => {
      settingsProvider?.open(isSettingsSection(section) ? section : undefined);
    })
  );

  // Transcribe's gear opens Settings at transcription's own settings, not at the top of the page
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.transcribe.openSettings', () => settingsProvider?.open('transcription'))
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

  // Health status: Git, Node.js and each AI's sign-in (1.x's launch check; Settings and the welcome read the same sources)
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

  // Register the Office previews (read-only): Word, and PowerPoint (Sprint 125). The
  // PowerPoint editor is registered even with its flag off, so a deck says the preview
  // is off and offers PowerPoint instead of falling to the binary-file message.
  context.subscriptions.push(
    OfficePreviewProvider.register(context, WORD_FORMAT),
    OfficePreviewProvider.register(context, POWERPOINT_FORMAT)
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
  // Sprint 131 (#195): patch 009 reports every navigation of a shown browser tab
  // to DID_NAVIGATE_COMMAND; the recorder decides what counts as a visit.
  const browserHistoryStore = new BrowserHistoryStore(context.globalState);
  const browserNavigationRecorder = new BrowserNavigationRecorder(browserHistoryStore);
  const browserPanelProvider = new BrowserPanelProvider(browserHistoryStore, context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BrowserPanelProvider.viewId,
      browserPanelProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand(DID_NAVIGATE_COMMAND, (event: unknown) =>
      browserNavigationRecorder.handle(event)
    ),
    browserPanelProvider,
    browserNavigationRecorder,
    browserHistoryStore
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
    }),
    // Sprint 134 (R18): the Browser place's head row, New page (the Experience lead, 19 October); hidden in the
    // palette, where New browser tab stays
    vscode.commands.registerCommand('ritemark.browser.newPage', async () => {
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
  // First and synchronous: a project switch's notes for the next window, now that this window is really going (#623).
  projectsHost?.switcher.writePendingNotes();
  await transcribeView?.prepareForShutdown();
  await unifiedViewProvider?.prepareForShutdown();
  await shutdownAnalytics();
}
