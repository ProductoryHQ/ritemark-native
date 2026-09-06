export interface DocumentApplyTarget {
  revision: number
  payloadHash: string
}

export interface DocumentConflictState {
  conflictRevision: number
  diskHash: string
  filename: string
}
