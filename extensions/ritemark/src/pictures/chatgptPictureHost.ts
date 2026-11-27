/**
 * Pictures with ChatGPT: the editor host's side of the picture bar's ChatGPT items (`chatgptPicture.ts`), for a
 * document and for a deck (one webview kind, one set of messages).
 *
 *  - `picture/check` {requestId}: is ChatGPT ready? Not ready opens its sign-in card on the AI's sheet.
 *  - `picture/make` (`PictureRequest`): the picture made and saved beside the file.
 *  - `picture/cancel` {requestId}: stops that request's turn.
 *  - Answers `picture/status` {requestId, state: 'ready' | 'sign-in' | 'made' | 'failed' | 'cancelled', path?, url?,
 *    problem?}. The editor that asked places a made picture itself (a deck's path is `<deck file>.files/…`, a document's
 *    `./images/…`, as their pasted pictures).
 *
 * A dev run's stand-in (`RITEMARK_PICTURE_STANDIN`, a PNG's path, only in a development build with `VSCODE_DEV=1`):
 * no AI is asked; after a moment the request comes back with that picture, and ChatGPT counts as signed in unless a
 * file `<that path>.signed-out` exists. An installed Ritemark never has it.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentId } from '../agent/types';
import { createRuntime } from '../runtime/runtimeFactory';
import { ONE_SHOT_CANCELLED, runOneShotTurnResult, type OneShotSettings, type OneShotTurnResult } from '../runtime/oneShotTurn';
import type { RuntimeAvailability } from '../runtime/availability';
import { deckPictureFolderName } from '../decks/deckFileName';
import { PICTURE_PROBLEMS, decodePictureRequest, generatedImagesFolder, makePicture, type PictureMakerDeps, type PictureTurn } from './chatgptPicture';

/** What the AI's sheet gives this host. */
export interface PictureSheet {
  runtimeAvailability(runtimeId: AgentId): Promise<RuntimeAvailability>;
  codexAuthMethod?(): Promise<'apiKey' | 'chatgpt' | null>;
  oneShotSettings(runtimeId: AgentId): Promise<OneShotSettings>;
  openLandingChat(runtimeId: AgentId, placeholder: string): Promise<void>;
  /** The sheet on ChatGPT's own card, with its ring (`openLandingChat` alone where the sheet has none). */
  openChatgptSignIn?(placeholder: string): Promise<void>;
}

export const PICTURE_STANDIN_SETTING = 'RITEMARK_PICTURE_STANDIN';
/** The sheet's message box, once ChatGPT's sign-in card has been opened from a picture. */
const SIGN_IN_PLACEHOLDER = 'Ask ChatGPT about this project';

/** The dev run's stand-in picture, or null: only in a development build. */
export function pictureStandIn(env: NodeJS.ProcessEnv): string | null {
  if (env.VSCODE_DEV !== '1') return null;
  const file = env[PICTURE_STANDIN_SETTING]?.trim();
  return file && path.isAbsolute(file) ? file : null;
}

/** The stand-in's turn: the PNG after a moment, as the image tool's bytes; stopped at once by Cancel. */
export function standInTurn(file: string, delayMs = 4_000): (turn: PictureTurn) => Promise<OneShotTurnResult> {
  return (turn) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        resolve({ text: 'Done.', picturesMade: [{ base64: fs.readFileSync(file).toString('base64') }] });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, delayMs);
    turn.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error(ONE_SHOT_CANCELLED));
    }, { once: true });
  });
}

export class ChatgptPictureHost {
  /** The requests running, by webview, so a closed editor stops its own. */
  private readonly running = new Map<vscode.Webview, Map<string, AbortController>>();

  constructor(
    private readonly sheet: () => PictureSheet | null,
    private readonly env: NodeJS.ProcessEnv = process.env,
    /** How long the dev run's stand-in takes, so "ChatGPT is making the picture…" can be seen. */
    private readonly standInMs = 4_000,
  ) {}

  /** True when the message was one of this host's. */
  handle(document: vscode.TextDocument, webview: vscode.Webview, message: { type?: unknown; requestId?: unknown }): boolean {
    if (message.type === 'picture/check') {
      const requestId = typeof message.requestId === 'string' ? message.requestId.slice(0, 100) : '';
      if (requestId) void this.check(webview, requestId);
      return true;
    }
    if (message.type === 'picture/make') {
      void this.make(document, webview, message);
      return true;
    }
    if (message.type === 'picture/cancel') {
      if (typeof message.requestId === 'string') this.running.get(webview)?.get(message.requestId)?.abort();
      return true;
    }
    return false;
  }

  /** The editor closed: its requests stop. */
  disposeFor(webview: vscode.Webview): void {
    for (const controller of this.running.get(webview)?.values() ?? []) controller.abort();
    this.running.delete(webview);
  }

