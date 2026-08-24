import type { DocumentHostMessage, DocumentSyncState } from '../../src/editorSync/protocol'
import type { DocumentConflictState } from './types/documentSync'

export interface DocumentViewSyncState {
  revision: number
  state: DocumentSyncState
  message?: string
  conflict?: DocumentConflictState
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

  if (message.type === 'document:update') {
    return { ...current, revision: message.revision }
  }
  if (message.type === 'document:edit-result') {
    return message.status === 'rejected'
      ? {
          ...current,
          revision: message.revision,
          state: 'failed',
          message: message.message || 'Ritemark could not apply this edit.',
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
      },
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
  }
}

export function selectDocumentSyncAction(state: DocumentViewSyncState): 'conflict' | 'retry' | undefined {
  if (state.state === 'conflict' || state.conflict) return 'conflict'
  if (state.state === 'apply-error' || state.state === 'failed') return 'retry'
  return undefined
}
