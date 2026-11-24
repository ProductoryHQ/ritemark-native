# Release Plan — v2.4.0

**Status:** **Open for development, 22 November 2026.** Jarmo said “võiks avada 2.4 ja lasta Codexil teha mingeid parandusi” and followed with “avad releasei arenduseks”. 2.3.0 was published on 23 November 2026, so `main` is no longer frozen; the held 2.4 PRs merge one at a time from 24 November.<br>
**Target:** v2.4.0<br>
**Milestone:** v2.4.0 (GitHub milestone 20)<br>
**Tier:** Shell because #953 touches the build and #954 touches the Windows installer.<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64 and the Microsoft Store.

## Release Thesis

**In public**, approved by Jarmo on 22 November 2026 (“approved thesis”):

> Ritemark 2.4 works with the Word and Excel files you already have: ChatGPT and Claude read a folder of Word documents with you, and a workbook shows its charts and colours as it does in Excel.

**Inside the team:**

> 2.4 is the release for the files people already have: every AI reads a folder of Word documents, and a workbook looks as it does in Excel, charts and colours included. Beside it, 2.3's Decks without rough edges.

## How 2.4 is built

The release shape is in `ritemark-dev` at `releases/v2.4.0/shape.md`.

- **The flagship.** Word and Excel’s next step are shaped with the Experience lead. Each needs its own sprint plan under this release and Jarmo’s approval before implementation.
- **The fixes.** Decks and harness fixes go first, one issue in the v2.4.0 milestone per PR, mostly built by Codex. Each PR gets reviewed at the tier set by its changed paths. [REVIEW.md](../../../../REVIEW.md)

## Sprints

Sprints are to be numbered when planned.

| Sprint | Issues | Scope | Status |
|---|---|---|---|
| Word folder, ready for any AI | #497, #547 | ChatGPT, Claude and OpenCode read the folder’s Word documents and PDFs. A Word document or PDF gets its own starting points once every AI passes the reading test. Word equations come through as math. Answers name sources in the sentence and link those names to the passages read (Jarmo’s choice C). Experience 50, drawn 22 November. | Drawn; sprint plan not written |
| Excel charts and colour rules | #971 | Charts appear where they sit and colour rules colour the cells as in Excel. Experience 47, step 2. | Drawn; sprint plan not written |

## Work outside sprints

| Issue | What it does | PR or status |
|---|---|---|
| #947 | Place the start card right under the handout’s first part. | PR #958 |
| #948 | Correct what the start card says. | PR #957 |
| #950 | Keep a long bar note from squeezing the bar. | PR #977 (draft) |
| #946 | Put the text bubble above the chosen words. | No PR yet |
| #927, #983 | Count a deck’s words in the status bar. #983 (RC4 smoke test) is the same fault. | PR #962 |
| #910 | Make a box’s icon accessible from the keyboard. | No PR yet |
| #920 | Open a deck from its row in the Slide library. | No PR yet |
| #919 | Keep the theme on the printed page and in the PDF. | No PR yet |
| #953 | Show a deck’s first slide in Finder. | No PR yet |
| #966 | Make runtime checks fail when they can’t check. | PR #973 |
| #968 | Give the published page’s buttons names on a phone. | PR #970 |
| #980 | Keep a picture’s bar at size S off the paragraph below it. | No PR yet |
| #981 | Keep the Slide settings popup off the slide’s title. | No PR yet |
| #982 | Keep a table cell’s right-click menu inside the window. | No PR yet |
| #984 | Show Claude’s own mark on its tile in Settings ▸ AI accounts. | No PR yet |
| #934 | Get the frame screenshots through the Slide library. | No PR yet |
| #954 | Leave another app’s defaults alone when uninstalling on Windows. | No PR yet |
| #924 | Apply a place’s default in a fresh frame. | No PR yet |
| #582 | Address a noisy log line. | No PR yet |
| #501 | Address the first start after an update on Windows. | No PR yet |

## Out of 2.4

The meaning layer (#591) moves to a later release with its own sprint plan. Jarmo, 22 November 2026: “tähenduskiht hilisemaks”.

## Risks

- **Reading test.** #497 needs a launched app and live AIs, with three runs per AI on Mac and Windows using the test folder plus a password-protected document and a PowerPoint deck with one slide that has no speaker notes (on 2.3, Claude reading a .pptx with its own tools gave slide 5’s notes to slide 4). The remaining Claude and OpenCode runs need test keys. Windows runs are planned for Gate 2.
- **Flagship scope.** Word and PDF reading across three AIs, passage links and Excel’s charts and colour rules make up two sprints that still need plans.

## Gates

- **Gate 1** on the arm64 candidate.
- **Gate 2** on x64 and Windows.
- **Notarization** for each macOS candidate after its gate clears and the 60-minute hardening window elapses.
- **Publication** on Jarmo’s word.

## Decisions

| Date | Decision | Who |
|---|---|---|
| 2026-11-22 | Open 2.4 for development. | Jarmo (“võiks avada 2.4 ja lasta Codexil teha mingeid parandusi”, “avad releasei arenduseks”) |
| 2026-11-22 | Run both streams, with Word as the flagship and Excel’s next step alongside it. | Jarmo (“Nii A kui B korraga, Wordi osa on peaaegu flagship. Midagi oli ka Excelis teha veel.”) |
| 2026-11-22 | Approve the release thesis. | Jarmo (“approved thesis”) |
| 2026-11-22 | Move the meaning layer (#591) to a later release. | Jarmo (“tähenduskiht hilisemaks”) |
| 2026-11-22 | Choose way C for sources in Word folder answers, naming and linking sources in the sentence. | Jarmo (“C kuigi D on hea. Siis C aitab meil võrrelda end Notebook LMiga”, relayed in his words by the Experience lead) |
| 2026-11-23 | File the RC4 smoke test’s findings as 2.4 issues (#980–#984). | Jarmo (“jah”) |
