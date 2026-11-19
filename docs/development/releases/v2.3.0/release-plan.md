# Release Plan — v2.3.0

**Status:** **Draft, not approved.** Written after the fact on 19 November 2026, to bring 2.3 back to the process rules (`.claude/agents/sprint-manager.md`: a release lives in this folder with `release-plan.md` and a GitHub milestone, and its plan tracks each sprint and its PRs). Six sprints (158–163) and 49 PRs outside any sprint were built and merged before this plan existed. 2.3's scope and thesis have no approved release plan yet: both wait for Jarmo. This plan records what was decided and built; it approves nothing. Writing it is part of the repair Jarmo asked for on 19 November: "jah, tee need parandused enne sprinti 164" (yes, make these fixes before Sprint 164).<br>
**Release candidate:** no date set.<br>
**Target:** v2.3.0<br>
**GitHub milestone:** v2.3.0. It held no issues until 19 November, when the sweep of v2.2.0's open issues began moving them here (at the time of writing: #591, #582, #501 and #497). From Sprint 164 on, each PR gets an issue on it.<br>
**Release type:** **Shell-tier**, checked against each PR's files:
- Sprint 159 PR 1 (#733) changes patch 002, PR 2 (#735) changes `branding/product.json` (the Slide library's place), and PR 6 (#736) changes patches 004, 018 and 019;
- two PRs outside sprints change patches too: #720 (patch 010, a failed page reloads) and #753 (patch 018, a deck's ".deck.md" in Documents and the tabs);
- some files reach people only with a full release, because an extension release ships only `out/**/*.js`, four media files and `package.json`: Sprint 162 PR 3's six fonts and `OFL.txt` (#777), the file icon theme's new icons (#753, #778), the Slide library's icon (#735), and Sprint 158's lines in `branding/ATTRIBUTION.md`;
- since #720, `release-extension-preflight.sh` refuses an extension release from `main` against v2.2.0 (Sprints 159 and 160's close-outs), so 2.3's extension-tier sprints reach people with this release too.

It is built and gated as 2.2 was: a clean-room release worktree, Gate 1 and Gate 2, notarization after the hardening window.<br>
**Platforms:** not decided yet. 2.2 shipped for darwin-arm64, darwin-x64, win32-x64 and the Microsoft Store.<br>
**Release owner:** Jarmo<br>
**Created:** 2026-11-19<br>
**Source:**
- the sprint plans in this folder (158–163, and 164's in its PR);
- the drafts in `ritemark-dev`: [`releases/v2.3.0/analysis/`](../../../../../releases/v2.3.0/analysis/) (Sprints 161–164's plans, the block-slides study, the Publish host study for #701). The links resolve in the usual checkout, where `ritemark-native` sits inside `ritemark-dev`;
- the decisions' rows in `ritemark-dev`: [`decisions/log.md`](../../../../../decisions/log.md), 11–19 November;
- `git log --first-parent v2.2.0..origin/main` (90 commits, at 89dce0dc), and each PR's body and Review record.

## Release Thesis

**To be agreed with Jarmo.** No thesis has been decided for 2.3.

**A draft, from the evidence:** "2.3 is Decks: slides you write like text, for a real training, and a published page that is each participant's workbook."

The evidence, in Jarmo's words:
- 15 November: Decks and 2.3 run as two streams, and Decks goes first when they compete: "jah, esimene versioon sobib, Decks ette, kirjuta plaanid" (yes, the first version fits, Decks first, write the plans).
- 16 November, on slides written like text: "praegu, sest hetkel on mul valu ja vaev slaide ette valmistada" (now, because preparing slides is a pain for me at the moment).
- 17 November: "Hoopis olulisem on teemad" (themes matter much more).
- 18 November, on the published page: "see minu jaoks on nagu töövihik kaasategijale" (to me it's like a workbook for the participant).

Two things the thesis has to settle with him:
- Sprint 160's plan records another direction for 2.3, "agreed with Jarmo: the AI works from day one, on Mac and Windows", and Excel (Sprint 158) is in 2.3 too. No decision-log row names either one, or Decks, as the release's story.
- While Decks stays behind its flag, the public notes say nothing about Decks (Sprint 159's plan). A Decks thesis needs Decks turned on in 2.3 (*Open for the release*, below).

## How 2.3 is built

**The rules:**
- **One shell release, 2.3.0,** gated by Gate 1 and Gate 2.
- **Sprints are repo-scoped to `ritemark-native`.** Each has its `sprint-plan.md` in this folder, with a Track line and a `Release tier:` line, is approved before its code, and runs on a branch named after its folder.
- **Every PR gets `REVIEW.md`'s review,** with a Review record on the PR naming the reviewed commit.
- **Main stays releasable,** and is frozen from the first release candidate until publication.
- **Decks stays behind `ritemark.features.decks`,** off by default, until Jarmo decides otherwise.
- **No time estimates.**

**What happened instead** (the audit of 19 November):
- No release plan until this one, and no issues on the v2.3.0 milestone until 19 November.
- Sprints 161–164 were drafted in the governance repo's `releases/v2.3.0/analysis/`. Sprint 161's plan was then written here with its spike (#756) and Sprint 162's with its PR 1 (#775). Sprint 163's lived only there until this plan's companion, [its sprint plan](sprint-163-workbook/sprint-plan.md), was written on 19 November. Sprint 164's was drafted there too, and is now written here as the repair asks ([#813](https://github.com/ProductoryHQ/ritemark-native/pull/813), open).
- 49 PRs were built and merged with no sprint (*Work outside sprints*, below), most from Jarmo's asks during his own tests and under the overnight grants of 17 to 19 November.
- PRs ran on per-PR branches. Sprint 163 had no branch named after its folder.
- No `qa-validator` ran at the ends of Sprints 161–163, and no release notes were started.

**From Sprint 164 on,** every piece of work, however small, gets at least a lightweight `sprint-plan.md` in this folder before it's built, and each PR gets an issue on the v2.3.0 milestone.

## Sprints

| Sprint | Scope | Tier | PRs (merged commit) | Status |
|---|---|---|---|---|
| [158 — Excel looks like Excel, and a save keeps it](sprint-158-excel/sprint-plan.md) | A save changes only the cells you edited; the preview looks like the workbook in Excel, with dates as written and hidden things hidden; the sheet goes on as in Excel, with an `excel-editing` kill switch (#711) | Extension | PR 0 #721 (8b4825fe), PR 1 #722 (ee34c930), PR 2 #723 (c6b9fe50), PR 3 #724 (9e723080), PR 4 #725 (9f802573), PR 5 #726 (c493d143); close-out #728 (303dda8d) | **Done** 15–16 Nov. Approved by Jarmo on 15 Nov ("Exceli plaan on kinnitatud"); his gate passed ("excel on ok") |
| [159 — Decks, ready for a training](sprint-159-decks-training/sprint-plan.md) | Present, with a presenter view and a second display; the handout page, published with 2.2's Publish; New → Deck; Decks on main behind `ritemark.features.decks`, off by default | **Shell** (patches 002, 004, 018, 019; `product.json`) | PR 1 #733 (9672cc23), PR 2 #735 (a56a3153), PR 7 #738 (b29de23d), PR 5 #731 (ed9ff194), PR 6 #736 (eac6e0d7), PR 3 #729 (dbc3650c), PR 4 #737 (19119f52); close-out #739 (aec57604); Codex's late findings #740 (7c904083) | **Done** 16 Nov. Approved on the night of 15 Nov by the Experience lead and the Development manager, on Jarmo's delegation: "tore! ja võid alustada sprints ise kui olete Experienciga yhel meelel" (great! and you may start the sprints yourself once you and Experience agree) |
| [160 — The AI is ready on day one, on Mac and Windows](sprint-160-ai-ready-day-one/sprint-plan.md) | Claude's readiness has one source per state (#703, #541); the AI's sheet shows a sign-in that is already running (#696); a usage limit says so (#686) | Extension | PR B #730 (5ca14c11), PR A #732 (ef786f5f), PR C #734 (114da368); close-out in #739 | **Done** 16 Nov. Approved on the night of 15 Nov on the same delegation. #703 and #541 stay open until Windows and a real key are checked |
| [161 — Block slides](sprint-161-block-slides/sprint-plan.md) | Slides written like text, with blocks from the / menu; every older deck opens as block slides and converts at its first edit, with one Undo; comments on the slide, for Claude (added on 17 Nov) | Extension | Plan and spike #756 (f9fe3a71); PR 1 #760 (3d7dc0fd), PR 2 #765 (d0a2b08c), comments on the slide #766 (e2e506c5), PR 3 #769 (f0eb1a4d) | **Approved** by Jarmo on 17 Nov ("jah, alusta Sprint 161, peidetud sõnad märkmetesse sobib"). PRs 1–3 and the slide comments merged. PR 4 (Gamma paste) **separated from 2.3** on 17 Nov. PR 5 (remove the old layout model): no PR yet. It is a HARD RULE #1 removal that waits for Jarmo's yes, and whether it is in 2.3 follows from that. No close-out yet |
| [162 — Deck themes](sprint-162-themes/sprint-plan.md) | The Theme button; a theme's own tab; six bundled fonts; a logo; the AI makes themes, with See what changed and Undo; a published page keeps its theme until Update the page | Extension, except PR 3's fonts, which ship only with a full release | PR 1 #775 (db09ca2a), PR 2 #778 (9e34e720), PR 3 #777 (af93b292), PR 4 #785 (2ef24983), PR 5 #783 (d4633111), PR 6 #791 (f85834e8) | **Approved** by Jarmo on 17 Nov ("kinnitan"). All six built. Left: Jarmo's own tests, TEST-CHECKLIST rows 24g–24m, on the full 2.3 build (the fonts come only with it) |
| [163 — The published deck is the participant's workbook](sprint-163-workbook/sprint-plan.md) | The code block on the slide, with Copy and Open in…; the Tabs and Button blocks; the published page plays as Present's player; the exercise layout, and Claude learns all three | Extension | PR 1 #804 (830b6022), PR 2 #805 (d2bfee9d), PR 3 #806 (5131ad1a), PR 4 #807 (956bc5fe), PR 5 #808 (c9da6bae); follow-ups #809 (01b0f8a8), #810 (00266c71), #811 (8698b197), #812 (89dce0dc) | **Approved** by Jarmo on 18 Nov; **done** 19 Nov. Its plan lived only in the governance repo until 19 Nov |
| [164 — Slide only by default, spacing on the slide, the Label block](sprint-164-deck-finish/sprint-plan.md) | A deck opens in Slide only; one spacing rule on the slide; Label as a block of its own | Extension | Plan: [#813](https://github.com/ProductoryHQ/ritemark-native/pull/813); issues [#816](https://github.com/ProductoryHQ/ritemark-native/issues/816), [#817](https://github.com/ProductoryHQ/ritemark-native/issues/817), [#818](https://github.com/ProductoryHQ/ritemark-native/issues/818); PR 1 [#819](https://github.com/ProductoryHQ/ritemark-native/pull/819) (a0fec8f9), PR 2 [#821](https://github.com/ProductoryHQ/ritemark-native/pull/821) (ba0b639d), PR 3 [#858](https://github.com/ProductoryHQ/ritemark-native/pull/858) (5a533f8f), PR 4 [#892](https://github.com/ProductoryHQ/ritemark-native/pull/892) (the leftovers' removal); close-out [#894](https://github.com/ProductoryHQ/ritemark-native/pull/894) | **Approved** by Jarmo on 19 Nov, with its three removals by name ("kinnitan sprindi 164 koos eemaldustega"); **done** 19 Nov. The Experience lead approved the shots of #819, #821 and #858; `qa-validator` signed off. A bare `::: steps` draws no default pill (a Label is free, tied to no block); a v1 Exercise slide keeps "Exercise". Not run: Windows, the presenter view on a second display |
| [165 — The Slide library place](sprint-165-slide-library/sprint-plan.md) | Other decks by folder; Take section; search shows each slide once; the library offers the slides repeated across decks (PR 0 measures the rule on synthetic decks first) | Extension | PR 0 #830 ([#840](https://github.com/ProductoryHQ/ritemark-native/pull/840)), PR 1 #831 ([#843](https://github.com/ProductoryHQ/ritemark-native/pull/843)), PR 2 #832 ([#861](https://github.com/ProductoryHQ/ritemark-native/pull/861)), PR 3 #833 ([#877](https://github.com/ProductoryHQ/ritemark-native/pull/877)), PR 4 #834 ([#895](https://github.com/ProductoryHQ/ritemark-native/pull/895)); held: #887 (shell, Jarmo's word) | **Done** 20 Nov (approved 19 Nov, "kinnitan sprindid 165, 166 ja 167"; qa-validator passed) |
| [166 — Slide fixes](sprint-166-slide-fixes/sprint-plan.md) | The formatting bubble on a block slide ([#822](https://github.com/ProductoryHQ/ritemark-native/issues/822)); moving between slides in Slide only ([#824](https://github.com/ProductoryHQ/ritemark-native/issues/824)); tables the same in the editor, on the wall and on the page ([#827](https://github.com/ProductoryHQ/ritemark-native/issues/827), [#828](https://github.com/ProductoryHQ/ritemark-native/issues/828)); the split's drag guide ([#829](https://github.com/ProductoryHQ/ritemark-native/issues/829)); added 19 Nov: a Quote's leaked look ([#841](https://github.com/ProductoryHQ/ritemark-native/issues/841)), the Present bar ([#842](https://github.com/ProductoryHQ/ritemark-native/issues/842)), the bubble over the Link dialog ([#846](https://github.com/ProductoryHQ/ritemark-native/issues/846)), a Button's own words ([#848](https://github.com/ProductoryHQ/ritemark-native/issues/848)), an unknown icon name ([#850](https://github.com/ProductoryHQ/ritemark-native/issues/850)), a gesture over the slide in Slide and handout ([#855](https://github.com/ProductoryHQ/ritemark-native/issues/855)), a thumbnail takes no click or wheel inside it ([#856](https://github.com/ProductoryHQ/ritemark-native/issues/856)); one PR each | Extension | PR 1 [#845](https://github.com/ProductoryHQ/ritemark-native/pull/845) (3fe5e92c), PR 2 [#849](https://github.com/ProductoryHQ/ritemark-native/pull/849) (92e7d35a), PR 3 [#851](https://github.com/ProductoryHQ/ritemark-native/pull/851) (0bfdb2e2), PR 4 [#893](https://github.com/ProductoryHQ/ritemark-native/pull/893) (c25a6687), PR 5 [#852](https://github.com/ProductoryHQ/ritemark-native/pull/852) (ae8e7194), PR 6 [#857](https://github.com/ProductoryHQ/ritemark-native/pull/857) (a4a8aa69), PR 7 [#862](https://github.com/ProductoryHQ/ritemark-native/pull/862) (5b60d217), PR 8 [#873](https://github.com/ProductoryHQ/ritemark-native/pull/873) (a480997f), PR 9 [#874](https://github.com/ProductoryHQ/ritemark-native/pull/874) (ef180955), PR 10 [#871](https://github.com/ProductoryHQ/ritemark-native/pull/871) (a0eb710a), PR 11 [#875](https://github.com/ProductoryHQ/ritemark-native/pull/875) (330ca30b); close-out [#899](https://github.com/ProductoryHQ/ritemark-native/pull/899) | **Approved** 19 Nov ("kinnitan sprindid 165, 166 ja 167"); **done** 20 Nov. `qa-validator` signed off on 19 Nov apart from two release-notes lines and the live checks, both in the close-out. The live checks found one gap, an open follow-up for an issue: a choice from the strip (a click, Home, End, the arrows) leaves the slide's pane where it was beside the handout. Not run: a real trackpad and mouse, the presenter view on a second display, Windows |
| [167 — Five small block details on the slide](sprint-167-block-details/sprint-plan.md) | The logo in any corner; Mark for Boxes; the slide's content Top, Middle or Bottom; a picture behind from a corner chip; one item's own handle | Extension | Issues to be created | **Approved** 19 Nov ("kinnitan sprindid 165, 166 ja 167") |
| [168 — Quotes, prompts and heading levels on a slide](sprint-168-quotes-headings/sprint-plan.md) | The quote's look with an attribution line; Code block takes a prompt out of a quote; H1 > H2 > H3 on the slide, with Heading 1, 2 and 3 in the / menu | Extension | PR 1 [#863](https://github.com/ProductoryHQ/ritemark-native/issues/863) ([#880](https://github.com/ProductoryHQ/ritemark-native/pull/880), c656d9c5), PR 2 [#864](https://github.com/ProductoryHQ/ritemark-native/issues/864) ([#872](https://github.com/ProductoryHQ/ritemark-native/pull/872), 4a135b4c), PR 3 [#865](https://github.com/ProductoryHQ/ritemark-native/issues/865) ([#889](https://github.com/ProductoryHQ/ritemark-native/pull/889), 795adcfd); close-out [#898](https://github.com/ProductoryHQ/ritemark-native/pull/898) | **Done** 20 Nov (approved 19 Nov, "jah kõigile kolmele"; the Experience lead looked at each PR before it merged; qa-validator passed every PR check on 20 Nov) |
| [169 — Every Phosphor icon for boxes, found by searching](sprint-169-every-icon/sprint-plan.md) | The full set of 1,512 regular icons for a box, with a "Search icons" field; every surface draws them; the page carries the ones a deck uses; an unknown name gets a tooltip and Choose an icon | Extension | Issues to be created | **Approved** 19 Nov ("jah kõigile kolmele") |
| [170 — Publish becomes a split button with Save as PDF](sprint-170-save-as-pdf/sprint-plan.md) | A ▾ beside Publish with one item that names what the view saves: slides, slides and handout, or handout; PR 0 is a spike on the print path | Extension, provisional: shell if the spike finds a patch is needed | PR 0 to be created; PR 1 [#881](https://github.com/ProductoryHQ/ritemark-native/issues/881); PR 2 and PR 3 to be created | **Approved** 19 Nov ("1 jah", "kinnitatud") |
| [171 — A solo Button stays where it is when chosen](sprint-171-solo-button/sprint-plan.md) | A button with no words beside it keeps its pill in place when chosen and when not ([#876](https://github.com/ProductoryHQ/ritemark-native/issues/876)); one PR | Extension | PR 1 [#876](https://github.com/ProductoryHQ/ritemark-native/issues/876) ([#890](https://github.com/ProductoryHQ/ritemark-native/pull/890)) | **Done** 19 Nov (approved "1 jah", "kinnitatud"; qa-validator passed) |
| The release — 2.3 as one release | The done list, the runtime review, version 2.3.0, the release notes, the gates and publication | Shell | — | Not started |

**Sprint 157** (Decks, first cut) isn't release-bound, so its plan stays at [`docs/development/sprints/sprint-157-decks/`](../../sprints/sprint-157-decks/sprint-plan.md). Its code reached `main` with Sprint 159 PR 2 (#735), so it ships with 2.3.

## Work outside sprints

These are the PRs merged since v2.2.0 that belong to no sprint. Building them without a sprint plan was a drift from the rule that sprint work needs an approved plan before its code. The 19 November audit counted about 20 pieces of work; listed PR by PR, it is 49, including three fixes from the issue-triage routine (which its policy allows) and two PRs for the repository and its tests (#712, #786). Many keep their proof in this folder (`decks-*`, `pictures-chatgpt`, `slash-hidden-words`, `chatgpt-picture-leave-slide`) or in a sprint's `research/proof/`. 2.2.0's closeout (#704, #705) belongs to 2.2's plan and is left out.

**From Sprint 164 on, every piece of work, however small, gets at least a lightweight sprint plan before it's built.**

Dates are merge dates, Tallinn time. The last column names the decision-log row or grant each PR was built under:
- **Triage:** the issue-triage routine (`docs/development/issue-triage-policy.md`). The manager reviewed these on the 15 November row "2.3's other scoped work runs tonight too, not only Excel".
- **Overnight grant 1:** the row "Overnight Decks grant", dated 18 November, for the night of 17 to 18 November: "sul terve öö aega. kasuta seda nutikalt ja tee kasulikke asju. sul on voli edasi arendada decks nii et see oleks maailma parim :)" (you have the whole night; use it wisely and do useful things; you may develop Decks further so that it's the best in the world). It covers approved Sprint 161/162 work and the Experience lead's designs, merged after the lead's look. Gates, releases, posts, removals (HARD RULE #1) and worktree `--clean` stay his.
- **Overnight grant 2:** the row "Second overnight grant", 18 November, until the morning of 19 November: "aa nyyd saad vabalt arendada kuni hommikuni" (now you can develop freely until the morning), for queued Decks fixes and the Experience lead's small designs; and the row "The night runs as last night": "jah. nagu eile öösel - sina oled boss. ma hommikul vaatan yle" (yes, as last night, you're the boss; I'll look it over in the morning).
- **His ask only:** Jarmo's ask during his own test, quoted in the PR's body. No decision-log row records the work.

| PR | What it does | Merged | Built under |
|---|---|---|---|
| [#712](https://github.com/ProductoryHQ/ritemark-native/pull/712) | A test workbook in this public repository loses a local account's path and a real company's name | 15 Nov | Repository hygiene, found by Sprint 158's study; no decision-log row |
| [#716](https://github.com/ProductoryHQ/ritemark-native/pull/716) | A dropped picture never overwrites another picture of the same name | 15 Nov | A Codex finding on Sprint 157 PR 3, brought to `main`; no decision-log row |
| [#719](https://github.com/ProductoryHQ/ritemark-native/pull/719) | A finished task card's chat answer no longer names the card's internal id (#709) | 15 Nov | Issue fix; no decision-log row |
| [#720](https://github.com/ProductoryHQ/ritemark-native/pull/720) | A web page that failed to load reloads when its file is opened again (#710). **Shell-tier** (patch 010). The CHANGELOG lists it under Sprint 162 | 15 Nov | Issue fix ("Sprint: none" in the PR); no decision-log row |
| [#706](https://github.com/ProductoryHQ/ritemark-native/pull/706) | A link inside a table keeps its address when the document is published to Google Docs (#702) | 15 Nov | Triage; #702 was placed in 2.3 on 11 November ("GDocsi asi 2.3'e") |
| [#707](https://github.com/ProductoryHQ/ritemark-native/pull/707) | The first-run theme setup keeps values already in `settings.json` (#461) | 15 Nov | Triage |
| [#708](https://github.com/ProductoryHQ/ritemark-native/pull/708) | Comments accept @chatgpt and offer it in the mention list (#685) | 16 Nov | Triage |
| [#749](https://github.com/ProductoryHQ/ritemark-native/pull/749) | New → Deck opens the deck at once, with the handout's start card | 16 Nov | Row of 16 November, "Decks, two changes from Jarmo's own feedback, both for 2.3": "jah, ehita alguskaart ka" (yes, build the start card too) |
| [#750](https://github.com/ProductoryHQ/ritemark-native/pull/750) | A deck's handout is a Text document: its own headings, and a line starts a new slide | 16 Nov | The same row: "jah, ehita tekstiosa nii -" (yes, build the text part like that) |
| [#751](https://github.com/ProductoryHQ/ritemark-native/pull/751) | The slide can be hidden, to write the handout alone | 16 Nov | His ask only (16 November) |
| [#752](https://github.com/ProductoryHQ/ritemark-native/pull/752) | An exercise's pill is editable (an optional `tag:` line) | 16 Nov | Row of 17 November, "Sprint 161, block slides, approved", which records it: "jah, ühenda Exercise" (yes, merge Exercise) |
| [#753](https://github.com/ProductoryHQ/ritemark-native/pull/753) | A deck has its own icon wherever a file shows, and the Slide library shows cards. **Shell-tier** (patch 018) | 16 Nov | His ask only (16 November: "Deck vajab oma ikooni --- sama ka librarysse", a deck needs its own icon, the library too) |
| [#754](https://github.com/ProductoryHQ/ritemark-native/pull/754) | An item never shows its number twice ("1. 1. Sisend") | 16 Nov | The same 17 November row: "paranda topeltnumbrid kohe" (fix the double numbers now) |
| [#755](https://github.com/ProductoryHQ/ritemark-native/pull/755) | Backspace or Delete in the slide strip deletes the selected slide | 16 Nov | His ask only (16 November) |
| [#757](https://github.com/ProductoryHQ/ritemark-native/pull/757) | The fold's two buttons become one split control | 16 Nov | His ask only (16 November: "see võiks olla split button", this could be a split button) |
| [#758](https://github.com/ProductoryHQ/ritemark-native/pull/758) | The AI knows which slide the person is on | 16 Nov | Row of 17 November, "Sprint 161 adds comments on the slide", which lists "the AI knows the focused slide" (no words of his quoted for it) |
| [#759](https://github.com/ProductoryHQ/ritemark-native/pull/759) | Popups close on an outside click or Esc, as one pattern; Slide settings moves into the deck's bar (moved again by #770) | 16 Nov | The same row: "every popup closes on an outside click, as a global pattern" |
| [#761](https://github.com/ProductoryHQ/ritemark-native/pull/761) | The slide goes along the room's long side; with the handout hidden, the wheel and the keys move between slides | 16 Nov | The same row, and the 17 November row "Sprint 161 PR 2 … starts now" records its merge |
| [#763](https://github.com/ProductoryHQ/ritemark-native/pull/763) | Home's folder card counts decks (Decks flag) | 16 Nov | The Experience lead's approval (in the PR); the 17 November row "Sprint 161 PR 2 … starts now" records its merge |
| [#762](https://github.com/ProductoryHQ/ritemark-native/pull/762) | Home's Start something gets a Deck card (Decks flag) | 16 Nov | The same: his ask (in the PR) and the lead's look; the merge is recorded in that row |
| [#764](https://github.com/ProductoryHQ/ritemark-native/pull/764) | Card \| Borderless moves into the slide's settings popup | 16 Nov | The 17 November row "Sprint 161 PR 2 … starts now": his ask, "card/borderless buttons also to settings?" |
| [#770](https://github.com/ProductoryHQ/ritemark-native/pull/770) | A slide can be removed from the handout; a slide's settings move to its own ⋯ menu | 17 Nov | Rows of 17 November: "Deleting a slide from the handout gets built" ("Jah tee seda", yes, do it), "Removing a slide from the handout starts now" ("alusta", start), and "A slide's settings move into the strip thumbnail's ⋯ menu" ("slaidi settings peaks olema siin: mitte kuskil ülal tööriistaribas", the slide's settings should be here, not up in the toolbar) |
| [#771](https://github.com/ProductoryHQ/ritemark-native/pull/771) | Thumbnails match the stage; words never split mid-word; pictures move along; the view switch (slide, both, handout) | 17 Nov | His ask only (his test of 17 November), with the Experience lead's view switch |
| [#772](https://github.com/ProductoryHQ/ritemark-native/pull/772) | Tables you can change, in Text documents and on slides: grips, menus, + bars, keys and column widths (experience 48) | 17 Nov | Row of 17 November, "Two builders at once: tables start beside the fix PR": "Jah" |
| [#773](https://github.com/ProductoryHQ/ritemark-native/pull/773) | One bar for every block on a slide | 17 Nov | His ask only (his test of 17 November, through the Experience lead) |
| [#774](https://github.com/ProductoryHQ/ritemark-native/pull/774) | One picture editor for documents and slides; the old resize that rewrote the picture's file is removed (experience 49) | 17 Nov | Rows of 17 November: "The picture editor (experience 49) starts in the free builder slot" ("pildid", pictures), the removal ("jah, eemalda", yes, remove: HARD RULE #1), and "Pictures on block slides must be changeable" |
| [#776](https://github.com/ProductoryHQ/ritemark-native/pull/776) | The block bar's follow-up, and Slide only fills the room | 17 Nov | His ask only (his report on the view switch), with the Experience lead's review of #773 |
| [#779](https://github.com/ProductoryHQ/ritemark-native/pull/779) | The wall's ground runs to the screen's edges in Present | 17 Nov | His ask only (his Present test, 17 November) |
| [#780](https://github.com/ProductoryHQ/ritemark-native/pull/780) | Space, not lines; the handout's number rail; a slide with no handout; wide tables scroll | 17 Nov | His ask only (his rundev test, 17 November) |
| [#781](https://github.com/ProductoryHQ/ritemark-native/pull/781) | A table that scrolls sideways keeps sensible column widths | 17 Nov | The Experience lead's item from #780's review; no decision-log row |
| [#782](https://github.com/ProductoryHQ/ritemark-native/pull/782) | A clicker, a blank wall and the time of day in Present | 17 Nov | Overnight grant 1 |
| [#784](https://github.com/ProductoryHQ/ritemark-native/pull/784) | ⌘D duplicates a slide, ⌘↑ and ⌘↓ move it, and Undo says what it undid | 18 Nov | Overnight grant 1 |
| [#786](https://github.com/ProductoryHQ/ritemark-native/pull/786) | Tests and isolated launches clean up their temp folders (they had filled the disk twice) | 18 Nov | Harness; no decision-log row |
| [#787](https://github.com/ProductoryHQ/ritemark-native/pull/787) | The published page remembers each reader's place and links to a part | 18 Nov | Overnight grant 1 |
| [#788](https://github.com/ProductoryHQ/ritemark-native/pull/788) | Open a page's prompt in Claude or ChatGPT | 18 Nov | Overnight grant 1 |
| [#789](https://github.com/ProductoryHQ/ritemark-native/pull/789) | The published page's QR code on the wall | 18 Nov | Overnight grant 1 |
| [#790](https://github.com/ProductoryHQ/ritemark-native/pull/790) | A spotlight on one item in Present, and a picture that fills the wall | 18 Nov | Overnight grant 1 |
| [#792](https://github.com/ProductoryHQ/ritemark-native/pull/792) | Slide transitions, and a smooth move between slides, in Present | 18 Nov | Overnight grant 1 |
| [#795](https://github.com/ProductoryHQ/ritemark-native/pull/795) | A soft fade at the edge of a table that scrolls sideways | 18 Nov | Overnight grant 1 (built that night on the Experience lead's note on #781; the PR names no grant) |
| [#793](https://github.com/ProductoryHQ/ritemark-native/pull/793) | The published page prints as a handout, and an Agenda block that writes itself | 18 Nov | Overnight grant 1 |
| [#794](https://github.com/ProductoryHQ/ritemark-native/pull/794) | Several pictures dropped on the strip make a slide each, and Copy as picture | 18 Nov | Overnight grant 1 |
| [#796](https://github.com/ProductoryHQ/ritemark-native/pull/796) | The first edit's Undo gives back a `deck: 1` deck as it was (a bug in Sprint 161's conversion) | 18 Nov | Overnight grant 1 |
| [#797](https://github.com/ProductoryHQ/ritemark-native/pull/797) | A pointer dot, and a timer for an exercise, in Present | 18 Nov | Overnight grant 1 |
| [#798](https://github.com/ProductoryHQ/ritemark-native/pull/798) | A theme's second logo, for the other ground. The CHANGELOG lists it under Sprint 162, but it isn't one of 162's six PRs | 18 Nov | Overnight grant 1 |
| [#799](https://github.com/ProductoryHQ/ritemark-native/pull/799) | Items arrive one by one in Present | 18 Nov | Overnight grant 1 |
| [#800](https://github.com/ProductoryHQ/ritemark-native/pull/800) | Make or change a picture with ChatGPT, in Text documents and on slides | 18 Nov | Row of 17 November, "Pictures on block slides must be changeable, and ChatGPT/Codex should be able to make them" ("ja Codex/ChatGPT saab ise ka pilte luua sinna", and Codex/ChatGPT can make pictures there too), then overnight grant 1 |
| [#801](https://github.com/ProductoryHQ/ritemark-native/pull/801) | Fixes from the 18 November smoke run: the theme preview's Agenda, dialogs keep their description, a lone picture is centred | 18 Nov | Overnight grant 1 (the PR names no grant) |
| [#802](https://github.com/ProductoryHQ/ritemark-native/pull/802) | The / menus find items by hidden words; the Text editor's Image is Picture | 18 Nov | Overnight grant 2 (his report of 18 November) |
| [#803](https://github.com/ProductoryHQ/ritemark-native/pull/803) | A ChatGPT picture lands on its slide when the slide is left | 18 Nov | Overnight grant 2 (his test of #800) |

## Moved in from 2.2

2.2's cut of 5 November moved these to 2.3 (2.2's release plan, *The appetite*). None has started, and none has a plan.

| Item | Issue | Status |
|---|---|---|
| Sprint 150 — Search: the meaning layer. Enter asks the AI's small model for the best places and an answer, with the word results kept when there's no AI | [#591](https://github.com/ProductoryHQ/ritemark-native/issues/591) (part) | Not started |
| Sprint 151 — AI on your own computer. Settings' AI on this computer sets up Ollama and a model that fits; the picker gains "On this computer" | [#534](https://github.com/ProductoryHQ/ritemark-native/issues/534) | Not started. On 15 November local models were named as needing their own plan first |
| Sprint 146 PR 5 — a task card in a dialog over the board | [#598](https://github.com/ProductoryHQ/ritemark-native/issues/598) | Not started. It has no approved drawing, and it needs a security review of its own, since a card file may come from someone else's folder |
| Sprint 147 PR 4 — the skills, connectors and plugins each AI can use | [#415](https://github.com/ProductoryHQ/ritemark-native/issues/415) | Not started |

### Not yet in a sprint

- **#701, an easier Cloudflare setup for Publish:** the 15 November study recommends Cloudflare's own sign-in (OAuth with PKCE) for 2.3, keeping the token as a fallback (`releases/v2.3.0/analysis/2026-11-15-publish-host-701.md`). No plan.
- **#497, the Word spike:** on the v2.3.0 milestone; its runs need Jarmo's own signed-in AIs (15 November).
- **The skip path** waits for the 20 November cohort read (15 November).
- **Excel's charts and colour rules** are the next Excel step, after Sprint 158 (Jarmo, 15 November); which release carries them is not decided.
- **Follow-ups from Sprints 159 and 160,** filed on 16 November (#741–#748), are on no milestone.

## Separated from 2.3

Jarmo, 17 November: "Gamma kleepimise võid reliisist eraldada. samuti 7. (What changes, undo). Hoopis olulisem on teemad" (you can separate Gamma paste from the release, and 7, What changes and Undo, too; themes matter much more).

- **Paste from Gamma and other HTML** (Sprint 161 PR 4).
- **See what changed and Undo on a finished comment task's card** ([#767](https://github.com/ProductoryHQ/ritemark-native/issues/767)).

## Open for the release

- **Is Decks on in 2.3?** Jarmo's call. Decks has been on `main` since Sprint 159 PR 2 (#735), behind `ritemark.features.decks` and off by default. Even with the flag off, 2.3 changes every Text document: tables you can change (#772), the picture editor with the old resize gone (#774), pictures from ChatGPT (#800), Tabs (#805), Button (#806), the code block's Copy (#804), the / menu's hidden words (#802) and sentence case (#811), and popups that close on an outside click (#759).
- **The thesis and the scope,** above: which of *Moved in from 2.2* and *Not yet in a sprint* go into 2.3, and whether Sprint 161's PR 5 does.
- **#507** (⌘⇧P sometimes does nothing on Home), never reproduced, was closed as not planned on 19 November (Jarmo: "#507 sulge"); it reopens on a sighting.
- **The release notes** are being started (`docs/releases/v2.3.0/release-notes.md`), with the `release-notes` skill. The CHANGELOG's `[Unreleased] — v2.3.0` has sections for Sprints 158, 160 and 162 only; Sprints 159, 161 and 163 and most of the work outside sprints have no lines yet. Sprint 159's plan kept Decks out of the CHANGELOG and the notes while it is behind its flag, but Sprint 162's section is there, marked "(Decks, behind its flag)": which rule holds follows from the flag call.
- **The milestone:** it gained its first issues from the v2.2.0 sweep on 19 November (see the header). From Sprint 164 on, each PR gets an issue on it.
- **The test checklist,** `docs/releases/v2.3.0/TEST-CHECKLIST.md`, started on 16 November, has rows from Sprints 159, 160 and 162 and from some of the work outside sprints (filed under 159). Sprint 158's Not run rows are added with the candidate, as its header says. Sprints 161 and 163 and most of the work of 17 to 19 November have no rows yet. The candidate's table, the Gate 1 and Gate 2 rows and the sign-off come when the candidate is built.
- **`qa-validator` on Sprint 163** ran on 19 November as part of the repair: **PASS**, with one documentation gap (the code block's row in `architecture.md`), added in the same PR as this plan. Sprints 158–162 got no `qa-validator` run either; from Sprint 164 on it runs at every sprint's end.
- **Sprint 164** approved on 19 November and done the same day: PRs #819, #821 and #858 merged, the leftovers' removal is #892, and `qa-validator` signed off (see the Sprints table).
- **The release candidate's date** is not set.

## Risks

- **Windows:** Sprint 159's close-out says nothing of Decks ran on Windows, no Sprint 163 PR ran there, and #703 still needs a Windows cold start.
- **Reviews without Codex:** Codex's automatic review stopped at the account's usage limit on #731 and #738, and on every PR from #787 to #811 (17 to 19 November). Those PRs had `REVIEW.md`'s own review only.
- **The bundle:** `media/webview.js` grew by about 258 KB with Decks for everyone (Sprint 159), and whether a document now opens more slowly hasn't been measured (TEST-CHECKLIST row 12).
- **Not yet tried for real,** by Sprints 159 and 163's close-outs: a deck published to Cloudflare, the page on a real phone and in Safari and Firefox, a projector, and the two Open in links.

## Gates

- **Gate 1** on the arm64 candidate, as 2.2.
- **Gate 2** on x64 and Windows.
- **Notarization** after the 60-minute hardening window; **publication** on Jarmo's word.

## Decisions

| Date | Decision | Who |
|---|---|---|
| 2026-11-11 | #702 (links in a table published to Google Docs) and #696 (the sheet's second sign-in) go into 2.3 | Jarmo ("GDocsi asi 2.3'e"; "2.3") |
| 2026-11-15 | Two streams, Decks and 2.3; Decks goes first when they compete, except Excel's save notice; 2.3 starts now with everything except the skip path, which waits for the 20 November cohort read | Jarmo ("jah, esimene versioon sobib, Decks ette, kirjuta plaanid") |
| 2026-11-15 | Sprint 158 approved, with the Excel mockup's six decisions | Jarmo ("jah, kustuta ja Exceli plaan on kinnitatud") |
| 2026-11-15 | Sprints may start once the Development manager and the Experience lead agree; 2.3's other scoped work runs too, not only Excel | Jarmo ("tore! ja võid alustada sprints ise kui olete Experienciga yhel meelel"; "ja release 2.3 sees tehtagu muud skoorid olnud asjad ära! mitte ainult Excel") |
| 2026-11-15 | Sprints 159 and 160 approved | The Experience lead and the Development manager, on that delegation |
| 2026-11-16 | Two Decks changes for 2.3: New → Deck opens the deck at once; the handout is a Text document | Jarmo ("jah, ehita alguskaart ka"; "jah, ehita tekstiosa nii -") |
| 2026-11-17 | Sprint 161 approved; no private notes field, comments hold anything private | Jarmo ("jah, alusta Sprint 161, peidetud sõnad märkmetesse sobib"; "ärme alguses üldse tee privaatseid märkmeid!") |
| 2026-11-17 | 2.3's scope: Gamma paste and #767 separated from the release; themes matter more | Jarmo (above) |
| 2026-11-17 | Sprint 162 approved | Jarmo ("kinnitan") |
| 2026-11-18 | Overnight grant 1, for the night of 17 to 18 November | Jarmo (above) |
| 2026-11-18 | Overnight grant 2, until the morning of 19 November; the workbook page is a new sprint plan and needs his own yes | Jarmo ("aa nyyd saad vabalt arendada kuni hommikuni") |
| 2026-11-18 | Sprint 163 approved | Jarmo ("ja kindlasti tee öösel ära ka muudatused published versioonis samuti siis uued blokid jne mida experience saatis") |
| 2026-11-18 | The night runs as the last one: the Development manager decides, Jarmo reviews in the morning | Jarmo ("jah. nagu eile öösel - sina oled boss. ma hommikul vaatan yle") |
| 2026-11-19 | The older deck tools don't ask for approval in Ask mode | Jarmo ("ei, vanemad tööriistad ei pea Küsi-režiimis luba küsima") |
| 2026-11-19 | The process drift is repaired before Sprint 164 starts: this release plan and Sprint 163's plan in this repo, Sprint 164's plan through `sprint-manager`, `qa-validator` on Sprint 163, the release notes, the v2.2.0 sweep, branches and issues per sprint, the process model fixed | Jarmo ("enne ma tahan et sa jälgiks juba korra kehtestatud reeglistikku... kas on veel drifte?"; "jah, tee need parandused enne sprinti 164") |
