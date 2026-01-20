// VS Code webview API bridge
//
// This module provides communication between the webview and VS Code extension:
// 1. sendToExtension / onMessage - Communication with VS Code extension
// 2. emitInternalEvent / onInternalEvent - Communication within webview components
//
// INTERNAL EVENTS are used for coordinating UI state between webview components
// without involving the extension. Example: dictation state changes need to update
// both the mic button AND insert placeholder text in editor.

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
 * Returns an unsubscribe function to clean up the listener
 */
export function onMessage(callback: (message: Message) => void): () => void {
  const handler = (event: MessageEvent) => {
    const message = event.data as Message
    callback(message)
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
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

// ============================================================================
// INTERNAL EVENT SYSTEM
// ============================================================================
// Used for communication WITHIN the webview, between components.
// Does NOT communicate with VS Code extension.
//
// Example flow for dictation:
// 1. useVoiceDictation hook calls emitInternalEvent('dictation:listening-started')
// 2. App.tsx receives this via onInternalEvent and inserts "Listening..." placeholder
// 3. When transcription arrives, placeholder is replaced with actual text
// ============================================================================

/**
 * Internal event interface
 */
export interface InternalEvent {
  type: string
  data?: unknown
}

// Registry of listeners for the multi-event pattern
const internalEventListeners: ((event: InternalEvent) => void)[] = []

/**
 * Emit an internal event within the webview (not sent to extension)
 *
 * This dispatches:
 * 1. A CustomEvent for specific listeners (onInternalEvent with eventType)
 * 2. A notification to multi-event listeners (onInternalEvent with callback only)
 */
export function emitInternalEvent(eventType: string, data?: unknown) {
  // Dispatch as CustomEvent for specific listeners
  window.dispatchEvent(new CustomEvent(eventType, { detail: data }))

  // Also notify multi-event listeners
  const event: InternalEvent = { type: eventType, data }
  internalEventListeners.forEach(listener => listener(event))
}

/**
 * Listen for internal events within the webview
 *
 * Two usage patterns:
 * 1. Specific event: onInternalEvent('dictation:started', (data) => { ... })
 * 2. Multi-event: onInternalEvent((event) => { switch(event.type) { ... } })
 */
export function onInternalEvent(
  eventTypeOrCallback: string | ((event: InternalEvent) => void),
  callback?: (data?: unknown) => void
) {
  if (typeof eventTypeOrCallback === 'string' && callback) {
    // Pattern 1: Specific event type
    window.addEventListener(eventTypeOrCallback, ((event: CustomEvent) => {
      callback(event.detail)
    }) as EventListener)
  } else if (typeof eventTypeOrCallback === 'function') {
    // Pattern 2: Multi-event callback
    internalEventListeners.push(eventTypeOrCallback)
  }
}
