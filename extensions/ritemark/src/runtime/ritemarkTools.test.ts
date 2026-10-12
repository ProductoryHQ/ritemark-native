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
    history: [],
    copiedFrom: null,
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
    assert.deepEqual(generated, OLD_ADAPTER_TOOLS, 'the OpenCode adapter sees exactly the tools it had');
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
    assert.deepEqual(routed, { text: 'Moved card abc123 to Doing.', success: true });
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

  console.log('runtime/ritemarkTools: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
