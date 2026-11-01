import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  isDocumentViewMessage,
  parseDocumentViewMessage,
  type DocumentEditPayload,
  type DocumentConflictReason,
  type DocumentParagraphConflict,
  type DocumentHostMessage,
  type DocumentRenderPayload,
  type DocumentSyncBootstrap,
  type DocumentSyncState,
  type DocumentUpdateReason,
  type DocumentViewMessage,
} from './protocol';
import { DocumentDeliverySchedule } from './delivery';
import { readRitemarkSavedLogicalHash } from './saveReceipt';
import { findBase, mergeBlocks, type BlockConflict, type BlockKind } from './merge';
import {
  canCompleteViewResolution,
  canonicalJson,
  classifyAcceptedModelEdit,
  classifyRefusedSave,
  classifyStaleViewEdit,
  classifyThreeWay,
  droppedRecentSave,
  encodeDocumentText,
  initializeThreeWayState,
  normalizeLogicalText,
  observeLocalSaveReceipts,
  STALE_WRITE_WINDOW_MS,
  type LocalSaveReceipt,
  type RecentSave,
} from './state';

const POLL_INTERVAL_MS = 3000;

/**
 * Sprint 145 R1 (#588): the stale-write guard keeps the texts of a document's
 * last few states and saves. A document longer than this runs without the
 * guard (as 2.1 did), and the sync log says so once.
 */
const STALE_WRITE_GUARD_MAX_CHARS = 1_000_000;
/** Model states kept between saves, so a save's receipt finds its text when typing outruns the sync. */
const RECENT_MODEL_TEXTS = 8;
/**
 * Saves kept for the guard: those within `STALE_WRITE_WINDOW_MS`, at most this many and about this many
 * characters; beyond that the oldest saves inside the window are merged, so their words stay guarded.
 */
const RECENT_SAVES = 40;
const RECENT_SAVES_CHARS = 8_000_000;
/**
 * Sprint 145 R1 (revised 1 November): how long a save stays a possible base for a merge. A merge asks nothing, so
 * an older base is no risk; the 30 s window (`STALE_WRITE_WINDOW_MS`) is only the fallback question's.
 */
const BASE_MEMORY_MS = 10 * 60_000;

/**
 * Sprint 145 R1 (#588): VS Code asks this before it reloads a clean document Ritemark's editor holds (patch 014's
 * reload participant), passing the text it read. The answer is the text the document takes: a merge, or the
 * person's text for the fallback question; `undefined` means VS Code's own reload. Internal: not in package.json.
 */
export const ANSWER_RELOAD_COMMAND = '_ritemark.editorSync.answerReload';
/** As `ANSWER_SAVE_CONFLICT_BUDGET_MS`: a little under the shell's 3 s, after which VS Code reloads by itself. */
const ANSWER_RELOAD_BUDGET_MS = 2500;

/**
 * Sprint 137 (#454): VS Code's save-error handler hands a save it refused as
 * "newer" to this command when Ritemark's editor holds the document (patch
 * 014). Internal: not in package.json, never in the palette.
 */
export const ANSWER_SAVE_CONFLICT_COMMAND = '_ritemark.editorSync.answerSaveConflict';

/**
 * The answer to a refused save. `overwrite`: nobody else changed the text, so
 * the shell saves the person's text over the file. `handled`: a real conflict,
 * and Ritemark's Review changes asks. `false`: Ritemark can't answer, and VS
 * Code's own notification shows.
 */
export type SaveConflictAnswer = 'overwrite' | 'handled' | false;

/**
 * The most a refused save waits for Ritemark's answer. The shell waits 3 s
 * (patch 014's `RITEMARK_ANSWER_TIMEOUT_MS`) and then shows VS Code's own
 * notification; answering `false` a little before that keeps the two from
 * both asking, and a late decision then does nothing the watcher won't.
 */
const ANSWER_SAVE_CONFLICT_BUDGET_MS = 2500;

type UpdateMessage = Extract<DocumentHostMessage, { type: 'document:update' }>;
type EditMessage = Extract<DocumentViewMessage, { type: 'document:edit' }>;
type ConflictActionMessage = Extract<DocumentViewMessage, { type: 'document:conflict-action' }>;
type ParagraphActionMessage = Extract<DocumentViewMessage, { type: 'document:paragraph-action' }>;

/** What to do with a writer's copy (#588): take it, merge it with the person's text, or hold it and ask. */
type CopyDecision =
  | { action: 'import' }
  | { action: 'merge'; text: string; conflicts: BlockConflict[]; taken: number }
  | { action: 'hold'; lost: number };

export interface DocumentSyncAdapter {
  buildPayload(document: vscode.TextDocument, webview: vscode.Webview): DocumentRenderPayload;
  serializeEdit(document: vscode.TextDocument, payload: DocumentEditPayload): string;
}

interface DiskSnapshot {
  bytes: Buffer;
  content: string;
  validator: string;
  logicalHash: string;
  hasUtf8Bom: boolean;
}

interface ConflictSnapshot {
  revision: number;
  diskValidator: string;
  diskHash: string;
  diskContent: string;
  localContent: string;
  /**
   * `held-import` (Sprint 145 R1, #588): a writer's copy that left out words
   * Ritemark had just saved. The person's words were put back in the document,
   * so the file may hold them by now; `diskContent` is the writer's copy, which
   * Use disk version writes back.
   */
  reason?: DocumentConflictReason;
  /** The writer's copy as it was on disk, byte for byte (held imports only): Use disk version writes it back. */
  diskBytes?: Uint8Array;
}

/** One of Ritemark's own saves, as the stale-write guard remembers it (#588). */
interface RememberedSave extends RecentSave {
  hash: string;
}

interface PendingDelivery {
  message: UpdateMessage;
  /** The document's text this delivery shows (#588: once acknowledged, the view's own text). */
  text: string;
  schedule?: DocumentDeliverySchedule;
  startedAt: number;
}

interface ViewLease {
  webview: vscode.Webview;
  panel: vscode.WebviewPanel;
  epoch: string;
  acknowledgedRevision: number;
  lastClientSequence: number;
  pending?: PendingDelivery;
  applyError: boolean;
  disposed: boolean;
  /**
   * #588 (revised): the document's text as this view shows it: its last accepted edit, or the last update it
   * acknowledged. An edit from a view that hasn't caught up with the document is put on top of it, not over it.
   */
  ownText?: string;
}

interface DocumentRecord {
  uri: string;
  document: vscode.TextDocument;
  sessionId: string;
  revision: number;
  modelHash: string;
  baseModelHash: string;
  baseDiskHash: string;
  baseDiskLogicalHash: string;
  lastObservedDiskValidator: string;
  state: Exclude<DocumentSyncState, 'applying' | 'apply-error' | 'failed'>;
  conflict?: ConflictSnapshot;
  resolutionRevision?: number;
  conflictSequence: number;
  localSaveSequence: number;
  pendingLocalSaveReceipts: LocalSaveReceipt[];
  /** #588: the document's recent texts, newest last, taken in the change event. */
  recentTexts: string[];
  /** #588: Ritemark's own recent saves of the document, newest last. */
  recentSaves: RememberedSave[];
  /** #588: the text Ritemark last knew to be on disk: its last save, or what it last read or imported. */
  lastKnownDiskText: string;
  /** #588: a `converged` disk that may be Ritemark's own save whose receipt hasn't arrived, and the text before it. */
  convergedBeforeReceipt?: { hash: string; previousText: string };
  /** #588: the document is too long for the guard; it runs as 2.1 did. */
  guardOff?: boolean;
  /**
   * #588 (revised): Ritemark answered a writer's copy with this merge; the change event that brings it is Ritemark's.
   * Its places both changed join Review changes only then: VS Code drops the answer when the person typed meanwhile.
   */
  pendingMerge?: { diskHash: string; mergedHash: string; conflicts: readonly BlockConflict[] };
  /** #588 (revised): places both the person and a writer changed; the person's text is in the document. */
  paragraphs: DocumentParagraphConflict[];
  paragraphSequence: number;
  /** The paragraph sequence Ritemark's notification last named, so one merge asks once. */
  notifiedParagraphs?: number;
  views: Map<string, ViewLease>;
  panels: Map<vscode.Webview, vscode.WebviewPanel>;
  watcher?: vscode.FileSystemWatcher;
  poll?: NodeJS.Timeout;
  /** The conflict Ritemark's notification last named, so one conflict asks once (#454). */
  notifiedConflictRevision?: number;
  queue: Promise<void>;
  disposed: boolean;
  lastLogSignature?: string;
}

