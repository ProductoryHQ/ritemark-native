/**
 * Comment-task records — Sprint 117 (#292, absorbs #156 and #281).
 *
 * One accepted assignment of one or more document comments to one runtime is a
 * TASK. The extension host owns task identity and lifecycle; the editor webview
 * and the AI sidebar render projections of it. Before Sprint 117 that state
 * lived in a module-global map inside the editor webview keyed only by comment
 * id, so it crossed documents, died on reload, and was finalized in bulk by any
 * terminal turn of the destination conversation (audit F13–F16, F22).
 *
 * The codecs below are the boundary: nothing enters the store without passing
 * `decodeCommentTaskRecordV1`, and the same `fail()` discipline as
 * `../conversations/types.ts` keeps a corrupt record diagnosable instead of
 * half-loaded. The record deliberately holds NO conversation transcript, tool
 * payload, approval capability, or attachment — the conversation store owns
 * those, and duplicating them is how two sources of truth start.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D2, D4, D7)
 */

import type { AgentId } from '../agent/types';
import type { ThinkingEffort } from '../runtime/thinkingEffort';
import type { RuntimeFailureKind } from '../runtime/runtimeErrorPresentation';
import type { ProjectScopeDescriptorV1 } from '../conversations/types';
import { decodeProjectScopeDescriptorV1 } from '../conversations/types';

export const COMMENT_TASK_SCHEMA_VERSION = 1;

/** Agent aliases a comment may be assigned to — mirrors the webview's
 *  `COMMENT_AGENT_ALIASES` in `webview/src/extensions/comment/commentModel.ts`.
 *  Duplicated because the host bundle must not import webview modules;
 *  `types.test.ts` reads that file and fails if the two lists drift apart. */
export const COMMENT_TASK_ALIASES = ['claude', 'codex', 'opencode'] as const;
export type CommentTaskAlias = (typeof COMMENT_TASK_ALIASES)[number];

export const ALIAS_TO_RUNTIME_ID: Record<CommentTaskAlias, AgentId> = {
  claude: 'claude-code',
  codex: 'codex',
  opencode: 'opencode',
};

/** Where the user acted. Both surfaces produce identical task records (R2);
 *  this is recorded for diagnostics only and never changes behaviour. */
export type CommentTaskSurface = 'rail' | 'menu';

export type CommentTaskCommentKind = 'mark' | 'node';

export type CommentTaskInterruptReason =
  | 'restart'
  | 'sidebar-unreachable'
  | 'conversation-deleted'
  | 'runtime-exited';

export type CommentTaskAttentionKind = 'approval' | 'question' | 'plan-review';

// ── Bounds ───────────────────────────────────────────────────────────────────
// Payload limits are enforced here AND at the protocol boundary. A comment body
// is a human note, not a document: 4 KiB is generous. The anchored text can be a
// multi-block passage, so it gets more room. The prompt is bounded because it is
// persisted for retry and audit.
export const MAX_COMMENTS_PER_TASK = 50;
export const MAX_NOTE_CHARS = 4_096;
export const MAX_INSTRUCTION_CHARS = 4_096;
export const MAX_ANCHORED_TEXT_CHARS = 8_192;
export const MAX_PROMPT_CHARS = 65_536;
export const MAX_SUMMARY_CHARS = 280;
export const MAX_SAFE_MESSAGE_CHARS = 1_024;
export const MAX_HISTORY_ENTRIES = 32;

export interface CommentTaskSourceV1 {
  /** Canonical `vscode.Uri.toString()`. Identity — never a display path. */
  documentUri: string;
  /** `projectScopeId()` of the document's workspace. Guards against the same
   *  relative path in two windows or two projects (audit F10). */
  scopeId: string;
  scope: ProjectScopeDescriptorV1;
  /** `workspace.asRelativePath(uri, false)` — label and prompt text only. */
  displayPath: string;
  /** `TextDocument.version` at acceptance. */
  documentVersion: number;
  /** SHA-256 of the document text at acceptance; retry evidence. */
  contentSha256: string;
}

export interface CommentTaskCommentV1 {
  commentId: string;
  kind: CommentTaskCommentKind;
  /** Verbatim comment body — the assignment source of truth. */
  note: string;
  /** `note` with the assignment mention removed. */
  instruction: string;
  /** Marks only: the anchored passage across every fragment. */
  anchoredText?: string;
}

