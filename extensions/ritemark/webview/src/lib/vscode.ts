/**
 * VS Code API Singleton
 *
 * Ensures acquireVsCodeApi() is only called once per webview.
 * Uses a global variable to share across modules (bridge.ts, FlowEditor, etc.)
 */

// VS Code API type
interface VSCodeAPI {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VSCodeAPI;

// Use window-level singleton to ensure only one call per webview
declare global {
  interface Window {
    __vscodeApi?: VSCodeAPI;
  }
}

function getOrCreateVsCodeApi(): VSCodeAPI {
  if (typeof window !== 'undefined' && window.__vscodeApi) {
    return window.__vscodeApi;
  }

  if (typeof acquireVsCodeApi !== 'undefined') {
    const api = acquireVsCodeApi();
    if (typeof window !== 'undefined') {
      window.__vscodeApi = api;
    }
    return api;
  }

  // Fallback for non-VS Code environments (dev mode)
  console.warn('[vscode] acquireVsCodeApi not available');
  return {
    postMessage: (msg) => console.log('[vscode] postMessage:', msg),
    getState: () => null,
    setState: () => {},
  };
}

export const vscode = getOrCreateVsCodeApi();
export const getVsCodeApi = () => vscode;
