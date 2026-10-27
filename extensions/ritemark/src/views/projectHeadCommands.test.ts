/**
 * Tests for Ritemark 2.0's frame contributions in package.json (Sprint 132, E3):
 * the left column's head menus (R10), the 2.0 defaults (R5, R7, R8, R10), the
 * terminal shortcut (R8, revised) and the seven surface colours (R13).
 *
 * Run: npx tsx src/views/projectHeadCommands.test.ts
 */

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// projectHeadCommands imports vscode only for registration; give it a stub.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const registered: string[] = [];
const executed: Array<[string, ...unknown[]]> = [];
const projectFolder = { fsPath: '/projects/Harbour' };
const vscodeStub = {
  commands: {
    registerCommand: (id: string, run: () => unknown) => {
      registered.push(id);
      run();
      return { dispose() { /* nothing */ } };
    },
    executeCommand: (id: string, ...args: unknown[]) => {
      executed.push([id, ...args]);
      return Promise.resolve();
    },
  },
  workspace: { workspaceFolders: [{ uri: projectFolder }] },
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'vscode') {
    return 'vscode';
  }
  return originalResolve.call(this, request, parent, isMain);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
require.cache['vscode'] = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscodeStub } as unknown as NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AGENTS_NEW_MENU_COMMANDS, NEW_MENU_COMMANDS, PROJECT_HEAD_COMMANDS, PROJECT_MENU_COMMANDS, registerProjectHeadCommands } = require('./projectHeadCommands') as typeof import('./projectHeadCommands');

interface MenuItem { command: string; group?: string; when?: string }
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string; title: string; icon?: string }>;
    icons: Record<string, { default: { fontPath: string; fontCharacter: string } }>;
    menus: Record<string, MenuItem[]>;
    keybindings: Array<{ key: string; mac?: string; command: string; when?: string }>;
    configurationDefaults: Record<string, unknown>;
    colors: Array<{ id: string; defaults: Record<string, string> }>;
  };
};
const { commands, icons, menus, keybindings, configurationDefaults, colors } = pkg.contributes;

let failures = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(error as Error).message}`);
  }
}

console.log('Ritemark 2.0 frame contributions');

test('the head\'s three menus list their commands, in order', () => {
  const ids = (menu: string) => (menus[menu] ?? []).map(item => item.command);
  assert.deepEqual(ids('ritemark/projectHead'), PROJECT_MENU_COMMANDS.map(c => c.id));
  assert.deepEqual(ids('ritemark/projectHead/new'), NEW_MENU_COMMANDS.map(c => c.id));
  assert.deepEqual(ids('ritemark/projectHead/agents/new'), AGENTS_NEW_MENU_COMMANDS.map(c => c.id));
});

test('Reveal names the system\'s own app: Finder on the Mac, File Explorer on Windows', () => {
  const when = (id: string) => menus['ritemark/projectHead'].find(item => item.command === id)?.when;
  assert.equal(when('ritemark.projectHead.revealInFinder'), 'isMac');
  assert.equal(when('ritemark.projectHead.revealInFileExplorer'), 'isWindows');
});

test('every head command has an icon, and Ritemark\'s own icons are in Phosphor\'s font', () => {
  for (const { id } of PROJECT_HEAD_COMMANDS) {
    const icon = commands.find(command => command.command === id)?.icon ?? '';
    assert.match(icon, /^\$\([a-z-]+\)$/, `${id} has no icon`);
    const name = icon.slice(2, -1);
    if (name.startsWith('ritemark-')) {
      assert.ok(icons[name], `${name} is not contributed`);
      assert.ok(fs.existsSync(path.join(__dirname, '..', '..', icons[name].default.fontPath)), `${name}'s font is missing`);
    }
  }
});

test('every head command has a title in package.json and stays out of the command palette', () => {
  const hidden = new Set((menus.commandPalette ?? []).filter(item => item.when === 'false').map(item => item.command));
  for (const { id } of PROJECT_HEAD_COMMANDS) {
    const declared = commands.find(command => command.command === id);
    assert.ok(declared && declared.title.trim().length > 0, `${id} has no title`);
    assert.ok(hidden.has(id), `${id} shows in the command palette`);
  }
});

test('the head\'s words are Ritemark\'s', () => {
  const title = (id: string) => commands.find(command => command.command === id)?.title;
  assert.equal(title('ritemark.projectHead.openFolder'), 'Open a folder…');
  assert.equal(title('ritemark.projectHead.revealInFinder'), 'Reveal in Finder');
  assert.equal(title('ritemark.projectHead.revealInFileExplorer'), 'Reveal in File Explorer');
  assert.equal(title('ritemark.projectHead.switchProject'), 'Switch project');
  assert.equal(title('ritemark.projectHead.newText'), 'Text');
  assert.equal(title('ritemark.projectHead.newTable'), 'Table (CSV data)');
});

