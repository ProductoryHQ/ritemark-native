import type { DocumentSyncState } from '../../../../src/editorSync/protocol'

export interface DocumentSyncAction {
  kind: 'conflict' | 'retry'
  label: string
  title?: string
  onClick: () => void
}

/**
 * What the document's bar shows before Share (Sprint 134, R12;
 * `comparison/after-write.png`):
 * - `action`: a save problem's button (Review changes, Retry), whenever there is one;
 * - `saved`: "Saved", when the host says the file on disk matches the editor (`synced`);
 * - `none`: nothing, while an edit waits to be written (`local-only`) or is being
 *   applied (`applying`), so a save that takes a moment never flashes a word.
 */
export type DocumentBarStatus = 'action' | 'saved' | 'none'

export function documentBarStatus(
  syncState: DocumentSyncState | undefined,
  action: DocumentSyncAction | undefined,
): DocumentBarStatus {
  if (action) return 'action'
  return syncState === 'synced' ? 'saved' : 'none'
}
