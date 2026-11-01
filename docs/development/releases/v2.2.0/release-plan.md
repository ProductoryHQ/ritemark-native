# Release Plan — v2.2.0

**Status:** **Approved** (31 October 2026). Jarmo agreed to the appetite (below) and approved Sprint 145's plan in one message: "agreed with all". The shape's scope is chosen (29 October), and so is the sprint order (31 October: "sprintide järjekord üldiselt sobib"). The review process (Steps 1–7) is on `main` or in review, so 2.2's PRs are reviewed by it from the first one.<br>
**Target:** v2.2.0<br>
**GitHub milestone:** v2.2.0<br>
**Release type:** **Shell-tier.** A full app release for the Mac and Windows:
- #568 (a tab's menu) and #594 (the left column's hover row) change patches 019 and 018, and #567 (File changes with no Git) changes 016 and 018 (Sprint 146's plan);
- #515 moves Electron to one carrying Node 24.22.1 (patch 020);
- the Store gets a normal update.

It is built, gated and notarized as 2.1 was: a clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI on the free runner with the repository public.<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64, and the Microsoft Store<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-31<br>
**Source:**
- the shape: `ritemark-dev`: [`releases/v2.2.0/shape.md`](../../../../../releases/v2.2.0/shape.md), with its 29 October spikes in `analysis/2026-10-29-spikes/`. The link resolves in the usual checkout, where `ritemark-native` sits inside `ritemark-dev`;
- the review process: `ritemark-dev`: `releases/v2.2.0/analysis/2026-10-27-review-process-plan.md`;
- the decisions' rows in `ritemark-dev`: `decisions/log.md`, 29–31 October.

## Release Thesis

**Inside the team:** "2.2 is about sharing ideas, and a web page is the best format for them" (Jarmo, 29 October: "2.2 lugu on seotud ideede jagamisega ja HTML/web page on parim formaat").

**In public**, a first draft: "You can now share your ideas as a web page. Make it yourself or with AI." The final line is written with the `release-notes` skill near the release.

The five items, in the shape's order:

1. **Publish a web page** (the lead). Any .html file in the project opens on the desk as the page, with Open in browser and Publish. Publish goes to the person's own Cloudflare, with Copy link, Update the page and Unpublish afterwards (#590).
2. **Find anything in your project.** One search box under New: words as you type, with no AI; meaning when you press Enter, through the AI's small model (#591).
3. **AI on your own computer.** Settings' "AI on this computer" sets up Ollama and a model that fits, and the picker gains "On this computer" (#534).
4. **2.1's loose ends.** What 2.1's gates and its first days found, and the milestone's older polish.
5. **The new Settings.** Today's settings in seven plain sections, none added (#592).

## How 2.2 is built

- **One shell release, 2.2.0, on Mac and Windows.** The Store gets its update with it.
- **Sprints are repo-scoped to `ritemark-native`.** Each starts on its own `sprint-NN-short-name` branch after Jarmo approves its plan.
- **Every PR gets `REVIEW.md`'s review** before it merges: the tier its paths set, every finding answered, a **Review record** on the PR naming the reviewed commit, and the merge at that commit (#599, #600).
- **Main stays releasable** between sprint merges, and is **frozen** from the first release candidate until publication.
- **No time estimates.** Cut from the bottom if the appetite runs out (below).

## Sprints

