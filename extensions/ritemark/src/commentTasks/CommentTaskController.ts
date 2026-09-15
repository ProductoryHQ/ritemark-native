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

import { createHash } from 'crypto';
import type { ProjectScopeDescriptorV1 } from '../conversations/types';
import { CommentTaskStore, CommentTaskStoreError } from './CommentTaskStore';
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
  /** Normalized runtime availability — the same policy the Composer uses, so
   *  the comment path cannot invent a stricter or looser gate (audit F19). */
  checkAvailability(runtimeId: string): Promise<CommentTaskAvailability>;
  /** Frozen per-turn settings for the destination conversation. */
  runtimeSettings(conversationId: string, runtimeId: string): CommentTaskRuntimeSettings;
  /** One prompt builder for both surfaces, given the REAL document label. */
  buildPrompt(document: CommentTaskDocument, comments: CommentTaskCommentV1[]): string;
  /** Hand the accepted task to the sidebar queue and wait for its verdict. */
  enqueue(message: CommentTaskEnqueueMessage): Promise<CommentTaskEnqueueOutcome>;
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
          return await this.previewDestination(request.requestId);
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

    const destination = await this.dependencies.resolveOpenConversation(runtimeId);
    if (!destination) {
      return reject(commentTaskError('sidebar-unreachable', 'The AI sidebar is not responding. Try again.'));
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

    const outcome = await this.dependencies.enqueue({
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
    });

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

  /** The caption on the Send surface: which conversation is open right now. */
  private async previewDestination(requestId: string): Promise<CommentTaskResultMessage> {
    const destination = await this.dependencies.resolveOpenConversation('claude-code').catch(() => null);
    return commentTaskSuccess(requestId, 'comment-task/destination-preview', {
      runtimeId: destination?.runtimeId ?? null,
      conversationId: destination?.conversationId ?? null,
      title: destination?.title ?? null,
    });
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

    const dispatch = async (record: CommentTaskRecordV1): Promise<CommentTaskEnqueueOutcome> => {
      const settings = this.dependencies.runtimeSettings(record.destination.conversationId, record.assignment.runtimeId);
      return this.dependencies.enqueue({
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
      });
    };

    let outcome = await dispatch(retried);

    // The conversation a task was bound to can be gone by the time the user
    // retries: Ritemark restarted, or they deleted it. Failing forever with
    // "that conversation is no longer available" leaves a comment that can
    // never be run again. A retry is an explicit user action, so it follows the
    // same rule as a fresh send and goes to the conversation open in the
    // sidebar. A task that is merely RUNNING still never retargets (R3) — only
    // this deliberate second attempt does.
    if (outcome === 'no-conversation') {
      const fallback = await this.dependencies.resolveOpenConversation(retried.assignment.runtimeId);
      if (fallback) {
        retried = await this.dependencies.store.rebindDestination(retried.taskId, {
          conversationId: fallback.conversationId,
          bindingGeneration: fallback.bindingGeneration,
          title: fallback.title,
        });
        outcome = await dispatch(retried);
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

  async applyTurnStarted(conversationId: string, conversationTurnId: string): Promise<void> {
    await this.applyTurnEvent(conversationId, conversationTurnId, () => ({
      state: 'running',
      since: this.timestamp(),
    }));
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
  ): Promise<void> {
    const record = await this.dependencies.store.findByTurn(conversationTurnId);
    // No task owns this turn: it is an ordinary Composer turn. Doing nothing is
    // the whole fix for the bulk finalization bug (audit F22).
    if (!record) return;

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
}
