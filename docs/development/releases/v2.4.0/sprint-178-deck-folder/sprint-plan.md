# Sprint 178 · A deck's own folder

**Draft 26 November 2026** · Full track (a VS Code patch makes it shell-tier) · Branch `sprint-178-deck-folder` once approved.

Parent release: v2.4.0 if Jarmo puts it there; otherwise it moves to v2.5.0 unchanged. Jarmo's testing note of 26 November says "one slide can populate a lot of folders into project folder --- this is not good". He answered the Experience lead's recommendation with "jah, teeme nii".

## The spec

The Decks README section "A deck's own folder (26 November)" in `ritemark-dev` (`product/design/experience/experiences/decks/README.md`, commit bd2f206) is what this sprint is checked against. In short:

- **R1 · One folder per deck, named after it.** `Kickoff files/` sits beside `Kickoff.rtms` and holds everything the deck makes. That covers pictures pasted, made by an AI or chosen from a file, the handout page `Kickoff.html`, and the page's `fonts/` and `logos/`. Pictures sit at the folder's top.
- **R2 · Only when needed.** A new deck makes no folder. Neither does a deck with no pictures that was never published.
- **R3 · Folded under the deck** in the Documents tree. The deck's row gets a chevron, closed by default, that keeps the person's last choice. Search, Home's Last changed and the Slide library list the deck, never the folder's files as documents of their own.
- **R4 · Moves with the deck in Ritemark.** Renaming the deck renames its folder and rewrites the deck's links. Moving the deck to another folder takes the folder along. Deleting the deck to the Trash takes the folder with it, and Delete asks once for both. Duplicate copies both (`Kickoff (copy).rtms` with `Kickoff (copy) files/`). A rename in Finder or Explorer leaves the links working, because they name the folder, not the deck.
- **R5 · Decks made before.** Their pictures stay where they are and their links keep working. New pictures go to the deck's folder. Ritemark's own page, fonts and logo move into the deck's folder at the next Publish, only the files Ritemark wrote, and the published link stays the same.
- **R6 · The words.** The picture bar says "It's in Kickoff files." where it said "It's in images/". Publish's line for a taken name names the deck's folder.
- **R7 · Documents keep `images/`,** one per folder, as today.

## What the code does today (survey of 26 November, main 3b8a0f7d)

- **One writer for deck pictures.** `src/decks/deckPages.ts` `savePicture` (~:934) answers `deck/save-image`, and three senders in `DeckView.tsx` use it: paste or drop on a slide, the Slide settings picker, and several pictures dropped on the strip. The folder `images` is hard-coded (~:939) and the link comes back as `images/<file>`. Links are relative to the deck's folder, in the slide header `image:` or as `![](images/x.png)`.
- **ChatGPT pictures** for documents and decks alike go to `path.join(documentFolder, 'images')` (`src/pictures/chatgptPicture.ts` ~:273). The host picks the link form by `request.slideId` (`chatgptPictureHost.ts` ~:188).
- **No import copies pictures.** PowerPoint import, the Slide library and "copy of an earlier deck" only rewrite paths (`rebaseSlide`).
- **Publish writes beside the deck.** `src/decks/page/pageFile.ts` writes `<deck>.html` (`pagePathFor` ~:72, create-only with take-back), and `writePageFonts` (~:539) writes `fonts/` and `logos/`, also create-only with take-back. The publish record is keyed by the page's real path (`src/publish/publishRecords.ts`), and its header says a moved page loses its record. Gather sends files relative to the common folder of what it gathered (`gather.ts` ~:365).
- **Rename.** A rename in Ritemark runs `rebaseMovedDecks` (`src/decks/decksHost.ts` ~:191), which rewrites picture links and moves no files. Nothing handles delete or `onWillRenameFiles`.
- **Nesting.** `explorer.fileNesting.*` is set nowhere. VS Code's nester only folds files: `explorerModel.ts` (~:337) splits children into files and folders and nests only the files. A collapsed nested parent carries its children in drag, cut, copy and delete (`explorerService.ts` `getContext` ~:194, `explorerViewer.ts` `handleExplorerDrop` ~:1876). An expanded one doesn't.

## The Development manager's technical answers