| Sprint | Shape item | Scope | Issues | Depends on | Status |
|---|---|---|---|---|---|
| [145 — 2.1's loose ends](sprint-145-loose-ends/sprint-plan.md) | 4 | Behaviour, files and platform faults from 2.1's gates and first days, each reproduced first: a stale write over an auto-save; the AI column's late return after a project switch; Windows' first start and ⌘⇧P on Home; the Electron with Node 24.22.1; the release logs' two errors; Settings' version suffix; Flow steps' missing-key errors; a failed turn's green check; selecting a Flow step saves the flow; the Task board's unreadable cards and its slow drop | #588, #569, #501, #507, #515, #582, #595, #580, #578, #571, #596, #597 | — | **Approved** 2026-10-31 |
| [146 — Every control's states, and the frame's polish](sprint-146-controls/sprint-plan.md) | 4 | The review process's Step 8: #585 (no focus ring after a mouse pick) first, then the catalogue page of every `components/ui/` control in every state, one input-mode tracker deciding the ring, and `scripts/qa/control-states.mjs`; then the polish that belongs to the controls and the frame: one tooltip look, narrow buttons as icons, File changes with no Git, a tab's menu, the left column's hover row, and a task card in a dialog over the board | #585, #576, #566, #567, #568, #594, #598 | The Experience lead approves the catalogue's images and #598's dialog | **Approved** 2026-11-01 |
| 147 — The new Settings | 5 | Experience 15's seven sections, today's settings only, in plain words; skills, connectors and plugins per agent; a redraw when a sign-in changes elsewhere; the shared Button; 13 s on Windows | #592, #415, #460, #577, #593 | 146's controls | To plan |
| 148 — Search: the words layer | 2 | Ritemark's own search under New over documents (Markdown, Word, PDF, CSV), chats and tasks, grouped by kind, as you type, with no AI | #591 (part) | — | To plan |
| 149 — Publish a web page | 1 | An .html file on the desk as the page in Ritemark's own browser; Connect Cloudflare (OAuth with PKCE, a token link as the fallback); Publish, Copy link, Update the page, Unpublish; noindex | #590 | The Cloudflare test account (Jarmo, 1 November) and its 14 live measurements | To plan |
| 150 — Search: the meaning layer | 2 | Enter asks the AI's small model for the best places and an answer, with the word results kept when there's no AI | #591 (part) | 148 | To plan |
| 151 — AI on your own computer | 3 | Settings' AI on this computer: check, install Ollama, download a model that fits; the picker's "On this computer"; nothing sent elsewhere when Ollama isn't running | #534 | 147 (the section lives in Settings); the spikes: silent install on Mac and Windows, `/api/pull` progress, offline through ACP | To plan |
| The release — 2.2 as one release | — | The done list, the runtime review, version 2.2.0, notes, the Store update, the release itself | the Store | 145–151 merged, or cut | — |

### Order

- **145 first:** it holds the faults people meet now, and it needs no drawing.
- **146 before 147:** the new Settings is built from the shared controls, so their states and the focus rule come first.
- **148 before 150:** the meaning layer streams in under the word results.
- **149 waits on the Cloudflare test account** (Jarmo, 1 November). Its live measurements decide the upload and the connection before its plan is approved.
- **151 after 147:** its section lives in the new Settings.

### Not yet in a sprint

- **#496** (Claude's refusal card for the free plan) waits for a Claude Free test account.
- **#473** (the PostHog insights for both bets) is analysis, not code, once 2.1's events flow.
- **#497** (the Word and PDF spike for Claude, OpenCode and Windows): the starting points stay gated until every AI passes.

## The appetite

**Decided 31 October 2026** (Jarmo: "agreed with all"). The shape left it open "once the spikes are in"; this is the suggestion he agreed to:

- **The core:** items 1 (publish), 2's words layer, 4 (loose ends) and 5 (Settings).
- **Cut first, in this order:** 151 (AI on your own computer) moves to 2.3; then 150 (the meaning layer); then #598 (the card dialog) inside 146.
- **Can't be cut:** item 1 is 2.2's story.

## Sprint / Issue / PR Tracker

| Sprint | Planned branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| Review process, Steps 1–3 | `harness/review-process-steps-1-3` | [#599](https://github.com/ProductoryHQ/ritemark-native/pull/599) | — | Merged 31 Oct (6fa90921) | Two review rounds; the joins pass live on 2.1.0 | n/a |
| Review process, Steps 4, 5, 7 | `harness/review-process-steps-4-5-7` | [#600](https://github.com/ProductoryHQ/ritemark-native/pull/600) | — | Merge agreed 31 Oct | Two review rounds | n/a |
| Review process, Step 6 | `harness/review-process-step-6` | [#602](https://github.com/ProductoryHQ/ritemark-native/pull/602) | — | Merges after #600, rebased and reviewed again | Two review rounds | n/a |
| Plan: this release plan and 145 | `plan/v2.2.0-release-plan` | [#601](https://github.com/ProductoryHQ/ritemark-native/pull/601) | — | In review (Light) | n/a | n/a |
| 145 | `sprint-145-loose-ends` | — | #588, #569, #501, #507, #515, #582, #595, #580, #578, #571, #596, #597 | — | — | — |
| 145, PR 1 | `sprint-145-loose-ends` | [#605](https://github.com/ProductoryHQ/ritemark-native/pull/605) | #588, and Phase 1's Mac audits | Merged 1 Nov (5d0f8517). Shell-tier, High: 3 rounds; the manager checked the commits after round 3; `/security-review` clean; Codex's two P1s fixed (the `editor-sync-merge` kill switch, quote-aware CSV) | Mac: 18 of 18 in the app; editor-sync tests; the shell's answer path in tests only; Windows at Gate 2 | Drafted (rewritten for the merge) |
| 145, PR 2 | `sprint-145-loose-ends-ext` | [#612](https://github.com/ProductoryHQ/ritemark-native/pull/612) | #578, #595 (#569 measured: the cause is in the shell, for PR 5; #501 and DEP0169: no extension change) | Merged 1 Nov (c7ab4013) | Mac; Windows through the overlay (sent 1 Nov) | In the PR body |
| 145, PR 3 | `sprint-145-loose-ends-flows` | [#607](https://github.com/ProductoryHQ/ritemark-native/pull/607) | #571, #580 | Merged 1 Nov (d41b1c66) | Mac, with a dev-instance run; Windows through the overlay (sent 1 Nov) | In the PR body |
| 145, PR 4 | `sprint-145-loose-ends-board` | [#610](https://github.com/ProductoryHQ/ritemark-native/pull/610) | #596, #597 | Merged 1 Nov (e8f256a9) | Mac; Windows through the overlay (sent 1 Nov) | In the PR body |
| 145, PR 5 | `sprint-145-loose-ends-shell` | [#622](https://github.com/ProductoryHQ/ritemark-native/pull/622) | #569, #501, #582 | Draft. Shell-tier, High: in review | Mac: `project-check.mjs --measure 10` before and after, the S47 traces with the extension host held, fresh launches' `main.log`, the frame check; Windows at Gate 2 | In the draft |
| 145, PR 6 | `sprint-145-loose-ends-electron` | [#620](https://github.com/ProductoryHQ/ritemark-native/pull/620) | #515 | Merged 1 Nov (d97799e3). Shell-tier, High: 3 rounds; `/security-review` clean; Codex no findings | Mac: a dev-instance launch, About, the browser; the signed candidate's launch, built-in extensions in exthost.log, and Windows at Gate 1/Gate 2 | In the draft |
| Fixes: Windows quit and the switch notes | `fix/619-623-quit-and-switch` | [#629](https://github.com/ProductoryHQ/ritemark-native/pull/629) | #619, #623 (the chat stop on a late answer stays open for a shell follow-up) | Draft. Standard: one round | Unit tests (Windows simulated: the `taskkill` calls); Windows not run | A line in the PR body |
| 146 | `sprint-146-controls` (plan on `plan/v2.2.0-sprint-146`) | Plan: [#603](https://github.com/ProductoryHQ/ritemark-native/pull/603) | #585, #576, #566, #567, #568, #594, #598 | Plan approved 1 Nov; PR 1 (#585 carried over) and PR 2 under way | — | — |

## Risks and Blockers

- **Cloudflare:** the publish plan rests on the docs until the test account's 14 live measurements. Its terms ("free, for paid work too") and the direct upload are checked then. Cloudflare isn't hard-wired into the words: it's the first host.
- **A published page is public:** warn before publishing client material, and look for things that look like keys.
- **Page scripts:** a page shown in Ritemark must not reach Ritemark's extension or the VS Code API (Ritemark's own browser, its own process and session).
- **Local models' edits:** an 8B model wiped a file in one of three edit runs (26 October); Windows is unproven.
- **The frame baseline:** the 2.0 baseline was taken with signed-in AIs, so isolated test launches differ by about 8% from the AI sheet alone. 2.1's closeout takes the new baseline under the isolated launch rule, before 2.2's Gate 1 needs it.

## Gates

- **Gate 1** on the arm64 candidate, as 2.1: the base window against the baseline, with every scene's `JOINS` line ok; the done list's Mac rows.
- **Gate 2** on x64 and Windows.
- **Notarization** after the 60-minute hardening window; **publish** on Jarmo's word.

## Decisions

| Date | Decision | Who |
|---|---|---|
| 2026-10-29 | 2.2's scope: the five items; Settings moves today's settings and adds none | Jarmo |
| 2026-10-30 | 2.1's milestone closes; #496, #473, #497 move to 2.2's loose ends | Jarmo |
| 2026-10-31 | The review process starts now; the sprint order: loose ends and Settings, search's words, publishing, search's meaning, local AI | Jarmo |
| 2026-10-31 | The milestone's other issues go into item 4; #598 is the first to move to 2.3 if the appetite is tight | The Development manager ("otsusta ise") |
| 2026-10-31 | The appetite: the core is items 1, 2's words layer, 4 and 5; cut 151, then 150, then #598. Sprint 145's plan approved, with its decisions as recommended (#588 asks; #501 keeps terminals behind; #515 ships on 43.8.3 with the risk recorded if no fixed Electron; #507 closes with the evidence) | Jarmo ("agreed with all") |
