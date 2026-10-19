/**
 * The welcome (Sprint 133): one calm sheet in a window with no folder that
 * asks which AI the person uses, signs them in with that provider's own
 * sign-in, asks where their work is and lands them on the project with the AI
 * ready beside it. Someone updating from Ritemark 1 sees a shorter sheet once;
 * a finished profile's window with no folder gets "Where do you want to start?".
 *
 * Composition only: the rules live in the pure modules beside this one
 * (`welcomeState`, `updateDetection`, `landing`, `newProject`,
 * `sampleProject`, `recentProjects`), each unit tested. Every provider check
 * and sign-in goes through the code that answers today (E2):
 * `UnifiedViewProvider.runtimeAvailability`, `beginClaudeLogin` and the AI
 * sheet's Codex runtime.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { RuntimeAvailability } from '../runtime/availability';
import type { AgentId } from '../agent/types';
import type { CodexSidebarStatus } from '../codex/CodexRuntime';
import { beginClaudeLogin, cancelClaudeLogin } from '../agent/claudeLogin';
import { getAgentEnvironmentStatus, getSetupStatus, setAnthropicKeyAvailable } from '../agent/setup';
import { emitClaudeStatusInvalidated, onClaudeStatusInvalidated } from '../agent/claudeStatusEvents';
import { onCodexStatusInvalidated } from '../codex';
import { connectivityChanged, isOnline } from '../ai/connectivity';
import { isEnabled } from '../features';
import * as modelCatalog from '../ai/modelCatalog';
import { runProcess } from '../utils/runProcess';
import {
  ANSWER_KEY,
  LEGACY_NOTICE_KEY,
  dropHeldWelcomeEvents,
  setUsageData,
  trackEvent,
  trackWelcomeEvent,
  usageDataState,
} from '../analytics/posthog';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL, readOneXAnswer, type RecordedAnswer } from '../analytics/consent';
import {
  WELCOME_FINISHED_KEY,
  WELCOME_KIND_KEY,
  UPDATED_FROM_1X_KEY,
  classifyProfile,
  opensAtStart,
  welcomeKind,
  type ProfileKind,
} from './updateDetection';
import { LANDING_KEY, decideLanding, isLandingRecord, landingPlaceholder, type LandingRecord, type ProjectSource } from './landing';
import { createProjectFolder, defaultProjectsParent, documentsFolder, parseRegQueryPersonal, placeLine } from './newProject';
import { SAMPLE_PROJECT_SOURCE, copySampleProject } from './sampleProject';
import { projectRows, type ProjectRow } from './recentProjects';
import {
  CHECK_TIMEOUT_MS,
  PROVIDER_ORDER,
  afterProviderReady,
  afterSkip,
  initialMemory,
  providerView,
  runtimeOfProvider,
  type ProviderMemory,
} from './welcomeState';
import { folderGone, FOLDER_OPEN_FAILED } from './words';
import {
  decodeWelcomeRequest,
  WELCOME_KEY_NAMES,
  type AccountProviderId,
  type MissingTool,
  type WelcomeKeyName,
  type WelcomeKind,
  type WelcomeMessage,
  type WelcomeProviderId,
  type WelcomeRequest,
  type WelcomeState,
} from './protocol';
import { WELCOME_VIEW_TYPE, welcomeHtml } from './welcomePanel';

/** The workbench draws the welcome alone while this is true (patch 018, `ritemarkWelcomeAlone.ts`). */
export const WELCOME_ALONE_CONTEXT_KEY = 'ritemark.welcomeAlone';

/** The AI sheet's host, as far as the welcome needs it. */
export interface WelcomeAiSheet {
  runtimeAvailability(runtimeId: AgentId): Promise<RuntimeAvailability>;
  startCodexSignIn(onStatus: (state: CodexSidebarStatus['state']) => void): Promise<string | null>;
  stopCodexSignIn(): Promise<void>;
  /** Whether ChatGPT's sign-in works as a turn will use it, beyond what auth.json says. */
  verifyCodexSignIn(): Promise<boolean>;
  openLandingChat(runtimeId: AgentId, placeholder: string): Promise<void>;
}

/**
 * Sprint 134: the project list the welcome's sheets read (R2, S54), once its
 * first fill has run, and Home, where the landing arrives (R10).
 */
export interface WelcomeProjects {
  ready: Promise<void>;
  entries(): Promise<{ folderUri: string; lastOpenedAt: string; missingSince?: string }[]>;
  revealHome(): Promise<void>;
}

// ── Before anything else in activate() ──────────────────────────────────────

/**
 * Decide, once per profile, whether this is someone new or someone updating
 * from Ritemark 1, and carry over Ritemark 1's usage-data answer (R7, R10).
 * Runs before the activation keys are confirmed and before analytics starts.
 */