export class DocumentSyncCoordinator implements vscode.Disposable {
  private readonly records = new Map<string, DocumentRecord>();
  private readonly virtualDocuments = new Map<string, string>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    context: vscode.ExtensionContext,
    private readonly adapter: DocumentSyncAdapter,
  ) {
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(document => {
        const record = this.records.get(document.uri.toString());
        if (!record) return;
        // A successful save is the only authoritative local-write receipt.
        // The shell binds this hash to the exact snapshot handed to write();
        // neither the live model nor a later path read can prove that identity.
        const saveHash = readRitemarkSavedLogicalHash(document);
        if (saveHash) {
          this.rememberSave(record, saveHash);
          this.recordLocalSaveHash(record, saveHash);
        }
        this.enqueue(record, () => this.reconcile(record, 'save-complete'));
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        const record = this.records.get(event.document.uri.toString());
        if (!record) return;
        // Synchronously, so no state is missed when typing outruns the queue (#588). A change event with no
        // content change (the document turning clean or dirty) adds no state.
        if (event.contentChanges.length !== 0) this.rememberModelText(record);
        this.enqueue(record, () => this.reconcile(record, 'model-change'));
      }),
      vscode.workspace.registerTextDocumentContentProvider('ritemark-sync', {
        provideTextDocumentContent: uri => this.virtualDocuments.get(uri.toString()) ?? '',
      }),
      vscode.commands.registerCommand(ANSWER_SAVE_CONFLICT_COMMAND, (uri: unknown) => this.answerSaveConflict(uri)),
      vscode.commands.registerCommand(ANSWER_RELOAD_COMMAND, (uri: unknown, diskText: unknown) => this.answerReload(uri, diskText)),
    );
    context.subscriptions.push(this);
  }

  prepareView(document: vscode.TextDocument, panel: vscode.WebviewPanel): Omit<DocumentSyncBootstrap, 'viewEpoch'> | undefined {
    if (!this.isEditable(document)) return undefined;
    const record = this.ensureRecord(document);
    record.panels.set(panel.webview, panel);
    this.startResources(record);
    this.enqueue(record, () => this.reconcile(record, 'open'));
    panel.onDidChangeViewState(event => {
      const view = this.findViewByWebview(record, event.webviewPanel.webview);
      if (view && event.webviewPanel.visible) {
        this.enqueue(record, async () => {
          await this.sendCurrent(record, view, 'open');
          if (record.conflict) this.sendConflict(record, view);
          if (record.paragraphs.length) this.sendParagraphs(record, view);
        });
      }
    });
    return { uri: record.uri, documentSessionId: record.sessionId };
  }

  handles(value: unknown): boolean {
    return isDocumentViewMessage(value);
  }

  handle(document: vscode.TextDocument, webview: vscode.Webview, value: unknown): void {
    const record = this.records.get(document.uri.toString());
    if (!record) return;
    let message: DocumentViewMessage;
    try {
      message = parseDocumentViewMessage(value);
    } catch (error) {
      console.warn('[EditorSync] rejected malformed message', error instanceof Error ? error.message : String(error));
      return;
    }
    if (message.uri !== record.uri || message.documentSessionId !== record.sessionId) {
      console.warn('[EditorSync] rejected cross-session message');
      return;
    }

    this.enqueue(record, async () => {
      if (message.type === 'document:ready') {
        await this.ready(record, webview, message.viewEpoch);
        return;
      }
      const view = record.views.get(message.viewEpoch);
      if (!view || view.webview !== webview || view.disposed) return;
      if (message.type === 'document:applied') {
        this.applied(record, view, message.revision, message.payloadHash);
      } else if (message.type === 'document:edit') {
        await this.edit(record, view, message);
      } else if (message.type === 'document:paragraph-action') {
        await this.paragraphAction(record, view, message);
      } else {
        await this.conflictAction(record, view, message);
      }
    });
  }

  disposeView(document: vscode.TextDocument, webview: vscode.Webview): void {
    const record = this.records.get(document.uri.toString());
    if (!record) return;
    record.panels.delete(webview);
    const view = this.findViewByWebview(record, webview);
    if (view) {
      view.disposed = true;
      this.clearPending(view);
      record.views.delete(view.epoch);
    }
    this.maybeCompleteResolution(record);
    if (record.panels.size === 0) this.disposeRecord(record);
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    for (const record of this.records.values()) this.disposeRecord(record);
    this.records.clear();
    this.virtualDocuments.clear();
  }

  private ensureRecord(document: vscode.TextDocument): DocumentRecord {
    const uri = document.uri.toString();
    const existing = this.records.get(uri);
    if (existing) return existing;
    const disk = this.readDiskSync(document);
    const modelHash = logicalHash(document.getText());
    const initial = initializeThreeWayState(disk.logicalHash, modelHash, document.isDirty);
    const record: DocumentRecord = {
      uri,
      document,
      sessionId: crypto.randomUUID(),
      revision: 1,
      modelHash,
      baseModelHash: initial.baseModelHash,
      baseDiskHash: disk.validator,
      baseDiskLogicalHash: initial.baseDiskLogicalHash,
      lastObservedDiskValidator: disk.validator,
      state: initial.state,
      conflictSequence: 0,
      localSaveSequence: 0,
      pendingLocalSaveReceipts: [],
      recentTexts: [],
      recentSaves: [],
      lastKnownDiskText: disk.content,
      paragraphs: [],
      paragraphSequence: 0,
      views: new Map(),
      panels: new Map(),
      queue: Promise.resolve(),
      disposed: false,
    };
    this.records.set(uri, record);
    return record;
  }

  private async ready(record: DocumentRecord, webview: vscode.Webview, epoch: string): Promise<void> {
    const panel = record.panels.get(webview);
    if (!panel) return;
    const previous = record.views.get(epoch);
    if (previous && previous.webview !== webview) return;
    const oldForWebview = this.findViewByWebview(record, webview);
    if (oldForWebview && oldForWebview.epoch !== epoch) {
      oldForWebview.disposed = true;
      this.clearPending(oldForWebview);
      record.views.delete(oldForWebview.epoch);
    }
    const view: ViewLease = previous ?? {
      webview,
      panel,
      epoch,
      acknowledgedRevision: 0,
      lastClientSequence: 0,
      applyError: false,
      disposed: false,
    };
    view.disposed = false;
    view.panel = panel;
    record.views.set(epoch, view);
    await this.sendCurrent(record, view, 'open');
    if (record.conflict) this.sendConflict(record, view);
    if (record.paragraphs.length) this.sendParagraphs(record, view);
  }

  private applied(record: DocumentRecord, view: ViewLease, revision: number, payloadHash: string): void {
    const pending = view.pending;
    if (!pending || pending.message.revision !== revision || pending.message.payloadHash !== payloadHash) return;
    if (pending.schedule && !pending.schedule.acknowledge({ revision, payloadHash })) return;
    const elapsed = Date.now() - pending.startedAt;
    this.clearPending(view);
    view.applyError = false;
    view.acknowledgedRevision = revision;
    view.ownText = pending.text;
    if (!this.maybeCompleteResolution(record)) this.sendState(record, view);
    this.logDelivery(record, view, 'ack', revision, undefined, elapsed);
  }

  private async edit(record: DocumentRecord, source: ViewLease, message: EditMessage): Promise<void> {
    if (message.clientSequence <= source.lastClientSequence) {
      this.sendEditResult(record, source, message.clientSequence, 'stale', 'This edit sequence was already handled.');
      return;
    }
    source.lastClientSequence = message.clientSequence;
    let fullContent: string;
    try {
      fullContent = this.adapter.serializeEdit(record.document, message.payload);
    } catch (error) {
      this.sendEditResult(record, source, message.clientSequence, 'rejected', error instanceof Error ? error.message : 'Invalid edit payload.');
      return;
    }
    let nextHash = logicalHash(fullContent);
    // #588 (revised): the document moved on since this view last showed it (a writer's copy merged in while the
    // person typed, or another view's edit): put this view's change on top of the document instead of over it.
    // The person's blocks win where both changed. The view shows its own text until it applies the result.
    const viewText = fullContent;
    const own = source.ownText;
    let rebased = false;
    if (own !== undefined) {
      const current = record.document.getText();
      const ownHash = logicalHash(own);
      const currentHash = logicalHash(current);
      if (ownHash !== currentHash && nextHash !== currentHash && ownHash !== nextHash) {
        const result = mergeBlocks(own, fullContent, current, this.blockKind(record.document), current.includes('\r\n') ? '\r\n' : '\n');
        this.addParagraphs(record, result.conflicts);
        fullContent = result.text;
        nextHash = logicalHash(fullContent);
        rebased = true;
      }
    }
    source.ownText = viewText;
    if (!rebased && message.basedOnRevision !== record.revision) {
      await this.handleStaleEdit(record, source, message.clientSequence, fullContent, nextHash);
      return;
    }
    if (nextHash !== record.modelHash) {
      const applied = await this.applyText(record.document, fullContent);
      if (applied === 'stale') {
        record.modelHash = logicalHash(record.document.getText());
        record.revision += 1;
        this.sendEditResult(record, source, message.clientSequence, 'stale', 'The document changed while this edit was applying.');
        await this.reconcile(record, 'edit-superseded');
        return;
      }
      if (applied === 'rejected') {
        this.sendEditResult(record, source, message.clientSequence, 'rejected', 'VS Code rejected the document edit.');
        return;
      }
      record.modelHash = logicalHash(record.document.getText());
      record.revision += 1;
    }
    const acceptedState = classifyAcceptedModelEdit(
      record.baseModelHash,
      record.modelHash,
      !!record.conflict,
      record.resolutionRevision !== undefined,
    );
    if (acceptedState === 'conflict' && record.conflict) {
      record.conflictSequence += 1;
      record.conflict = {
        ...record.conflict,
        revision: record.conflictSequence,
        localContent: record.document.getText(),
      };
      record.state = 'conflict';
    } else {
      // Typing after an explicit resolution cancels its pending visual receipt
      // and starts a new local edit from the now-confirmed disk/model base.
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = acceptedState;
    }
    const payloadHash = payloadHashFor(this.adapter.buildPayload(record.document, source.webview));
    this.sendEditResult(record, source, message.clientSequence, 'accepted', undefined, payloadHash);
    if (record.conflict) {
      for (const target of record.views.values()) this.sendConflict(record, target);
    }
    await this.broadcast(record, 'peer-edit');
    if (record.conflict) this.sendAllStates(record);
    if (this.pruneParagraphs(record)) this.sendParagraphs(record);
    this.log(record, 'webview-edit');
  }

  private async handleStaleEdit(
    record: DocumentRecord,
    source: ViewLease,
    clientSequence: number,
    fullContent: string,
    nextHash: string,
  ): Promise<void> {
    const disk = await this.readDisk(record.document);
    const modelHash = logicalHash(record.document.getText());
    const disposition = classifyStaleViewEdit(modelHash, disk?.logicalHash, nextHash);

    if (disposition === 'already-current') {
      record.modelHash = modelHash;
      const payloadHash = payloadHashFor(this.adapter.buildPayload(record.document, source.webview));
      this.sendEditResult(record, source, clientSequence, 'accepted', undefined, payloadHash);
      await this.sendCurrent(record, source, 'peer-edit');
      return;
    }

    if (disposition === 'reject' || !disk) {
      // Never replay a stale full-document payload on top of a newer dirty
      // model: that can erase a peer edit. Keep the optimistic source view
      // intact and expose a recoverable error instead of pushing the newer
      // model over it automatically.
      this.sendEditResult(
        record,
        source,
        clientSequence,
        'rejected',
        'The document changed in another editor before this edit arrived. Your visible edit was not overwritten.',
      );
      return;
    }

    const applied = await this.applyText(record.document, fullContent, {
      version: record.document.version,
      logicalHash: modelHash,
    });
    if (applied !== 'applied') {
      this.sendEditResult(
        record,
        source,
        clientSequence,
        applied === 'stale' ? 'stale' : 'rejected',
        applied === 'stale'
          ? 'The document advanced again while preserving this edit.'
          : 'VS Code rejected the stale document edit.',
      );
      return;
    }

    record.modelHash = logicalHash(record.document.getText());
    record.revision += 1;
    record.conflictSequence += 1;
    record.conflict = {
      revision: record.conflictSequence,
      diskValidator: disk.validator,
      diskHash: disk.logicalHash,
      diskContent: disk.content,
      localContent: record.document.getText(),
    };
    record.resolutionRevision = undefined;
    record.state = 'conflict';
    const payloadHash = payloadHashFor(this.adapter.buildPayload(record.document, source.webview));
    this.sendEditResult(record, source, clientSequence, 'accepted', undefined, payloadHash);
    for (const target of record.views.values()) this.sendConflict(record, target);
    await this.broadcast(record, 'peer-edit');
    this.sendAllStates(record);
    this.log(record, 'stale-view-edit:conflict');
  }

  private async conflictAction(record: DocumentRecord, view: ViewLease, message: ConflictActionMessage): Promise<void> {
    if (message.action === 'retry-apply') {
      view.applyError = false;
      await this.sendCurrent(record, view, 'revert');
      return;
    }
    const conflict = record.conflict;
    if (!conflict || conflict.revision !== message.conflictRevision || conflict.diskValidator !== message.diskHash) return;
    if (message.action === 'compare') {
      await this.openDiff(record, conflict);
      return;
    }

    const held = conflict.reason === 'held-import';
    const currentDisk = await this.readDisk(record.document);
    // #588: a held import's file may hold the person's words by now (VS Code saved them back); that is not a
    // new change. Anything else since the question makes it stale.
    const diskKnown = !!currentDisk && (
      currentDisk.validator === conflict.diskValidator
      || (held && (currentDisk.logicalHash === logicalHash(record.document.getText()) || this.isOwnSave(record, currentDisk.logicalHash)))
    );
    if (!currentDisk || !diskKnown) {
      await this.reconcile(record, 'stale-resolution');
      return;
    }
    if (logicalHash(record.document.getText()) !== logicalHash(conflict.localContent)) {
      await this.reconcile(record, 'stale-resolution');
      return;
    }
    if (message.action === 'use-disk') {
      // A held import's disk side is the writer's copy, which the file may no longer hold.
      const target = held ? { content: conflict.diskContent, logicalHash: conflict.diskHash } : currentDisk;
      const applied = await this.applyText(record.document, target.content, {
        version: record.document.version,
        logicalHash: logicalHash(conflict.localContent),
      });
      if (applied === 'stale') {
        await this.reconcile(record, 'stale-resolution');
        return;
      }
      if (applied === 'rejected') {
        this.fail(record, view, 'VS Code rejected the disk version.');
        return;
      }
      // The model now holds the disk text, but VS Code still marks it dirty against the older disk version it
      // saw, so every later save failed as "newer" until Overwrite. A same-content revert refreshes that version
      // and clears the dirty marker, as Keep my version does below; it preserves the undo stack.
      try {
        if (held) {
          // Write the writer's copy back byte for byte, whatever the file holds now (VS Code may have saved the
          // person's words back while this answer waited).
          await vscode.workspace.fs.writeFile(record.document.uri, conflict.diskBytes ?? Buffer.from(conflict.diskContent, 'utf8'));
        }
        view.panel.reveal(view.panel.viewColumn, false);
        await vscode.commands.executeCommand('workbench.action.files.revert');
      } catch (error) {
        this.fail(record, view, error instanceof Error ? error.message : 'Could not use the disk version.');
        return;
      }
      const verifiedDisk = held ? await this.readDisk(record.document) : currentDisk;
      if (record.document.isDirty
        || logicalHash(record.document.getText()) !== target.logicalHash
        || !verifiedDisk
        || verifiedDisk.logicalHash !== target.logicalHash) {
        await this.reconcile(record, 'use-disk-verification');
        return;
      }
      record.modelHash = logicalHash(record.document.getText());
      record.revision += 1;
      this.setBase(record, verifiedDisk, record.modelHash);
      // The person chose the disk's text: the words their earlier saves added no longer count as theirs.
      record.recentSaves = [];
      record.state = 'synced';
      record.resolutionRevision = record.revision;
      await this.broadcast(record, 'resolution');
      this.log(record, 'use-disk');
      return;
    }

    const localContent = record.document.getText();
    const localHash = logicalHash(localContent);
    try {
      // TextDocument.save() intentionally refuses once VS Code has observed a
      // newer disk etag. The user has explicitly chosen Keep my version and we
      // already re-read the exact SHA-256 validator, so write through VS Code's
      // public filesystem API, then force a same-content revert to refresh the
      // text-file model's etag/clean marker. A same-content model resolve is a
      // no-op and preserves the existing undo stack.
      await vscode.workspace.fs.writeFile(
        record.document.uri,
        encodeDocumentBytes(localContent, record.document.eol, currentDisk.hasUtf8Bom),
      );
      const written = await this.readDisk(record.document);
      if (!written || written.logicalHash !== localHash) {
        await this.reconcile(record, 'keep-local-verification');
        return;
      }
      // The revert command operates on the active editor. The conflict action
      // originates from this panel, but an intervening focus change (for
      // example after Compare) may have activated the diff editor instead.
      view.panel.reveal(view.panel.viewColumn, false);
      await vscode.commands.executeCommand('workbench.action.files.revert');
    } catch (error) {
      this.fail(record, view, error instanceof Error ? error.message : 'Could not keep the local version.');
      return;
    }
    const verified = await this.readDisk(record.document);
    if (record.document.isDirty
      || logicalHash(record.document.getText()) !== localHash
      || !verified
      || verified.logicalHash !== localHash) {
      await this.reconcile(record, 'keep-local-verification');
      return;
    }
    this.setBase(record, verified, localHash);
    record.state = 'synced';
    // Keep-local does not change model text, but it is still a new canonical
    // synchronization event. A fresh revision prevents a view's older ACK for
    // identical content from satisfying this resolution receipt.
    record.revision += 1;
    record.resolutionRevision = record.revision;
    await this.broadcast(record, 'resolution');
    this.log(record, 'keep-local');
  }

  /**
   * VS Code refused to save this document as "newer" (#454, R10, R11): decide
   * what that refusal means, so the person gets one question or none.
   */
  private async answerSaveConflict(uriArgument: unknown): Promise<SaveConflictAnswer> {
    const uri = uriArgument instanceof vscode.Uri
      ? uriArgument.toString()
      : typeof uriArgument === 'string' ? uriArgument : undefined;
    const record = uri ? this.records.get(uri) : undefined;
    if (!record || record.disposed || !this.isDiskBacked(record.document)) return false;
    let late = false;
    const answer = this.enqueueResult(record, false, async (): Promise<SaveConflictAnswer> => {
      const disk = await this.readDisk(record.document);
      if (!disk || late) return false;
      const decision = classifyRefusedSave({
        baseDiskLogicalHash: record.baseDiskLogicalHash,
        diskLogicalHash: disk.logicalHash,
        modelLogicalHash: logicalHash(record.document.getText()),
      });
      if (decision === 'converged' || (decision === 'disk-unchanged' && !record.conflict)) {
        // R11: the disk already holds the person's text (S49), or still the
        // text the person started from — a sync client touched it, or rewrote
        // its line endings (S47). The person's save may go through, with no
        // question; its receipt then settles Ritemark's own state.
        this.log(record, `refused-save:${decision}`);
        return 'overwrite';
      }
      // R10: a real conflict. Ritemark's Review changes is the one question.
      await this.reconcile(record, 'refused-save');
      if (!record.conflict || late) return false;
      this.notifyHiddenConflict(record);
      return 'handled';
    });
    let budget: NodeJS.Timeout | undefined;
    const outOfTime = new Promise<SaveConflictAnswer>(resolve => {
      budget = setTimeout(() => {
        late = true;
        resolve(false);
      }, ANSWER_SAVE_CONFLICT_BUDGET_MS);
    });
    try {
      return await Promise.race([answer, outOfTime]);
    } finally {
      clearTimeout(budget);
    }
  }

  /**
   * When no Ritemark view of the document is visible — its tab is behind
   * another, or the save came from a text editor of the same file — one
   * Ritemark notification names it; Review changes brings it forward with the
   * review open (R10, S43, S44).
   */
  private notifyHiddenConflict(record: DocumentRecord): void {
    const conflict = record.conflict;
    if (!conflict || record.notifiedConflictRevision === conflict.revision) return;
    const views = [...record.views.values()].filter(view => !view.disposed);
    if (views.length === 0 || views.some(view => view.panel.visible)) return;
    record.notifiedConflictRevision = conflict.revision;
    const name = path.basename(record.document.uri.fsPath);
    // Sprint 145 R1 (#588): the Experience lead's words for a held import (issue #588, 31 October).
    const text = conflict.reason === 'held-import'
      ? `Something else saved "${name}" just after you did, without words you had just written.`
      : `"${name}" changed on disk while you were editing it.`;
    void vscode.window.showWarningMessage(text, 'Review changes').then(choice => {
      if (choice !== 'Review changes' || record.disposed || record.conflict?.revision !== conflict.revision) return;
      const view = [...record.views.values()].find(candidate => !candidate.disposed);
      if (!view) return;
      view.panel.reveal(view.panel.viewColumn, false);
      this.sendConflict(record, view, true);
    });
  }

  private async reconcile(record: DocumentRecord, reason: string): Promise<void> {
    if (record.disposed || !this.isDiskBacked(record.document)) return;
    // Receipts created after this point are newer than the disk read and must
    // survive an unmatched result from that in-flight observation.
    const observedThroughLocalSaveSequence = record.localSaveSequence;
    const disk = await this.readDisk(record.document);
    if (!disk) return;
    const diskValidatorUnchanged = disk.validator === record.lastObservedDiskValidator;
    record.lastObservedDiskValidator = disk.validator;
    const modelContent = record.document.getText();
    const modelHash = logicalHash(modelContent);
    const modelVersion = record.document.version;
    const localSaveObservation = observeLocalSaveReceipts(
      record.pendingLocalSaveReceipts,
      disk.logicalHash,
      modelHash,
      observedThroughLocalSaveSequence,
    );
    record.pendingLocalSaveReceipts = localSaveObservation.remainingReceipts;
    if (reason === 'poll' && diskValidatorUnchanged && localSaveObservation.state === undefined) return;

    // An unresolved conflict freezes its evidence. Polling and watcher hints
    // may observe later changes, but only an explicit stale resolution attempt
    // refreshes the immutable local/disk snapshot pair.
    const refreshConflict = reason === 'stale-resolution' || reason === 'keep-local-verification';
    if (record.conflict && record.resolutionRevision === undefined && !refreshConflict) {
      record.modelHash = modelHash;
      record.state = 'conflict';
      this.sendAllStates(record);
      return;
    }
    // #588 (revised): the document holds Ritemark's merge of exactly this copy (the shell asked first).
    if (record.pendingMerge && record.pendingMerge.diskHash !== disk.logicalHash) record.pendingMerge = undefined;
    if (record.pendingMerge && record.pendingMerge.mergedHash === modelHash) {
      this.addParagraphs(record, record.pendingMerge.conflicts);
      await this.settleMerge(record, disk, modelHash, reason);
      return;
    }
    if (localSaveObservation.state) {
      const changed = modelHash !== record.modelHash;
      record.modelHash = modelHash;
      // The disk snapshot is a logical-content receipt for an exact local model
      // state confirmed after a successful save. Advance the common logical
      // base while preserving any newer visible model as local-only.
      record.baseDiskHash = disk.validator;
      record.baseDiskLogicalHash = disk.logicalHash;
      record.baseModelHash = disk.logicalHash;
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = localSaveObservation.state;
      if (changed) {
        record.revision += 1;
        await this.broadcast(record, 'undo-redo');
      } else {
        this.sendAllStates(record);
      }
      this.log(record, `${reason}:local-save-echo`);
      return;
    }
    const classification = classifyThreeWay({
      baseDiskHash: record.baseDiskLogicalHash,
      baseModelHash: record.baseModelHash,
      diskHash: disk.logicalHash,
      modelHash,
    });

    // Keep explicit conflict evidence until every currently visible view has
    // acknowledged the resolution payload. The immediate save/watcher echo is
    // already represented by the new base and must not clear the action early.
    if (record.resolutionRevision !== undefined && classification === 'synced') {
      this.sendAllStates(record);
      return;
    }

    // Sprint 145 R1 (revised 1 November, #588): a writer's copy is merged with the person's text when its base is
    // found, held (the fallback question) when it isn't and it leaves out words saved within the window. In
    // `converged`, only when the document's text changed without Ritemark: VS Code reloaded it without asking (the
    // shell's participant didn't answer in time). Ritemark's own save seen before its receipt has the text
    // Ritemark already knows, and is never a writer.
    if (classification === 'external-only' || (classification === 'converged' && modelHash !== record.modelHash)) {
      const mine = classification === 'external-only' ? modelContent : (this.knownText(record) ?? modelContent);
      if (logicalHash(mine) !== disk.logicalHash) {
        const decision = this.decideForCopy(record, disk.content, mine);
        if (decision.action === 'hold') {
          await this.holdStaleWrite(record, disk, reason, decision.lost);
          return;
        }
        if (decision.action === 'merge') {
          await this.applyMerge(record, disk, decision, modelVersion, modelHash, reason);
          return;
        }
      }
    }

    if (classification === 'external-only') {
      // The file-service model update and extension watcher hint can arrive in
      // adjacent turns. Give the model one short coalescing window, then honor
      // the exact version/hash precondition before importing the disk snapshot.
      await new Promise<void>(resolve => setTimeout(resolve, 25));
      if (record.document.version !== modelVersion || logicalHash(record.document.getText()) !== modelHash) {
        this.enqueue(record, () => this.reconcile(record, 'model-caught-up'));
        return;
      }
      const applied = await this.applyText(record.document, disk.content, {
        version: modelVersion,
        logicalHash: modelHash,
      });
      if (applied === 'stale') {
        this.enqueue(record, () => this.reconcile(record, 'external-import-stale'));
        return;
      }
      if (applied === 'rejected') {
        this.failAll(record, 'VS Code rejected an external document update.');
        return;
      }
      record.modelHash = logicalHash(record.document.getText());
      record.revision += 1;
      this.setBase(record, disk, record.modelHash);
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = 'synced';
      await this.broadcast(record, 'external');
    } else if (classification === 'converged') {
      const changed = modelHash !== record.modelHash;
      record.modelHash = modelHash;
      if (changed) record.revision += 1;
      // #588: VS Code says a saved document is clean before it fires the save with its receipt, so this
      // branch can see Ritemark's own save first. Keep what was on disk before, for that save's receipt.
      const before = { hash: disk.logicalHash, previousText: record.lastKnownDiskText };
      this.setBase(record, disk, modelHash);
      record.convergedBeforeReceipt = before;
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = 'synced';
      if (changed) await this.broadcast(record, 'external');
      else this.sendAllStates(record);
    } else if (classification === 'local-only') {
      const changed = modelHash !== record.modelHash;
      record.modelHash = modelHash;
      if (changed) {
        record.revision += 1;
        await this.broadcast(record, 'undo-redo');
      }
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = 'local-only';
      this.sendAllStates(record);
    } else if (classification === 'synced') {
      const changed = modelHash !== record.modelHash;
      record.modelHash = modelHash;
      record.baseDiskHash = disk.validator;
      if (changed) {
        record.revision += 1;
        await this.broadcast(record, 'undo-redo');
      }
      record.conflict = undefined;
      record.resolutionRevision = undefined;
      record.state = 'synced';
      this.sendAllStates(record);
    } else {
      const sameConflict = record.conflict?.diskValidator === disk.validator
        && logicalHash(record.conflict.localContent) === modelHash;
      // #588 (revised, Jarmo 1 November: "salvestamata tekst samuti kokkupanekusse"): the person's unsaved text is
      // merged with the writer's copy too, the last save as the base. #454's question only when no base is found.
      if (!sameConflict && !record.conflict) {
        const decision = this.decideForCopy(record, disk.content, modelContent);
        if (decision.action !== 'hold') {
          const merge = decision.action === 'merge' ? decision : { action: 'merge' as const, text: disk.content, conflicts: [], taken: 0 };
          await this.applyMerge(record, disk, merge, modelVersion, modelHash, reason);
          return;
        }
      }
      if (!sameConflict) {
        record.conflictSequence += 1;
        record.conflict = {
          revision: record.conflictSequence,
          diskValidator: disk.validator,
          diskHash: disk.logicalHash,
          diskContent: disk.content,
          localContent: modelContent,
        };
      }
      record.modelHash = modelHash;
      record.resolutionRevision = undefined;
      record.state = 'conflict';
      for (const view of record.views.values()) this.sendConflict(record, view);
      this.sendAllStates(record);
    }
    this.log(record, `${reason}:${classification}`);
  }

  private async broadcast(record: DocumentRecord, reason: DocumentUpdateReason): Promise<void> {
    await Promise.all([...record.views.values()].map(view => this.sendCurrent(record, view, reason)));
  }

  private async sendCurrent(record: DocumentRecord, view: ViewLease, reason: DocumentUpdateReason): Promise<void> {
    if (view.disposed) return;
    if (!view.panel.visible) {
      this.clearPending(view);
      view.applyError = false;
      return;
    }
    let payload: DocumentRenderPayload;
    try {
      payload = this.adapter.buildPayload(record.document, view.webview);
    } catch (error) {
      this.fail(record, view, error instanceof Error ? error.message : 'Could not build the document view.');
      return;
    }
    const message: UpdateMessage = {
      type: 'document:update',
      uri: record.uri,
      documentSessionId: record.sessionId,
      viewEpoch: view.epoch,
      revision: record.revision,
      baseDiskHash: record.baseDiskHash,
      modelHash: record.modelHash,
      payloadHash: payloadHashFor(payload),
      reason,
      attempt: 1,
      payload,
    };
    this.clearPending(view);
    view.applyError = false;
    view.pending = { message, text: record.document.getText(), startedAt: Date.now() };
    this.sendState(record, view, 'applying', 1);
    await this.postAttempt(record, view, 1);
    const pending = view.pending;
    if (!pending) return;
    pending.schedule = new DocumentDeliverySchedule(
      { revision: message.revision, payloadHash: message.payloadHash },
      attempt => this.enqueue(record, () => this.postAttempt(record, view, attempt)),
      () => this.enqueue(record, async () => {
        if (!view.pending || view.pending.message.revision !== message.revision || view.pending.message.payloadHash !== message.payloadHash) return;
        if (!view.panel.visible) {
          this.clearPending(view);
          return;
        }
        this.clearPending(view);
        view.applyError = true;
        this.sendState(record, view, 'apply-error', 3, 'The editor did not confirm this document update.');
        this.logDelivery(record, view, 'apply-error', message.revision, 3, Date.now() - pending.startedAt);
      }),
    );
    pending.schedule.start();
  }

  private async postAttempt(record: DocumentRecord, view: ViewLease, attempt: number): Promise<void> {
    const pending = view.pending;
    if (!pending || view.disposed || pending.message.revision !== record.revision) return;
    if (!view.panel.visible) return;
    pending.message = { ...pending.message, attempt };
    const delivered = await view.webview.postMessage(pending.message);
    if (!delivered) {
      this.clearPending(view);
      view.applyError = true;
      this.sendState(record, view, 'apply-error', attempt, 'The editor could not receive this document update.');
      this.logDelivery(record, view, 'apply-error', pending.message.revision, attempt, Date.now() - pending.startedAt);
    }
    else {
      this.sendState(record, view, 'applying', attempt);
      this.logDelivery(record, view, 'send', pending.message.revision, attempt);
    }
  }

  private sendEditResult(
    record: DocumentRecord,
    view: ViewLease,
    clientSequence: number,
    status: 'accepted' | 'stale' | 'rejected',
    message?: string,
    payloadHash?: string,
  ): void {
    void view.webview.postMessage({
      type: 'document:edit-result',
      uri: record.uri,
      documentSessionId: record.sessionId,
      viewEpoch: view.epoch,
      clientSequence,
      status,
      revision: record.revision,
      ...(payloadHash ? { payloadHash } : {}),
      ...(message ? { message } : {}),
    } satisfies DocumentHostMessage);
  }

  private sendConflict(record: DocumentRecord, view: ViewLease, openReview = false): void {
    const conflict = record.conflict;
    if (!conflict || view.disposed) return;
    void view.webview.postMessage({
      type: 'document:conflict',
      uri: record.uri,
      documentSessionId: record.sessionId,
      viewEpoch: view.epoch,
      conflictRevision: conflict.revision,
      revision: record.revision,
      diskHash: conflict.diskValidator,
      filename: path.basename(record.document.uri.fsPath),
      ...(conflict.reason ? { reason: conflict.reason } : {}),
      ...(openReview ? { openReview: true } : {}),
    } satisfies DocumentHostMessage);
  }

  private sendAllStates(record: DocumentRecord): void {
    for (const view of record.views.values()) this.sendState(record, view);
  }

  private sendState(record: DocumentRecord, view: ViewLease, override?: DocumentSyncState, attempt?: number, message?: string): void {
    if (view.disposed) return;
    const state = override ?? (
      record.conflict
        ? 'conflict'
        : view.applyError
          ? 'apply-error'
          : view.acknowledgedRevision < record.revision
            ? 'applying'
            : record.state
    );
    const conflict = record.conflict;
    void view.webview.postMessage({
      type: 'document:sync-state',
      uri: record.uri,
      documentSessionId: record.sessionId,
      viewEpoch: view.epoch,
      state,
      revision: record.revision,
      acknowledgedRevision: view.acknowledgedRevision,
      ...(attempt ? { attempt } : {}),
      ...(message ? { message } : {}),
      ...(conflict ? { conflictRevision: conflict.revision, diskHash: conflict.diskValidator } : {}),
    } satisfies DocumentHostMessage);
  }

  private fail(record: DocumentRecord, view: ViewLease, message: string): void {
    this.clearPending(view);
    this.sendState(record, view, 'failed', undefined, message);
  }

  private failAll(record: DocumentRecord, message: string): void {
    for (const view of record.views.values()) this.fail(record, view, message);
  }

  private setBase(record: DocumentRecord, disk: DiskSnapshot, modelHash: string): void {
    record.baseDiskHash = disk.validator;
    record.baseDiskLogicalHash = disk.logicalHash;
    record.baseModelHash = modelHash;
    record.lastKnownDiskText = disk.content;
    record.convergedBeforeReceipt = undefined;
    // A new authoritative base retires every older local-save receipt. The
    // local-save-echo branch deliberately updates the base inline instead so
    // later saves that are still in flight remain pending.
    record.pendingLocalSaveReceipts = [];
  }

  private recordLocalSaveHash(record: DocumentRecord, saveHash: string): void {
    record.localSaveSequence += 1;
    record.pendingLocalSaveReceipts.push({ sequence: record.localSaveSequence, hash: saveHash });
  }

  /** #588: keep the document's text as it is now, so a later save receipt can find the text it saved. */
  private rememberModelText(record: DocumentRecord): void {
    if (record.guardOff || record.disposed) return;
    const text = record.document.getText();
    if (text.length > STALE_WRITE_GUARD_MAX_CHARS) {
      this.turnGuardOff(record, text.length);
      return;
    }
    if (record.recentTexts[record.recentTexts.length - 1] === text) return;
    record.recentTexts.push(text);
    if (record.recentTexts.length > RECENT_MODEL_TEXTS) record.recentTexts.splice(0, record.recentTexts.length - RECENT_MODEL_TEXTS);
  }

  /**
   * #588: a save receipt names the hash of the text it wrote; find that text among the document's recent
   * states and remember it with the time. A save whose text isn't among them (a save participant changed
   * it, or typing outran the memory) is not guarded, which is 2.1's behaviour, never a guess.
   */
  private rememberSave(record: DocumentRecord, saveHash: string): void {
    if (record.guardOff || record.disposed) return;
    const current = record.document.getText();
    if (current.length > STALE_WRITE_GUARD_MAX_CHARS) {
      this.turnGuardOff(record, current.length);
      return;
    }
    let text: string | undefined;
    let index = record.recentTexts.length;
    if (logicalHash(current) === saveHash) {
      text = current;
    } else {
      while (text === undefined && index > 0) {
        index -= 1;
        if (logicalHash(record.recentTexts[index]) === saveHash) text = record.recentTexts[index];
      }
    }
    if (text === undefined) return;
    // When the sync saw this save's text on disk before its receipt (`converged`), the text before it is the
    // one kept then; otherwise it is the last text Ritemark knew to be on disk.
    const early = record.convergedBeforeReceipt;
    record.convergedBeforeReceipt = undefined;
    const previousText = early && early.hash === saveHash ? early.previousText : record.lastKnownDiskText;
    const now = Date.now();
    record.recentSaves.push({ text, hash: saveHash, previousText, savedAt: now });
    while (record.recentSaves.length > 1 && now - record.recentSaves[0].savedAt > BASE_MEMORY_MS) record.recentSaves.shift();
    // Over the bounds, merge the second-oldest save into the next one: the next one's run then starts where the
    // merged one's did, so no word inside the window loses its guard (a merge loses one possible base).
    while (record.recentSaves.length > 2
      && (record.recentSaves.length > RECENT_SAVES || record.recentSaves.length * text.length > RECENT_SAVES_CHARS)) {
      const [merged] = record.recentSaves.splice(1, 1);
      record.recentSaves[1] = { ...record.recentSaves[1], previousText: merged.previousText };
    }
    record.lastKnownDiskText = text;
    // The states up to the saved one are not needed any more.
    record.recentTexts.splice(0, Math.min(index + 1, record.recentTexts.length));
  }

  private turnGuardOff(record: DocumentRecord, chars: number): void {
    record.guardOff = true;
    record.recentTexts = [];
    record.recentSaves = [];
    console.info(
      `[EditorSync] stale-write guard off file=${path.basename(record.document.uri.fsPath)} chars=${chars}`
      + ` limit=${STALE_WRITE_GUARD_MAX_CHARS}`,
    );
  }

  private isOwnSave(record: DocumentRecord, diskLogicalHash: string): boolean {
    return record.recentSaves.some(save => save.hash === diskLogicalHash);
  }

  /** #588: the text whose hash is `record.modelHash` (what the views show), if the memory still has it. */
  private knownText(record: DocumentRecord): string | undefined {
    const candidates = [
      record.document.getText(),
      ...[...record.recentTexts].reverse(),
      ...[...record.recentSaves].reverse().map(save => save.text),
      record.lastKnownDiskText,
    ];
    return candidates.find(text => logicalHash(text) === record.modelHash);
  }

  /** #588: how many words that Ritemark's recent saves added the file now leaves out (0 when none). */
  private wordsLostToStaleWrite(record: DocumentRecord, disk: DiskSnapshot): number {
    if (record.guardOff || record.recentSaves.length === 0) return 0;
    return droppedRecentSave({
      saves: record.recentSaves,
      diskText: disk.content,
      now: Date.now(),
      windowMs: STALE_WRITE_WINDOW_MS,
    });
  }

  /**
   * #588: a writer's copy left out words Ritemark had just saved. Put back the text the person's views show
   * (the document's text as Ritemark last knew it, which holds those words and anything imported since) and ask
   * with Review changes, keeping the writer's copy as the question's disk side.
   */
  private async holdStaleWrite(record: DocumentRecord, disk: DiskSnapshot, reason: string, lost: number): Promise<void> {
    const words = this.knownText(record) ?? record.recentSaves[record.recentSaves.length - 1].text;
    const modelVersion = record.document.version;
    const modelHash = logicalHash(record.document.getText());
    // When the document still holds the words (Ritemark read the file before VS Code reloaded it), the same
    // text is applied anyway: the edit makes the document dirty, and VS Code doesn't reload a dirty document.
    const applied = await this.applyText(record.document, words, { version: modelVersion, logicalHash: modelHash });
    if (applied === 'stale') {
      this.enqueue(record, () => this.reconcile(record, 'held-import-stale'));
      return;
    }
    if (applied === 'rejected') {
      this.failAll(record, 'VS Code rejected putting your words back.');
      return;
    }
    record.modelHash = logicalHash(record.document.getText());
    // A view may have been sent the writer's copy before this ran (it turned visible, or reloaded): send every
    // view the text put back, as a new revision.
    record.revision += 1;
    await this.broadcast(record, 'revert');
    this.openHeldConflict(record, disk, record.document.getText(), reason, lost);
  }

  /** #588: the fallback question: the person's text in the document, the writer's copy as the disk side. */
  private openHeldConflict(record: DocumentRecord, disk: DiskSnapshot, localContent: string, reason: string, lost: number): void {
    record.conflictSequence += 1;
    record.conflict = {
      revision: record.conflictSequence,
      diskValidator: disk.validator,
      diskHash: disk.logicalHash,
      diskContent: disk.content,
      diskBytes: disk.bytes,
      localContent,
      reason: 'held-import',
    };
    record.resolutionRevision = undefined;
    record.state = 'conflict';
    for (const view of record.views.values()) this.sendConflict(record, view);
    this.sendAllStates(record);
    this.notifyHiddenConflict(record);
    // The count of words, never the words.
    this.log(record, `${reason}:held-import words=${lost}`);
  }

  /** #588 (revised): Markdown blocks, or CSV rows. */
  private blockKind(document: vscode.TextDocument): BlockKind {
    return path.extname(document.uri.fsPath).toLowerCase() === '.csv' ? 'csv' : 'markdown';
  }

  /**
   * #588 (revised): the texts a writer's copy may have started from, oldest first: the text before the oldest
   * remembered save, each save, and the text Ritemark last read or imported.
   */
  private baseCandidates(record: DocumentRecord): string[] {
    const candidates: string[] = [];
    const add = (text: string | undefined) => {
      if (text !== undefined && !candidates.includes(text)) candidates.push(text);
    };
    if (record.recentSaves.length) add(record.recentSaves[0].previousText);
    for (const save of record.recentSaves) add(save.text);
    add(record.lastKnownDiskText);
    return candidates;
  }

  /**
   * #588 (revised): what to do with a writer's copy. With a base, merge it by block with the person's text (or take
   * it, when the person changed nothing since that base). Without one, or when the copy is exactly an earlier
   * version (a Discard, a checkout, a rewind: no edit of its own), the fallback: hold it and ask when it leaves out
   * words saved within the window, take it otherwise, as 2.1 did.
   */
  private decideForCopy(record: DocumentRecord, theirs: string, mine: string): CopyDecision {
    if (record.guardOff) return { action: 'import' };
    const kind = this.blockKind(record.document);
    const candidates = this.baseCandidates(record);
    const index = findBase(candidates, theirs, kind);
    const anEarlierVersion = index >= 0 && logicalHash(candidates[index]) === logicalHash(theirs);
    if (index >= 0 && !anEarlierVersion) {
      const result = mergeBlocks(candidates[index], mine, theirs, kind, theirs.includes('\r\n') ? '\r\n' : '\n');
      if (logicalHash(result.text) === logicalHash(theirs)) return { action: 'import' };
      return { action: 'merge', text: result.text, conflicts: result.conflicts, taken: result.takenFromTheirs };
    }
    const lost = droppedRecentSave({ saves: record.recentSaves, diskText: theirs, now: Date.now(), windowMs: STALE_WRITE_WINDOW_MS });
    return lost > 0 ? { action: 'hold', lost } : { action: 'import' };
  }

  /**
   * #588 (revised): VS Code is about to reload this clean document with `diskText` (patch 014's reload
   * participant). Answer with the text the document should take instead, or `undefined` for VS Code's own reload.
   */
  private async answerReload(uriArgument: unknown, diskTextArgument: unknown): Promise<string | undefined> {
    const uri = uriArgument instanceof vscode.Uri
      ? uriArgument.toString()
      : typeof uriArgument === 'string' ? uriArgument : undefined;
    const record = uri ? this.records.get(uri) : undefined;
    if (!record || record.disposed || typeof diskTextArgument !== 'string' || !this.isDiskBacked(record.document)) return undefined;
    const theirs = diskTextArgument;
    let late = false;
    const answer = this.enqueueResult<string | undefined>(record, undefined, async () => (late ? undefined : this.answerReloadNow(record, theirs)));
    let budget: NodeJS.Timeout | undefined;
    const outOfTime = new Promise<undefined>(resolve => {
      budget = setTimeout(() => {
        late = true;
        resolve(undefined);
      }, ANSWER_RELOAD_BUDGET_MS);
    });
    try {
      return await Promise.race([answer, outOfTime]);
    } finally {
      clearTimeout(budget);
    }
  }

  private async answerReloadNow(record: DocumentRecord, theirs: string): Promise<string | undefined> {
    const mine = record.document.getText();
    if (logicalHash(mine) === logicalHash(theirs)) return undefined;
    const conflict = record.conflict;
    if (conflict && record.resolutionRevision === undefined) {
      if (conflict.reason !== 'held-import') return undefined;
      // A newer copy while the fallback question waits: the person's words stay; the newest copy is its disk side.
      const disk = await this.readDisk(record.document);
      if (disk && disk.logicalHash === logicalHash(theirs) && disk.logicalHash !== conflict.diskHash) {
        record.conflictSequence += 1;
        record.conflict = {
          ...conflict,
          revision: record.conflictSequence,
          diskValidator: disk.validator,
          diskHash: disk.logicalHash,
          diskContent: disk.content,
          diskBytes: disk.bytes,
        };
        for (const view of record.views.values()) this.sendConflict(record, view);
        this.notifyHiddenConflict(record);
        this.log(record, 'reload:held-import-newer-copy');
      }
      return conflict.localContent;
    }
    // Ritemark already took this copy in (its watcher merged it while VS Code's question waited on the queue): the
    // document's text is the merge, or the person's newer text over it. VS Code drops the answer anyway when the
    // document changed while it asked; answering the document's text keeps it when it didn't.
    if (logicalHash(theirs) === record.baseDiskLogicalHash) {
      this.log(record, 'reload:known-copy');
      return mine;
    }
    const decision = this.decideForCopy(record, theirs, mine);
    if (decision.action === 'merge') {
      record.pendingMerge = { diskHash: logicalHash(theirs), mergedHash: logicalHash(decision.text), conflicts: decision.conflicts };
      console.info(
        `[EditorSync] merge file=${path.basename(record.document.uri.fsPath)} session=${record.sessionId.slice(0, 8)}`
        + ` from=shell taken=${decision.taken} held=${decision.conflicts.length}`,
      );
      return decision.text;
    }
    if (decision.action === 'hold') {
      const disk = await this.readDisk(record.document);
      // The file changed again since VS Code read it: let VS Code reload, and the sync see the newer file.
      if (!disk || disk.logicalHash !== logicalHash(theirs)) return undefined;
      this.openHeldConflict(record, disk, mine, 'reload', decision.lost);
      return mine;
    }
    return undefined;
  }

  /** #588 (revised): put a merge Ritemark made itself into the document (its own sighting, or unsaved text). */
  private async applyMerge(
    record: DocumentRecord,
    disk: DiskSnapshot,
    decision: Extract<CopyDecision, { action: 'merge' }>,
    modelVersion: number,
    modelHash: string,
    reason: string,
  ): Promise<void> {
    const applied = await this.applyText(record.document, decision.text, { version: modelVersion, logicalHash: modelHash });
    if (applied === 'stale') {
      this.enqueue(record, () => this.reconcile(record, 'merge-stale'));
      return;
    }
    if (applied === 'rejected') {
      this.failAll(record, 'VS Code rejected the merged document.');
      return;
    }
    this.addParagraphs(record, decision.conflicts);
    console.info(
      `[EditorSync] merge file=${path.basename(record.document.uri.fsPath)} session=${record.sessionId.slice(0, 8)}`
      + ` from=${reason} taken=${decision.taken} held=${decision.conflicts.length}`,
    );
    await this.settleMerge(record, disk, logicalHash(record.document.getText()), reason);
  }

  /**
   * #588 (revised): the document holds a merge of the writer's copy on disk. The writer's copy becomes the base, so
   * the merged text is the person's change on top of it: auto-save writes it (a save VS Code refuses as newer goes
   * through patch 014's route, which finds the disk unchanged since the base and overwrites). The views take the
   * merge as one undo step.
   */
  private async settleMerge(record: DocumentRecord, disk: DiskSnapshot, modelHash: string, reason: string): Promise<void> {
    record.pendingMerge = undefined;
    this.setBase(record, disk, disk.logicalHash);
    record.modelHash = modelHash;
    record.conflict = undefined;
    record.resolutionRevision = undefined;
    record.state = modelHash === disk.logicalHash ? 'synced' : 'local-only';
    record.revision += 1;
    await this.broadcast(record, 'merge');
    this.sendAllStates(record);
    this.sendParagraphs(record);
    this.notifyParagraphs(record);
    this.log(record, `${reason}:merged`);
  }

  private addParagraphs(record: DocumentRecord, conflicts: readonly BlockConflict[]): void {
    for (const conflict of conflicts) {
      record.paragraphSequence += 1;
      record.paragraphs.push({ id: record.paragraphSequence, mine: conflict.mine, theirs: conflict.theirs });
    }
  }

  /**
   * #588 (revised): a place both changed goes once the two versions are the same: the person typed the writer's
   * version (or deleted a block the writer had deleted). True when one went.
   */
  private pruneParagraphs(record: DocumentRecord): boolean {
    if (!record.paragraphs.length) return false;
    const text = normalizeLogicalText(record.document.getText());
    const before = record.paragraphs.length;
    record.paragraphs = record.paragraphs.filter(item => (item.theirs === '' ? text.includes(item.mine) : !text.includes(item.theirs)));
    return record.paragraphs.length !== before;
  }

  private sendParagraphs(record: DocumentRecord, only?: ViewLease, openReview = false): void {
    for (const view of only ? [only] : record.views.values()) {
      if (view.disposed) continue;
      void view.webview.postMessage({
        type: 'document:paragraphs',
        uri: record.uri,
        documentSessionId: record.sessionId,
        viewEpoch: view.epoch,
        revision: record.revision,
        items: record.paragraphs,
        ...(openReview ? { openReview: true } : {}),
      } satisfies DocumentHostMessage);
    }
  }

  /** #588 (revised): with no view of the document in front, one notification in experience 44's words. */
  private notifyParagraphs(record: DocumentRecord): void {
    if (!record.paragraphs.length || record.notifiedParagraphs === record.paragraphSequence) return;
    const views = [...record.views.values()].filter(view => !view.disposed);
    if (views.length === 0 || views.some(view => view.panel.visible)) return;
    record.notifiedParagraphs = record.paragraphSequence;
    const name = path.basename(record.document.uri.fsPath);
    // Experience 44: a question, not an alarm (the person's text is kept), so not a warning.
    void vscode.window.showInformationMessage(
      `Another app saved a copy of "${name}" that changes a paragraph you were writing in. Yours is kept.`,
      'Review changes',
    ).then(choice => {
      if (choice !== 'Review changes' || record.disposed || !record.paragraphs.length) return;
      const view = [...record.views.values()].find(candidate => !candidate.disposed);
      if (!view) return;
      view.panel.reveal(view.panel.viewColumn, false);
      this.sendParagraphs(record, view, true);
    });
  }

  /** #588 (revised): the person's answer for one place both changed. Use the writer's is one undo step. */
  private async paragraphAction(record: DocumentRecord, view: ViewLease, message: ParagraphActionMessage): Promise<void> {
    const item = record.paragraphs.find(candidate => candidate.id === message.id);
    if (!item) return;
    record.paragraphs = record.paragraphs.filter(candidate => candidate.id !== message.id);
    if (message.action === 'use-theirs') {
      const current = record.document.getText();
      const text = normalizeLogicalText(current);
      const at = item.mine === '' ? -1 : text.indexOf(item.mine);
      if (at >= 0) {
        let next = text.slice(0, at) + item.theirs + text.slice(at + item.mine.length);
        // The writer removed the block: don't leave its blank lines behind.
        if (item.theirs === '') next = next.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
        const eol = record.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        const applied = await this.applyText(record.document, eol === '\n' ? next : next.replace(/\n/g, '\r\n'), {
          version: record.document.version,
          logicalHash: logicalHash(current),
        });
        if (applied === 'applied') {
          record.modelHash = logicalHash(record.document.getText());
          record.revision += 1;
          await this.broadcast(record, 'merge');
          this.sendAllStates(record);
        } else {
          this.fail(record, view, 'VS Code rejected the other version of the paragraph.');
        }
      }
    }
    this.sendParagraphs(record);
    this.log(record, `paragraph:${message.action}`);
  }

  private async openDiff(record: DocumentRecord, conflict: ConflictSnapshot): Promise<void> {
    const authority = encodeURIComponent(record.sessionId);
    // Keep a non-custom-editor suffix: `.md`/`.csv` would recursively activate
    // Ritemark for each side instead of VS Code's read-only text diff editor.
    const localUri = vscode.Uri.parse(`ritemark-sync:/${authority}/local-${conflict.revision}.txt`);
    const diskUri = vscode.Uri.parse(`ritemark-sync:/${authority}/disk-${conflict.revision}.txt`);
    this.virtualDocuments.set(localUri.toString(), conflict.localContent);
    this.virtualDocuments.set(diskUri.toString(), conflict.diskContent);
    await vscode.commands.executeCommand(
      'vscode.diff',
      localUri,
      diskUri,
      `${path.basename(record.document.uri.fsPath)} — My version ↔ Disk version`,
      { preview: true },
    );
  }

  private startResources(record: DocumentRecord): void {
    if (!this.isDiskBacked(record.document)) return;
    if (!record.watcher) {
      const filePath = record.document.uri.fsPath;
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath)));
      watcher.onDidChange(() => this.enqueue(record, () => this.reconcile(record, 'watcher')));
      watcher.onDidDelete(() => {
        for (const view of record.views.values()) {
          void view.webview.postMessage({ type: 'fileDeleted', filename: path.basename(filePath) });
        }
      });
      record.watcher = watcher;
    }
    if (!record.poll) {
      record.poll = setInterval(() => this.enqueue(record, () => this.reconcile(record, 'poll')), POLL_INTERVAL_MS);
    }
  }

  private disposeRecord(record: DocumentRecord): void {
    if (record.disposed) return;
    record.disposed = true;
    record.watcher?.dispose();
    if (record.poll) clearInterval(record.poll);
    for (const view of record.views.values()) {
      view.disposed = true;
      this.clearPending(view);
    }
    record.views.clear();
    record.panels.clear();
    this.records.delete(record.uri);
    for (const key of [...this.virtualDocuments.keys()]) {
      if (key.includes(encodeURIComponent(record.sessionId))) this.virtualDocuments.delete(key);
    }
  }

  private enqueue(record: DocumentRecord, task: () => Promise<void> | void): void {
    record.queue = record.queue.then(async () => {
      if (!record.disposed) await task();
    }).catch(error => {
      console.error('[EditorSync] transition failed', error instanceof Error ? error.message : String(error));
      this.failAll(record, 'Document synchronization failed.');
    });
  }

  /** `enqueue`, with the task's result; `fallback` when it fails or the record is gone. */
  private enqueueResult<T>(record: DocumentRecord, fallback: T, task: () => Promise<T>): Promise<T> {
    let result = fallback;
    this.enqueue(record, async () => {
      result = await task();
    });
    return record.queue.then(() => result, () => fallback);
  }

  private clearPending(view: ViewLease): void {
    if (!view.pending) return;
    view.pending.schedule?.cancel();
    view.pending = undefined;
  }

  private maybeCompleteResolution(record: DocumentRecord): boolean {
    const revision = record.resolutionRevision;
    if (revision === undefined) return false;
    const views = [...record.views.values()].map(view => ({
      visible: view.panel.visible,
      disposed: view.disposed,
      acknowledgedRevision: view.acknowledgedRevision,
    }));
    if (!canCompleteViewResolution(revision, views)) return false;
    record.conflict = undefined;
    record.resolutionRevision = undefined;
    record.state = 'synced';
    this.sendAllStates(record);
    this.log(record, 'resolution-acknowledged');
    return true;
  }

  private findViewByWebview(record: DocumentRecord, webview: vscode.Webview): ViewLease | undefined {
    return [...record.views.values()].find(view => view.webview === webview);
  }

  private isEditable(document: vscode.TextDocument): boolean {
    const extension = path.extname(document.uri.fsPath).toLowerCase();
    return extension === '.csv' || extension === '.md' || extension === '.markdown' || extension === '.mdown' || extension === '.mkd' || extension === '';
  }

  private isDiskBacked(document: vscode.TextDocument): boolean {
    return !document.isUntitled && document.uri.scheme === 'file' && !!document.uri.fsPath;
  }

  private readDiskSync(document: vscode.TextDocument): DiskSnapshot {
    if (!this.isDiskBacked(document)) return snapshot(Buffer.from(document.getText(), 'utf8'));
    try {
      return snapshot(fs.readFileSync(document.uri.fsPath));
    } catch {
      return snapshot(Buffer.from(document.getText(), 'utf8'));
    }
  }

  private async readDisk(document: vscode.TextDocument): Promise<DiskSnapshot | undefined> {
    if (!this.isDiskBacked(document)) return undefined;
    try {
      return snapshot(await fsp.readFile(document.uri.fsPath));
    } catch {
      return undefined;
    }
  }

  private async applyText(
    document: vscode.TextDocument,
    content: string,
    precondition?: { version: number; logicalHash: string },
  ): Promise<'applied' | 'stale' | 'rejected'> {
    if (precondition && (document.version !== precondition.version || logicalHash(document.getText()) !== precondition.logicalHash)) {
      return 'stale';
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), content);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      if (precondition && (document.version !== precondition.version || logicalHash(document.getText()) !== precondition.logicalHash)) {
        return 'stale';
      }
      return 'rejected';
    }
    return logicalHash(document.getText()) === logicalHash(content) ? 'applied' : 'stale';
  }

  private log(record: DocumentRecord, reason: string): void {
    const signature = [
      record.revision,
      record.state,
      record.baseDiskHash,
      record.conflict?.revision ?? 0,
      record.resolutionRevision ?? 0,
      record.views.size,
    ].join(':');
    if (signature === record.lastLogSignature) return;
    record.lastLogSignature = signature;
    console.info(
      `[EditorSync] transition file=${path.basename(record.document.uri.fsPath)} session=${record.sessionId.slice(0, 8)}`
      + ` revision=${record.revision} state=${record.state} views=${record.views.size} reason=${reason}`,
    );
  }

  private logDelivery(
    record: DocumentRecord,
    view: ViewLease,
    event: 'send' | 'ack' | 'apply-error',
    revision: number,
    attempt?: number,
    elapsedMs?: number,
  ): void {
    console.info(
      `[EditorSync] delivery file=${path.basename(record.document.uri.fsPath)} session=${record.sessionId.slice(0, 8)}`
      + ` view=${view.epoch.slice(0, 8)} revision=${revision} event=${event}`
      + `${attempt === undefined ? '' : ` attempt=${attempt}`}`
      + `${elapsedMs === undefined ? '' : ` elapsedMs=${elapsedMs}`}`,
    );
  }
}

function snapshot(bytes: Buffer): DiskSnapshot {
  const decoded = bytes.toString('utf8');
  const hasUtf8Bom = decoded.startsWith('\uFEFF');
  const content = hasUtf8Bom ? decoded.slice(1) : decoded;
  return { bytes, content, validator: sha256(bytes), logicalHash: logicalHash(content), hasUtf8Bom };
}

function encodeDocumentBytes(content: string, eol: vscode.EndOfLine, hasUtf8Bom: boolean): Uint8Array {
  return Buffer.from(encodeDocumentText(content, eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n', hasUtf8Bom), 'utf8');
}

function logicalHash(content: string): string {
  return sha256(Buffer.from(normalizeLogicalText(content), 'utf8'));
}

function payloadHashFor(payload: DocumentRenderPayload): string {
  return sha256(Buffer.from(canonicalJson(payload), 'utf8'));
}

function sha256(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