test('each head command runs the command that does the work', () => {
  registered.length = 0;
  executed.length = 0;
  registerProjectHeadCommands({ subscriptions: [] } as unknown as import('vscode').ExtensionContext);
  const all = PROJECT_HEAD_COMMANDS;
  assert.deepEqual(registered, all.map(c => c.id));
  assert.deepEqual(executed, all.map(c => c.onFolder ? [c.runs, projectFolder] : [c.runs]));
});

test('the 2.0 defaults', () => {
  assert.equal(configurationDefaults['workbench.activityBar.location'], 'top');
  assert.equal(configurationDefaults['breadcrumbs.enabled'], false);
  assert.equal(configurationDefaults['workbench.editor.tabSizing'], 'fixed');
  assert.equal(configurationDefaults['workbench.editor.tabSizingFixedMinWidth'], 38); // no floor: tabs are as wide as their names (the stylesheet)
  assert.equal(configurationDefaults['workbench.editor.tabSizingFixedMaxWidth'], 200);
  assert.equal(configurationDefaults['workbench.editor.pinnedTabSizing'], 'compact');
  // Documents hides .ritemark and Claude Code's working copies (.claude/worktrees). The rest of .claude shows: people
  // keep and change their own skills, agents and commands there (Jarmo, 27 October, for 2.1; 2.0 hid it all, the
  // Experience lead, 19 October)
  assert.deepEqual(configurationDefaults['files.exclude'], { '**/.ritemark': true, '**/.claude/worktrees': true });
  assert.equal(configurationDefaults['terminal.integrated.defaultLocation'], 'editor');
  assert.equal(configurationDefaults['terminal.integrated.hideOnStartup'], 'always');
  // ⌘T reaches the tab row from a terminal tab too (Sprint 134, R21)
  assert.deepEqual(configurationDefaults['terminal.integrated.commandsToSkipShell'], ['workbench.action.createTerminalEditor', 'ritemark.newTab']);
  // The project's AGENTS.md is About this project wherever VS Code draws a file's name (Sprint 134, R8)
  assert.deepEqual(configurationDefaults['workbench.editor.customLabels.patterns'], { '*/AGENTS.md': 'About this project' });
});

test('⌘T (Ctrl+T on Windows) is a new tab: the + of the desk you are on (Sprint 134, R21)', () => {
  const binding = keybindings.find(candidate => candidate.command === 'ritemark.newTab');
  assert.ok(binding, 'no binding for a new tab');
  assert.equal(binding.key, 'ctrl+t');
  assert.equal(binding.mac, 'cmd+t');
});

test('Ctrl+` (⌃` on the Mac) opens a new terminal tab', () => {
  const binding = keybindings.find(candidate => candidate.key === 'ctrl+`');
  assert.ok(binding, 'no ctrl+` binding');
  assert.equal(binding.command, 'workbench.action.createTerminalEditor');
  assert.equal(binding.mac, undefined, 'the Mac uses the same key, ⌃`');
  assert.equal(binding.when, undefined);
});

test('⌘, (Ctrl+, on Windows) opens Ritemark\'s settings, not VS Code\'s (Jarmo, 17 October)', () => {
  const binding = keybindings.find(candidate => candidate.command === 'ritemark.aiSettings');
  assert.ok(binding, 'no binding for Ritemark settings');
  assert.equal(binding.key, 'ctrl+,');
  assert.equal(binding.mac, 'cmd+,');
  assert.equal(binding.when, undefined);
});

test('the seven surface colours, each with light, dark and high-contrast values', () => {
  // An agent's chosen colours (Sprint 134, R24) are checked by themeContrast.test.ts.
  const ids = colors.map(color => color.id).filter(id => !id.startsWith('ritemark.agentColor.'));
  assert.deepEqual(ids, ['ritemark.ground', 'ritemark.aiSheet', 'ritemark.desk', 'ritemark.sheetBorder', 'ritemark.sheetShadow', 'ritemark.placeActiveBackground', 'ritemark.placeActiveForeground']);
  for (const color of colors) {
    for (const key of ['light', 'dark', 'highContrast', 'highContrastLight']) {
      assert.ok(color.defaults[key], `${color.id} has no ${key} value`);
    }
  }
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll passed');
