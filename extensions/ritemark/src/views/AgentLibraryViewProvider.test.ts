/**
 * Tests for the Agents place's rows (Sprint 134, R24 and W18):
 * - an agent whose file chose a colour (`color:`, its settings' Color field) is sent with it and drawn in it;
 * - a colour guessed from the name is neither sent nor drawn, and an agent with no colour keeps the muted icon;
 * - a change of colour in the file reaches the row on the place's next refresh, the one its file watchers run;
 * - the row menu says Reveal in Finder on the Mac and Reveal in File Explorer on Windows.
 *
 * The place's own script runs here in a small stand-in for the page, so what it draws is what is checked.
 *
 * Run: npx tsx src/views/AgentLibraryViewProvider.test.ts
 */

// ── A vscode stub, before the provider loads ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};

interface FakeUri { fsPath: string; path: string; toString(): string }
function fakeUri(fsPath: string): FakeUri {
  return { fsPath, path: fsPath, toString: () => `vscode-resource:${fsPath}` };
}

const vscodeStub = {
  Uri: {
    file: (p: string) => fakeUri(p),
    joinPath: (base: FakeUri, ...parts: string[]) => fakeUri([base.fsPath, ...parts].join('/')),
  },
  commands: { executeCommand: () => Promise.resolve() },
  window: {
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
  },
  workspace: {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'vscode') return '__vscode_stub_agent_library__';
  return originalResolve.call(this, request, parent, isMain);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub_agent_library__'] = {
  id: '__vscode_stub_agent_library__',
  filename: '__vscode_stub_agent_library__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeStub,
};

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';

