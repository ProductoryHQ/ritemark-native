/**
 * Tests for the Ritemark tool registry and its runtime projections (Sprint 130, W5).
 *
 * Run: npx tsx src/runtime/ritemarkTools.test.ts
 */

import { strict as assert } from 'node:assert';
import Module from 'node:module';

// BrowserActionTools imports vscode; nothing here reaches the workbench.
const moduleAny = Module as unknown as { _load: (request: string, parent: unknown, isMain?: boolean) => unknown };
const originalLoad = moduleAny._load.bind(Module);
moduleAny._load = (request: string, parent: unknown, isMain?: boolean): unknown => {
  if (request === 'vscode') return { commands: { executeCommand: async () => ({ pageId: 'p1', url: 'about:blank', summary: 'ok' }) } };
  return originalLoad(request, parent, isMain);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tools = require('./ritemarkTools') as typeof import('./ritemarkTools');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RitemarkToolsInjector } = require('./RitemarkToolsInjector') as typeof import('./RitemarkToolsInjector');
import type { BoardController } from '../taskBoard/BoardController';
import type { BoardAnswer, BoardCardView, BoardSnapshot } from '../taskBoard/protocol';

const {
  BOARD_TOOL_GROUP,
  BROWSER_TOOL_GROUP,
  boardToolsAvailable,
  claudeAllowName,
  codexDynamicTools,
  findCodexTool,
  mcpToolDefinition,
  runTool,
  setBoardToolController,
  toolGroupById,
  toolGroupsFor,
  toolSetKey,
} = tools;

/** The OpenCode adapter's hand-written browser tools before Sprint 130 (git HEAD
 *  at the start of W5). The registry must produce exactly these. */
const OLD_ADAPTER_TOOLS = [
  {
    "name": "browser_navigate",
    "description": "Open or navigate the integrated Ritemark browser. With type=\"url\" + url: reuses the FIRST existing browser tab if any are open, otherwise creates a new tab — call this directly when the user says \"open browser and go to X\". With type=\"back\"/\"forward\"/\"reload\": acts on the active tab (requires one to exist).\n\nIf the URL is ambiguous (e.g. the user says \"go to my company website\" with no exact URL), run a web search FIRST to resolve the exact URL, then call this tool with that URL. Do not guess — the tool will navigate to whatever you give it.\n\nReturns the updated ARIA page summary so you can observe the resulting page in one round trip.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "url",
            "back",
            "forward",
            "reload"
          ],
          "description": "Navigation kind (default \"url\")."
        },
        "url": {
          "type": "string",
          "description": "Target URL when type is \"url\". Must be a complete URL — resolve via web search first if the user gave an ambiguous name."
        }
      }
    }
  },
  {
    "name": "browser_click",
    "description": "Click an element in the active integrated browser tab. Prefer ARIA refs (e.g. \"@e12\") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button=\"right\" for context menu.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "ref": {
          "type": "string",
          "description": "ARIA ref from the page summary, e.g. \"@e12\"."
        },
        "selector": {
          "type": "string",
          "description": "CSS selector. Use only if ref is not available."
        },
        "button": {
          "type": "string",
          "enum": [
            "left",
            "right",
            "middle"
          ]
        },
        "dblClick": {
          "type": "boolean"
        }
      }
    }
  },
  {
    "name": "browser_fill",
    "description": "Replace the value of an input/textarea/select in the active integrated browser tab. Calls Playwright fill() — clears the field before typing. For sending individual key events use browser_type.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "ref": {
          "type": "string",
          "description": "ARIA ref from the page summary."
        },
        "selector": {
          "type": "string",
          "description": "CSS selector. Use only if ref is not available."
        },
        "value": {
          "type": "string",
          "description": "Value to write into the field."
        }
      },
      "required": [
        "value"
      ]
    }
  },
  {
    "name": "browser_type",
    "description": "Send keystrokes to the active integrated browser tab. Use \"text\" to type plain text into whatever has focus, or \"key\" to press a single named key (e.g. \"Enter\", \"Tab\", \"Escape\", \"Control+A\").",
    "inputSchema": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "Plain text to type via keyboard."
        },
        "key": {
          "type": "string",
          "description": "Single key or key combo to press, e.g. \"Enter\", \"Control+A\"."
        }
      }
    }
  },
  {
    "name": "browser_scroll",
    "description": "Scroll the active integrated browser tab. direction: \"up\"/\"down\" scrolls by amount px (default 600); \"top\"/\"bottom\" jumps; \"into-view\" requires ref or selector and scrolls that element into view.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "direction": {
          "type": "string",
          "enum": [
            "up",
            "down",
            "top",
            "bottom",
            "into-view"
          ]
        },
        "amount": {
          "type": "number",
          "description": "Scroll distance in px (default 600) for up/down directions."
        },
        "ref": {
          "type": "string"
        },
        "selector": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "browser_snapshot",
    "description": "Return the current ARIA outline of the active integrated browser tab — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling browser_navigate again. Read-only: does not require browser control consent, but the tab must be shared with Ritemark AI by the user.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  }
];

