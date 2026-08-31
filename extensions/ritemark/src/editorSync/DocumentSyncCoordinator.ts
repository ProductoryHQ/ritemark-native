import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  isDocumentViewMessage,
  parseDocumentViewMessage,
  type DocumentEditPayload,
  type DocumentHostMessage,
  type DocumentRenderPayload,
  type DocumentSyncBootstrap,
  type DocumentSyncState,
  type DocumentUpdateReason,
  type DocumentViewMessage,
} from './protocol';
import { DocumentDeliverySchedule } from './delivery';
import {
  canCompleteViewResolution,
  canonicalJson,
  classifyAcceptedModelEdit,
  classifyStaleViewEdit,
  classifyThreeWay,
  initializeThreeWayState,
  normalizeLogicalText,
  observeLocalSaveReceipts,
  type LocalSaveReceipt,
} from './state';

const POLL_INTERVAL_MS = 3000;

type UpdateMessage = Extract<DocumentHostMessage, { type: 'document:update' }>;
type EditMessage = Extract<DocumentViewMessage, { type: 'document:edit' }>;
type ConflictActionMessage = Extract<DocumentViewMessage, { type: 'document:conflict-action' }>;

export interface DocumentSyncAdapter {
  buildPayload(document: vscode.TextDocument, webview: vscode.Webview): DocumentRenderPayload;
  serializeEdit(document: vscode.TextDocument, payload: DocumentEditPayload): string;
}

interface DiskSnapshot {
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
}

interface PendingDelivery {
  message: UpdateMessage;
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
  views: Map<string, ViewLease>;
  panels: Map<vscode.Webview, vscode.WebviewPanel>;
  watcher?: vscode.FileSystemWatcher;
  poll?: NodeJS.Timeout;
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
        // Read the just-written bytes synchronously: the live TextDocument may
        // already contain newer dirty typing, and onWillSave content may be
        // changed or canceled by save participants.
        const saveHash = this.readCompletedSaveHash(document);
        if (saveHash) this.recordLocalSaveHash(record, saveHash);
        this.enqueue(record, () => this.reconcile(record, 'save-complete'));
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        const record = this.records.get(event.document.uri.toString());
        if (record) this.enqueue(record, () => this.reconcile(record, 'model-change'));
      }),
      vscode.workspace.registerTextDocumentContentProvider('ritemark-sync', {
        provideTextDocumentContent: uri => this.virtualDocuments.get(uri.toString()) ?? '',
      }),
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
  }

  private applied(record: DocumentRecord, view: ViewLease, revision: number, payloadHash: string): void {
    const pending = view.pending;
    if (!pending || pending.message.revision !== revision || pending.message.payloadHash !== payloadHash) return;
    if (pending.schedule && !pending.schedule.acknowledge({ revision, payloadHash })) return;
    const elapsed = Date.now() - pending.startedAt;
    this.clearPending(view);
    view.applyError = false;
    view.acknowledgedRevision = revision;
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
    const nextHash = logicalHash(fullContent);
    if (message.basedOnRevision !== record.revision) {
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

    const currentDisk = await this.readDisk(record.document);
    if (!currentDisk || currentDisk.validator !== conflict.diskValidator) {
      await this.reconcile(record, 'stale-resolution');
      return;
    }
    if (logicalHash(record.document.getText()) !== logicalHash(conflict.localContent)) {
      await this.reconcile(record, 'stale-resolution');
      return;
    }
    if (message.action === 'use-disk') {
      const applied = await this.applyText(record.document, currentDisk.content, {
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
      record.modelHash = logicalHash(record.document.getText());
      record.revision += 1;
      this.setBase(record, currentDisk, record.modelHash);
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
      this.setBase(record, disk, modelHash);
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
    view.pending = { message, startedAt: Date.now() };
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

  private sendConflict(record: DocumentRecord, view: ViewLease): void {
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
    // A new authoritative base retires every older local-save receipt. The
    // local-save-echo branch deliberately updates the base inline instead so
    // later saves that are still in flight remain pending.
    record.pendingLocalSaveReceipts = [];
  }

  private recordLocalSaveHash(record: DocumentRecord, saveHash: string): void {
    record.localSaveSequence += 1;
    record.pendingLocalSaveReceipts.push({ sequence: record.localSaveSequence, hash: saveHash });
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

  private readCompletedSaveHash(document: vscode.TextDocument): string | undefined {
    if (!this.isDiskBacked(document)) return undefined;
    try {
      return snapshot(fs.readFileSync(document.uri.fsPath)).logicalHash;
    } catch {
      // Do not manufacture a local-write receipt from the live model when the
      // completed save cannot be verified on disk.
      return undefined;
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
  return { content, validator: sha256(bytes), logicalHash: logicalHash(content), hasUtf8Bom };
}

function encodeDocumentBytes(content: string, eol: vscode.EndOfLine, hasUtf8Bom: boolean): Uint8Array {
  const lineEnding = eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const normalized = normalizeLogicalText(content).replace(/\n/g, lineEnding);
  return Buffer.from(`${hasUtf8Bom ? '\uFEFF' : ''}${normalized}`, 'utf8');
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
