# Sprint 131 QA evidence

**Date:** 2026-10-12. **Branch:** `sprint-131-browser-recent`. **Build:** VS Code pin `10c8e557` with patches 001–017 applied from pristine (patch 009 as in this branch), `out/` from `npm run transpile-client`, the extension from `npm run compile`. A dev instance ran from the worktree's own `vscode/` with its own CDP port (9331), profile and extensions directory under `/private/tmp/claude-501/rm131`. Window loads were confirmed after each Reload Window (a new "Started local extension host" line, `performance.now()` ≈ 9 s).

**Method.** Addresses were typed into the browser's address bar (real click, `Input.insertText`, Enter). Links were clicked with real mouse events in the page's own CDP target (Cmd as modifier for S10). Recent rows were clicked inside the Recent webview, and editor tabs were switched by clicking them. After each step the Recent rows were read from the `ritemark.browserView` webview as name | description | `data-url`. Fixture pages were served from `http://localhost:8765` (titled, untitled, `#section` anchors, `pushState`, ticking title, meta refresh). The step-by-step log is below. The panel screenshot is [evidence/recent-panel.png](./evidence/recent-panel.png).

## Automated

| Check | Result |
|---|---|
| `npm test` in `extensions/ritemark` (includes `browserNavigationRecorder.test.ts`, `BrowserHistoryStore.test.ts`) | exit 0 |
| `npm run compile` (tsc + esbuild) | clean |
| Mutation check: drop the "replaced within 1 s" cancel, or the `failed` filter | each caught by `browserNavigationRecorder.test.ts` |
| Patch stack from pristine: dry run, real apply, second run | 17/17 can apply, 0 conflicts; apply exit 0; re-run exit 0 ("already applied") |
| Patch 009 | 4 `diff --git` entries, same paths; diff vs `main` only in the header and the new-file hunk |
| `npm run compile-check-ts-native` in `vscode/` (tsgo) | clean |
| Contract: patch 009 defines `RITEMARK_BROWSER_DID_NAVIGATE_COMMAND = 'ritemark.browser.didNavigate'` | asserted by the recorder test |

## Scenario matrix

| Scenario | Result | Evidence |
|---|---|---|
| S1 typed address | Pass | `ritemark.app` → one entry, "Ritemark - Markdown Editor with AI Agents" over `ritemark.app/en/` (`https://ritemark.app/en/`) |
| S2 same-tab link | Pass | titled → page2: "Second Page" on top, "Titled Fixture" second |
| S3 SPA route change | Pass | `spa.html` → `pushState` `/spa/route-a`: "SPA Route A" on top (the stale "SPA Home" title from the navigation was corrected) |
| S4 Back | Pass | Titled Fixture back on top |
| S5 server redirect | Pass | `http://github.com` → one entry `https://github.com/`, no `http://` entry |
| S6 open by command | Pass | "Open URL in Ritemark Browser" with `file:///…/notitle.html` → one entry. This is the same `openInIntegratedBrowser()` as the explorer's "Open in Ritemark Browser", which needs the native context menu |
| S7 HTML file opener | Pass | double-click `report.html` in the explorer, with the tab closed first so the resolver opens a new one → "Q3 report" on top, once |
| S8 click a Recent row | Pass | SPA Home row → opens, moves to top, still 8 entries |
| S9 AI agent navigation | **Not run** | Needs a real agent turn with Jarmo's Claude credentials from a differently signed dev build (possible keychain prompt on his screen, tokens). Bridge-wise it is the same `model.loadURL` → `did-navigate` path as S1. **On the Gate 2 list.** |
| S10 background tab | Pass | Cmd-click: no change; first switch: the untitled page on top; switch away and back: no change |
| S11 Reload Window | Pass | the visible tab's page moved to the top once (`report.html`, later `example.com`); no error notification (only the first-run usage-data notice) |
| S12 new empty tab | Pass | no change |
| S13 typo host | Pass | `https://no-such-host-ritemark.invalid/` → no change |
| S14 `#anchor` jump | Pass | no change |
| S15 reload | Pass | no change |
| S16 private session | Pass | `workbench.browser.dataStorage: ephemeral`, new tab, two pages → no change. Control with the setting removed: the same `example.com` visit is recorded |
| S17 other schemes | Pass | `data:text/html,…` loaded in the tab → no change |
| S18 overlong address | Pass (unit) | `browserNavigationRecorder.test.ts` |
| S19 entries from earlier versions | Pass (unit) + seen live | unit test; live: round 1's duplicate `titled.html` row merged with the `#section` entry on the next visit |
| S20 cap 25 | Pass (unit) | `BrowserHistoryStore.test.ts` |
| S21 title after the address | Pass | ticking page: "Tick 3" after ~3 s |
| S22 changing title | Pass | after ~19 s the page showed "Tick 19", the row "Tick 9" |
| S23 page without a title | Pass | `notitle.html` shows its file name over the path; the stored title is empty (unit: the file name is a fallback) |
| S24 deleted local file | Pass | `notitle.html` deleted, Recent hidden and shown → entry gone, `report.html` kept |
| S25 unreachable file kept | Pass (unit) | `NoPermissions` and a throwing check keep the entry |
| S26 localhost | Pass | every fixture page is recorded like any web page |
| S27 extension not listening | Pass (W0) | 56 events with no registered command: no log line, no notification |
| S28 malformed input | Pass (unit) | |
| S29 patch stack | Pass | see Automated |
| S30 client-side redirect | Pass | `redirect.html` (meta refresh 0) → only "Second Page"; no "Redirecting" entry |
| S31 Back to a page at an anchor | Pass after fix | round 1 showed two "Titled Fixture" rows (`titled.html` and `titled.html#section`). The fix dedupes by page; round 2 shows one entry, on top, at `#section` |