function card(partial: Partial<BoardCardView> & { id: string; title: string }): BoardCardView {
  return {
    doneWhen: null,
    stage: 'todo',
    rank: 'i',
    description: '',
    files: [],
    created: null,
    updated: null,
    result: null,
    ask: null,
    review: null,
    dropped: false,
    archived: null,
    history: [],
    copiedFrom: null,
    reviewing: null,
    reviewFailure: null,
    handoff: null,
    move: null,
    call: null,
    nextUp: false,
    locked: false,
    checkboxes: { done: 0, total: 0 },
    ...partial,
  };
}

/** A board controller that records what the tools asked of it. */
function fakeBoard() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const ok = (cardId?: string): BoardAnswer => ({ ok: true, ...(cardId ? { cardId } : {}) });
  const snapshot: BoardSnapshot = {
    folder: 'project',
    enabled: true,
    cards: [
      card({ id: 'abc123', title: 'Draft the agenda', doneWhen: 'One page', files: [{ path: 'docs/agenda.md', exists: true }], description: 'Use the notes.', move: 'you' }),
      card({ id: 'def456', title: 'Book the room', stage: 'doing', move: 'agent', history: [{ at: '2026-10-12T08:00:00.000Z', by: 'you', what: 'Created' }] }),
    ],
    archived: [card({ id: 'old111', title: 'Old work', stage: 'done', archived: '2026-10-01T08:00:00.000Z' })],
    unreadable: [],
    calls: [],
    attention: { count: 0, oldestSince: null, blocked: 0 },
    doing: { count: 1, limit: 3 },
    runtimes: [],
    defaultRuntime: 'claude-code',
  };
  const controller = {
    snapshot: async () => snapshot,
    add: async (...args: unknown[]) => { calls.push({ method: 'add', args }); return ok('new001'); },
    update: async (...args: unknown[]) => { calls.push({ method: 'update', args }); return ok(String(args[0])); },
    move: async (...args: unknown[]) => {
      calls.push({ method: 'move', args });
      return args[1] === 'done' && args[3] !== 'you'
        ? ({ ok: false, code: 'not-allowed', message: 'Only the user marks a card done.' } as BoardAnswer)
        : ok(String(args[0]));
    },
    reportResult: async (...args: unknown[]) => { calls.push({ method: 'reportResult', args }); return ok(String(args[0])); },
    askUser: async (...args: unknown[]) => { calls.push({ method: 'askUser', args }); return ok(String(args[0])); },
  };
  return { controller: controller as unknown as BoardController, calls };
}