export function prepareWelcome(context: vscode.ExtensionContext): ProfileKind {
  const state = context.globalState;
  const { kind, store } = classifyProfile({
    storedKind: state.get(WELCOME_KIND_KEY),
    lastConfirmedVersion: state.get<string>('ritemark.activation.lastConfirmedVersion', ''),
    hasAnonymousId: typeof state.get('ritemark.analytics.anonymousId') === 'string',
    hasSeenNotice: state.get(LEGACY_NOTICE_KEY) === true,
  });
  if (store) {
    void state.update(WELCOME_KIND_KEY, kind);
    if (kind === 'update') carryOverRitemark1Answer(context);
  }
  return kind;
}

function carryOverRitemark1Answer(context: vscode.ExtensionContext): void {
  const setting = vscode.workspace.getConfiguration('ritemark').inspect<boolean>('analytics.enabled')?.globalValue;
  const { answer, carryOver } = readOneXAnswer(
    typeof setting === 'boolean' ? setting : undefined,
    context.globalState.get<boolean>(LEGACY_NOTICE_KEY),
  );
  if (answer === 'unknown') return;
  const recorded: RecordedAnswer = { answer, from: '1.x', at: new Date().toISOString() };
  void context.globalState.update(ANSWER_KEY, recorded);
  if (carryOver) {
    // An OK on Ritemark 1's notice (or a notice closed without Opt Out) is the yes (Jarmo, 18 October).
    void vscode.workspace.getConfiguration('ritemark').update('analytics.enabled', true, vscode.ConfigurationTarget.Global);
  }
}

// ── The host ─────────────────────────────────────────────────────────────────

export interface WelcomeHost {
  /** The welcome is open in this window. */
  isOpen(): boolean;
}

export function registerWelcome(context: vscode.ExtensionContext, profileKind: ProfileKind, aiSheet: WelcomeAiSheet, projects?: WelcomeProjects): WelcomeHost {
  const controller = new WelcomeController(context, profileKind, aiSheet, projects);
  context.subscriptions.push(
    controller,
    vscode.commands.registerCommand('ritemark.welcome.open', () => controller.open({ reason: 'command' })),
    // Sprint 134 (S25): the projects list's Start a new project runs the welcome's own flow, with its place and Change…
    vscode.commands.registerCommand('ritemark.welcome.newProject', () => controller.openNewProject()),
    vscode.window.registerWebviewPanelSerializer(WELCOME_VIEW_TYPE, {
      deserializeWebviewPanel: async (panel) => controller.adopt(panel),
    }),
  );
  void controller.start();
  return { isOpen: () => controller.isOpen() };
}

type OpenReason = 'start' | 'command' | 'folder-gone';

