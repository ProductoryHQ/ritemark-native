# Sprint 148: Search, the words layer

Track: SDD, lean (a new subsystem: an index of the project read off the extension host, three sources, a results view, and one shell change to the left column's head; edge cases in exclusions, cloud files, file kinds and the keyboard)
Branch: `sprint-148-search-words`, made from `origin/main` at Phase 3, after approval. Each later PR has its own branch that starts with the same name (*Pull requests* below). This plan was written on `plan/sprint-148-search-words`.
Release tier: shell, by `patches/vscode/018-ritemark-surfaces.patch` (PR 3: the box in the Documents head, and the column that becomes the results). Everything else is extension-tier. 2.2 is a shell release ([release-plan.md](../release-plan.md)), so this adds no release step.
Status: **Plan in review.** Jarmo has delegated 2.2's plan approvals to the Development manager until the release candidate (ritemark-dev `decisions/log.md`, c45d69c). The code named under *What reading the code added* was read for this plan, not run.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R10 and E1–E5, and the decisions.
- [technical-plan.md](technical-plan.md): what exists today, the five audits that come first, workstreams W1–W9, the measurements, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status, and the questions for the Experience lead.
- `research/` is not created yet. Phase 1 writes one file per audit there, and the measurements go in `research/measurements.md`.

## Goal

One search box under New finds what has your words, as you type: in documents (Markdown, Word, PDF, CSV), chats and tasks, grouped by kind, with the words around each match, and nothing sent anywhere. The left column becomes the results; clearing the box brings the documents back. It is the words layer of #591 and experience 8. Sprint 150 adds the meaning layer later, under these results, so the result model and the index leave room for it.

## Linked Issues

| Issue | What | Req | Seen so far | Release tier |
|---|---|---|---|---|
| [#591](https://github.com/ProductoryHQ/ritemark-native/issues/591) (part) | Ritemark's own search, the words layer: documents, chats and tasks, grouped by kind, as you type, no AI; leaves out `.ritemark`, `.claude`, what Git ignores and other dot folders | R1–R10 | Drawn (experience 8, 28 October); the words layer measured at 4–14 ms on a 59-file folder in the 29 October spike (ritemark-dev `releases/v2.2.0/analysis/2026-10-29-spikes/search-and-local.md`) | shell (018) for the box and the swap; extension for the rest |

The meaning layer (Enter, the AI's small model) stays in #591 for Sprint 150. Search all projects (experience 18) is not in 2.2.

## What reading the code added

Read for this plan; nothing was run. VS Code's files were read in the main checkout's `vscode/`, since this worktree has none.

- **The box's place exists.** The Documents head already has two rows under the project's name, New and Search (`018-ritemark-surfaces.patch:5037`, `HEAD_PLACES`), each an extension command whose title and icon the shell draws. Search runs VS Code's Search view today (`src/views/projectHeadCommands.ts:60`). The drawing puts the box in that row's place and the results where the Documents label and the tree are.
- **So the shell changes, once.** The tree is VS Code's Folders view, which has no `when` and can't be hidden by a command (`explorerViewlet.ts:139–151`, `canToggleVisibility: false`), and the head is 018's. An extension can't swap the tree for its results or turn the row into a box. PR 3 does both in 018; the extension draws everything inside the results, so the meaning layer and later fixes are extension releases. Sprint 152's approved rule (an extension release can't change the frame) agrees: the box and the view are frame, drawn by the shell.
- **Sprint 152 touches the same head.** Its PR 2 moves `HEAD_PLACES` into a manifest in `branding/product.json` and makes the extension release check refuse views and head rows the manifest doesn't name (`sprint-152-startup-contract/technical-plan.md`, Workstreams 4, 5 and 7). PR 3 and 152's PR 2 are never in review at once; whichever merges second carries the other's change (*Coordination* in the technical plan).
- **`findFiles` doesn't follow `.gitignore`.** `workspace.findFiles` asks for `useIgnoreFiles: { local: false }` (`extHostWorkspace.ts:478–485`); only the proposed `findFiles2` can, and Ritemark uses no proposed API. The index walks the folder itself, with the `ignore` package for Git's rules.
- **Word needs no new package.** The Office preview's own zip reader (`src/officePreview/officePackageCheck.ts:78`, `readZipDirectory`; `:154`, a capped inflate; `:18`, the size and bomb limits) can read `word/document.xml` on the host.
- **PDF is read only in the webview today.** pdf.js (`pdfjs-dist` 5.4.296, Apache-2.0, through `react-pdf`: `webview/package-lock.json:6431`) runs in the PDF preview. Its search index is already pure and DOM-free (`webview/src/components/viewers/pdfSearchIndex.ts:55`, `buildPdfSearchIndex`), with the scanned-PDF threshold beside it (`webview/src/conversion/pdfToMarkdown.ts:62`). The index reuses both, with `pdfjs-dist` added to the extension at the same version. Whether its Node build can be inlined into a bundle is audit A2's question.
- **CSV and Markdown have their readers.** `papaparse` and `marked` are already the host's dependencies.
- **Chats live outside the project.** One JSON record per chat in `<globalStorage>/conversations/v1/records`, with the person's and the AI's messages as events (`src/conversations/ConversationStore.ts:177`, `types.ts:184`), scoped to the project by `projectScopeId` (`projectScope.ts:43`). Home already follows them by watching `index.json` (`src/projects/projectsHost.ts:283`) and opens one with `openConversation` (`src/views/HomePanel.ts:46`).
- **Tasks live inside `.ritemark`.** A card is `.ritemark/tasks/<id>-<slug>.md` (`src/taskBoard/cardFile.ts`), the folder search leaves out as documents. The board's controller already sends snapshots with each card's title, Done when and description (`BoardController.ts:266`, `protocol.ts:81–114`), so tasks come from there, and a card opens with the board's `openCard` (`boardSurface.ts:33`).
- **Comment tasks are not a source of their own.** A comment's words are in its document, and the agent's run is a chat; the ledger (`src/commentTasks/`) holds states, not words.
- **Opening a document at its passage touches a High path.** The Markdown editor's find bar opens only from ⌘F inside the page (`webview/src/App.tsx:377–395`), and a message to it goes through `src/ritemarkEditor.ts`, which `REVIEW.md` puts in High. So that part is its own small PR (PR 4); every result opens without it.
- **The index must stay off the host's main thread.** The extension host runs the AIs' turns; reading a 50 MB PDF there would stall them. A worker thread is a separately started script, so it gets its own esbuild entry (`esbuild.config.mjs:65`), found through the extension's path, never `__dirname` depth (`CLAUDE.md`, bundle-safe code).
- **A kill switch has a pattern.** `powerpoint-preview` is a setting that defaults on (`src/features/flags.ts:85`). The old `document-search` flag is a tombstone of Sprint 74's RAG (`:222`) and is not reused.

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| What the index covers and leaves out; no cloud file downloaded | R1 | `walk.test.ts` on a fixture tree; A4 on the Mac and Windows |
| Word, PDF, CSV and Markdown text | R2 | `readers.test.ts` on fixtures; A2, A3 |
| Chats and tasks | R3 | `sources.test.ts`; prepared chat records and cards in a scratch profile |
| Fresh within 2 s of a save | R4 | `freshness.test.ts`; M6 |
| Words from their start, as you type, options, ranking, the passage | R5 | `wordIndex.test.ts` |
| Grouped by kind; reading, nothing found, too big | R6 | Render tests; the lead's screenshots |
| The box under New; the column becomes the results and comes back | R7 | `./scripts/test.sh --grep Ritemark` in a patched `vscode/`; a dev instance; the frame check |
| The keyboard; a document, a chat or a task opens | R8 | Render tests; a dev instance |
| A document opens at its passage | R9 | A dev instance; Windows through the overlay |
| Room for the meaning layer | R10 | `wordIndex.test.ts` (passages, the map); the protocol's types |
| Speed, local only, kill switch, bundle, docs | E1–E5 | `research/measurements.md`; `qa-evidence.md` |

**Not in this sprint:** the meaning layer (Sprint 150); search all projects (experience 18); Replace (decision 2); text from other kinds (plain text, web pages, Excel, PowerPoint), which are found by nothing here and stay in Quick Open and VS Code's search; an index kept between computers or shared with the AIs.

## Pull requests

Four, so a shell change and the one High path each get their review alone, and the bulk gets Standard. Each PR's Risk section names its tier and the paths that set it.

| PR | Branch | Holds | Release tier | Review tier |
|---|---|---|---|---|
| 1 | `sprint-148-search-words` | The index: the worker, the walker, the four readers, the word index, the text cache, chats and tasks fed in, the result model and the protocol (R1–R5, R10, E2, E4); the fixture and the index measurements (M1, M3); this sprint's doc updates (the plan lands first, in its own PR) | extension | Standard (`src/search/`, `esbuild.config.mjs`, `package.json`, `scripts/qa/`) |
| 2 | `sprint-148-search-words-panel` | The results view and every open (R6, R8, the extension side of R7, E3): the webview page, the Search row's command, ⌘⇧F, More's options, the states, a chat at its message, the kill switch; M2, M4–M6 | extension | Standard (`src/search/`, `src/views/`, `src/features/flags.ts`, `webview/src/`); screenshots to the Experience lead |
| 3 | `sprint-148-search-words-shell` | The box and the swap in patch 018 (R7): a head row that is a field, the context key, the Folders view hidden while results show; `CLAUDE.md`'s patch table and `layout-invariants.md` | shell | High: `/code-review` at high and `/security-review`, up to three rounds. Built and checked on a CoW-cloned, patched `vscode/`; the frame check; the drift check at merge |
| 4 | `sprint-148-search-words-passage` | A document opens at its passage (R9): the Markdown editor's find bar opened with the words, and the Word and PDF previews' | extension | High, by `src/ritemarkEditor.ts`. The change opens a find bar and touches no document state |

**Order:** PR 1 first: it needs no drawing and no UI, and its measurements say early whether the limits hold. PR 3's audit (A1) runs in Phase 1 too, so the shell change is known before PR 2's view is built. PR 2 can merge before PR 3: until the shell has the box, the Search row keeps opening VS Code's search and the view never shows (R7, E3). PR 3 merges after Sprint 146's shell PR (its PR 4), and one at a time with Sprint 152's PR 2. PR 4 last.

**Cut order if the appetite runs out** (the first goes first):
1. PR 4: documents open at their top, as from the tree.
2. A chat opens at its top instead of at the matching message.
3. More's options: Match capital letters, Whole words only, and the kinds.
4. PDF text: PDFs are found by their names.
5. Word text: Word files are found by their names.

Not cut: Markdown and CSV text, names, chats, tasks, grouping, as you type, the exclusions, the cloud-file rule, and PR 3 (without the box there is no search in the frame).

## Windows

- **PR 1, 2 and 4** run on Windows through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`), by the "Ritemark on Windows" session, before the merge: the worker thread, Windows paths in the walker and the `.gitignore` rules, the watcher, the cold index with Defender scanning (M1 on Windows), and a OneDrive folder with files kept only online (A4).
- **PR 3 can't go through the overlay:** Windows CI builds only the exact `main` commit. Its Windows proof is 2.2's candidate at Gate 2: the box, the swap and back, at 100%, 125% and 150%.

## Product Decisions

- **2026-10-31 (the release plan):** 148 is in the core; 150 comes after it and streams under its results; 150 is the second cut.
- **Engineering, in this plan (approved with it):**
  - The index runs in a worker thread, one per window, for the window's project, and lives in memory.
  - The shell draws the box and the swap; the extension draws the results. The meaning layer then needs no shell change.
  - Word through the Office preview's zip reader; PDF through `pdfjs-dist` at the webview's version; CSV through `papaparse`; Markdown through `marked`. Git's rules through `ignore`.
  - Tasks come from the board's snapshots, not from `.ritemark/tasks/` as documents.
  - No usage event in this sprint, so no search words, names or counts tied to a person can reach analytics.

## Decisions for the Development manager

Three, each with a recommendation. [spec.md](spec.md#decisions) carries the same list.

1. **The Search row opens Ritemark's search, and ⌘⇧F does too.** VS Code's search stays where it is in More, with Replace, regular expressions and include patterns, for those who use them (experience 8, *For the build*). **Recommended: yes.** You're asked because a way to do something moves off a Ritemark surface (`CLAUDE.md`, hard rule 1): the Search row stops opening VS Code's search.
2. **Replace waits.** Experience 8's More holds Replace. It writes the person's documents, several at once and some of them open in the editor, so it is High by `REVIEW.md` and needs its own sprint with the editor sync's tests. In 2.2, More holds the options and the kinds; Replace in Files stays in VS Code's search. **Recommended: yes.** The other way: Replace in Markdown only as a fifth PR, High, cut first.
3. **Copies of Word and PDF text stay on this computer.** The text read from Word and PDF files is kept in Ritemark's own storage for the project (outside the project's folder, at most 200 MB, dropped when the file goes), so a restart doesn't read every PDF again. Markdown and CSV are read again, as they're quick. **Recommended: yes.** The other way reads them again at every start; M1 says what that costs.

## Feature Flag Check

A kill switch, as `powerpoint-preview` has: the setting `ritemark.features.project-search`, on by default. Off, the Search row opens VS Code's search as in 2.1, and the index never starts. Search reads every document in the project in the background, so a way to stop it without a release is worth one setting. HARD RULE #1 holds: VS Code's search, its Replace and its options stay in More (decision 1); Tasks', Agents' and Home's own Search rows don't change.

## Testing

- **Unit tests** (`npm test`): the walker, the readers, the word index, the sources, the cache, the protocol, and the results' render tests. The worker's modules are pure and run in plain Node, so most of the sprint is tested without launching anything.
- **Fixtures with no client material:** a small checked-in tree for the tests (Markdown, CSV, a Word file and two PDFs made by the extension's own `docx` and `pdfkit`, a scanned-style PDF with no text, a password-protected Word file, nested `.gitignore` files, dot folders, `node_modules`). The large folder for the measurements is generated under `/private/tmp` by `scripts/qa/search-fixture.mjs` and removed after.
- **Dev instances** for PR 2, 3 and 4: hidden (`open -n -g -j`), one launch per check, `--use-mock-keychain`, a short profile under `/private/tmp` with prepared chat records and cards, a free port checked first, CDP input only. No AI is needed: search asks none.
- **PR 3** on a CoW-cloned, patched `vscode/` in the worktree, with `frame-screenshots.mjs --compare` (JOINS ok) and `frame-geometry.mjs`.
- **Not here:** Windows (the overlay session; Gate 2 for PR 3); a computer with a very large real project (M1 uses the generated folder).

## Success Criteria

- [ ] Typing two letters or more in the box under New shows the documents, chats and tasks with those words, grouped by kind, with the words around each match, and the tree comes back when the box is cleared (R5–R7).
- [ ] Nothing in a dot folder, `node_modules`, or what `.gitignore` ignores shows; no file kept only online is downloaded (R1).
- [ ] Words in a Word file, a PDF with text, a CSV and a Markdown file are found; a scanned PDF and a locked Word file are found by name (R2).
- [ ] A saved change shows within 2 s for Markdown and CSV (R4).
- [ ] The measurements meet E1's targets on the large folder, or the gap is in `research/measurements.md` with the manager's decision.
- [ ] A document, a chat and a task open from their results; with PR 4, a document opens at its passage with its find bar (R8, R9).
- [ ] Nothing leaves the computer and nothing is written into the project (E2).
- [ ] With the kill switch off, or on a shell without the box, the Search row opens VS Code's search (E3).

## Risks

| Risk | Retirement |
|---|---|
| pdf.js won't run inlined in a Node worker | A2 first, with fixtures; the fallback is an esbuild external (ships with a shell release only) and the PR says so; PDF text is fourth in the cut order |
| The index reads a whole OneDrive or iCloud folder down | The cloud-file rule (R1); A4 on both systems before PR 1 merges |
| A big project slows the host or fills memory | The worker; its memory cap; the text budget; M1 and M3 on the generated folder |
| Hiding the tree loses its open folders | A1 proves the tree comes back as left, or picks the other mechanism, before PR 3's code |
| PR 3 meets 146's and 152's shell PRs in 018 | One at a time; the second rebases (technical plan, *Coordination*) |
| The words' look waits on the lead | PR 1 needs no drawing; the questions go out in Phase 0 |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 146's shell PR** before PR 3 (both change 018); **Sprint 152's PR 2**, one at a time with PR 3.
- **The Experience lead** for the questions below, before PR 2's screens.
- **The "Ritemark on Windows" session** for the overlay checks of PR 1, 2 and 4, and Gate 2's rows for PR 3.
- **Sprint 150** builds on R10.

## Pre-Implementation Gate

- This plan is approved by the Development manager on Jarmo's 2.2 delegation (ritemark-dev c45d69c), with the decisions answered.
- Phase 1's audits come before their workstreams' code: A1 before W7, A2 and A3 before W2, A4 before W1's merge, A5 before W4. When an audit changes a requirement, `spec.md` changes first.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [ ] The Development manager approved this sprint plan on Jarmo's 2.2 delegation, with decisions 1–3.
- [ ] Sprint start: the same delegation ("every 2.2 sprint counts as approved until the release candidate").

## For the Experience lead

Only what experience 8 doesn't settle. Words and choices before PR 2's screens.

1. **Nothing found, in 148 alone.** Experience 8's no-words state puts Search by meaning first, and experience 18 lists the other projects; in 2.2 the first may be cut (150) and the second isn't built. Proposed: one line, "Nothing in <the project's name> has these words." Your words?
2. **While the index is still reading, and when a project is too big.** Results show as they're found. Proposed: a line above the count, "Still reading 120 of 900 documents", gone when done; and for a project past the limits, "Searched the text of the 6,000 newest documents. The rest by name." Your words and place?
3. **The box at rest and focused.** Proposed: at rest it reads as today's Search row (icon and "Search"); a click puts the caret in it and draws the field as frame 1 does. Is that the look you want, and which focus look in the left column (frame 1's border, or the ring)?
4. **A chat's and a task's row.** The frames draw only a document's row. Proposed: experience 18 frame 2's row (the kind's icon, the name, its age; the words around the match), a task's state in place of the folder ("Waiting for you"), and a CSV's matching row as its cells with " · " between.
5. **A long list.** Proposed: 20 rows per kind, then "Show 30 more". Your number and words?
6. **Enter in the box before the meaning layer.** Proposed: Enter opens the top result; with Sprint 150 it becomes Search by meaning, as drawn.
7. **Letters with marks.** Proposed: "kasi" doesn't find "käsi", because ä, ö, õ and ü are letters of their own in Estonian; capitals don't matter unless Match capital letters is on.

If decision 2 is answered yes, More holds Match capital letters, Whole words only and the kinds, without Replace. Screenshots before PR 2's and PR 3's merges, in Light and Dark.
