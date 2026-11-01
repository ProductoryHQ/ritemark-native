import type { DocumentConflictReason } from '../../../src/editorSync/protocol'

export interface DocumentApplyTarget {
  revision: number
  payloadHash: string
}

export interface DocumentConflictState {
  conflictRevision: number
  diskHash: string
  filename: string
  /** Sprint 145 R1 (#588): `held-import` when a writer's copy left out words Ritemark had just saved. */
  reason?: DocumentConflictReason
}
