/**
 * CommentTaskController — the one place that turns "send this comment to an
 * agent" into an accepted, durable, observable task (Sprint 117, #292).
 *
 * The path it replaces was a relay: the editor posted a prompt, the sidebar
 * guessed a conversation, and the editor flashed "Sent" before anyone had
 * agreed to anything (audit F18, F20). Here acceptance is a decision the host
 * makes — document, comments, runtime availability, destination, queue capacity
 * — and the editor is told the outcome, not the intention.
 *
 * Everything the controller needs from VS Code arrives through
 * `CommentTaskControllerDependencies`, so the whole acceptance sequence and the
 * lifecycle mapping are exercised in fast Node tests. The view providers adapt;
 * they hold no task logic.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D5, D6, D7)
 */

import { createHash, randomUUID } from 'crypto';
import type { ProjectScopeDescriptorV1 } from '../conversations/types';
import { CommentTaskStore, CommentTaskStoreError } from './CommentTaskStore';
import {
  chatNameFromComment,
  pickCommentTaskDestination,
  type DestinationChatFacts,
} from './commentTaskDestination';
import {
  ALIAS_TO_RUNTIME_ID,
  projectCommentTask,
  type CommentTaskAlias,
  type CommentTaskAttentionKind,
  type CommentTaskCommentV1,
  type CommentTaskInterruptReason,
  type CommentTaskLifecycleV1,
  type CommentTaskProjectionV1,
  type CommentTaskRecordV1,
  safeFailureMessage,
  MAX_SAFE_MESSAGE_CHARS,
  MAX_SUMMARY_CHARS,
} from './types';
import {
  CommentTaskProtocolError,
  commentTaskError,
  commentTaskFailure,
  commentTaskSuccess,
  decodeCommentTaskRequest,
  type CommentTaskEnqueueMessage,
  type CommentTaskEnqueueOutcome,
  type CommentTaskError,
  type CommentTaskRecovery,
  type CommentTaskRequest,
  type CommentTaskResultMessage,
} from './protocol';

/** The source document, as the host sees it at the moment of the request. */
export interface CommentTaskDocument {
  /** Canonical `vscode.Uri.toString()`. */
  uri: string;
  scopeId: string;
  scope: ProjectScopeDescriptorV1;
  displayPath: string;
  version: number;
  /** Current text, used to confirm the requested comment ids really exist. */
  text: string;
  /** Unsaved changes pending. A comment the host cannot find in a dirty
   *  document is probably still on its way, so the user is told to try again
   *  rather than that their comment vanished. */
  isDirty?: boolean;
}

export interface CommentTaskDestination {
  conversationId: string;
  bindingGeneration: number;
  title: string;
  /** True when this task started the conversation. */
  created: boolean;
  /**
   * The agent this conversation is currently running, when it has one. A
   * comment assigned to a DIFFERENT agent still goes here — the same
   * runtime-switch the Composer already allows, recorded as a boundary in the
   * transcript — but the Send surface says so first, because a thread quietly
   * changing agent is exactly the kind of surprise this sprint exists to
   * remove. Null for a conversation that has not run a turn yet.
   */
  runtimeId?: string | null;
}

/**
 * Sprint 155: what the destination rules read (`pickCommentTaskDestination`).
 * Gathered by the host, so the controller stays testable without VS Code.
 */
export interface CommentTaskRoutingFacts {
  /** The comment's document as a file path, in the form `changedFiles` uses. */
  documentPath: string;
  /** This project's chats and the files each one changed. */
  chats: DestinationChatFacts[];
  /** A comment task's document URI as a file path, or null when it is not a file. */
  pathOfUri(documentUri: string): string | null;
  /** The file still exists. A gone file never counts as a chat's change. */
  exists(file: string): boolean;
  samePath?(a: string, b: string): boolean;
}

/** Sprint 155: where a task goes, and whether that is the chat open on the sheet. */
interface RoutedDestination {
  destination: CommentTaskDestination;
  /** The chat open on the AI's sheet: no toast, the old path. */
  isOpen: boolean;
  /** Rule 3: a new chat, made for this task. */
  newChat: boolean;
}

/** The toast's words when a task goes to a chat that isn't open (Sprint 155). */
export function sentToastText(routed: { newChat: boolean; title: string }): string {
  const title = routed.title.trim();
  if (routed.newChat) return title ? `Sent to a new chat, “${title}”` : 'Sent to a new chat';
  return `Sent to “${title || 'New conversation'}”`;
}

export interface CommentTaskAvailability {
  usable: boolean;
  message?: string;
  recovery?: CommentTaskRecovery;
}