async function main(): Promise<void> {
  // ── The browser tools keep their names, descriptions and schemas exactly ──
  {
    const generated = BROWSER_TOOL_GROUP.tools.map(mcpToolDefinition);
    // #658: every browser tool also takes page_id, and the descriptions say which page they act in (the page the
    // turn was given, not the tab in front). Names and every other part of the schemas are unchanged.
    const pageId = {
      type: 'string',
      description:
        'The page to act in. Leave it out to act in the page the user had in front when they sent the message. Pass a page id only when a tool result gave you one (for example a page your click opened).',
    };
    assert.deepEqual(
      generated.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })),
      OLD_ADAPTER_TOOLS.map((tool) => ({
        name: tool.name,
        inputSchema: { ...tool.inputSchema, properties: { ...(tool.inputSchema.properties ?? {}), page_id: pageId } },
      })),
      'the OpenCode adapter sees the tools it had, each with page_id',
    );
    for (const tool of generated) {
      assert.doesNotMatch(tool.description, /active (integrated browser )?tab|FIRST existing/, `${tool.name} no longer says it follows the tab in front`);
      assert.match(tool.description, /page you were given/, `${tool.name} names the page it acts in`);
    }
    assert.deepEqual(
      BROWSER_TOOL_GROUP.tools.map((tool) => claudeAllowName(BROWSER_TOOL_GROUP, tool)),
      ['navigate', 'click', 'fill', 'type', 'scroll', 'snapshot'].map((name) => `mcp__ritemark_browser__browser_${name}`),
      'Claude names unchanged',
    );
    assert.deepEqual(
      codexDynamicTools([BROWSER_TOOL_GROUP]).map((tool) => tool.name),
      ['navigate', 'click', 'fill', 'type', 'scroll', 'snapshot'].map((name) => `ritemark_browser_${name}`),
      'Codex names unchanged',
    );
    for (const tool of codexDynamicTools([BROWSER_TOOL_GROUP, BOARD_TOOL_GROUP])) {
      assert.match(tool.name, /^[a-zA-Z0-9_-]+$/, `${tool.name} follows the Codex naming rule`);
      assert.equal((tool.inputSchema as { additionalProperties?: unknown }).additionalProperties, false, `${tool.name} is closed for Codex`);
    }
  }

  // ── The board group's names on every runtime ──────────────────────────────
  {
    const names = BOARD_TOOL_GROUP.tools.map((tool) => tool.name);
    assert.deepEqual(names, ['list_cards', 'read_card', 'add_card', 'update_card', 'move_card', 'report_result', 'ask_user']);
    assert.deepEqual(codexDynamicTools([BOARD_TOOL_GROUP]).map((tool) => tool.name), names.map((name) => `ritemark_board_${name}`));
    assert.equal(claudeAllowName(BOARD_TOOL_GROUP, BOARD_TOOL_GROUP.tools[0]), 'mcp__ritemark_board__list_cards');
    assert.equal(findCodexTool([BROWSER_TOOL_GROUP, BOARD_TOOL_GROUP], 'ritemark_board_ask_user')?.tool.name, 'ask_user');
    assert.equal(findCodexTool([BROWSER_TOOL_GROUP], 'ritemark_board_ask_user'), null, 'a group not given is not found');
    assert.equal(toolGroupById('board'), BOARD_TOOL_GROUP);
    assert.equal(toolGroupById('shell'), null);
  }

  // ── Which groups a turn gets ──────────────────────────────────────────────
  {
    setBoardToolController(() => null);
    assert.equal(boardToolsAvailable(), false);
    assert.deepEqual(toolGroupsFor({ browser: false }), []);
    assert.deepEqual(toolGroupsFor({ browser: true }).map((group) => group.id), ['browser']);
    const { controller } = fakeBoard();
    setBoardToolController(() => controller);
    assert.equal(boardToolsAvailable(), true);
    assert.deepEqual(toolGroupsFor({ browser: false }).map((group) => group.id), ['board']);
    assert.deepEqual(toolGroupsFor({ browser: true }).map((group) => group.id), ['browser', 'board']);
  }

  // ── The tool-set key a Codex thread is bound to (P2) ──────────────────────
  {
    const browser = codexDynamicTools([BROWSER_TOOL_GROUP]);
    const both = codexDynamicTools([BROWSER_TOOL_GROUP, BOARD_TOOL_GROUP]);
    assert.equal(toolSetKey(undefined), '');
    assert.equal(toolSetKey([]), '');
    assert.match(toolSetKey(browser), /^[0-9a-f]{64}$/);
    assert.equal(toolSetKey(both), toolSetKey([...both].reverse()), 'order does not matter');
    assert.notEqual(toolSetKey(browser), toolSetKey(both));
    const changed = both.map((tool, index) => (index === 0 ? { ...tool, inputSchema: { ...tool.inputSchema, required: ['url'] } } : tool));
    assert.notEqual(toolSetKey(changed), toolSetKey(both), 'a schema change is a new tool set');
  }

  // ── The board tools, against a board ─────────────────────────────────────
  {
    const { controller, calls } = fakeBoard();
    setBoardToolController(() => controller);
    const tool = (name: string) => BOARD_TOOL_GROUP.tools.find((item) => item.name === name)!;
    const claude = { runtimeId: 'claude-code' as const };

    const list = await runTool(tool('list_cards'), {}, claude);
    assert.equal(list.isError, undefined);
    assert.match(list.text, /abc123 · To do · Draft the agenda · next: the user · done when: One page · 1 file/);
    assert.match(list.text, /def456 · Doing · Book the room · next: an agent/);
    assert.equal((await runTool(tool('list_cards'), { stage: 'done' }, claude)).text, 'No cards in Done.');

    const read = await runTool(tool('read_card'), { card_id: 'def456' }, claude);
    assert.match(read.text, /^Book the room\nStage: Doing/);
    assert.match(read.text, /History:\n2026-10-12T08:00:00.000Z you: Created/);
    assert.match((await runTool(tool('read_card'), { card_id: 'old111' }, claude)).text, /Stage: Done \(archived by the user/);
    assert.doesNotMatch(list.text, /old111/, 'list_cards leaves archived cards out');
    const missing = await runTool(tool('read_card'), { card_id: 'zzz999' }, claude);
    assert.equal(missing.isError, true);
    assert.match(missing.text, /no card zzz999.*list_cards/);

    const bad = await runTool(tool('read_card'), { card_id: 'NOT-AN-ID' }, claude);
    assert.equal(bad.isError, true);
    assert.match(bad.text, /^Invalid input for card_id/);
    assert.equal(calls.length, 0, 'an invalid call reaches no board method');

    const added = await runTool(tool('add_card'), { title: 'Call Maria', done_when: 'Venue booked', files: ['notes.md'] }, { runtimeId: 'codex' });
    assert.equal(added.text, 'Added card new001 to To do.');
    assert.deepEqual(calls.at(-1), { method: 'add', args: [{ title: 'Call Maria', stage: 'todo', doneWhen: 'Venue booked', files: ['notes.md'] }, 'codex'] });

    await runTool(tool('update_card'), { card_id: 'abc123', done_when: '' }, claude);
    assert.deepEqual(calls.at(-1), { method: 'update', args: ['abc123', { doneWhen: '' }, 'claude'] });

    const done = await runTool(tool('move_card'), { card_id: 'abc123', stage: 'done' }, claude);
    assert.equal(done.isError, true);
    assert.equal(done.text, 'Only the user marks a card done.');

    const reported = await runTool(tool('report_result'), { card_id: 'def456', summary: 'Booked room 2.', check: ['The date'] }, { runtimeId: 'opencode' });
    assert.equal(reported.text, 'Reported. The user will review it.');
    assert.deepEqual(calls.at(-1), { method: 'reportResult', args: ['def456', 'opencode', { summary: 'Booked room 2.', check: ['The date'] }] });

    await runTool(tool('ask_user'), { card_id: 'abc123', question: 'Which day?', options: ['Monday', 'Tuesday'] }, claude);
    assert.deepEqual(calls.at(-1), { method: 'askUser', args: ['abc123', 'claude', { question: 'Which day?', options: ['Monday', 'Tuesday'] }] });

    setBoardToolController(() => null);
    const noBoard = await runTool(tool('list_cards'), {}, claude);
    assert.equal(noBoard.isError, true);
    assert.match(noBoard.text, /no task board/);
  }

  // ── The injector: Claude names, Codex routing, OpenCode descriptors and IPC ─
  {
    const { controller, calls } = fakeBoard();
    setBoardToolController(() => controller);
    const injector = new RitemarkToolsInjector();
    const groups = toolGroupsFor({ browser: true });

    assert.equal(injector.claudeAllowedTools(groups).length, 13);

    // Each Claude session gets its own server objects: an MCP server serves one
    // connection at a time, and conversations stay connected between turns
    // (live, 2026-10-12: a second card's conversation had no board tools).
    const one = (await injector.claudeMcpServers(groups)) as Record<string, { instance: { connect(transport: unknown): Promise<void> } }>;
    const two = (await injector.claudeMcpServers(groups)) as Record<string, { instance: { connect(transport: unknown): Promise<void> } }>;
    assert.deepEqual(Object.keys(one), ['ritemark_browser', 'ritemark_board']);
    assert.notEqual(one.ritemark_board, two.ritemark_board);
    const transport = () => ({ start: async () => {}, close: async () => {}, send: async () => {} });
    await one.ritemark_board.instance.connect(transport());
    await two.ritemark_board.instance.connect(transport());
    assert.equal(await injector.claudeMcpServers([]), undefined);
    assert.equal(injector.codexDynamicTools([]), undefined);
    const routed = await injector.codexToolCall(groups, 'ritemark_board_move_card', { card_id: 'abc123', stage: 'doing' });
    assert.deepEqual(routed, { text: 'Moved the card to Doing.', success: true });
    assert.deepEqual(calls.at(-1), { method: 'move', args: ['abc123', 'doing', {}, 'codex'] });
    assert.deepEqual(await injector.codexToolCall(groups, 'ritemark_board_delete_card', {}), { text: 'Unknown tool: ritemark_board_delete_card', success: false });

    assert.deepEqual(injector.acpMcpServers(groups, ''), []);
    assert.deepEqual(injector.acpMcpServers([], '/tmp/x.sock'), []);
    const servers = injector.acpMcpServers(groups, '/tmp/x.sock') as Array<{ name: string; command: string; args: string[]; env: Array<{ name: string; value: string }> }>;
    assert.deepEqual(servers.map((server) => server.name), ['ritemark_browser', 'ritemark_board']);
    for (const server of servers) {
      assert.equal(server.command, process.execPath);
      assert.match(server.args[0], /browser[\\/]browserMcpAdapter\.js$/);
      assert.ok(require('node:path').isAbsolute(server.args[0]));
    }
    assert.deepEqual(servers[1].env, [{ name: 'RITEMARK_IPC', value: '/tmp/x.sock' }, { name: 'RITEMARK_TOOL_GROUP', value: 'board' }]);

    const listed = await injector.handleIpc({ id: '1', op: 'list', group: 'board' });
    assert.deepEqual(listed.tools?.map((item) => item.name), BOARD_TOOL_GROUP.tools.map((item) => item.name));
    const called = await injector.handleIpc({ id: '2', op: 'call', group: 'board', tool: 'ask_user', params: { card_id: 'abc123', question: 'Which day?', options: ['A', 'B'] } });
    assert.equal(called.isError, undefined);
    assert.deepEqual(calls.at(-1)?.args[1], 'opencode', 'OpenCode calls are written as OpenCode');
    assert.equal((await injector.handleIpc({ id: '3', op: 'call', group: 'board', tool: 'nope', params: {} })).isError, true);
    assert.equal((await injector.handleIpc({ id: '4', op: 'list', group: 'shell' })).isError, true);
    setBoardToolController(() => null);
  }

  // ── Sprint 157: the deck tools, through the same library the buttons use ──
  {
    const { DeckLibrary } = await import('../decks/DeckLibrary');
    const { slidesOfText } = await import('../decks/deckLibraryFormat');
    const files: Record<string, string> = {
      'Slide library/Agents.deck.md': '---\ndeck: 1\n---\n\n```slide points\nid: g1\ntitle: Why agents?\n```\n\nAgents change who does the steps.\n',
      'Clients/Harbour.deck.md': '---\ndeck: 1\n---\n\n```slide title\nid: t1\ntitle: Harbour\n```\n\nWelcome.\n',
      'notes.md': 'not a deck',
    };
    const library = new DeckLibrary({
      async list() { return Object.keys(files).filter((path) => path.endsWith('.deck.md')).map((path) => ({ path, modified: 0 })); },
      async read(path) { return files[path] ?? null; },
      async write(path, text) { files[path] = text; },
    });
    const viewed: Array<{ count: number; afterIndex: number }> = [];
    let open = false;
    const deckGroup = tools.DECK_TOOL_GROUP;
    assert.equal(tools.deckToolsAvailable(), false, 'no decks host: no deck tools');
    tools.setDeckToolHost(() => ({
      library: () => library,
      viewInsert: () => (open ? async (parts, afterIndex) => { viewed.push({ count: parts.length, afterIndex }); return true; } : undefined),
    }));
    assert.equal(tools.deckToolsAvailable(), true);
    assert.deepEqual(toolGroupsFor({ browser: false }).map((group) => group.id), ['deck']);
    assert.equal(toolGroupById('deck'), deckGroup);
    assert.deepEqual(deckGroup.tools.map((tool) => tool.name), ['list_decks', 'read_deck', 'insert_slides', 'update_library_slide', 'add_to_library']);
    assert.equal(claudeAllowName(deckGroup, deckGroup.tools[0]), 'mcp__ritemark_decks__list_decks');
    const tool = (name: string) => deckGroup.tools.find((item) => item.name === name)!;
    const context = { runtimeId: 'claude-code' as const };

    const listed = await runTool(tool('list_decks'), { where: 'library' }, context);
    assert.match(listed.text, /^Slide library\/Agents\.deck\.md · library topic · 1 slide/);
    // A closed deck: the copy is written into its file, with its from: line.
    const inserted = await runTool(tool('insert_slides'), { deck: 'Clients/Harbour.deck.md', source: 'Slide library/Agents.deck.md', slide_ids: ['g1'], after: 1 }, context);
    assert.equal(inserted.text, 'Inserted 1 slide into Harbour: slide 2.');
    const copy = slidesOfText(files['Clients/Harbour.deck.md'])[1];
    assert.match(copy.data.from ?? '', /^Slide library\/Agents\.deck\.md#g1 @[0-9a-z]{6}$/);
    assert.match((await runTool(tool('read_deck'), { deck: 'Clients/Harbour.deck.md' }, context)).text, /Slide 2 · id \w+ · points · copy of Slide library\/Agents\.deck\.md/);
    // An open deck: through its view, as one undo step there; the file is left to the view.
    open = true;
    const before = files['Clients/Harbour.deck.md'];
    await runTool(tool('insert_slides'), { deck: 'Clients/Harbour.deck.md', source: 'Slide library/Agents.deck.md', slide_ids: ['g1'] }, context);
    assert.deepEqual(viewed, [{ count: 1, afterIndex: 1 }]);
    assert.equal(files['Clients/Harbour.deck.md'], before);
    // An open deck that doesn't take them: an error, and the file is never written under the view.
    const refusing = tools.createDeckToolGroup(() => ({ library: () => library, viewInsert: () => async () => false }));
    const refused = await runTool(refusing.tools.find((item) => item.name === 'insert_slides')!, { deck: 'Clients/Harbour.deck.md', source: 'Slide library/Agents.deck.md', slide_ids: ['g1'] }, context);
    assert.equal(refused.isError, true);
    assert.match(refused.text, /didn't take the slides/);
    assert.equal(files['Clients/Harbour.deck.md'], before);
    open = false;
    // Update the library: the topic gets the copy's words, the copy a new from: stamp.
    files['Clients/Harbour.deck.md'] = files['Clients/Harbour.deck.md'].replace('title: Why agents?', 'title: Why agents, now?');
    const updated = await runTool(tool('update_library_slide'), { deck: 'Clients/Harbour.deck.md', slide_id: copy.data.id }, context);
    assert.equal(updated.isError, undefined, updated.text);
    assert.match(files['Slide library/Agents.deck.md'], /title: Why agents, now\?/);
    assert.notEqual(slidesOfText(files['Clients/Harbour.deck.md'])[1].data.from, copy.data.from);
    // Add to library: a new topic, and the slide becomes a copy of it.
    const added = await runTool(tool('add_to_library'), { deck: 'Clients/Harbour.deck.md', slide_id: 't1', topic: 'Openings' }, context);
    assert.equal(added.text, 'Added the slide to the library under Openings (a new topic).');
    assert.match(slidesOfText(files['Clients/Harbour.deck.md'])[0].data.from ?? '', /^Slide library\/Openings\.deck\.md#/);
    // An open deck gets the copy's new from: through its view, not as a whole-file write.
    const setThroughView: Array<[string, string]> = [];
    const viaView = tools.createDeckToolGroup(() => ({
      library: () => library,
      viewInsert: () => undefined,
      viewSetFrom: () => async (id, from) => { setThroughView.push([id, from]); return true; },
    }));
    const deckText = files['Clients/Harbour.deck.md'];
    await runTool(viaView.tools.find((item) => item.name === 'update_library_slide')!, { deck: 'Clients/Harbour.deck.md', slide_id: copy.data.id }, context);
    assert.equal(setThroughView.length, 1);
    assert.equal(files['Clients/Harbour.deck.md'], deckText);
    // OpenCode reaches the same tools through the IPC adapter.
    const injector = new RitemarkToolsInjector();
    const ipcList = await injector.handleIpc({ id: '1', op: 'list', group: 'deck' });
    assert.deepEqual(ipcList.tools?.map((item) => item.name), deckGroup.tools.map((item) => item.name));
    const ipcCall = await injector.handleIpc({ id: '2', op: 'call', group: 'deck', tool: 'list_decks', params: { where: 'library' } });
    assert.match(ipcCall.text ?? "", /Slide library\/Agents\.deck\.md/);
    // A copy that can't be linked: the library write is undone, so nothing is left behind.
    const agentsBefore = files['Slide library/Agents.deck.md'];
    const unlinked = tools.createDeckToolGroup(() => ({
      library: () => library,
      viewInsert: () => undefined,
      viewSetFrom: () => async () => false,
    }));
    const failedAdd = await runTool(unlinked.tools.find((item) => item.name === 'add_to_library')!, { deck: 'Clients/Harbour.deck.md', slide_id: 't1', topic: 'Agents' }, context);
    assert.equal(failedAdd.isError, true);
    assert.match(failedAdd.text, /The library is back as it was/);
    assert.equal(files['Slide library/Agents.deck.md'], agentsBefore);
    // Only decks inside the project.
    assert.equal((await runTool(tool('read_deck'), { deck: 'notes.md' }, context)).isError, true);
    assert.equal((await runTool(tool('read_deck'), { deck: '../outside.deck.md' }, context)).isError, true);
    assert.equal((await runTool(tool('insert_slides'), { deck: 'Clients/Harbour.deck.md', source: 'Slide library/Agents.deck.md', slide_ids: ['../x'] }, context)).isError, true);
    tools.setDeckToolHost(() => null);
    assert.equal(tools.deckToolsAvailable(), false);
  }

  // ── 16 November: an exercise slide's pill (`tag:`) goes through the deck tools as written ──
  {
    const { DeckLibrary } = await import('../decks/DeckLibrary');
    const { slidesOfText } = await import('../decks/deckLibraryFormat');
    const files: Record<string, string> = {
      'Slide library/Practice.deck.md': '---\ndeck: 1\n---\n\n```slide exercise\nid: e1\ntitle: Proovi\ntag: "Ülesanne: 1"\nitems:\n- heading: Ava fail\n```\n\n```slide exercise\nid: e2\ntitle: Quiet\ntag: ""\nitems:\n- heading: Read\n```\n\n```slide exercise\nid: e3\ntitle: Plain\n```\n',
      'Clients/Harbour.deck.md': '---\ndeck: 1\n---\n\n```slide title\nid: t1\ntitle: Harbour\n```\n',
    };
    const library = new DeckLibrary({
      async list() { return Object.keys(files).map((path) => ({ path, modified: 0 })); },
      async read(path) { return files[path] ?? null; },
      async write(path, text) { files[path] = text; },
    });
    const group = tools.createDeckToolGroup(() => ({ library: () => library, viewInsert: () => undefined }));
    const tool = (name: string) => group.tools.find((item) => item.name === name)!;
    const context = { runtimeId: 'claude-code' as const };
    const inserted = await runTool(tool('insert_slides'), { deck: 'Clients/Harbour.deck.md', source: 'Slide library/Practice.deck.md', slide_ids: ['e1', 'e2', 'e3'] }, context);
    assert.equal(inserted.isError, undefined, inserted.text);
    const copies = slidesOfText(files['Clients/Harbour.deck.md']).slice(1);
    assert.deepEqual(copies.map((slide) => slide.data.tag), ['Ülesanne: 1', '', undefined], 'insert_slides keeps the pill, an empty one, and no line');
    assert.match(files['Clients/Harbour.deck.md'], /\ntag: "Ülesanne: 1"\n/);
    assert.match(files['Clients/Harbour.deck.md'], /\ntag: ""\n/);
    // read_deck says the pill's words, or none; a slide without the line shows the default and says nothing of it.
    const read = (await runTool(tool('read_deck'), { deck: 'Clients/Harbour.deck.md' }, context)).text;
    assert.match(read, /exercise[^\n]*\npill "Ülesanne: 1" · Proovi · Ava fail/);
    assert.match(read, /exercise[^\n]*\nno pill · Quiet · Read/);
    assert.match(read, /exercise[^\n]*\nPlain\n/);
    // An edit to the copy's pill is a change to the slide: Update the library writes it back.
    const copyId = copies[2].data.id as string;
    files['Clients/Harbour.deck.md'] = files['Clients/Harbour.deck.md'].replace('title: Plain', 'title: Plain\ntag: Harjutus');
    assert.match((await runTool(tool('read_deck'), { deck: 'Clients/Harbour.deck.md' }, context)).text, /changed here[^\n]*\npill "Harjutus" · Plain/);
    const updated = await runTool(tool('update_library_slide'), { deck: 'Clients/Harbour.deck.md', slide_id: copyId }, context);
    assert.equal(updated.isError, undefined, updated.text);
    assert.equal(slidesOfText(files['Slide library/Practice.deck.md'])[2].data.tag, 'Harjutus');
    // The library's search finds a slide by its pill's words.
    const found = await runTool(tool('list_decks'), { where: 'library', query: 'Ülesanne' }, context);
    assert.match(found.text, /Practice\.deck\.md[^\n]*1 slide matching[^\n]*\n {2}slide 1 \(id e1, exercise\): Proovi/);
    // read_deck quotes the pill's words as JSON, so a quote in them can't end them.
    files['Clients/Harbour.deck.md'] = files['Clients/Harbour.deck.md'].replace('tag: Harjutus', 'tag: \'Say "hi"\'');
    assert.match((await runTool(tool('read_deck'), { deck: 'Clients/Harbour.deck.md' }, context)).text, /pill "Say \\"hi\\"" · Plain/);
    // A pill that draws the default, written out in any case, reads as no line.
    files['Clients/Harbour.deck.md'] = files['Clients/Harbour.deck.md'].replace('tag: \'Say "hi"\'', 'tag: EXERCISE');
    assert.match((await runTool(tool('read_deck'), { deck: 'Clients/Harbour.deck.md' }, context)).text, /exercise[^\n]*\nPlain\n/);
    // Search finds a slide by the pill it draws: with the line gone, the default.
    files['Clients/Harbour.deck.md'] = files['Clients/Harbour.deck.md'].replace('\ntag: EXERCISE', '');
    assert.match((await runTool(tool('list_decks'), { where: 'other', query: 'exercise' }, context)).text, /Harbour\.deck\.md[^\n]*1 slide matching[^\n]*\n {2}slide 4 \([^)]*exercise\): Plain/);
  }

  console.log('runtime/ritemarkTools: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