export interface CommentTaskAssignmentV1 {
  alias: CommentTaskAlias;
  runtimeId: AgentId;
  surface: CommentTaskSurface;
}

export interface CommentTaskRuntimeV1 {
  modelId: string | null;
  approvalMode: 'auto' | 'ask';
  planFirst: boolean;
  thinkingEffort: ThinkingEffort;
}

export interface CommentTaskDestinationV1 {
  /** The conversation open in the AI sidebar at acceptance (D5). Frozen: later
   *  switching the visible conversation cannot retarget the task. */
  conversationId: string;
  bindingGeneration: number;
  /** Title as it read at acceptance, so the comment can name the destination
   *  without querying the conversation store on every projection. */
  titleSnapshot: string;
  /** True when this task started that conversation. */
  created: boolean;
}

export type CommentTaskLifecycleV1 =
  | { state: 'accepting'; since: string }
  | { state: 'queued'; since: string }
  | { state: 'running'; since: string }
  | { state: 'needs-user'; since: string; attentionKind: CommentTaskAttentionKind }
  | { state: 'completed'; since: string; terminalEventId: string; summary: string }
  | { state: 'failed'; since: string; safeMessage: string; failureKind?: RuntimeFailureKind }
  | { state: 'cancelled'; since: string }
  | { state: 'interrupted'; since: string; reason: CommentTaskInterruptReason };

export type CommentTaskState = CommentTaskLifecycleV1['state'];

export const COMMENT_TASK_STATES: readonly CommentTaskState[] = [
  'accepting',
  'queued',
  'running',
  'needs-user',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
];

export const TERMINAL_COMMENT_TASK_STATES: ReadonlySet<CommentTaskState> = new Set([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);

export function isTerminalCommentTaskState(state: CommentTaskState): boolean {
  return TERMINAL_COMMENT_TASK_STATES.has(state);
}

/**
 * Allowed transitions within one binding generation (D2). Leaving a terminal
 * state happens only through `retry`, which bumps the generation — that is why
 * no terminal state lists a successor here.
 */
export const COMMENT_TASK_TRANSITIONS: Readonly<Record<CommentTaskState, readonly CommentTaskState[]>> = {
  accepting: ['queued', 'failed', 'interrupted'],
  queued: ['running', 'cancelled', 'failed', 'interrupted'],
  running: ['needs-user', 'completed', 'failed', 'cancelled', 'interrupted'],
  'needs-user': ['running', 'completed', 'failed', 'cancelled', 'interrupted'],
  completed: [],
  failed: [],
  cancelled: [],
  interrupted: [],
};

export function canTransition(from: CommentTaskState, to: CommentTaskState): boolean {
  return COMMENT_TASK_TRANSITIONS[from].includes(to);
}

export interface CommentTaskHistoryEntryV1 {
  state: CommentTaskState;
  at: string;
  generation: number;
  note?: string;
}

export interface CommentTaskRecordV1 {
  schemaVersion: 1;
  taskId: string;
  /** 1 on first acceptance, +1 per retry. Every inbound event carries the
   *  generation it belongs to; a late callback from a previous attempt is
   *  historical and cannot move the current binding (R6). */
  bindingGeneration: number;
  /** Webview-minted, unique per (surface, agent group). Idempotency key: a
   *  double click or a retried response resolves to the same task. */
  requestId: string;
  createdAt: string;
  updatedAt: string;
  source: CommentTaskSourceV1;
  comments: CommentTaskCommentV1[];
  assignment: CommentTaskAssignmentV1;
  runtime: CommentTaskRuntimeV1;
  destination: CommentTaskDestinationV1;
  turn: { conversationTurnId: string };
  prompt: { text: string; sha256: string };
  lifecycle: CommentTaskLifecycleV1;
  history: CommentTaskHistoryEntryV1[];
}

/** What an editor webview may see. No prompt text, no content hash, no history:
 *  a comment bubble needs the state, the destination and one line of result. */
export interface CommentTaskProjectionV1 {
  taskId: string;
  commentIds: string[];
  runtimeId: AgentId;
  alias: CommentTaskAlias;
  state: CommentTaskState;
  since: string;
  attentionKind?: CommentTaskAttentionKind;
  summary?: string;
  safeMessage?: string;
  interruptReason?: CommentTaskInterruptReason;
  destination: { conversationId: string; title: string };
}

export function projectCommentTask(record: CommentTaskRecordV1): CommentTaskProjectionV1 {
  const { lifecycle } = record;
  return {
    taskId: record.taskId,
    commentIds: record.comments.map((comment) => comment.commentId),
    runtimeId: record.assignment.runtimeId,
    alias: record.assignment.alias,
    state: lifecycle.state,
    since: lifecycle.since,
    ...(lifecycle.state === 'needs-user' ? { attentionKind: lifecycle.attentionKind } : {}),
    ...(lifecycle.state === 'completed' ? { summary: lifecycle.summary } : {}),
    ...(lifecycle.state === 'failed' ? { safeMessage: lifecycle.safeMessage } : {}),
    ...(lifecycle.state === 'interrupted' ? { interruptReason: lifecycle.reason } : {}),
    destination: {
      conversationId: record.destination.conversationId,
      title: record.destination.titleSnapshot,
    },
  };
}

// ── Codecs ───────────────────────────────────────────────────────────────────

export class CommentTaskCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommentTaskCodecError';
  }
}

