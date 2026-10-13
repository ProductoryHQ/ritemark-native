/**
 * Task-board protocol — the typed boundary between the board webviews (the
 * Tasks side bar, the Task board tab and a card's page in the editor) and the
 * extension host (Sprint 130, #119).
 *
 * `decodeBoardRequest` is the only place webview JSON becomes a board request.
 * Every field is checked and unknown fields are refused, so a webview bug shows
 * up as a named rejection instead of a half-applied change. The shapes follow
 * `../commentTasks/protocol.ts`.
 *
 * Contract: docs/development/releases/v1.14.0/sprint-130-task-board/
 *   technical-plan.md (W2) and design.md
 */

import type { AgentId } from '../agent/types';
import type { RuntimeAvailabilityRecovery, RuntimeAvailabilityState } from '../runtime/availability';
import { CARD_STAGES, type CardAsk, type CardHistoryEntry, type CardResult, type CardReview, type CardStage } from './cardTypes';

export type { CardStage } from './cardTypes';

export const BOARD_AGENTS: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];

/** Largest inbound message the host will parse. A description is text; anything
 *  near this is a bug. */
export const MAX_BOARD_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 256 * 1024;

// ── Handoffs (machine-local, from the handoff ledger) ───────────────────────

/** Where a card's agent work stands on this computer. `waiting` is a card that
 *  will start by itself (after another card, when Doing has room, or when the
 *  AI sidebar has room); `conversation-gone` is a card whose conversation was
 *  deleted. */
export type HandoffState =
  | 'waiting'
  | 'accepting'
  | 'queued'
  | 'running'
  | 'needs-user'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'conversation-gone';

export const ACTIVE_HANDOFF_STATES: ReadonlySet<HandoffState> = new Set(['accepting', 'queued', 'running', 'needs-user']);
export const TERMINAL_HANDOFF_STATES: ReadonlySet<HandoffState> = new Set([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
  'conversation-gone',
]);

export type NeedsKind = 'approval' | 'question' | 'plan';

export type WaitReason =
  | { kind: 'conflict'; cardId: string }
  | { kind: 'slot' }
  | { kind: 'capacity' };

export interface CardHandoffView {
  state: HandoffState;
  runtimeId: AgentId;
  /** When the handoff entered `state`. */
  since: string;
  needs?: NeedsKind;
  waitFor?: WaitReason;
  /** A safe one-line reason for `failed`; never a raw provider error. */
  failure?: string;
  /** The card's conversation exists on this computer. */
  canOpen: boolean;
  conversationTitle?: string;
}

// ── Snapshot (host → webview) ───────────────────────────────────────────────

export type CallKind = 'needs-you' | 'decision' | 'review' | 'failed';
export type WhoMoves = 'you' | 'agent' | null;

export interface BoardCardView {
  id: string;
  title: string;
  doneWhen: string | null;
  stage: CardStage;
  rank: string;
  description: string;
  files: Array<{ path: string; exists: boolean }>;
  created: string | null;
  updated: string | null;
  result: CardResult | null;
  ask: CardAsk | null;
  review: CardReview | null;
  /** An agent is reviewing this idea now (machine-local, under a minute). */
  reviewing: { runtimeId: AgentId; since: string } | null;
  /** Why the last review did not come back; cleared when the next one starts. */
  reviewFailure: string | null;
  dropped: boolean;
  /** When it was archived ('' when unknown); null for a card on the board. */
  archived: string | null;
  history: CardHistoryEntry[];
  /** A copied card file shown under a fresh id until its next write. */
  copiedFrom: string | null;
  handoff: CardHandoffView | null;
  /** Derived, never stored. */
  move: WhoMoves;
  call: CallKind | null;
  /** The top To do card without active or waiting agent work. */
  nextUp: boolean;
  /** An agent is working on it: no Move to…, no Mark done, no Delete. */
  locked: boolean;
  /** `- [ ]` / `- [x]` lines in the description. */
  checkboxes: { done: number; total: number };
}

export interface BoardCall {
  cardId: string;
  kind: CallKind;
  /** When the card started waiting on the user. */
  since: string;
}

