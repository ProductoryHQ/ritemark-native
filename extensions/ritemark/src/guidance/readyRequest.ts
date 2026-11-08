/**
 * Sprint 140 (R3–R6; experience 35): the ready request on Home. Its kind, its
 * words with the AI's name, the AI it names first, and whether it is due. Pure:
 * no `vscode` import, so every rule is tested.
 */

import type { AgentId } from '../agent/types';

/** A folder with files (not empty, not the sample), an empty project, or the sample. */
export type ReadyKind = 'files' | 'empty' | 'sample';

/** The `ready_request_used` event's `kind` (R15). */
export type ReadyEventKind = 'what_is_here' | 'what_for' | 'module_4';

export type AiName = 'Claude' | 'ChatGPT' | 'OpenCode';

/** The sample's own task for the AI; every copy of the sample since 2.0 holds it. */
export const SAMPLE_CARD_ID = 'm4d7r2';

/** The order the card falls back through when the sheet's AI is not ready (R4). */
export const AI_ORDER: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];

export const AI_NAMES: Record<AgentId, AiName> = { 'claude-code': 'Claude', codex: 'ChatGPT', opencode: 'OpenCode' };

/** What the folder's request sends at once, and what the empty project's puts in the box (R5). */
/** The empty project's request: the person's sentence goes where the cursor waits, after "This project is for ". */
const EMPTY_LEAD = 'This project is for ';

export const READY_REQUEST_TEXT = {
  // Experience 35, frame 2 redrawn (26 October): the two offers are in the answer's words, so the request asks for them.
  // Jarmo, 6 November: the request leads with what the AI can do; what is here is now the paragraph it asks for.
  files: 'What can you do here? Look at the names first, read only the five newest documents, say in a paragraph what is here, and end with two things you could do next.',
  // Experience 35, frame 3 redrawn (26 October): the card's promise is in what is sent, on a second line the person sees
  // and can change; the person's sentence goes where the cursor waits.
  empty: `${EMPTY_LEAD}\nThen write About this project from it, and a first outline as a document.`,
} as const;

/**
 * #497's spike, per AI: whether a first look reads the newest Word files and PDFs (`research/word-spike.md`). Only
 * ChatGPT has run, and it passed both; an AI not yet run is not promised more than the names (the Experience lead,
 * 26 October). Changes when the spike's open runs are made.
 */
export const FIRST_LOOK_READS_DOCUMENTS: Record<AiName, boolean> = { ChatGPT: true, Claude: false, OpenCode: false };

/** Where the cursor waits in the empty project's request: after "This project is for ". */
export const READY_REQUEST_CURSOR_EMPTY = EMPTY_LEAD.length;

export const EVENT_KIND: Record<ReadyKind, ReadyEventKind> = { files: 'what_is_here', empty: 'what_for', sample: 'module_4' };

export type ReadyIcon = 'folder-simple' | 'pencil-simple-line' | 'check-square';

export interface ReadyRequestWords {
  icon: ReadyIcon;
  heading: string;
  body: string;
  button: string;
  note: string;
  /** The ×'s name and tooltip. */
  hide: string;
  /** The sample's hand-over, while the board starts it: the button's words (with a spinner) and the note. */
  busy: { button: string; note: string } | null;
}

export function readyKindOf(project: { empty: boolean; sample: boolean }): ReadyKind {
  if (project.sample) return 'sample';
  return project.empty ? 'empty' : 'files';
}

/**
 * Sprint 156 (experience 35, "With no AI ready"): which plans work, in the welcome's own words. The webview's
 * `welcomeCopy.ts` holds the welcome's copy (`PLAN_LINES`); this is the host's, for Home's card, and a test keeps the
 * two equal.
 */
export const PLAN_LINES: Record<'chatgpt' | 'claude' | 'opencode', string> = {
  chatgpt: 'Any plan works, free included.',
  claude: 'Needs a paid plan, such as Pro or Max.',
  opencode: 'Open models, with an API key of your own.',
};

const PLAN_KEY: Record<AiName, keyof typeof PLAN_LINES> = { ChatGPT: 'chatgpt', Claude: 'claude', OpenCode: 'opencode' };

/** Sprint 156: the main part with no AI ready, in the AI's sheet's own words ("Sign in with Claude", not Claude.ai). */
export function signInWords(ai: AiName): string {
  return ai === 'OpenCode' ? 'Set up OpenCode' : `Sign in with ${ai}`;
}

