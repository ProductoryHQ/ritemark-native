# A2: the page's sandbox, the code side (the live run still to do)

Sprint 149, Phase 1, no account. **This PR records the code side only; nothing was launched.** The spike's live steps (ritemark-dev `releases/v2.2.0/analysis/2026-10-29-spikes/page-sandbox.md`, *Live-check steps*) with `hostile.html` and a decoy local server run later on a hidden dev instance (`open -n -g -j`, `--use-mock-keychain`, a short profile under `/private/tmp`, CDP input only), outside Jarmo's day hours, and again on PR 2's branch (S5). `vscode/…` lines are read from the main checkout's patched submodule at the pin; paths under `vscode/src/vs/`.

## Finding in one line

The code backs every "blocked" row of the spike's escape table, but corrects one premise: the session is the **Global, persistent** one (not Ephemeral), so a local page shares cookies and storage with every site signed in to in Ritemark's browser, as Jarmo accepted (decision 4); and `file://` subresource tags are not covered by VS Code's `file://` guard, so the live run must measure them.

## What the code says, row by row

| Spike row | Code | Expected live |
|---|---|---|
| Separate process, no node, isolated context | `platform/browserView/electron-main/browserView.ts:91–100` (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webviewTag: false`) | `acquireVsCodeApi`, `require`, `process` undefined |
| Only preload is in an isolated world | `platform/browserView/electron-main/browserSession.ts:232–235` (frame preload `preload-browserView.js`) | `window.browserViewAPI` undefined in the page's main world |
| Permissions locked | `browserSession.ts:15–19` (only `pointerLock`, `notifications`, `clipboard-sanitized-write`), handlers `:225–231` | Camera, microphone, geolocation denied without a prompt. **Notifications are allowed**: a page can show a system notification (to check live) |
| Pop-ups | `browserView.ts:111–147`; `consumePopupPermission` `:389–400`: background/foreground tabs **allowed**, a new window only within 1 s of a user gesture | `window.open` without a gesture blocked; a `target=_blank` link opens a tab (this is the path PR 2 reuses) |
| Top navigation | `code/electron-main/app.ts:447–450`: browser views may navigate | The page can navigate its own tab (to a website, or another `file:` page). PR 2's `will-navigate` handler turns that into a new tab (A1) |
| `fetch('file:///…')` | No `allowFileAccessFromFileUrls` in `browserView.ts:91–100`, so Chromium's default (off) holds | Blocked ("Not allowed to load local resource"), as the spike's harness showed |
| `file://` guard | `platform/protocol/electron-main/protocolMainService.ts:55–56` intercepts `file:` on **`defaultSession` only**; the browser's sessions are partitions (`browserSession.ts:117`, `:127`, `:141`) | Not applied to the page. `<img>`, `<script>`, `<link>` with a `file:///…` URL anywhere on disk follow Chromium's file-to-file rules: they can **load and display**, but a file origin is opaque, so the page can't read the bytes back (canvas tainted, no `fetch`). **To measure live**: an `<img src="file:///…/canary.png">` outside the project, and a `<script src="file:///…/canary.js">` |
| The session | `workbench/contrib/browserView/common/browserView.ts:350–361`: `workbench.browser.dataStorage`, default **Global** (`features/browserDataStorageFeatures.ts:142`); Ephemeral only when the workspace is untrusted, and Ritemark turns trust off (`branding/product.json:201`, `security.workspace.trust.enabled: false`) | Every page, local or not, uses `persist:vscode-browser` (`browserSession.ts:116–119`): cookies and `localStorage` persist and are shared by origin. A `file:` page's origin is opaque, so it can't read a website's cookies directly, but it can **send credentialed requests** to sites the person is signed in to (a CSRF-shaped reach), and it can `fetch` the person's `127.0.0.1` servers (decision 5). Recorded, not changed (decision 4) |
| The workbench | Separate `WebContentsView`; the workbench is another CDP target | Unreachable from the page |
| Ritemark's own servers | Sockets and pipes, not TCP (spike, *Remaining risks* 1) | A `127.0.0.1` scan finds none of Ritemark's |

## For the live run

The spike's step 2 expects "cookie/localStorage scoped to the Ephemeral partition": with decision 4 that line now reads "scoped to the Global partition, shared with the browser's other tabs". Add the two `file://` subresource canaries above and a notification check. Pass/fail stays the spike's step 4.