export interface BoardRuntimeView {
  id: AgentId;
  label: string;
  usable: boolean;
  state: RuntimeAvailabilityState;
  /** Why it cannot be used, in one sentence; null when usable. */
  message: string | null;
  recovery: RuntimeAvailabilityRecovery;
}

export interface BoardSnapshot {
  /** The project folder's name; null without a folder. */
  folder: string | null;
  enabled: boolean;
  /** The cards on the board; archived ones are in `archived`. */
  cards: BoardCardView[];
  /** Archived cards, the most recently archived first (D15): listed at the
   *  bottom of the Tasks side bar, off the board. */
  archived: BoardCardView[];
  unreadable: Array<{ fileName: string; message: string }>;
  calls: BoardCall[];
  attention: { count: number; oldestSince: string | null; blocked: number };
  doing: { count: number; limit: number | null };
  runtimes: BoardRuntimeView[];
  /** The agent the board's buttons name; the user's last choice. */
  defaultRuntime: AgentId;
}

export const WIP_LIMIT_DEFAULT = 3;
export const WIP_LIMIT_MAX = 6;

// ── Answers ─────────────────────────────────────────────────────────────────

export type BoardErrorCode =
  | 'invalid-request'
  | 'payload-too-large'
  | 'no-folder'
  | 'disabled'
  | 'not-found'
  | 'unreadable'
  | 'invalid'
  | 'busy'
  | 'not-allowed'
  | 'runtime-unavailable'
  | 'no-conversation'
  | 'sidebar-unreachable'
  | 'write-failed';

export type BoardAnswer =
  | { ok: true; cardId?: string; waiting?: WaitReason; count?: number }
  | { ok: false; code: BoardErrorCode; message: string; recovery?: RuntimeAvailabilityRecovery }
  /** Give to would start a second agent on a file another card's agent is changing. */
  | { ok: false; code: 'conflict'; message: string; withCardId: string; withTitle: string; file: string }
  /** Give to on a card outside Doing while Doing is at its limit. */
  | { ok: false; code: 'doing-full'; message: string; count: number; limit: number };

export type BoardHostMessage =
  | { type: 'board/state'; snapshot: BoardSnapshot }
  | { type: 'board/result'; requestId: string; answer: BoardAnswer }
  /** The board tab should show this view (opened from the side bar). */
  | { type: 'board/focus'; tab?: BoardTab }
  /** The card whose page is the active editor tab, for the side bar's highlight; null when none. */
  | { type: 'board/active-page'; cardId: string | null };

// ── Requests (webview → host) ───────────────────────────────────────────────

/** `page` is a card open as a page in the Ritemark editor (design.md §5). */
export type BoardSurface = 'sidebar' | 'panel' | 'page';

/** The Task board tab's views. */
export type BoardTab = 'calls' | 'board' | 'ideas' | 'log';
export const BOARD_TABS: readonly BoardTab[] = ['calls', 'board', 'ideas', 'log'];

