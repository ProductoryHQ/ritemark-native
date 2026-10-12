/**
 * ritemarkTools — Ritemark's own agent tools, defined once for all three
 * runtimes (Sprint 130, W5).
 *
 * A tool is a name, a description, a zod input shape and a `run`. Each runtime
 * gets the same definition in its own shape:
 *   - Claude: an in-process SDK MCP server per group, tools `mcp__<server>__<tool>`;
 *   - Codex: dynamic tools, named `<codexPrefix><tool>`, JSON Schema from zod;
 *   - OpenCode: the stdio MCP adapter, which asks the host for the group's
 *     tools and forwards calls over IPC; OpenCode names them `<server>_<tool>`.
 *
 * Before this the browser tools existed three times (Claude zod, Codex JSON,
 * adapter JSON) and the copies had drifted (Phase 0, P4). The browser tools
 * keep their model-visible names exactly.
 *
 * Which groups a turn gets: the browser group with the `browser-agent-control`
 * flag, the board group whenever this window has a task board (a project
 * folder and the `task-board` flag). `RitemarkToolsInjector` turns the groups
 * into each runtime's own wiring.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import type { AgentId } from '../agent/types';
import {
  browserClick,
  browserFill,
  browserNavigate,
  browserScroll,
  browserSnapshot,
  browserType,
  formatActionResultForAgent,
  type BrowserActionResult,
} from '../browser/BrowserActionTools';
import type { DynamicToolDefinition } from '../codex/codexProtocol';
import { ACTOR_OF_RUNTIME, type BoardController } from '../taskBoard/BoardController';
import type { BoardAnswer } from '../taskBoard/protocol';
import { CARD_STAGES } from '../taskBoard/cardTypes';

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface ToolContext {
  /** The runtime that called the tool; the board writes it as the actor. */
  runtimeId: AgentId;
}