class WelcomeController implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private newProjectRequested = false;
  private tabBefore: { label: string; viewColumn: vscode.ViewColumn } | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private panelDisposables: vscode.Disposable[] = [];
  private kind: WelcomeKind;
  private step: 1 | 2 = 1;
  private readyProvider: WelcomeProviderId | null = null;
  private readonly memories: Record<WelcomeProviderId, ProviderMemory> = {
    claude: initialMemory(),
    chatgpt: initialMemory(),
    opencode: initialMemory(),
  };
  private readonly checkTokens: Record<WelcomeProviderId, number> = { claude: 0, chatgpt: 0, opencode: 0 };
  private readonly signInPages: Partial<Record<AccountProviderId, string>> = {};
  private offline = !isOnline();
  private projects: ProjectRow[] = [];
  private projectsParent: string | null = null;
  private documents: string | null = null;
  private newProjectError: string | null = null;
  private notice: string | null = null;
  private opening = false;
  private missingTool: MissingTool | null = null;
  private keysSet: Record<WelcomeKeyName, boolean> = {
    'anthropic-api-key': false,
    'openai-api-key': false,
    'google-ai-key': false,
    'openrouter-api-key': false,
  };
  private shownCounted = false;
  /** The sheet is alone on the ground with both columns closed (R1); false for Help ▸ Welcome in a project window. */
  private alone = false;
  /** Set while the welcome itself replaces or closes its panel, so that is not read as the person closing it. */
  private closingQuietly = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly profileKind: ProfileKind,
    private readonly aiSheet: WelcomeAiSheet,
    private readonly projectSource?: WelcomeProjects,
  ) {
    this.kind = welcomeKind(profileKind, context.globalState.get(WELCOME_FINISHED_KEY));
    const dispose = (fn: () => void) => ({ dispose: fn });
    this.disposables.push(
      dispose(onClaudeStatusInvalidated((event) => {
        if (event.reason !== 'login-started') this.recheck('claude');
      })),
      dispose(onCodexStatusInvalidated((event) => {
        if (event.reason !== 'login-started') this.recheck('chatgpt');
      })),
      connectivityChanged.event(({ isOnline: online }) => {
        const wasOffline = this.offline;
        this.offline = !online;
        if (wasOffline && online) this.checkAll();
        else if (!online) this.markOffline();
      }),
      modelCatalog.onUpdate(() => this.recheck('opencode')),
      vscode.window.tabGroups.onDidChangeTabs((event) => this.onTabsChanged(event)),
    );
  }

  isOpen(): boolean {
    return this.panel !== null;
  }

  dispose(): void {
    this.closePanel();
    for (const disposable of this.disposables) disposable.dispose();
  }

  // ── Start-up ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    const landed = await this.runLanding();
    if (landed) return;
    const hasFolder = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    if (!opensAtStart({ kind: this.kind, hasFolder, openingFiles: this.hasDocumentTabs() })) return;
    // A restored welcome tab is revived by the serializer; open only when there is none.
    if (this.restoredWelcomeTabs().length > 0) return;
    await this.open({ reason: 'start' });
  }

  /** After the reload (R6): land on the folder the welcome sent the person to, once. */
  private async runLanding(): Promise<boolean> {
    const stored = this.context.globalState.get(LANDING_KEY);
    if (stored === undefined) return false;
    const windowFolder = vscode.workspace.workspaceFolders?.[0]?.uri.toString();
    const folderExists = isLandingRecord(stored) ? fs.existsSync(vscode.Uri.parse(stored.folder).fsPath) : false;
    const decision = decideLanding({ stored, windowFolder, folderExists, now: Date.now() });
    if (decision.action === 'none') {
      if (decision.deleteRecord) await this.context.globalState.update(LANDING_KEY, undefined);
      return false;
    }
    await this.context.globalState.update(LANDING_KEY, undefined);
    if (decision.action === 'folder-gone') {
      // The person did not land: the welcome is not finished, and step 2 shows again with the reason (S23).
      await this.context.globalState.update(WELCOME_FINISHED_KEY, undefined);
      this.kind = welcomeKind(this.profileKind, undefined);
      if (this.kind === 'fresh') this.step = 2;
      this.readyProvider = decision.record.provider;
      this.notice = folderGone(path.basename(vscode.Uri.parse(decision.record.folder).fsPath));
      await this.open({ reason: 'folder-gone' });
      return true;
    }
    await this.land(decision.record);
    return true;
  }

  private async land(record: LandingRecord): Promise<void> {
    // Sprint 134 (R10): the project's Home first, its projects list in the left column.
    if (this.projectSource) {
      await vscode.commands.executeCommand('workbench.view.extension.ritemark-home');
      await this.projectSource.revealHome();
    } else {
      await vscode.commands.executeCommand('workbench.view.explorer');
    }
    const placeholder = landingPlaceholder(record.provider);
    if (record.provider && placeholder) {
      await this.aiSheet.openLandingChat(runtimeOfProvider(record.provider), placeholder);
    }
    if (record.counted) {
      void trackEvent('project_opened', { source: record.source, has_ai: record.provider !== null });
    }
  }

  // ── The panel ─────────────────────────────────────────────────────────────

  /** Sprint 134 (S25): the sheet with Start a new project's form open. */
  async openNewProject(): Promise<void> {
    const wasOpen = this.panel !== null && this.panel !== undefined;
    this.newProjectRequested = true;
    // A fresh welcome the person never finished opens on its project step, where the form is, as Skip for now
    // would take it: they asked to start a project, not to pick an AI (S25)
    if (this.kind === 'fresh' && this.step === 1) {
      this.step = afterSkip({ kind: this.kind, step: this.step, readyProvider: this.readyProvider }).step;
      void this.refreshMissingTool();
    }
    await this.open({ reason: 'command' });
    // A sheet already showing takes it now; a new one when its page says it is ready ('welcome/ready')
    if (wasOpen) {
      this.push();
      this.newProjectRequested = false;
    }
  }

  async open(options: { reason: OpenReason }): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One, false);
      return;
    }
    // Sprint 134 (R10): the tab the window had in front, for "Open when you left"
    const before = vscode.window.tabGroups.activeTabGroup.activeTab;
    this.tabBefore = before ? { label: before.label, viewColumn: before.group.viewColumn } : null;
    const panel = vscode.window.createWebviewPanel(
      WELCOME_VIEW_TYPE,
      'Welcome',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] },
    );
    await this.attach(panel, options.reason);
  }

  /** A welcome tab kept from the last session (the serializer). */
  async adopt(panel: vscode.WebviewPanel): Promise<void> {
    const hasFolder = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    if (this.panel || !opensAtStart({ kind: this.kind, hasFolder, openingFiles: false })) {
      this.closingQuietly = true;
      panel.dispose();
      this.closingQuietly = false;
      return;
    }
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    await this.attach(panel, 'start');
  }

  private async attach(panel: vscode.WebviewPanel, reason: OpenReason): Promise<void> {
    this.panel = panel;
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.svg');
    panel.webview.html = welcomeHtml(panel.webview, this.context.extensionUri);
    this.panelDisposables.push(
      panel.webview.onDidReceiveMessage((raw) => void this.onRequest(raw)),
      panel.onDidDispose(() => this.onPanelDisposed()),
    );
    const hasFolder = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    this.alone = !hasFolder || (reason === 'start' && this.kind === 'update');
    if (this.alone) {
      await vscode.commands.executeCommand('setContext', WELCOME_ALONE_CONTEXT_KEY, true);
      // Alone on the ground (R1): both columns closed. They close in this window's
      // own layout; opening a folder loads that folder's (research/welcome-alone-audit.md).
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
      await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    }
    void this.refreshKeysSet();
    void this.refreshProjects();
    void this.refreshMissingTool();
    this.checkAll();
    this.push();
    if (reason === 'start' && !this.shownCounted && this.kind !== 'start') {
      this.shownCounted = true;
      void trackWelcomeEvent('welcome_shown', { kind: this.kind === 'update' ? 'update' : 'fresh' });
    }
  }

  private onPanelDisposed(): void {
    for (const disposable of this.panelDisposables) disposable.dispose();
    this.panelDisposables = [];
    this.panel = null;
    const wasAlone = this.alone;
    this.alone = false;
    void vscode.commands.executeCommand('setContext', WELCOME_ALONE_CONTEXT_KEY, false);
    // Leaving the welcome without a yes is a no for its held events (R8).
    dropHeldWelcomeEvents();
    if (wasAlone && !this.closingQuietly && !this.opening) {
      // Closed by the person, or stepped aside for a document: the columns come back, the AI's sheet with its own sign-ins.
      if ((vscode.workspace.workspaceFolders?.length ?? 0) > 0) void vscode.commands.executeCommand('workbench.view.explorer');
      void vscode.commands.executeCommand('ritemark.unifiedView.focus');
    }
  }

  /**
   * Sprint 134 (R10): "Open when you left" restores the window's own tabs, with Home and Tasks added first: the
   * tab that was in front comes back in front, not the Task board the permanent tabs opened last. Home when there
   * was none.
   */
  private async revealTabBefore(): Promise<void> {
    const before = this.tabBefore;
    this.tabBefore = null;
    const tab = before && vscode.window.tabGroups.all
      .filter((group) => group.viewColumn === before.viewColumn)
      .flatMap((group) => group.tabs)
      .find((candidate) => candidate.label === before.label);
    if (!tab) {
      await this.projectSource?.revealHome();
      return;
    }
    if (tab.group.viewColumn === vscode.ViewColumn.One) await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', tab.group.tabs.indexOf(tab));
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.closingQuietly = true;
    this.panel.dispose();
    this.closingQuietly = false;
  }

  /** A document opened in a window with no folder (R11, File ▸ Open): the welcome steps aside for it. */
  private onTabsChanged(event: vscode.TabChangeEvent): void {
    if (!this.panel || this.opening) return;
    if ((vscode.workspace.workspaceFolders?.length ?? 0) > 0) return;
    if (event.opened.some((tab) => isDocumentTab(tab))) {
      this.panel.dispose();
    }
  }

  private hasDocumentTabs(): boolean {
    return vscode.window.tabGroups.all.some((group) => group.tabs.some((tab) => isDocumentTab(tab)));
  }

  private restoredWelcomeTabs(): vscode.Tab[] {
    return vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(WELCOME_VIEW_TYPE));
  }

  private push(): void {
    if (!this.panel) return;
    const views = PROVIDER_ORDER.map((id) => providerView(id, this.memories[id]));
    const usage = usageDataState();
    const state: WelcomeState = {
      kind: this.kind,
      step: this.step,
      platform: process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux',
      providers: views,
      readyProvider: this.readyProvider,
      offline: this.offline,
      projects: this.projects.map(({ uri: _uri, ...row }) => row),
      usageData: { on: usage.on, fromRitemark1: usage.fromRitemark1 },
      missingTool: this.missingTool,
      newProject: { placePrefix: this.placePrefix(), error: this.newProjectError, ...(this.newProjectRequested ? { open: true } : {}) },
      keysSet: this.keysSet,
      notice: this.notice,
      opening: this.opening,
    };
    const message: WelcomeMessage = { type: 'welcome/state', state };
    void this.panel.webview.postMessage(message);
  }

  // ── Provider checks (R4) ──────────────────────────────────────────────────

  private checkAll(): void {
    if (this.offline) {
      this.markOffline();
      return;
    }
    for (const id of PROVIDER_ORDER) this.check(id);
  }

  private markOffline(): void {
    for (const id of PROVIDER_ORDER) {
      if (!this.memories[id].signingIn) this.memories[id].check = { kind: 'offline' };
    }
    this.push();
  }

  private recheck(id: WelcomeProviderId): void {
    if (!this.panel) return;
    this.check(id);
  }

  private check(id: WelcomeProviderId): void {
    if (this.offline) {
      this.memories[id].check = { kind: 'offline' };
      this.push();
      return;
    }
    const token = ++this.checkTokens[id];
    const memory = this.memories[id];
    if (memory.check.kind !== 'answered') memory.check = { kind: 'pending' };
    this.push();
    const timer = setTimeout(() => {
      if (this.checkTokens[id] === token && memory.check.kind === 'pending') {
        memory.check = { kind: 'timed-out' };
        this.push();
      }
    }, CHECK_TIMEOUT_MS);
    void (async () => {
      let availability: RuntimeAvailability;
      try {
        availability = await this.aiSheet.runtimeAvailability(runtimeOfProvider(id));
      } catch (error) {
        availability = { state: 'error', usable: false, detail: error instanceof Error ? error.message : String(error) };
      }
      // ChatGPT: a sign-in auth.json still holds can have ended; an older Codex says ready until a request fails
      // (the Windows round, this computer's Codex). Check it as a turn will use it before the welcome promises it.
      if (id === 'chatgpt' && availability.state === 'ready' && !memory.signingIn) {
        const works = await this.aiSheet.verifyCodexSignIn().catch(() => true);
        if (!works) availability = { state: 'needs-auth', usable: false, detail: null };
      }
      clearTimeout(timer);
      // A later check owns the answer; an answer after the 20 s still shows the real state (S15).
      if (this.checkTokens[id] !== token) return;
      const method = availability.state === 'ready' ? await this.methodOf(id) : null;
      const signInEnded = availability.state === 'needs-auth' && id === 'chatgpt' && codexSignInWasThere();
      memory.check = { kind: 'answered', availability, method, signInEnded };
      // Ready after a sign-in or a key saved from the welcome: step 2 (R3). A key for a provider that was
      // already ready (Claude signed in, then an Anthropic key) also goes on, as the key's method.
      if (availability.state === 'ready' && (memory.signingIn || memory.keySaved)) {
        const how = memory.keySaved ? 'api_key' : (method ?? 'account');
        memory.signingIn = false;
        memory.keySaved = false;
        this.providerReadyFromWelcome(id, how);
      }
      this.push();
    })();
  }

  private async methodOf(id: WelcomeProviderId): Promise<'account' | 'api_key'> {
    if (id === 'opencode') return 'api_key';
    if (id === 'chatgpt') return 'account';
    const status = await getSetupStatus();
    return status.authMethod === 'api-key' ? 'api_key' : 'account';
  }

  /** A provider became ready from the welcome: the event (held until the answer), and step 2 (R3). */
  private providerReadyFromWelcome(id: WelcomeProviderId, method: 'account' | 'api_key'): void {
    this.memories[id].problem = null;
    void trackWelcomeEvent('ai_signed_in', { provider: id, method });
    const next = afterProviderReady({ kind: this.kind, step: this.step, readyProvider: this.readyProvider }, id);
    this.step = next.step;
    this.readyProvider = next.readyProvider;
    if (this.step === 2) void this.refreshMissingTool();
    this.push();
  }

  // ── Requests from the page ────────────────────────────────────────────────

  private async onRequest(raw: unknown): Promise<void> {
    const decoded = decodeWelcomeRequest(raw);
    if (!decoded.ok) {
      console.warn(`[welcome] refused: ${decoded.reason}`);
      return;
    }
    const request: WelcomeRequest = decoded.request;
    switch (request.type) {
      case 'welcome/ready':
        this.push();
        this.newProjectRequested = false;
        return;
      case 'welcome/sign-in':
        return request.provider === 'claude' ? this.signInClaude() : this.signInChatGpt();
      case 'welcome/cancel-sign-in':
        return this.cancelSignIn(request.provider);
      case 'welcome/reopen-sign-in': {
        const page = this.signInPages[request.provider];
        if (page) await vscode.env.openExternal(vscode.Uri.parse(page));
        return;
      }
      case 'welcome/retry-check':
        if (!isOnline()) this.offline = false;
        this.check(request.provider);
        return;
      case 'welcome/continue': {
        // Already signed in (S7): straight to step 2, with nothing counted as a new sign-in.
        const next = afterProviderReady({ kind: this.kind, step: this.step, readyProvider: this.readyProvider }, request.provider);
        this.step = next.step;
        this.readyProvider = next.readyProvider;
        void this.refreshMissingTool();
        this.push();
        return;
      }
      case 'welcome/save-keys':
        return this.saveKeys(request.target, request.keys);
      case 'welcome/skip': {
        const next = afterSkip({ kind: this.kind, step: this.step, readyProvider: this.readyProvider });
        this.step = next.step;
        this.readyProvider = next.readyProvider;
        void this.refreshMissingTool();
        this.push();
        return;
      }
      case 'welcome/open-folder':
        return this.openFolder();
      case 'welcome/change-place':
        return this.changePlace();
      case 'welcome/create-project':
        return this.createProject(request.name);
      case 'welcome/try-sample':
        return this.trySample();
      case 'welcome/open-recent':
        return this.openRecent(request.id);
      case 'welcome/usage-data':
        await setUsageData(request.on, 'welcome');
        this.push();
        return;
      case 'welcome/open-link':
        await vscode.env.openExternal(vscode.Uri.parse(request.link === 'privacy' ? PRIVACY_POLICY_URL : TERMS_OF_USE_URL));
        return;
      case 'welcome/use-bundled-claude':
        await vscode.workspace.getConfiguration('ritemark').update('agentRuntime.preference', 'bundled', vscode.ConfigurationTarget.Global);
        emitClaudeStatusInvalidated('settings-updated');
        await this.refreshMissingTool();
        this.check('claude');
        return;
      case 'welcome/restart':
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
        return;
      case 'welcome/open-settings':
        await vscode.commands.executeCommand('ritemark.aiSettings');
        return;
    }
  }

  // ── Signing in (R3) ───────────────────────────────────────────────────────

  private async signInClaude(): Promise<void> {
    const memory = this.memories.claude;
    if (memory.signingIn) return;
    memory.problem = null;
    memory.signingIn = true;
    this.push();
    const status = await getSetupStatus({ refresh: true });
    if (!status.runnable || !status.binaryPath) {
      memory.signingIn = false;
      memory.problem = 'not-ready';
      this.push();
      return;
    }
    if (status.authenticated) {
      memory.signingIn = false;
      this.check('claude');
      this.providerReadyFromWelcome('claude', status.authMethod === 'api-key' ? 'api_key' : 'account');
      return;
    }
    const started = beginClaudeLogin(status.binaryPath, {
      // Claude's own CLI opens the browser; its link is kept for "Open the page again".
      onUrl: (url) => { this.signInPages.claude = url; },
      onComplete: () => {
        // Still signing in until the check says ready; then step 2.
        this.check('claude');
      },
      onError: () => {
        memory.signingIn = false;
        memory.problem = 'failed';
        this.check('claude');
      },
      onTimeout: () => {
        memory.signingIn = false;
        memory.problem = 'timed-out';
        this.check('claude');
      },
      onCancel: () => {
        memory.signingIn = false;
        this.check('claude');
      },
    });
    if (started === 'failed-to-start') {
      memory.signingIn = false;
      memory.problem = 'could-not-start';
      this.push();
    }
  }

  private async signInChatGpt(): Promise<void> {
    const memory = this.memories.chatgpt;
    // One sign-in at a time: a second click while it starts or runs would start Codex's login again.
    if (memory.starting || memory.signingIn) return;
    memory.problem = null;
    // Checking… until the page is open: VS Code can ask "Do you want Ritemark to open the external website?", and
    // the card must not say the browser opened before it has (the Windows round).
    memory.starting = true;
    this.push();
    try {
      const page = await this.aiSheet.startCodexSignIn((state) => {
        if (!memory.signingIn) return;
        if (state === 'ready') {
          this.check('chatgpt');
        } else if (state === 'needs-auth') {
          // The sidebar's polling gave up (2 minutes) without a sign-in.
          memory.signingIn = false;
          memory.problem = 'timed-out';
          this.check('chatgpt');
        }
      });
      if (!page) {
        memory.starting = false;
        memory.problem = 'not-ready';
        this.push();
        return;
      }
      this.signInPages.chatgpt = page;
      const opened = await vscode.env.openExternal(vscode.Uri.parse(page));
      memory.starting = false;
      if (!opened) {
        // The question was answered with Cancel (or Copy), or nothing could open the page: stop Codex's listener.
        await this.aiSheet.stopCodexSignIn();
        memory.problem = 'not-opened';
        this.push();
        return;
      }
      memory.signingIn = true;
      this.push();
    } catch {
      memory.starting = false;
      memory.signingIn = false;
      memory.problem = 'could-not-start';
      this.push();
    }
  }

  private async cancelSignIn(provider: AccountProviderId): Promise<void> {
    const memory = this.memories[provider];
    memory.signingIn = false;
    memory.problem = null;
    if (provider === 'claude') cancelClaudeLogin();
    else await this.aiSheet.stopCodexSignIn();
    this.check(provider);
  }

  // ── Keys: API keys (Anthropic) and OpenCode's Set up (R2, R3) ─────────────

  private async saveKeys(target: 'claude' | 'opencode', keys: Partial<Record<WelcomeKeyName, string>>): Promise<void> {
    const reply = (ok: boolean, message: string | null) => {
      const out: WelcomeMessage = { type: 'welcome/keys-saved', target, ok, message };
      void this.panel?.webview.postMessage(out);
    };
    const entries = Object.entries(keys)
      .map(([name, value]) => [name as WelcomeKeyName, (value ?? '').trim()] as const)
      .filter(([, value]) => value)
      // As in Settings (Sprint 76): the OpenRouter key is inert while the opencode-integration kill switch is off.
      .filter(([name]) => name !== 'openrouter-api-key' || isEnabled('opencode-integration'));
    if (target === 'claude') {
      const key = entries.find(([name]) => name === 'anthropic-api-key')?.[1];
      if (!key) return reply(false, 'Paste your Anthropic API key first.');
      if (!key.startsWith('sk-ant-')) return reply(false, 'Anthropic API keys start with sk-ant-. Check the key and paste it again.');
    } else if (entries.length === 0 && !Object.values(this.keysSet).some(Boolean)) {
      return reply(false, 'Add at least one key to use OpenCode.');
    }
    for (const [name, value] of entries) {
      await this.context.secrets.store(name, value);
      if (name === 'anthropic-api-key') {
        setAnthropicKeyAvailable(true);
        emitClaudeStatusInvalidated('settings-updated');
      }
    }
    await this.refreshKeysSet();
    reply(true, null);
    const provider: WelcomeProviderId = target === 'claude' ? 'claude' : 'opencode';
    // Ready when its check says so; then step 2, as for a sign-in (S5, S12).
    this.memories[provider].keySaved = true;
    this.check(provider);
    setTimeout(() => {
      if (this.memories[provider].keySaved) {
        this.memories[provider].keySaved = false;
        this.push();
      }
    }, CHECK_TIMEOUT_MS);
  }

  private async refreshKeysSet(): Promise<void> {
    for (const name of WELCOME_KEY_NAMES) {
      this.keysSet[name] = Boolean(await this.context.secrets.get(name));
    }
    this.push();
  }

  // ── Git and Node.js (R5) ──────────────────────────────────────────────────

  private async refreshMissingTool(): Promise<void> {
    try {
      const environment = await getAgentEnvironmentStatus();
      this.missingTool = environment.recommendedAction === 'reload'
        ? 'restart'
        : environment.recommendedAction === 'install-git'
          ? 'git'
          : environment.recommendedAction === 'install-node'
            ? 'node'
            : null;
    } catch {
      this.missingTool = null;
    }
    this.push();
  }

  // ── Set up project (R5) ───────────────────────────────────────────────────

  private async documentsFolder(): Promise<string> {
    if (!this.documents) {
      this.documents = await documentsFolder({
        platform: process.platform,
        home: os.homedir(),
        env: process.env,
        readRegistryDocuments: async () => {
          const result = await runProcess('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', 'Personal'], { timeout: 3000 });
          return result.status === 0 ? parseRegQueryPersonal(result.stdout) : null;
        },
      });
    }
    return this.documents;
  }

  private placePrefix(): string {
    const documents = this.documents ?? path.join(os.homedir(), 'Documents');
    const parent = this.projectsParent ?? defaultProjectsParent(documents);
    const line = placeLine({ parent, name: '', home: os.homedir(), documentsFolder: documents, platform: process.platform });
    return line.endsWith('…') ? line.slice(0, -1) : line;
  }

  private async openFolder(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Open' });
    if (!picked?.[0]) return;
    await this.goTo(picked[0], 'existing_folder');
  }

  private async changePlace(): Promise<void> {
    const documents = await this.documentsFolder();
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Choose',
      defaultUri: vscode.Uri.file(this.projectsParent ?? documents),
    });
    if (!picked?.[0]) return;
    this.projectsParent = picked[0].fsPath;
    this.newProjectError = null;
    this.push();
  }

  private async createProject(name: string): Promise<void> {
    const documents = await this.documentsFolder();
    const parent = this.projectsParent ?? defaultProjectsParent(documents);
    const created = await createProjectFolder(fsp, parent, name, process.platform);
    if (!created.ok) {
      this.newProjectError = created.message;
      this.push();
      return;
    }
    this.newProjectError = null;
    await this.goTo(vscode.Uri.file(created.value), 'new_project');
  }

  private async trySample(): Promise<void> {
    const documents = await this.documentsFolder();
    this.notice = null;
    const copied = await copySampleProject({
      fs: {
        mkdir: (target, options) => fsp.mkdir(target, options),
        readdir: (target) => fsp.readdir(target, { withFileTypes: true }),
        copyFile: (from, to, mode) => fsp.copyFile(from, to, mode),
        readFile: (target) => fsp.readFile(target, 'utf8'),
        writeFile: (target, text) => fsp.writeFile(target, text, 'utf8'),
        exists: async (target) => fs.existsSync(target),
      },
      source: path.join(this.context.extensionPath, SAMPLE_PROJECT_SOURCE),
      parent: defaultProjectsParent(documents),
      now: new Date(),
    });
    if (!copied.ok) {
      this.notice = copied.message;
      this.push();
      return;
    }
    await this.goTo(vscode.Uri.file(copied.folder), 'sample');
  }

  private async openRecent(id: string): Promise<void> {
    const row = this.projects.find((project) => project.id === id);
    if (!row) return;
    if (row.current) {
      // Back to where they left (S34): the sheet closes, the window is as it was, no reload.
      await this.finish();
      if (this.kind !== 'start') {
        void trackEvent('project_opened', { source: 'recent', has_ai: this.landingProvider() !== null });
      }
      this.closePanel();
      await this.revealTabBefore();
      await vscode.commands.executeCommand('workbench.view.explorer');
      await vscode.commands.executeCommand('ritemark.unifiedView.focus');
      return;
    }
    await this.goTo(vscode.Uri.parse(row.uri), 'recent');
  }

  /** The AI the landing opens: the one signed in from the welcome, else the first that is ready. */
  private landingProvider(): WelcomeProviderId | null {
    if (this.kind === 'fresh') return this.readyProvider;
    if (this.readyProvider) return this.readyProvider;
    for (const id of ['claude', 'chatgpt', 'opencode'] as const) {
      const check = this.memories[id].check;
      if (check.kind === 'answered' && check.availability.state === 'ready') return id;
    }
    return null;
  }

  private async finish(): Promise<void> {
    await this.context.globalState.update(WELCOME_FINISHED_KEY, { kind: this.profileKind, at: new Date().toISOString() });
    if (this.profileKind === 'update') {
      await this.context.globalState.update(UPDATED_FROM_1X_KEY, { at: new Date().toISOString() });
    }
  }

  /** Write where the welcome is going, then open the folder in this window; it reloads (R6). */
  private async goTo(folder: vscode.Uri, source: ProjectSource): Promise<void> {
    const record: LandingRecord = {
      folder: folder.toString(),
      provider: this.landingProvider(),
      source,
      counted: this.kind !== 'start',
      at: Date.now(),
    };
    this.opening = true;
    this.notice = null;
    this.push();
    await this.context.globalState.update(LANDING_KEY, record);
    await this.finish();
    try {
      await vscode.commands.executeCommand('vscode.openFolder', folder, { forceNewWindow: false });
    } catch {
      this.opening = false;
      this.notice = FOLDER_OPEN_FAILED;
      await this.context.globalState.update(LANDING_KEY, undefined);
      await this.context.globalState.update(WELCOME_FINISHED_KEY, undefined);
      this.push();
    }
  }

  // ── Projects for the update and start sheets (R1, R10) ────────────────────

  private async refreshProjects(): Promise<void> {
    if (this.kind === 'fresh') return;
    try {
      // Sprint 134 (R2, S54): Ritemark's own project list, once its first fill has run; a project that is
      // not found is left off. Without it (tests), VS Code's recent folders as in Sprint 133.
      let folders: { fsPath: string; uri: string }[];
      let lastOpen: Map<string, number>;
      if (this.projectSource) {
        await this.projectSource.ready;
        const entries = (await this.projectSource.entries()).filter((entry) => !entry.missingSince);
        folders = entries.map((entry) => ({ fsPath: vscode.Uri.parse(entry.folderUri).fsPath, uri: entry.folderUri }));
        lastOpen = new Map(entries.map((entry) => [entry.folderUri, Date.parse(entry.lastOpenedAt)]));
      } else {
        const recents = await vscode.commands.executeCommand<{ workspaces?: Array<{ folderUri?: vscode.Uri }> }>('_workbench.getRecentlyOpened');
        folders = (recents?.workspaces ?? [])
          .map((workspace) => workspace.folderUri)
          .filter((uri): uri is vscode.Uri => !!uri && uri.scheme === 'file')
          .map((uri) => ({ fsPath: uri.fsPath, uri: uri.toString() }));
        lastOpen = await lastOpenTimes(this.context.globalStorageUri.fsPath);
      }
      this.projects = projectRows({
        recents: folders,
        currentFolder: vscode.workspace.workspaceFolders?.[0]?.uri.toString(),
        exists: (fsPath) => fs.existsSync(fsPath),
        lastOpen: (uri) => lastOpen.get(uri),
        home: os.homedir(),
        platform: process.platform,
        now: Date.now(),
      });
    } catch {
      this.projects = [];
    }
    this.push();
  }
}

