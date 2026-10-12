# Sprint 131 research: current-state audit of Browser Recent

**Date:** 2026-10-12. **Base:** `main` at `e77a1dee`; VS Code pin `10c8e557`. Only code was read; nothing was run. Each fact below cites the file and line it comes from. Facts that still need a running instance are listed under [Not verified yet](#not-verified-yet). Phase 0 checks them.

## TL;DR

- Recent is written in exactly one place, and that place is not browsing. `BrowserHistoryStore.record()` is called only from `openInIntegratedBrowser()` (`extensions/ritemark/src/browser/IntegratedBrowser.ts:36`). Address-bar navigation, link clicks, back/forward, AI-agent navigation and the `.html` file opener (patch 010's editor resolver) record nothing. Issue #195 is right.
- The workbench already has every event we need. The browser's main process fires `onDidNavigate` for full loads, in-page (SPA, `#anchor`) changes and failed loads, and `onDidChangeTitle` when the page title settles. Nothing forwards them to the extension.
- Patch 009 already has the pattern the fix needs. Its file `ritemarkBrowserContextFeature.ts` registers a `BrowserEditorContribution` (`RitemarkBrowserAnnotationContribution`), and that contribution follows the model of whatever browser tab an editor pane is showing. A second contribution in the same file can forward navigations to the extension. It needs no hunk in any upstream VS Code file, so patch 010 (stacked on 009's upstream hunks) is untouched.
- Extension updates for 1.14 require app 1.14 (`minimumAppVersion` = base version, `scripts/release-extension.sh:179`, enforced in `src/update/updateService.ts:337`). An extension that expects the bridge can never run on a shell without it. So the old programmatic record call can be removed safely, and no extension-only polling variant is needed.

## The store and the list (extension)

| Fact | Where |
|---|---|
| Store is an MRU list in `globalState` under `ritemark.browser.recentUrls`, max 25, newest first, deduped by exact string match. Entry = `{ url, visitedAt }`. No title. | `src/browser/BrowserHistoryStore.ts:3-30` |
| Sole write site: `openInIntegratedBrowser()` calls `historyStore?.record(url)` after `workbench.action.browser.open`. It records the **normalized input** (`https://ritemark.app`), not the address the page ends up at. | `src/browser/IntegratedBrowser.ts:33-37` |
| `normalizeBrowserUrl` adds `https://` (or `http://` for `localhost:port`) but keeps the string otherwise, so `https://ritemark.app` and the page's real `https://ritemark.app/` would be two entries under exact-match dedupe. | `src/browser/IntegratedBrowser.ts:17-31` |
| Callers of `openInIntegratedBrowser`: terminal links, `ritemark.browser.openUrl`, `ritemark.browser.openInBrowser` (file context menu), `ritemark.browser.history.open` (clicking a Recent row). | `src/extension.ts:827, 844, 913, 935` |
| The AI agent's navigate tool does **not** go through it. It calls `workbench.action.browser.agentNavigate` (patch 010), so agent navigation is not recorded today either. Issue #195 says it is; the code says otherwise. | `src/browser/BrowserActionTools.ts:19, 111` |
| `.html` files open straight into the browser editor via patch 010's editor resolver, also bypassing the record call. | `src/extension.ts:804-808` (comment), patch 010 |
| Wiring: store created in `activate`, handed to `IntegratedBrowser` via `setBrowserHistoryStore`, panel registered with `retainContextWhenHidden: true`. | `src/extension.ts:811-823` |
| The panel (`ritemark.browserView`, named "Recent" in the "Browser" container) renders `name` = host (or file basename) and `description` = path. Tooltip = full URL. Empty state already promises "Pages you visit in Ritemark Browser appear here." | `src/browser/BrowserPanelProvider.ts:22-33, 82-89, 186-189`; `package.json` views |
| The panel refreshes only on the store's local `onDidChange`. Another window's writes appear on the next local change. | `src/browser/BrowserPanelProvider.ts:47` |
| `file://` entries are never checked. A deleted file stays in the list forever, and clicking it opens an error page. | `BrowserHistoryStore.ts`, `BrowserPanelProvider.ts` (no stat anywhere) |
| Extension activates on `*`. | `package.json` `activationEvents` |
| Existing browser unit tests run with `npx tsx` and a `vscode` stub, wired into `npm test`. | `src/browser/browserActionTools.test.ts:1-40`; `package.json` `scripts.test` |

## The workbench side (VS Code at pin `10c8e557`)

| Fact | Where |
|---|---|
| `did-navigate` **and** `did-navigate-in-page` both fire `onDidNavigate` with `{ url, title: webContents.getTitle(), canGoBack, canGoForward, certificateError }`. So SPA route changes (pushState) and `#anchor` jumps arrive as navigations. | `src/vs/platform/browserView/electron-main/browserView.ts:222-231, 288-289` |
| A failed main-frame load (DNS typo, offline, refused) fires a loading event carrying the error **and then** `onDidNavigate` with `title: ''` for the failed URL. Without a filter, a typo would be recorded. | same file `:244-267` |
| `page-title-updated` fires `onDidChangeTitle({ title })`. At `did-navigate` time the title is usually not known yet, so it comes in this later event. | same file `:218-220` |
| The workbench model updates its own `url`, `title` and `error` from these events in listeners registered at `initialize()`. Those listeners run before any listener added later, such as a contribution's. | `src/vs/workbench/contrib/browserView/common/browserView.ts:389-421` |
| The model exposes `id`, `url`, `title`, `error`, `storageScope` (`Global` / `Workspace` / `Ephemeral`). Untrusted workspaces always browse in an ephemeral session. | same file `:160-190, 340-368` |
| `BrowserEditorContribution.subscribeToModel(model, store)` runs every time an editor pane gets a model (tab shown); the store is cleared when the pane switches tabs. One `BrowserEditor` pane exists per editor group, including auxiliary windows. | `src/vs/workbench/contrib/browserView/electron-browser/browserEditor.ts:67-91, 330-333, 407` |
| A link opened "in a new tab" in the background is opened as an `inactive` editor, so no pane shows it until the user switches to it. Its first page load happens while no contribution is listening. | same file `:601-624` |
| Patch 009 already uses this mechanism: `RitemarkBrowserAnnotationContribution` registered with `BrowserEditor.registerContribution`. | patched `features/ritemarkBrowserContextFeature.ts:71-94` |
| `ICommandService.executeCommand(id)` for a command that is not registered yet waits for the `onCommand:` activation event and for `*` activation (raced against the command's registration), then runs it or throws "command not found". So a restored tab that loads before the extension is up is delivered once the extension registers, and a missing listener is a catchable error, not a hang. | `src/vs/workbench/services/commands/common/commandService.ts:52-93` |

## Patch stack facts that matter here

- Patch 009 has 4 files: two upstream hunks (`platform/browserView/common/browserView.ts`, `workbench/contrib/browserView/common/browserView.ts`), one import in `browserView.contribution.ts`, and the new file `features/ritemarkBrowserContextFeature.ts`.
- Patch 010 has 4 files. Its upstream hunks use lines that 009 added as context. Its own feature file is `ritemarkBrowserActionFeature.ts`. **It does not change `ritemarkBrowserContextFeature.ts`**. The only mention of that file in 010 is a context line, 009's import in `browserView.contribution.ts` (010 line 138). No other patch mentions it.
- Lines in the model this sprint reads: `error` (`:172`), `storageScope` (`:174`, `Ephemeral` for untrusted workspaces `:345`).
- Patch work must start from a pristine tree (`reset --hard` + `clean -fd -e extensions/ritemark`). Patches that create files leave them behind otherwise and then look like they "do not apply". Pre-commit Check 8 gates nothing; read the dry-run "Can apply / Conflicts" counts yourself. (Memory: patch-stack apply facts, 2026-09-26.)

## Options considered

| Option | What | Verdict |
|---|---|---|
| A. Bridge in patch 009 (issue's proposal) | A second `BrowserEditorContribution` in the file 009 already creates forwards each top-level navigation and title change to an extension command. The extension filters and records. | **Chosen.** Complete, event-driven, no new patch file, no new hunk in upstream VS Code files. |
| B. Extension-only poll | Poll `getActiveContext` on panel focus/visibility and record deltas. | **Dropped.** It misses every page between two polls (the issue calls it lossy), and v1.14.0 is a full app release anyway (Sprint 129 binaries, Sprint 130 icon, this patch), so a stopgap would ship in the same build as the real fix. |
| C. Global listener on the workbench service | Patch `BrowserViewWorkbenchService` to emit "model created" and listen to every model, visible or not. | Rejected. It adds a hunk to an upstream file, which raises the risk on every VS Code update. It would only add pages that load in tabs nobody is looking at. Option A covers those when the tab is first shown (see the technical plan, W1). |

## Not verified yet

These need a running, patched dev instance and are Phase 0 probe items (technical plan W0):

1. When the bridge's `onDidNavigate` listener runs for a failed load, `model.error` is already set. That is the ordering argument above; it needs a probe with a typo host.
2. The value of `webContents.getTitle()` at `did-navigate` for a page without a `<title>` (expected: the URL, Chromium's fallback) and for a `file://` page.
3. Whether a link opened in a background tab has its final URL in `model.url` when the tab is first shown.
4. That a tab restored at startup is delivered after the extension activates and raises no error notification.
5. Whether back/forward produce `did-navigate` (expected yes) and whether a reload produces a same-URL `did-navigate` (expected yes).
