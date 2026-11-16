# Sprint 157: Decks, first cut (experience 46)

Track: Full (a new subsystem: a deck mode in the Markdown editor, a new place in the left column, a new tool group)<br>
Release tier: extension, except `branding/product.json` (the Slide library place), which is shell-tier by path. Nothing reaches users in this sprint: the work stays on its own branch behind the flag `ritemark.features.decks` and is **not merged to main** (Jarmo, 14 November 2026). Before it ever merges, patch 002 has to give places a flag `setting`, or the flag goes stable (technical plan, section 3). That is a later decision.<br>
**Status:** Approved by Jarmo on 15 November 2026 ("decki sprint plaan kinnitatud"), after the Experience lead's read against the prototype (answers merged below). Phase 3 starts on this branch.<br>
**Approval:** Jarmo. He approved the first cut's content and that Decks goes first on 15 November ("jah, esimene versioon sobib, Decks ette, kirjuta plaanid"). He approved this plan on 15 November ("decki sprint plaan kinnitatud").<br>
**Branch:** `sprint-157-decks`, in its own worktree with its own VS Code tree at the recorded pin. Main is merged in after each 2.3 merge (technical plan, section 7).<br>
**Spec:** experience 46, Decks: ritemark-dev `product/design/experience/experiences/decks/README.md`, and its prototype (`prototype.html`, the private artifact the README links).<br>
**Technical plan:** [technical-plan.md](technical-plan.md).<br>
**Not release-bound** (no version folder), so it sits under `docs/development/sprints/`.

## Why

Jarmo's own trainings. A deck is put together from earlier decks, over 80% of theory slides are reused, and the time goes into finding them. In Gamma his agent can't write a slide or copy one between decks. This cut gives him a deck as a file in his project, a slide library he takes copies from, and Claude working on the same files.

## What Jarmo can do in rundev after this sprint

- **Open a `.deck.md` as a deck.** Numbered thumbnails on the left, one slide large in the middle, and the handout beside it. Scrolling the handout changes the slide, and choosing a thumbnail scrolls the handout to its part. Writing in a part makes its slide the current one. Speaker notes fold open under the slide.
- **Change a slide.** Type on the slide. Pick its layout from nine kinds and its look in Settings beside the slide; the words stay, and nothing runs off the slide. Paste or drop a picture onto it. Add, reorder, duplicate, skip and delete slides in the strip, with undo. Choose Card or Borderless for the deck.
- **Take slides from the Slide library,** a place in the left column like Documents and Tasks. It holds one deck per topic, plus his other decks. A slide comes in as a copy. If he changes it, the line under the slide offers Keep it here and Update the library, and the library changes only when he presses Update the library. Another deck using that slide then shows that the library has a newer version, with Use it.
- **Ask Claude** (or ChatGPT or OpenCode) to find slides in his decks and the library, insert them after a given slide, update a library slide or add a slide to the library, through the same operations as the buttons.
- **Optionally, start a deck** from New: empty, or as a copy of an earlier deck.
- **With the flag off,** a `.deck.md` opens as an ordinary document and nothing else changes.

## Not in this cut

These come later, in this order unless Jarmo says otherwise:

1. Claude adapts a whole deck, with See what changed and Undo per reply.
2. Theme editing in its own tab, saved with Save. A saved change reaches the decks made earlier (Jarmo, 15 November).
3. A line in the handout (`***` or `---`) makes a new slide whose heading is its title. The new slide waits for its layout until he asks Claude (Jarmo, 15 November: "nagu praegu - las ootab"). Until then a typed line stays a line inside its part and can never break the file (technical plan, section 5).
4. Slide cards in the chat (frame 2), with Insert and drag into the strip. In this cut Claude works through tools and answers in words.
5. Publish of the handout page, Present on the wall, and bringing a deck in from Gamma.
6. The start page on the desk (frame 1). This cut's New → Deck is a quick pick.

## Decided in this plan

- **The deck is a mode of the one Markdown editor, not a second editor.** This keeps save conflicts, the reload merge and undo working as they do for documents, and keeps it out of the VS Code patches (technical plan, 1.1).
- **The Slide library sits in the row** through `branding/product.json` (Option A), as Jarmo asked ("like Documents and Tasks"), not hidden in More. It is shell-tier only by path, and only on the branch.
- **One theme, the prototype's Evening, not editable** (the Experience lead, 15 November). It is the prototype's `THEMES.evening` with its x and xl shades, saved as `Slide library/Themes/Evening.theme.md`. The deck's `theme:` names it, and a missing theme file draws the built-in copy.
- **The deck's bar has no Publish, Present or theme button in this cut,** not even greyed out (the Experience lead).
- **Both looks, Card and Borderless,** are the deck's own choice. Jarmo asked for both on 15 November ("et mõlemad oleks valikus").
- **The tools include Update the library and Add to library,** because the buttons do (decision 9, dual use: "ma üldiselt eelistan alati dual-use'i"). Claude changes the library only when the person asks.
- **No approval prompt for Claude's deck writes**, as for the task board. Inserting only adds, and the library changes only on request. OpenCode in Ask mode still asks before every tool, because changing that is permission code.
- **Rundev runs from the sprint worktree's own VS Code tree** at the recorded pin with the canonical patches. The main checkout's `vscode/` is at an old commit without the frame.

