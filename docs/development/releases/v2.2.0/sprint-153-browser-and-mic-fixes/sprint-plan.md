# Sprint 153: the browser's and the microphone's fixes

Track: Lightweight (two bug fixes, one PR each, no new surface)<br>
Release tier: shell. #658 changes patches 009 and 010 (the browser's context and action bridges) as well as the extension; #656's tier is recorded in its own section below.<br>
**Status:** Under way. Both fixes are in review as draft PRs. This plan was written on 5 November 2026, after Codex's review of #660 found that the work had no sprint under 2.2 (AGENTS.md: release-bound work needs one).<br>
**Approval:** the Development manager approved both fixes as one lightweight sprint on 5 November 2026, under Jarmo's 2.2 delegation of 1 November (the manager approves 2.2's plans and starts its sprints until 2.2's RC). Release approval stays Jarmo's.<br>
**Release:** [v2.2.0](../release-plan.md)

## Scope

| Issue | What | PR | Branch |
|---|---|---|---|
| [#658](https://github.com/ProductoryHQ/ritemark-native/issues/658) | With several browser tabs open, the AI's actions go to the wrong tab | [#660](https://github.com/ProductoryHQ/ritemark-native/pull/660) | `fix-658-browser-action-page` |
| [#656](https://github.com/ProductoryHQ/ritemark-native/issues/656) | Transcribe: warn when the microphone gives no sound, before and while recording | [#661](https://github.com/ProductoryHQ/ritemark-native/pull/661) | `fix-656-mic-silence` |

Each fix has its own branch and PR, named after its issue rather than the sprint (both were started as fixes before this plan existed). Each merges on its own Review record.

## #658: the AI's browser actions go to the turn's page

### Goal

Every AI browser action goes to the page its turn was given, by id: never to whichever tab is in front when the action runs, and never by bringing a tab forward.

### Jarmo's rule (5 November 2026)

**An AI action never brings a tab forward or changes what the person sees**, not even one browser tab over another. An input action on a page that isn't in front returns an error at once, and the AI asks the person. Reads keep working.

### What changed

- **The turn's page is the single source.** At the start of a turn the host records its page (`BrowserTurnPage`, one per conversation): the page the turn's browser context came from, or else the browser page in front, none when a document is in front. Every browser tool in the one registry (`src/runtime/ritemarkTools.ts`) sends that page by id, for Claude Code, Codex and OpenCode alike.
- **Patch 010 finds the page by id.** A page that has gone returns "no longer open"; nothing falls back to the active tab. Navigate loads into the turn's page, or opens a new tab that becomes the turn's page when the turn has none.
- **"In front" comes from the editors:** the page's tab is its desk's front tab, the pane is visible, and no other desk (or the AI column) is maximized.
- **Pages the AI wasn't given** are named by id only until the person shares them. Refusals carry `{ pageId, error }` and nothing else.
- **Patch 009:** the context's summary and viewport are read by page id.
- **One step of the browser queue per tool call** (Codex's review, below): reading the turn's page, the action and noting the page it opened run together, so two calls started at the same time can't each open a tab.

### Review rounds

| Round | Reviewer, commit | Found | Fixed in |
|---|---|---|---|
| 1 | Opus/high, `4de8618c` | 1 Important (showing the page brought it over the person's document), 7 minor | `1dc5a251`, with Jarmo's rule |
| 2 | Opus/high, `1dc5a251` | 3 Important (visible was taken as in front; OpenCode's page outlived its turn; refusals passed an unshared page's address and title), 2 minor | `8b590dc4` |
| 3 | Opus/high, `8b590dc4` | 1 Important (a page under a maximized AI column or desk counted as in front), 3 minor | `5137d5ea` |
| 4 | The manager's read of `5137d5ea` (`isPageInFront`, `isGroupShown`) | none | — |
| Codex | Codex, `5137d5ea` | P2: concurrent calls in a turn with no page each opened a tab. P1: no sprint. P1: no release-facing note | The commit after `5137d5ea`: the queue step, this plan, the CHANGELOG line |

### Evidence

`proof-658.txt` (not committed; grepped by the manager). Through round 4: 128 PASS, 0 FAIL.

- Shell and extension unit tests, both typechecks, and mutation checks that fail with each fix taken back.
- Patch blocks byte-identical to the tree; a dry run at the pin with 19 patches applying and 0 conflicts; the pre-commit hook passes.
- Live isolated runs: a popup, a key press, the navigate fallback, a gone page, a document in front, another browser tab in front, a blank tab, a failed page, a maximized AI column and a maximized desk. Every stop printed `LEFT=0`.
- Codex round: the new test in `src/browser/browserTurnPage.test.ts` starts two navigates at once in a turn with no page, on each runtime's path. One tab opens and the second call acts in it. With the queue step taken back, the test fails ("only one tab is opened").

### Not covered

- **A real AI turn in any runtime.** Test windows have no keys or sign-in, so the runs drive the shell commands with the page the extension sends. Gate 1 row below.
- **Windows.** Not run. The code is platform-neutral, and the browser tools sit behind the macOS-only `browser-agent-control` flag.
- **The exact original report** (Cmd+E in a web app with several tabs) was never reproduced. The two proven routes and the key-press run are covered.
- **A page in front in a minimized auxiliary window** still counts as in front.
- **OpenCode with two conversations working at once:** its adapter's requests name no conversation, so the conversation prompted last gives the page (D2, one shared browser; in architecture.md).

### Gate 1 rows (at the RC)

- **A real AI turn with several tabs, in each runtime (Claude Code, Codex, OpenCode):** three browser tabs, the turn's page not the active one. Click, type and navigate land in the turn's page; no tab comes forward; an action on a page that isn't in front returns the error and the AI asks.
- **A Codex conversation started before the update continues after it:** its visible history is there and the next message is answered. It starts a fresh native thread once, because the browser tools' new `page_id` changes the tool set Codex keys its threads by.

### Release notes

2.2's `docs/releases/v2.2.0/release-notes.md` doesn't exist yet: the release plan writes 2.2's notes in its release step, with the `release-notes` skill. Until then the CHANGELOG line under `[Unreleased] — 2.2.0` (this sprint's section) carries #658, including the one-time fresh Codex thread.

## #656: the microphone's warning

> **To be filled by PR #661** (`fix-656-mic-silence`): the goal, the release tier, what changed, the review rounds, the evidence, what is not covered, the Gate 1 rows, and its CHANGELOG line.

## Planning approval

- [x] The Development manager approves both fixes as one lightweight sprint (5 November 2026, Jarmo's 2.2 delegation of 1 November).
- [x] GitHub issues exist: #658 (bug), #656.
- [x] Each fix has its own branch and PR: #660, #661.
