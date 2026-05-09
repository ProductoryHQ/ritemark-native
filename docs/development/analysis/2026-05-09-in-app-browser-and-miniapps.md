# In-App Browser & Miniapp Runtime — Analysis

**Date:** 2026-05-09
**Branch:** `claude/in-app-browser-74rrS`
**Status:** Planning (analysis only — not approved for implementation)

---

## 1. Vision

Hybrid editor-tab feature serving two related needs:

1. **Lightweight dev-preview browser** — open localhost / static HTML / remote URLs without leaving Ritemark
2. **Miniapp runtime** — open packaged HTML artifacts (dashboards, tools) with curated workspace-file access

Personal use (single user, no sharing protocol). Markdown-editor-native: feels like opening a file, not launching an external tool.

---

## 2. Architecture Decisions (locked)

### Browser tab

| Concern | Decision |
|---|---|
| Underlying tech | VS Code Simple Browser pattern: webview panel containing sandboxed `<iframe>` |
| Tab opening | Custom Editor Provider (same mechanism as `.md`) |
| Chrome | URL bar, back, forward, refresh — nothing more |
| `X-Frame-Options` blocked sites | Detect failure, render fallback panel with "Open in system browser" button |
| Multi-tab | One webview per VS Code tab (no shared state, by design) |
| Localhost | Works out of the box (no XFO, websockets unrestricted) |
| DevTools | Out — debug happens in external Chrome |
| Cookies / sessions | Webview-isolated, ephemeral (VS Code default) |
| VS Code core patches | **None.** Stays inside extension boundary. |

### Miniapp runtime

| Concern | Decision |
|---|---|
| File format | Single-file `.html` (inline CSS + JS). Folder/zip deferred. |
| Identification | TBD in Sprint 2 Phase 1 (likely `<meta name="ritemark:miniapp">` or filename convention) |
| Sandbox | `sandbox="allow-scripts"` — explicitly **without** `allow-same-origin` |
| Workspace API | `postMessage` bridge: `miniapp:listFiles`, `miniapp:readFile` |
| File-type whitelist | `csv`, `json`, `txt`, `md` (extensible later) |
| Consent flow | User confirmation dialog on first file access per miniapp per session |
| Secrets / AI keys | **Not in MVP.** Single-file artifacts must not contain secrets. |
| Sharing / export | **Not in MVP.** Personal use only. |

---

## 3. Out of MVP Scope (explicitly deferred)

