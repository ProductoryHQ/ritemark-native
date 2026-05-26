import { onMessage, sendToExtension } from '../bridge'

export type WorkspaceFileKind = 'markdown' | 'document' | 'data' | 'image' | 'other'

export interface WorkspaceFileLinkResult {
  label: string
  relativePath: string
  workspacePath: string
  directory: string
  extension: string
  kind: WorkspaceFileKind
}

export interface WorkspaceFileSearchResponse {
  results: WorkspaceFileLinkResult[]
  unavailableReason?: string
}

interface PendingRequest {
  resolve: (response: WorkspaceFileSearchResponse) => void
  timeout: ReturnType<typeof setTimeout>
}

const pendingRequests = new Map<string, PendingRequest>()
let listenerAttached = false
let requestCounter = 0

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true

  onMessage((message) => {
    if (message.type !== 'workspaceFileSearchResults') return
    const requestId = typeof message.requestId === 'string' ? message.requestId : ''
    const pending = pendingRequests.get(requestId)
    if (!pending) return

    pendingRequests.delete(requestId)
    clearTimeout(pending.timeout)
    pending.resolve({
      results: Array.isArray(message.results)
        ? (message.results as WorkspaceFileLinkResult[])
        : [],
      unavailableReason: typeof message.unavailableReason === 'string'
        ? message.unavailableReason
        : undefined,
    })
  })
}

export function requestWorkspaceFileSearch(
  query: string,
  limit = 20
): Promise<WorkspaceFileSearchResponse> {
  ensureListener()

  const requestId = `file-search-${Date.now()}-${requestCounter++}`
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      resolve({
        results: [],
        unavailableReason: 'File search timed out.',
      })
    }, 5000)

    pendingRequests.set(requestId, { resolve, timeout })
    sendToExtension('searchWorkspaceFiles', {
      requestId,
      query,
      limit,
    })
  })
}