export interface RitemarkTool {
  name: string;
  description: string;
  input: z.ZodRawShape;
  run(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export type ToolGroupId = 'browser' | 'board';

export interface RitemarkToolGroup {
  id: ToolGroupId;
  /** MCP server name (Claude, OpenCode). */
  server: string;
  /** Codex dynamic tool name prefix (the browser keeps its pre-Sprint-130 names). */
  codexPrefix: string;
  tools: RitemarkTool[];
}

// ── JSON Schema for Codex and OpenCode ──────────────────────────────────────

/** The tool's input as JSON Schema, generated from its zod shape (Phase 0, P4:
 *  equal to the schemas the OpenCode adapter and Claude already used). */
export function toolJsonSchema(tool: RitemarkTool, options: { closed?: boolean } = {}): Record<string, unknown> {
  const schema = z.toJSONSchema(z.object(tool.input), { io: 'input' }) as Record<string, unknown>;
  delete schema.$schema;
  if (options.closed) schema.additionalProperties = false;
  return schema;
}

export function codexToolName(group: RitemarkToolGroup, tool: RitemarkTool): string {
  return `${group.codexPrefix}${tool.name}`;
}

export function claudeAllowName(group: RitemarkToolGroup, tool: RitemarkTool): string {
  return `mcp__${group.server}__${tool.name}`;
}

export function codexDynamicTools(groups: RitemarkToolGroup[]): DynamicToolDefinition[] {
  return groups.flatMap((group) =>
    group.tools.map((tool) => ({
      name: codexToolName(group, tool),
      description: tool.description,
      inputSchema: toolJsonSchema(tool, { closed: true }),
    })),
  );
}

/** The group and tool a Codex dynamic tool name refers to, if any. */
export function findCodexTool(groups: RitemarkToolGroup[], name: string): { group: RitemarkToolGroup; tool: RitemarkTool } | null {
  for (const group of groups) {
    for (const tool of group.tools) if (codexToolName(group, tool) === name) return { group, tool };
  }
  return null;
}

/**
 * A stable key for a set of Codex dynamic tools (names and schemas; '' for
 * none). A Codex thread keeps the tools it started with, and `thread/resume`
 * cannot add any (Phase 0, P2): a thread whose key differs starts fresh, and
 * the key is part of the continuation fingerprint.
 */
export function toolSetKey(tools: DynamicToolDefinition[] | undefined): string {
  if (!tools?.length) return '';
  const canonical = tools.map((tool) => `${tool.name}:${JSON.stringify(tool.inputSchema)}`).sort().join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

/** A tool as an MCP `tools/list` entry (the OpenCode adapter). */
export function mcpToolDefinition(tool: RitemarkTool): { name: string; description: string; inputSchema: Record<string, unknown> } {
  return { name: tool.name, description: tool.description, inputSchema: toolJsonSchema(tool) };
}

/** Run a tool, turning a thrown error into a result the model can act on. */
export async function runTool(tool: RitemarkTool, args: unknown, context: ToolContext): Promise<ToolResult> {
  try {
    const parsed = z.object(tool.input).safeParse(args ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { text: `Invalid input${issue?.path.length ? ` for ${issue.path.join('.')}` : ''}: ${issue?.message ?? 'unknown'}`, isError: true };
    }
    return await tool.run(parsed.data as Record<string, unknown>, context);
  } catch (error) {
    return { text: error instanceof Error ? error.message : String(error), isError: true };
  }
}

// ── Browser ─────────────────────────────────────────────────────────────────

function browserText(result: BrowserActionResult): ToolResult {
  return { text: formatActionResultForAgent(result), ...(result.error ? { isError: true } : {}) };
}

export const BROWSER_TOOL_GROUP: RitemarkToolGroup = {
  id: 'browser',
  server: 'ritemark_browser',
  codexPrefix: 'ritemark_',
  tools: [
    {
      name: 'browser_navigate',
      description:
        'Open or navigate the integrated Ritemark browser. With type="url" + url: reuses the FIRST existing browser tab if any are open, otherwise creates a new tab — call this directly when the user says "open browser and go to X". With type="back"/"forward"/"reload": acts on the active tab (requires one to exist).\n\nIf the URL is ambiguous (e.g. the user says "go to my company website" with no exact URL), run a web search FIRST to resolve the exact URL, then call this tool with that URL. Do not guess — the tool will navigate to whatever you give it.\n\nReturns the updated ARIA page summary so you can observe the resulting page in one round trip.',
      input: {
        type: z.enum(['url', 'back', 'forward', 'reload']).optional().describe('Navigation kind (default "url").'),
        url: z.string().optional().describe('Target URL when type is "url". Must be a complete URL — resolve via web search first if the user gave an ambiguous name.'),
      },
      run: async (args) => browserText(await browserNavigate(args as unknown as Parameters<typeof browserNavigate>[0])),
    },
    {
      name: 'browser_click',
      description:
        'Click an element in the active integrated browser tab. Prefer ARIA refs (e.g. "@e12") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button="right" for context menu.',
      input: {
        ref: z.string().optional().describe('ARIA ref from the page summary, e.g. "@e12".'),
        selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
        button: z.enum(['left', 'right', 'middle']).optional(),
        dblClick: z.boolean().optional(),
      },
      run: async (args) => browserText(await browserClick(args as unknown as Parameters<typeof browserClick>[0])),
    },
    {
      name: 'browser_fill',
      description:
        'Replace the value of an input/textarea/select in the active integrated browser tab. Calls Playwright fill() — clears the field before typing. For sending individual key events use browser_type.',
      input: {
        ref: z.string().optional().describe('ARIA ref from the page summary.'),
        selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
        value: z.string().describe('Value to write into the field.'),
      },
      run: async (args) => browserText(await browserFill(args as unknown as Parameters<typeof browserFill>[0])),
    },
    {
      name: 'browser_type',
      description:
        'Send keystrokes to the active integrated browser tab. Use "text" to type plain text into whatever has focus, or "key" to press a single named key (e.g. "Enter", "Tab", "Escape", "Control+A").',
      input: {
        text: z.string().optional().describe('Plain text to type via keyboard.'),
        key: z.string().optional().describe('Single key or key combo to press, e.g. "Enter", "Control+A".'),
      },
      run: async (args) => browserText(await browserType(args as unknown as Parameters<typeof browserType>[0])),
    },
    {
      name: 'browser_scroll',
      description:
        'Scroll the active integrated browser tab. direction: "up"/"down" scrolls by amount px (default 600); "top"/"bottom" jumps; "into-view" requires ref or selector and scrolls that element into view.',
      input: {
        direction: z.enum(['up', 'down', 'top', 'bottom', 'into-view']).optional(),
        amount: z.number().optional().describe('Scroll distance in px (default 600) for up/down directions.'),
        ref: z.string().optional(),
        selector: z.string().optional(),
      },
      run: async (args) => browserText(await browserScroll(args as unknown as Parameters<typeof browserScroll>[0])),
    },
    {
      name: 'browser_snapshot',
      description:
        'Return the current ARIA outline of the active integrated browser tab — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling browser_navigate again. Read-only: does not require browser control consent, but the tab must be shared with Ritemark AI by the user.',
      input: {},
      run: async () => browserText(await browserSnapshot()),
    },
  ],
};

// ── Task board ──────────────────────────────────────────────────────────────

const STAGE_WORDS: Record<string, string> = { idea: 'Ideas', todo: 'To do', doing: 'Doing', done: 'Done' };

function answerText(answer: BoardAnswer, success: string): ToolResult {
  return answer.ok ? { text: success } : { text: answer.message, isError: true };
}

const cardId = z.string().regex(/^[a-z0-9]{6}$/).describe('The card id, six lowercase letters or digits (from list_cards).');

/**
 * The board tools. `controller` is read at call time: the board exists only
 * with a project folder and the task-board flag on.
 */
export function createBoardToolGroup(controller: () => BoardController | null): RitemarkToolGroup {
  const board = (): BoardController => {
    const current = controller();
    if (!current) throw new Error('This window has no task board (no project folder, or the board is turned off).');
    return current;
  };
  return {
    id: 'board',
    server: 'ritemark_board',
    codexPrefix: 'ritemark_board_',
    tools: [
      {
        name: 'list_cards',
        description:
          "List the cards on this project's task board: id, stage, title, who moves next, Done when and how many files each names. Read this before changing the board.",
        input: {
          stage: z.enum(CARD_STAGES).optional().describe('Only cards in this stage.'),
        },
        run: async (args) => {
          const snapshot = await board().snapshot();
          const cards = snapshot.cards.filter((card) => !args.stage || card.stage === args.stage);
          if (!cards.length) return { text: args.stage ? `No cards in ${STAGE_WORDS[String(args.stage)]}.` : 'The board has no cards yet.' };
          const lines = cards.map((card) => {
            const who = card.move === 'agent' ? 'an agent' : card.move === 'you' ? 'the user' : 'nobody';
            const parts = [`${card.id} · ${STAGE_WORDS[card.stage]}${card.dropped ? ' (dropped)' : ''} · ${card.title}`, `next: ${who}`];
            if (card.doneWhen) parts.push(`done when: ${card.doneWhen}`);
            if (card.files.length) parts.push(`${card.files.length} file${card.files.length === 1 ? '' : 's'}`);
            return parts.join(' · ');
          });
          return { text: lines.join('\n') };
        },
      },
      {
        name: 'read_card',
        description: 'Read one card: title, stage, Done when, description, files, the latest result, an open decision, and the last 10 history lines.',
        input: { card_id: cardId },
        run: async (args) => {
          const snapshot = await board().snapshot();
          const card = snapshot.cards.find((item) => item.id === args.card_id);
          if (!card) return { text: `There is no card ${String(args.card_id)} on the board. Use list_cards to find it.`, isError: true };
          const lines = [`${card.title}`, `Stage: ${STAGE_WORDS[card.stage]}`];
          if (card.doneWhen) lines.push(`Done when: ${card.doneWhen}`);
          if (card.files.length) lines.push(`Files: ${card.files.map((file) => file.path + (file.exists ? '' : ' (missing)')).join(', ')}`);
          lines.push('', 'Description:', card.description.trim() || '(none)');
          if (card.result) {
            lines.push('', `Latest result (${card.result.by}): ${card.result.summary}`);
            if (card.result.check.length) lines.push(`Check: ${card.result.check.join('; ')}`);
          }
          if (card.ask) lines.push('', `Open decision: ${card.ask.question} Options: ${card.ask.options.join(' / ')}`);
          lines.push('', 'History:', ...card.history.slice(-10).map((entry) => `${entry.at} ${entry.by}: ${entry.what}`));
          return { text: lines.join('\n') };
        },
      },
      {
        name: 'add_card',
        description:
          'Add a card to the board (to To do, or to Ideas for something to weigh up later). Use one card per piece of work, with a short title the user would write, and say what done looks like.',
        input: {
          title: z.string().describe('A short title, one line, at most 200 characters.'),
          done_when: z.string().optional().describe('One line: what done looks like.'),
          description: z.string().optional().describe('Markdown details. At most 16 KB.'),
          stage: z.enum(['idea', 'todo']).optional().describe('Where the card goes (default todo).'),
          files: z.array(z.string()).optional().describe('Project-relative paths of the files the card is about.'),
        },
        run: async (args, context) => {
          const answer = await board().add(
            {
              title: String(args.title),
              stage: (args.stage as 'idea' | 'todo' | undefined) ?? 'todo',
              ...(args.done_when ? { doneWhen: String(args.done_when) } : {}),
              ...(args.description ? { description: String(args.description) } : {}),
              ...(args.files ? { files: args.files as string[] } : {}),
            },
            ACTOR_OF_RUNTIME[context.runtimeId],
          );
          return answerText(answer, answer.ok ? `Added card ${answer.cardId} to ${STAGE_WORDS[String(args.stage ?? 'todo')]}.` : '');
        },
      },
      {
        name: 'update_card',
        description: "Change a card's title, Done when, description or files. Fields you leave out stay as they are.",
        input: {
          card_id: cardId,
          title: z.string().optional(),
          done_when: z.string().optional().describe('An empty string clears it.'),
          description: z.string().optional().describe('Replaces the whole description (Markdown).'),
          files: z.array(z.string()).optional().describe('Replaces the list of project-relative paths.'),
        },
        run: async (args, context) => {
          const answer = await board().update(
            String(args.card_id),
            {
              ...(args.title !== undefined ? { title: String(args.title) } : {}),
              ...(args.done_when !== undefined ? { doneWhen: String(args.done_when) } : {}),
              ...(args.description !== undefined ? { description: String(args.description) } : {}),
              ...(args.files !== undefined ? { files: args.files as string[] } : {}),
            },
            ACTOR_OF_RUNTIME[context.runtimeId],
          );
          return answerText(answer, `Updated card ${String(args.card_id)}.`);
        },
      },
      {
        name: 'move_card',
        description: 'Move a card to Ideas, To do or Doing. Only the user marks a card done.',
        input: {
          card_id: cardId,
          stage: z.enum(CARD_STAGES).describe('The stage to move it to.'),
        },
        run: async (args, context) => {
          const answer = await board().move(String(args.card_id), args.stage as (typeof CARD_STAGES)[number], {}, ACTOR_OF_RUNTIME[context.runtimeId]);
          return answerText(answer, `Moved card ${String(args.card_id)} to ${STAGE_WORDS[String(args.stage)]}.`);
        },
      },
      {
        name: 'report_result',
        description:
          'When you finish work on a card, report it: one or two sentences on what you did, and up to three short things the user should check. The card then waits for the user to review it.',
        input: {
          card_id: cardId,
          summary: z.string().describe('One or two sentences: what you did. At most 280 characters.'),
          check: z.array(z.string()).optional().describe('Up to three short things the user should check.'),
        },
        run: async (args, context) => {
          const answer = await board().reportResult(String(args.card_id), ACTOR_OF_RUNTIME[context.runtimeId], {
            summary: String(args.summary),
            ...(args.check ? { check: args.check as string[] } : {}),
          });
          return answerText(answer, 'Reported. The user will review it.');
        },
      },
      {
        name: 'ask_user',
        description:
          'Leave a decision for the user on a card, with 2 to 4 options, when the choice would change the result. Ask before long work rather than stopping halfway; then end your turn. The answer comes back to this conversation.',
        input: {
          card_id: cardId,
          question: z.string().describe('The question, at most 500 characters.'),
          options: z.array(z.string()).describe('2 to 4 short options, at most 80 characters each.'),
        },
        run: async (args, context) => {
          const answer = await board().askUser(String(args.card_id), ACTOR_OF_RUNTIME[context.runtimeId], {
            question: String(args.question),
            options: args.options as string[],
          });
          return answerText(answer, 'The decision is on the card under Your calls. End your turn; the answer comes back here.');
        },
      },
    ],
  };
}

// ── Which groups a turn gets ────────────────────────────────────────────────

let boardController: () => BoardController | null = () => null;

/** The task board host hands the board to the tools once it exists. */
export function setBoardToolController(provider: () => BoardController | null): void {
  boardController = provider;
}

export const BOARD_TOOL_GROUP: RitemarkToolGroup = createBoardToolGroup(() => boardController());

/** This window has a task board, so agents get the board tools. */
export function boardToolsAvailable(): boolean {
  return boardController() !== null;
}

/** The groups for one turn (Claude, Codex) or one OpenCode process. */
export function toolGroupsFor(options: { browser: boolean }): RitemarkToolGroup[] {
  return [...(options.browser ? [BROWSER_TOOL_GROUP] : []), ...(boardToolsAvailable() ? [BOARD_TOOL_GROUP] : [])];
}

export function toolGroupById(id: string): RitemarkToolGroup | null {
  if (id === BROWSER_TOOL_GROUP.id) return BROWSER_TOOL_GROUP;
  if (id === BOARD_TOOL_GROUP.id) return BOARD_TOOL_GROUP;
  return null;
}
