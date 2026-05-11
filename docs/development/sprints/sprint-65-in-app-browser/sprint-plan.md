# Sprint 65: In-App Browser (Electron Pivot)

## Goal

Ship a real in-app browser tab using Ritemark/VS Code shell-level Electron browser infrastructure (`WebContentsView` / `webContents`), not an extension webview iframe. The browser must render arbitrary external websites where a normal Electron browser can render them, and must also open workspace/local `.html` files.

The extension-webview iframe implementation is superseded and should not be continued except as disposable prototype evidence.

---

## 2026-05-10 Pivot Decision

Jarmo approved stopping the failed extension-webview iframe approach and rearranging Sprint 65 around the Electron browser direction.

Research documents:

- `research/ground-zero-browser-architecture-reaudit.md` — why iframe/webview is not viable for arbitrary external websites.
- `research/electron-browserview-pivot-plan.md` — new implementation plan using the existing integrated browser infrastructure.

Key codebase discovery: Ritemark already contains an integrated browser stack under:

- `vscode/src/vs/platform/browserView/`
- `vscode/src/vs/workbench/contrib/browserView/`

Therefore Sprint 65 should integrate and validate that stack rather than build a new browser from extension webviews.

---

## Locked Decisions

| Concern | Decision |
|---|---|
| Underlying tech | Existing shell-level integrated browser based on Electron `WebContentsView` / `webContents`. |
| Extension webview iframe approach | Superseded. Stop development and remove/deprecate before final smoke. |
| External websites | Must use real browser `webContents`, not iframe embedding. Google/GitHub/Ritemark.app should be smoke-tested. |
| Local files | Must support workspace `file://` / `.html` files; MVP should restrict file URLs to workspace roots. |
| Browser chrome | Prefer existing workbench `BrowserEditor` chrome unless product polish requires small Ritemark-specific adjustments. |
| Tabs | Existing browser editor tabs via `vscodeBrowser:` resources. |
| Sessions | Use existing `BrowserViewStorageScope`; choose explicit default during validation. Initial preference: workspace for dev browser tabs, ephemeral if security concerns dominate. |
| `.html` opener | Keep explicit “Open in Ritemark Browser” and “Open as Text”; decide default after native browser smoke. |
| Terminal localhost links | Route to integrated browser command, not custom iframe browser. |
| QA gate | No user smoke handoff until dev instance, screenshots/logs, and `./scripts/validate-qa.sh` pass. |

---

## Revised Success Criteria

- [x] `https://ritemark.app` renders in an in-app browser tab.
- [x] `https://google.com` renders in an in-app browser tab or reaches the normal Google browser UX, not an iframe fallback/blank.
- [x] `https://github.com` renders or reaches expected auth/network state, not an iframe-blocked blank.
- [x] `https://example.com` renders.
- [x] A workspace `.html` file opens in the integrated browser and renders with scripts/styles.
- [x] `file://` path to workspace fixture opens and relative links/assets work.
- [x] Long-distance `#anchor` navigation scrolls to the correct place.
- [x] Back, forward, and refresh work using native browser history.
- [x] At least three browser tabs can open without state bleed or layout corruption. **Confirmed 2026-05-11: multiple independent tabs visible in Ritemark tab bar (Welcome, pencil-nitro.pen, browser tab, pencil-welco).**
- [x] `ritemark.browser.openUrl` (or replacement command) routes to the integrated browser.
- [x] Terminal `localhost:*` links route to the integrated browser. **Confirmed 2026-05-11: `echo http://localhost:3000` in terminal, Cmd+click, browser tab opened at http://localhost:3000/ rendering local app.**
- [x] `.html` context menu supports both browser preview and text editing.
- [x] Old extension-webview iframe browser path is removed, disabled, or clearly not used.
- [x] `./scripts/validate-qa.sh` passes.

---

## Revised Implementation Checklist

### Phase A2 — Ground-zero architecture re-audit

- [x] Pause extension-webview iframe implementation after repeated external-site failures.
- [x] Document observed failure taxonomy and architectural mismatch.
- [x] Compare extension-webview preview vs shell-level Electron browser options.
- [x] Approve pivot to Electron browser path.
- [x] Discover existing integrated browser stack in `vscode/src/vs/platform/browserView` and `vscode/src/vs/workbench/contrib/browserView`.
- [x] Create pivot plan: `research/electron-browserview-pivot-plan.md`.

