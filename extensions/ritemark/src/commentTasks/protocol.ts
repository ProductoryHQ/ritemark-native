/**
 * Comment-task protocol — the typed boundary between the editor webview, the
 * extension host and the AI sidebar (Sprint 117, #292).
 *
 * The path this replaces treated its payload as advisory: `commentIds` and
 * `documentPath` were optional and unvalidated, so a dispatch with an empty id
 * list or a bare relative path was accepted and acknowledged as success
 * (audit F07). Here every field is checked before the host acts on it, and a
 * rejection names a reason the UI can turn into a specific recovery instead of
 * a shrug.
 *
 * Shape and vocabulary follow `../conversations/protocol.ts`; the two boundaries
 * carry related traffic and a developer who knows one should recognise the other.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D6)
 */

import {
  MAX_COMMENTS_PER_TASK,
  decodeCommentTaskCommentsV1,
  type CommentTaskAlias,
  type CommentTaskCommentV1,
  type CommentTaskProjectionV1,
  type CommentTaskSurface,
  COMMENT_TASK_ALIASES,
} from './types';

/** Largest inbound message we will even parse. A comment task is text; anything
 *  approaching this is a bug or an attack, and reading it costs the host. */
export const MAX_COMMENT_TASK_MESSAGE_BYTES = 2 * 1024 * 1024;

export type CommentTaskErrorCode =
  // request shape
  | 'invalid-request'
  | 'payload-too-large'
  | 'empty-instruction'
  | 'unsupported-alias'
  | 'duplicate-comment-id'
  // environment
  | 'feature-disabled'
  | 'durable-conversations-disabled'
  | 'store-degraded'
  // document
  | 'document-not-file'
  | 'document-not-synced'
  | 'comment-not-found'
  // dispatch
  | 'runtime-unavailable'
  | 'destination-not-found'
  | 'queue-full'
  | 'sidebar-unreachable'
  // task lookup
  | 'unknown-task'
  | 'stale-generation';

/** What the UI should offer the user next. `none` means the message alone is
 *  the whole story; anything else becomes a button. */
export type CommentTaskRecovery = 'none' | 'retry' | 'sign-in' | 'configure' | 'install' | 'save-document';

export interface CommentTaskError {
  code: CommentTaskErrorCode;
  message: string;
  retryable: boolean;
  recovery: CommentTaskRecovery;
}

interface RequestBase {
  requestId: string;
}

/**
 * Editor webview → host.
 *
 * `accept` deliberately carries NO destination: the task goes to the
 * conversation open in the AI sidebar (D5), which only the host can know for
 * certain. A webview that sent its own destination could retarget another
 * user's work by guessing an id.
 */
export type CommentTaskRequest =
  | (RequestBase & {
      type: 'comment-task/accept';
      /** Groups one bulk send so the UI can report per-agent results. */
      batchId: string | null;
      surface: CommentTaskSurface;
      alias: CommentTaskAlias;
      /** `TextDocument.version` the webview believes it is describing. */
      documentVersion: number;
      comments: CommentTaskCommentV1[];
    })
  | (RequestBase & { type: 'comment-task/destination-preview' })
  /**
   * "Send me this document's tasks again." The host also pushes a projection
   * when an editor reports ready, but that push races the webview's own
   * subscription: after a window reload the comments came back with no status
   * at all while the ledger held them (found live, 2026-09-14). A pull the
   * webview makes when it starts listening cannot lose that race.
   */
  | (RequestBase & { type: 'comment-task/refresh' })
  | (RequestBase & { type: 'comment-task/open-conversation'; taskId: string })
  | (RequestBase & { type: 'comment-task/retry'; taskId: string })
  | (RequestBase & { type: 'comment-task/cancel'; taskId: string });

export type CommentTaskRequestType = CommentTaskRequest['type'];

export interface CommentTaskAcceptedResult {
  taskId: string;
  state: 'queued';
  destination: { conversationId: string; title: string; created: boolean };
}

/** Host → editor webview, answering exactly one request. */
export type CommentTaskResultMessage =
  | {
      type: 'comment-task/result';
      requestId: string;
      operation: CommentTaskRequestType;
      ok: true;
      data: CommentTaskAcceptedResult | CommentTaskDestinationPreview | { taskId: string };
    }
  | {
      type: 'comment-task/result';
      requestId: string;
      operation: CommentTaskRequestType | 'unknown';
      ok: false;
      error: CommentTaskError;
    };

