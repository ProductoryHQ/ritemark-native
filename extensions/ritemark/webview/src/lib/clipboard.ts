// Clipboard helpers for VS Code webview context.
//
// navigator.clipboard is blocked in VS Code's sandboxed iframe.
// Route all clipboard operations through the extension host instead.
//
// NEVER use navigator.clipboard directly in webview code.

import { sendToExtension, onMessage } from '../bridge'

export function writeClipboard(text: string): void {
  sendToExtension('copyToClipboard', { text })
}

export function readClipboard(): Promise<string> {
  return new Promise((resolve) => {
    const unsub = onMessage((msg) => {
      if (msg.type === 'clipboardText') {
        unsub()
        resolve((msg.text as string) ?? '')
      }
    })
    sendToExtension('readClipboard', {})
  })
}
