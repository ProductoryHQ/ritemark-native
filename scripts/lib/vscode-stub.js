/**
 * Minimal `vscode` module stub — enough for the extension host bundle
 * (out/extension.js) to be REQUIRED in a bare Node process.
 *
 * Sprint 98. Used by scripts/ext-install-smoke-test.sh to prove a staged
 * extension directory actually loads before it is published. The 1.8.3-ext.1
 * incident died at MODULE LOAD (`Cannot find module 'pdfkit'`), before
 * `activate()` ever ran, so loading the module is exactly the right assertion —
 * we deliberately do NOT call activate(), which would start real services.
 *
 * Same technique as src/update/applyUpdate.test.ts and
 * src/update/activationIntegrity.test.ts, widened for a full extension.js load.
 *
 * If a future extension.js touches a vscode API this stub lacks, the smoke test
 * fails loudly with a TypeError naming the symbol — widen this file then.
 */

const noop = () => undefined;
const disposable = { dispose: noop };
const asDisposable = () => disposable;

/** Namespaces whose members are only ever called, never read as data at load time. */
const callableNamespace = (extra = {}) =>
  new Proxy(extra, {
    get: (target, key) => (key in target ? target[key] : asDisposable),
  });

class StubTerminalLink {
  constructor(startIndex, length, tooltip) {
    this.startIndex = startIndex;
    this.length = length;
    this.tooltip = tooltip;
  }
}

class StubEventEmitter {
  constructor() {
    this.event = () => disposable;
  }
  fire() {}
  dispose() {}
}

const uri = (p) => ({
  fsPath: p,
  path: p,
  scheme: 'file',
  with: () => uri(p),
  toString: () => p,
});

module.exports = {
  version: '1.117.0',

  // Classes / constructibles
  EventEmitter: StubEventEmitter,
  TerminalLink: StubTerminalLink,
  Disposable: class { constructor() {} dispose() {} },
  ThemeIcon: class { constructor(id) { this.id = id; } },
  ThemeColor: class { constructor(id) { this.id = id; } },
  Position: class { constructor(line, character) { this.line = line; this.character = character; } },
  Range: class { constructor(a, b) { this.start = a; this.end = b; } },
  Selection: class { constructor(a, b) { this.anchor = a; this.active = b; } },
  Location: class { constructor(u, r) { this.uri = u; this.range = r; } },
  MarkdownString: class { constructor(v) { this.value = v ?? ''; } appendMarkdown() { return this; } },
  CodeLens: class {},
  TreeItem: class { constructor(label) { this.label = label; } },
  RelativePattern: class {},
  CancellationTokenSource: class {
    constructor() { this.token = { isCancellationRequested: false, onCancellationRequested: () => disposable }; }
    cancel() {} dispose() {}
  },

  // Enums
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  ExtensionKind: { UI: 1, Workspace: 2 },
  UIKind: { Desktop: 1, Web: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 },
  FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
  TextEditorRevealType: { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 },
  CommentThreadCollapsibleState: { Collapsed: 0, Expanded: 1 },
  CommentMode: { Editing: 0, Preview: 1 },
  EndOfLine: { LF: 1, CRLF: 2 },
  TextDocumentSaveReason: { Manual: 1, AfterDelay: 2, FocusOut: 3 },
  FileChangeType: { Changed: 1, Created: 2, Deleted: 3 },

  // Namespaces
  window: callableNamespace({
    activeTextEditor: undefined,
    visibleTextEditors: [],
    terminals: [],
    activeTerminal: undefined,
    tabGroups: callableNamespace({ all: [], activeTabGroup: { tabs: [] } }),
  }),
  workspace: callableNamespace({
    workspaceFolders: undefined,
    name: undefined,
    rootPath: undefined,
    fs: callableNamespace(),
    getConfiguration: () => ({
      get: () => undefined,
      has: () => false,
      inspect: () => undefined,
      update: async () => undefined,
    }),
  }),
  commands: {
    registerCommand: asDisposable,
    registerTextEditorCommand: asDisposable,
    executeCommand: async () => undefined,
    getCommands: async () => [],
  },
  languages: callableNamespace({}),
  extensions: { getExtension: () => undefined, all: [], onDidChange: asDisposable },
  env: {
    appRoot: process.env.RITEMARK_STUB_APP_ROOT || '',
    appName: 'Ritemark',
    appHost: 'desktop',
    uriScheme: 'ritemark',
    language: 'en',
    machineId: 'smoke-test',
    sessionId: 'smoke-test',
    isNewAppInstall: false,
    isTelemetryEnabled: false,
    uiKind: 1,
    clipboard: { readText: async () => '', writeText: async () => undefined },
    openExternal: async () => true,
    asExternalUri: async (u) => u,
  },
  Uri: {
    file: uri,
    parse: uri,
    joinPath: (base, ...segments) => uri([base.fsPath, ...segments].join('/')),
  },
  authentication: callableNamespace({}),
  tasks: callableNamespace({ taskExecutions: [] }),
  debug: callableNamespace({ activeDebugSession: undefined, breakpoints: [] }),
  scm: callableNamespace({}),
  comments: callableNamespace({}),
  notebooks: callableNamespace({}),
  l10n: { t: (message) => message, bundle: undefined, uri: undefined },
};