export interface CommentTaskRuntimeSettings {
  modelId: string | null;
  approvalMode: 'auto' | 'ask';
  thinkingEffort: string;
}

export interface CommentTaskControllerDependencies {
  store: CommentTaskStore;
  /** Is `comment-callouts` on? The repair rides the existing flag (D11). */
  isFeatureEnabled(): boolean;
  /** Comment tasks need host-canonical turns; without them there is no turn
   *  identity to bind a task to. */
  areDurableConversationsEnabled(): Promise<boolean>;
  /**
   * The conversation open in the AI sidebar, creating one if the sidebar has
   * none (D5). Returns null when the sidebar cannot be reached at all.
   */
  resolveOpenConversation(runtimeId: string): Promise<CommentTaskDestination | null>;
  /**
   * Sprint 155: the facts the three destination rules read. Without it, every
   * task goes to the open chat, as before Sprint 155.
   */
  routingFacts?(document: CommentTaskDocument): Promise<CommentTaskRoutingFacts>;
  /** Sprint 155: the chat open on the AI's sheet right now, without revealing or waiting. */
  openConversationId?(): string | null;
  /** Sprint 155: a chat the rules picked, as a destination; null when it is gone. */
  conversationDestination?(conversationId: string): Promise<CommentTaskDestination | null>;
  /**
   * Sprint 155: room for one more working chat — the card's check (`_canAttachRuntime`).
   * Null asks for a new chat. Asked only for a chat that isn't the open one.
   */
  canAttach?(conversationId: string | null): Promise<boolean>;
  /** Sprint 155: the "Sent to …" toast, when a task goes to a chat that isn't open. */
  notifySent?(text: string): void;
  /** Sprint 155: name a chat made for a comment, once it has a record. */
  setConversationTitle?(conversationId: string, title: string): Promise<void>;
  /** Normalized runtime availability — the same policy the Composer uses, so
   *  the comment path cannot invent a stricter or looser gate (audit F19). */
  checkAvailability(runtimeId: string): Promise<CommentTaskAvailability>;
  /** Frozen per-turn settings for the destination conversation. */
  runtimeSettings(conversationId: string, runtimeId: string): CommentTaskRuntimeSettings;
  /** One prompt builder for both surfaces, given the REAL document label. */
  buildPrompt(document: CommentTaskDocument, comments: CommentTaskCommentV1[]): string;
  /** Hand the accepted task to the sidebar queue and wait for its verdict.
   *  Sprint 155: the answer may name the chat it was queued in. */
  enqueue(message: CommentTaskEnqueueMessage): Promise<CommentTaskEnqueueOutcome | { outcome: CommentTaskEnqueueOutcome; conversationId?: string }>;
  /** Bring a conversation into view. */
  revealConversation(conversationId: string): Promise<void>;
  /** Ask the runtime to stop a turn this task owns. */
  cancelTurn?(conversationId: string, conversationTurnId: string): Promise<void>;
  /** Current title of a conversation, used to refresh what a comment shows
   *  after the conversation store renames or titles it. */
  conversationTitle?(conversationId: string): Promise<string | null>;
  /** Push a document's task snapshot to its editor webviews. */
  publishProjection(documentUri: string, tasks: CommentTaskProjectionV1[]): void;
  now?(): Date;
  randomId?(): string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Flatten an agent's terminal message into one plain line for the comment
 * bubble. Not a summariser: it takes the agent's own first sentence and stops.
 * Inventing a conclusion would be exactly the dishonesty this sprint removes,
 * so an empty result gets the tool-only fallback instead (R7).
 */
export function summarizeTerminalText(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/[*_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'The task finished. Open the conversation for details.';
  if (plain.length <= MAX_SUMMARY_CHARS) return plain;

  const window = plain.slice(0, MAX_SUMMARY_CHARS);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd > 60) return window.slice(0, sentenceEnd + 1);
  const wordEnd = window.lastIndexOf(' ');
  return `${(wordEnd > 60 ? window.slice(0, wordEnd) : window.slice(0, MAX_SUMMARY_CHARS - 1)).trimEnd()}…`;
}

export class CommentTaskController {
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly dependencies: CommentTaskControllerDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.randomId = dependencies.randomId ?? (() => createHash('sha256').update(String(Math.random())).digest('hex'));
  }

