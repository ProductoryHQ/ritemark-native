# Sprint 131 Phase 0 findings (W0, probes P1–P5)

**Date:** 2026-10-12. **Build:** worktree `sprint-131-browser-recent`; VS Code pin `10c8e557` with patches 001–017 applied from pristine, plus the W1 contribution and a temporary probe. The probe pushed every DTO it sent onto `globalThis.__ritemarkNavProbe` together with `model.error?.url`, `model.loading` and a timestamp. It was removed before patch 009 was regenerated, and no committed code contains it. The extension was **unmodified** (`main` at `e77a1dee`), so `ritemark.browser.didNavigate` was not registered.

**Method:** a dev instance with its own CDP port and profile (`--user-data-dir` under `/private/tmp/claude-501/rm131`) and a local fixture site on `http://localhost:8765` (titled, untitled, anchor, `pushState`, ticking-title and meta-refresh pages). Addresses were typed into the browser's address bar (a real click, `Input.insertText`, Enter). Links were clicked with real mouse events in the page's own CDP target, with Cmd as a modifier for the background tab. Reload Window was run through the command palette.

## Results

| Probe | Question | Observed | Verdict |
|---|---|---|---|
| P1 | Typo host: is `model.error` set when the navigate listener runs? | `https://no-such-host-ritemark.invalid/` → one `navigate` with `title: ""`, `failed=true`, `errorUrl` = the same address, `loading=false`. | **Pass.** `failed` is reliable as sent. No patch change. |
| P2 | `getTitle()` at `did-navigate` | http: the address **without its scheme** (`localhost:8765/titled.html`). `file:`: the **file name** (`report.html`). The real title follows in a `title` event 3–24 ms later (`Titled Fixture`, `Q3 report`). An untitled page gets no `title` event at all. Back/forward to a cached page: the real title is already in the `navigate`. | **Pass, with a rule change:** `cleanTitle` must also reject the scheme-less address and, for `file:`, the file name (R5 revised). |
| P3 | Background tab (Cmd-click): `model.url` on first show | No event while hidden. On the first switch: one `navigate` with the tab's final address (`untitled.html`) and a new `pageId`. Every later switch repeats the same address and `pageId`. | **Pass.** The recorder's per-tab repeat rule handles switches. |
| P4 | Restored tab after Reload Window | Reload confirmed (second "Started local extension host", `performance.now()` 8 s). The visible tab sent one `navigate` (`report.html`, `title: "Q3 report"`, **same `pageId` as before the reload**, `loading=false`). The page itself did not reload. The command was not registered: no log line, no notification. The only toast was the first-run usage-data notice. | **Pass.** No patch change. |
| P5 | Back, reload, `#anchor`, `pushState` | Back: `navigate` (title already known) + `title`. `#anchor`: `navigate` to `…/titled.html#section`, `loading=false`. Reload: `navigate` to the same address. `pushState`: `navigate` to `/spa/route-a` carrying the **previous route's title** (`SPA Home`), then `title` = `SPA Route A` 2 ms later. | **Pass.** The rules handle all of them. The 10 s title window corrects the stale SPA title. |
| S27 | Extension not listening | 56 events sent with no registered command: nothing in the launch log, no notification. | **Pass.** |

## Extra observations

- **Client-side redirect (meta refresh, 0 s):** `redirect.html` (`navigate` + `title: "Redirecting"`) and then `page2.html`, **12 ms apart**, in the same tab. As planned, the intermediate page would be recorded. That breaks R1's "the address the page ended on", which the plan applied to server redirects only.
- **Ticking title:** one `title` event per second for as long as the page is open (`Tick 0` … `Tick 29`). The 10 s window stops these after the first ten.
- **`pageId` survives Reload Window**, and so does the page (the browser view lives in the main process). The extension's per-tab memory does not, so the visible page moves to the top once after a reload (S11, as specified).
- The address-bar `<input>` reports a zero-size bounding box to DOM queries while it is visible on screen. Click it by position in tests; it has no product effect.

## Rule changes for W2 (no patch change, no new requirement)

1. **R5 revised:** a fallback title is ignored. That means a title equal to the address, the address without its scheme (with or without a trailing slash), or, for `file:`, the file's name.
2. **R1 revised (client redirects):** a navigation is recorded only once the tab has stayed on it for **1 second**. If the same tab navigates to another document within that second, the first one is dropped. This covers meta-refresh and script redirects, OAuth hops and pages left within a second. Titles that arrive while a navigation waits travel with it. When the extension shuts down, a waiting navigation is recorded at once.

Neither change touches the patch. Both are W2 rules, which the plan allowed Phase 0 to change ("A probe that fails within the rules changes W2's rules; record it"). They were written into spec R1 and R5 as dated revisions, scenario S30 and the technical plan's rules table before any extension code.
