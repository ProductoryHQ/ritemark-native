import type { DocumentHostMessage, DocumentSyncState } from '../../src/editorSync/protocol'
import type { DocumentConflictState, DocumentParagraphsState } from './types/documentSync'

export interface DocumentViewSyncState {
  revision: number
  state: DocumentSyncState
  message?: string
  conflict?: DocumentConflictState
  /** Sprint 145 R1 (#588): places both the person and a writer changed, waiting for Review changes. */
  paragraphs?: DocumentParagraphsState
}

export const initialDocumentViewSyncState: DocumentViewSyncState = {
  revision: 0,
  state: 'synced',
}

export function reduceDocumentViewSync(
  current: DocumentViewSyncState,
  message: DocumentHostMessage,
): DocumentViewSyncState {
  if (message.revision < current.revision) return current

  if (message.type === 'document:paragraphs') {
    return {
      ...current,
      revision: message.revision,
      paragraphs: message.items.length ? { items: message.items, ...(message.writer ? { writer: message.writer } : {}) } : undefined,
    }
  }
  if (message.type === 'document:update') {
    return { ...current, revision: message.revision }
  }
  if (message.type === 'document:edit-result') {
    return message.status === 'rejected' || message.status === 'stale'
      ? {
          ...current,
          revision: message.revision,
          state: 'failed',
          message: message.message || (message.status === 'stale'
            ? 'The document advanced before Ritemark could preserve this edit.'
            : 'Ritemark could not apply this edit.'),
        }
      : { ...current, revision: message.revision }
  }
  if (message.type === 'document:conflict') {
    return {
      revision: message.revision,
      state: 'conflict',
      conflict: {
        conflictRevision: message.conflictRevision,
        diskHash: message.diskHash,
        filename: message.filename,
        ...(message.reason ? { reason: message.reason } : {}),
      },
      ...(current.paragraphs ? { paragraphs: current.paragraphs } : {}),
    }
  }

  const conflict = message.conflictRevision !== undefined && message.diskHash
    ? current.conflict && current.conflict.conflictRevision === message.conflictRevision
      ? current.conflict
      : undefined
    : undefined
  return {
    revision: message.revision,
    state: message.state,
    message: message.message,
    conflict,
    ...(current.paragraphs ? { paragraphs: current.paragraphs } : {}),
  }
}

export function selectDocumentSyncAction(state: DocumentViewSyncState): 'conflict' | 'retry' | 'paragraphs' | undefined {
  if (state.state === 'conflict' || state.conflict) return 'conflict'
  if (state.state === 'apply-error' || state.state === 'failed') return 'retry'
  if (state.paragraphs?.items.length) return 'paragraphs'
  return undefined
}
