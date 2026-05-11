# Ground-Zero Browser Architecture Re-audit

Date: 2026-05-10  
Sprint: 65 — In-App Browser  
Status: **Implementation paused. Current webview-iframe approach is not viable for the original “working in-app browser for arbitrary websites” goal.**

---

## 1. Executive conclusion

The current Sprint 65 approach — a VS Code extension webview containing a browser chrome and a sandboxed `<iframe>` — is viable only for a **limited preview surface**:

- localhost/dev-server previews that do not block embedding,
- workspace/local `.html` previews after special handling,
- deliberately embeddable public pages,
- fallback UX for blocked pages.

It is **not viable** as a real in-app browser for arbitrary external websites. The last debugging pass exposed a pattern rather than an isolated bug: each category of site or URL requires another workaround, and some failures are browser-security invariants that an extension webview cannot override.

Recommended sprint action:

1. **Stop implementation immediately.**
2. Re-scope Sprint 65 as an architecture audit / prototype decision sprint.
3. Decide between:
   - **A. Preview-only browser** inside extension webviews; or
   - **B. Shell-level browser surface** using Electron `WebContentsView`/`webContents` integration; or
   - **C. Hybrid:** local/localhost preview in-app, external URLs in system browser until shell-level work is funded.

My recommendation is **C for short-term product safety** and **B if the product requirement is truly “Ritemark has an embedded browser.”**

---

## 2. What we attempted

### Intended architecture

```text
VS Code/Ritemark tab
└─ VS Code extension webview host page
   ├─ React browser chrome (URL bar, back/forward/refresh)
   └─ <iframe sandbox="..." src="requested URL">
```

This was based on the VS Code Simple Browser pattern and the public VS Code webview API.

### Implementation/debug findings

| Area | Finding |
|---|---|
| Simple external pages | Some pages can load, but cross-origin state is fragile without carefully relaxed sandbox flags. |
| Google/GitHub/MDN/etc. | Many common sites send `X-Frame-Options` or `CSP frame-ancestors` that prevent embedding in iframes. |
| Client-side apps | Apps can crash if iframe sandbox removes origin/storage capabilities (`allow-same-origin` missing). |
| Local `file://` | Raw `file://` cannot be loaded directly in VS Code webviews. `asWebviewUri` and/or `srcdoc` workarounds are required. |
| Local navigation | `srcdoc` + `<base>` caused links to navigate to VS Code resource URLs unless bridged manually. |
| CSP | Host CSP interacts with `srcdoc`; inline fixture scripts were blocked until CSP was relaxed. |
| UX | “Blank page” is the default failure mode unless many detection/fallback layers are added. |

This is not a normal “one last bug” trajectory. It is a structural mismatch between “arbitrary browser” and “extension webview iframe.”

---

## 3. Primary source facts

### 3.1 VS Code webviews are iframe-like extension UI surfaces

The VS Code webview guide describes webviews as an `iframe`-like surface controlled by the extension and emphasizes that local resources must be converted through `webview.asWebviewUri(...)`; `localResourceRoots` controls which local files can be served. It also recommends keeping CSP restrictive and avoiding inline scripts/styles where possible.

Source: VS Code Webview API — https://code.visualstudio.com/api/extension-guides/webview

Implication for Ritemark:

- A VS Code webview is a good place to render **Ritemark-controlled UI**.
- It is not equivalent to an Electron browser tab with first-class `webContents` ownership.
- Local file support is intentionally constrained and must be mediated through VS Code’s resource service.

### 3.2 Iframe embedding can be blocked by the target site

`Content-Security-Policy: frame-ancestors` explicitly controls which parents may embed a page in `iframe`/`frame`/`object`/`embed`. MDN also notes that `frame-ancestors` differs from `frame-src`: `frame-src` controls what the parent may load; `frame-ancestors` controls whether the child permits that parent.

Source: MDN CSP `frame-ancestors` — https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors

`X-Frame-Options` similarly tells the browser whether a page may be rendered inside a frame/iframe/embed/object, commonly to prevent clickjacking.

Source: MDN X-Frame-Options — https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options

Implication for Ritemark:

- Ritemark cannot “fix” an iframe blocked by `X-Frame-Options: DENY/SAMEORIGIN` or restrictive `frame-ancestors` from extension code.
- At best, Ritemark can detect/guess and show fallback UI.

### 3.3 Electron has a real browser-content primitive separate from iframe embedding

Electron’s `WebContentsView` is a main-process `View` that displays a `WebContents`; example usage is creating a `WebContentsView` and calling `view.webContents.loadURL(...)`.

Source: Electron WebContentsView — https://www.electronjs.org/docs/latest/api/web-contents-view

Electron `webContents` is explicitly responsible for rendering and controlling a web page, with navigation events such as `did-start-navigation`, `will-navigate`, `will-redirect`, etc.

