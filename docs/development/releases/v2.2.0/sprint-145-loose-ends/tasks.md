# Sprint 145 Tasks

Nothing here starts before the plan is approved by Jarmo. Tick a box only when the change is on its PR's branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); S numbers are scenarios in [scenarios.md](scenarios.md); A numbers are the audits.

## Phase 0: Branch and starting tree

- [ ] Jarmo's approval is on the sprint plan
- [ ] `git checkout -b sprint-145-loose-ends` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-145-loose-ends-ext`, `-flows`, `-board`, `-shell`, `-electron`, each from `origin/main` the same way
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] Asked: the Experience lead for the drawings and words (sprint plan, *For the Experience lead*); the "Ritemark on Windows" session for A1's Windows half, A4, A5 and the overlay checks

## Phase 1: Reproductions and audits (each in `research/`, before its code)

- [ ] A1 `research/stale-write-repro.md` (R1, S1–S8): the coordinator-level test and its failure on `main`; `scripts/qa/stale-write-check.mjs`, ten runs on the Mac; the Windows run; whether Ctrl+Z brings the words back; the false-positive set; the window and threshold chosen from the numbers
- [ ] A2 `research/ai-edit-tools.md` (R1, S9): each signed-in runtime's stale edit; the 27 October write's tool
- [ ] A3 `research/switch-timing.md` (R9, S42–S44): `project-check.mjs --measure 10` on `main` and the shipped 2.1.0, with the AI column's markers; the first-switch outlier
- [ ] A4 `research/first-start-terminal.md` (R10, S45–S47): the Windows reproduction; the Mac with a held extension host; VS Code 1.142's rule for an `inactive` editor in an empty group
- [ ] A5 `research/home-keys-windows.md` (R11): `scripts/qa/home-keys-check.mjs` written; the Windows run waits for a person (Phase 8)
- [ ] A6 `research/electron-availability.md` (R12, S50): the newest 43.x and its Node, dated; the Node network calls re-read
- [ ] A7 `research/log-lines.md` (R8, S39–S40): the request for `/phosphor.woff2`; DEP0169's stack
- [ ] A8 `research/board-timing.md` (R3, S18): the table; the slow-file test for the tail
- [ ] A9 the flow harness run on `main` (R4, S27): the `flow:save` and its delay
- [ ] Where an audit changes a requirement or a tier, `spec.md` and the sprint plan's tier line change first

## Phase 2: PR 1, the stale write (W1, R1)

- [ ] `src/editorSync/state.ts`: `droppedRecentSave`, pure; `state.test.ts` cases (S1, S2, S4–S6, empty window, no saves, a save out of the memory)
- [ ] `src/editorSync/DocumentSyncCoordinator.ts`: the memory of recent states and saves (bounded), the `external-only` branch holding the import as a conflict, the log line without words
- [ ] `DocumentSyncCoordinator.staleWrite.test.ts` (S1–S3, S5–S7), added to `npm test`; fails on `main` at S1
- [ ] `scripts/qa/stale-write-check.mjs` passes on the branch (S1, S2); the Windows run on the branch (S1)
- [ ] The Experience lead has seen Review changes for this case (screenshot)
- [ ] The false-positive set stays silent; S8's limit written in the issue and the release notes' known limits
- [ ] PR 1 opened: Risk section with its tier; `/code-review` at the level Jarmo chose (decision 2); every finding answered; merged at the reviewed head

## Phase 3: PR 2, the small extension fixes (W6, W7, W8, W9, W10; R6–R10)

- [ ] `RuntimeNotice.tsx`: the done card in ink (the Experience lead's answer on the background); render test; screenshots in Light and Dark; the list of other success-colour uses sent to the lead
- [ ] `webview/components/settings/`: `versionLabel`; the versions line uses it; `versionLabel.test.ts`; the update tests still pass
- [ ] DEP0169: the caller changed, if it is ours (A7); otherwise recorded
- [ ] `welcomeHost.ts`: a restored terminal sent behind the welcome for the whole first minute; unit test
- [ ] R9's extension half, if A3 puts the cause in the timers
- [ ] PR 2 opened and reviewed at Standard; screenshots to the Experience lead for #578

## Phase 4: PR 3, Flows (W4, W5; R4, R5)

- [ ] `flowEditorStore.ts`: `select` and `dimensions` don't mark dirty; the test (S26); the harness passes (S27); real edits still save (S28); opening writes nothing (S29)
- [ ] `flowModelDefaults.ts`: the copy objects; the four places throw `StepNeedsKeyError` with the right one
- [ ] `RitemarkSettingsProvider.ts` and `RitemarkSettings.tsx`: the `openai-api-key` section id and scroll
- [ ] `flow:getModels` for AI steps answers with the missing-key error and action; `NodeConfigPanel.tsx` shows it for both kinds of step
- [ ] Tests for the copy, the host's answer and the panel (S30–S34)
- [ ] PR 3 opened; its Risk section names the `src/settings/` line and the tier it takes

## Phase 5: PR 4, the Task board (W2, W3; R2, R3)

- [ ] The Experience lead's rows, question, retry moment and quiet sign are in
- [ ] `BoardStore.ts`: the read-failure reason and plain message; the existing test changed for the new words; the slow-file result from A8 acted on
- [ ] `board/retry-file` and `board/remove-file` in `protocol.ts`, `boardSurface.ts`, `BoardController.ts`; the handler's refusals tested (S17)
- [ ] `UnreadableCards.tsx` and the question; render tests (S10–S16)
- [ ] `boardClient.ts`: the pending move and its placement function; every move through `moveCard`; the quiet sign; tests (S18–S25)
- [ ] The host changes A8 asks for (file checks, double list, the lock), each with a test
- [ ] A CDP run: a card dropped lands in the next frame; the answer held back; a refusal puts it back
- [ ] PR 4 opened and reviewed at Standard; screenshots to the Experience lead

## Phase 6: PR 5, the shell patches (W8, W9, W10, W11; R8–R11)

- [ ] Only what A3, A4, A5 and A7 show needs a patch: patch 001 (the icon font's place), patch 019 (restored terminals), patch 002 or 018 (the AI column), a keyboard hunk if R11 reproduces
- [ ] Built on a CoW-cloned, patched `vscode/` through `create-patch.sh`; `./scripts/apply-patches.sh --dry-run` passes; the frame check if 018 changed
- [ ] The tier line already names the patches
- [ ] PR 5 opened: High, `/code-review` at high and `/security-review`; every finding answered; merged at the reviewed head
- [ ] The Windows proof is on 2.2's candidate at Gate 2 (S46)

## Phase 7: PR 6, the Electron (W12; R12)

- [ ] A6 run again before the candidate; if a 43.x on Node 24.22.1 or later exists: patch 020 moved, checks of S51; PR 6 reviewed at High
- [ ] If none exists: the risk in the release plan and on #515; Jarmo's answer to decision 4 recorded

## Phase 8: The real keyboard (R11)

- [ ] A person on Windows runs S48; the record is in `research/home-keys-windows.md`
- [ ] A failure: its cause, then a plan under the scope-change protocol. No failure: the evidence on #507 and Jarmo's answer to decision 5

## Phase 9: QA and closeout

- [ ] `npm test` and the webview tests pass; `tsc --noEmit` for both; the pre-commit validator on every PR
- [ ] Each check failed on `main` first (S53), recorded in `qa-evidence.md`
- [ ] Records unchanged (S54); `media/webview.js` size after (`notes/bundle.md`); `architecture.md`, `docs/CHANGELOG.md`; the release notes lines drafted (S55)
- [ ] Windows through the overlay for the extension-tier items: S1, S10–S16, S26–S34
- [ ] Gate 1 and Gate 2 rows for the release plan: S41, S43, S46, S48, S51/S52
- [ ] Issues closed on merge with their evidence: #588, #596, #597, #571, #580, #578, #595; #582, #569, #501 after their candidate checks; #507 and #515 as decided
- [ ] `qa-evidence.md` written; `release-plan.md`'s tracker rows updated, one per PR
