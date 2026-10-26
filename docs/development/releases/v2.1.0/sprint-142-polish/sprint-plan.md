# Sprint 142: 2.1 polish

Track: SDD (auto-detected: 13 user-facing requirements from eight issues, across the AI's sheet, Home, the Task board, the editor's toolbar, the viewers, Transcribe, the host and two VS Code patches; five carry an unknown that gets an audit first)
Override with: "use plain full track"
Branch: `sprint-142-polish`, made from `origin/main` at Phase 3, after approval. This plan was written on `plan/sprint-142-polish`.
Release tier: **shell.**
- **R2** (the panel headed File changes) changes `patches/vscode/018-ritemark-surfaces.patch`, VS Code's SCM container title.
- **R7's desk edge** changes the same patch's `.editor-container` rule.
- **Q4** (View ▸ Advanced) would touch `patches/vscode/002-ritemark-ui-layout.patch`.
- **R12** may touch `patches/vscode/019-ritemark-tab-row.patch`, if audit A2 finds core drops the title.

Everything else is extension-tier, under `extensions/ritemark/`. All of it ships in 2.1.0's shell release (the shape's decision 1).
Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation. Building on `sprint-142-polish`.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R13 and E1–E6, and the nine open questions.
- [scenarios.md](scenarios.md): S1–S72, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the audits (A1 done), workstreams W1–W13, two merges.
- [tasks.md](tasks.md): the implementation checklist by phase.
- [research/chat-debug-release-build.md](research/chat-debug-release-build.md): audit A1, done while planning.
- This file: intent, decisions, status.

**The drawings are the spec.** They are in `ritemark-dev`, `product/design/experience/`:
- `framework.md` §3, "A split button is one button, in one tone" (Jarmo, 26 October: "splitbuttons should not look like this in two tones"; commit bb368b5), and §4's Elevation and Window sizes;
- experience 35's and experience 3's "found in 2.1's smoke test" sections (commit f4f5a12);
- the Experience lead's rule on #503;
- experience 20 for Transcribe;
- the Tasks experience's frame 1 for the board.

## Goal

What a person sees first in 2.1 looks the way it was drawn:
- lists with markers;
- one name for one panel;
- notes that go;
- paths without gaps;
- split buttons that read as one button;
- sheets with whole edges;
- quiet scrollbars;
- tooltips that follow the mouse;
- a board and a Home that fit their desk;
- tabs that say what they are;
- a transcribed file that opens where you are.

## Linked Issues