// ~/.claude is read too: point the home at an empty folder so only this test's agents are found
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-agent-colours-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AgentLibraryViewProvider, revealInOsLabel } = require('./AgentLibraryViewProvider') as typeof import('./AgentLibraryViewProvider');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { discoverAgents } = require('../agent/discovery') as typeof import('../agent/discovery');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AGENT_COLORS } = require('../agent/iconPack') as typeof import('../agent/iconPack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COLOR_OPTIONS } = require('../../webview/src/components/agent/agentSchema') as typeof import('../../webview/src/components/agent/agentSchema');

// ── A project with agents: chosen, guessed, none, and colours the Color field doesn't offer ──
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-agent-colours-ws-'));
const agentsDir = path.join(workspace, '.claude', 'agents');
fs.mkdirSync(agentsDir, { recursive: true });
function writeAgent(slug: string, fields: string[]): string {
  const filePath = path.join(agentsDir, `${slug}.md`);
  fs.writeFileSync(filePath, ['---', `name: ${slug}`, ...fields, '---', '', 'Body.', ''].join('\n'), 'utf8');
  return filePath;
}
const outliner = writeAgent('outliner', ['description: Turns notes into outlines', 'color: yellow']);
writeAgent('quoted-red', ['description: Keeps a tidy tone', 'color: "Red"']);
// "review" makes the name guess blue (iconPack's heuristics): guessed, not chosen
writeAgent('draft-reviewer', ['description: Reads drafts']);
writeAgent('helper', ['description: Helps']);
// indigo is a colour iconPack knows but the Color field does not offer; magenta is no colour at all
writeAgent('old-indigo', ['description: From an older file', 'color: indigo']);
writeAgent('magenta', ['description: Mistyped', 'color: magenta']);
// CLAUDE.md is instructions, not an agent: no colour of its own on its row
fs.writeFileSync(path.join(workspace, 'CLAUDE.md'), '---\ncolor: red\n---\n\nInstructions.\n', 'utf8');

// ── The place, with a stand-in webview view ──────────────────────────────────
type Message = { type: string; [key: string]: unknown };
type AgentRow = { id: string; filePath: string; color: string; chosenColor?: string; isMainAgent: boolean; scope: string };

function openPlace() {
  const posted: Message[] = [];
  let onMessage: (message: Message) => void = () => undefined;
  const view = {
    webview: {
      options: {},
      html: '',
      cspSource: 'vscode-resource:',
      asWebviewUri: (uri: FakeUri) => uri.toString(),
      onDidReceiveMessage: (listener: (message: Message) => void) => {
        onMessage = listener;
        return { dispose() { /* nothing */ } };
      },
      postMessage: (message: Message) => {
        posted.push(message);
        return Promise.resolve(true);
      },
    },
  };
  const provider = new AgentLibraryViewProvider(fakeUri('/ext') as never, workspace);
  provider.resolveWebviewView(view as never, {} as never, {} as never);
  onMessage({ type: 'ready' });
  const lastItems = () => [...posted].reverse().find(message => message.type === 'items') as Message & { agents: AgentRow[] };
  return { provider, view, posted, lastItems };
}

/** The place's page script, run against a minimal page: enough for render() and the row menu. */
function runPage(html: string) {
  const script = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'the page has its script');
  const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  class FakeElement {
    children: FakeElement[] = [];
    className = '';
    dataset: Record<string, string> = {};
    style: Record<string, string> = {};
    classList = { add() { /* nothing */ }, remove() { /* nothing */ }, toggle() { /* nothing */ }, contains: () => false };
    private _text = '';
    private _html = '';
    get textContent() { return this._text; }
    set textContent(value: string) { this._text = String(value); this._html = escapeText(this._text); }
    get innerHTML() { return this._html; }
    set innerHTML(value: string) { this._html = value; this.children = []; }
    addEventListener() { /* nothing */ }
    setAttribute() { /* nothing */ }
    focus() { /* nothing */ }
    select() { /* nothing */ }
    appendChild(child: FakeElement) { this.children.push(child); return child; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    contains() { return false; }
    getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }; }
  }
  const elements = new Map<string, FakeElement>();
  const listeners: Array<(event: { data: unknown }) => void> = [];
  const context: Record<string, unknown> = {
    acquireVsCodeApi: () => ({ postMessage: () => undefined }),
    document: {
      getElementById: (id: string) => {
        if (!elements.has(id)) elements.set(id, new FakeElement());
        return elements.get(id);
      },
      createElement: () => new FakeElement(),
      addEventListener() { /* nothing */ },
    },
    window: {
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === 'message') listeners.push(listener);
      },
      innerWidth: 300,
      innerHeight: 800,
    },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    console,
  };
  vm.createContext(context);
  vm.runInContext(script!, context);
  return {
    send: (data: unknown) => listeners.forEach(listener => listener({ data })),
    content: () => elements.get('content')!.innerHTML,
    menuLabels: (item: AgentRow) => {
      (context.showContextMenu as (x: number, y: number, item: AgentRow) => void)(0, 0, item);
      return elements.get('contextMenu')!.children.filter(child => child.className.startsWith('context-menu-item')).map(child => child.textContent);
    },
  };
}

/** The class of the icon on the row for a file. */
function iconClassFor(content: string, filePath: string): string | undefined {
  const at = content.indexOf(`data-filepath="${filePath}"`);
  if (at === -1) return undefined;
  return /<i class="([^"]*)"/.exec(content.slice(at))?.[1];
}