export type BoardRequest =
  | { type: 'board/ready'; surface: BoardSurface }
  | { type: 'board/add'; requestId: string; title: string; stage: CardStage }
  | {
      type: 'board/update';
      requestId: string;
      cardId: string;
      title?: string;
      doneWhen?: string;
      description?: string;
      files?: string[];
    }
  | { type: 'board/move'; requestId: string; cardId: string; stage: CardStage; beforeCardId?: string; atEnd?: boolean }
  | { type: 'board/mark-done'; requestId: string; cardId: string }
  | { type: 'board/delete'; requestId: string; cardId: string }
  | { type: 'board/drop'; requestId: string; cardId: string }
  | { type: 'board/archive'; requestId: string; cardId: string }
  | { type: 'board/restore'; requestId: string; cardId: string }
  /** Archive every card in Done. */
  | { type: 'board/archive-done'; requestId: string }
  | { type: 'board/bring-back'; requestId: string; cardId: string }
  | { type: 'board/give'; requestId: string; cardId: string; runtimeId: AgentId; force?: boolean; overLimit?: boolean }
  | { type: 'board/queue'; requestId: string; cardId: string; runtimeId: AgentId }
  | { type: 'board/wait'; requestId: string; cardId: string; runtimeId: AgentId }
  | { type: 'board/unwait'; requestId: string; cardId: string }
  | { type: 'board/follow-up'; requestId: string; cardId: string; text: string; runtimeId?: AgentId }
  | { type: 'board/answer'; requestId: string; cardId: string; optionIndex: number }
  | { type: 'board/retry'; requestId: string; cardId: string; runtimeId?: AgentId }
  | { type: 'board/stop'; requestId: string; cardId: string }
  | { type: 'board/open-conversation'; requestId: string; cardId: string }
  | { type: 'board/review-idea'; requestId: string; cardId: string; runtimeId: AgentId }
  | { type: 'board/accept-review'; requestId: string; cardId: string }
  | { type: 'board/set-wip'; requestId: string; limit: number | null }
  | { type: 'board/open'; tab?: BoardTab }
  | { type: 'board/add-files'; cardId: string }
  | { type: 'board/open-file'; path: string }
  /** Open a card's page; `fileName` names a card file that won't read, which opens as a plain document. */
  /** `focus`: opened from the keyboard, so the page takes the focus (W16). */
  | { type: 'board/open-card'; cardId?: string; fileName?: string; focus?: boolean }
  | { type: 'board/recover'; action: BoardRecoverAction };

export type BoardRecoverAction = 'sign-in-claude' | 'sign-in-codex' | 'settings' | 'open-folder';

export type BoardRequestType = BoardRequest['type'];

export class BoardProtocolError extends Error {
  constructor(
    readonly code: 'invalid-request' | 'payload-too-large',
    message: string,
  ) {
    super(message);
    this.name = 'BoardProtocolError';
  }
}

function invalid(message: string): never {
  throw new BoardProtocolError('invalid-request', message);
}

/** Field rules per request type: the decoder refuses any other field. */
type FieldRule = 'requestId' | 'cardId' | 'stage' | 'runtime' | 'text' | 'shortText' | 'bool' | 'files' | 'index' | 'limit' | 'path' | 'fileName' | 'surface' | 'recover' | 'tab';

const FIELDS: Record<BoardRequestType, { required: Record<string, FieldRule>; optional?: Record<string, FieldRule> }> = {
  'board/ready': { required: { surface: 'surface' } },
  'board/add': { required: { requestId: 'requestId', title: 'shortText', stage: 'stage' } },
  'board/update': {
    required: { requestId: 'requestId', cardId: 'cardId' },
    optional: { title: 'shortText', doneWhen: 'shortText', description: 'text', files: 'files' },
  },
  'board/move': {
    required: { requestId: 'requestId', cardId: 'cardId', stage: 'stage' },
    optional: { beforeCardId: 'cardId', atEnd: 'bool' },
  },
  'board/mark-done': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/delete': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/drop': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/archive': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/restore': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/archive-done': { required: { requestId: 'requestId' } },
  'board/bring-back': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/give': {
    required: { requestId: 'requestId', cardId: 'cardId', runtimeId: 'runtime' },
    optional: { force: 'bool', overLimit: 'bool' },
  },
  'board/queue': { required: { requestId: 'requestId', cardId: 'cardId', runtimeId: 'runtime' } },
  'board/wait': { required: { requestId: 'requestId', cardId: 'cardId', runtimeId: 'runtime' } },
  'board/unwait': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/follow-up': {
    required: { requestId: 'requestId', cardId: 'cardId', text: 'text' },
    optional: { runtimeId: 'runtime' },
  },
  'board/answer': { required: { requestId: 'requestId', cardId: 'cardId', optionIndex: 'index' } },
  'board/retry': { required: { requestId: 'requestId', cardId: 'cardId' }, optional: { runtimeId: 'runtime' } },
  'board/stop': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/open-conversation': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/review-idea': { required: { requestId: 'requestId', cardId: 'cardId', runtimeId: 'runtime' } },
  'board/accept-review': { required: { requestId: 'requestId', cardId: 'cardId' } },
  'board/set-wip': { required: { requestId: 'requestId', limit: 'limit' } },
  'board/open': { required: {}, optional: { tab: 'tab' } },
  'board/add-files': { required: { cardId: 'cardId' } },
  'board/open-file': { required: { path: 'path' } },
  'board/open-card': { required: {}, optional: { cardId: 'cardId', fileName: 'fileName', focus: 'bool' } },
  'board/recover': { required: { action: 'recover' } },
};