Source: Electron webContents — https://www.electronjs.org/docs/latest/api/web-contents

Implication for Ritemark:

- A shell-level browser can be implemented with Electron browser primitives rather than an iframe inside a VS Code webview.
- That requires VS Code/Ritemark shell work, not only extension work.

---

## 4. Empirical header sample

Command used:

```bash
curl -I -L --max-time 10 <url>
```

Representative results on 2026-05-10:

| URL | Relevant result | Expected iframe outcome |
|---|---|---|
| `https://google.com` → `https://www.google.com/` | `X-Frame-Options: SAMEORIGIN` | Blocked in Ritemark iframe. |
| `https://github.com` | `X-Frame-Options: deny`; `CSP frame-ancestors 'none'` | Blocked in Ritemark iframe. |
| `https://developer.mozilla.org` | `X-Frame-Options: DENY` | Blocked in Ritemark iframe. |
| `https://ritemark.app` | Redirect response had `X-Frame-Options: DENY`; final client app also showed runtime failure in iframe testing | Not reliable in Ritemark iframe. |
| `https://example.com` | No blocking header in sample | Likely embeddable. |
| `https://wikipedia.org` | No blocking header in sample final response | May embed, but still subject to runtime/browser policy. |

This is enough to invalidate “arbitrary external website browser” as a realistic extension-webview-iframe requirement.

---

## 5. Failure taxonomy

### 5.1 Target explicitly blocks framing

Symptoms:

- blank iframe,
- browser console refusal,
- sometimes iframe `load` fires anyway,
- no useful DOM access from host.

Cause:

- `X-Frame-Options: DENY/SAMEORIGIN`, or
- `Content-Security-Policy: frame-ancestors ...`.

Can current extension approach solve it?

- **No.** Browser engine enforces this.
- It can only present fallback UX.

### 5.2 Target expects normal browser origin/storage

Symptoms:

- “Application error” from client-side app,
- auth/session failure,
- localStorage/cookie exceptions,
- broken third-party integrations.

Cause:

- iframe sandbox without `allow-same-origin`,
- third-party storage restrictions,
- auth popup restrictions,
- app assumptions about top-level browsing context.

Can current extension approach solve it?

- **Partially.** Add `allow-same-origin`, `allow-popups`, etc.
- But this weakens the sandbox and still does not make iframe equivalent to a real tab.

### 5.3 Target expects top-level navigation/window APIs

Symptoms:

- OAuth flows break,
- popups blocked or trapped,
- redirects fail,
- app detects iframe and exits.

Cause:

- sandbox restrictions,
- frame-busting scripts,
- top-level navigation requirements,
- third-party cookie/storage constraints.

Can current extension approach solve it?

- **Only by relaxing the sandbox significantly**, and still not for frame-busting / frame-ancestor-blocked apps.

### 5.4 Local file previews are not normal browser file loads

Symptoms:

- `Not allowed to load local resource`,
- vscode-cdn resource 401/blank,
- relative links point to webview resource URLs,
- inline scripts blocked by host CSP.

Cause:

- VS Code webviews do not load raw `file://` directly.
- Local resources must go through `asWebviewUri(...)` and `localResourceRoots`.
- `srcdoc` workarounds need custom navigation bridging.

Can current extension approach solve it?

- **Yes, but only as a controlled preview pipeline**, not as “browser opens any file URL exactly as Chrome would.”

---

## 6. Option analysis

### Option A — Continue current extension webview iframe approach

Scope:

- local `.html` preview,
- localhost/dev server preview,
- permissive external pages,
- explicit fallback for blocked external pages.

Pros:

- No VS Code core/shell patches.
- Uses public extension APIs.
- Aligns with Simple Browser precedent.
- Lowest implementation complexity if scope is honest.

Cons:

- Not a real browser.
- Many external sites fail or block embedding.
- Each new site category produces more edge cases.
- Sandbox policy becomes a product/security compromise.
- Local file support remains custom/non-browser-like.

Verdict:

- **Viable only if renamed/re-scoped as “Preview Browser,” not “Browser.”**

### Option B — Shell-level Electron `WebContentsView` / `webContents` browser

Scope:

- true embedded browser surface inside Ritemark shell,
- independent web contents per tab or tab group,
- browser-grade navigation events and failure reasons,
- better storage/session handling.

Pros:

- Correct primitive for rendering arbitrary web pages.
- Avoids iframe embedding restrictions for many sites because the page is top-level in its `webContents`, not child of our webview iframe.
- Enables proper navigation events, title/favicon, devtools, permissions, downloads, popup handling.
- Better long-term basis for real in-app browser.

Cons:

- Requires VS Code/Ritemark shell integration, likely `vscode/src/...` changes.
- Must design UI composition around VS Code workbench/editor areas.
- Security review required: untrusted web content inside app shell.
- Need lifecycle, process, session partition, permission, download, popup, and cookie policies.
- More complex QA and release risk.