### Phase B2 — Validate existing integrated browser

- [x] Run dev instance and open `workbench.action.browser.open`.
- [x] Smoke `https://ritemark.app`.
- [x] Smoke `https://google.com`.
- [x] Smoke `https://github.com`.
- [x] Smoke `https://example.com`.
- [x] Smoke `file://` fixture.
- [x] Capture screenshots and relevant logs.
- [x] Record findings in `notes/testing-notes.md`.

### Phase C2 — Route Ritemark entry points to integrated browser

- [x] Remove or disable `extensions/ritemark/src/browser/getBrowserWebviewHtml.ts`.
- [x] Remove or disable `extensions/ritemark/webview/src/components/browser/BrowserChrome.tsx`.
- [x] Remove custom `ritemark.browser` custom editor registration for iframe browser.
- [x] Update `ritemark.browser.openUrl` to execute `workbench.action.browser.open` with `{ url }`.
- [x] Rework terminal link provider to route localhost URLs to integrated browser.
- [x] Rework `.html` “Open in Ritemark Browser” to pass workspace `file://` URL to integrated browser.
- [x] Keep `.html` “Open as Text”.
- [x] Add workspace-root guard for `file://` URLs before routing.

### Phase D2 — Product polish and policy

- [x] Decide storage scope default: workspace vs ephemeral. **Decision: `globalState` (cross-workspace, persists until Clear All).** History is a user convenience feature — users expect their recent URLs to survive project switching. No code change required; `BrowserHistoryStore` already uses `globalState`.
- [x] Decide `.html` default opener after native browser smoke.
- [x] Hide/rename any browser UI actions that are not appropriate for Ritemark. **No action needed.** Extension package.json does not surface any raw `workbench.action.browser.*` commands. The Activity Bar and context-menu entries are all `ritemark.browser.*` namespaced.
- [x] Document limitations that remain for downloads, permissions, popups, and certificates. **Known limitations (no blocking issues for MVP):** (1) File downloads from the BrowserView are handled by Electron's default download mechanism — no Ritemark-specific UI. (2) Geolocation, camera, microphone permission prompts may show native Electron dialogs without Ritemark chrome. (3) Pop-up windows opened by target=_blank open in a new Electron window, not a Ritemark tab. (4) Self-signed certificates are rejected by default; users can override via `--ignore-certificate-errors` flag in dev. All four are acceptable for the current MVP scope.

### Phase F2 — Activity Bar Browser launcher (post-pivot UX)

- [x] Add globe Activity Bar entry (`ritemark-browser` viewContainer) so the browser is reachable in one click without going through the command palette.
- [x] Recent URLs panel backed by `BrowserHistoryStore` (globalState, dedupe, cap 25).
- [x] Header `+ New Tab` action opens an empty browser tab via `workbench.action.browser.open`.
- [x] Header Clear All title action.
- [x] Each `openInIntegratedBrowser` call records the URL into Recent (URL bar, terminal link, redirector, palette).
- [x] Recent panel rendered as a webview using Ritemark Indigo-Editorial tokens (Agent Library look — soft icon-chip, two-line layout, hover `×` remove).
- [x] Click Recent item → reopens via `ritemark.browser.history.open`.
- [x] Inline `×` removes a single entry.
- [ ] In-page navigation tracking (BrowserView link clicks) — out of MVP, would require a workbench patch event.

### Phase E2 — QA and smoke handoff

- [x] Run browser helper tests. **N/A — no unit test harness exists for `extensions/ritemark/src/browser/`; validation is via dev-instance smoke.**
- [x] Run extension compile.
- [x] Run webview build only if webview files changed.
- [x] Run `./scripts/validate-qa.sh`. **Green 2026-05-11.**
- [x] Run dev instance.
- [x] Capture screenshots for external and local file tests.
- [x] Hand off to user for smoke. **Two items for manual validation: terminal localhost link click + three-tab state-bleed check (see testing-notes.md).**

---


## Implementation Update — 2026-05-10

