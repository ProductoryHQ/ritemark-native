/**
 * Create and Sync (Sprint 119, W5, R5/R7/R8).
 *
 * Create makes exactly one Google Doc and records its identity only after
 * Google has confirmed it. Sync rewrites that same Doc and never silently
 * creates a replacement. Both go through the four-pass mapper, so a template's
 * page header and named styles survive and a stale write is refused.
 *
 * What the publisher checks, and why (every item came out of Phase 0):
 *   - the bound Doc is not in the user's Drive trash, because Drive accepts a
 *     write into a trashed Doc and answers 200;
 *   - the Docs `revisionId` is compared with the one recorded after our last
 *     write, because a person typing in Google Docs moves that and nothing else;
 *   - the rewrite carries `requiredRevisionId`, so an edit made between the
 *     check and the write is refused rather than overwritten;
 *   - a create that cannot be confirmed is looked up by the tag written into
 *     it before anything is retried.
 *
 * No `vscode` import. Prompts and progress are injected.
 */

import { createHash, randomUUID } from 'crypto';
import { buildNormalizedExportHtml } from '../export/v2/htmlPipeline';
import type { GoogleAccountService } from './GoogleAccountService';
import type { DocsDocument, DriveFileMeta } from './GoogleApiClient';
import type { GoogleDocsBindingStore } from './GoogleDocsBindingStore';
import {
  bodyClearRange,
  buildPublishPlan,
  htmlToBlocks,
  locatePlaceholders,
  placeholderRequests,
  singleTabRequests,
  tableCellRequests,
  type Block,
} from './mapper';
import { resolveImages, unstageImages } from './imageStaging';
import {
  GOOGLE_DOC_MIME,
  GoogleDocsError,
  docUrlFor,
  type GoogleDocsBindingV1,
  type PublishStage,
} from './types';

export interface PublishInput {
  /** Canonical `file:` URI of the Markdown document. */
  documentUri: string;
  /** Filesystem path of the document, used to resolve relative images. */
  documentPath: string;
  /** Editor export HTML — the same payload PDF and Word export receive. */
  html: string;
  /** Title for a newly created Doc. */
  title: string;
}

export interface SkippedImage {
  source: string;
  reason: string;
}

export type PublishOutcome =
  | { kind: 'created'; binding: GoogleDocsBindingV1; skippedImages: SkippedImage[] }
  | { kind: 'synced'; binding: GoogleDocsBindingV1; skippedImages: SkippedImage[] }
  | { kind: 'up-to-date'; binding: GoogleDocsBindingV1 }
  | { kind: 'cancelled' };

export interface PublishPrompts {
  /** Before the first Sync of a document: Sync replaces the Doc's contents. */
  confirmFirstSync(binding: GoogleDocsBindingV1): Promise<boolean>;
  /** The Doc was edited in Google Docs since Ritemark's last write. */
  confirmRemoteChanged(binding: GoogleDocsBindingV1): Promise<boolean>;
}

export interface GoogleDocsPublisherDependencies {
  account: GoogleAccountService;
  store: GoogleDocsBindingStore;
  now?: () => Date;
  randomId?: () => string;
}

