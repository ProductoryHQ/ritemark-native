# Sprint 131 — Browser Recent records the pages you visit

Track: SDD (auto-detected: a multi-component flow, workbench patch → command bridge → extension host → `globalState` → webview; plus address-classification edge cases: failed loads, `#anchor` jumps, redirects, private sessions, deleted local files)<br>
Override with: "use plain full track"<br>
Release tier: **shell** (`patches/vscode/009-ritemark-browser-context-bridge.patch`). It ships in the v1.14.0 app release, which is shell-tier anyway (Sprint 129's whisper binaries, Sprint 130's activity-bar icon). The extension half depends on the patch and cannot go out early in an extension release: the extension preflight refuses any release whose diff since the last app release touches `patches/`, and an extension update always requires its own app version.<br>
Status: **Phase 2 (PLAN) — written 2026-10-12, awaiting Jarmo's approval. No branch, no code.**<br>
Branch: `sprint-131-browser-recent` (created from `main` only after approval, before the first code edit)<br>
Release: [v1.14.0](../release-plan.md) · Milestone [v1.14.0](https://github.com/ProductoryHQ/ritemark-native/milestone/13)<br>
Issue: [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195), "Browser: Recent never records in-panel browsing" (bug, ux). Jarmo pressed "Build it" on 2026-10-11 and "Start its session" on 2026-10-12.<br>
Size: small. One contribution of about 50 lines in a file patch 009 already creates. On the extension side, one new module, edits to four files and two test files. No new dependency, flag, setting, patch file or UI element.

## SDD Artifacts

- [spec.md](./spec.md): behaviour contract (R1–R8).
- [scenarios.md](./scenarios.md): BDD matrix (S1–S29); it becomes the dev-instance QA matrix.
- [technical-plan.md](./technical-plan.md): workstreams W0–W5, the bridge code shape, the recorder rules table, files to change, risks.
- [tasks.md](./tasks.md): implementation checklist.
- [research/current-state-audit.md](./research/current-state-audit.md): what the code does today, with file:line references, the options considered, and what Phase 0 still has to prove.

## Goal

The Browser's Recent list shows the pages the user actually visited, by their real address and title, without failed loads, blank tabs, anchor jumps or deleted local files.

## Why

Recent is written in exactly one place, `openInIntegratedBrowser()` (`IntegratedBrowser.ts:36`), which runs only when a page is opened by a command. Typing an address, clicking a link, going back, the AI agent's navigation and opening an `.html` file record nothing. So for anyone who browses inside the panel, the list freezes on whatever local HTML files were once opened by command. That is the reported screenshot, and a v1.8.6 known issue.

The workbench already fires an event for every navigation and title change. Nothing forwards those events to the extension. See the [audit](./research/current-state-audit.md).

## Scope

In scope:
- **The bridge (W1).** Patch 009's feature file gets a second editor contribution, next to the existing annotation one. For the browser tab each editor pane is showing, it forwards every navigation and title change to an internal extension command, `ritemark.browser.didNavigate`, as `{ kind, pageId, url, title, failed, ephemeral }`. A tab opened in the background is reported when it is first shown. No upstream VS Code file gets a new hunk, and patch 010 is untouched.
- **The rules (W2), in the extension and unit-tested:** only `http`/`https`/`file`; no failed loads; no private sessions; a reload, a tab switch or an `#anchor` jump is not a new entry; one entry per address (`https://site` = `https://site/`, entries saved by earlier versions included); titles that settle within 10 s of the navigation; at most 25 entries, newest first (unchanged).
- **One source.** The old record call in `openInIntegratedBrowser()` goes away; every opened page is still recorded, by the bridge, at the address it ended on.
- **The polish (W3).** Page titles in the rows, with the address as the second line. Local `file://` entries whose file is gone are removed when Recent is shown.
- **Tests and checks (W4).** Unit tests for every rule and a contract test that keeps the command name in step with patch 009. Pristine apply and re-run of the patch stack. A dev-instance run of S1–S26 that browses by address bar, by link, by background tab and by agent, then reads the Recent list.

Out of scope: history search or a full-history view; a setting to turn recording off; live refresh of the list between two windows; favicons; anything about the AI's browser context or consent. See [spec.md Non-Requirements](./spec.md#non-requirements).

**The extension-only polling variant from the issue is dropped.** The issue offered it as a stopgap in case a shell release was far off. v1.14.0 is a full app release either way, so the poll would ship in the same build as the real fix, and it would still miss every page between two polls.

## Requirement Traceability

| Requirement | Scenarios | Workstreams | Close evidence |
|---|---|---|---|
| R1 browsing inside the browser is recorded | S1–S5 | W1, W2 | dev-instance run |
| R2 pages opened any other way, once, by real address | S6–S11 | W1, W2 | dev-instance run |
| R3 what is not recorded | S12–S18 | W2 | unit tests + dev-instance run |
| R4 one entry per address | S19–S20 | W2 | unit tests + dev-instance run |
| R5 titles | S21–S23 | W2, W3 | unit tests + dev-instance screenshot |
| R6 deleted local files drop out | S24–S25 | W2, W3 | unit tests + dev-instance run |
| R7 localhost like any page | S26 | W2 | dev-instance run |
| R8 bridge safe across versions and patches | S27–S29 | W0, W1, W4 | W0 run + unit/contract tests + pristine apply |

## Product Decisions

- **2026-10-11 (Jarmo):** #195 is in v1.14.0 ("Build it" on the Dev Dashboard).
- **2026-10-12 (proposed with this plan, accepted with approval):**
  - **P1 — Recent means "pages the browser showed you".** That covers what the user typed or clicked, what a command or file opened, and where the AI agent navigated the visible tab. The workbench cannot tell an agent's click from the user's, and the agent works in a tab the user is watching.
  - **P2 — Local dev-server pages are recorded like any other page.** No marker and no skipping. Ritemark users reopen sites their agents built, and Recent is where they would look. The cost is a few `localhost` entries.
  - **P3 — Private browsing stays private.** A tab in an ephemeral session (`workbench.browser.dataStorage: ephemeral`; untrusted workspaces always use it) records nothing.
  - **P4 — Titles settle in 10 seconds.** The title a page has within 10 s of loading is kept. Later changes (unread counters, clocks) do not rewrite the list.
  - **P5 — Deleted local files are removed, unreachable ones are kept.** Only "file not found" removes an entry, so a disconnected drive or network share does not wipe its pages.
  - **P6 — No feature flag.** This fixes a broken existing feature, and the patch cannot be switched off at runtime anyway. Revert is by PR.
  - **P7 — Docs written directly.** The sprint docs were written in this session using the `sprint-manager` templates and the `spec-driven-sprint` playbook, not through the subagent. The subagent stalls on multi-file packages (memory, 2026-09-14).

## Feature Flag Decision

None (P6). Not platform-specific, not experimental, no download, not premium. A kill switch would only bring back the defect.

## Pre-Implementation Gate

- **Architecture gate: applies, lightly.** This is the browser bridge's first push from the workbench into the extension. Every other bridge command is a pull. No locked decision changes. `docs/development/architecture.md` records it before the sprint closes (T5.1), and so does the CLAUDE.md patch table (T5.2).
- **Patch rules:** patch 009 keeps its four files; regenerate over exact paths; pristine apply plus re-run; patch 010 checked on top (T1.3–T1.4).
- **Phase 0 (W0) comes first.** Five assumptions about event order and timing are proven in a patched dev instance before the extension code is written. If a probe needs a different patch shape, Jarmo hears about it before W1 is final.
- **Nothing here needs Jarmo's machine or accounts.** Gate 2 on the signed v1.14.0 build, Mac and Windows, is the only check that is his.

## Success Criteria

- [ ] Typed addresses, same-tab link clicks, single-page-site route changes and back/forward appear in Recent at the address the page ended on (R1).
- [ ] Pages opened by command, file, terminal link, Recent itself, the AI agent or a background tab appear exactly once (R2).
- [ ] Blank tabs, failed loads, anchor jumps, reloads, tab switches, private sessions, other schemes and overlong addresses add nothing (R3).
- [ ] One entry per address, entries saved by earlier versions included; 25 max (R4).
- [ ] Rows show page titles with the address below; changing titles stop updating after 10 s (R5).
- [ ] Deleted local files drop out when Recent is shown; unreachable ones stay (R6).
- [ ] `localhost` pages are recorded like any other (R7).
- [ ] No error or notification when the extension is not listening; malformed input is ignored; patch 009 still 4 files; full stack applies from pristine and on re-run; contract test green (R8).
- [ ] `npm test` and `npm run compile` clean; dev-instance evidence in `qa-evidence.md`; `qa-validator` sign-off.
- [ ] Windows check listed in the v1.14.0 release test.

## Status

**Track:** SDD
**Current Phase:** 2 (PLAN)
**Approval Required:** Yes. Jarmo, in the Sprint 131 session, in his own words. A relayed message from the Development manager does not count.

## Approval

- [ ] Jarmo approved this sprint plan