export interface CommentTaskDestinationPreview {
  /** Null when the sidebar has never reported an open conversation — the Send
   *  surface then says "a new conversation" rather than inventing a title. */
  conversationId: string | null;
  title: string | null;
}

/**
 * Host → editor webview, unsolicited: the complete task state for ONE document.
 * A snapshot rather than a delta, because a webview that reloaded mid-stream
 * would otherwise apply half a story. Scoped by document URI, which is how the
 * global broadcast of the old path is retired (audit F13).
 */
export interface CommentTaskProjectionMessage {
  type: 'comment-task/projection';
  documentUri: string;
  tasks: CommentTaskProjectionV1[];
}

/** Host → AI sidebar: run this accepted task. The turn id is host-minted, so
 *  the sidebar must not invent its own — that id is how a terminal event later
 *  finds exactly this task. */
export interface CommentTaskEnqueueMessage {
  type: 'comment-task/enqueue';
  taskId: string;
  conversationId: string;
  conversationTurnId: string;
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  prompt: string;
  displayText: string;
  modelId: string | null;
  autonomy: 'auto' | 'ask';
  thinkingEffort: string;
  /** The source document, frozen at acceptance. The runtime gets this instead
   *  of whatever tab happens to be active when the queue drains (audit F12). */
  sourceDisplayPath: string;
}

export type CommentTaskEnqueueOutcome = 'queued' | 'full' | 'no-conversation';

/** AI sidebar → host. */
export type CommentTaskSidebarMessage =
  | { type: 'comment-task/enqueue-result'; taskId: string; outcome: CommentTaskEnqueueOutcome }
  | { type: 'comment-task/dequeued'; taskId: string };

export class CommentTaskProtocolError extends Error {
  constructor(
    readonly code: CommentTaskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CommentTaskProtocolError';
  }
}

function invalid(message: string): never {
  throw new CommentTaskProtocolError('invalid-request', message);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Message must be an object');
  return value as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, key: string, maxChars = 512): string {
  const value = input[key];
  if (typeof value !== 'string' || !value) invalid(`${key} must be a non-empty string`);
  if ((value as string).length > maxChars) invalid(`${key} must be at most ${maxChars} characters`);
  return value as string;
}

function integerField(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalid(`${key} must be a non-negative safe integer`);
  }
  return value as number;
}

const REQUEST_TYPES = new Set<CommentTaskRequestType>([
  'comment-task/accept',
  'comment-task/destination-preview',
  'comment-task/refresh',
  'comment-task/open-conversation',
  'comment-task/retry',
  'comment-task/cancel',
]);

export function isCommentTaskRequest(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    REQUEST_TYPES.has((value as { type?: CommentTaskRequestType }).type as CommentTaskRequestType)
  );
}

/**
 * Validate one inbound request. Throws `CommentTaskProtocolError` with the code
 * the UI should show; the caller never sees a partially decoded request.
 */