  private deps(): PictureMakerDeps {
    const standIn = pictureStandIn(this.env);
    const sheet = this.sheet();
    return {
      chatgptReady: async () => {
        if (standIn) return !fs.existsSync(`${standIn}.signed-out`);
        if (!sheet) return false;
        return (await sheet.runtimeAvailability('codex')).usable;
      },
      openSignIn: async () => {
        if (sheet?.openChatgptSignIn) await sheet.openChatgptSignIn(SIGN_IN_PLACEHOLDER);
        else await sheet?.openLandingChat('codex', SIGN_IN_PLACEHOLDER);
      },
      ...(standIn || !sheet?.codexAuthMethod ? {} : { authMethod: () => sheet.codexAuthMethod!() }),
      generatedFolder: generatedImagesFolder(this.env, os.homedir()),
      runTurn: standIn
        ? standInTurn(standIn, this.standInMs)
        : async (turn) => {
            if (!sheet) throw new Error('The AI sheet is not ready');
            const settings = await sheet.oneShotSettings('codex');
            return runOneShotTurnResult(createRuntime('codex'), {
              ...settings,
              purpose: 'picture',
              label: 'Picture',
              systemPrompt: turn.systemPrompt,
              prompt: turn.prompt,
              attachments: turn.attachments,
              signal: turn.signal,
              timeoutMs: turn.timeoutMs,
              timeoutMessage: 'ChatGPT took too long to make the picture',
            });
          },
      log: message => console.warn(message),
    };
  }

  private async check(webview: vscode.Webview, requestId: string): Promise<void> {
    const deps = this.deps();
    try {
      if (!(await deps.chatgptReady())) {
        await deps.openSignIn();
        void webview.postMessage({ type: 'picture/status', requestId, state: 'sign-in' });
        return;
      }
      // Signed in with an API key, Codex has no image tool: said before any words are typed.
      if ((await deps.authMethod?.()) === 'apiKey') {
        void webview.postMessage({ type: 'picture/status', requestId, state: 'failed', problem: PICTURE_PROBLEMS.apiKey });
        return;
      }
      void webview.postMessage({ type: 'picture/status', requestId, state: 'ready' });
    } catch (error) {
      console.warn('[pictures] Could not check ChatGPT:', error);
      void webview.postMessage({ type: 'picture/status', requestId, state: 'failed', problem: 'ChatGPT couldn\'t be checked. Try again.' });
    }
  }

  private async make(document: vscode.TextDocument, webview: vscode.Webview, message: unknown): Promise<void> {
    const request = decodePictureRequest(message);
    if (!request) {
      // A request the host can't take still gets its answer, so the strip never waits for nothing.
      const raw = message as { requestId?: unknown; mode?: unknown; source?: unknown };
      if (typeof raw.requestId === 'string' && raw.requestId) {
        const problem = raw.mode === 'change' && !(typeof raw.source === 'string' && raw.source.trim())
          ? 'ChatGPT can\'t change this picture: it isn\'t a file in this project.'
          : 'ChatGPT couldn\'t take this request. Describe the picture and try again.';
        void webview.postMessage({ type: 'picture/status', requestId: raw.requestId.slice(0, 100), state: 'failed', problem });
      }
      return;
    }
    if (document.uri.scheme !== 'file') {
      void webview.postMessage({ type: 'picture/status', requestId: request.requestId, state: 'failed', problem: 'Save the document first, then make a picture for it.' });
      return;
    }
    const controller = new AbortController();
    const mine = this.running.get(webview) ?? new Map<string, AbortController>();
    this.running.set(webview, mine);
    mine.set(request.requestId, controller);
    const documentPath = document.uri.fsPath;
    const documentFolder = path.dirname(documentPath);
    const pictureFolder = request.slideId ? deckPictureFolderName(documentPath) : 'images';
    const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? documentFolder;
    try {
      const outcome = await makePicture(this.deps(), { request, documentPath, root, signal: controller.signal });
      // A Cancel or a closed editor after the picture was saved: it is neither placed nor told.
      if (outcome.kind === 'made' && controller.signal.aborted) {
        await fs.promises.unlink(path.join(documentFolder, pictureFolder, outcome.file)).catch(() => undefined);
        void webview.postMessage({ type: 'picture/status', requestId: request.requestId, state: 'cancelled' });
      } else if (outcome.kind === 'made') {
        const url = webview.asWebviewUri(vscode.Uri.file(path.join(documentFolder, pictureFolder, outcome.file))).toString();
        const written = `${request.slideId ? '' : './'}${pictureFolder}/${outcome.file}`;
        void webview.postMessage({ type: 'picture/status', requestId: request.requestId, state: 'made', path: written, url });
      } else {
        void webview.postMessage({ type: 'picture/status', requestId: request.requestId, state: outcome.kind, ...(outcome.kind === 'failed' ? { problem: outcome.problem } : {}) });
      }
    } catch (error) {
      console.warn('[pictures] ChatGPT picture failed:', error);
      void webview.postMessage({ type: 'picture/status', requestId: request.requestId, state: 'failed', problem: 'ChatGPT couldn\'t make the picture. Try again.' });
    } finally {
      mine.delete(request.requestId);
      if (!mine.size) this.running.delete(webview);
    }
  }
}
