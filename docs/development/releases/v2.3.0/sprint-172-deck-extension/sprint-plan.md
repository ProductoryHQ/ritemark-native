# Sprint 172: decks get their own extension, `.rtms`

Track: SDD (eleven numbered requirements across the extension, the Mac app's file type and the Windows installer, with old files that must keep working). Override with: "use plain full track".
Branch: `sprint-172-deck-extension` (PR branches `sprint-172-deck-extension-pr1` to `-pr3`); this plan is on `sprint-172-plan`.
Release tier: **shell** (the Mac app's file type and the Windows installer's association; no VS Code patch changes). 2.3 is a shell release anyway.
Status: **Merged, 21 November 2026.** PRs #949, #951 and #952 landed for 2.3.0. Jarmo approved this plan in his own words on 21 November 2026 ("kinnitan"), after his yes to the direction the same day (`.rtms` in 2.3, issue #940). Question 5 below is approved with the plan, as the plan assumes it (yes).

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`: decision 1, decision 10, "The file", "The editor", item 20), as the Experience lead updated it in ritemark-dev 765e122.

## SDD artifacts
- [spec.md](spec.md): the behaviour contract, R1–R11
- [scenarios.md](scenarios.md): 30 examples, the test and manual matrix
- [technical-plan.md](technical-plan.md): how it lands, five workstreams
- [tasks.md](tasks.md): the checklist
- [research/rtms-audit.md](research/rtms-audit.md): the audit on `origin/main`, every file, and the proof plan
- [sprint-plan.md](sprint-plan.md): this file

## Goal
A deck is a file of its own kind: `<name>.rtms`, named "Ritemark Deck" and drawn with the deck badge in Finder, with the deck icon in Explorer, always opening in Ritemark as a deck, while every `.deck.md` made before keeps working under its own name.

## What the audit found
- **No patch changes.** The Mac's document types come from upstream `build/lib/electron.ts` through `@vscode/gulp-electron`, which can't declare an exported type or its badge, and would force an icon file over the system-drawn page. So a release-only script stamps the type into the built app's `Info.plist`, beside the existing version stamp, before provenance and signing. A dev build never claims the type. Patch 018 already splits `Talk.rtms` into "Talk" and a muted ".rtms".
- **One rule.** `src/decks/deckFileName.ts` becomes the only place that knows a deck's name; about 38 files change to call it.
- **A trap a deck avoids today only by ending `.md`.** The editor's sync (`DocumentSyncCoordinator.isEditable`) handles only Markdown and CSV endings; a `.rtms` without it would open with its edits, AI writes and saves unhandled. Search, links, the chat's links, the sticky-tab healer, the folder counts and a Flow's text input are the same kind of check (audit §2).
- **Changes in all:** about 45 source files in the extension (with `package.json` and the icon theme) plus their tests, about 11 in the shell (scripts, two workflows, the installer, `product.json`, the two icons, CLAUDE.md's list and the preflight's copy), the demo project's seven renames, and the docs.

## Feature flag check
- Needs a new flag? No. `ritemark.features.decks` stays the off switch (decision 10). Off, a `.rtms` opens in the Ritemark editor as an ordinary document, as a `.deck.md` does today. The Mac's and Windows' file type is not behind the flag: the file is a deck whatever the setting, and Ritemark opens it either way.

## Linked issues
[#940](https://github.com/ProductoryHQ/ritemark-native/issues/940) is the sprint's. One issue per PR in milestone v2.3.0, each linked to #940; the last PR's merge closes #940.

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-172-deck-extension-pr1` | The one rule and every place that names a deck; the editor selector, the language, the icon theme; the Markdown checks; the DECKS instructions and deck tools; the demo project; the live Claude and Codex proof | High (`src/editorSync/` and `ritemarkEditor.ts`: saving a person's documents) |
| 2 | `sprint-172-deck-extension-pr2` | The Mac's file type: the runner proof first, then the stamp script in both macOS builds, the badge, the Gate 1 check, `product.json`'s association, the shell-tier list | High (shell-tier paths and a workflow) |
| 3 | `sprint-172-deck-extension-pr3` | Windows: the installer's `.rtms` association and icon, the CI round trip's probe | High (shell-tier paths) |

## Order and overlap
- PR 1 first: it is what people use inside Ritemark and can be proven fully in a test window. Merged alone, a `.rtms` works in every Ritemark surface; Finder and Explorer just don't know the kind yet.
- PR 2 next, starting with its proof workflow. The runner answers the one unknown (the badge's form) before the build is wired.
- PR 3 can run beside PR 2 once the Experience lead has drawn `deck.ico`; their files are apart (`ritemark.iss` and the Windows probe against the macOS scripts).
- All three merge before the 2.3 RC is built.

## Risk and How to revert
- **PR 1. Risk:** a deck place missed keeps treating a `.rtms` as no deck (it would show as a document, or a tool would refuse it); a Markdown check missed could leave a `.rtms` unsaved, which is why `isEditable` has its own test and the proof edits and saves. Old decks are guarded by the 53 existing tests. **Revert:** revert the PR. Decks made meanwhile as `.rtms` would then open as plain text; rename them to `.deck.md` by hand. No file is ever renamed by the app, so nothing else needs undoing.
- **PR 2. Risk:** a malformed plist stops the app from launching or fails signing; the script fails the build on a missing key, Gate 1 lints the plist, and the provenance step covers it. A wrong badge only changes how Finder draws the file. **Revert:** revert the PR; the next RC has no deck type, and LaunchServices drops it when the app is replaced.
- **PR 3. Risk:** a wrong registry key leaves `.rtms` without an icon or opener, or left behind after uninstall; the CI round trip checks both ways. **Revert:** revert the PR. An installer from the reverted build no longer writes the keys, and uninstalling an earlier install still removes them.

## Removals (HARD RULE #1)
None. `.deck.md` keeps working everywhere; nothing is renamed or turned off.

## Proof
- Inside Ritemark (PR 1): an isolated test window on its own port, decks on in that profile only; launched once, quit at once; Claude and Codex with test keys only through `scripts/qa/with-test-keys.sh`; no sign-in. Shots at 1440×900 for the Experience lead.
- Finder, before Gate 2 (PR 2): the kind, the drawn icon, the opening app, Quick Look and Spotlight, answered by macOS on an ephemeral GitHub runner with a stand-in bundle; on Jarmo's Mac only a bare plist file is stamped and linted, never registered or launched.
- Finder, at Gate 2: only the RC installed in `/Applications` can show the kind, the icon, the double-click, Quick Look and Spotlight on Jarmo's Mac. The TEST-CHECKLIST rows are in the audit's §4.
- Windows: before Gate 2, the CI install-uninstall round trip probes the registry; at Gate 2, Explorer's icon and a double-click on a Windows PC.

## Success criteria
- [x] New → Deck makes `Untitled.rtms`, and the lists show ".rtms" muted with the deck's icon — met in PR #949 (`newDeck.ts`, the icon theme and [the new-deck screenshot](proof/pr1/1-new-deck-untitled-rtms.png)).
- [x] A `.deck.md` made before opens, saves and publishes as a deck and keeps its name — met in PR #949 (`deckFileName.ts`, `deckMode.ts`, `DocumentSyncCoordinator.ts` and `deckPublish.ts`; see [the older-deck screenshot](proof/pr1/2-old-deck-md-opens-as-deck.png)). The RC's live publish check is row 24q.
- [x] Decks off opens a `.rtms` as an ordinary document that saves — met in PR #949 (`deckMode.ts` and `DocumentSyncCoordinator.ts`; see [the saved document](proof/pr1/3-decks-off-rtms-as-document-saved.png)).
- [ ] Claude and Codex in Ritemark read and edit a `.rtms` deck — live proof was not run because the isolated profile had no test credentials. PR #949 updated the shared deck tools and write path. RC row 24s covers the live check.
- [x] The runner proof shows the kind "Ritemark Deck", the system page with the deck badge and DECK, Ritemark as the opener, Quick Look's text and Spotlight's words — met by PR #951's [runner evidence](proof/pr2/).
- [ ] The RC's plist passes Gate 1's check; a dev build declares no deck type — PR #951 records the dev check and adds the Gate 1 validators. The [stand-in bundle passed the stamp check](proof/pr2/run2-asset-catalog/stamp-check.txt). The RC result is unverified here and belongs to row 24t.
- [ ] The Windows round trip registers and removes `.rtms` — PR #952 implemented the association and the CI probe. The [mock results](proof/pr3/probe-mock-results.txt) cover both states. The candidate's Windows install and uninstall result is unverified here and belongs to row 24y.
- [ ] The Experience lead has seen each PR's shots before it merges — met for PR 1 (OK on `a711effa`) and PR 2 (OK on `9c68d421`), as their Review records say. PR 3's icon is the lead's own drawing (`deck.ico`'s frames match the lead's PNGs pixel for pixel), but its look in Explorer needs a PC: row 24z at Gate 2.
- [ ] The full test chain ran once on each final head and `qa-validator` signed off at sprint end — the chain: EXIT 0 on each PR's final head (their Review records). `qa-validator` ran on 21 November and found the close-out gaps this paperwork closes; its sign-off follows once this lands.

## Release notes
One line, in Make slides, written with the `release-notes` skill (decks are new in 2.3, so the file's own kind reads as news only as "it opens from Finder"):
- **Open a deck from Finder or Explorer.** A deck is its own kind of file, with its own icon. Double-click it, and it opens in Ritemark as a deck.

## Questions
For the Experience lead:
1. **The Windows icon.** Windows draws no page with a badge, so `deck.ico` is a drawn icon. Is it a page with the deck icon and DECK, like the Mac's, and at what weight? Sizes 16 to 256.
2. **The badge.** The plan uses Phosphor's `presentation`, the deck icon of the tabs, Documents and Search (the Slide library place keeps `cards-three`). Regular or bold weight at badge size?
3. **A copy of an old deck.** The plan names a copy of `Training.deck.md` `Training (copy).rtms`, since it is a new file. Agreed?
4. **Windows registers `.rtms` always,** not behind the unchecked "Associate with .md files" box, since Ritemark owns the type. Agreed?

The Experience lead answered all four in the decks spec (ritemark-dev 4b3fad1): (1) `deck.ico` is drawn by the lead in `product/design/experience/experiences/decks/file-icon/`; (2) the badge is Phosphor `presentation`, bold, in #4338ca; (3) yes, a copy is `X (copy).rtms`; (4) yes, Windows registers `.rtms` always.

For Jarmo, with the approval:
5. The Mac's type and Windows' association are not behind `ritemark.features.decks`: a `.rtms` is a deck file whatever the setting, and opens in Ritemark either way. The plan assumes yes. Approved with the plan on 21 November 2026.

## Approval
- [x] Jarmo approved this sprint plan in his own words on 21 November 2026: "kinnitan" (in the Development manager session, answering the ask for this plan's approval).
