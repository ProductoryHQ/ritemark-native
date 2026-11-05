/**
 * #658: the AI's browser actions go to the page its turn was given, on every
 * runtime (Claude's in-process MCP server, Codex's dynamic tools, OpenCode's
 * IPC adapter), never to whichever tab is in front when the action runs.
 *
 * The vscode stub stands in for patch 010: it acts in the page an action names
 * by id, in the active tab only when none is named, and answers a page that
 * has gone with the error, as `ritemarkBrowserPageTarget.ts` does.
 *
 * Run: npx tsx src/browser/browserTurnPage.test.ts
 */

import { strict as assert } from 'node:assert';
import Module from 'node:module';

interface Page { url: string; title: string; shared: boolean }
const pages = new Map<string, Page>();
let active: string | undefined;
let nextNewTab = 'p-new';
const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
/** Where each action landed, as patch 010 would act. */
const landed: string[] = [];

function shell(command: string, raw: unknown): unknown {
  const args = (raw ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  const pageIds = [...pages.keys()];
  const known = Array.isArray(args.knownPageIds) ? (args.knownPageIds as string[]) : null;
  const newPages = known ? pageIds.filter((id) => !known.includes(id)).map((id) => ({ pageId: id, shared: pages.get(id)!.shared, ...(pages.get(id)!.shared ? { title: pages.get(id)!.title, url: pages.get(id)!.url } : {}) })) : [];
  let id: string | undefined;
  if (typeof args.pageId === 'string') {
    if (!pages.has(args.pageId)) return { pageId: args.pageId, pageGone: true, error: 'The page you were given is no longer open (its tab was closed). Nothing was done. Ask the user which page to use.', pageIds, newPages };
    if (args.requireShared && !pages.get(args.pageId)!.shared) return { pageId: args.pageId, error: 'This page is not shared with you, so nothing was done.', pageIds, newPages };
    id = args.pageId;
  } else if (command.endsWith('agentNavigate') && (args.newTab || !active)) {
    id = nextNewTab;
    pages.set(id, { url: String(args.url), title: 'New tab', shared: true });
  } else {
    id = active;
  }
  if (!id) return { error: 'No active integrated browser tab.' };
  landed.push(id);
  const page = pages.get(id)!;
  return { pageId: id, url: page.url, title: page.title, summary: `summary of ${id}`, pageIds: [...pages.keys()], newPages: newPages.filter((p) => p.pageId !== id) };
}

const moduleAny = Module as unknown as { _load: (request: string, parent: unknown, isMain?: boolean) => unknown };
const originalLoad = moduleAny._load.bind(Module);
moduleAny._load = (request: string, parent: unknown, isMain?: boolean): unknown => {
  if (request === 'vscode') return { commands: { executeCommand: async (command: string, args?: unknown) => shell(command, args) } };
  return originalLoad(request, parent, isMain);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const actions = require('./BrowserActionTools') as typeof import('./BrowserActionTools');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const registry = require('../runtime/ritemarkTools') as typeof import('../runtime/ritemarkTools');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RitemarkToolsInjector } = require('../runtime/RitemarkToolsInjector') as typeof import('../runtime/RitemarkToolsInjector');

const { BrowserTurnPage, browserTurnPageFor } = actions;
const { BROWSER_TOOL_GROUP, runTool } = registry;
const injector = new RitemarkToolsInjector();
const tool = (name: string) => BROWSER_TOOL_GROUP.tools.find((item) => item.name === name)!;

type Call = (name: string, args: Record<string, unknown>, page: InstanceType<typeof BrowserTurnPage>) => Promise<{ text: string; isError: boolean }>;

/** One call per runtime, each the way that runtime reaches the registry. */
async function runtimes(): Promise<Array<[string, Call]>> {
  return [
    ['claude-code', async (name, args, page) => {
      // A session keeps the server of its first turn; the tool reads the holder when it runs.
      const servers = (await injector.claudeMcpServers([BROWSER_TOOL_GROUP], page)) as Record<string, { instance: { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }> }> } }>;
      const result = await servers.ritemark_browser.instance._registeredTools[name].handler(args, {});
      return { text: result.content[0].text, isError: result.isError === true };
    }],
    ['codex', async (name, args, page) => {
      const result = await injector.codexToolCall([BROWSER_TOOL_GROUP], `ritemark_${name}`, args, page);
      return { text: result.text, isError: !result.success };
    }],
    ['opencode', async (name, args, page) => {
      const result = await injector.handleIpc({ id: '1', op: 'call', group: 'browser', tool: name, params: args }, 'opencode', page);
      return { text: result.text ?? '', isError: result.isError === true };
    }],
  ];
}

