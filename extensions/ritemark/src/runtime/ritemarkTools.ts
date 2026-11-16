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
  inBrowserQueue,
  BrowserTurnPage,
  type BrowserActionResult,
  type BrowserActionTarget,
} from '../browser/BrowserActionTools';
import type { DynamicToolDefinition } from '../codex/codexProtocol';
import { ACTOR_OF_RUNTIME, type BoardController } from '../taskBoard/BoardController';
import type { BoardAnswer } from '../taskBoard/protocol';
import { CARD_STAGES } from '../taskBoard/cardTypes';
import { deckName, type CopiedPart, type DeckLibrary } from '../decks/DeckLibrary';
import { normalizePath } from '../decks/deckLibraryFormat';

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface ToolContext {
  /** The runtime that called the tool; the board writes it as the actor. */
  runtimeId: AgentId;
  /** #658: the conversation's browser page; the browser tools act in it. Without it they have no page. */
  browserPage?: BrowserTurnPage;
}

export interface RitemarkTool {
  name: string;
  description: string;
  input: z.ZodRawShape;
  run(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export type ToolGroupId = 'browser' | 'board' | 'deck';

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

/** #658: every browser tool takes the page it acts in; left out, the page the turn was given. */
const pageIdInput = z
  .string()
  .optional()
  .describe(
    'The page to act in. Leave it out to act in the page the user had in front when they sent the message. Pass a page id only when a tool result gave you one (for example a page your click opened).',
  );

const NO_PAGE_ERROR =
  'No browser page was given to this turn: the user had no browser page in front when they sent the message, or this kind of message does not carry one. Nothing was done. Ask the user to bring the page to the front and send the message again, or open an address with browser_navigate.';

/**
 * Runs a browser action in the turn's page (#658), or in the page the AI named
 * with `page_id`. The page goes to patch 010 by id; it is never looked up again
 * from the tab in front. With no page, only navigate to an address acts: in a
 * new tab, which becomes the turn's page.
 */
async function onPage(
  args: Record<string, unknown>,
  context: ToolContext,
  act: (actionArgs: Record<string, unknown>, target: BrowserActionTarget) => Promise<BrowserActionResult>,
  options: { opensTab?: boolean } = {},
): Promise<ToolResult> {
  const { page_id: pageIdArg, ...actionArgs } = args;
  const explicit = typeof pageIdArg === 'string' && pageIdArg.trim() ? pageIdArg.trim() : undefined;
  const page = context.browserPage ?? new BrowserTurnPage();
  // One step of the browser queue: the page is read, acted in and noted before the next call reads it, so a second
  // call started at the same time acts in the tab the first one opened instead of opening its own.
  return inBrowserQueue(async () => {
    const target = page.target(explicit);
    if (!target) {
      if (!options.opensTab) return { text: `Error: ${NO_PAGE_ERROR}`, isError: true };
      const opened = await act(actionArgs, page.newTabTarget());
      page.noteResult(opened, { adopt: true });
      return browserText(opened);
    }
    const result = await act(actionArgs, target);
    page.noteResult(result);
    return browserText(result);
  });
}

export const BROWSER_TOOL_GROUP: RitemarkToolGroup = {
  id: 'browser',
  server: 'ritemark_browser',
  codexPrefix: 'ritemark_',
  tools: [
    {
      name: 'browser_navigate',
      description:
        'Open or navigate the integrated Ritemark browser. With type="url" + url: loads the address in the page you were given (the browser page the user had in front when they sent the message); with no such page, opens a new tab — call this directly when the user says "open browser and go to X". With type="back"/"forward"/"reload": acts on the page you were given (requires one).\n\nIf the URL is ambiguous (e.g. the user says "go to my company website" with no exact URL), run a web search FIRST to resolve the exact URL, then call this tool with that URL. Do not guess — the tool will navigate to whatever you give it.\n\nReturns the updated ARIA page summary so you can observe the resulting page in one round trip.',
      input: {
        type: z.enum(['url', 'back', 'forward', 'reload']).optional().describe('Navigation kind (default "url").'),
        url: z.string().optional().describe('Target URL when type is "url". Must be a complete URL — resolve via web search first if the user gave an ambiguous name.'),
        page_id: pageIdInput,
      },
      run: async (args, context) =>
        onPage(args, context, (actionArgs, target) => browserNavigate(actionArgs as unknown as Parameters<typeof browserNavigate>[0], target), {
          opensTab: (args.type ?? 'url') === 'url',
        }),
    },
    {
      name: 'browser_click',
      description:
        'Click an element in the browser page you were given (see page_id). Prefer ARIA refs (e.g. "@e12") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button="right" for context menu.',
      input: {
        ref: z.string().optional().describe('ARIA ref from the page summary, e.g. "@e12".'),
        selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
        button: z.enum(['left', 'right', 'middle']).optional(),
        dblClick: z.boolean().optional(),
        page_id: pageIdInput,
      },
      run: async (args, context) => onPage(args, context, (actionArgs, target) => browserClick(actionArgs as unknown as Parameters<typeof browserClick>[0], target)),
    },
    {
      name: 'browser_fill',
      description:
        'Replace the value of an input/textarea/select in the browser page you were given (see page_id). Calls Playwright fill() — clears the field before typing. For sending individual key events use browser_type.',
      input: {
        ref: z.string().optional().describe('ARIA ref from the page summary.'),
        selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
        value: z.string().describe('Value to write into the field.'),
        page_id: pageIdInput,
      },
      run: async (args, context) => onPage(args, context, (actionArgs, target) => browserFill(actionArgs as unknown as Parameters<typeof browserFill>[0], target)),
    },
    {
      name: 'browser_type',
      description:
        'Send keystrokes to the browser page you were given (see page_id). Use "text" to type plain text into whatever has focus, or "key" to press a single named key (e.g. "Enter", "Tab", "Escape", "Control+A").',
      input: {
        text: z.string().optional().describe('Plain text to type via keyboard.'),
        key: z.string().optional().describe('Single key or key combo to press, e.g. "Enter", "Control+A".'),
        page_id: pageIdInput,
      },
      run: async (args, context) => onPage(args, context, (actionArgs, target) => browserType(actionArgs as unknown as Parameters<typeof browserType>[0], target)),
    },
    {
      name: 'browser_scroll',
      description:
        'Scroll the browser page you were given (see page_id). direction: "up"/"down" scrolls by amount px (default 600); "top"/"bottom" jumps; "into-view" requires ref or selector and scrolls that element into view.',
      input: {
        direction: z.enum(['up', 'down', 'top', 'bottom', 'into-view']).optional(),
        amount: z.number().optional().describe('Scroll distance in px (default 600) for up/down directions.'),
        ref: z.string().optional(),
        selector: z.string().optional(),
        page_id: pageIdInput,
      },
      run: async (args, context) => onPage(args, context, (actionArgs, target) => browserScroll(actionArgs as unknown as Parameters<typeof browserScroll>[0], target)),
    },
    {
      name: 'browser_snapshot',
      description:
        'Return the current ARIA outline of the browser page you were given (see page_id) — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling browser_navigate again. Read-only: does not require browser control consent, but the tab must be shared with Ritemark AI by the user.',
      input: { page_id: pageIdInput },
      run: async (args, context) => onPage(args, context, (_actionArgs, target) => browserSnapshot(target)),
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
          // An archived card is off the board but can still be read (D15).
          const card = snapshot.cards.find((item) => item.id === args.card_id) ?? snapshot.archived.find((item) => item.id === args.card_id);
          if (!card) return { text: `There is no card ${String(args.card_id)} on the board. Use list_cards to find it.`, isError: true };
          const lines = [`${card.title}`, `Stage: ${STAGE_WORDS[card.stage]}${card.archived !== null ? ' (archived by the user; only the user can restore it)' : ''}`];
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
          return answerText(answer, 'Updated the card.');
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
          return answerText(answer, `Moved the card to ${STAGE_WORDS[String(args.stage)]}.`);
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

// ── Decks (Sprint 157) ──────────────────────────────────────────────────────

/** What the deck tools need from the host: the project's library, and an open deck's view to insert through. */
export interface DeckToolHost {
  library(): DeckLibrary | null;
  /** The open view of a deck (project-relative path), which inserts as one undo step there; undefined when closed. */
  viewInsert(deckPath: string): ((parts: CopiedPart[], afterIndex: number) => Promise<boolean>) | undefined;
  /** The open view of a deck, which sets a copy's `from:` line; undefined when closed. */
  viewSetFrom?(deckPath: string): ((id: string, from: string) => Promise<boolean>) | undefined;
}

const deckPathInput = (what: string) =>
  z.string().min(1).max(1024).describe(`${what}: its path from the project's top, as list_decks gives it, ending in .deck.md.`);
const slideIdInput = z.string().regex(/^[0-9a-z]{1,16}$/i).describe("A slide's id, as read_deck gives it.");

/** A deck path the tools accept: a `.deck.md` inside the project, written with `/`. */
function deckPathOf(value: unknown): string {
  const text = String(value ?? '').trim().replace(/\\/g, '/');
  const path = normalizePath(text);
  if (!path || !/\.deck\.md$/i.test(path)) throw new Error(`${text} is not a deck in this project. Use list_decks to find one.`);
  return path;
}

/** A slide's words in one line, for read_deck. */
function slideWords(kind: string, data: { title?: string; subtitle?: string; number?: string; tag?: string; items?: Array<{ heading?: string; text?: string }>; rows?: string[][] }): string {
  return [
    // An exercise's pill, when its `tag:` line says other words than the default, or none.
    kind === 'exercise' && data.tag !== undefined ? (data.tag.trim() ? `pill ${JSON.stringify(data.tag)}` : 'no pill') : '',
    data.number, data.title, data.subtitle,
    ...(data.items ?? []).map(item => [item.heading, item.text].filter(Boolean).join(': ')),
    ...(data.rows ?? []).map(row => row.join(' | ')),
  ].filter(Boolean).join(' · ');
}

export function createDeckToolGroup(host: () => DeckToolHost | null): RitemarkToolGroup {
  const library = (): { host: DeckToolHost; library: DeckLibrary } => {
    const current = host();
    const project = current?.library();
    if (!current || !project) throw new Error('Decks need a project folder in this window (and decks turned on).');
    return { host: current, library: project };
  };
  return {
    id: 'deck',
    server: 'ritemark_decks',
    codexPrefix: 'ritemark_decks_',
    tools: [
      {
        name: 'list_decks',
        description:
          "List the project's decks (.deck.md files): the Slide library's topics (one deck per topic, in the folder `Slide library`) and every other deck. With a query, only decks and slides whose words or handout match. Returns each deck's path, slide count, theme and when it changed.",
        input: {
          where: z.enum(['library', 'other', 'all']).optional().describe('library: only the Slide library\'s topics; other: only the other decks; all (the default): both.'),
          query: z.string().max(200).optional().describe('Words to look for in slide titles, words and handouts.'),
        },
        run: async (args) => {
          const decks = await library().library.listDecks({ where: args.where as 'library' | 'other' | 'all' | undefined, query: args.query as string | undefined });
          if (!decks.length) return { text: args.query ? `No deck has a slide matching "${String(args.query)}".` : 'This project has no decks yet.' };
          const lines = decks.map(deck => {
            const head = `${deck.path} · ${deck.topic ? 'library topic' : 'deck'} · ${deck.slides.length} slide${deck.slides.length === 1 ? '' : 's'}${args.query ? ' matching' : ''}${deck.theme ? ` · theme ${deck.theme}` : ''} · changed ${new Date(deck.modified).toISOString().slice(0, 10)}`;
            if (!args.query) return head;
            return [head, ...deck.slides.map(slide => `  slide ${slide.index + 1} (id ${slide.id ?? 'none'}, ${slide.kind}): ${slide.data.title ?? ''}`)].join('\n');
          });
          return { text: lines.join('\n') };
        },
      },
      {
        name: 'read_deck',
        description:
          "Read one deck: per slide its number, id, kind, words, whether it is skipped or has speaker notes, where a copy came from and whether it changed, and its handout text.",
        input: { deck: deckPathInput('The deck') },
        run: async (args) => {
          const path = deckPathOf(args.deck);
          const { library: project } = library();
          const slides = await project.readDeck(path);
          if (!slides) return { text: `There is no deck at ${path}. Use list_decks to find one.`, isError: true };
          const copies = slides.filter(slide => slide.data.id && slide.data.from).map(slide => ({ id: slide.data.id as string, from: slide.data.from as string, kind: slide.kind, body: slide.body, handout: slide.handout }));
          const states = new Map((await project.sourceStates(path, copies)).map(state => [state.id, state]));
          const lines = [`${deckName(path)} (${path}), ${slides.length} slide${slides.length === 1 ? '' : 's'}`];
          for (const slide of slides) {
            const state = slide.data.id ? states.get(slide.data.id) : undefined;
            const marks = [
              slide.data.skip ? 'skipped' : '',
              slide.notes ? 'has speaker notes' : '',
              state ? `copy of ${state.sourcePath}${state.missing ? ' (no longer there)' : ''}${state.changed ? ', changed here' : ''}${state.newer ? ', the source has a newer version' : ''}` : '',
            ].filter(Boolean).join('; ');
            lines.push('', `Slide ${slide.index + 1} · id ${slide.data.id ?? 'none'} · ${slide.kind}${marks ? ` · ${marks}` : ''}`, slideWords(slide.kind, slide.data) || '(no words)');
            if (slide.handout.trim()) lines.push('Handout:', slide.handout.trim());
          }
          return { text: lines.join('\n') };
        },
      },
      {
        name: 'insert_slides',
        description:
          "Insert copies of slides from the Slide library or another deck into a deck. Always use this for library slides: each copy gets its `from:` line, so the deck can later offer the library's newer version, and its picture and link paths are rewritten for the deck's folder. Each copy's handout opens with its own heading, as the deck's other parts do (the slide's title, when the source part had none). Answers with the new slides' numbers.",
        input: {
          deck: deckPathInput('The deck to insert into'),
          source: deckPathInput('The deck or library topic the slides come from'),
          slide_ids: z.array(slideIdInput).min(1).max(50).describe('The ids of the slides to copy, in the order they go in.'),
          after: z.number().int().min(0).optional().describe('Put them after this slide number (0: before the first). Left out: at the end.'),
        },
        run: async (args) => {
          const deck = deckPathOf(args.deck);
          const source = deckPathOf(args.source);
          const { host: current, library: project } = library();
          const result = await project.insertCopies(source, args.slide_ids as string[], deck, args.after as number | undefined, current.viewInsert(deck));
          const last = result.first + result.count - 1;
          return { text: `Inserted ${result.count} slide${result.count === 1 ? '' : 's'} into ${deckName(deck)}: ${result.count === 1 ? `slide ${result.first}` : `slides ${result.first}–${last}`}.` };
        },
      },
      {
        name: 'update_library_slide',
        description:
          "Write a copy's slide and handout back into the Slide library topic it came from (Update the library). Only when the user asks for it: the library is shared by every deck.",
        input: { deck: deckPathInput('The deck holding the copy'), slide_id: slideIdInput },
        run: async (args) => {
          const deck = deckPathOf(args.deck);
          const { host: current, library: project } = library();
          const copy = await project.slideOf(deck, String(args.slide_id));
          const write = await project.updateLibrarySlide(deck, copy);
          try {
            await project.setFrom(deck, String(args.slide_id), write.from, current.viewSetFrom?.(deck));
          } catch (error) {
            // The copy couldn't be linked: the library is put back, so a second try doesn't leave a second slide there.
            const undone = await project.undoWrite(write).catch(() => false);
            throw new Error(`${error instanceof Error ? error.message : String(error)} ${undone ? 'The library is back as it was; nothing changed.' : 'The library could not be put back: it was changed meanwhile.'}`);
          }
          return { text: `Updated the slide in ${deckName(write.path)}. Other decks that use it will offer the new version.` };
        },
      },
      {
        name: 'add_to_library',
        description:
          "Add a deck's slide to the Slide library under a topic (a deck in the `Slide library` folder; a new topic is made when none has that name). The slide in the deck becomes a copy of it. Only when the user asks for it.",
        input: {
          deck: deckPathInput('The deck holding the slide'),
          slide_id: slideIdInput,
          topic: z.string().min(1).max(120).describe("The topic's name (for example \"Working with data\"), or a topic's path from list_decks."),
        },
        run: async (args) => {
          const deck = deckPathOf(args.deck);
          const { host: current, library: project } = library();
          const copy = await project.slideOf(deck, String(args.slide_id));
          const write = await project.addToLibrary(deck, String(args.topic), copy);
          try {
            await project.setFrom(deck, String(args.slide_id), write.from, current.viewSetFrom?.(deck));
          } catch (error) {
            // The copy couldn't be linked: the library is put back, so a second try doesn't leave a second slide there.
            const undone = await project.undoWrite(write).catch(() => false);
            throw new Error(`${error instanceof Error ? error.message : String(error)} ${undone ? 'The library is back as it was; nothing changed.' : 'The library could not be put back: it was changed meanwhile.'}`);
          }
          return { text: `Added the slide to the library under ${deckName(write.path)}${write.previous === null ? ' (a new topic)' : ''}.` };
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

let deckToolHost: () => DeckToolHost | null = () => null;

/** The decks host hands its library to the tools (Sprint 157). */
export function setDeckToolHost(provider: () => DeckToolHost | null): void {
  deckToolHost = provider;
}

export const DECK_TOOL_GROUP: RitemarkToolGroup = createDeckToolGroup(() => deckToolHost());

/** This window has decks (the flag on and a project folder on disk), so agents get the deck tools. */
export function deckToolsAvailable(): boolean {
  return deckToolHost()?.library() != null;
}

/** The groups for one turn (Claude, Codex) or one OpenCode process. */
export function toolGroupsFor(options: { browser: boolean }): RitemarkToolGroup[] {
  return [
    ...(options.browser ? [BROWSER_TOOL_GROUP] : []),
    ...(boardToolsAvailable() ? [BOARD_TOOL_GROUP] : []),
    ...(deckToolsAvailable() ? [DECK_TOOL_GROUP] : []),
  ];
}

export function toolGroupById(id: string): RitemarkToolGroup | null {
  if (id === BROWSER_TOOL_GROUP.id) return BROWSER_TOOL_GROUP;
  if (id === BOARD_TOOL_GROUP.id) return BOARD_TOOL_GROUP;
  if (id === DECK_TOOL_GROUP.id) return DECK_TOOL_GROUP;
  return null;
}
