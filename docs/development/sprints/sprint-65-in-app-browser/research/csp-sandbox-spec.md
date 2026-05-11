# CSP and iframe Sandbox Specification

---

## Overview

The browser tab webview has two distinct security surfaces:

1. The **host page** — the VS Code webview HTML that contains the URL bar chrome and the iframe. This is controlled by Ritemark entirely.
2. The **iframe content** — the external page (localhost dev server, workspace HTML file, arbitrary URL). This is untrusted.

The CSP governs the host page. The sandbox attribute governs what the iframe content can do. These are separate mechanisms.

---

## 1. Host Page CSP

The host page CSP for the browser tab:

```
default-src 'none';
font-src data: ${webview.cspSource};
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}' ${webview.cspSource};
frame-src *;
img-src ${webview.cspSource} data:;
```

Rationale for each directive:

- `default-src 'none'` — deny everything not explicitly listed.
- `font-src data: ${webview.cspSource}` — allow webfonts from the extension bundle and base64-embedded. Matches existing Ritemark editor pattern (`ritemarkEditor.ts` line 1156).
- `style-src ${webview.cspSource} 'unsafe-inline'` — allow extension-bundled CSS and inline styles (Tailwind's utility output requires this). Same as existing editor.
- `script-src 'nonce-${nonce}' ${webview.cspSource}` — only the nonce-tagged script (the webview bundle) and extension-bundled scripts can run. No inline scripts.
- `frame-src *` — allow the iframe to embed any URL. This is the intentional wide-open policy for the iframe `src`. The security boundary is the sandbox attribute, not CSP `frame-src`. Locking `frame-src` to specific origins would break the general-purpose browser use case.
- `img-src ${webview.cspSource} data:` — allow extension images and base64. The iframe's own image loading is not governed by the host page's `img-src`.

### What the CSP Does NOT Restrict

The iframe's content (scripts, images, requests) is not governed by the host page's CSP. The iframe operates in its own browsing context with its own CSP (sent by the server). The host page CSP only controls what the host page (the chrome) can load.

---

## 2. iframe Sandbox Attribute

### Base Sandbox for Sprint 65

```html
<iframe sandbox="allow-scripts allow-forms allow-downloads"></iframe>
```

**Flags included:**

| Flag | Reason |
|---|---|
| `allow-scripts` | Required for any dynamic web app (React, Vite HMR, etc.) |
| `allow-forms` | Required for login forms, search boxes, any `<form>` submit |
| `allow-downloads` | Allow file downloads from the embedded site |

**Flags excluded:**

| Flag | Reason excluded |
|---|---|
| `allow-same-origin` | Grants the iframe access to its own cookies, localStorage, IndexedDB, and the ability to make credentialed requests. Excluded by default — see decision in `cookie-session-persistence-decision.md`. |
| `allow-popups` | Excluded — popup windows from embedded sites would open outside Ritemark's control. If a site requires popups (OAuth flows), user can open in system browser. |
| `allow-top-navigation` | Excluded — prevents the iframe from navigating the top-level window. |
| `allow-modals` | Excluded — prevents `alert()`, `confirm()`, `prompt()` dialogs from the embedded page. These would be jarring in an editor context. |

---

## 3. `file://` URL Handling

### The actual VS Code constraint

The original draft of this section assumed `iframe.src = "file:///..."` would just work, with sandbox flags being the only knob to tune. That assumption is wrong inside a VS Code webview, and the in-VS-Code session of 2026-05-10 confirmed two stacked failure modes:

1. **The webview process refuses raw `file:`.** When the iframe `src` is `file:///...`, VS Code's webview reports `Not allowed to load local resource: file:///...` regardless of the host page CSP. Webviews do not load `file:` URIs directly — they only serve content via the vscode-cdn URI returned by `webview.asWebviewUri(uri)`, and only for paths inside the panel's `localResourceRoots`.
2. **`asWebviewUri` URLs need `allow-same-origin`.** Once the iframe `src` is the converted `https://file%2B.vscode-resource.vscode-cdn.net/...` URL, a sandboxed iframe with no `allow-same-origin` is null-origin — the cdn's service worker rejects it (HTTP 401) and the iframe renders blank.

### What this means for the sandbox

`file://` and `http(s)://` URLs **cannot** share the same sandbox string. The browser tab uses the helpers in `extensions/ritemark/src/browser/browserUrlUtils.ts`:

```
http(s)://, localhost  → allow-scripts allow-forms allow-downloads
file:// (asWebviewUri) → allow-scripts allow-forms allow-downloads allow-same-origin
```

`allow-same-origin` here is safe even though §4 calls it out as a sandbox-weakening flag, because:

- The actual loaded URL is the locked-down `https://file+.vscode-resource.vscode-cdn.net/...` origin, **not** `file://`. The iframe being same-origin to itself does not give it access to `file://`.
- Cross-origin `fetch('file:///etc/passwd')` is still blocked by CORS — the iframe cannot reach `file://` from the cdn origin.
- The cdn only serves files inside the panel's `localResourceRoots`, which we restrict to the extension's `media/` folder + the open workspace folders (`getBrowserLocalResourceRoots`). `file://` URLs outside the workspace are rejected up front (`toIframeUrl` returns `null` and `BrowserManager.sendNavigate` surfaces a user-facing error).

The cookie/storage concern in §4 still applies to `http(s)://` URLs and stays mitigated by *not* setting `allow-same-origin` for those.

### What still works / does not work for `file://`

Works:
- Inline CSS / JS / images (data URIs).
- Sibling assets via relative paths (`<script src="./app.js">`, `<link href="./style.css">`).
- Static HTML rendering inside an open workspace folder.

Does not work:
- Anything outside an open workspace folder — the cdn cannot serve it.
- Cross-`file://` `fetch` / `XMLHttpRequest` — still CORS-blocked.

Acceptable for Sprint 65's dev-preview purpose.

---

## 4. `allow-same-origin` Security Constraint

This is the critical constraint that the cookie audit must work around.

`allow-same-origin` in a sandboxed iframe means: the iframe's content is treated as having the origin of its `src` URL (as opposed to being treated as an opaque origin). Effects:

- The iframe can read/write its own `document.cookie`.
- The iframe can use `localStorage` and `IndexedDB` keyed to its origin.
- The iframe can make credentialed `fetch()` requests (with cookies) to its own origin.
- Critically for `file://`: the iframe can `fetch()` other `file://` URLs on the filesystem.

**Why it is OFF by default in Sprint 65:**
1. It weakens the sandbox for arbitrary `http(s)://` URLs — embedded pages can persist state between sessions.
2. For `file://` it creates a local-file read vector.
3. Sprint B (Miniapp Runtime) uses the same webview codebase. If `allow-same-origin` is on by default in the browser iframe, and the miniapp iframe is created via the same code path, the miniapp sandbox is weakened.

The sprint plan's locked decision is: cookies/sessions are ephemeral (VS Code default). `allow-same-origin` is not included in Sprint 65.

---

## 5. Summary: Final CSP and Sandbox for Sprint 65

**Host page CSP:**
```
default-src 'none';
font-src data: ${webview.cspSource};
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}' ${webview.cspSource};
frame-src *;
img-src ${webview.cspSource} data:;
```

**iframe sandbox attribute:**
```
sandbox="allow-scripts allow-forms allow-downloads"
```

**Applied uniformly to all URL schemes** (`http://`, `https://`, `localhost:*`, `file://`). No per-scheme variation in the sandbox string.

**Accepted limitations:**
- Embedded sites cannot persist cookies or session storage.
- Embedded sites cannot open popups.
- `file://` pages cannot `fetch()` other local files.
- `alert()` / `confirm()` from embedded pages are suppressed.
