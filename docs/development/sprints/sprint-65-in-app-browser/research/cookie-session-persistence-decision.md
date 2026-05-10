# Cookie & Session Persistence — Audit and Decision

**Status: GATE DOCUMENT — Jarmo approval required before Phase B begins.**

---

## Findings

### F1. What `WebviewOptions` Exposes for Partition/Persistence

Confirmed by reading `vscode/src/vscode-dts/vscode.d.ts` lines 9897–9945:

```typescript
export interface WebviewOptions {
    readonly enableScripts?: boolean;
    readonly enableForms?: boolean;
    readonly enableCommandUris?: boolean | readonly string[];
    readonly localResourceRoots?: readonly Uri[];
    readonly portMapping?: readonly WebviewPortMapping[];
}
```

There is **no `partition` field, no `profile` field, no `persistentSession` flag** in `WebviewOptions`. VS Code's webview API does not expose Electron's `webview` `partition` attribute at the extension API layer.

`WebviewPanelOptions` (`vscode.d.ts` lines 10053–10077):

```typescript
export interface WebviewPanelOptions {
    readonly retainContextWhenHidden?: boolean;
}
```

`retainContextWhenHidden: true` keeps the webview's JavaScript heap alive when the tab is hidden (prevents re-render on tab switch). It does **not** affect cookie or session storage. Cookies in a VS Code webview are isolated to the webview's Electron session partition, which is assigned by VS Code core — not configurable from the extension API.

**Conclusion: There is no extension-API mechanism to select a persistent cookie partition for a VS Code webview. Cookie/session persistence requires either (a) a VS Code core patch to expose partition selection, or (b) the `allow-same-origin` sandbox flag combined with the browser engine's default session for that partition (which is determined by VS Code core, not the extension).**

No core patch is in scope for Sprint 65. Therefore, option (a) is not available.

### F2. `localResourceRoots` Has No Effect on Session Storage

`localResourceRoots` controls which filesystem paths the webview can load via `asWebviewUri` URIs. It has no relationship to cookies or session storage. This field is irrelevant to the persistence question.

### F3. Can `allow-same-origin` Be Conditionally Applied Per Scheme?

The `sandbox` attribute is a static string on the `<iframe>` HTML element. It is set when the webview HTML is rendered (before the iframe navigates). It cannot be changed after the iframe has loaded without destroying and recreating the iframe.

**Investigated workarounds:**

#### Option A: Separate Webview Instance per Scheme

Create one webview (without `allow-same-origin`) for `http(s)://` external URLs, and a different webview (with `allow-same-origin`) for `localhost:*` and `file://` URLs.

- Feasibility: Technically possible. Two `BrowserEditorProvider` registrations, or conditional creation in a single provider.
- Problem: The user sees the same tab surface regardless of which webview is backing it. Switching a tab from external URL to localhost URL would require destroying and recreating the backing webview, causing a flash. The URL bar and history state would need to be preserved across the swap.
- Verdict: Feasible but fragile. The swap-on-navigate logic is a non-trivial source of bugs. Adds complexity without a clean abstraction. Not recommended for Sprint 65.

#### Option B: Dynamic Sandbox via `srcdoc` Swap

Instead of setting `iframe.src` directly, set `iframe.srcdoc` to an HTML document that immediately redirects to the target URL via `<meta http-equiv="refresh">` or `window.location = url`. The outer `<iframe>` would have a different sandbox than the inner redirect target.

- Problem: `srcdoc` content is treated as `about:srcdoc` origin regardless of sandbox flags. The redirect to the external URL inherits the outer sandbox. This does not change which sandbox flags apply to the loaded page.
- Verdict: Does not work. The sandbox attribute applies to the iframe's navigation chain, not just the initial document.

#### Option C: postMessage Relay Without `allow-same-origin`

Instead of relying on the browser's native cookie storage (which requires `allow-same-origin`), implement a relay: the extension host proxies requests from the iframe, appending session tokens as query parameters or custom headers. The iframe communicates with the extension host via postMessage for all authenticated requests.

- Problem: Arbitrary websites (including localhost dev servers) do not know to use this relay. This is only feasible for miniapps that are specifically designed to communicate with the Ritemark postMessage bridge.
- Verdict: Not applicable for a general-purpose browser tab. Applicable only for Sprint B miniapp design.

#### Option D: Dynamic `sandbox` Attribute Update via `webview.html` Reload

The extension host rebuilds `webview.html` with a different `sandbox` string and reassigns `webviewPanel.webview.html`. This reloads the entire webview (resets all state, re-runs all JavaScript, flashes the UI).

- For navigation between URLs: the user would see a full webview reload (flash) every time they navigate from a `localhost` URL to an external URL or vice versa. This is a poor UX.
- Verdict: Technically feasible for the initial load (decide sandbox at tab-open time based on the URL). Not feasible for in-tab navigation.