/**
 * The card's words (experience 35, frames 1, 3 and 4), the AI's name following Ask with. Sprint 156: with no AI ready
 * (`ready` false) only the button and the note change: the button signs in to that AI, and the note says which plans
 * work. The heading and the body stay, and the body already names the AI.
 */
export function readyRequestWords(kind: ReadyKind, ai: AiName, projectName: string, counts: string | null, ready = true): ReadyRequestWords {
  const words = requestWords(kind, ai, projectName, counts);
  return ready ? words : { ...words, button: signInWords(ai), note: PLAN_LINES[PLAN_KEY[ai]] };
}

function requestWords(kind: ReadyKind, ai: AiName, projectName: string, counts: string | null): ReadyRequestWords {
  const hide = `Hide this in ${projectName}`;
  switch (kind) {
    case 'files':
      return {
        icon: 'folder-simple',
        heading: 'Nothing in this folder was moved or changed',
        body: counts ? `${ai} works only inside it. ${counts}` : `${ai} works only inside it.`,
        // Jarmo, 6 November: the person knows what is in their own folder; the value is what the AI can do with it
        button: `Ask ${ai} what it can do here`,
        // The note is true for the AI chosen: the names, and the five newest only where the spike says it reads them
        note: FIRST_LOOK_READS_DOCUMENTS[ai] ? 'Reads the names, then the five newest documents.' : 'Reads the names first.',
        hide,
        busy: null,
      };
    case 'empty':
      return {
        icon: 'pencil-simple-line',
        heading: 'Start with what this project is for',
        body: `A sentence is enough. ${ai} writes About this project from it, and a first outline as a document.`,
        button: `Tell ${ai} what this project is for`,
        note: 'Nothing goes until you press Send.',
        hide,
        busy: null,
      };
    case 'sample':
      return {
        icon: 'check-square',
        heading: `${ai} can draft Module 4`,
        body: `It reads the brief and the interviews with shift leaders, then writes Module 4 like Modules 1 to 3. It's the task on the board for ${ai}.`,
        button: `Ask ${ai} to draft Module 4`,
        note: 'Reads two documents, writes a new one.',
        hide,
        busy: { button: `Giving it to ${ai}…`, note: 'It shows in Doing in a moment.' },
      };
  }
}

/** Why the card went, for good, in one project. A refused or failed request is not one of them (R6). */
export type ReadyGone = 'answered' | 'chat' | 'hidden';

/** What this computer keeps about one project's ready request (never in the project's folder, E2). */
export interface ReadyRecord {
  gone?: ReadyGone;
  /** The chat the card's request went to; a new press replaces it. */
  chatId?: string;
  /** The AI chosen on the card. */
  ai?: AgentId;
}

export interface ReadyDueInput {
  /** How the project joined Ritemark's list; only a project met first gets the card (R6). */
  foundBy: 'opened' | 'recent' | 'chats' | null;
  record: ReadyRecord | undefined;
  /** The project's chats that are neither the card's request nor a task's hand-off. */
  ownChats: number;
}

/**
 * Due on the Home of a project Ritemark met for the first time (opened, or the
 * sample, which the welcome opens), until it has gone. A chat of the person's
 * own ends it, so a project that already had a chat never shows it.
 */
export function readyRequestDue(input: ReadyDueInput): boolean {
  if (input.foundBy !== 'opened') return false;
  if (input.record?.gone) return false;
  return input.ownChats === 0;
}

/**
 * What a redraw learned that ends the card for good: the request was answered,
 * or a chat of the person's own exists. Undefined when nothing changed.
 */
/** `sampleLeftToDo`: the sample's card `m4d7r2` is no longer in To do (handed over, so it shows in Doing). */
export function readyGoneNow(input: { kind: ReadyKind; ownChats: number; requestAnswered: boolean; sampleLeftToDo: boolean }): ReadyGone | undefined {
  if (input.kind === 'sample' ? input.sampleLeftToDo : input.requestAnswered) return 'answered';
  if (input.ownChats > 0) return 'chat';
  return undefined;
}

export type AiState = 'ready' | 'sign-in' | 'set-up' | 'checking' | 'signing-in';

/**
 * Sprint 156: whether Ritemark can sign in to an AI here. Claude and ChatGPT, while each is turned on and can start
 * (any state but Set up); ChatGPT not when its runtime is the computer's own (`ritemark.agentRuntime.preference`
 * `system`), whose sign-in is that install's. OpenCode is set up with a key, never signed in to.
 */