function reset(): void {
  pages.clear();
  pages.set('p-a', { url: 'http://127.0.0.1:18761/', title: 'Page A', shared: true });
  pages.set('p-b', { url: 'http://127.0.0.1:18762/', title: 'Page B', shared: true });
  pages.set('p-c', { url: 'http://127.0.0.1:18763/', title: 'Page C', shared: true });
  active = 'p-a';
  nextNewTab = 'p-new';
  calls.length = 0;
  landed.length = 0;
}

const ACTIONS: Array<[string, Record<string, unknown>]> = [
  ['browser_click', { selector: '#btn' }],
  ['browser_type', { key: 'Meta+e' }],
  ['browser_fill', { selector: '#box', value: 'x' }],
  ['browser_scroll', { direction: 'down' }],
  ['browser_snapshot', {}],
  ['browser_navigate', { type: 'reload' }],
  ['browser_navigate', { type: 'url', url: 'http://127.0.0.1:18763/next' }],
];

async function main(): Promise<void> {
  // ── Three pages, another one active: every action, on every runtime, lands in the turn's page ──
  for (const [runtime, call] of await runtimes()) {
    reset();
    const page = new BrowserTurnPage();
    page.startTurn('p-c'); // the turn's context came from Page C
    for (const [name, args] of ACTIONS) {
      const result = await call(name, args, page);
      assert.equal(result.isError, false, `${runtime} ${name}: ${result.text}`);
      assert.match(result.text, /Page id: p-c/, `${runtime} ${name} names the page it acted in`);
    }
    assert.deepEqual(landed, ACTIONS.map(() => 'p-c'), `${runtime}: every action landed in Page C, none in the active Page A`);
    for (const entry of calls) {
      assert.equal(entry.args.pageId, 'p-c', `${runtime} ${entry.command} carries the turn's page`);
      assert.equal(entry.args.newTab, undefined, `${runtime} ${entry.command} opens no tab`);
      assert.equal(entry.args.requireShared, undefined, `${runtime} ${entry.command}: the turn's own page`);
      assert.equal('page_id' in entry.args, false, `${runtime}: page_id is not passed through to the page`);
    }
  }

  // ── A page that has gone: the error, every time, never the active tab ──
  for (const [runtime, call] of await runtimes()) {
    reset();
    const page = new BrowserTurnPage();
    page.startTurn('p-c');
    pages.delete('p-c'); // the person closed Page C during the turn
    for (const [name, args] of [ACTIONS[0], ACTIONS[1], ACTIONS[6]]) {
      const result = await call(name, args, page);
      assert.equal(result.isError, true, `${runtime} ${name} fails`);
      assert.match(result.text, /no longer open/);
      assert.doesNotMatch(result.text, /Page id:/);
    }
    assert.deepEqual(landed, [], `${runtime}: nothing landed anywhere`);
    assert.equal(page.pageId, 'p-c', `${runtime}: the gone page stays the turn's page; nothing falls back`);
  }

  // ── Navigate never retargets another tab: with no page, a new tab, which becomes the turn's page ──
  for (const [runtime, call] of await runtimes()) {
    reset();
    active = undefined; // README.md is in front, Pages A to C behind it
    const page = new BrowserTurnPage();
    page.startTurn(undefined);
    const opened = await call('browser_navigate', { url: 'http://127.0.0.1:18763/' }, page);
    assert.equal(opened.isError, false, opened.text);
    assert.equal(calls[0].args.newTab, true, `${runtime}: navigate asks for a new tab`);
    assert.equal(calls[0].args.pageId, undefined);
    assert.deepEqual(landed, ['p-new'], `${runtime}: the address loaded in a new tab, not in Page A`);
    assert.equal(page.pageId, 'p-new', `${runtime}: the AI's new tab is the turn's page`);
    await call('browser_click', { selector: '#btn' }, page);
    assert.equal(calls[1].args.pageId, 'p-new', `${runtime}: later actions act in it`);

    reset();
    active = undefined;
    const noPage = new BrowserTurnPage();
    const refused = await call('browser_click', { selector: '#btn' }, noPage);
    assert.equal(refused.isError, true);
    assert.match(refused.text, /No browser page for this message/);
    assert.equal(calls.length, 0, `${runtime}: without a page, nothing reaches the browser`);
    const back = await call('browser_navigate', { type: 'back' }, noPage);
    assert.equal(back.isError, true, `${runtime}: back with no page is refused`);
    assert.equal(calls.length, 0);
  }

  // ── A page the AI was not given: only named, and only acted in once shared ──
  {
    reset();
    const page = new BrowserTurnPage();
    page.startTurn('p-c');
    // Page A opens a sign-in popup; it is not shared (upstream: a popup does not inherit its opener's share).
    await runTool(tool('browser_click'), { selector: '#signin' }, { runtimeId: 'claude-code', browserPage: page });
    pages.set('p-popup', { url: 'http://127.0.0.1:18762/?popup=1', title: 'Sign in', shared: false });
    active = 'p-popup';
    const next = await runTool(tool('browser_click'), { selector: '#btn' }, { runtimeId: 'claude-code', browserPage: page });
    assert.equal(landed.at(-1), 'p-c', 'the popup in front does not take the click');
    assert.match(next.text, /A new browser page opened \(page id p-popup\)\. It is not shared with you/);
    assert.doesNotMatch(next.text, /Sign in|popup=1/, 'nothing about a page not shared reaches the AI');
    assert.deepEqual(calls.at(-1)!.args.knownPageIds, ['p-a', 'p-b', 'p-c'], 'the pages known after the last action go back');

    const refused = await runTool(tool('browser_click'), { selector: '#btn', page_id: 'p-popup' }, { runtimeId: 'claude-code', browserPage: page });
    assert.equal(calls.at(-1)!.args.requireShared, true, 'a page the AI names itself must be shared already');
    assert.equal(refused.isError, true);
    assert.equal(landed.at(-1), 'p-c', 'nothing landed in the popup');

    pages.get('p-popup')!.shared = true; // the person shares it on the AI's sheet
    const shared = await runTool(tool('browser_click'), { selector: '#btn', page_id: 'p-popup' }, { runtimeId: 'claude-code', browserPage: page });
    assert.equal(shared.isError, undefined, shared.text);
    assert.equal(landed.at(-1), 'p-popup');
    const back = await runTool(tool('browser_type'), { key: 'Enter' }, { runtimeId: 'claude-code', browserPage: page });
    assert.equal(back.isError, undefined);
    assert.equal(landed.at(-1), 'p-c', 'without page_id, actions are back in the turn\'s page');

    await runTool(tool('browser_click'), { selector: '#btn', page_id: 'p-c' }, { runtimeId: 'claude-code', browserPage: page });
    assert.equal(calls.at(-1)!.args.requireShared, undefined, 'naming the turn\'s own page asks nothing more');
  }

  // ── A shared new page is named with its title and address ──
  {
    const text = actions.formatActionResultForAgent({
      pageId: 'p-c', summary: 's',
      newPages: [{ pageId: 'p-x', shared: true, title: 'Docs', url: 'https://example.com/' }],
    });
    assert.match(text, /A new browser page opened: "Docs" https:\/\/example\.com\/, page id p-x\. To act in it, pass page_id "p-x"/);
  }

  // ── One holder per conversation, kept across turns ──
  {
    const first = browserTurnPageFor('conv-1');
    assert.equal(browserTurnPageFor('conv-1'), first);
    assert.notEqual(browserTurnPageFor('conv-2'), first);
    first.startTurn('p-a');
    first.startTurn('p-b');
    assert.equal(first.pageId, 'p-b', 'each turn sets its page');
    assert.equal(browserTurnPageFor('conv-2').pageId, undefined, 'another conversation keeps its own');
  }

  console.log('browser/browserTurnPage: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
