# Release Plan — v2.4.0

**Status:** **Roadmap approved 24 November 2026** ([deck](https://claude.ai/artifact/Lsbc9YDNmC6eWXvYmaZ5H8)); open for development since 22 November. Jarmo said “võiks avada 2.4 ja lasta Codexil teha mingeid parandusi” and followed with “avad releasei arenduseks”. 2.3.0 was published on 23 November 2026, so `main` is no longer frozen; the held 2.4 PRs merge one at a time from 24 November.<br>
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
| 173 · Word folder, ready for any AI | #497, #547 | ChatGPT, Claude and OpenCode read the folder’s Word documents, PDFs and decks through one Ritemark tool; steps name documents; answers name sources in the sentence and link them to the passage (way C); Word equations as math. Each AI gets its own starting points once it passes the reading test (3 of 3). Experience 50. | Approved 24 Nov; [plan](sprint-173-word-folder/sprint-plan.md) |
| 174 · Excel charts and colour rules | #971 (open until 2.4 publishes); PRs #990 (plan), #1026, #1029–#1032, #1034–#1036, #1038, #1039 | Charts appear where they sit and colour rules colour the cells as in Excel. Experience 47, step 2. | Done 25 Nov (code and docs); four follow-ups wait on the Experience lead's Excel renders; closing proof: [research/closing-proof.md](sprint-174-excel-charts/research/closing-proof.md) |
| 175 · The live deck | no issue (roadmap item); PRs #995 (plan), #1003, #1006, #1012, #1014–#1016, #1020, #1022, #1024, #1027, #1028 | A published deck updates on save while its page’s switch is on (layer 1) and open pages follow on the same slide (layer 2); an AI’s edit publishes too when the switch is on; each slide gets its minutes and the deck its total (Experience 51). | Done 25 Nov; S18 and the Windows checks wait for Gate 2; closing proof: [research/closing-proof.md](sprint-175-live-deck/research/closing-proof.md) |
| 176 · Hear from people | #1045 | Thumbs on AI answers, feedback on failures, a window picture in feedback, one open-source card on Home in place of the week’s question, GitHub and Discussions in Help, and saved days across releases. | Planned 25 Nov; frames by 27 Nov |
| 177 · Quick Look for decks | #953 | Finder shows the first shown slide and Space shows the slides when this Mac has a current picture. Otherwise Finder shows the deck icon and Space shows the deck text. | Draft 25 Nov; [plan](sprint-177-quick-look/sprint-plan.md) |

Release notes: each sprint's `release-notes-lines.md`, joined in `docs/releases/v2.4.0/release-notes.md` with the `release-notes` skill.

## Work outside sprints

| Issue | What it does | PR or status |
|---|---|---|
| #947 | Place the start card right under the handout’s first part. | PR #958 |
| #948 | Correct what the start card says. | PR #957 |
| #950 | Keep a long bar note from squeezing the bar. | PR #977 |
| #946 | Put the text bubble above the chosen words. | PR #1059 |
| #927, #983 | Count a deck’s words in the status bar. #983 (RC4 smoke test) is the same fault. | PR #962 |
| #910 | Make a box’s icon accessible from the keyboard. | PR #1069 |
| #920 | Open a deck from its row in the Slide library. | PR #1064 |
| #919 | Keep the theme on the printed page and in the PDF. | PR #1065 |
| #966 | Make runtime checks fail when they can’t check. | PR #973 |
| #968 | Give the published page’s buttons names on a phone. | PR #970 |
| #980 | Keep a picture’s bar at size S off the paragraph below it. | PR #1063 |
| #981 | Keep the Slide settings popup off the slide’s title. | PR #1061 |
| #982 | Keep a table cell’s right-click menu inside the window. | PR #1057 (merged) |
| #984 | Show Claude’s own mark on its tile in Settings ▸ AI accounts. | Closed: the letter C stays (Jarmo) |
| #934 | Get the frame screenshots through the Slide library. | PR #1066 |
| #954 | Leave another app’s defaults alone when uninstalling on Windows. | PR #1071 |
| #924 | Apply a place’s default in a fresh frame. | PR #1070 |
| #582 | Address a noisy log line. | No code change needed; checked again on the release candidate |
| #1051 | Put a table's + bars on its real edges, shown only when the edge is in view. | PR #1058 |
| #1056 | Keep an empty line on a slide after leaving the slide. | PR #1060 |
| #1062 | Put Gemini 4 Neon in place of Gemini 4 Argon in the model lists. | PR #1067 |
| #501 | Address the first start after an update on Windows. | No PR yet |

## Cut line

If 2.4 runs short, drawing the colour rules in Excel’s cells (Sprint 174, PRs 6 and 7) moves to 2.5; the charts stay. Jarmo, 24 November 2026.

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
| 2026-11-24 | Put live publishing in 2.4: five measurements first; layer 1 behind a switch per page. | Jarmo, relayed in his words by the Chief of Staff (“jah, mõõtmised koos viiendaga, alusta kohe ja läheb 2.4”; “Layer 1 is in.”) |
| 2026-11-24 | Approve the 2.4 roadmap (four streams in order; sprint plans and their questions are the Development manager’s), the cut line, and an AI’s edit publishing a live deck when its switch is on. | Jarmo (“roadmap kinnitatud, lõikejoon ja AI-avaldamine soovituse järgi”) |
| 2026-11-25 | Put Quick Look for decks (#953) in 2.4. | Jarmo (“teeme ära selle quicklooki!”) |
| 2026-11-25 | Choose file access A for both Quick Look extensions: read-only access to the home folder and no network. | Jarmo (“2. a”) |
| 2026-11-25 | Draw deck pictures in Ritemark on save, on disk changes in an open project and when a project opens with missing or stale pictures. Keep the pictures on this Mac and remove them with the project. Finder shows the deck icon and Space shows current text until the picture is current. | Experience lead and Jarmo (“1 jah”) |
