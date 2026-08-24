export interface DocumentSyncAction {
  kind: 'conflict' | 'retry'
  label: string
  title?: string
  onClick: () => void
}
