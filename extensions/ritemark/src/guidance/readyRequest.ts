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
export const READY_REQUEST_TEXT = {
  files: 'What is here? Look at the names first, and read only the five newest documents.',
  empty: 'This project is for ',
} as const;

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
}

export function readyKindOf(project: { empty: boolean; sample: boolean }): ReadyKind {
  if (project.sample) return 'sample';
  return project.empty ? 'empty' : 'files';
}

/** The card's words (experience 35, frames 1, 3 and 4), the AI's name following Ask with. */
export function readyRequestWords(kind: ReadyKind, ai: AiName, projectName: string, counts: string | null): ReadyRequestWords {
  const hide = `Hide this in ${projectName}`;
  switch (kind) {
    case 'files':
      return {
        icon: 'folder-simple',
        heading: 'Nothing in this folder was moved or changed',
        body: counts ? `${ai} works only inside it. ${counts}` : `${ai} works only inside it.`,
        button: `Ask ${ai} what is here`,
        note: 'Reads the names, then the five newest documents.',
        hide,
      };
    case 'empty':
      return {
        icon: 'pencil-simple-line',
        heading: 'Start with what this project is for',
        body: `A sentence is enough. ${ai} writes About this project from it, and a first outline as a document.`,
        button: `Tell ${ai} what this project is for`,
        note: 'Nothing goes until you press Send.',
        hide,
      };
    case 'sample':
      return {
        icon: 'check-square',
        heading: `${ai} can draft Module 4`,
        body: `It reads the brief and the interviews with shift leaders, then writes Module 4 like Modules 1 to 3. It's the task on the board for ${ai}.`,
        button: `Ask ${ai} to draft Module 4`,
        note: 'Reads two documents, writes a new one.',
        hide,
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
export function readyGoneNow(input: { kind: ReadyKind; ownChats: number; requestAnswered: boolean; sampleCompleted: boolean }): ReadyGone | undefined {
  if (input.kind === 'sample' ? input.sampleCompleted : input.requestAnswered) return 'answered';
  if (input.ownChats > 0) return 'chat';
  return undefined;
}

export type AiState = 'ready' | 'sign-in' | 'set-up' | 'checking' | 'signing-in';

/**
 * The AI the card names (R4): the one chosen on the card when it is ready; else
 * the sheet's AI for new chats when it is ready; else the first ready AI in the
 * order Claude, ChatGPT, OpenCode; with none ready, the sheet's AI, else Claude.
 */
export function cardAi(input: { chosen: AgentId | undefined; sheetAi: AgentId | undefined; states: Partial<Record<AgentId, AiState>> }): { ai: AgentId; ready: boolean } {
  const ready = (id: AgentId | undefined): id is AgentId => Boolean(id && input.states[id] === 'ready');
  if (ready(input.chosen)) return { ai: input.chosen, ready: true };
  if (ready(input.sheetAi)) return { ai: input.sheetAi, ready: true };
  const first = AI_ORDER.find((id) => ready(id));
  if (first) return { ai: first, ready: true };
  return { ai: 'claude-code', ready: false };
}