const CARD_ID = /^[a-z0-9]{6}$/;

function decodeField(key: string, rule: FieldRule, value: unknown): unknown {
  switch (rule) {
    case 'requestId':
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) invalid(`${key} must be 1–128 characters`);
      return value;
    case 'cardId':
      if (typeof value !== 'string' || !CARD_ID.test(value)) invalid(`${key} must be a card id`);
      return value;
    case 'stage':
      if (!(CARD_STAGES as readonly unknown[]).includes(value)) invalid(`${key} must be one of ${CARD_STAGES.join(', ')}`);
      return value;
    case 'runtime':
      if (!(BOARD_AGENTS as readonly unknown[]).includes(value)) invalid(`${key} must be one of ${BOARD_AGENTS.join(', ')}`);
      return value;
    case 'shortText':
      if (typeof value !== 'string' || value.length > 4096) invalid(`${key} must be text of at most 4096 characters`);
      return value;
    case 'text':
      if (typeof value !== 'string') invalid(`${key} must be text`);
      if (value.length > MAX_TEXT) throw new BoardProtocolError('payload-too-large', `${key} is too long`);
      return value;
    case 'bool':
      if (typeof value !== 'boolean') invalid(`${key} must be true or false`);
      return value;
    case 'files':
      if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string' || item.length > 1024)) {
        invalid(`${key} must be a list of paths`);
      }
      return [...value];
    case 'index':
      if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 9) invalid(`${key} must be an option number`);
      return value;
    case 'limit':
      if (value !== null && (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > WIP_LIMIT_MAX)) {
        invalid(`${key} must be 1–${WIP_LIMIT_MAX} or null`);
      }
      return value;
    case 'path':
      if (typeof value !== 'string' || value.length === 0 || value.length > 1024) invalid(`${key} must be a path`);
      return value;
    case 'fileName':
      if (typeof value !== 'string' || !/^[^/\\]{1,255}\.md$/.test(value) || value.startsWith('.')) invalid(`${key} must be a card file name`);
      return value;
    case 'tab':
      if (!(BOARD_TABS as readonly unknown[]).includes(value)) invalid(`${key} must be one of ${BOARD_TABS.join(', ')}`);
      return value;
    case 'surface':
      if (value !== 'sidebar' && value !== 'panel' && value !== 'page') invalid(`${key} must be sidebar, panel or page`);
      return value;
    case 'recover':
      if (value !== 'sign-in-claude' && value !== 'sign-in-codex' && value !== 'settings' && value !== 'open-folder') {
        invalid(`${key} must be a known recovery`);
      }
      return value;
  }
}

export function isBoardRequest(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    Object.prototype.hasOwnProperty.call(FIELDS, (value as { type: string }).type)
  );
}

/**
 * Validate one inbound message. Throws `BoardProtocolError`; the caller never
 * sees a partially decoded request.
 */
export function decodeBoardRequest(value: unknown): BoardRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('message must be an object');
  const input = value as Record<string, unknown>;
  const type = input.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(FIELDS, type)) invalid('type must be a known board request');
  const rules = FIELDS[type as BoardRequestType];
  const out: Record<string, unknown> = { type };
  for (const [key, rule] of Object.entries(rules.required)) {
    if (!(key in input)) invalid(`${key} is required`);
    out[key] = decodeField(key, rule, input[key]);
  }
  for (const [key, rule] of Object.entries(rules.optional ?? {})) {
    if (input[key] !== undefined) out[key] = decodeField(key, rule, input[key]);
  }
  for (const key of Object.keys(input)) {
    if (key !== 'type' && !(key in rules.required) && !(key in (rules.optional ?? {}))) invalid(`${key} is not part of ${type}`);
  }
  if (type === 'board/open-card' && (out.cardId === undefined) === (out.fileName === undefined)) {
    invalid('board/open-card needs exactly one of cardId or fileName');
  }
  return out as BoardRequest;
}