Verdict:

- **Only viable path if the requirement is “real in-app browser.”**

### Option C — Hybrid: webview preview + system browser for external URLs

Scope:

- Ritemark in-app preview for local/localhost/controlled pages.
- External URLs open in system browser by default, or show a clear “external sites are opened externally” flow.
- Later shell-level browser can be a separate sprint.

Pros:

- Honest UX; avoids pretending external sites will work.
- Retains useful Sprint 65 value for local docs/dev previews.
- Avoids security rabbit hole now.
- Keeps Sprint 65 deliverable small enough to finish.

Cons:

- Does not satisfy “embedded browser for arbitrary web.”
- Some users may expect all links to stay in-app.

Verdict:

- **Recommended near-term path.**

### Option D — Proxy/rewriter service to bypass iframe restrictions

Scope:

- Fetch external pages server-side / locally, rewrite headers/content to make them embeddable.

Pros:

- Can bypass some `X-Frame-Options` cases technically.

Cons:

- High security risk.
- Breaks many apps (CSP, cookies, JS modules, CORS, service workers, auth).
- Legal/ethical/product concerns around bypassing site embedding policy.
- Not robust.

Verdict:

- **Reject.**

### Option E — Use Electron `<webview>` tag inside extension webview

Scope:

- Try to embed Electron’s `<webview>` tag inside VS Code extension webview.

Pros:

- Seems superficially browser-like.

Cons:

- VS Code webviews are already sandboxed/controlled surfaces; enabling nested Electron webviews is not a public VS Code extension capability.
- Would likely require shell-level changes anyway.
- Security/lifecycle complexity similar to WebContentsView but with worse integration.

Verdict:

- **Reject unless shell research proves it is intentionally supported.**

---

## 7. Recommended revised product semantics

Do not call the extension-webview implementation a “browser” without qualifiers. Suggested naming depending on scope:

| Scope | User-facing name |
|---|---|
| Local/localhost only | Ritemark Preview Browser |
| HTML files only | HTML Preview |
| Shell-level WebContentsView | Ritemark Browser |
| Hybrid | Preview in Ritemark / Open External in Browser |

Recommended behavior for current extension-scope MVP:

1. `.html` files open in Ritemark Preview.
2. `localhost:*` opens in Ritemark Preview.
3. `file://` inside workspace opens in Ritemark Preview.
4. External `http(s)` links open in system browser by default, or first show a one-time explanatory prompt.
5. If external in-app is kept as an experiment, it must be labeled “may not work; many sites block embedding.”

---

## 8. Sprint 65 re-plan proposal

### New Phase A2 — Architecture Re-audit (current)

Deliverables:

- [x] Ground-zero audit doc — this file.
- [ ] Decide revised scope: Preview-only, Shell browser, or Hybrid.
- [ ] Update `sprint-plan.md` locked decisions.
- [ ] If shell browser is chosen, create a new sprint for VS Code/Electron integration and stop extension-only implementation.

### If choosing Option C (recommended short-term)

New Sprint 65 success criteria:

- [ ] Local workspace `.html` opens and renders reliably.
- [ ] Long-distance hash anchors scroll correctly.
- [ ] Relative local links navigate correctly.
- [ ] Form/script interactivity works in local fixtures.
- [ ] `localhost:*` dev server works, including refresh/HMR.
- [ ] External `http(s)` URLs open in system browser by default or are explicitly routed there.
- [ ] No blank external iframe state is possible.

### If choosing Option B

Stop Sprint 65 as extension-only. Create new shell sprint with research tasks:

- [ ] Identify where editor-area native views can be hosted in Ritemark’s VS Code fork.
- [ ] Prototype one `WebContentsView` inside editor bounds.
- [ ] Define session partition policy.
- [ ] Define permissions policy (camera, mic, notifications, geolocation, downloads, popups).
- [ ] Define navigation controls and lifecycle.
- [ ] Threat-model untrusted web content inside Ritemark.
- [ ] Validate at least: `ritemark.app`, `google.com`, `github.com`, `localhost`, `file` preview.

---

## 9. Decision recommendation

Given the observed failures, I recommend:

1. **Do not continue patching the current implementation toward arbitrary external websites.**
2. Preserve the useful local/localhost preview work only if the product accepts a Preview Browser scope.
3. Route external URLs to system browser in Sprint 65.
4. Open a separate shell-level architecture sprint if Ritemark needs true in-app browsing.

This is not a loss of work; it is a scope correction. The current implementation taught us where the extension boundary is.

---

## 10. Sources

- VS Code Webview API: https://code.visualstudio.com/api/extension-guides/webview
- MDN CSP `frame-ancestors`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
- MDN `X-Frame-Options`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
- Electron `WebContentsView`: https://www.electronjs.org/docs/latest/api/web-contents-view
- Electron `webContents`: https://www.electronjs.org/docs/latest/api/web-contents