export function decodeCommentTaskRequest(value: unknown): CommentTaskRequest {
  const input = object(value);
  const type = input.type;
  if (typeof type !== 'string' || !REQUEST_TYPES.has(type as CommentTaskRequestType)) {
    invalid('type must be a known comment-task request');
  }
  const requestId = stringField(input, 'requestId', 128);

  switch (type as CommentTaskRequestType) {
    case 'comment-task/accept': {
      const alias = input.alias;
      if (typeof alias !== 'string' || !COMMENT_TASK_ALIASES.includes(alias as CommentTaskAlias)) {
        // Not `invalid-request`: an unsupported alias is a normal thing for a
        // user to type, and the UI says so in plain words rather than "bad
        // request". `@other` simply never becomes a task (audit R2).
        throw new CommentTaskProtocolError(
          'unsupported-alias',
          `Only ${COMMENT_TASK_ALIASES.map((item) => `@${item}`).join(', ')} can be assigned a comment`,
        );
      }
      const surface = input.surface;
      if (surface !== 'rail' && surface !== 'menu') invalid('surface must be rail or menu');

      const batchId = input.batchId === null || input.batchId === undefined ? null : stringField(input, 'batchId', 128);
      const documentVersion = integerField(input, 'documentVersion');

      if (!Array.isArray(input.comments)) invalid('comments must be an array');
      if (input.comments.length === 0) {
        // This is the old `commentIds: []` dispatch (audit F08): the toolbar
        // reported "Queued N" while the host had nothing to bind status to.
        invalid('comments must not be empty');
      }
      if (input.comments.length > MAX_COMMENTS_PER_TASK) {
        throw new CommentTaskProtocolError(
          'payload-too-large',
          `A task can carry at most ${MAX_COMMENTS_PER_TASK} comments`,
        );
      }

      let comments: CommentTaskCommentV1[];
      try {
        comments = decodeCommentTaskCommentsV1(input.comments, 'comments');
      } catch (error) {
        // The codec speaks in field paths; the user needs a reason. This is the
        // one place that translation happens.
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('duplicate comment ids')) {
          throw new CommentTaskProtocolError(
            'duplicate-comment-id',
            'Two comments in this task share an id. Reopen the document and try again.',
          );
        }
        if (message.includes('instruction must be')) {
          throw new CommentTaskProtocolError(
            'empty-instruction',
            'Write what the agent should do before sending the comment.',
          );
        }
        if (message.includes('at most')) throw new CommentTaskProtocolError('payload-too-large', message);
        invalid(message);
      }

      // Belt and braces: the codec rejects a blank instruction, but a comment
      // whose whole body is the mention must never reach a runtime that would
      // then invent something to do.
      if (comments.some((comment) => !comment.instruction.trim())) {
        throw new CommentTaskProtocolError(
          'empty-instruction',
          'Write what the agent should do before sending the comment.',
        );
      }

      return {
        type: 'comment-task/accept',
        requestId,
        batchId,
        surface: surface as CommentTaskSurface,
        alias: alias as CommentTaskAlias,
        documentVersion,
        comments,
      };
    }

    case 'comment-task/destination-preview':
      return { type: 'comment-task/destination-preview', requestId };

    case 'comment-task/refresh':
      return { type: 'comment-task/refresh', requestId };

    default:
      return {
        type: type as 'comment-task/open-conversation' | 'comment-task/retry' | 'comment-task/cancel',
        requestId,
        taskId: stringField(input, 'taskId', 128),
      };
  }
}

export function decodeCommentTaskSidebarMessage(value: unknown): CommentTaskSidebarMessage {
  const input = object(value);
  const type = input.type;
  if (type === 'comment-task/dequeued') {
    return { type, taskId: stringField(input, 'taskId', 128) };
  }
  if (type !== 'comment-task/enqueue-result') invalid('type must be a known comment-task sidebar message');
  const outcome = input.outcome;
  if (outcome !== 'queued' && outcome !== 'full' && outcome !== 'no-conversation') {
    invalid('outcome must be queued, full or no-conversation');
  }
  return { type, taskId: stringField(input, 'taskId', 128), outcome };
}

const RETRYABLE: ReadonlySet<CommentTaskErrorCode> = new Set([
  'document-not-synced',
  'queue-full',
  'sidebar-unreachable',
  'store-degraded',
  'runtime-unavailable',
]);

const RECOVERY: Partial<Record<CommentTaskErrorCode, CommentTaskRecovery>> = {
  'document-not-file': 'save-document',
  'document-not-synced': 'retry',
  'queue-full': 'retry',
  'sidebar-unreachable': 'retry',
  'store-degraded': 'retry',
};

/** Build the rejection the webview renders. `recovery` may be supplied by the
 *  caller — an unavailable runtime knows whether it needs a sign-in, a config
 *  or an install, and that answer comes from the shared availability policy,
 *  not from a guess here. */
export function commentTaskError(
  code: CommentTaskErrorCode,
  message: string,
  recovery?: CommentTaskRecovery,
): CommentTaskError {
  return {
    code,
    message,
    retryable: RETRYABLE.has(code),
    recovery: recovery ?? RECOVERY[code] ?? 'none',
  };
}

export function commentTaskFailure(
  requestId: string,
  operation: CommentTaskRequestType | 'unknown',
  error: CommentTaskError,
): CommentTaskResultMessage {
  return { type: 'comment-task/result', requestId, operation, ok: false, error };
}

export function commentTaskSuccess(
  requestId: string,
  operation: CommentTaskRequestType,
  data: CommentTaskAcceptedResult | CommentTaskDestinationPreview | { taskId: string },
): CommentTaskResultMessage {
  return { type: 'comment-task/result', requestId, operation, ok: true, data };
}