function withPlatform<T>(platform: NodeJS.Platform, run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  try {
    return run();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

let failures = 0;
async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(error as Error).message.split('\n').join('\n    ')}`);
  }
}

async function main(): Promise<void> {
  await test('the eight agent colours are the ones the Color field offers', () => {
    assert.deepEqual([...AGENT_COLORS].sort(), [...COLOR_OPTIONS].sort());
  });

  await test('discovery carries a chosen colour apart from a guessed one', () => {
    const byId = new Map(discoverAgents(workspace).map(agent => [agent.id, agent]));
    assert.equal(byId.get('outliner')?.chosenColor, 'yellow');
    assert.equal(byId.get('quoted-red')?.chosenColor, 'red');
    // the name still guesses a colour, which stays in `color` and is not chosen
    assert.equal(byId.get('draft-reviewer')?.color, 'blue');
    assert.equal(byId.get('draft-reviewer')?.chosenColor, undefined);
    assert.equal(byId.get('helper')?.chosenColor, undefined);
    assert.equal(byId.get('old-indigo')?.chosenColor, undefined);
    assert.equal(byId.get('magenta')?.chosenColor, undefined);
    assert.equal(byId.get('CLAUDE')?.isMainAgent, true);
    assert.equal(byId.get('CLAUDE')?.chosenColor, undefined);
  });

  await test('the row data sends a chosen colour and no guessed one', () => {
    const { lastItems } = openPlace();
    const sent = new Map(lastItems().agents.map(agent => [agent.id, agent]));
    assert.deepEqual(
      Object.fromEntries([...sent].map(([id, agent]) => [id, agent.chosenColor ?? null])),
      { CLAUDE: null, 'draft-reviewer': null, helper: null, magenta: null, 'old-indigo': null, outliner: 'yellow', 'quoted-red': 'red' },
    );
  });

  await test('a chosen colour is drawn on the row\'s icon; a guessed one or none keeps the muted icon', () => {
    const { view, lastItems } = openPlace();
    const page = runPage(view.webview.html);
    page.send(lastItems());
    const content = page.content();
    assert.equal(iconClassFor(content, outliner), 'ph row-icon agent-color-yellow');
    assert.equal(iconClassFor(content, path.join(agentsDir, 'quoted-red.md')), 'ph row-icon agent-color-red');
    for (const slug of ['draft-reviewer', 'helper', 'old-indigo', 'magenta']) {
      assert.equal(iconClassFor(content, path.join(agentsDir, `${slug}.md`)), 'ph row-icon', slug);
    }
    assert.equal(iconClassFor(content, path.join(workspace, 'CLAUDE.md')), 'ph row-icon');
  });

  await test('each colour class draws its theme colour, and the plain icon stays muted', () => {
    const { view } = openPlace();
    const html = view.webview.html;
    assert.match(html, /\.row-icon \{[^}]*color: var\(--r-ink-muted\);/);
    for (const name of AGENT_COLORS) {
      assert.ok(
        html.includes(`.item .row-icon.agent-color-${name} { color: var(--vscode-ritemark-agentColor-${name}); }`),
        `no rule for ${name}`,
      );
    }
  });

  await test('a colour changed in the agent\'s file reaches its row on the next refresh', async () => {
    const { provider, view, lastItems } = openPlace();
    const original = fs.readFileSync(outliner, 'utf8');
    try {
      fs.writeFileSync(outliner, original.replace('color: yellow', 'color: cyan'), 'utf8');
      provider.refresh();
      await new Promise(resolve => setTimeout(resolve, 350));
      const page = runPage(view.webview.html);
      page.send(lastItems());
      assert.equal(iconClassFor(page.content(), outliner), 'ph row-icon agent-color-cyan');

      fs.writeFileSync(outliner, original.replace('color: yellow\n', ''), 'utf8');
      provider.refresh();
      await new Promise(resolve => setTimeout(resolve, 350));
      page.send(lastItems());
      assert.equal(iconClassFor(page.content(), outliner), 'ph row-icon');
    } finally {
      fs.writeFileSync(outliner, original, 'utf8');
    }
  });

  await test('Reveal\'s words follow the system', () => {
    assert.equal(revealInOsLabel('darwin'), 'Reveal in Finder');
    assert.equal(revealInOsLabel('win32'), 'Reveal in File Explorer');
    assert.equal(revealInOsLabel('linux'), 'Open Containing Folder');
  });

  await test('the row menu says Reveal in File Explorer on Windows and Reveal in Finder on the Mac', () => {
    for (const [platform, words, not] of [['win32', 'Reveal in File Explorer', 'Reveal in Finder'], ['darwin', 'Reveal in Finder', 'Reveal in File Explorer']] as const) {
      const { view, lastItems } = withPlatform(platform, () => openPlace());
      const page = runPage(view.webview.html);
      page.send(lastItems());
      const agent = lastItems().agents.find(row => row.id === 'outliner')!;
      const labels = page.menuLabels(agent);
      assert.ok(labels.includes(words), `${platform}: ${labels.join(', ')}`);
      assert.ok(!labels.includes(not), `${platform}: ${labels.join(', ')}`);
    }
  });
}

main()
  .catch(error => {
    failures++;
    console.error(error);
  })
  .finally(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
    if (failures) {
      console.error(`\n${failures} failing`);
      process.exit(1);
    }
    console.log('\nAll Agents place row tests passed');
  });
