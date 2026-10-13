/**
 * boardSurface — one board webview (the Tasks side bar, the Task board tab or a
 * card's page in the editor) connected to the board (Sprint 130, #119).
 *
 * The surfaces speak the same protocol and see the same snapshot, so this is
 * the one place that turns their messages into controller calls and the
 * controller's snapshots into messages. Requests are decoded first
 * (`decodeBoardRequest`); a malformed one is answered with its reason, never
 * half-applied.
 */

import * as vscode from 'vscode';
import type { BoardController } from './BoardController';
import {
  BoardProtocolError,
  decodeBoardRequest,
  isBoardRequest,
  type BoardAnswer,
  type BoardHostMessage,
  type BoardRecoverAction,
  type BoardRequest,
  type BoardSnapshot,
  type BoardSurface,
  type BoardTab,
} from './protocol';

/** What the board needs from the rest of the extension. */
export interface BoardHostActions {
  openBoard(target: { tab?: BoardTab }): Promise<void>;
  openFile(relativePath: string): Promise<void>;
  /** A card's page in the editor; a card file that won't read opens as a plain document. */
  openCard(target: { cardId?: string; fileName?: string }): Promise<void>;
  addFiles(cardId: string): Promise<void>;
  recover(action: BoardRecoverAction): Promise<void>;
}

export interface BoardSurfaceContext {
  /** Null when there is no folder or the board is turned off. */
  controller: BoardController | null;
  /** The snapshot a surface shows without a controller. */
  emptySnapshot(): BoardSnapshot;
  actions: BoardHostActions;
  /** A surface finished loading (the host refreshes the agents' availability). */
  onReady?: () => void;
  /** The card whose page is the active editor tab, for the side bar's highlight. */
  activePage?: {
    current(): string | null;
    onDidChange(listener: (cardId: string | null) => void): () => void;
  };
}

export interface BoardSurfaceConnection extends vscode.Disposable {
  /** Show a view on this surface (the board tab, opened from the side bar). */
  focus(target: { tab?: BoardTab }): void;
}

export function connectBoardSurface(
  webview: vscode.Webview,
  surface: BoardSurface,
  context: BoardSurfaceContext,
  options: { onRequest?: (request: BoardRequest) => void } = {},
): BoardSurfaceConnection {
  let ready = false;
  let pendingFocus: { tab?: BoardTab } | null = null;
  const post = (message: BoardHostMessage) => {
    void webview.postMessage(message);
  };
  const unsubscribe = context.controller?.subscribe((snapshot) => {
    if (ready) post({ type: 'board/state', snapshot });
  });
  const stopActive = context.activePage?.onDidChange((cardId) => {
    if (ready) post({ type: 'board/active-page', cardId });
  });

  const receiving = webview.onDidReceiveMessage(async (raw: unknown) => {
    if (!isBoardRequest(raw)) return;
    let request: BoardRequest;
    try {
      request = decodeBoardRequest(raw);
    } catch (error) {
      const requestId = (raw as { requestId?: unknown }).requestId;
      if (error instanceof BoardProtocolError && typeof requestId === 'string') {
        post({ type: 'board/result', requestId, answer: { ok: false, code: error.code, message: error.message } });
      }
      return;
    }
    if (request.type === 'board/ready') {
      ready = true;
      context.onReady?.();
      post({ type: 'board/state', snapshot: context.controller ? await context.controller.snapshot() : context.emptySnapshot() });
      if (context.activePage) post({ type: 'board/active-page', cardId: context.activePage.current() });
      if (pendingFocus) {
        post({ type: 'board/focus', ...pendingFocus });
        pendingFocus = null;
      }
      return;
    }
    options.onRequest?.(request);
    const answer = await route(request, context);
    if ('requestId' in request && answer) post({ type: 'board/result', requestId: request.requestId, answer });
  });

  return {
    focus(target) {
      if (ready) post({ type: 'board/focus', ...target });
      else pendingFocus = target;
    },
    dispose() {
      unsubscribe?.();
      stopActive?.();
      receiving.dispose();
    },
  };
}

async function route(request: Exclude<BoardRequest, { type: 'board/ready' }>, context: BoardSurfaceContext): Promise<BoardAnswer | null> {
  const { controller, actions } = context;
  // Requests that do not need a board.
  switch (request.type) {
    case 'board/recover':
      await actions.recover(request.action);
      return null;
    case 'board/open-file':
      await actions.openFile(request.path);
      return null;
    case 'board/open-card':
      await actions.openCard({ cardId: request.cardId, fileName: request.fileName });
      return null;
    case 'board/open':
      await actions.openBoard({ tab: request.tab });
      return null;
    case 'board/add-files':
      await actions.addFiles(request.cardId);
      return null;
  }
  if (!controller) {
    const snapshot = context.emptySnapshot();
    return snapshot.folder === null
      ? { ok: false, code: 'no-folder', message: 'Open a folder to keep a task board.' }
      : { ok: false, code: 'disabled', message: 'The task board is turned off.' };
  }
  switch (request.type) {
    case 'board/add':
      return controller.add({ title: request.title, stage: request.stage });
    case 'board/update':
      return controller.update(request.cardId, {
        title: request.title,
        doneWhen: request.doneWhen,
        description: request.description,
        files: request.files,
      });
    case 'board/move':
      return controller.move(request.cardId, request.stage, { beforeCardId: request.beforeCardId, atEnd: request.atEnd });
    case 'board/mark-done':
      return controller.markDone(request.cardId);
    case 'board/delete':
      return controller.remove(request.cardId);
    case 'board/drop':
      return controller.setDropped(request.cardId, true);
    case 'board/archive':
      return controller.archive(request.cardId);
    case 'board/restore':
      return controller.restore(request.cardId);
    case 'board/archive-done':
      return controller.archiveDone();
    case 'board/bring-back':
      return controller.setDropped(request.cardId, false);
    case 'board/give':
      return controller.give(request.cardId, request.runtimeId, { force: request.force, overLimit: request.overLimit });
    case 'board/queue':
      return controller.queue(request.cardId, request.runtimeId);
    case 'board/wait':
      return controller.wait(request.cardId, request.runtimeId);
    case 'board/unwait':
      return controller.unwait(request.cardId);
    case 'board/follow-up':
      return controller.followUp(request.cardId, request.text, request.runtimeId);
    case 'board/answer':
      return controller.answer(request.cardId, request.optionIndex);
    case 'board/retry':
      return controller.retry(request.cardId, request.runtimeId);
    case 'board/stop':
      return controller.stop(request.cardId);
    case 'board/open-conversation':
      return controller.openConversation(request.cardId);
    case 'board/review-idea':
      return controller.reviewIdea(request.cardId, request.runtimeId);
    case 'board/accept-review':
      return controller.acceptReview(request.cardId);
    case 'board/set-wip':
      return controller.setWipLimit(request.limit);
  }
}

/** The HTML shell every board webview loads: the shared bundle, routed by
 *  `data-editor-type`. */
export function boardHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  editorType: 'tasks-panel' | 'task-board',
  title: string,
): string {
  const nonce = nonceOf();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  const background = editorType === 'tasks-panel' ? 'var(--vscode-sideBar-background)' : 'var(--vscode-editor-background)';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data:;">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: ${background} !important;
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="${editorType}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function nonceOf(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
