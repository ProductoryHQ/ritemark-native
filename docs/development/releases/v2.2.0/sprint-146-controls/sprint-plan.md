# Sprint 146: Every control's states, and the frame's polish

Track: SDD (auto-detected: seven linked issues and the four parts of the review process's Step 8, across the webview's shared controls, three VS Code patches and the Task board; the focus rule is edge-case-heavy (mouse, keyboard, pen, script focus, a hidden window), and the card dialog crosses the board's webview, its host and the card files; scope may grow when an audit shows another place with the same fault)
Override with: "use plain full track"
Branch: `sprint-146-controls`, made from `origin/main` at Phase 3, after approval. Each later PR has its own branch that starts with the same name (*Pull requests* below). This plan was written on `plan/v2.2.0-sprint-146`.
Release tier: shell. 2.2 is a shell release ([release-plan.md](../release-plan.md)). This sprint names its shell-tier paths: `patches/vscode/016-ritemark-store-acquisition-policy.patch` (#567's words), `patches/vscode/018-ritemark-surfaces.patch` (#567's outline, #594 if the workbench's lists have it) and `patches/vscode/019-ritemark-tab-row.patch` (#568). Everything else is extension-tier (the table below). If an audit moves a fix into or out of a patch, this line and the table change first.
Status: **Approved, 1 November 2026** (Jarmo: "Sprint 146 kinnitatud", in the Development manager session), with decisions 1–5 as recommended (*Approval*). The code named under *What reading the code added* was read for the plan, not run.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R10 and E1–E5, and the open questions.
- [scenarios.md](scenarios.md): S1–S65, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the nine audits that come first, workstreams W1–W10, the pull requests, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.
- `research/` is not created yet. Phase 1 writes one file per audit there, before the code it gates.

## Goal

A mouse pick leaves no ring, and the reason it shipped can't come back unseen: every shared control is drawn in every state once, the Experience lead approves each image, one rule decides when a ring shows, and a script tests every state against the approved images on every PR that touches a control and at Gate 1. Then the polish that belongs to the controls and the frame: one tooltip look, narrow buttons as icons, File changes in Ritemark's words with no Git, a tab's menu with Ritemark's items, a hovered row that stops at the scroll thumb, and a task card that opens over the board.

## Linked Issues

| Issue | What | Req | Seen so far | Release tier |
|---|---|---|---|---|
| [#585](https://github.com/ProductoryHQ/ritemark-native/pull/585) (draft PR) | No focus ring after a mouse pick from a menu | R1 | Proven on RC3's source with real CDP input; the fix's live audit was never run | extension |
| Step 8 (review process) | The catalogue, the input-mode tracker, `control-states.mjs` | R2–R4 | Planned (ritemark-dev `releases/v2.2.0/analysis/2026-10-27-review-process-plan.md`); incident row 10 names it | extension (and harness files) |
| [#576](https://github.com/ProductoryHQ/ritemark-native/issues/576) | Tooltips come in two looks | R5 | Seen in Sprint 144's screenshots, Light and Dark; raised by the Experience lead | extension, or the themes and 018 by the lead's choice |
| [#566](https://github.com/ProductoryHQ/ritemark-native/issues/566) | A button too narrow for its first word shows "A…" | R6 | Seen by the Experience lead at a 152 px desk (Sprint 142) | extension |
| [#567](https://github.com/ProductoryHQ/ritemark-native/issues/567) | File changes with no Git speaks VS Code; a mouse open draws an outline | R7 | Seen by the Experience lead (Sprint 142); the words are in the issue's comment | shell (016, 018) |
| [#568](https://github.com/ProductoryHQ/ritemark-native/issues/568) | A tab's menu lists VS Code's items | R8 | Seen by the Experience lead (Sprint 142's screenshot) | shell (019) |
| [#594](https://github.com/ProductoryHQ/ritemark-native/issues/594) | The left column's hovered row runs 2 px under the thumb | R9 | Seen at 2.1.0's Gate 1 (RC3); its second half fixed by 2.1.0's join pass | shell (018) for a workbench list; extension for a webview's |
| [#598](https://github.com/ProductoryHQ/ritemark-native/issues/598) | A task card in a dialog over the board, with Open in separate tab | R10 | A request from Jarmo's use of 2.1; no drawing yet | extension |

**Which items need a shell release by their paths:** #567 (016, 018), #568 (019), and #594 if its list is the workbench's (018); R5's hover only if the lead's look changes its shape (018). The themes' colours (`themes/*.json`) are extension-tier by path but ship only with a shell release, which 2.2 is. The rest is extension-tier: alone it would ship as an extension release. All of it ships in 2.2's shell release, so none of it adds a release step.

## What reading the code added

Read for this plan; nothing was run. VS Code's files were read in the main checkout's `vscode/`, since this worktree has none.

- **#585 carries over cleanly.** Its base, `d10cade2`, is seven commits behind `main`, and none of them touches `components/ui/`, `ExportMenu.tsx`, `index.css` or `media/` (only `package.json`'s `files.exclude`, a different hunk from #585's test line). So its commit applies as it is; the bundles are rebuilt only because Sprint 145 may change the webview first. Its branch, `sprint-144-rc4-menu-focus`, doesn't follow the sprint branch rule, so the commit moves to `sprint-146-controls` (W1).
- **The tracker makes #585's close rule a choice.** #585 stops the focus going back to the trigger after a mouse pick, because Chromium draws the ring on that script focus. Once one tracker decides the ring, the focus can go back to the trigger, as the WAI-ARIA menu button pattern and React Aria do, with no ring. That is decision 1.
- **Rings come in four forms.** About 60 Tailwind `focus-visible:` utilities, about 50 `focus:` ones (fields, menu items' highlight, and some non-fields such as Select's trigger, `select.tsx:29`), 24 hand-written rules in four stylesheets, and the tooltip's own rule (`tooltip.tsx:26–38`). Tailwind is 3.3 (`webview/package.json:94`): whether one plugin line can move every `focus-visible:` behind the mode is the first thing A2 proves; there is a fallback.
- **Fields are not rings.** Input and Textarea draw `focus:ring-1` (`input.tsx:24`, `textarea.tsx:23`), which shows where the typing goes after a click too. The spec keeps that, and moves only the non-field rings.
- **There is no shared popover.** Two screens use Radix's popover directly (`ThinkingEffortControl`, `InsightsLanguageCombobox`); the tracker covers their rings, so none is added.
- **#566 has three rules today.** The shared split button cuts its label (`split-button.tsx:85`); Home hides Change image's label under a container of 200 (`home.css:309–317`); the viewers' toolbar goes icon-only under 560 for its own split button (`ViewerToolbar.tsx:25–39`, `:218–277`). One rule goes into the shared control; the viewers' whole-toolbar rule stays.
- **#576 has a third look.** Native `title` tooltips: about 110 `title=` uses in 30-odd webview files (props and attributes together; A4 separates them). Neither Ritemark theme sets `editorHoverWidget.*`, so the workbench's hover takes VS Code's derived colours.
- **#567's words are VS Code's Git and GitHub extensions'** (`extensions/git/package.nls.json:353–491`, `extensions/github/package.nls.json:14–29`), and patch 016 already owns the three `scm.missing.*` lines the lead's "File changes needs Git" replaces. A second patch on those lines would stack (pre-commit Check 14), so the words go in 016, which the release plan didn't name. The lead's rule (never "VS Code", "repository", "initialize", "source control") reaches Git's other welcome states too: turned off, no folder, a workspace, a parent folder's repository, an unsafe one, a closed one.
- **#567's outline is a class, not one view.** VS Code outlines every `[tabindex]:focus` in the workbench (`style.css:282–295`), and a view's welcome content is `tabIndex: 0`, focused when the view opens (`viewPane.ts:164`, `:666–670`). Any welcome view opened with a click draws it; A6 lists the places.
- **#568's five items come from four places:** chat (`chatContextActions.ts:157`, only while chat is on, so a build without Copilot Chat may not show Add File to Chat), the files contribution (`fileActions.contribution.ts:165`), the editor contribution (`editor.contribution.ts:398`) and the built-in Markdown extension (`package.json:255–261`). The tab row builds the menu in one place, a file patch 019 already holds (`editorTabsControl.ts:428–436`), so one filter there catches all four, as patch 003's filter does for All commands.
- **#594's numbers fit a workbench list.** Patch 018 insets every left-column row by 8 each side (`018-ritemark-surfaces.patch:1370–1395`) and stops the thumb 2 short of the column's edge (`:1404`): a 10-wide scrollbar then overlaps a row by 2. The webview lists on the ground have thin overlay sliders too (`index.css:311–320`). The issue doesn't say which list Gate 1 saw; A8 does, and the tier follows.
- **#598 needs no new host message.** Every opener goes through `useBoardUi.openCard` (`boardUi.ts:48`), and the board's snapshot already carries everything the card page shows, the text included (`protocol.ts:81–114`). The page's parts take a card and the snapshot (`CardPage.tsx:111`, `:292`). The shared dialog is at most 480 wide (`dialog.tsx:69`), so a wider size goes into the dialog itself, not a local class.
- **#598's text can't be shown as the AI's sheet shows Markdown.** `RenderedMarkdown` puts `marked`'s HTML into the page with no sanitizer (`RenderedMarkdown.tsx:104`), and the board's CSP allows `https:` images (`boardSurface.ts:226`). A card file can come from someone else's folder, so the dialog shows no raw HTML (R10, S58), and PR 5 gets a security review.
- **Step 8's review rule is already in.** `REVIEW.md:20–22` holds its two failures, and `incidents.md:31` (row 10) names the catalogue as the check, "planned". What's left of the wiring is the PR template's Risk line, the baseline folder's exclusion, and Gate 1's step (W4).
- **Two frame items for 2.2 have no issue.** The Experience lead's Home notes leave Home's S (one path with its shadow) and You's menu's top line to "patch 018, 2.2". They're not in this sprint unless they're filed (*For the Experience lead*).

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| No ring or tooltip after a mouse pick; the ring after a keyboard close | R1 | `closeFocus.test.ts` failing on `main`'s controls; #585's audit run live |
| A hidden page of every shared control in every state, Light and Dark | R2 | The coverage test; the page on a dev instance and a production build with the launch setting, and absent without it |
| One tracker decides the ring; fields keep their focus look; tooltips open on keyboard focus only | R3 | `inputMode.test.ts`; S13–S20; the catalogue's states |
| `control-states.mjs`: real input, device pixels, approved images, exit code = differing states; in the PR template and Gate 1 | R4 | The revert run fails, the branch run passes; a front and a background run agree |
| One tooltip look | R5 | Render test; the catalogue's tooltip cells; S28–S31 |
| Icon only when the first word doesn't fit | R6 | Render tests; the catalogue's narrow cells; Home at 152 |
| File changes in Ritemark's words with no Git; no outline after a mouse open | R7 | S37–S43 on a patched dev instance; Gate 2 on Windows |
| A document tab's menu without VS Code's items | R8 | `ritemarkTabMenu.test.ts`; S44–S48 |
| The hovered row and the thumb read as two things | R9 | S49–S51; the frame's JOINS lines |
| A card in a dialog over the board; Open in separate tab | R10 | Render and unit tests; S52–S61; the lead's screenshots |
| Each check fails on `main` first; no record changes; tier; bundle; docs | E1–E5 | `qa-evidence.md` |

**Not in this sprint:** a tracker for the workbench (its outlines are fixed where a surface shows the fault); one ring look for every control (the catalogue will show four; the lead may file it); editing a card's text in the dialog, or a dialog from the side bar (decisions 2 and 3); the new Settings (147, built from these controls); Home's S and You's menu's top line, unless filed.

## Pull requests

Five, so that each gets `REVIEW.md`'s review at its own tier, a shell change never waits on or hides inside an extension one, and the item first cut stands alone. Each PR's Risk section names its tier and the paths that set it, and, from PR 2 on, `control-states.mjs`' result when a control's look changed. The reviewer's findings are answered and the merge is at the reviewed head (`REVIEW.md`, *Before the merge*).

| PR | Branch | Holds | Release tier | Review tier |
|---|---|---|---|---|
| 1 | `sprint-146-controls` | R1: #585's commit carried over, its audit run live; this sprint's document updates (the plan lands first, in its own PR) | extension | Standard (`webview/src/`); the Experience lead sees the screenshots |
| 2 | `sprint-146-controls-catalogue` | R2 (the catalogue), R3 (the tracker), R4 (`control-states.mjs`, `control-baseline/`, the template, `REVIEW.md`, the release skill and agent) | extension | Standard (`webview/src/`, `src/views/`, `scripts/qa/`, `.claude/`); the Experience lead approves every image before the merge |
| 3 | `sprint-146-controls-polish` | R5 (#576), R6 (#566); R9 (#594) if its list is a webview's | extension | Standard; screenshots to the lead |
| 4 | `sprint-146-controls-shell` | R7 (#567: 016, 018), R8 (#568: 019), R9 (#594: 018) if its list is the workbench's; R5's hover shape (018) if needed | shell | High: `/code-review` at high and `/security-review`. Built and checked on a CoW-cloned, patched `vscode/`; the frame check; the drift check at merge |
| 5 | `sprint-146-controls-card-dialog` | R10 (#598) | extension | Standard by paths, plus `/security-review` (it shows a card file's text, which may come from someone else's folder) |

**Order:** PR 1 first: it fixes Jarmo's finding and needs no drawing. PR 2 next; inside it, the catalogue and the script come before the tracker, so the first capture of `main`'s controls is the failing set, and it merges once the Experience lead has approved the images. PR 3 after PR 2, since its states are approved again in the catalogue. PR 4 when the lead's words and lists are in; it doesn't wait for PR 2 or 3 unless R5's hover moves. PR 5 last, after Sprint 145's board PR and the lead's drawing.

**Cut order if the appetite runs out** (the first goes first): #598 (the release plan's first cut inside 146), then #566 (only at the narrowest desks), then #594 (2 px), then #568, then #567's other Git states (the two the lead wrote stay), then #576's native titles. Step 8 (R1–R4) and #576's one look are not cut.

## Windows

- **Extension-tier PRs** (1, 2, 3, 5) run on Windows through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`), by the "Ritemark on Windows" session, before the merge: a real mouse and keyboard, and touch or a pen where the PC has one (S21); Alt alone must not switch the mode.
- **The approved images are the Mac's**, at 2×. Windows draws fonts differently, so on Windows the catalogue is checked by eye at 100% and 150% through the overlay. A Windows set of images is later work if the lead wants one.
- **PR 4 can't go through the overlay:** Windows CI builds only the exact `main` commit. Its Windows proof is 2.2's candidate at Gate 2: File changes on a PC without Git, which most Windows PCs are (S43), the tab's menu (S47), and the hovered row at 100%, 125% and 150%.

## Product Decisions

- **2026-10-31 (the release plan):** 146 comes after 145 and before 147; the Experience lead approves the catalogue's images and #598's dialog; #598 is the first item cut if 2.2 runs tight.
- **Engineering, in this plan (approved with it):**
  - #585's commit moves to the sprint's branch, rebased, and #585 closes with a link; it isn't redone, because its cause is proven and its test fails on RC3's controls.
  - The catalogue approves today's looks; a change the lead wants becomes its own issue unless it's this sprint's item.
  - #567's words go in patch 016, which owns the lines they replace.
  - #568's filter names what goes, not what stays, so a new item still shows until it's named.
  - PR 5 gets `/security-review` above its paths' tier.

## Decisions for Jarmo

Five, each with a recommendation. [spec.md](spec.md#decisions) carries the same list.

1. **After you pick from a menu with the mouse, where does the keyboard carry on?** Nothing is drawn round the button either way. **Recommended: from that button**, so the next Tab goes to the next button. With #585 as it is, the next Tab starts from the top of the page, as Share's menu has done since 2.0. PR 1 merges #585 as it is, so your finding is fixed first; PR 2 makes the change, once the tracker hides the ring.
2. **Can a card's text be edited in its dialog?** **Recommended: no, you read it there**, and Open in separate tab edits it, as today. Two places writing one card file is the kind of fault #588 is, and the card's page is where its text is written today.
3. **A click on a card in the Tasks side bar.** **Recommended: it keeps opening the card's tab**, as today. The other way opens the board and the card's dialog, two moves away from the documents you were in.
4. **Two VS Code entries leave Ritemark's surfaces, and stay in All commands:** Publish to GitHub, in File changes when a folder has no Git; and the tab menu's items the Experience lead drops, from Add File to Chat, Reveal in Explorer View, Open Preview, Reopen Editor With… and Find File References. **Recommended: yes**, as a terminal tab's menu did in 2.0. You're asked because a way to do something leaves a surface.
5. **The catalogue ships inside the app, hidden.** It opens only when a test script starts Ritemark with its own setting, so Gate 1 runs the same check on every release candidate. **Recommended: yes.** A small one: the Development manager may answer it.

## For the Experience lead

Drawings, words and choices first, before the build of what they touch:

- **The catalogue's images** (the release plan): approve each state once, in Light and Dark, from `sheet.html`, before PR 2 merges; and the states each control has (the grid's columns per row). It will show four ring sizes (4 px, 3 px, 1 px and a 2 px outline): one ring look is yours to file for later, not this sprint's.
- **#598's dialog** (the release plan): its layout and width (a wider size of the shared dialog), what it holds (the title and Done when, the state's block and its action, the files, the history, the text), where Open in separate tab sits, the read-only text (decision 2), and the board under 640.
- **#576:** the one look for both kinds of tooltip, in Light and Dark, from A4's crops: Ritemark's ink tooltip or the workbench's hover, with or without the arrow; and whether native `title` tooltips that aren't on controls (a cut name's full text, for example) stay.
- **#566:** that the rule fits buttons with an icon (icon only, the whole words first in the tooltip), and that a button with only words keeps its cut.
- **#567:** the heading (VS Code's welcome view has no heading style: the first line in body style, or set apart by one rule); the words for Git's other states A6 lists (turned off, no folder, a workspace, a parent folder's repository, an unsafe one, a closed one, scanning), under your own rule; and Publish to GitHub's line dropped, as your comment says (decision 4).
- **#568:** for each of the five items, keep, rename or drop; and whether the tabs of Home, the Task board, Word, PDF and a web page follow the same list.
- **#594:** the fill stops where the thumb begins, or the thumb is one tone over it, for the lists A8 finds.
- **Two items from your Home notes** (experience `home/README.md`): Home's S as one path with its shadow, and You's menu's top line, both left to patch 018 in 2.2 but on no issue. File them, or leave them out of 2.2.
- **Screenshots before each UI merge:** PR 1 (S1–S4), PR 2 (`sheet.html`), PR 3, PR 4, PR 5.

## Feature Flag Check

No feature flag. The catalogue isn't something people use: it's behind a launch setting only test scripts set (decision 5). The card dialog changes what a click on the board does and keeps today's page one press away (Open in separate tab); it sits under the existing `task-board` flag (`src/features/flags.ts:129`), which stays. Everything else fixes what 2.0 and 2.1 already do, on for everyone. HARD RULE #1 holds: the card's page stays; Initialize Repository's command stays, as Set up Git here; the tab menu's dropped items and Publish to GitHub stay in All commands, and leave the surfaces only with Jarmo's answer to decision 4; Share's menu keeps its behaviour.

## Testing

- **The Mac, here:** unit tests (`npm test`, the webview's `npx tsx` tests, `./scripts/test.sh --grep Ritemark` for 019's filter in a patched `vscode/`), and scripted dev instances: hidden (`open -n -g -j`, the three backgrounding flags), one launch per check, `--use-mock-keychain`, a short profile under `/private/tmp`, a port checked to be free.
- **CDP input only.** Every click and key goes through `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`, never the system's keyboard or mouse, so a hidden window never takes keys meant for another (#585's note), and the debugging protocol's focus emulation draws a background window's focus as a front one's (A3).
- **Isolated homes:** a dev instance that needs no AI gets scratch directories for the AIs' homes (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`), and the real ones are not read. The user's `HOME` isn't changed.
- **An AI only where a row needs one:** #585's audit rows behind the composer and the board's split buttons (S5, S8) use ChatGPT through Jarmo's own sign-in in the scratch project, as Sprint 143 did; Claude and OpenCode only if signed in on the test Mac; otherwise the row says not run. The catalogue and the dialog need none (the dialog uses prepared card files).
- **PR 4** on a CoW-cloned, patched `vscode/` in the worktree, with `frame-screenshots.mjs --compare` (JOINS ok) and `frame-geometry.mjs`.
- **Disk:** 3.4 GiB were free on 31 October. The worktree-hygiene report comes first (a clean is Jarmo's call), profiles under `/private/tmp` go after each run, and the approved images are small crops.
- **Not here:** Windows (the overlay session, Gate 2), a pen or touch screen, a PC without Git (Gate 2; the Mac uses a missing `git.path` in its test profile).

## Success Criteria

- [ ] A mouse pick from any shared menu or Select leaves no ring and opens no tooltip; a keyboard close leaves the trigger focused with its ring (R1).
- [ ] The catalogue shows every control in `components/ui/` in every state it has, in Light and Dark, opens only with its launch setting, and its coverage test fails on a control with no row (R2).
- [ ] One tracker decides the ring in every webview: no ring after a pointer press, a ring after the keyboard, fields' focus look kept, tooltips on keyboard focus only (R3).
- [ ] `control-states.mjs` exits 0 on the branch and non-zero with R1's rule reverted; every image is approved by the Experience lead; Gate 1 and the PR template name it (R4).
- [ ] Ritemark's tooltips and the workbench's hovers have one look, in Light and Dark (R5).
- [ ] At a 152 px desk, no button shows a cut first word: its icon only, the whole words in its tooltip (R6).
- [ ] File changes with no Git, in a folder and on the computer, says only the lead's words; a mouse open draws no outline, the keyboard still does (R7).
- [ ] A document tab's menu holds only what the lead kept, and every dropped command still runs from All commands (R8).
- [ ] No list in the left column draws its hovered row's fill under the thumb in two tones; the thumb still stops 2 short of the desk (R9).
- [ ] A card on the board opens in a dialog over it, closes back to where the board was, and Open in separate tab opens its page; its text shows no raw HTML (R10).
- [ ] Each check failed on `main` first, or the plan says why it couldn't (E1).

## Risks

| Risk | Retirement |
|---|---|
| One rule changes 100-odd rings at once | The catalogue and the script before the tracker; `main`'s capture as the failing set; every page visited (S20) |
| Tailwind 3.3 won't let one line move every ring | A2 decides from the emitted CSS; a fallback rule in pointer mode |
| Pixel images flake, or a hidden window draws focus differently | Motion and the caret off; A3's five runs; focus emulation; a front and a background run compared (S25) |
| The catalogue turns into a redesign | It approves today's looks; changes become issues |
| Decision 1 changes PR 1's rule again in PR 2 | A one-handler change in two files, made safe by the tracker |
| #567's outline and #594's row are wider than the issues say | A6 and A8 list every place; the tier line changes first |
| A card file draws over the board | No raw HTML; S58; `/security-review` on PR 5 |
| #598 meets Sprint 145's board work | PR 5 after 145's board PR; #598 is cut first |
| A drawing or approval arrives late | The cut order; PR 1 needs none |
| Disk is tight | The hygiene report first; a CoW-cloned `vscode/`; profiles removed after each run |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The Experience lead** for the images, the dialog, the words and the choices above.
- **The "Ritemark on Windows" session** for the overlay checks of PR 1, 2, 3 and 5, and Gate 2's rows for PR 4.
- **Sprint 145's board PR** before PR 5 (both change `components/tasks/`).
- **Sprint 147** builds on PR 2: the tracker and the catalogue merge before 147's build starts, and 147's new controls get catalogue rows.

## Pre-Implementation Gate

- This plan is approved by Jarmo (*Approval* below). A message from the Development manager is information for the plan, not approval of it.
- Phase 1's audits come before their workstreams' code: A1 before W1's merge, A2 and A3 before W3 and W4, A4 before W5, A5 before W6, A6 before W7, A7 before W8, A8 before W9, A9 before W10. When an audit changes a requirement, `spec.md` changes first.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [x] Jarmo approved this sprint plan on 1 November 2026: "Sprint 146 kinnitatud" (the Development manager session), taken as approval with decisions 1 and 4 as recommended. He had confirmed decisions 2 and 3 earlier that day in the Experience lead's session ("kinnitan otsused 2 ja 3 nagu soovitatud"). The Development manager answered decision 5 (yes) on #603.
- [x] Sprint start: Jarmo's standing word in the Development manager session (31 October: "I want you to start building 2.2 according to approved sprints"), with this plan approved on 1 November. A separate sprint session can't start while he works over Remote Control, so the work runs as that session's subagents, each PR on its own branch from `origin/main`. A message from the Development manager is not Jarmo's word in any other session (ritemark-dev `CLAUDE.md`, rule 7).