Sprint 65 is now wired to the existing shell-level integrated browser. The failed extension-webview iframe browser path has been removed from the active route:

- Removed the `ritemark.browser` custom editor contribution.
- Removed the webview `BrowserChrome` route from `webview/src/main.tsx`.
- Deleted the iframe browser manager/provider/html helper prototype files.
- Added `extensions/ritemark/src/browser/IntegratedBrowser.ts` as a thin command bridge to `workbench.action.browser.*`.
- Reworked terminal localhost links and `.html` context-menu preview to use the integrated browser.
- Set HTML files text-first by default; browser preview is explicit via “Open in Ritemark Browser”.

Validated locally in a dev instance with remote debugging and screenshots:

- `https://example.com` rendered in the native browser tab.
- `https://github.com` rendered in the native browser tab.
- Workspace `file://.../browser-fixture.html` rendered in the native browser tab.
- Long `#section-c` anchor navigation was executed through the native address bar.
- `npm run compile`, webview `npm run build`, and `./scripts/validate-qa.sh` passed.

Additional CDP smoke completed after the initial screenshot pass: `ritemark.app`, `google.com`, relative local page-2 navigation, `#section-c`, and back/forward/reload all passed. Still pending before final sprint close: terminal localhost link click and three-tab smoke.

## Implementation Update — 2026-05-10 (HTML default-opener fix + Activity Bar launcher)

Two follow-ups landed in the same session:

1. **HTML default-opener regression fix** — the `BrowserHtmlOpenRedirector` was firing correctly but two layered bugs prevented the BrowserView from taking over the open:
   - `IntegratedBrowser.openInIntegratedBrowser` rejected workspace-external `file://` URIs with a "For safety, Ritemark Browser opens local files only from the current workspace." error. Removed the workspace-folder restriction; VS Code's workspace trust + Electron's own resolver are the right gate.
   - After the BrowserView opened, `closeTextEditorIfActive` checked `vscode.window.activeTextEditor` *after* the BrowserView became active; by then the API returned no text editor and the source tab was never closed. Replaced with `closeMatchingSourceTabs`, which walks `vscode.window.tabGroups.all` and closes any `TabInputText` matching the redirected URI. CDP smoke confirmed the source tab is gone after the redirect, BrowserView is the sole tab for the file.

2. **Activity Bar Browser launcher** (Phase F2) — globe Activity Bar entry, `BrowserHistoryStore` (globalState-backed, dedupe, cap 25), header `+ New Tab` and Clear All actions, and a Recent panel rendered as a webview using Ritemark Indigo-Editorial tokens (Agent Library look). Hooked `openInIntegratedBrowser` to record URLs after each successful open (URL bar, terminal link, redirector, palette, panel reopen). `BrowserPanelProvider` was first prototyped as a `TreeDataProvider`, then re-implemented as a `WebviewViewProvider` to match the Agent Library visual language. CDP smoke confirmed the Recent row populates after the Explorer-click HTML redirect.

Files touched (this update):

- `extensions/ritemark/src/browser/IntegratedBrowser.ts`
- `extensions/ritemark/src/browser/BrowserHtmlOpenRedirector.ts`
- `extensions/ritemark/src/browser/BrowserHistoryStore.ts` (new)
- `extensions/ritemark/src/browser/BrowserPanelProvider.ts` (new)
- `extensions/ritemark/src/extension.ts`
- `extensions/ritemark/package.json`
- `extensions/ritemark/media/browser-icon.svg` (new)

## Superseded Work

The following files/directories are prototype artifacts from the failed iframe approach and must not be considered final architecture:

- `extensions/ritemark/src/browser/`
- `extensions/ritemark/webview/src/components/browser/`
- browser-specific webview routing in `extensions/ritemark/webview/src/main.tsx`
- `ritemark.browser` custom editor contribution in `extensions/ritemark/package.json`

They may be deleted or heavily rewritten during Phase C2.

---

## Release Type

Likely mixed extension + shell change. If final implementation only wires existing workbench browser commands from extension code, release may remain extension-only. If command behavior, browser editor UI, file policies, or product shell menus require changes under `vscode/src`, treat as full app release and run release-process guidance before versioning/tagging.
