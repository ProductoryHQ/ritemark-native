# Sprint 148 Tasks

Nothing here starts before the plan is approved (the Development manager, on Jarmo's 2.2 delegation). Tick a box only when the change is on its PR's branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); A numbers are the audits; M numbers are the measurements.

## Phase 0: Branch and starting tree

- [ ] The approval is on the sprint plan, with the answers to decisions 1–3
- [ ] `git checkout -b sprint-148-search-words` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-148-search-words-panel`, `-shell`, `-passage`, each from `origin/main` the same way
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] `node ./scripts/worktree-hygiene.mjs --report` read, and the free disk recorded; nothing removed without Jarmo's word
- [ ] Asked: the Experience lead the sprint plan's seven questions; the "Ritemark on Windows" session for the overlay checks and Gate 2's rows

## Phase 1: Audits (each in `research/`, before its code)

- [ ] A1 `research/head-swap.md` (R7): the Folders view hidden and shown keeps its state, or the other mechanism; a lone view merged in Documents; where VS Code's search is reached; the field's room
- [ ] A2 `research/pdf-in-worker.md` (R2): `pdfjs-dist` inlined into a CJS worker or not; text with no canvas package; the fixtures; the size
- [ ] A3 `research/word-text.md` (R2): `word/document.xml` through the zip reader on the fixtures; the refusals
- [ ] A4 `research/walk-and-cloud.md` (R1): `ignore` on the fixture; links; `files.exclude`; cloud files on the Mac and, through the overlay, on Windows
- [ ] A5 `research/chats-and-tasks.md` (R3, R8): the words' fields; the largest record; the scope id; a chat at a message; archived cards
- [ ] Where an audit changes a requirement or a tier, `spec.md` and the sprint plan's tier line change first

## Phase 2: PR 1, the index (W1–W4; R1–R5, R10, E2, E4)

- [ ] `pdfjs-dist` (the webview's version) and `ignore` added to `package.json`; the `search/searchWorker` entry in `esbuild.config.mjs`; `external` only if A2 says so, with `check-bundled-extension-complete.sh`
- [ ] The walker, the cloud-file test, the limits; `walk.test.ts` (W1)
- [ ] The four readers; the zip reader's two functions exported unchanged; `readers.test.ts` (W2)
- [ ] The word index, the query, `passages`, `map`; `wordIndex.test.ts` (W3)
- [ ] The text cache; `textCache.test.ts` (W3, decision 3)
- [ ] `SearchHost` and the worker client: start, events, restart, the not-available state; `freshness.test.ts` (W1)
- [ ] Chats and tasks fed in; `sources.test.ts` (W4)
- [ ] `src/search/protocol.ts` with R10's room
- [ ] New tests in `npm test`; `tsc --noEmit` passes
- [ ] `scripts/qa/search-fixture.mjs`; M1 and M3 on the Mac in `research/measurements.md`; a missed target goes to the Development manager
- [ ] Windows through the overlay: the worker, paths, the watcher, M1 with Defender, A4's OneDrive case
- [ ] PR 1 opened: Standard; `/code-review` at medium; every finding answered; merged at the reviewed head

## Phase 3: PR 2, the results view (W5, W6; R6, R7's extension side, R8, E3)

- [ ] The lead's answers to questions 1–7 are in
- [ ] `SearchViewProvider` and `ritemark.searchResults` (in `explorer`, `when: ritemark.searchOpen`); the `search` route in `main.tsx`
- [ ] `SearchPanel`, rows, More (no Replace, by decision 2), the states, the keyboard; render tests
- [ ] Opening a document, a chat (at its message, by A5) and a task
- [ ] The Search row's command with the field's arguments and its fallback; ⌘⇧F (decision 1); `projectHeadCommands.test.ts`
- [ ] The `project-search` kill switch and its setting
- [ ] Checked with PR 3's patch applied on a dev instance (prepared chats and cards, no AI); M2, M4, M5, M6
- [ ] Inert without PR 3: on `main`'s shell the Search row still opens VS Code's search
- [ ] Windows through the overlay; screenshots in Light and Dark to the Experience lead
- [ ] PR 2 opened: Standard; `/code-review` at medium; every finding answered; merged at the reviewed head

## Phase 4: PR 3, the box and the swap (W7, R7)

- [ ] Sprint 146's shell PR merged; Sprint 152's PR 2 not in review at the same time (or merged, and its manifest carries the field row and the view)
- [ ] A CoW-cloned, patched `vscode/` in the worktree; `./scripts/apply-patches.sh --dry-run` passes before any change
- [ ] Patch 018: the field row, `_ritemark.projectHead.focusSearch`, `ritemark.searchOpen`, the swap by A1's mechanism, New clears first; through `create-patch.sh`; its header gains a Sprint 148 paragraph
- [ ] The field's unit test; `./scripts/test.sh --grep Ritemark`
- [ ] `frame-screenshots.mjs --compare` with JOINS ok, `frame-geometry.mjs`; the swap and back, Light and Dark; the tree's folders, scroll and selection kept
- [ ] `CLAUDE.md`'s patch table (018) and `layout-invariants.md`
- [ ] Screenshots to the Experience lead
- [ ] PR 3 opened: High, `/code-review` at high and `/security-review`; every finding answered; merged at the reviewed head with the drift check
- [ ] Windows proof on 2.2's candidate at Gate 2 (100%, 125%, 150%)

## Phase 5: PR 4, at the passage (W8, R9)

- [ ] `find:open` in `ritemarkEditor.ts` and `App.tsx`; the Word and PDF previews' find bars; each page's handler test
- [ ] A dev instance on the fixtures: Markdown, Word, PDF at their matches; nothing edited, saved or added to undo
- [ ] Windows through the overlay
- [ ] PR 4 opened: High (by `src/ritemarkEditor.ts`), `/code-review` at high and `/security-review`; every finding answered; merged at the reviewed head

## Phase 6: QA and closeout

- [ ] `npm test` and the webview tests pass; `tsc --noEmit` for both; the pre-commit validator on every PR
- [ ] `research/measurements.md` complete (M1–M6, Mac and Windows), each target met or decided
- [ ] `media/webview.js` size after (E4); the worker bundle's size and licence comments
- [ ] `architecture.md`, `CLAUDE.md`'s repository structure (`src/search/`), `docs/CHANGELOG.md`, the release notes lines through the `release-notes` skill (E5)
- [ ] Gate 1 and Gate 2 rows for the release plan: the box and the swap, a search on the large folder, a OneDrive folder on Windows
- [ ] #591 stays open for Sprint 150, with a comment linking this sprint's PRs
- [ ] `qa-evidence.md` written; `release-plan.md`'s tracker rows updated, one per PR
