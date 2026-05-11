# Electron BrowserView/WebContentsView Pivot Plan

Date: 2026-05-10  
Status: **Approved direction** — pivot Sprint 65 away from extension-webview iframe and toward Ritemark's shell-level integrated browser infrastructure.

---

## 1. Decision

Sprint 65 will no longer attempt to ship a real browser through an extension webview iframe. The approved direction is to use Electron browser primitives (`WebContentsView` / `webContents`) through Ritemark/VS Code shell-level browser infrastructure.

Important discovery from the codebase audit: Ritemark already contains a substantial integrated browser stack under:

- `vscode/src/vs/platform/browserView/`
- `vscode/src/vs/workbench/contrib/browserView/`

This means the pivot is likely **not** “build WebContentsView from scratch.” The better plan is:

1. Verify the existing integrated browser works in Ritemark dev.
2. Route Sprint 65 browser entry points to the existing integrated browser editor.
3. Remove/deprecate the extension-webview iframe implementation.
4. Add `.html` / `file://` / terminal-link integration on top of the integrated browser, not inside a custom iframe.

---

## 2. Existing integrated browser components found

### Main-process browser surface

`vscode/src/vs/platform/browserView/electron-main/browserView.ts`

- Imports Electron `WebContentsView` and `webContents`.
- Creates `new WebContentsView(...)` with secure defaults:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
  - `webviewTag: false`
  - explicit `session`
- Uses real Electron `webContents` events:
  - navigation
  - loading
  - title
  - favicon
  - devtools
  - context menu
  - popup/new-page handling
  - errors

### Browser session model

`vscode/src/vs/platform/browserView/electron-main/browserSession.ts`

Session scopes are already modeled via `BrowserViewStorageScope`:

- global
- workspace
- ephemeral

This directly addresses earlier cookie/session questions better than extension webviews can.

### Workbench/editor integration

`vscode/src/vs/workbench/contrib/browserView/electron-browser/browserEditor.ts`

- Provides a browser editor with native browser chrome.
- URL bar, navigation toolbar, actions toolbar.
- Real layout support for `WebContentsView` bounds.

`vscode/src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts`

- Registers `BrowserEditor` for `vscodeBrowser:` resources.
- Registers services:
  - `IBrowserViewWorkbenchService`
  - `IBrowserViewCDPService`

`vscode/src/vs/workbench/contrib/browserView/electron-browser/features/browserTabManagementFeatures.ts`

- Registers command: `workbench.action.browser.open` (`BrowserViewCommandId.Open`).
- Supports `url`, `openToSide`, and `reuseUrlFilter` options.
- Supports New Tab / Close All Browser Tabs.

---

## 3. Why this solves the iframe failure class

The current failed architecture embeds pages like this:

```text
Ritemark webview iframe host
└─ sandboxed <iframe src="https://site.example">
```

The new architecture renders pages like this:

```text
Ritemark workbench editor
└─ Electron WebContentsView / webContents.loadURL("https://site.example")
```

This changes the problem class:

| Problem | Extension iframe | Electron WebContentsView |
|---|---:|---:|
| `X-Frame-Options` / `frame-ancestors` | Blocks many sites | Not relevant because page is not embedded as child iframe |
| Client app expects normal origin | Often broken by sandbox | Normal browser origin/session model |
| Cookies/localStorage | Webview/iframe-specific constraints | Managed via Electron session partition |
| Popups/new windows | iframe/sandbox workaround | `setWindowOpenHandler` already exists |
| Navigation events | Heuristic | Native `webContents` events |
| `file://` pages | VS Code webview resource workaround | Electron can load `file://` directly, subject to policy |

---

## 4. Local files in Electron browser

Electron `webContents.loadURL('file:///...')` can load local files as a real browser page. For Sprint 65 we should still define policy:

Recommended MVP policy:

- Allow `file://` only inside open workspace folders by default.
- Allow `.html` workspace files to open in the integrated browser.
- Relative assets should work naturally through browser file loading.
- Keep explicit “Open as Text” for HTML editing.
- Do not silently grant arbitrary filesystem browsing outside workspace in MVP.

Future setting if needed:

- `ritemark.browser.allowExternalFileUrls`: default `false`.

---

## 5. Revised Sprint 65 implementation direction

### Remove/deprecate extension-webview iframe implementation