/** A document the person opened: text, a custom editor (Ritemark's), a notebook or a diff. Terminals and webviews are not. */
function isDocumentTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputText
    || tab.input instanceof vscode.TabInputCustom
    || tab.input instanceof vscode.TabInputNotebook
    || tab.input instanceof vscode.TabInputTextDiff;
}

/** Codex keeps its sign-in in `~/.codex/auth.json`; one that is there but no longer works is a sign-in that ended. */
function codexSignInWasThere(): boolean {
  const home = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex');
  return fs.existsSync(path.join(home, 'auth.json'));
}

/**
 * When each folder was last open: VS Code keeps one storage folder per
 * workspace (`User/workspaceStorage/<id>/workspace.json` names the folder), and
 * its state database is written while the window is open.
 */
async function lastOpenTimes(globalStoragePath: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const root = path.join(globalStoragePath, '..', '..', 'workspaceStorage');
  let entries: string[] = [];
  try {
    entries = await fsp.readdir(root);
  } catch {
    return out;
  }
  await Promise.all(entries.map(async (entry) => {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(root, entry, 'workspace.json'), 'utf8')) as { folder?: unknown };
      if (typeof meta.folder !== 'string') return;
      const stat = await fsp.stat(path.join(root, entry, 'state.vscdb'));
      const uri = vscode.Uri.parse(meta.folder).toString();
      out.set(uri, Math.max(out.get(uri) ?? 0, stat.mtimeMs));
    } catch {
      // Not a folder workspace, or no state yet.
    }
  }));
  return out;
}