- Full Chromium via `WebContentsView` patch (re-evaluate if XFO becomes a real pain point)
- DevTools attached to the iframe
- Cookie / session persistence across tabs or restarts
- Bookmarks, history, tab grouping
- Hot-reload custom handling (rely on dev server's own HMR)
- AI-key bridge for miniapps (separate design)
- Folder/zip miniapp packaging
- AI-generated artifacts opened directly from chat
- Sharing/export workflow for miniapps
- Cross-miniapp messaging

---

## 4. Risks

### R1 — postMessage bridge security (HIGH)
Iframe runs `allow-scripts` only, but the bridge protocol is the trust boundary. A poorly designed protocol could let a miniapp:
- Read files outside the workspace
- Read disallowed file types (e.g. `.env`)
- Exfiltrate file contents via `fetch()` to an attacker domain

**Mitigation:** Sprint 2 Phase 1 is a security-design phase. Whitelist file types, scope to workspace root, require consent on first access, optionally block outbound `fetch()` via CSP.

### R2 — XFO surprise factor (MEDIUM)
Users will try to open google.com / GitHub / Stripe and the iframe will refuse. The fallback UI must be obvious and helpful, not look like a bug.

**Mitigation:** Detect via iframe load timeout + sniff response headers when possible. Render explicit "This site doesn't allow embedding" panel with one-click open-in-system-browser.

### R3 — Static `.html` opener conflict (LOW)
If we make `.html` open in the browser-tab by default, users editing HTML source files will be annoyed. Need a per-file or per-extension toggle.

**Mitigation:** Settings option, plus right-click "Open as text" / "Open in browser" disambiguation.

---

## 5. Sprint Plan

### Sprint A — In-App Browser (foundation)

**Goal:** Ship a working dev-preview browser tab. No miniapp concept yet.

**Scope (in):**
- Custom Editor Provider for browser tab
- Command: `Ritemark: Open URL in Browser`
- Webview HTML with sandboxed `<iframe>`, CSP, cache-bust on reload
- Browser chrome: URL bar (editable), back, forward, refresh
- XFO-failure detection + fallback panel ("Open in system browser")
- Open static workspace `.html` files in browser tab (with text-editor fallback)
- Open `localhost:*` URLs from terminal output (clickable hyperlink → browser tab)
- Multi-tab via VS Code's tab system

**Scope (out):**
- Cookies / sessions persistence
- DevTools
- Bookmarks, history
- Tab grouping
- Address-bar autocomplete / suggestions
- Anything resembling a "real browser profile"

**Success criteria:**
- `localhost:5173` opens, React HMR works end-to-end
- Workspace `index.html` renders in tab (not as text)
- `google.com` shows graceful fallback + functioning "open in Chrome"
- Three tabs open in parallel without state bleed
- Pre-commit hook + qa-validator green

**Estimated effort:** Small-to-medium. Most code adapted from VS Code's `extensions/simple-browser`.

**Dependencies:** None.

---

### Sprint B — Single-File Miniapp Runtime

**Goal:** Open `.html` artifacts as sandboxed miniapps with curated workspace-file access.

**Depends on:** Sprint A shipped and stable. Same browser-tab surface is reused; miniapps just get an additional postMessage bridge.

**Phase 1 (planning) — security & protocol design:**
- Bridge protocol spec (message types, payloads, error shape)
- File-access scope (workspace root only? respect `.gitignore`?)
- Consent UX (per-miniapp? per-file? per-session?)
- Identification: how does a `.html` file declare itself a miniapp?
- CSP additions to block disallowed outbound traffic
- Threat model written down

**Phase 2-5 (implementation) scope (in):**
- "Run as miniapp" entry point (command + right-click on `.html`)
- PostMessage bridge wired in extension + webview
- File-access consent dialog + per-session memory
- File-type whitelist enforcement
- Two example miniapps shipped as docs: CSV viewer, simple dashboard
- Settings page entry: per-miniapp permissions reset

**Scope (out):**
- AI / API-key bridge
- Folder/zip miniapp format
- Sharing / export
- AI-generated miniapps from chat
- Cross-miniapp communication

**Success criteria:**
- Example CSV-viewer miniapp opens, reads `data.csv`, renders chart
- First file-access shows consent dialog; second access silent (same session)
- Attempting to read `.env` returns a typed error to the miniapp
- Miniapp cannot access any host API not in the documented protocol
- Threat model doc reviewed and accepted

**Estimated effort:** Medium. Phase 1 (security design) is the critical path — implementation is straightforward once protocol is locked.

---

## 6. Why this sprint split

1. **One-way dependency** — miniapps run *inside* the browser tab. Browser doesn't need miniapps.
2. **Independent shippable value** — Sprint A alone is useful for daily dev work.
3. **Risk isolation** — Sprint B's hardest risk (security protocol) doesn't block Sprint A.
4. **Feedback loop** — using Sprint A in production for weeks informs Sprint B's protocol design (which file types are *actually* needed, what consent friction tolerates).
5. **Different shapes of work** — Sprint A is execution-heavy on known patterns; Sprint B is design-heavy on novel security protocol.

---

## 7. References

- VS Code Simple Browser source: `microsoft/vscode/extensions/simple-browser/src/`
  - `simpleBrowserView.ts`, `simpleBrowserManager.ts`, `preview-src/index.ts`
- Claude Artifacts pattern: sandboxed cross-origin iframe + strict CSP + no localStorage
- Observable Framework `FileAttachment` API — closest precedent for curated file access from a sandboxed runtime
- Electron `WebContentsView` (Electron 29+) — fallback path if iframe limits become unworkable
- Cursor in-app browser — likely uses `WebContentsView` overlay (unconfirmed, inferred from forum reports)

---

## 8. Open questions for next planning round

- Sprint A: should the URL bar accept `file://` paths, or only `http(s)://` and `localhost`?
- Sprint A: what's the right default for `.html` files in workspace — browser or editor? Per-user setting?
- Sprint B: identification convention — `<meta name="ritemark:miniapp">` tag, or filename suffix (`*.miniapp.html`), or directory (`.ritemark/miniapps/`)?
- Sprint B: does consent persist across sessions (settings file) or reset every restart?