function fail(path: string, expectation: string): never {
  throw new CommentTaskCodecError(`${path} must be ${expectation}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'an object');
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string, maxChars?: number): string {
  if (typeof value !== 'string') fail(path, 'a string');
  if (maxChars !== undefined && value.length > maxChars) fail(path, `at most ${maxChars} characters`);
  return value;
}

function nonEmptyStringAt(value: unknown, path: string, maxChars?: number): string {
  const result = stringAt(value, path, maxChars);
  if (!result.trim()) fail(path, 'a non-empty string');
  return result;
}

function nullableStringAt(value: unknown, path: string): string | null {
  if (value === null) return null;
  return stringAt(value, path);
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'a boolean');
  return value;
}

function integerAt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(path, 'a non-negative safe integer');
  return value as number;
}

function isoAt(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!result || !Number.isFinite(Date.parse(result))) fail(path, 'an ISO-8601 timestamp');
  return result;
}

function enumAt<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, `one of ${values.join(', ')}`);
  return value as T;
}

function sha256At(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!/^[a-f0-9]{64}$/.test(result)) fail(path, 'a lowercase hex SHA-256 digest');
  return result;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCommentTaskId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function taskIdAt(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!isCommentTaskId(result)) fail(path, 'a UUID');
  return result;
}

/**
 * Comment ids come from two generations of the editor: `crypto.randomUUID()`
 * and the pre-Sprint-117 fallback `c-<base36>-<base36>`. Both must decode, or
 * existing documents would be rejected at dispatch.
 */
const COMMENT_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c-[a-z0-9]{1,24}-[a-z0-9]{1,24})$/i;

export function isCommentId(value: string): boolean {
  return COMMENT_ID_PATTERN.test(value);
}

function commentIdAt(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!isCommentId(result)) fail(path, 'a comment id');
  return result;
}

export function decodeCommentTaskCommentV1(value: unknown, path: string): CommentTaskCommentV1 {
  const input = objectAt(value, path);
  const comment: CommentTaskCommentV1 = {
    commentId: commentIdAt(input.commentId, `${path}.commentId`),
    kind: enumAt(input.kind, `${path}.kind`, ['mark', 'node'] as const),
    note: nonEmptyStringAt(input.note, `${path}.note`, MAX_NOTE_CHARS),
    instruction: nonEmptyStringAt(input.instruction, `${path}.instruction`, MAX_INSTRUCTION_CHARS),
  };
  if (input.anchoredText !== undefined) {
    comment.anchoredText = stringAt(input.anchoredText, `${path}.anchoredText`, MAX_ANCHORED_TEXT_CHARS);
  }
  // A standalone note is not anchored to text; an anchored snippet on one would
  // mean the collector mixed up the two carriers.
  if (comment.kind === 'node' && comment.anchoredText !== undefined) {
    fail(`${path}.anchoredText`, 'absent for a standalone note');
  }
  return comment;
}

export function decodeCommentTaskCommentsV1(value: unknown, path: string): CommentTaskCommentV1[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  if (value.length === 0) fail(path, 'a non-empty array');
  if (value.length > MAX_COMMENTS_PER_TASK) fail(path, `at most ${MAX_COMMENTS_PER_TASK} comments`);
  const comments = value.map((item, index) => decodeCommentTaskCommentV1(item, `${path}[${index}]`));
  const seen = new Set<string>();
  for (const comment of comments) {
    // A duplicate id inside one task would make status and the completion reply
    // ambiguous for that comment. The webview re-mints duplicates before
    // dispatch (D3); reaching here means that step was skipped.
    if (seen.has(comment.commentId)) fail(`${path}`, `free of duplicate comment ids (${comment.commentId})`);
    seen.add(comment.commentId);
  }
  return comments;
}

export function decodeCommentTaskSourceV1(value: unknown, path = 'source'): CommentTaskSourceV1 {
  const input = objectAt(value, path);
  const documentUri = nonEmptyStringAt(input.documentUri, `${path}.documentUri`);
  if (!documentUri.startsWith('file:')) fail(`${path}.documentUri`, 'a file: URI');
  return {
    documentUri,
    scopeId: nonEmptyStringAt(input.scopeId, `${path}.scopeId`),
    scope: decodeProjectScopeDescriptorV1(input.scope, `${path}.scope`),
    displayPath: nonEmptyStringAt(input.displayPath, `${path}.displayPath`),
    documentVersion: integerAt(input.documentVersion, `${path}.documentVersion`),
    contentSha256: sha256At(input.contentSha256, `${path}.contentSha256`),
  };
}

export function decodeCommentTaskLifecycleV1(value: unknown, path = 'lifecycle'): CommentTaskLifecycleV1 {
  const input = objectAt(value, path);
  const state = enumAt(input.state, `${path}.state`, COMMENT_TASK_STATES);
  const since = isoAt(input.since, `${path}.since`);
  switch (state) {
    case 'needs-user':
      return {
        state,
        since,
        attentionKind: enumAt(input.attentionKind, `${path}.attentionKind`, [
          'approval',
          'question',
          'plan-review',
        ] as const),
      };
    case 'completed':
      return {
        state,
        since,
        terminalEventId: nonEmptyStringAt(input.terminalEventId, `${path}.terminalEventId`),
        // The summary may be empty only in the sense of the tool-only fallback,
        // which the projection layer supplies as real text — so it is required
        // here and bounded, never invented at render time (R7).
        summary: nonEmptyStringAt(input.summary, `${path}.summary`, MAX_SUMMARY_CHARS),
      };
    case 'failed': {
      const lifecycle: CommentTaskLifecycleV1 = {
        state,
        since,
        safeMessage: nonEmptyStringAt(input.safeMessage, `${path}.safeMessage`, MAX_SAFE_MESSAGE_CHARS),
      };
      if (input.failureKind !== undefined) {
        lifecycle.failureKind = stringAt(input.failureKind, `${path}.failureKind`) as RuntimeFailureKind;
      }
      return lifecycle;
    }
    case 'interrupted':
      return {
        state,
        since,
        reason: enumAt(input.reason, `${path}.reason`, [
          'restart',
          'sidebar-unreachable',
          'conversation-deleted',
          'runtime-exited',
        ] as const),
      };
    default:
      return { state, since };
  }
}

function decodeHistoryV1(value: unknown, path = 'history'): CommentTaskHistoryEntryV1[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  if (value.length > MAX_HISTORY_ENTRIES) fail(path, `at most ${MAX_HISTORY_ENTRIES} entries`);
  return value.map((item, index) => {
    const entryPath = `${path}[${index}]`;
    const input = objectAt(item, entryPath);
    const entry: CommentTaskHistoryEntryV1 = {
      state: enumAt(input.state, `${entryPath}.state`, COMMENT_TASK_STATES),
      at: isoAt(input.at, `${entryPath}.at`),
      generation: integerAt(input.generation, `${entryPath}.generation`),
    };
    if (input.note !== undefined) entry.note = stringAt(input.note, `${entryPath}.note`, MAX_SAFE_MESSAGE_CHARS);
    return entry;
  });
}

export function decodeCommentTaskRecordV1(value: unknown): CommentTaskRecordV1 {
  const input = objectAt(value, 'record');
  const schemaVersion = integerAt(input.schemaVersion, 'record.schemaVersion');
  if (schemaVersion !== COMMENT_TASK_SCHEMA_VERSION) {
    fail('record.schemaVersion', `${COMMENT_TASK_SCHEMA_VERSION}`);
  }
  const bindingGeneration = integerAt(input.bindingGeneration, 'record.bindingGeneration');
  if (bindingGeneration < 1) fail('record.bindingGeneration', 'at least 1');

  const assignmentInput = objectAt(input.assignment, 'record.assignment');
  const alias = enumAt(assignmentInput.alias, 'record.assignment.alias', COMMENT_TASK_ALIASES);
  const runtimeId = stringAt(assignmentInput.runtimeId, 'record.assignment.runtimeId') as AgentId;
  // Alias and runtime are two spellings of one fact; a record where they
  // disagree would dispatch to a runtime the comment never named.
  if (ALIAS_TO_RUNTIME_ID[alias] !== runtimeId) {
    fail('record.assignment.runtimeId', `the runtime for @${alias} (${ALIAS_TO_RUNTIME_ID[alias]})`);
  }

  const runtimeInput = objectAt(input.runtime, 'record.runtime');
  const destinationInput = objectAt(input.destination, 'record.destination');
  const turnInput = objectAt(input.turn, 'record.turn');
  const promptInput = objectAt(input.prompt, 'record.prompt');

  return {
    schemaVersion: COMMENT_TASK_SCHEMA_VERSION,
    taskId: taskIdAt(input.taskId, 'record.taskId'),
    bindingGeneration,
    requestId: nonEmptyStringAt(input.requestId, 'record.requestId'),
    createdAt: isoAt(input.createdAt, 'record.createdAt'),
    updatedAt: isoAt(input.updatedAt, 'record.updatedAt'),
    source: decodeCommentTaskSourceV1(input.source, 'record.source'),
    comments: decodeCommentTaskCommentsV1(input.comments, 'record.comments'),
    assignment: {
      alias,
      runtimeId,
      surface: enumAt(assignmentInput.surface, 'record.assignment.surface', ['rail', 'menu'] as const),
    },
    runtime: {
      modelId: nullableStringAt(runtimeInput.modelId, 'record.runtime.modelId'),
      approvalMode: enumAt(runtimeInput.approvalMode, 'record.runtime.approvalMode', ['auto', 'ask'] as const),
      planFirst: booleanAt(runtimeInput.planFirst, 'record.runtime.planFirst'),
      thinkingEffort: stringAt(runtimeInput.thinkingEffort, 'record.runtime.thinkingEffort') as ThinkingEffort,
    },
    destination: {
      conversationId: nonEmptyStringAt(destinationInput.conversationId, 'record.destination.conversationId'),
      bindingGeneration: integerAt(destinationInput.bindingGeneration, 'record.destination.bindingGeneration'),
      titleSnapshot: stringAt(destinationInput.titleSnapshot, 'record.destination.titleSnapshot'),
      created: booleanAt(destinationInput.created, 'record.destination.created'),
    },
    turn: { conversationTurnId: nonEmptyStringAt(turnInput.conversationTurnId, 'record.turn.conversationTurnId') },
    prompt: {
      text: nonEmptyStringAt(promptInput.text, 'record.prompt.text', MAX_PROMPT_CHARS),
      sha256: sha256At(promptInput.sha256, 'record.prompt.sha256'),
    },
    lifecycle: decodeCommentTaskLifecycleV1(input.lifecycle, 'record.lifecycle'),
    history: decodeHistoryV1(input.history, 'record.history'),
  };
}

/** Index entry — enough to answer "what does this document have?" without
 *  reading every record file. */
export interface CommentTaskIndexEntryV1 {
  taskId: string;
  documentUri: string;
  scopeId: string;
  conversationId: string;
  conversationTurnId: string;
  state: CommentTaskState;
  bindingGeneration: number;
  updatedAt: string;
}

export function summarizeCommentTask(record: CommentTaskRecordV1): CommentTaskIndexEntryV1 {
  return {
    taskId: record.taskId,
    documentUri: record.source.documentUri,
    scopeId: record.source.scopeId,
    conversationId: record.destination.conversationId,
    conversationTurnId: record.turn.conversationTurnId,
    state: record.lifecycle.state,
    bindingGeneration: record.bindingGeneration,
    updatedAt: record.updatedAt,
  };
}