  /**
   * Handle one message from an editor webview. Never throws: a webview gets a
   * result it can render, and a malformed message is a rejection rather than an
   * unhandled error in the extension host.
   */
  async handleRequest(value: unknown, document: CommentTaskDocument | null): Promise<CommentTaskResultMessage> {
    let request: CommentTaskRequest;
    try {
      request = decodeCommentTaskRequest(value);
    } catch (error) {
      const requestId = typeof (value as { requestId?: string })?.requestId === 'string'
        ? (value as { requestId: string }).requestId
        : 'unknown';
      if (error instanceof CommentTaskProtocolError) {
        return commentTaskFailure(requestId, 'unknown', commentTaskError(error.code, error.message));
      }
      return commentTaskFailure(
        requestId,
        'unknown',
        commentTaskError('invalid-request', error instanceof Error ? error.message : String(error)),
      );
    }

    if (!this.dependencies.isFeatureEnabled()) {
      return commentTaskFailure(
        request.requestId,
        request.type,
        commentTaskError('feature-disabled', 'Comments are turned off.'),
      );
    }

    try {
      switch (request.type) {
        case 'comment-task/accept':
          return await this.accept(request, document);
        case 'comment-task/destination-preview':
          return await this.previewDestination(request.requestId, document);
        case 'comment-task/refresh': {
          // The webview asking for what it may have missed. Answering with the
          // projection rather than data in the result keeps ONE shape for task
          // state, so a pull and a push cannot disagree.
          if (document) await this.publish(document.uri);
          return commentTaskSuccess(request.requestId, request.type, { taskId: '' });
        }
        case 'comment-task/open-conversation':
          return await this.openConversation(request.requestId, request.taskId);
        case 'comment-task/retry':
          return await this.retry(request.requestId, request.taskId, document);
        case 'comment-task/cancel':
          return await this.cancel(request.requestId, request.taskId);
      }
    } catch (error) {
      if (error instanceof CommentTaskStoreError) {
        return commentTaskFailure(
          request.requestId,
          request.type,
          commentTaskError(
            error.code === 'not-found' ? 'unknown-task' : 'store-degraded',
            error.code === 'not-found' ? 'That task no longer exists.' : 'Ritemark could not save this task.',
          ),
        );
      }
      return commentTaskFailure(
        request.requestId,
        request.type,
        commentTaskError('store-degraded', error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // ── Acceptance ─────────────────────────────────────────────────────────────

  private async accept(
    request: Extract<CommentTaskRequest, { type: 'comment-task/accept' }>,
    document: CommentTaskDocument | null,
  ): Promise<CommentTaskResultMessage> {
    const reject = (error: CommentTaskError): CommentTaskResultMessage =>
      commentTaskFailure(request.requestId, request.type, error);

    // Idempotency before anything else: a double click or a retried response
    // must resolve to the task the first request created, not a second one.
    const existing = await this.dependencies.store.findByRequestId(request.requestId);
    if (existing) {
      return commentTaskSuccess(request.requestId, request.type, {
        taskId: existing.taskId,
        state: 'queued',
        destination: {
          conversationId: existing.destination.conversationId,
          title: existing.destination.titleSnapshot,
          created: existing.destination.created,
        },
      });
    }

    if (!document) {
      return reject(
        commentTaskError('document-not-file', 'Save this document to disk before sending comments to an agent.'),
      );
    }
    if (!document.uri.startsWith('file:')) {
      return reject(
        commentTaskError('document-not-file', 'Save this document to disk before sending comments to an agent.'),
      );
    }
    if (!(await this.dependencies.areDurableConversationsEnabled())) {
      return reject(
        commentTaskError('durable-conversations-disabled', 'Agent conversations are unavailable right now.'),
      );
    }

    // The webview describes a document version; if the host has not caught up,
    // the ids it names may not be on disk yet. Saying "try again" is honest;
    // accepting and hoping is how a task ends up bound to nothing.
    if (document.version < request.documentVersion) {
      return reject(
        commentTaskError('document-not-synced', 'The document is still saving. Try again in a moment.'),
      );
    }
    const missing = request.comments.find((comment) => !this.documentContainsComment(document.text, comment.commentId));
    if (missing) {
      return reject(
        document.isDirty
          ? commentTaskError('document-not-synced', 'The document is still saving. Try again in a moment.')
          : commentTaskError('comment-not-found', 'That comment is no longer in the document.'),
      );
    }

    const runtimeId = ALIAS_TO_RUNTIME_ID[request.alias];
    const availability = await this.dependencies.checkAvailability(runtimeId);
    if (!availability.usable) {
      // Gated BEFORE the queue, so a signed-out runtime fails where the user is
      // looking instead of at the runtime boundary minutes later (audit F19).
      return reject(
        commentTaskError(
          'runtime-unavailable',
          availability.message ?? 'That agent is not ready yet.',
          availability.recovery,
        ),
      );
    }

    const routed = await this.resolveDestination(
      runtimeId,
      document,
      request.comments.map((comment) => comment.instruction).join(' '),
      false,
    );
    if (!routed) {
      return reject(commentTaskError('sidebar-unreachable', 'The AI sidebar is not responding. Try again.'));
    }
    const destination = routed.destination;
    // Sprint 155: a chat that isn't open must have room to work, as a card's
    // task must (Phase 0, P1): refused before anything is recorded.
    if (!routed.isOpen && this.dependencies.canAttach
      && !(await this.dependencies.canAttach(routed.newChat ? null : destination.conversationId))) {
      return reject(commentTaskError('capacity', CAPACITY_MESSAGE));
    }

    const settings = this.dependencies.runtimeSettings(destination.conversationId, runtimeId);
    const prompt = this.dependencies.buildPrompt(document, request.comments);
    const at = this.timestamp();
    const record: CommentTaskRecordV1 = {
      schemaVersion: 1,
      taskId: this.randomId(),
      bindingGeneration: 1,
      requestId: request.requestId,
      createdAt: at,
      updatedAt: at,
      source: {
        documentUri: document.uri,
        scopeId: document.scopeId,
        scope: document.scope,
        displayPath: document.displayPath,
        documentVersion: document.version,
        contentSha256: sha256(document.text),
      },
      comments: request.comments,
      assignment: { alias: request.alias, runtimeId, surface: request.surface },
      runtime: {
        modelId: settings.modelId,
        approvalMode: settings.approvalMode,
        planFirst: false,
        thinkingEffort: settings.thinkingEffort as CommentTaskRecordV1['runtime']['thinkingEffort'],
      },
      destination: {
        conversationId: destination.conversationId,
        bindingGeneration: destination.bindingGeneration,
        titleSnapshot: destination.title,
        created: destination.created,
      },
      turn: { conversationTurnId: this.randomId() },
      prompt: { text: prompt, sha256: sha256(prompt) },
      lifecycle: { state: 'accepting', since: at },
      history: [{ state: 'accepting', at, generation: 1 }],
    };

    // Persist BEFORE the sidebar hears about it. If the process dies here the
    // task restores as interrupted and actionable; the old path would have lost
    // it between the editor's "Sent" and any real dispatch.
    await this.dependencies.store.create(record);

    const outcome = enqueueOutcome(await this.dependencies.enqueue({
      type: 'comment-task/enqueue',
      taskId: record.taskId,
      conversationId: record.destination.conversationId,
      conversationTurnId: record.turn.conversationTurnId,
      runtimeId: runtimeId as CommentTaskEnqueueMessage['runtimeId'],
      prompt,
      displayText: request.comments.map((comment) => comment.instruction).join('\n'),
      modelId: settings.modelId,
      autonomy: settings.approvalMode,
      thinkingEffort: settings.thinkingEffort,
      sourceDisplayPath: document.displayPath,
      ...(routed.newChat
        ? { newConversation: { title: destination.title, conversationId: destination.conversationId } }
        : {}),
    }));

    if (outcome !== 'queued') {
      const error =
        outcome === 'full'
          ? commentTaskError(
              'queue-full',
              'That conversation already has ten prompts waiting. Let one finish and try again.',
            )
          : commentTaskError('destination-not-found', 'That conversation is no longer available.');
      await this.transitionQuietly(record.taskId, 1, {
        state: 'failed',
        since: this.timestamp(),
        safeMessage: error.message.slice(0, MAX_SAFE_MESSAGE_CHARS),
      });
      await this.publish(record.source.documentUri);
      return reject(error);
    }

    const queued = await this.dependencies.store.transition(record.taskId, 1, {
      state: 'queued',
      since: this.timestamp(),
    });
    await this.publish(queued.source.documentUri);
    if (!routed.isOpen) this.dependencies.notifySent?.(sentToastText({ newChat: routed.newChat, title: destination.title }));

    return commentTaskSuccess(request.requestId, request.type, {
      taskId: queued.taskId,
      state: 'queued',
      destination: {
        conversationId: queued.destination.conversationId,
        title: queued.destination.titleSnapshot,
        created: queued.destination.created,
      },
    });
  }

  /**
   * The caption on the Send surface: where the task will go. Sprint 155: the
   * same rules as the send (`resolveDestination`), so the two cannot disagree.
   * A new chat has no name yet here: the caption says "→ New conversation".
   */
  private async previewDestination(requestId: string, document: CommentTaskDocument | null): Promise<CommentTaskResultMessage> {
    const routed = await this.resolveDestination('claude-code', document, '', true).catch(() => null);
    const destination = routed && !routed.newChat ? routed.destination : null;
    return commentTaskSuccess(requestId, 'comment-task/destination-preview', {
      runtimeId: destination?.runtimeId ?? null,
      conversationId: destination?.conversationId ?? null,
      title: destination?.title ?? null,
    });
  }

  /**
   * Sprint 155: the three rules (`pickCommentTaskDestination`), asked at
   * preview, at send and when a retried task's chat is gone. Returns null only
   * when the sidebar cannot be reached and the open chat was needed.
   */
  private async resolveDestination(
    runtimeId: string,
    document: CommentTaskDocument | null,
    commentText: string,
    preview: boolean,
    /** Retry: the task itself, and its chat that is gone, never count. */
    exclude: { taskId?: string; conversationId?: string } = {},
  ): Promise<RoutedDestination | null> {
    const openNow = this.dependencies.openConversationId?.() ?? null;
    const facts = document && this.dependencies.routingFacts
      ? await this.dependencies.routingFacts(document).catch(() => null)
      : null;
    const openChat = async (): Promise<RoutedDestination | null> => {
      const destination = await this.dependencies.resolveOpenConversation(runtimeId);
      return destination ? { destination, isOpen: true, newChat: false } : null;
    };
    if (!facts) return openChat();

    const unfinished = (await this.dependencies.store.listUnfinished())
      .filter((task) => task.taskId !== exclude.taskId);
    const pending = unfinished.flatMap((task) => {
      const path = facts.pathOfUri(task.source.documentUri);
      return path ? [{ conversationId: task.destination.conversationId, document: path, at: task.createdAt }] : [];
    });
    // A chat the index names can be gone (deleted meanwhile): the rules then
    // pick again without it.
    const gone = new Set<string>(exclude.conversationId ? [exclude.conversationId] : []);
    const pick = (openConversationId: string | null) => pickCommentTaskDestination({
      document: facts.documentPath,
      chats: facts.chats.filter((chat) => !gone.has(chat.conversationId)),
      pending: pending.filter((item) => !gone.has(item.conversationId)),
      openConversationId,
      exists: (file) => facts.exists(file),
      ...(facts.samePath ? { samePath: (a: string, b: string) => facts.samePath!(a, b) } : {}),
    });

    // 1. The chat that last changed the document (the open chat is not needed).
    for (let choice = pick(null); choice.rule === 'changed'; choice = pick(null)) {
      const conversationId = choice.conversationId;
      const known = await this.dependencies.conversationDestination?.(conversationId).catch(() => null) ?? null;
      // A chat a waiting task made has no record until its first turn starts.
      const task = unfinished.find((candidate) => candidate.destination.conversationId === conversationId);
      const destination: CommentTaskDestination | null = known
        ?? (task
          ? {
              conversationId,
              bindingGeneration: task.destination.bindingGeneration,
              title: task.destination.titleSnapshot,
              created: false,
              runtimeId: task.assignment.runtimeId,
            }
          : null);
      if (destination) {
        return { destination: { ...destination, created: false }, isOpen: conversationId === openNow, newChat: false };
      }
      gone.add(conversationId);
    }

    // 2. The open chat, if it hasn't changed another document. The sidebar may
    // have to report it first.
    const open = await this.dependencies.resolveOpenConversation(runtimeId).catch(() => null);
    if (!open) return null;
    if (pick(open.conversationId).rule === 'open') return { destination: open, isOpen: true, newChat: false };

    // Rule 3: a new chat, named from the comment.
    return {
      destination: {
        conversationId: preview ? '' : this.newConversationId(),
        bindingGeneration: 0,
        title: chatNameFromComment(commentText),
        created: true,
        runtimeId: null,
      },
      isOpen: false,
      newChat: true,
    };
  }

  private async openConversation(requestId: string, taskId: string): Promise<CommentTaskResultMessage> {
    const record = await this.dependencies.store.get(taskId);
    if (!record) {
      return commentTaskFailure(
        requestId,
        'comment-task/open-conversation',
        commentTaskError('unknown-task', 'That task no longer exists.'),
      );
    }
    // Opens the EXACT conversation the task was bound to, whatever is visible.
    await this.dependencies.revealConversation(record.destination.conversationId);
    return commentTaskSuccess(requestId, 'comment-task/open-conversation', { taskId });
  }

  private async retry(
    requestId: string,
    taskId: string,
    document: CommentTaskDocument | null,
  ): Promise<CommentTaskResultMessage> {
    const record = await this.dependencies.store.get(taskId);
    if (!record) {
      return commentTaskFailure(
        requestId,
        'comment-task/retry',
        commentTaskError('unknown-task', 'That task no longer exists.'),
      );
    }
    const availability = await this.dependencies.checkAvailability(record.assignment.runtimeId);
    if (!availability.usable) {
      return commentTaskFailure(
        requestId,
        'comment-task/retry',
        commentTaskError('runtime-unavailable', availability.message ?? 'That agent is not ready yet.', availability.recovery),
      );
    }

    let retried = await this.dependencies.store.retry(taskId, this.randomId());

    const dispatch = async (
      record: CommentTaskRecordV1,
      newConversation?: { title: string; conversationId: string },
    ): Promise<CommentTaskEnqueueOutcome> => {
      const settings = this.dependencies.runtimeSettings(record.destination.conversationId, record.assignment.runtimeId);
      return enqueueOutcome(await this.dependencies.enqueue({
        type: 'comment-task/enqueue',
        taskId: record.taskId,
        conversationId: record.destination.conversationId,
        conversationTurnId: record.turn.conversationTurnId,
        runtimeId: record.assignment.runtimeId as CommentTaskEnqueueMessage['runtimeId'],
        prompt: record.prompt.text,
        displayText: record.comments.map((comment) => comment.instruction).join('\n'),
        modelId: settings.modelId,
        autonomy: settings.approvalMode,
        thinkingEffort: settings.thinkingEffort,
        sourceDisplayPath: document?.displayPath ?? record.source.displayPath,
        ...(newConversation ? { newConversation } : {}),
      }));
    };

    let outcome = await dispatch(retried);

    // The conversation a task was bound to can be gone by the time the user
    // retries: Ritemark restarted, or they deleted it. Failing forever with
    // "that conversation is no longer available" leaves a comment that can
    // never be run again. A retry is an explicit user action, so it follows the
    // same rule as a fresh send and goes to the conversation open in the
    // sidebar. A task that is merely RUNNING still never retargets (R3) — only
    // this deliberate second attempt does.
    //
    // Sprint 155: retry keeps the card's own chat (above). Only when that chat
    // is gone do the three rules pick again — the document's chat, the open
    // chat, or a new one — as a fresh send would.
    if (outcome === 'no-conversation') {
      const goneChat = retried.destination.conversationId;
      const routed = await this.resolveDestination(
        retried.assignment.runtimeId,
        document ?? this.documentOf(retried),
        retried.comments.map((comment) => comment.instruction).join(' '),
        false,
        { taskId: retried.taskId, conversationId: goneChat },
      );
      const fallback = routed && routed.destination.conversationId !== goneChat ? routed : null;
      if (fallback && !fallback.isOpen && this.dependencies.canAttach
        && !(await this.dependencies.canAttach(fallback.newChat ? null : fallback.destination.conversationId))) {
        const error = commentTaskError('capacity', CAPACITY_MESSAGE);
        await this.transitionQuietly(retried.taskId, retried.bindingGeneration, {
          state: 'failed',
          since: this.timestamp(),
          safeMessage: error.message.slice(0, MAX_SAFE_MESSAGE_CHARS),
        });
        await this.publish(retried.source.documentUri);
        return commentTaskFailure(requestId, 'comment-task/retry', error);
      }
      if (fallback) {
        retried = await this.dependencies.store.rebindDestination(retried.taskId, {
          conversationId: fallback.destination.conversationId,
          bindingGeneration: fallback.destination.bindingGeneration,
          title: fallback.destination.title,
        });
        outcome = await dispatch(
          retried,
          fallback.newChat
            ? { title: fallback.destination.title, conversationId: fallback.destination.conversationId }
            : undefined,
        );
        if (outcome === 'queued' && !fallback.isOpen) {
          this.dependencies.notifySent?.(sentToastText({ newChat: fallback.newChat, title: fallback.destination.title }));
        }
      }
    }

    if (outcome !== 'queued') {
      const error =
        outcome === 'full'
          ? commentTaskError('queue-full', 'That conversation already has ten prompts waiting.')
          : commentTaskError('destination-not-found', 'That conversation is no longer available.');
      await this.transitionQuietly(retried.taskId, retried.bindingGeneration, {
        state: 'failed',
        since: this.timestamp(),
        safeMessage: error.message.slice(0, MAX_SAFE_MESSAGE_CHARS),
      });
      await this.publish(retried.source.documentUri);
      return commentTaskFailure(requestId, 'comment-task/retry', error);
    }

    await this.dependencies.store.transition(retried.taskId, retried.bindingGeneration, {
      state: 'queued',
      since: this.timestamp(),
    });
    await this.publish(retried.source.documentUri);
    return commentTaskSuccess(requestId, 'comment-task/retry', { taskId });
  }

  private async cancel(requestId: string, taskId: string): Promise<CommentTaskResultMessage> {
    const record = await this.dependencies.store.get(taskId);
    if (!record) {
      return commentTaskFailure(
        requestId,
        'comment-task/cancel',
        commentTaskError('unknown-task', 'That task no longer exists.'),
      );
    }
    if (record.lifecycle.state === 'running' || record.lifecycle.state === 'needs-user') {
      await this.dependencies.cancelTurn?.(record.destination.conversationId, record.turn.conversationTurnId);
    }
    await this.transitionQuietly(taskId, record.bindingGeneration, {
      state: 'cancelled',
      since: this.timestamp(),
    });
    await this.publish(record.source.documentUri);
    return commentTaskSuccess(requestId, 'comment-task/cancel', { taskId });
  }

  // ── Lifecycle from runtime facts (D7) ──────────────────────────────────────

  /** The sidebar could not queue an accepted task after all. */
  async applyEnqueueOutcome(taskId: string, outcome: CommentTaskEnqueueOutcome): Promise<void> {
    if (outcome === 'queued') return;
    const record = await this.dependencies.store.get(taskId);
    if (!record) return;
    await this.transitionQuietly(taskId, record.bindingGeneration, {
      state: 'failed',
      since: this.timestamp(),
      safeMessage:
        outcome === 'full'
          ? 'That conversation already has ten prompts waiting.'
          : 'That conversation is no longer available.',
    });
    await this.publish(record.source.documentUri);
  }

  /** The user removed a queued item from the sidebar. */
  async applyDequeued(taskId: string): Promise<void> {
    const record = await this.dependencies.store.get(taskId);
    if (!record || record.lifecycle.state !== 'queued') return;
    await this.transitionQuietly(taskId, record.bindingGeneration, {
      state: 'cancelled',
      since: this.timestamp(),
    });
    await this.publish(record.source.documentUri);
  }

  /**
   * Sprint 130 (G6): the sidebar could not dispatch the queued turn at all
   * (its message threw). Without this the comment said Queued forever.
   */
  async applyDispatchFailed(taskId: string, message: string): Promise<void> {
    const record = await this.dependencies.store.get(taskId);
    if (!record || (record.lifecycle.state !== 'accepting' && record.lifecycle.state !== 'queued')) return;
    await this.transitionQuietly(taskId, record.bindingGeneration, {
      state: 'failed',
      since: this.timestamp(),
      safeMessage: safeFailureMessage(message),
    });
    await this.publish(record.source.documentUri);
  }

  async applyTurnStarted(conversationId: string, conversationTurnId: string): Promise<void> {
    await this.applyTurnEvent(conversationId, conversationTurnId, () => ({
      state: 'running',
      since: this.timestamp(),
    }), true);
  }

  async applyTurnAttention(
    conversationId: string,
    conversationTurnId: string,
    attentionKind: CommentTaskAttentionKind,
  ): Promise<void> {
    await this.applyTurnEvent(conversationId, conversationTurnId, () => ({
      state: 'needs-user',
      since: this.timestamp(),
      attentionKind,
    }));
  }

  /**
   * A turn reached its end. `status` is the runtime's own verdict AFTER cancel
   * normalisation, which is why a cancelled turn lands on `cancelled` here
   * rather than being folded into completed or failed (audit F24).
   */
  async applyTurnTerminal(
    conversationId: string,
    conversationTurnId: string,
    outcome: {
      status: 'completed' | 'failed' | 'cancelled' | 'interrupted';
      text?: string;
      error?: string;
      terminalEventId?: string;
      interruptReason?: CommentTaskInterruptReason;
    },
  ): Promise<void> {
    await this.applyTurnEvent(conversationId, conversationTurnId, () => {
      const since = this.timestamp();
      switch (outcome.status) {
        case 'completed':
          return {
            state: 'completed',
            since,
            terminalEventId: outcome.terminalEventId ?? conversationTurnId,
            summary: summarizeTerminalText(outcome.text ?? ''),
          };
        case 'cancelled':
          return { state: 'cancelled', since };
        case 'interrupted':
          return { state: 'interrupted', since, reason: outcome.interruptReason ?? 'runtime-exited' };
        default:
          return {
            state: 'failed',
            since,
            safeMessage: safeFailureMessage(outcome.error),
          };
      }
    });
  }

  /**
   * Startup sweep: anything left mid-flight by a crash or a quit becomes
   * `interrupted`, which the comment shows with a Retry. The alternative is a
   * comment that says "working" forever.
   */
  async recoverUnfinished(): Promise<number> {
    const unfinished = await this.dependencies.store.listUnfinished();
    const documents = new Set<string>();
    for (const record of unfinished) {
      await this.transitionQuietly(record.taskId, record.bindingGeneration, {
        state: 'interrupted',
        since: this.timestamp(),
        reason: 'restart',
      });
      documents.add(record.source.documentUri);
    }
    for (const documentUri of documents) await this.publish(documentUri);
    return unfinished.length;
  }

  /**
   * Activation sweep: recover abandoned work, then apply retention (D4).
   * Without retention the store grows without bound, and every lookup rereads
   * every record ever written. Retention never sweeps unfinished work, so a
   * task left running months ago is recovered, not lost. A failure in one step
   * does not skip the other, and neither throws: a missed sweep costs disk,
   * not activation.
   */
  async sweepOnActivation(warn: (message: string, error: unknown) => void): Promise<void> {
    try {
      await this.recoverUnfinished();
    } catch (error) {
      warn('Could not recover unfinished tasks:', error);
    }
    try {
      await this.dependencies.store.prune();
    } catch (error) {
      warn('Could not prune finished tasks:', error);
    }
  }

  /** Push one document's snapshot to its editors. Called when an editor becomes
   *  ready and after every change to a task bound to that document. */
  async publish(documentUri: string): Promise<void> {
    const records = await this.dependencies.store.listForDocument(documentUri);
    this.dependencies.publishProjection(documentUri, records.map(projectCommentTask));
  }

  private async applyTurnEvent(
    conversationId: string,
    conversationTurnId: string,
    lifecycle: () => CommentTaskLifecycleV1,
    started = false,
  ): Promise<void> {
    const record = await this.dependencies.store.findByTurn(conversationTurnId);
    // No task owns this turn: it is an ordinary Composer turn. Doing nothing is
    // the whole fix for the bulk finalization bug (audit F22).
    if (!record) return;

    // Sprint 155: a chat made for this comment gets the comment's name once its
    // record exists (its first turn), as a card's chat gets the card's title.
    // A rename always wins over the AI's title. Only the first attempt names it.
    if (started && record.destination.created && record.destination.titleSnapshot
      && record.bindingGeneration === 1
      && (record.lifecycle.state === 'accepting' || record.lifecycle.state === 'queued')) {
      await this.dependencies.setConversationTitle?.(conversationId, record.destination.titleSnapshot).catch(() => undefined);
    }

    // The conversation a task was accepted into can be renamed by the store:
    // the sidebar hands us the client-side id of a conversation it just made,
    // and the conversation store mints the canonical one on the first accepted
    // turn. The turn id proves this is the same work, so follow it.
    if (record.destination.conversationId !== conversationId) {
      const title = await this.dependencies.conversationTitle?.(conversationId);
      await this.dependencies.store
        .rebindDestination(record.taskId, {
          conversationId,
          bindingGeneration: record.destination.bindingGeneration,
          ...(title ? { title } : {}),
        })
        .catch(() => undefined);
    }

    await this.transitionQuietly(record.taskId, record.bindingGeneration, lifecycle());
    await this.publish(record.source.documentUri);
  }

  /**
   * Apply a transition, swallowing the two rejections that are normal traffic
   * rather than bugs: an event for a previous attempt, and an event that would
   * move a task backwards out of a terminal state. Both mean "this news is
   * stale", and the current state is already correct.
   */
  private async transitionQuietly(
    taskId: string,
    bindingGeneration: number,
    lifecycle: CommentTaskLifecycleV1,
  ): Promise<void> {
    try {
      await this.dependencies.store.transition(taskId, bindingGeneration, lifecycle);
    } catch (error) {
      if (
        error instanceof CommentTaskStoreError &&
        (error.code === 'stale-generation' || error.code === 'illegal-transition' || error.code === 'not-found')
      ) {
        return;
      }
      throw error;
    }
  }

  /** Both carriers write the id as an HTML attribute or an `{id:…}` token, so
   *  one containment check covers anchored marks and standalone notes. */
  private documentContainsComment(text: string, commentId: string): boolean {
    return text.includes(`data-comment-id="${commentId}"`) || text.includes(`{id:${commentId}}`);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  /** Sprint 155: a new chat's id, chosen here so a second comment can find the first one's chat. */
  private newConversationId(): string {
    return randomUUID();
  }

  /** Sprint 155: the task's document as the routing needs it, when no editor sent it. */
  private documentOf(record: CommentTaskRecordV1): CommentTaskDocument {
    return {
      uri: record.source.documentUri,
      scopeId: record.source.scopeId,
      scope: record.source.scope,
      displayPath: record.source.displayPath,
      version: record.source.documentVersion,
      text: '',
    };
  }
}

/** Sprint 155: the card's words when five chats are already working (CardHandoffLedger). */
const CAPACITY_MESSAGE = 'Five conversations are already working or waiting for you.';

function enqueueOutcome(
  answer: CommentTaskEnqueueOutcome | { outcome: CommentTaskEnqueueOutcome; conversationId?: string },
): CommentTaskEnqueueOutcome {
  return typeof answer === 'string' ? answer : answer.outcome;
}