**Conclusion on conditional `allow-same-origin`:** There is no practical, non-patching mechanism to apply `allow-same-origin` selectively to `localhost` and `file://` origins while withholding it from `http(s)://` URLs within a single browser tab that allows navigation between URL types. The sandbox attribute is static per webview HTML render.

### F4. XFO Behavior Is Unaffected by `allow-same-origin`

`X-Frame-Options` enforcement is performed by the browser engine when it receives the HTTP response headers from the embedded site's server. The `allow-same-origin` sandbox flag controls the iframe's access to its own origin context — it does not affect how the browser engine enforces `X-Frame-Options`.

Reasoning:
- XFO `DENY` instructs the browser engine to refuse rendering the page inside any frame, regardless of the frame's sandbox.
- XFO `SAMEORIGIN` instructs the browser engine to allow embedding only if the frame's top-level origin matches. The VS Code webview's top-level origin is the webview's internal `vscode-webview://` scheme — not the same origin as any external site, so `SAMEORIGIN` always blocks external sites.
- `allow-same-origin` in the sandbox grants the iframe's JavaScript code access to its origin context. It does not change the browser engine's frame-loading decision, which happens before any JavaScript runs.

**Confirmed: Adding `allow-same-origin` would not change XFO behavior. XFO-blocked sites remain blocked regardless of sandbox flags.**

### F5. Sprint B Threat-Model Implication

Sprint B (Miniapp Runtime) plans to run miniapp `<iframe>` instances with `sandbox="allow-scripts"` — explicitly without `allow-same-origin`. This is the miniapp's core security constraint: miniapps cannot access cookies, localStorage, or IndexedDB, which prevents them from exfiltrating user session data via the postMessage bridge.

If Sprint 65 adds `allow-same-origin` to the browser iframe and miniapps are opened via the same `BrowserEditorProvider` code path:
- A malicious miniapp could declare itself a `localhost` URL and receive `allow-same-origin`.
- Even if miniapp identification is separate, the code path sharing creates a risk of accidental `allow-same-origin` propagation in refactors.

**The safest architectural constraint for Sprint B:** Miniapp webviews must be instantiated via a completely separate code path from the general-purpose browser tab. If Sprint 65 adds `allow-same-origin` (even conditionally), Sprint 66 must explicitly verify that the miniapp path does not inherit it.

If Sprint 65 stays ephemeral (recommendation (a) below), this implication is moot for Sprint 65. It is documented here so Sprint 66 planning cannot ignore it.

---

## Recommendation

### Decision: (a) Stay Ephemeral

**Rationale:**

1. No extension-API mechanism exists to select a persistent session partition without a VS Code core patch, which is out of scope.
2. Conditional `allow-same-origin` per scheme is not technically feasible within a single navigable browser tab without a full webview reload on scheme change (unacceptable UX) or separate webview instances per scheme (fragile and complex).
3. The primary use case for Sprint 65 is `localhost` dev-server preview. Localhost dev servers (Vite, webpack-dev-server, React dev server) do not rely on persistent cookies between sessions — they use in-memory state. Session persistence is not needed for the dev-preview workflow.
4. The `file://` use case (opening workspace HTML files) has no meaningful session state concept.
5. Adding `allow-same-origin` for any URL weakens the Sprint B miniapp sandbox unless Sprint 66 explicitly enforces a separate code path. Keeping `allow-same-origin` off in Sprint 65 simplifies the Sprint B security design.
6. The risk of silent privilege escalation from an ad-hoc `allow-same-origin` decision is higher than the cost of deferring cookie persistence.

**What this means for the user:**
- Dev server (Vite, etc.): no meaningful impact — these use HMR WebSocket state, not cookies.
- `localhost` apps requiring login (e.g. a local admin panel): the user will need to log in again each time Ritemark restarts. This is a known limitation documented in Sprint A's out-of-scope list.
- External URLs: cookies are ephemeral (same as today — external URLs are primarily used for quick reference lookup, not authenticated workflows).

---

## Scope Delta

Recommendation is (a) — Stay Ephemeral. **No scope changes to Sprint 65.** Phase B proceeds as currently planned.

The sprint plan's Deliverables table, Implementation Checklist, and Success Criteria are unchanged.

---

## Explicit Non-Decision for Future Sprint

Cookie/session persistence is deferred. If this becomes a friction point in production use (specifically: users frequently use the browser tab for localhost apps requiring repeated login), the correct approach is one of:

- A dedicated sprint to investigate whether VS Code's `createWebviewPanel` can accept a custom `session` via an Electron-level API that VS Code might expose in a future extension API update.
- A sprint to evaluate the "separate webview per scheme" approach with explicit UX for the swap behavior.
- Acceptance that the in-app browser is intentionally session-less (like Incognito mode) and documenting this expectation.

This decision does not need to be revisited until Sprint 65 has been in production and user feedback specifically calls it out.
