# Release Plan — v2.1.0

**Status:** **Sprints approved; building.** Proposed on 2026-10-26 from the shape Jarmo approved on 21 October with all eight recommendations ("kinnitan soovitustega"). On 26 October Jarmo went on vacation and delegated plan approval, sprint start and admin merges for 2.1 to the Development manager until 2.1's Gate 1 RC: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" (ritemark-dev `decisions/log.md`). Sprints 137–140 were approved under it that day. Release approval stays Jarmo's.<br>
**Target:** v2.1.0<br>
**GitHub milestone:** v2.1.0 (34 open issues on 26 October)<br>
**Release type:** **Shell-tier.** A full app release for the Mac and Windows (the shape's decision 1):
- #454 changes patch 014;
- the equation fonts ship only with the app;
- the Store gets a normal update.

It is built, gated and notarized as a full release: a clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, and Windows CI. 2.1 does not try the extension-only update lane, which has published nothing since 1.8.3-ext.1 was withdrawn in July (the shape, §4).<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64, and the Microsoft Store<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-26<br>
**Source:**
- the shape, approved by Jarmo on 21 October: `ritemark-dev`: [`releases/v2.1.0/shape.md`](../../../../../releases/v2.1.0/shape.md). The link resolves in the usual checkout, where `ritemark-native` sits inside `ritemark-dev`;
- its Estonian summary, `summary-for-jarmo.md`, and the team's answers, `team-notes.md`, beside it;
- the decision's row in `ritemark-dev`: `decisions/log.md`, 2026-10-21.

## Release Thesis

Most people who install Ritemark leave on the first day: of 54 new people whose first week we can see, 8 came back on another day (`ritemark-dev`: `product/users/first-week.md`). 2.1 is about that first week.

- **Inside the team:** "Your first day ends with a page you'd send."
- **In public:** "What your AI writes, ready to send" (the Social manager).
- **Search and the release post** lead with equations (the Inbound Traffic manager).

The five items, in the shape's order:

1. **Your files come back as you left them.** Saving changes only what you changed, and one question answers a conflict (#270, #454).
2. **The first day ends with something made.** One card on Home with a ready request by kind of project, the AI's starting points, and empty places that say what they are for (#497, #498).
3. **What the AI writes looks right, in Ritemark and when you share it.** Equations in the editor, PDF and Word, and Google Docs' quote blocks (#481, #408).
4. **The AI you chose keeps working, on day one and when you come back.** These cover it:
   - which plans work, said before sign-in;
   - a plain card when Claude refuses for the plan;
   - a ChatGPT error as one sentence;
   - a chat that keeps its model after a restart;
   - counting whether a first reply arrived.

   Issues: #496, #417, #376, #479, #473; the model items #529–#532.
5. **A door to tell us, and an answer back.** Send feedback in the status bar and in Help, one sheet, a card on Home (#466).

## How 2.1 is built

- **One shell release, 2.1.0, on Mac and Windows** (decision 1). The Store gets its update with it.
- **Sprints are repo-scoped to `ritemark-native`.** Each starts on its own `sprint-NN-short-name` branch after its plan is approved and the start is given; until Gate 1 RC both come from the Development manager under Jarmo's delegation.
- **Cross-repo by one PR:** `ritemark-web` adds the privacy lines for #479's and #473's new counts, as a PR merged with 2.1's publication (the shape, §2 and §6). The shape lives in `ritemark-dev` for that reason; this plan is the native repo's half.
- **Main stays releasable.** A 2.0.x fix release can still be cut from main between sprint merges if one is needed. That is Jarmo's call, as for 2.0.1.
- **Main is frozen from 2.1's first release-candidate build until publication.** The version bump is the last merge before the candidate (memory: freeze main during a release).
- **No time estimates.** Cut from the bottom if the appetite runs out (the shape, §2): #408 first, then item 2's empty places, keeping its ready request. **#481 cannot be cut**: it was promised in public for "the first update after 2.0".

## Sprints

| Sprint | Shape item | Scope | Issues | Depends on | Status |
|---|---|---|---|---|---|
| [137 — Files come back as written](sprint-137-files-as-written/sprint-plan.md) | 1 | Lists, line breaks and trailing spaces as written, with thematic breaks, bare addresses, escapes, tables and front matter, proven by a corpus of real-looking files. No new serializer and no TipTap 3. Three save-time losses fixed: links into folders, marks around code, images in a row. One question for a conflict, via patch 014 | #270, #454 (#502, #512 if Jarmo takes them in) | — | **Approved** 2026-10-26; merges first. #502, #512 and #539 are in |
| [138 — Equations and Google Docs quotes](sprint-138-equations/sprint-plan.md) | 3 | `$…$` and `$$…$$` typeset in the editor, PDF and Word, plain Markdown in the file, a dollar amount in prose left as text (CommonMark's math rules); Word as native equations if a free converter does it simply, an image otherwise (decision 4), never raw LaTeX; KaTeX's fonts in the app; Google Docs quote blocks at their indent with a thin border | #481, #408 | 137's pipeline module, or 138's math extension moves with it (*Order* below) | **Approved** 2026-10-26; the editor's math waits for 137's merge, while audits, Word, export, fonts and #408 start now. Drawing: experience 38 |
| [139 — The chosen AI keeps working](sprint-139-chosen-ai/sprint-plan.md) | 4 | Which plans work, on each step-1 card and in Settings; the refusal card for Claude Free, its words after the reproduction; one-sentence errors for ChatGPT and OpenCode; a chat's model kept across restarts; the first reply's outcome and the bets' counts; the model items | #496, #417, #376, #479, #473 | — | **Approved** 2026-10-26. The refusal card's words wait on a Claude Free reproduction; the model items moved to 141 |
| [140 — The first day and the feedback door](sprint-140-first-day/sprint-plan.md) | 2, 5 | The Word spike first; experience 35's ready request on Home by kind of project and the AI's starting points; empty places (Tasks, chats, Transcribe); Home's guidance order; the feedback door: Send feedback in the status bar and Help, one sheet, the Home card from day three | #497 (first), #498, #466 | Experience 35, drawn by the Experience lead | **Approved** 2026-10-26, with the Experience lead's answers D1–D11. It builds the shared "open a visible chat" path |
| 141 — 2.1's model lineup | 4 | Gemini 4 Argon in `modelConfig.ts` and the bundled catalog; the feed refreshed without breaking 1.12–1.14; Flows' default Gemini model; OpenCode's lists from the providers' live lists (#529, the first to cut) | #532, #530, #531, #529 | — | Plan to write (split from 139 on 26 October) |
| The release — 2.1 as one release | — | The done list below, the runtime review, version 2.1.0, notes, the Store update, the release itself | #499, #506, the Store | 137–140 merged | Not planned yet. It gets a sprint number (142) only if it needs code, as Sprint 136 did for 2.0; otherwise it is the release worktree's steps, as in 2.0.1 |

### Order

- **137 before 138.**
  - Both change the editor's Markdown pipeline: `marked`'s extensions and Turndown's rules.
  - 137 moves that pipeline out of `Editor.tsx` into one module, with a corpus test.
  - 138 adds its math extension to that module, and its fixtures to the corpus. There, `$5 and $10` in prose is checked byte for byte.
  - If 138 starts first, its extension moves with 137's Workstream 1.
- **The Word spike (#497) before #498's first look is promised for all three AIs** (the shape, §4).
- **The Claude Free reproduction before the refusal card's words** (139, the shape, §4).
- **139 and 140 both touch the welcome's step 1 and Home.** The plan-lines work (139) and Home's guidance order (140) are reviewed together by the Experience lead.

## The done list

The shape's done list, checked on the release candidate. A failure is a first-week bug and is fixed in 2.1.

- [ ] **Synced folders (#499).**
  - The welcome opens a OneDrive, SharePoint or Google Drive synced folder as a project, on the Mac and on Windows, including online-only files.
  - Saving and the agent work there without conflicts. Sprint 137's R11 is the save half: a sync client touching a file asks nothing.
- [ ] **The Windows first window (#276, closed in 2.0).**
  - On a fresh profile and on an update from 2.0.1, the first window opens on the welcome and then Home with the AI in view, not on a terminal or an empty desk.
  - #501, a restored terminal before the welcome on a slow first start after an update, is checked in the same run.
- [ ] **Windows CI without making the repository private (#506).** Every visibility toggle erases its GitHub stars and watchers; Jarmo: "agreedd about stars". The Windows build runs without the toggle before 2.1's candidate.
- [ ] **The Microsoft Store.**
  - The 2.1.0 update, with the installer hosted at `windows/v2.1.0/Ritemark-Setup.exe`.
  - Pricing is **Free**, set in Partner Center on 23 October with 2.0.1 (decision 8); it is checked, not changed.
  - The certification notes describe the new feedback path exactly (policy 11.16), keeping the third-party AI disclosure.
  - Submit needs Jarmo's word.
- [ ] **The privacy lines** in `ritemark-web` for #479's and #473's counts, merged with publication.

## Also in the milestone, not yet in a sprint

These were added after the shape, mostly from 2.0's release candidate and its first days. Each needs a home or a move to v2.2.0. The suggestion is the Development manager's to take to Jarmo; it is not decided here.

| Issue | What | Suggested home |
|---|---|---|
| #502 | Editing a link's address does nothing | 137 (its question 7: the same link code) |
| #512 | A false "Retry document update" after an AI edit | 137 (its question 7: the same document sync), reproducer first |
| #507 | ⌘⇧P sometimes does nothing on Home | 140 (Home) |
| #535 | Home scrolls sideways when the AI's sheet is forced open in a very narrow window | 140 (Home) |
| #516 | The Task board's four columns don't fit at 1440 with both side columns | 140, or after 2.1 with the Task board's redraw |
| #511 | A task's message in its conversation loses the card's line breaks | 139 (agent-facing) |
| #513 | Choosing @claude from a comment's mention list doesn't assign the comment | 139 |
| #514 | An English chat's automatic title came out in Estonian | 139 |
| #503, #504, #505, #508 | Shadows under rounded corners; Transcribe's white scrollbar track; a task card's Stop tooltip; a restored card tab's name | One small polish pass, with the Experience lead |
| #509, #510, #517 | Transcribe on Windows (an .m4a, no Desktop folder) and Transcribe a file… as a tab | A Transcribe and Windows pass, or v2.2.0 |
| #515 | Ship on an Electron carrying Node 24.22.1 (21 October security releases) | The release (shell): checked against the pinned VS Code's Electron at the runtime review |

## Sprint / Issue / PR Tracker

| Sprint | Planned branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| Plan: 137 and this release plan | `plan/sprint-137-files-as-written` | — | — | Local, not pushed | n/a | n/a |
| 137 | `sprint-137-files-as-written` | [#553](https://github.com/ProductoryHQ/ritemark-native/pull/553) | #270, #454, #502, #512, #539 | Open, not merged | Passed (technical), 26 Oct | Drafted in `sprint-137-files-as-written/notes/release-notes-draft.md`, applied at closeout |
| 138 | `sprint-138-equations` | [#545](https://github.com/ProductoryHQ/ritemark-native/pull/545) | #481, #408 | Open, not merged | Passed (technical), 26 Oct | Drafted in `sprint-138-equations/notes/release-notes-and-reply.md`, applied at closeout |
| 139 | `sprint-139-chosen-ai` | #550 | #496, #417, #376, #479, #473, #552 | — | passed (technical), 26 Oct | drafted, applied at closeout |
| 140 | `sprint-140-first-day` | [#543](https://github.com/ProductoryHQ/ritemark-native/pull/543) | #497, #498, #466 | Open, not merged | Passed (technical), 26 Oct | Drafted in `sprint-140-first-day/notes/release-notes.md`, applied at closeout |
| Release | a `create-release-worktree.sh` worktree, then the version bump | — | #499, #506, the Store | — | — | — |

## Feature-Complete Checklist

- [ ] Sprints 137–140 merged, each with its issues closed or explicitly moved with evidence.
- [ ] **Item 1:** Sprint 137's corpus test green on the release source, and S1 and S40 run on the signed candidate (Gate 2).
- [ ] **Item 3:** the day-one film's document (an analyst's report with equations) right in Ritemark, PDF and Word, KaTeX's fonts included, before the Social manager captures it (the shape, §3).
- [ ] **Items 2 and 5:** match experiences 24, 29, 34 and 35, approved by the Experience lead with screenshots (memory: match the Experience prototype).
- [ ] **Every new count** is inside 2.0's usage-data contract:
  - nothing before the welcome is left;
  - nothing with usage data off;
  - no location;
  - dev runs marked.

  Each is listed for `ritemark-web`'s privacy lines (the shape, §6).
- [ ] ritemark-web privacy lines (Traffic's draft ritemark-web#512) merged before 2.1 publishes.
- [ ] The done list above, ticked on the candidate.
- [ ] Runtime review done for the gap since 2.0.1, and `check:anthropic-models` OK.
- [ ] Version 2.1.0 in all six version files; release notes and `CHANGELOG.md` cover everything merged since v2.0.1.
- [ ] Windows and macOS x64 CI green on `main` before the candidate is cut, Windows without the visibility toggle (#506).
- [ ] The GitHub Actions budget checked before the release builds, so a Windows build can't stop halfway ($40 a month; Jarmo's call).
- [ ] No open blocker in the risk register below.

## Risks and Blockers

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| **#270 grows into a new serializer** | High | Decision 3's bound, held by Sprint 137's corpus: a form joins only by the scope-change protocol; the rest is reformatted, never lost, and filed as one issue. Its pre-audit measured the narrow fix | Open: Sprint 137's plan |
| **Sprint 137 and 138 change the same pipeline** | Medium | 137 first; 138 builds on its module and corpus (*Order*) | Open |
| **Equations' three holes:** native Word equations (decision 4); KaTeX's fonts, which only the app can ship, or which would grow a bundle already at 8.6 MB (#107); dollar signs in prose | High | Sprint 138's plan; the shell release ships the fonts; CommonMark's math rules and corpus fixtures for prose dollars | Open |
| **Word text for agents** (#497): ChatGPT and OpenCode may stall on a folder of Word files, the first look's very case | High | The spike before the first look is promised for all three AIs | Open |
| **Claude Free is unproven:** we have not reproduced what a free Claude account sees when it fails | Medium | Reproduce before the refusal card's words (139) | Open |
| **Ready requests can spend the person's AI plan and reach too far** | Medium | The first look reads the names and the five newest documents, and says so (140) | Open |
| **Synced folders:** online-only files and a sync client writing alongside Ritemark make the check bigger than it looks if it fails | Medium | Checked early on both platforms (#499); Sprint 137's R11 for saves | Open |
| **Patch 014 grows** (#454); the feedback door may need patch 015 for Help ▸ Send feedback | Low | One hunk each, the drift check at each merge | Open |
| **The GitHub Actions budget:** $26.04 of $40 used by 21 October, about seven Windows 8-core builds' room | Medium | Checked before the release builds (Jarmo) | Open |
| **Windows CI and the stars** (#506) | Medium | CI without the visibility toggle before the candidate | Open |
| **The Store:** certification notes must describe the feedback path exactly (11.16); a newly signed installer may meet SmartScreen warnings | Medium | The notes written from Sprint 140's final behaviour; SmartScreen expected, not a blocker (memory: Windows signing and Smart App Control) | Open |
| **Node security releases** (#515) | Medium | The runtime review checks the pinned VS Code's Electron and Node | Open |
| **Small numbers:** 54 new people in three weeks; a week's change is mostly noise | Low | Read over 2.1's first full weeks, not one | Standing |

## Gates

- **Shell-tier:**
  - a clean-room release worktree from exact `origin/main` (`create-release-worktree.sh`);
  - Gate 1, technical, on the arm64 candidate;
  - Gate 2, Jarmo tested, on the Mac, Rosetta and Windows;
  - notarization only after the 60-minute hardening window;
  - Windows CI (`release-manager`, the `release` skill).
- **Main is frozen** from the first release-candidate build until publication.
- **The feed** is generated with `--existing-feed-url` naming v2.0.1's feed and all three assets.

### Gate 2 checklist (first draft, completed by each sprint)

- **An update from 2.0.1** with a lived-in profile:
  - the person's settings and projects are kept;
  - no chat is lost;
  - a chat keeps its model after the update's restart (#417).
- **A fresh profile** on the Mac and on Windows: the welcome, a provider's sign-in with the plan lines under each card, a project, Home's ready request.
- **Files as written** (137):
  - #270's fixture, edited at one word, changes one line;
  - a corpus file with tables and front matter comes back byte for byte;
  - the agent writes a file while Jarmo types, and only Review changes asks, on the Mac and on Windows.
- **Equations** (138): the analyst's report in the editor, exported to PDF and Word; a dollar amount in prose stays text; a quote block published to Google Docs.
- **The chosen AI** (139): a first message with Claude, ChatGPT and OpenCode; a ChatGPT error as one sentence; the refusal card (if reproducible).
- **The first day** (140):
  - the ready request on a folder of Word files, on an empty project and on the sample;
  - the starting points;
  - the feedback door from the status bar and Help.
- **The done list's checks:** a synced folder on both platforms; the Windows first window.
- **Every release:** an authenticated Claude turn, a Codex turn and the OpenCode permission gate on x64 and Windows.

## Runtime versions

To be reviewed at the release (memory: release = runtime review + notes).

- **2.0.1 bundles:** Claude Code 2.1.304 (SDK 0.3.304), Codex 0.163.0 and OpenCode 1.19.3.
- **npm `latest` on 23 October:** 2.1.309, 0.164.0 and 1.19.4.
- **`check:anthropic-models`** runs at the release source.

## Decisions

**Jarmo, 21 October** (the shape, all eight as recommended, "kinnitan soovitustega"):

1. One shell release, 2.1.0. Raise the Actions budget before the release builds.
2. All five items agreed now, not after 2.0's numbers.
3. **#270's bar:** untouched lists and soft breaks written back as they were in the common forms, checked against a corpus of real files. No new serializer, no TipTap 3.
4. **Equations in Word:** native Word equations if a free converter does it simply, an image otherwise. Never raw LaTeX.
5. **No B2 item:** #411 waits for the bets' step 4 on 26 October.
6. **Claude Free:** the plan lines, and a refusal card offering ChatGPT once the reproduction shows what a free account sees.
7. **Answers and AI reports:** to info@productory.eu for 2.1.
8. **The Store:** Free, keeping the third-party AI disclosure. Done in Partner Center on 23 October.

**After the shape:**
- #506 was added to the milestone (Windows CI without the toggle; Jarmo: "agreedd about stars").
- So was #507. #411 is held for step 4.

**Open, for the sprint plans:** each sprint plan carries its own questions for Jarmo. Sprint 137's are in its [Decisions for Jarmo](sprint-137-files-as-written/sprint-plan.md#decisions-for-jarmo).
