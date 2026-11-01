import type { DocumentConflictReason, DocumentParagraphConflict } from '../../../src/editorSync/protocol'

export interface DocumentApplyTarget {
  revision: number
  payloadHash: string
  /** Sprint 145 R1 (#588): a merge of a writer's copy; the editor takes it as one undo step. */
  undoable?: boolean
}

/** Sprint 145 R1 (#588): places both the person and a writer changed. */
export interface DocumentParagraphsState {
  items: DocumentParagraphConflict[]
  /** The AI that wrote the copy, when Ritemark knows it. */
  writer?: string
}

export interface DocumentConflictState {
  conflictRevision: number
  diskHash: string
  filename: string
  /** Sprint 145 R1 (#588): `held-import` when a writer's copy left out words Ritemark had just saved. */
  reason?: DocumentConflictReason
}
