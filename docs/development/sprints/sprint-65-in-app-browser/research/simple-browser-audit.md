# Simple Browser Audit

Source files read:
- `vscode/extensions/simple-browser/src/simpleBrowserView.ts`
- `vscode/extensions/simple-browser/src/simpleBrowserManager.ts`
- `vscode/extensions/simple-browser/preview-src/index.ts`

---

## What Simple Browser Does

Simple Browser is a built-in VS Code extension that opens URLs in a webview panel containing a sandboxed `<iframe>`. It has:

- A single active view at a time (single-tab model via `SimpleBrowserManager._activeView`).
- A `WebviewPanel` (not a Custom Editor Provider) opened via `vscode.window.createWebviewPanel`.
- A vanilla JS frontend (`preview-src/index.ts`) compiled to `media/index.js`.
- A focus-lock indicator overlay for keyboard-focus feedback.
- `retainContextWhenHidden: true` so panel state survives tab switching.

---

## Public Extension APIs Used

All APIs are standard VS Code extension surface — no core patches required:

| API | Used for |
|---|---|
| `vscode.window.createWebviewPanel` | Panel creation |
| `vscode.window.registerWebviewPanelSerializer` | Panel restore on reload (implicit in `restore()` path) |
| `webviewPanel.webview.html` | Full HTML replace on `show()` |
| `webviewPanel.webview.postMessage` | Push config updates to webview (focusLockIndicator) |
| `webviewPanel.webview.onDidReceiveMessage` | Receive `openExternal` from webview |
| `vscode.env.openExternal` | Open URL in system browser |
| `vscode.workspace.onDidChangeConfiguration` | React to `simpleBrowser.focusLockIndicator.enabled` changes |
| `vscode.workspace.getConfiguration` | Read config values |
| `vscode.l10n.t` | Localization |

None of these APIs require patches to VS Code core. All are available to third-party extensions.

---

## CSP in Simple Browser

From `simpleBrowserView.ts` line 127–133:

```
default-src 'none';
font-src data:;
style-src ${cspSource};
script-src 'nonce-${nonce}';
frame-src *;
```

Key observation: `frame-src *` allows the `<iframe>` to load any URL. This is intentional — the CSP governs the host HTML document (inside the VS Code webview), not the iframe's content.

---

## iframe Sandbox in Simple Browser

From `simpleBrowserView.ts` line 169:

```html
<iframe sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"></iframe>
```

Simple Browser ships `allow-same-origin` enabled by default. This is a deliberate trade-off: it enables cookies, session storage, and cross-origin `fetch` from the embedded page. It also means the iframe page can access its own `document.cookie` and localStorage.

**Ritemark departure:** Sprint 65 must decide whether to adopt `allow-same-origin` or start from `allow-scripts` only. This is the subject of `csp-sandbox-spec.md` and `cookie-session-persistence-decision.md`.

---

## Navigation Model

Simple Browser's navigation uses the browser's own `history` API (forward/back calls `history.forward()` / `history.back()` in `preview-src/index.ts` lines 62–67). The reload button calls `navigateTo(input.value)` which sets `iframe.src` directly with a cache-bust `vscodeBrowserReqId` query param (lines 82–88).

**Problem for Ritemark:** The `history` API-based back/forward is cross-origin unreliable — you cannot inspect or manipulate `iframe.contentWindow.history` from the host page when the iframe is cross-origin. Simple Browser leverages the browser's *host-page* history stack (not the iframe's), which accumulates entries every time `iframe.src` is set.

**Ritemark departure:** Replace with an in-extension history stack (`BrowserManager` tracks `string[]` of visited URLs + current index). Back/forward messages go extension-host → webview → sets `iframe.src`. This is more explicit and correct for cross-origin content.

---

## Manager Pattern

`SimpleBrowserManager` is a thin wrapper that holds a single `_activeView` reference. When `show()` is called with an already-active view, it re-uses it (navigating in place). When the view is disposed, `_activeView` is cleared.

This single-tab model is **not appropriate for Ritemark** which requires multiple independent browser tabs. The Ritemark `BrowserManager` will manage a `Map<string, BrowserEditorProvider>` keyed by tab ID, not a single active view.

---

## What We Adapt Verbatim

| Element | Adapt from Simple Browser |
|---|---|
| CSP template structure | `default-src 'none'` + `frame-src *` + nonce for scripts |
| `extensionResourceUrl` helper | `webview.asWebviewUri(Uri.joinPath(extensionUri, ...parts))` |
| `openExternal` message handler | `vscode.env.openExternal(vscode.Uri.parse(e.url))` |
| Settings read via `vscode.workspace.getConfiguration` | Same pattern |
| `retainContextWhenHidden: true` | Yes — required for URL-bar state to survive tab switches |
| `generateUuid` for nonce | Reuse the pattern (Ritemark can use `crypto.randomUUID()` or equivalent) |
| `enableScripts: true`, `enableForms: true` | Same webview options |
| HTML structure: header with nav + url-input + content + iframe | Adapted (BrowserChrome.tsx replaces vanilla JS) |

---

## What We Change for Ritemark

| Element | Change |
|---|---|
| Panel API | Replace `createWebviewPanel` with Custom Editor Provider (`vscode.window.registerCustomEditorProvider`) for tab integration |
| Single-tab manager | Replace with multi-tab `BrowserManager` (one instance per open tab) |
| Vanilla JS frontend | Replace with React component (`BrowserChrome.tsx`) bundled via Vite into `media/webview.js` — same bundle as the markdown editor |
| `history.forward()` / `history.back()` | Replace with in-extension URL history stack; messages via `postMessage` |
| Reload mechanism | Same cache-bust approach but driven by extension host message, not direct `input.value` read |
| Focus lock indicator | Drop — not relevant to Ritemark's use case |
| `simpleBrowser.focusLockIndicator.enabled` config listener | Drop |
| `iframe sandbox` flags | Decide separately (see `csp-sandbox-spec.md`) |

---

## What We Drop

- Focus lock indicator overlay and its config setting.
- `vscode.l10n.t` localization (Ritemark does not localize).
- `SimpleBrowserManager.restore()` panel restore path — Custom Editor Provider handles restoration natively via `resolveCustomEditor` on reload.
- The `data-settings` attribute trick for passing initial URL — use `postMessage` from extension host after `ready` message instead (consistent with existing Ritemark editor pattern).

---

## Settings Hook Difference

Simple Browser listens for `simpleBrowser.focusLockIndicator.enabled` via `vscode.workspace.onDidChangeConfiguration`. Ritemark's browser will listen for `ritemark.browser.htmlDefaultOpener` changes in the editor provider's open logic (at open time), and separately in `RitemarkSettingsProvider` for the Settings page binding.

---

## No Core Patch Required

Confirmed: every API used in Simple Browser is available in the `vscode` extension host module. The Custom Editor Provider API (`vscode.window.registerCustomEditorProvider`) is also a standard public API. No patch to `vscode/src/` is needed.