export function canSignInHere(states: Partial<Record<AgentId, AiState>>, runtimePreference: 'bundled' | 'system'): Partial<Record<AgentId, boolean>> {
  const can = (id: AgentId) => states[id] !== undefined && states[id] !== 'set-up';
  return { 'claude-code': can('claude-code'), codex: can('codex') && runtimePreference !== 'system', opencode: false };
}

/**
 * Sprint 156 (experience 35, "With no AI ready"): the AI the card signs in to when none is ready. ChatGPT, because any
 * plan works. The AI last seen ready instead, when its sign-in has lapsed (no AI ready, and it waits for a sign-in);
 * in practice only Claude, since OpenCode is set up, not signed in to. Claude when ChatGPT can't sign in here; Set up
 * OpenCode when neither can.
 */
export function leadAi(input: {
  /** The AI last seen ready on this profile (`ritemark.guidance.lastReadyAi`). */
  lastReady: AgentId | undefined;
  states: Partial<Record<AgentId, AiState>>;
  canSignIn: Partial<Record<AgentId, boolean>>;
}): AgentId {
  const { lastReady, states, canSignIn } = input;
  const noneReady = AI_ORDER.every((id) => states[id] !== 'ready');
  if (noneReady && lastReady && canSignIn[lastReady] && (states[lastReady] === 'sign-in' || states[lastReady] === 'signing-in')) return lastReady;
  if (canSignIn.codex) return 'codex';
  if (canSignIn['claude-code']) return 'claude-code';
  return 'opencode';
}

/**
 * The AI the card names (R4): the one chosen on the card when it is ready; else
 * the sheet's AI for new chats when it is ready; else the first ready AI in the
 * order Claude, ChatGPT, OpenCode. With none ready, the AI the card signs in to
 * (`leadAi`, Sprint 156).
 */
export function cardAi(input: {
  chosen: AgentId | undefined;
  sheetAi: AgentId | undefined;
  states: Partial<Record<AgentId, AiState>>;
  lastReady: AgentId | undefined;
  canSignIn: Partial<Record<AgentId, boolean>>;
}): { ai: AgentId; ready: boolean } {
  const ready = (id: AgentId | undefined): id is AgentId => Boolean(id && input.states[id] === 'ready');
  if (ready(input.chosen)) return { ai: input.chosen, ready: true };
  if (ready(input.sheetAi)) return { ai: input.sheetAi, ready: true };
  const first = AI_ORDER.find((id) => ready(id));
  if (first) return { ai: first, ready: true };
  return { ai: leadAi(input), ready: false };
}

/** Sprint 142 (R5b): a press this soon after the folder's request was sent waits for its chat rather than send again. */
export const FILES_PRESS_SETTLE_MS = 10_000;

/**
 * Sprint 142 (R5b; experience 35, "one button, in one tone"; Q1): what a press of the ready request does, so the
 * button never has to be disabled for the folder or the empty project. The sample's hand-over is the board's.
 * - folder: open the chat its request went to while it is unanswered; otherwise send it in a new chat. A press within
 *   10 s of the first, before the AI took the request, is never a silent no-op and never a disabled button (QA N5):
 *   it brings the AI's sheet forward on the chat the first press sent, by the sheet's own id when the sheet has said it;
 * - empty project: open the chat it filled before, the request put back only into an empty box; otherwise a new one.
 */
export function readyPressAction(input: {
  kind: ReadyKind;
  /** The folder's request: its chat once the AI took it, and whether that chat has an answer. */
  sentChat: { id: string; answered: boolean } | null;
  /** The folder's request was pressed this long ago and its chat isn't known yet. */
  sinceLastPressMs: number | null;
  /** The sheet's own id of the folder's request's chat, from the first press, before the AI took it. */
  pendingChat: string | null;
  /** The sheet's own id of the empty project's chat, from the first press. */
  filledChat: string | null;
}): { action: 'give' } | { action: 'open'; conversationId: string } | { action: 'reveal'; conversationId: string | null } | { action: 'send' } | { action: 'fill'; conversationId: string | null } {
  if (input.kind === 'sample') return { action: 'give' };
  if (input.kind === 'files') {
    if (input.sentChat && !input.sentChat.answered) return { action: 'open', conversationId: input.sentChat.id };
    if (!input.sentChat && input.sinceLastPressMs !== null && input.sinceLastPressMs < FILES_PRESS_SETTLE_MS) return { action: 'reveal', conversationId: input.pendingChat };
    return { action: 'send' };
  }
  return { action: 'fill', conversationId: input.filledChat };
}
