// VS Code webview API bridge

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

// Get VS Code API (only available in webview context)
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null

export interface Message {
  type: string
  [key: string]: unknown
}

/**
 * Send a message to the VS Code extension
 */
export function sendToExtension(type: string, data: Record<string, unknown> = {}) {
  if (vscode) {
    vscode.postMessage({ type, ...data })
  } else {
    console.log('[Bridge] Would send to extension:', { type, ...data })
  }
}

/**
 * Listen for messages from the VS Code extension
 */
export function onMessage(callback: (message: Message) => void) {
  window.addEventListener('message', (event) => {
    const message = event.data as Message
    callback(message)
  })
}

/**
 * Save state to VS Code (persists across webview re-renders)
 */
export function saveState(state: unknown) {
  if (vscode) {
    vscode.setState(state)
  }
}

/**
 * Get saved state from VS Code
 */
export function getState<T>(): T | undefined {
  if (vscode) {
    return vscode.getState() as T
  }
  return undefined
}