The following Sprint 65 artifacts are now considered **superseded** unless reused for command routing or settings UI:

- `extensions/ritemark/src/browser/BrowserManager.ts`
- `extensions/ritemark/src/browser/getBrowserWebviewHtml.ts`
- `extensions/ritemark/src/browser/BrowserEditorProvider.ts`
- `extensions/ritemark/src/browser/BrowserTerminalLinkProvider.ts` (may be rewritten to route to integrated browser)
- `extensions/ritemark/webview/src/components/browser/BrowserChrome.tsx`
- browser-specific webview bundle routing in `webview/src/main.tsx`
- `.html` custom editor entry for `ritemark.browser` in `extensions/ritemark/package.json`

### Keep/rework useful product pieces

- Command palette entry: `Ritemark Browser: Open URL` should call `workbench.action.browser.open`.
- Terminal localhost link provider can remain but route to `workbench.action.browser.open`.
- `.html` context menu entries can remain but route to integrated browser.
- Settings UI can be simplified: default opener controls whether `.html` opens as text or integrated browser.

---

## 6. Proposed implementation phases

### Phase B2 — Integrated browser validation spike

- [ ] Run Ritemark dev with the existing integrated browser command.
- [ ] Open `https://ritemark.app`.
- [ ] Open `https://google.com`.
- [ ] Open `https://github.com`.
- [ ] Open `https://example.com`.
- [ ] Open local fixture via `file:///Users/.../browser-fixture.html`.
- [ ] Validate back/forward/reload.
- [ ] Capture screenshots and logs.

Pass condition: at least `ritemark.app`, `google.com`, and local fixture render without iframe/fallback failures.

### Phase C2 — Route Ritemark extension entry points to integrated browser

- [ ] Remove custom extension webview browser editor registration.
- [ ] Add a thin helper that executes:

```ts
vscode.commands.executeCommand('workbench.action.browser.open', { url });
```

- [ ] Update `ritemark.browser.openUrl` to call integrated browser.
- [ ] Update terminal link provider to call integrated browser.
- [ ] Update `.html` “Open in Ritemark Browser” to call integrated browser with `file://` URL.
- [ ] Keep “Open as Text”.

### Phase D2 — HTML opener policy

- [ ] Decide whether `.html` should be default-opened by integrated browser or stay text-first.
- [ ] If browser-default remains desired, implement routing without custom webview iframe.
- [ ] Keep `ritemark.browser.htmlDefaultOpener` only if it still has real product value.

### Phase E2 — Smoke test matrix

Required smoke tests before handing to user:

| Test | Expected |
|---|---|
| `https://ritemark.app` | Renders actual site, not fallback. |
| `https://google.com` | Renders actual site/search page, not XFO fallback. |
| `https://github.com` | Renders actual site or expected auth/network result, not iframe-blocked blank. |
| `https://example.com` | Renders page. |
| `file:///.../browser-fixture.html` | Renders local fixture. |
| Long `#section-c` anchor | Scrolls visibly to correct section. |
| Relative local link to page 2 | Opens page 2. |
| Back/forward | Works using native browser history. |
| Refresh | Reloads current page. |
| Three tabs | Independent state/session behavior acceptable. |

---

## 7. Risks that remain

| Risk | Mitigation |
|---|---|
| Existing integrated browser may be unfinished or hidden behind product assumptions | Validate before wiring extension commands. |
| Workbench command/API may be internal, not extension-stable | Since Ritemark owns the shell, internal command usage is acceptable but should be documented. |
| File URLs outside workspace may be too permissive | Add workspace guard before routing file URLs. |
| Session persistence may surprise users | Use existing storage scopes; choose workspace or ephemeral explicitly. |
| Browser UI may expose agent-related features not desired for Ritemark browser | Audit menus/actions and hide or relabel if needed. |
| Current extension iframe code may conflict with native browser editor | Remove/deprecate the custom editor before final smoke. |

---

## 8. Acceptance definition for the pivot

The pivot is ready for user smoke test only when:

1. Dev instance is running with the integrated browser path.
2. Screenshots/logs confirm external sites render in the browser editor.
3. Local file fixture renders via `file://` with relative navigation.
4. Extension iframe browser code is no longer the path being exercised.
5. `./scripts/validate-qa.sh` passes.