## The Experience lead's answers (15 November)

The Experience lead read this plan against the prototype and the README on 15 November. The prototype and the README were changed to match the answers on Q2, Q7 and Q9 (ritemark-dev 862230f). Where an answer differs from the [technical plan](technical-plan.md), the answer wins. The technical plan's 1.5 stamp, 1.6 theme, PR 1's part heads and PR 4's notes are read with these answers.

1. **The file's keys:** as the technical plan proposes, plus `subtitle` and `number`. The notes block comes directly after its slide block.
2. **A library copy brings the slide and its handout, never speaker notes,** because the library holds none.
   - Update the library writes the slide and its handout, so a change to the handout counts as a change.
   - The stamp covers the handout too, with paths resolved to project-relative. A copy whose paths were rebased therefore doesn't show as changed when it arrives.
3. **The place goes after Tasks,** with a books-on-a-shelf icon.
4. **On a narrow desk:**
   - below about 900 px, the strip folds and the slide and the handout split 60:40;
   - the handout is never narrower than 300 px;
   - below 600 px, the handout folds.
5. **+ between thumbnails** opens the prototype's small menu. It doesn't add a Points slide.
6. **Delete** takes no question and has Undo.
7. **A copy changed here when the library also has a newer version:** the line says both. Update the library over a newer version, and Use it over a change made here, each get Undo.
8. **The part heads' titles can be edited.** They are the same title as on the slide. The fallback, if that proves too hard in PR 1, is a read-only title that a click takes to the slide's title.
9. **The scroll rule's line:** 0.28, as in the prototype.
10. **A typed line in the handout** shows one quiet hint: "In this version a line stays a line. Add a slide with + between the thumbnails."

**The Experience lead also found six places where the plan differed from the prototype:**

1. **The lines under the slide.** The technical plan's 1.5 misses three of the prototype's lines under the slide. The full set is the prototype's `underLines` (`prototype.html:1097-1114`, after the 15 November change), and PR 4 builds all of them.
2. **The theme:** Evening (see "Decided in this plan").
3. **The bar** has no Publish, Present or theme button (see "Decided in this plan").
4. **Claude's `insert_slides` into an open deck is one undo step,** the way a writer's change is. PR 5 sends the tool's write through the path that the open deck applies as one merge step. If that turns out not to be possible, PR 5 says so before it merges, and inserted slides are then taken out with Delete and its Undo.
5. **The speaker notes placeholder** drops "and in the presenter view".
6. **A fenced code block in the handout shows Copy,** as in documents. The checklist checks it.

## PRs

All six target `sprint-157-decks`. The technical plan gives each one's files and what Jarmo can try after it.

| PR | What | Review tier |
| --- | --- | --- |
| 1 | The deck file and the deck view's frame: the flag, the format, the mode, the handout, the strip with titles, the scroll rule | High (`ritemarkEditor.ts`, `editorSync/protocol.ts`, `App.tsx`) |
| 2 | The nine kinds, fitted; words typed on the slide; tables; icons; notes; Card and Borderless | Standard |
| 3 | Settings beside the slide; the strip's +, drag and menu; pictures | Standard |
| 4 | The Slide library place: insert a copy, Keep it here, Update the library, newer version, Add to library | High (`branding/product.json`) |
| 5 | Claude's deck tools in the single registry, and the DECKS guidance | Standard (agent lifecycle tests) |
| 6 | Optional: New → Deck, empty or a copy | Standard |

Every PR gets `REVIEW.md`'s review at its tier, with a Review record comment, before it merges into the branch. No PR merges to main in this sprint.

## Tests

The unit tests and the twelve-step rundev checklist are in the technical plan, section 8. The first check in every round is that a `.deck.md` with the flag off opens as a document and saves byte for byte. The `media/webview.js` conflict on each main merge is solved by rebuilding, never by hand.

## Risks

The full list is in the technical plan, section 9. The three that can change the plan:

- **The flag-off first frame:** a Slide library placeholder may appear on a fresh profile with the flag off. That is fine on the branch, but it must be fixed in patch 002 before any merge.
- **Fitting against real fonts:** a measuring pass steps a box down a size when it still overflows.
- **Drag between webviews is not proven.** Click Insert is the path that is promised; drag is a stretch goal.

## Afterwards

When the cut has worked in Jarmo's own trainings, he decides whether it merges behind the flag and in which release. At that point patch 002's place `setting` (or a stable flag) and `architecture.md`'s Decks section are part of that merge.