1. **The fold is a patch (the lead's choice A, 26 November).** Patch `023-ritemark-deck-folder-nesting` changes the nester in `explorerModel.ts` with one rule only: a folder named exactly `<capture> files` folds under `<capture>.rtms` in the same folder. The rule is not a setting and not a pattern language. VS Code's own file nesting stays as upstream has it (off in Ritemark). The fold is collapsed until the person opens it, and the tree's usual view state keeps their choice. Upstream already carries nested children with a collapsed parent in drag, cut, copy and delete, so the patch borrows that. **Size limit:** the patch stays in the nester and the explorer item, about 60 changed lines. If it needs more (the drop target, compressed folders, or the tree renderer), the PR stops and goes back to the lead, whose fallback is (B): the folder beside the deck, nothing hidden.
2. **An expanded deck moved in the tree.** When the deck's row is open, upstream moves only the deck. Ritemark's handler then catches it, on `onDidRenameFiles` for a move or rename and on `onDidDeleteFiles` for a delete. It moves `<old> files` to `<new> files`, or to the Trash with `useTrash`, if that folder exists beside the old name and the new name is free. A taken name leaves the folder where it is and the links unchanged, and says so once. A move from Finder or Explorer outside Ritemark changes nothing (R4's last sentence).
3. **Links.** New links are `Kickoff files/x.png`, written in the form the deck format already uses for a path with a space, in both the `image:` header and a Markdown picture. PR 2 starts with a round-trip test of both forms before it changes the writer. A rename rewrites only links that point into the deck's own folder, with the existing `rewriteDeckPictures`.
4. **Publish and the same link.** The page, `fonts/` and `logos/` are written into `<deck> files/`. On an old deck's next Publish, the files Ritemark wrote beside the deck are taken back with the existing take-back rules: the page by its meta mark while its bytes are unchanged, fonts and logos by the record. They are then written in the new folder. A file Ritemark didn't write is never moved or deleted. The record moves to the new page path in the same step, and the uploaded file names keep the published link. PR 3 pins "same link on Copy link" in a test before it changes the writer. If gather's common folder would change the page's path on the site, the gather keeps the old relative layout for that record.
5. **Search, Home and the library** skip files inside a `<name> files/` folder that has a `<name>.rtms` beside it. A folder with the same name and no deck beside it is an ordinary folder.
6. **Duplicate.** PR 4 finds every way Ritemark duplicates a deck (the Slide library, "copy of an earlier deck") and makes each one copy the folder and rewrite the copy's links. The Documents tree has no Duplicate of its own, and the sprint adds none.

## PRs

| PR | What | Tier and review | Proof |
| --- | --- | --- | --- |
| 1 | Patch 023, the fold. Collapsed by default, the person's choice kept; the size limit above | High (`patches/`): `/code-review` high + `/security-review`; the patch row in `docs/development/vscode-patches.md` | Fault first: the folder at the top of the tree, then folded under the deck. Light and dark, open and closed. A collapsed deck dragged into a folder carries its folder |
| 2 | New pictures into `<deck> files/`: paste, drop, picker, strip, ChatGPT pictures for slides. The picture bar's words. Documents unchanged | Standard; the picture bar's words to the lead | A new deck has no folder until its first picture. The picture then shows, and its link names the folder |
| 3 | Publish writes into the deck's folder. The old deck's Ritemark files move at the next Publish, keeping the same link. The taken-name line | High (`src/publish/`): `/code-review` high + `/security-review` | An old deck's next Publish: `fonts/` and `logos/` are gone from beside it, and Copy link gives the same link. A file Ritemark didn't write stays put |
| 4 | Rename, move, delete and duplicate follow the deck, for both expanded and collapsed rows. Search, Home and the library skip the folder's files | Standard | A rename in Ritemark, then a picture still showing. Delete, then both are in the Trash. Duplicate, then both copies exist |
| Close | The spec's shots: the tree folded and unfolded, light and dark; Finder with the two side by side; the rename; the old deck's Publish. One short Windows task for paths with spaces and a drive letter (REVIEW.md: Windows before the merge covers file paths) | Light | `research/closing-proof.md` |

PR 1 goes first, because if the patch fails its size limit, R3 changes (option B) before anything else is built. PRs 2 and 4 can be built in parallel once PR 1 is in. PR 3 follows PR 2, because both write into the folder.

## Risks

- **The patch on upstream bumps.** It adds one more patch to carry. It stays small and in one function, with a test in the patch's own folder where VS Code's tests allow it.
- **A name that's taken.** A person's own `Kickoff files/` folder beside `Kickoff.rtms` is used as the deck's folder, and Ritemark only adds files to it, create-only. A name taken by a file stops the write and says so.
- **The published link.** If keeping the link turns out to need a change in the site's own file layout, PR 3 stops and asks before it changes what a published page sends.
- **Expanded-row moves.** If upstream's rename event for a move in the tree doesn't reach the extension before the person sees the result, the folder catches up a moment later. PR 4 measures this.

## Release notes draft

- **Keep a deck's files together.** Pictures and the published page now go into one folder named after the deck. It folds under the deck in your documents.

## Approval

- [ ] The Experience lead checks the plan against the spec (decks README, "A deck's own folder").
- [ ] Jarmo: 2.4 before the release candidate, or 2.5 (the release's scope is his).
- [ ] The Development manager approves after both (Jarmo, 24 November: sprint plans and their questions are the Development manager's). Implementation then starts on `sprint-178-deck-folder`.