const RECOVERABLE_ON_CREATE = new Set(['offline', 'provider-unavailable', 'unexpected']);

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export class GoogleDocsPublisher {
  private readonly inFlight = new Set<string>();
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly deps: GoogleDocsPublisherDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.randomId = deps.randomId ?? randomUUID;
  }

  isBusy(documentUri: string): boolean {
    return this.inFlight.has(documentUri);
  }

  /**
   * Create when the document has no link yet, Sync when it has one. The
   * caller never picks, so a bound document can never be "created" again.
   */
  async publish(input: PublishInput, prompts: PublishPrompts, onStage: (stage: PublishStage) => void): Promise<PublishOutcome> {
    if (!input.documentUri.startsWith('file:')) throw new GoogleDocsError('untitled-document', 'Only saved files can be published');
    if (this.inFlight.has(input.documentUri)) throw new GoogleDocsError('busy', 'Already publishing this document');
    this.inFlight.add(input.documentUri);
    try {
      const binding = await this.deps.store.get(input.documentUri);
      return binding ? await this.sync(binding, input, prompts, onStage) : await this.create(input, onStage);
    } finally {
      this.inFlight.delete(input.documentUri);
    }
  }

  // ---------------------------------------------------------------- create

  private async create(input: PublishInput, onStage: (stage: PublishStage) => void): Promise<PublishOutcome> {
    const account = this.deps.account;
    const snapshot = account.snapshot();
    if (!snapshot.identity) throw new GoogleDocsError('not-connected', 'No Google account connected');
    const client = account.client;
    onStage('preparing');
    const { blocks, sourceHash } = this.prepare(input);

    const template = snapshot.template;
    if (template) {
      let meta: DriveFileMeta;
      try {
        meta = await client.getFile(template.fileId);
      } catch (error) {
        if (error instanceof GoogleDocsError && (error.code === 'target-not-found' || error.code === 'permission-denied')) {
          throw new GoogleDocsError('template-unavailable', 'Template is no longer available');
        }
        throw error;
      }
      if (meta.trashed || meta.mimeType !== GOOGLE_DOC_MIME) throw new GoogleDocsError('template-unavailable', 'Template is trashed or not a Google Doc');
    }

    const operationId = this.randomId();
    let file: DriveFileMeta;
    try {
      file = template
        ? await client.copyDocument(template.fileId, input.title, operationId)
        : await client.createDocument(input.title, operationId);
    } catch (error) {
      // The request may have reached Google even though the answer did not
      // reach us. Look for the tag before anyone is allowed to try again, so a
      // retry can never produce a second Doc (R5).
      if (!(error instanceof GoogleDocsError) || !RECOVERABLE_ON_CREATE.has(error.code)) throw error;
      const found = await client.findByOperation(operationId).catch(() => null);
      if (!found) throw error;
      file = found;
    }

    onStage('writing');
    if (template) {
      // A multi-tab template would otherwise bring its other tabs' content
      // into the new Doc (found on RunDev 2026-09-21).
      const outline = await client.getDocumentTabs(file.id);
      const tabRequests = singleTabRequests(outline.tabs ?? [], input.title);
      if (tabRequests.length) await client.batchUpdate(file.id, tabRequests);
    }
    const { skipped, revisionId } = await this.writeBody(file.id, blocks, { templated: Boolean(template), documentPath: input.documentPath, onStage });

    onStage('verifying');
    const verified = await client.getFile(file.id);
    if (verified.mimeType !== GOOGLE_DOC_MIME) throw new GoogleDocsError('verification-required', 'Created file is not a Google Doc', { docUrl: docUrlFor(file.id) });

    const nowIso = this.now().toISOString();
    const binding: GoogleDocsBindingV1 = {
      schemaVersion: 1,
      documentUri: input.documentUri,
      accountId: snapshot.identity.accountId,
      accountEmail: snapshot.identity.email,
      fileId: file.id,
      title: verified.name,
      templateFileId: template?.fileId ?? null,
      createdAt: nowIso,
      lastSyncedAt: nowIso,
      lastRevisionId: revisionId,
      lastSourceHash: sourceHash,
      // Creating it was the user's decision; the first overwrite is not.
      overwriteAcknowledged: false,
    };
    try {
      await this.deps.store.put(binding);
    } catch {
      // The Doc exists and must not be orphaned in silence: hand back its link.
      throw new GoogleDocsError('local-binding-failed', 'Could not save the publishing link', { docUrl: docUrlFor(file.id) });
    }
    return { kind: 'created', binding, skippedImages: skipped };
  }

  // ---------------------------------------------------------------- sync

  private async sync(
    binding: GoogleDocsBindingV1,
    input: PublishInput,
    prompts: PublishPrompts,
    onStage: (stage: PublishStage) => void,
  ): Promise<PublishOutcome> {
    const account = this.deps.account;
    const identity = account.identity();
    if (!identity) throw new GoogleDocsError('not-connected', 'No Google account connected');
    // Syncing with whichever account happens to be connected would change the
    // destination's identity; there is no such shortcut (design § Account mismatch).
    if (identity.accountId !== binding.accountId) throw new GoogleDocsError('account-mismatch', 'Bound to another account');

    const client = account.client;
    onStage('preparing');
    const meta = await client.getFile(binding.fileId);
    // Drive accepts a write into a trashed Doc and answers 200; say so instead.
    if (meta.trashed) throw new GoogleDocsError('target-trashed', 'Linked Doc is in the trash', { docUrl: docUrlFor(binding.fileId) });
    if (meta.mimeType !== GOOGLE_DOC_MIME) throw new GoogleDocsError('target-not-found', 'Linked file is not a Google Doc');

    const { blocks, sourceHash } = this.prepare(input);
    const current = await client.getDocument(binding.fileId);
    const remoteChanged = current.revisionId !== binding.lastRevisionId;

    if (!remoteChanged && sourceHash === binding.lastSourceHash) {
      return { kind: 'up-to-date', binding };
    }
    if (remoteChanged) {
      if (!(await prompts.confirmRemoteChanged({ ...binding, title: meta.name }))) return { kind: 'cancelled' };
    } else if (!binding.overwriteAcknowledged) {
      if (!(await prompts.confirmFirstSync({ ...binding, title: meta.name }))) return { kind: 'cancelled' };
    }

    onStage('writing');
    const { skipped, revisionId } = await this.writeBody(binding.fileId, blocks, {
      templated: Boolean(binding.templateFileId),
      documentPath: input.documentPath,
      onStage,
      // What the user just agreed to overwrite, and nothing newer.
      expectedRevisionId: current.revisionId,
    });

    onStage('verifying');
    const next: GoogleDocsBindingV1 = {
      ...binding,
      title: meta.name,
      lastSyncedAt: this.now().toISOString(),
      lastRevisionId: revisionId,
      lastSourceHash: sourceHash,
      overwriteAcknowledged: true,
    };
    try {
      await this.deps.store.put(next);
    } catch {
      throw new GoogleDocsError('local-binding-failed', 'Synced, but could not record it', { docUrl: docUrlFor(binding.fileId) });
    }
    return { kind: 'synced', binding: next, skippedImages: skipped };
  }

  // ---------------------------------------------------------------- shared

  private prepare(input: PublishInput): { blocks: Block[]; sourceHash: string } {
    try {
      // The product's own chokepoint strips Ritemark comments and unsafe
      // markup before anything is sent (R4).
      const normalized = buildNormalizedExportHtml(input.html, { title: '', author: '', date: '' } as never, 'default');
      return { blocks: htmlToBlocks(normalized.html), sourceHash: sha256(normalized.html) };
    } catch (error) {
      throw new GoogleDocsError('conversion-failed', `Could not prepare the document: ${String(error)}`);
    }
  }

  /**
   * Replace the body of `docId` with `blocks`, in the four passes. Returns the
   * images that could not be placed and the revision after Ritemark's write.
   */
  private async writeBody(
    docId: string,
    blocks: Block[],
    options: { templated: boolean; documentPath: string; onStage: (stage: PublishStage) => void; expectedRevisionId?: string },
  ): Promise<{ skipped: SkippedImage[]; revisionId: string }> {
    const client = this.deps.account.client;
    const before = await client.getDocument(docId);
    if (options.expectedRevisionId && before.revisionId !== options.expectedRevisionId) {
      throw new GoogleDocsError('verification-required', 'The Google Doc changed while waiting for confirmation', { docUrl: docUrlFor(docId) });
    }

    const plan = buildPublishPlan(blocks, { spacing: !options.templated });
    const clear = bodyClearRange(before);
    const first = [...(clear ? [{ deleteContentRange: { range: clear } }] : []), ...plan.requests];
    if (first.length) {
      try {
        await client.batchUpdate(docId, first, before.revisionId);
      } catch (error) {
        if (error instanceof GoogleDocsError && error.code === 'verification-required') {
          throw new GoogleDocsError('verification-required', 'The Google Doc changed before Ritemark could write it', { docUrl: docUrlFor(docId) });
        }
        throw error;
      }
    }

    const skipped: SkippedImage[] = [];
    if (plan.placeholders.length) {
      if (plan.images.length) options.onStage('uploading-images');
      const images = await resolveImages(plan.images, options.documentPath, client);
      try {
        const located = locatePlaceholders(await client.getDocument(docId), plan.placeholders);
        const batch = placeholderRequests(located, images.uris, images.reasons);
        skipped.push(...batch.skipped);
        if (batch.requests.length) {
          try {
            await client.batchUpdate(docId, batch.requests);
          } catch (error) {
            // With no images in the batch, the failure is not about images.
            if (!images.uris.size) throw error;
            // One image Google cannot fetch fails the whole batch. Keep the
            // tables, drop the images, and say which ones (never silently).
            // If this retry fails too, the error is real and surfaces as is.
            const withoutImages = placeholderRequests(located, new Map(), new Map(
              plan.images.map((b) => [b, images.reasons.get(b) ?? 'Google could not fetch the image']),
            ));
            skipped.length = 0;
            skipped.push(...withoutImages.skipped);
            if (withoutImages.requests.length) await client.batchUpdate(docId, withoutImages.requests);
          }
        }
      } finally {
        await unstageImages(images.staged, client);
      }

      if (plan.tables.length) {
        const cells = tableCellRequests(await client.getDocument(docId), plan.tables);
        if (cells.length) await client.batchUpdate(docId, cells);
      }
    }

    const after: DocsDocument = await client.getDocument(docId);
    return { skipped, revisionId: after.revisionId };
  }
}