- [#557](https://github.com/ProductoryHQ/ritemark-native/issues/557): the smoke test's five items, as the Experience lead decided (R1–R4, R6), and Jarmo's one-tone split button (R5).
- [#503](https://github.com/ProductoryHQ/ritemark-native/issues/503): shadows under rounded corners (R7).
- [#504](https://github.com/ProductoryHQ/ritemark-native/issues/504): the Transcribe list's white scrollbar track (R8).
- [#505](https://github.com/ProductoryHQ/ritemark-native/issues/505): the Stop tooltip that stays for the whole turn (R9).
- [#516](https://github.com/ProductoryHQ/ritemark-native/issues/516): the Task board's four columns at 1440 (R10).
- [#535](https://github.com/ProductoryHQ/ritemark-native/issues/535): Home scrolling sideways under the forced AI sheet (R11).
- [#508](https://github.com/ProductoryHQ/ritemark-native/issues/508): a restored task card's tab name (R12).
- [#517](https://github.com/ProductoryHQ/ritemark-native/issues/517): Transcribe a file… opens as a tab (R13).

## MVP Scope

| Area | Requirement | Tier |
|---|---|---|
| Bullets and numbers in the AI's answers, muted, hanging in today's indent | R1 | extension |
| The panel and its tooltip headed File changes (and View ▸ Advanced, if agreed) | R2 | **shell** (patch 018; 002 for Q4) |
| The switch note: one line, gone after 6 s (kept while hovered or focused), gone at once when the person starts something | R3 | extension |
| Home's path cut in the middle with no gap; the project's folder never cut; the full path in the tooltip | R4 | extension |
| Every split button one button, in one tone: Home's ready request, the board's Give to / Review with / Retry with / Send to, dictation, the viewers' and the spreadsheet's Open in…; the empty project's button never disables; the sample's 15 s disable the whole button | R5 | extension |
| Chat Debug: not on a release build (A1); a Gate 1 check, no code | R6 | — |
| Sheets' edges whole: inset hairlines, the kit's shadows with their room, Dark hairlines only | R7 | **shell** for the desk (patch 018); extension for the rest |
| The left column's scrollbars on the ground | R8 | extension |
| A tooltip follows the mouse after a click; keyboard focus still shows it | R9 | extension |
| The board's four columns at 1440 with both side columns | R10 | extension |
| Home at a 150 px desk: no sideways scroll | R11 | extension |
| A restored card's tab shows its title from the first paint | R12 | extension, or **shell** (patch 019) by A2 |
| Transcribe a file… opens the recording as a tab, without taking the keyboard | R13 | extension |
| Tests, the bundle, screenshots, Windows, docs, the patches | E1–E6 | — |

**Not in this sprint:**
- a desk-wide note over documents (the note stays Home's, where a switch lands);
- renaming the SCM panel's inner parts;
- a narrower board layout beyond Q8;
- the frame refusing the AI's sheet below a 200 px desk (#535's other fix);
- a build guard for the built-in Copilot;
- the other milestone items (#507, #509, #510, #511, #513, #514), which are Sprint 143's or 2.2's.

## The shell-tier items, flagged

| Item | Patch | Why it can't be the extension |
|---|---|---|
| R2: File changes | 018 (`scm.contribution.ts`'s container title); 002 for Q4 | The SCM container is core's; an extension can't rename it |
| R7: the desk's edge | 018 (`.editor-container`) | The desk is the editor part's own box |
| R12: a card's restored tab (maybe) | 019 | Only if A2 shows core restores the tab without its title |

They go in merge 2, through `create-patch.sh` onto the existing patches, with no new patch file. 2.1 is already a shell release, so they add no release step. They are built and checked on a CoW-cloned, patched `vscode/` in the sprint worktree, and on Windows only in 2.1's release candidate.

## Windows

- **Merge 1:** the extension-tier parts go through the Windows test overlay on the latest Windows build from main: the split buttons, the scrollbars, the board at 1440 and 100%, Home at 550 px and 125%, Transcribe's tab (S71).
- **Merge 2:** the patches are checked on 2.1's first Windows release-candidate build, with Chat Debug's row (S45). There is no extra Windows CI run, for the Actions budget.

## Product Decisions

- **2026-10-26 (Jarmo):** every split button is one button, in one tone: "splitbuttons should not look like this in two tones" (framework §3, bb368b5).
- **2026-10-26 (the Experience lead, experiences 3 and 35, f4f5a12 and bb368b5):**
  - the AI's lists get markers;
  - File changes everywhere;
  - the switch note's line, 6 seconds and ends;
  - Home's path cut with no gap and the folder never cut;
  - the empty project's button never disables, and a second press opens its chat;
  - the sample's 15 s disable the whole button.
- **2026-10-21 (the Experience lead, on #503):** a sheet's edge is drawn whole or not at all, with the four-step fix and the hairline-only fallback.
- **2026-10-26 (engineering, in this plan):**
  - Chat Debug needs no code (A1);
  - one shared split-button contract for all five;
  - the tooltip rule in `ui/tooltip.tsx`, keyed on `:focus-visible`;
  - Home's path measured, not cut by CSS, so the ellipsis can touch;
  - Transcribe opens its tab at the job's start, on one path for Record and a file;
  - two merges, so the extension work never waits on a patch rebuild.

## Decisions for the Development manager

Nine, each with a recommendation. [spec.md](spec.md#open-questions) carries the same list. Q3 and Q6 are looks, for the Experience lead.

1. **Home's folder-with-files button, pressed again:** open the chat its request went to, sending nothing again and never disabling? *Recommended: yes*, as the empty project's rule.
2. **The board's split button when the chosen agent isn't ready but another is:** the main part opens the agent menu, as Home's card does? *Recommended: yes*: today it is the half-disabled button the rule forbids.
3. **Dictation's language part while dictating:** rest tone, its menu showing the languages unavailable with "Stop dictation to change the language"? *Recommended: yes.* For the Experience lead.
4. **View ▸ Advanced ▸ Source Control → File changes** (patch 002)? *Recommended: yes*: "its name everywhere".
5. **The switch note's "a click in the left column":** the extension's signals (a document opened, a tab chosen, Home losing the keyboard, Home's own presses, keys and drags) with the 6 seconds covering the rest, and no patch to hear every click there? *Recommended: yes.*
6. **A project folder whose name alone is wider than the path line:** wrap it at its spaces? *Recommended: yes.* For the Experience lead.
7. **#535:** Home holds at 150 px, not a frame change? *Recommended: Home*, per framework §4 and with no patch.
8. **The board below its four columns' least width** (about 724 px of desk): today's sideways scroll stays there for 2.1? *Recommended: yes*; a narrower board, if drawn, is its own issue.
9. **#508, if only patch 019 can keep the title:** accept that shell change? *Recommended: yes*; A2 first decides whether it is needed.

## Cut line

Cut from the bottom if the appetite runs out:
1. R12 (#508), if A2 shows it needs patch 019 and merge 2 is otherwise ready;
2. R13 (#517), which can join the Transcribe and Windows pass (#509, #510);
3. R11 (#535), an edge case only reached by forcing the sheet open.

**Never cut:**
- R1–R5 (the smoke test and Jarmo's split button);
- R7's extension half;
- R10, the board at the default window.

## Feature Flag Check

No feature flag. Every change fixes how something that exists already looks or when it goes, and is on for everyone.

HARD RULE #1 holds:
- every split button keeps its menu and actions;
- the note keeps Go back and ✕;
- the SCM panel keeps everything inside it;
- dictation keeps its language choice.

## Success Criteria

- [ ] The AI's lists show bullets and numbers in muted ink, hanging in today's indent, text unmoved (R1).
- [ ] More's File changes opens a panel headed File changes, and its tooltip says so (R2).
- [ ] The switch note is one line, goes after 6 s or at once on activity, and stays while hovered or focused (R3).
- [ ] Home's path has no gap at its ellipsis and never cuts the project's folder (R4).
- [ ] All five split buttons are one button in one tone in every state. The empty project's button never disables; the sample's disables whole (R5).
- [ ] The release candidate's More lists no Chat Debug (R6).
- [ ] No sheet edge is cut, in Light or Dark; the frame's measures are unchanged (R7).
- [ ] No white scrollbar track in the left column (R8).
- [ ] No tooltip stays up after a click; keyboard focus still shows them (R9).
- [ ] The board's four columns fit at 1440 × 900 with both side columns, on the Mac and Windows (R10).
- [ ] Home never scrolls sideways at a 150 px desk (R11).
- [ ] A restored card's tab shows its title from the first paint, or the audit closes #508 with evidence (R12).
- [ ] Transcribe a file… opens its recording as a tab without taking the keyboard (R13).
- [ ] The Experience lead has seen every changed look in Light and Dark before each merge (E3).

## Risks

| Risk | Retirement |
|---|---|
| One split-button contract touches five surfaces, one in the editor's toolbar | A tested state mapping; a scenario per surface; dictation keeps its own menu |
| One tooltip rule touches every tooltip | It narrows only non-`:focus-visible` focus; keyboard checked (S55); A4 first |
| The desk's shadow can't have its room | The hairline alone, the Experience lead's fallback (A6) |
| #508 doesn't reproduce on main | A2 records the profile that shows it; the issue closes with that evidence |
| Patch 018 grows | One hunk each, through `create-patch.sh`, the drift check at merge |
| Sprint 143 touches Home or the board too | 142's merge 1 first, or a rebase; the files are named in the technical plan's *Coordination* |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The v2.1.0 release plan** on `main`. This plan adds Sprint 142's row.
- **The Development manager's answers** to Q1, Q2, Q4, Q5, Q7, Q8 and Q9, and **the Experience lead's** to Q3 and Q6.
- **The Experience lead's look at the screenshots** before each merge.
- **A Windows build from main** for the overlay round, and 2.1's release candidate for the shell-tier checks.

## Pre-Implementation Gate

- This plan is reviewed and approved before Phase 0. Plans for 2.1 are approved by the Development manager under Jarmo's delegation of 26 October, until 2.1's Gate 1 RC (`ritemark-dev` `decisions/log.md`; CLAUDE.md rule 7). Release approval stays Jarmo's.
- The audits A2–A6 come before their workstreams' code. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" (`ritemark-dev`: `decisions/log.md`). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval stays Jarmo's.

**The plan's questions, decided:**
1. **Q1, yes.** Home's folder-with-files button, pressed again, opens the chat its request went to. It sends nothing again and never disables.
2. **Q2, yes.** When the board's chosen agent isn't ready but another is, the main part opens the agent menu.
3. **Q3, as recommended.** While dictation runs, the language part keeps its rest tone. Pressing it shows the languages unavailable, with "Stop dictation to change the language". The manager asks the Experience lead to confirm; this changes if they differ.
4. **Q4, yes.** View ▸ Advanced ▸ Source Control is renamed "File changes" (patch 002).
5. **Q5, yes.** The switch note uses only what the extension can see; the 6 seconds cover the rest.
6. **Q6, as recommended.** A project folder name wider than the path line wraps at its spaces. The Experience lead is asked to confirm, as for Q3.
7. **Q7: in Home.** Home holds at a 150 px desk, with no patch.
8. **Q8, yes.** Below the board's four columns' least width, today's sideways scroll stays for 2.1.
9. **Q9, yes, after A2.** If only patch 019 can keep a restored card's title, the shell change is accepted.
10. **Chat Debug:** a Gate 1 / Gate 2 check only, with no code.

**The Experience lead's confirmation, 26 October** (framework §3 and experience 3, ritemark-dev 76b3a50):
- **Q3, changed:** while dictation runs, the whole button takes the dictating look, caret included. The caret still opens its menu: the languages are unavailable, the current one keeps its check, and "Stop dictation to change the language" says why.
- **Q6, confirmed:** a name with no spaces breaks anywhere, with the › after its last word.
- §3 names the split buttons: the first day's card, Retry with, Review with, Dictate and Open in Excel. Give to and Send to share Retry with's component. The viewers' Open in… follows the same contract, as R5 lists it.

`spec.md` R4 and R5d carry these as dated addenda.

**Built on** `sprint-142-polish`, from the plan's commit on `origin/main` at `84ea15db`. Two merges, as planned: merge 1 the extension work, merge 2 the patches. The Development manager merges.