## Defects found and fixed during QA

1. **Two rows for one page (S31).** Back to `page.html#section` from another page is a new document load, so it was recorded next to `page.html`. Entries are now keyed by the page without its `#fragment` (`historyKey`), and the entry keeps the latest address. Spec R4 revised, P10.
2. **Dev servers indistinguishable without a title.** An untitled `localhost:8765` page showed only "localhost". The name line now uses the host with a non-default port. Spec R5 revised.

## Anomalies seen and not caused by this sprint

- **"An unknown error occurred" in the console at every extension-host start:** the dev tree's built-in `GitHub.copilot-chat` extension (`vscode/extensions/copilot`) fails its GitHub login (`GitHubLoginFailed` from `getCopilotToken`). It also appeared on the first launch, before any Sprint 131 extension code was loaded. Dev-tree only.
- **"Chat" and "Chat Debug" activity-bar items, and the side bar coming back on "Chat Debug" after a reload:** both from the same dev-tree Copilot extension.
- **Empty CHAT side bar on the first launch of a fresh profile:** the known #276 behaviour.
- **A long local path in a row's second line breaks mid-word** ("re / port.html"): the panel's existing `word-break: break-all` style, unchanged here.
- The address-bar `<input>` reports a zero-size box to DOM queries while visible. The tests click it by position; no product effect.

## Not run

- S9 (see the table). For Gate 2: ask the agent to open a page in the browser, then check Recent.
- Windows. Nothing here is platform-specific, but the Windows check (S1, S2, S6, S10 with Ctrl-click, S24) is on the v1.14.0 release test list.

## Step log (Recent rows after each step)

Round 1 is before the S31 fix and round 2 after it.

### S11 after Reload Window (visible tab report.html)
```
Q3 report | <workspace>/report.html | file://<workspace>/report.html
```
### Clear History
```
(empty) No recent URLsPages you visit in Ritemark Browser appear here.
```
### S12 new empty tab
```
(empty) No recent URLsPages you visit in Ritemark Browser appear here.
```
### S1 typed ritemark.app
```
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### S5 typed http://github.com (server redirects to https)
```
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### S2 + S26 localhost titled.html, then same-tab link to page2
```
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### S4 Back (titled.html returns to top)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### S14 #anchor jump (no change)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### page2 then Back (titled on top again)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### S15 reload titled (no change)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
--- QA round 2 (after S31 fix)
### R4 legacy-style duplicate rows from round 1 after reload (store merges on next visit)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub | github.com | https://github.com/
Ritemark - Markdown Editor with AI Agents | ritemark.app/en/ | https://ritemark.app/en/
```
### Clear History
```
(empty) No recent URLsPages you visit in Ritemark Browser appear here.
```
### S31 titled, #section, page2, Back -> one titled entry on top
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
```
### S3 SPA home then pushState route A
```
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
```
### S30 meta refresh redirect.html -> page2 (no Redirecting entry; page2 moves up)
```
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S13 typo host (no change)
```
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S17 data: address (no change)
```
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S6 + S23 Open URL command with an untitled local file (file name over path)
```
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S7 double-click report.html in the explorer
```
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S7 again: Q3 report tab closed, page2 visited, double-click report.html opens a new tab
```
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S6 + S23 Open URL command, untitled local file (file name over path, once)
```
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S21 ticking page after ~3 s
```
Tick 3 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S22 ticking page after ~19 s (title frozen at <= Tick 10)
```
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html#section
```
### S10 start: titled on top
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
```
### S10 after Cmd-click (background tab opened; no change)
```
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
```
### S10 first switch to the background tab (untitled on top)
```
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
```
### S10 switch away and back (no change)
```
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
```
### S8 click the SPA Home row (opens, moves to top, count unchanged)
```
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
### S24 file deleted, Recent still visible (not re-shown yet)
```
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
notitle.html | <workspace>/notitle.html | file://<workspace>/notitle.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
### S24 after hiding and showing Recent (notitle.html gone, Q3 report kept)
```
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
### S16 ephemeral session: new tab browses redirect?private=1 -> page2, then example.com (no change)
```
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
### S16 control: setting restored, new tab, example.com (recorded)
```
Example Domain | example.com | https://example.com/
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
### After Reload Window with the port fix (S11: visible tab example.com on top once)
```
Example Domain | example.com | https://example.com/
SPA Home | localhost:8765/spa.html | http://localhost:8765/spa.html
localhost:8765 | /untitled.html | http://localhost:8765/untitled.html
Titled Fixture | localhost:8765/titled.html | http://localhost:8765/titled.html
Tick 9 | localhost:8765/ticking.html | http://localhost:8765/ticking.html
Q3 report | <workspace>/report.html | file://<workspace>/report.html
Second Page | localhost:8765/page2.html | http://localhost:8765/page2.html
SPA Route A | localhost:8765/spa/route-a | http://localhost:8765/spa/route-a
```
