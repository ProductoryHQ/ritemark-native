# Sprint 145 Technical Plan

The plan for [spec.md](spec.md). The release is 2.2.0 ([release-plan.md](../release-plan.md)). Code shapes here are proposals; when the code needs something else, this file changes first. File references are to the tree this plan was written on (`plan/v2.2.0-release-plan`, 31 October 2026). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`. The code was read for this plan, not run: every "reproduced" below is a task in Phase 1, except where the issue itself holds the record.

## What exists today

| Part | Today | File |
|---|---|---|
| A clean document's changed file | `reconcile` classifies disk, model and base; a clean model with a changed disk is `external-only`, and the disk text is applied to the model and sent to the views, with no question | `src/editorSync/DocumentSyncCoordinator.ts:615–709`; `src/editorSync/state.ts:163–171` |
| Own saves | A save receipt is a hash of the logical text handed to the write (patch 014). `observeLocalSaveReceipts` matches a disk hash to a pending receipt (the "echo"); no text is kept | `src/editorSync/saveReceipt.ts`; `state.ts:42–70`; `DocumentSyncCoordinator.ts:136–145`, `:925–928` |
| The question for a conflict | `record.conflict` and `sendConflict`; Review changes offers Keep my version, Use disk, Compare. A dirty document gets it from `reconcile`'s last branch; a refused save from `answerSaveConflict` | `DocumentSyncCoordinator.ts:438–541`, `:547–588`, `:743–761` |
| How often disk is read | The watcher, every model change, every save, and a 3 s poll | `DocumentSyncCoordinator.ts:33`, `:136–152`, `:947–963` |
| Unreadable cards | `reread` lists a file that can't be read as `unreadable` with the message `Couldn't read it: <code>`; `UnreadableCards` draws "Couldn't read this card. <message>" and opens the file on a click; nothing else | `src/taskBoard/BoardStore.ts:409–433`; `webview/components/tasks/UnreadableCards.tsx` |
| The board's other tools | `invalidate(fileName)` re-reads one file on the store's tail; `remove(cardId)` trashes a card's file through `fs.trash` (`workspace.fs.delete({ useTrash: true })`); `DeleteConfirm` is the board's one question | `BoardStore.ts:336–351`, `:370–381`; `taskBoardHost.ts:116–118`; `webview/components/tasks/DeleteConfirm.tsx` |
| The existing test of the message | Pins `Couldn't read it: ETIMEDOUT` and the listing as unreadable | `src/taskBoard/BoardStore.test.ts:408–410` |
| A move | The webview sends `board/move` and waits; the host lists the board, ranks, writes a card file (`store.mutate`) and the change event schedules a refresh; `snapshot()` rebuilds everything, with a file-exists check per attached file | `webview/components/tasks/boardUi.ts:70–104`; `BoardColumns.tsx:55–63`; `src/taskBoard/BoardController.ts:266–357`, `:473–518` |
| What the components read | One module-level snapshot per webview, replaced whole by each host push | `webview/components/tasks/boardClient.ts:19`, `:40` |
| The store's tail | Every read and write runs through `serialized`, one at a time | `BoardStore.ts:663` |
| The other ways to move | The card menu (Mark done, Reopen, Move to…) and the card's page | `CardMenu.tsx:66`, `:73`, `:110`; `CardPage.tsx:147`, `:279` |
| A node change | `onNodesChange` sets `isDirty: true` for every change, selections and dimensions too; `FlowEditor` saves 500 ms after `isDirty` | `webview/components/flows/stores/flowEditorStore.ts:386–395`; `FlowEditor.tsx:205–221` |
| Missing-key errors | `StepNeedsKeyError` with the Google image copy; the Google image step uses it, in the model list too; the panel shows the sentence and a link for an image step | `src/flows/flowModelDefaults.ts:34–51`; `ImageNodeExecutor.ts:360–365`; `FlowEditorProvider.ts:770–780`, `:903–908`; `webview/components/flows/NodeConfigPanel.tsx:664–780` |
| Where they still say something else | OpenAI image step `ImageNodeExecutor.ts:224`; AI steps `LLMNodeExecutor.ts:197` (OpenAI), `:272` (Gemini); and, not in the issue, the OpenAI image step's model list `FlowEditorProvider.ts:870` | |
| Settings sections | `SettingsSection` is `'google-docs' \| 'transcription' \| 'usage-data' \| 'google-ai-key'`; the Google card has `id="settings-section-google-ai-key"`; the OpenAI heading has no section id | `src/settings/RitemarkSettingsProvider.ts:148–153`; `webview/components/settings/RitemarkSettings.tsx:926`, `:852` |
| The failed card | `RuntimeNotice`'s `success` tone is a `check-circle` in `--r-success` on `--r-success-soft`; `TurnFailureCard` passes it when `card.done` | `webview/components/ai-sidebar/RuntimeNotice.tsx:35`; `TurnFailureCard.tsx:156–159` |
| Other uses of the success colour | `CommentsMenuButton.tsx:285`, `ExportMenu.tsx:205,212`, `Editor.tsx:1173,1389`, `tasks/LogView.tsx:22`, `ai-sidebar/PlanReviewCard.tsx:79`, `.rm-task-dot--success` and `.rm-task-status--success` in `index.css:713,732` | |
| The versions line | `App {currentAppVersion} · Extension {currentExtensionVersion}`; the value is `getCurrentVersion()`, the floored `X.Y.Z-0` of a production build (`scripts/floor-bundled-extension.sh`) | `webview/components/settings/RitemarkSettings.tsx:1390`; `src/update/updateService.ts:115`; `src/update/versionService.ts:32` |
| The icon font | Patch 001 registers the font in `iconRegistry.ts` with `URI.parse('phosphor.woff2')` and declares it in `codicon.css` as `url("./phosphor.woff2")` | `patches/vscode/001-ritemark-branding.patch` |
| Project switch timers | Home is brought forward 800 ms after activation, or 50 ms when a switch is landing; the AI column is focused 4 s after activation | `src/views/permanentTabs.ts:93–159`; `src/extension.ts:376–382` |
| The welcome and a restored terminal | After the first reveal `keepInFrontUntil` is set to 0; patch 019's `RitemarkTerminalTabs.moveToDesk(true)` opens revived terminals `inactive` and pinned | `src/welcome/welcomeHost.ts:383`, `:447–458`; `patches/vscode/019-ritemark-tab-row.patch` (`RitemarkTerminalTabs`) |
| The Electron | Patch 020: 43.8.3, Node 24.22.0, three files | `patches/vscode/020-ritemark-electron-43.patch` |
| Existing checks to reuse | `scripts/qa/project-check.mjs --switch-to --measure`; Sprint 144's flow harness; the Windows overlay (`make-windows-test-overlay.sh`, `windows-branch-test.ps1`); Sprint 143's home-keys reproducers (`sprint-143-fixes/research/repro/`) | |

## Architecture overview

Twelve changes in existing modules, no new subsystem. Two request types (try again, remove) and one optional field on the board's protocol; no other message or record shape changes.

| Layer | Requirement | Where |
|---|---|---|
| The editor sync | R1 | `src/editorSync/state.ts` (the pure decision), `DocumentSyncCoordinator.ts` (the memory of recent saves and the branch). Since 1 November: patch 014 (the reload participant), `state.ts` (blocks, base, merge), the coordinator's `answerReload`, `webview/components/dialogs/DocumentConflictDialog.tsx` and the document bar's `SyncActionButton` |
| The Task board's store, host and rows | R2 | `src/taskBoard/BoardStore.ts`, `BoardController.ts`, `boardSurface.ts`, `protocol.ts`; `webview/components/tasks/UnreadableCards.tsx`, `DeleteConfirm.tsx`, `boardUi.ts` |
| The Task board's moves | R3 | `webview/components/tasks/boardClient.ts`, `boardUi.ts`; maybe `BoardController.ts`, `BoardStore.ts` by A8 |
| Flows | R4, R5 | `webview/components/flows/stores/flowEditorStore.ts`; `src/flows/`, `webview/components/flows/NodeConfigPanel.tsx`, `src/settings/RitemarkSettingsProvider.ts`, `webview/components/settings/RitemarkSettings.tsx` |
| The AI's sheet | R6 | `webview/components/ai-sidebar/RuntimeNotice.tsx`, `TurnFailureCard.tsx` |
| Settings | R7 | `webview/components/settings/` (a label helper) |
| The logs | R8 | patch 001; the extension bundle or a dependency, by A7 |
| The project switch | R9 | by A3: `src/views/permanentTabs.ts`, `src/extension.ts`, or patch 002/018 |
| The first Windows start | R10 | `src/welcome/welcomeHost.ts`; patch 019 by A4 |
| Home's keys | R11 | by A5; `scripts/qa/home-keys-check.mjs` |
| The Electron | R12 | patch 020 |

**Release tier: shell** (`patches/vscode/020-ritemark-electron-43.patch` for certain; 001 and 019 expected; since 1 November 014 for R1's reload participant, pending approval). The per-item tiers and the six PRs are in the sprint plan.

## Phase 1: reproductions and audits

Nothing here is code. Each audit is one file in `research/` and comes before the workstream it gates. A requirement whose audit changes it changes in `spec.md` first.

1. **A1, `research/stale-write-repro.md` (R1: S1–S8).** Three parts:
   - **A coordinator-level test** (`src/editorSync/DocumentSyncCoordinator.staleWrite.test.ts`, with `vscode` stubbed through `Module._load` as `HomePanel.test.ts` does, a fake `TextDocument`, and real temp files) that drives S1, S2, S3, S5 and S6. It fails on `main` at S1.
   - **A scripted run** (`scripts/qa/stale-write-check.mjs`, new): a hidden dev instance with scratch AI homes, the three-line file opened in Ritemark's editor, key events over CDP, the writer a plain `fs.writeFileSync` of the earlier read. Ten runs; per run: whether the later words survive, how many seconds after the last save the stale write came, whether Ctrl+Z brings them back. A PowerShell twin for the Windows session (the issue's own run used `WriteAllText`).
   - **The false-positive set** (S2–S7), run before the window and the threshold are fixed.
2. **A2, `research/ai-edit-tools.md` (R1: S9).** For each runtime signed in on the test Mac, a scripted stale edit in a scratch project; and, for the 27 October sighting, what tool ChatGPT's write used, read from its session record if it is still on disk. Claude Code's Edit is known to refuse (the issue); the others are not.
3. **A3, `research/switch-timing.md` (R9: S42–S44).** `project-check.mjs --switch-to --measure 10` on `main`'s dev build and on the shipped 2.1.0, with timing markers added to find who shows the AI column at about 500 ms (the extension's 4 s timer can't explain it, so the workbench's restore is the first suspect; patch 002/018 hold the aux bar's layout). Both directions, and the first switch of a launch.
4. **A4, `research/first-start-terminal.md` (R10: S45–S47), on Windows.** The "Ritemark on Windows" session: a 1.14.0 profile with a terminal at quit, updated to the 2.1.0 installer, the times the terminal is in front. On the Mac: a dev instance whose extension host is held, with a restored terminal. One thing to read in VS Code 1.142 (in a CoW-cloned, patched `vscode/`): whether an editor opened `inactive` into an empty group is activated anyway. That is a guess, not a finding.
5. **A5, `research/home-keys-windows.md` (R11: S48).** The scripted twin (`scripts/qa/home-keys-check.mjs`, from Sprint 143's `repro-513-507.mjs`) is written; the Windows run is a person's, with the dev instance's trace log on. A failure records the workbench's and Home's active elements and whether the webview host forwarded the key.
6. **A6, `research/electron-availability.md` (R12: S50).** The newest Electron 43.x, its Node (Electron's release list; `SHASUMS256.txt`; the `process.versions` of its build), with the date; run at the start and again before the candidate. A re-read of every Node network call in the extension host since Sprint 144's list (`sprint-144-release-harness/research/electron-node-audit.md`), because code has been added since.
7. **A7, `research/log-lines.md` (R8: S39–S41).** A fresh hidden launch with the network over CDP (`Network.requestWillBeSent` for fonts) names the request for `/phosphor.woff2`. The stack of DEP0169: the dev instance launched with Node's deprecation trace on (`NODE_OPTIONS=--trace-deprecation`, if the extension host passes it on; if it doesn't, the bundle's imports are loaded one by one in a plain Node with the same flag). Neither is assumed from patch 001 or from any dependency.
8. **A8, `research/board-timing.md` (R3: S18; R2's hang question).** The controller's steps timed around a drop: read, rank, write, snapshot, file checks, and the wait on the store's tail; on the real disk, on a file system with delays, and in a cloud-synced folder if the Mac has one. A unit test of one slow file: does a `mutate` on another card wait for it?
9. **A9, the flow harness (R4: S27).** Sprint 144's `flow-step-panel/shoot.mjs` run on `main`: the `flow:save` and its delay. If it is 100 ms and not 500, a second path writes.
10. **The merge checks, `research/merge-checks.md` (R1 revised, 1 November).** The base (the writer's copy against the remembered saves, block by block: done, 5 of 5) and the hook (where VS Code reloads a clean model, and whether a patch can ask Ritemark there: done, by reading the pinned source).
11. **A10, `research/who-wrote-it.md` (R1 revised: S56, S59).** Can the host tell that a write to this file came from an AI's turn, and which AI: Claude's tool events through the Agent SDK, Codex's file changes, OpenCode's tool calls through ACP. Without it, the words say "another app".
12. **A11, `research/editor-undo-and-anchor.md` (R1 revised: S61, S62).** In a dev instance: what one host update added to the editor's history does to ⌘Z (and to VS Code's own undo of the same document, the custom editor's double undo), and whether the view keeps its place by the caret's block when text above it changes.

## Workstream 1 (revised 2026-11-01): both changes stay (R1)

For R1 as revised on 1 November ([spec.md](spec.md), experience 44; [research/merge-checks.md](research/merge-checks.md)). **Approved by Jarmo on 1 November** (`819c63f`), with unsaved text merged too. The 31 October workstream follows as history.

**Shape.** The decision is made before the document holds the writer's copy, in the shell, and the merge is Ritemark's:

```text
file changes ─ VS Code: clean model? ─ TextFileEditorModel.resolveFromFile reads the file
             ─ reload participant (patch 014): Ritemark's editor holds it? ─ _ritemark.editorSync.answerReload(uri, diskText)  (≤ 3 s)
             ─ coordinator: own save? no change? → "reload"   base found? → merged text   no base? → fallback (held text)
             ─ shell: answer differs from the file → resolveFromContent({ ...read, value: answer }, dirty) ; else VS Code's own reload
             ─ VS Code's auto-save writes the merged text with the read's etag (a newer write in between → patch 014's save-conflict route)
```

**The shell (patch 014, shell-tier).** Through `create-patch.sh` onto patch 014, on a copy-on-write, patched `vscode/`:
- `ITextFileEditorModelManager` gets a second slot beside `saveErrorHandler`: a reload participant, `(model, diskText) => Promise<string | undefined>`.
- `TextFileEditorModel.resolveFromFile`, after `readStream` and the version check, when the model is already resolved and the read isn't forced (Revert forces it, so Keep my version and Use disk version are untouched): decode the content, ask the participant; a returned text that differs from the file's is resolved dirty with the read's stat (`resolveFromContent(…, true)`, an existing path), anything else continues as today.
- `textFileSaveErrorHandler.ts`'s contribution registers the participant: only for a resource `editorService.findEditors` says `ritemark.editor` holds; `executeCommand('_ritemark.editorSync.answerReload', resource, diskText)` under `raceTimeout(…, RITEMARK_ANSWER_TIMEOUT_MS)`; no answer, an error or a non-string means VS Code's own reload.
- Tests beside patch 014's own (`ritemarkSaveConflict.test.ts`, `textFileEditorModel.test.ts`): a merged answer resolves dirty with the read's etag; no participant, a timeout or `undefined` reload as today; a forced read never asks.

**The extension (`src/editorSync/`).**
- **Memory for the base** (reused from #605): `recentTexts`, `rememberSave` by the receipt's hash, `convergedBeforeReceipt`, `lastKnownDiskText`. Kept longer than #605's 30 s, since a merge asks nothing: the saves of the last 10 minutes, up to 40 and about 8,000,000 characters, merged rather than dropped beyond that (#605's round-2 rule).
- **Blocks** (new, `state.ts`, pure): Markdown's top-level blocks from `marked`'s lexer (the host already ships it), the front matter one block; CSV rows; compared as logical text.
- **Finding the base** (new, pure): among the remembered saves and the last read or imported text, the one with which the writer's copy differs in the fewest blocks; none when the copy differs from every candidate in most of its blocks (the threshold fixed from the false-positive set, as #605's window was), or when the best two tie at a different text.
- **The merge** (new, pure): a three-way merge of block sequences, base against the writer and base against the person, aligned with a longest common subsequence (the alignment code from #605's `addedRuns`, on blocks instead of words). Writer-only changes taken, person-only kept, both-changed blocks keep the person's text and are listed with the writer's version. Inserts and deletes from either side kept; a block one side moved and the other edited counts as both changed.
- **`answerReload`** (new command, registered like `answerSaveConflict`): on the record's queue, read nothing new (the shell passes the text it read). Own save (a receipt or a remembered hash) or the same text → `undefined`. Base found → the merged text, a pending-merge note `{ diskHash, mergedHash, held blocks }` so the change event that follows is taken as Ritemark's own (local-only until the auto-save echoes), and the held blocks become the document's paragraph conflicts. No base → the fallback: within the 30 s window, the held text (the views' text) and #605's held import; outside it, `undefined`.
- **The coordinator's own sightings** (`external-only` from its poll or watcher, when VS Code hasn't reloaded yet) use the same function and apply the merged text with `applyText`.
- **Unsaved text (S3, approved 1 November):** `reconcile`'s conflict branch (a dirty document whose file changed) merges with the last save as the base and the document's text as the person's side, applies the merged text, and keeps a pending-merge note with the disk's hash; `answerSaveConflict` answers `overwrite` when the refused save's disk is the copy that note names, so the merged text is saved over the writer's file. #454's whole-document conflict only when no base is found.
- **Paragraph conflicts** (new): a list of `{ blockIndex, mine, theirs, writer }` per record; resolved by Keep mine, Use the writer's (one `applyText`), the two texts becoming equal, or the document closing (the person's text was saved). A new optional field on `document:conflict` (`kind: 'paragraphs'`, the count, the writer's name) and one view message to answer one block; a build that doesn't know them ignores them (E2).
- **The writer's name** (A10): the AI whose turn in this project wrote this file, when the host knows it from its own runtime events; otherwise "another app".
- **Goes** (#605's code that raced VS Code's reload): `holdStaleWrite`'s put-back over a reloaded model, `keepHeldWords`, `wasLocalEdit`, `knownText` as a put-back source, the `converged` branch guard and its `revert` broadcast. The held import itself stays for the fallback, its answers too (Use disk version writes `diskBytes`).
- **Stays from #605:** `droppedRecentSave` decides the fallback's question within the window; the protocol's `reason`; `scripts/qa/stale-write-check.mjs` (its expectations change); the coordinator test harness, whose fake document gains the reload participant.

**The webview.**
- `SyncActionButton`, conflict kind, for every conflict: ink, `--r-hairline-strong`, the `arrows-split` icon; the failed-sync kind unchanged. Tooltip words from experience 44 (singular, plural, Claude or the AI by name, another app).
- `DocumentConflictDialog`: a paragraph mode (title, first line, the two blocks in full with their labels, [Use Claude's] left, [Keep mine] primary and the default, "1 of 2", no warning icon); the whole-document mode gets the Experience lead's three changes from #605 (words, `secondary` Use disk version at the far left, Tab in screen order).
- **One undo step:** the host's merge update enters the editor's history as one step (today host updates are `addToHistory: false`, `Editor.tsx:610–626`); every other host update stays out of it. A11 checks it before the code.
- **Nothing moves:** the merge update keeps the caret and the selection (as host updates do today) and the view's place by the caret's block; A11 checks it with a change above the view.

**Tests:** the pure functions (blocks, base, merge: S1, S2, S4, S7, S56, S58, S63, a move against an edit, a split, a table, a list, front matter, CRLF, a reformat with no base); the coordinator with the shell participant faked (S1–S8, S56–S64, both save orders); the shell's tests above; webview render tests of the paragraph mode and the button; `stale-write-check.mjs` extended to S56–S62 in the app.

**Which PR, and its tier (my judgment, as asked).** #605 becomes the #588 PR, shell-tier by `patches/vscode/014-ritemark-save-receipts.patch`, High review (`/code-review` at high plus `/security-review`), named so in its title and Risk section; not split with the hook in PR 5:
- the extension half alone is #605's guard, which races VS Code's reload (round 3's findings 1, 2, 4, 6, 7, 8); shipping it first would ship a race the hook removes;
- the hook alone does nothing without the coordinator's answer, and its tests need the answer's shape;
- one PR reviews the decision where it is made, once, at the tier its paths set;
- the cost: it is built and checked on a copy-on-write, patched `vscode/` (`./scripts/apply-patches.sh --dry-run`, the drift check at merge), and its Windows proof moves from the test overlay to 2.2's candidate at Gate 2, like PR 5's. PR 5 keeps R8's font, R10 and R9's patch half.

## Workstream 1 as planned on 31 October (superseded on 1 November)

### The stale write (R1), 31 October

The most careful change in the sprint. It is one PR, `src/editorSync/` and tests only, with the false-positive set as its largest part.

- **The pure decision** (`state.ts`, tested in `state.test.ts`): `droppedRecentSave({ saves, baseText, diskText, now, windowMs })` returns the words the person's recent saves added that the new disk text no longer has, or nothing. Texts compare as logical text (`normalizeLogicalText`: line endings and the byte order mark are not content). "Words the save added" is the multiset of words in the newest saved text minus the words in the text before the person's saves began; "dropped" is what the disk's words don't cover. Words, not lines, so a rewrap or a changed line ending is not a loss. The threshold (any word, or a few) and `windowMs` are chosen from A1's numbers.
- **The memory** (`DocumentSyncCoordinator.ts`): each record keeps the texts of its last few model states, taken synchronously in the change event, so no state is missed when typing outruns `reconcile`; hashed only when a save receipt arrives. A receipt's hash finds its text, and that entry gets a `savedAt`. Bounded by count and by size; a document too large to keep texts for runs without the guard, and the record says where that limit is. If a receipt's hash is no longer in the memory, nothing is guarded for that save (today's behaviour, never a guess).
- **The branch.** In `reconcile`'s `external-only` case, before `applyText`: if `droppedRecentSave` returns words, take the conflict branch the dirty case takes (the final `else` of `reconcile`), with the disk text and the person's text as `diskContent` and `localContent`; log `<reason>:held-import` with the count of words, never the words; send Review changes to every view. Nothing is applied.
- **What stays silent:** own saves (matched by receipt first), a disk equal to the model (`converged`), a writer that kept the saved words, a line-ending or byte-order-mark rewrite, a date-only change.
- **Review changes' words** are the existing ones unless the Experience lead supplies others (decision, sprint plan). No new button without the lead.
- **Tests:** the pure decision's table (S1, S2, S4–S6, empty window, no saves, a save out of the memory); the coordinator-level test (S1–S3, S5, S6, S7); both added to `npm test`.
- **The check:** `scripts/qa/stale-write-check.mjs` (S1, S2), and the Windows run (S1).
- **Not touched:** patch 014, the save receipt, `answerSaveConflict`, #454's behaviour.
- **Changed after A1 (31 October, [research/stale-write-repro.md](research/stale-write-repro.md); `spec.md` R1 addendum):**
  - The guard runs before `external-only` **and** `converged`, ahead of the 25 ms wait: VS Code reloads a clean document by itself, often before the sync looks.
  - The branch doesn't take the dirty case's `else`: it puts the person's newest saved text back into the document first (`holdStaleWrite`), then opens the conflict with `reason: 'held-import'` and the writer's copy as its disk side. While it waits, a writer's copy VS Code reloads under it is answered the same way (`keepHeldWords`). A held conflict's Use disk version writes the writer's copy back byte for byte when the file no longer holds it; Keep my version is unchanged.
  - "Words the save added" are the runs a word alignment (longest common subsequence of the part between the common start and end) of the save with the text before it finds; a run is lost when the newest save has it, the file has it fewer times, and not with the word on each side where the person put it; the window is 30 s; one run asks.
  - Review round 1 (#605): `converged` is guarded only when the text changed without Ritemark; the hold puts back the views' text (`knownText`), not the newest save; Use disk version on any conflict forgets the earlier saves; memory 8 states, 1,000,000 characters.
  - VS Code reports a save's clean state before its receipt, so a `converged` base keeps the text before it for that save (`convergedBeforeReceipt`).
  - The test is in `npm run test:editor-sync` (where the editor sync's tests run, and which `scripts/validate-qa.sh` runs), not `npm test`.
  - Review changes' words: the Experience lead's for this case, carried by `document:conflict`'s optional `reason` (a webview change, so `media/webview.js` is rebuilt in PR 1).

## Workstream 2: unreadable cards (R2)

- **The store.** `reread` records why a file wasn't read. The entry gains `reason: 'read' | 'format'` (optional on the wire) and a plain `message`: a timeout or busy file ("Ritemark couldn't open this file in time. If this folder syncs from the cloud, the file may still be downloading."), a permission refusal, anything else; the raw error goes to the log, not the screen. `BoardStore.test.ts:408–410` changes for the new words and keeps its point (the file is listed as unreadable; the board still loads). The words are the Experience lead's to approve.
- **Try again.** `board/retry-file { fileName }` calls the existing `invalidate(fileName)`, then the controller refreshes. If A8 shows that a hung read holds the tail, the file is read before the lock is taken and applied under it.
- **Remove.** `board/remove-file { fileName }`: the host checks that the name is a bare card file name (`isCardFileName`), is an `unreadable` entry of this board, and resolves inside `tasksDir`; then `fs.trash` (the Trash, the Recycle Bin), then the entry and its provisional id go, and the board refreshes. A failure leaves the row and returns a plain message. A card the hand-off ledger knows (`CardHandoffLedger.ts:338,385` already treats a gone or unreadable card) must not come back from the ledger; checked in the test.
- **The webview.** `UnreadableCards.tsx`: a row per file with its actions, shadcn `Button` with a `Tooltip`; the row's open-the-file area stays for the format kind. The question reuses `DeleteConfirm`'s dialog pattern with a file name instead of a card id (`confirmDeleteId` becomes a target that can be either). The drawing is the Experience lead's first.
- **Tests:** the store's reasons and words; the handler's refusals (S17); a render test of both kinds of row; the question; the Trash failure (S16).

## Workstream 3: a dropped card moves at once (R3)

After A8, so the fix goes where the second goes.

- **The optimistic move** (`boardClient.ts`, which owns the snapshot the components read; the pure placement function exported for tests): `moveCard` records a pending move (`cardId`, target stage, `beforeCardId` or end) and the components read the snapshot with the pending moves applied, so the card is in its new place in the same render. `act`'s answer decides: a refusal or a failed write drops the pending move (the card goes back) and the notice shows as today; success keeps the pending move until a snapshot shows the card in the target stage, or until a snapshot after a cap. This handles the stale snapshot built before the write (S23). If A8 shows stale snapshots can arrive after the answer, the answer and the snapshots get a revision number (optional fields) and the pending move ends at the first snapshot with a revision at or after the answer's.
- **Every move goes through it:** `moveCard` is the one function the drop, Move to…, Mark done, Reopen and the card page call (`boardUi.ts:102`), so S24 is one change.
- **Other surfaces** (the side bar, other tabs) have their own webviews and see the move when the host pushes, as today. Only the surface that moved draws it early.
- **The quiet sign:** a small state on the card while its move is pending longer than a short delay; the Experience lead draws it.
- **By A8, the host:** if the snapshot is the slow part, the file-exists checks for attached files (`BoardController.ts:274–279`) are cached between refreshes or run for the changed cards only; if `move` reads the board twice, once; if a re-read holds the tail, R2's change. Each is a behaviour-preserving change with a test.
- **Tests:** the placement function (before a card, at the end, within a column, a card gone); the pending move with a refusal, a failure, a stale snapshot, two moves in a row, and the cap; a render test of the sign; the host's changes by A8.
- **The check:** a CDP run on a dev instance: drop a card, read its column in the next frame; and the same with the host's answer held back.

## Workstream 4: Flows don't save on a look (R4)

- `flowEditorStore.ts` `onNodesChange`: `isDirty` becomes true only when a change is not `select` or `dimensions`. The node list still updates for every change (a selection must show), and the execution order still recalculates when a change can alter it.
- If A9 shows the save 100 ms after the click, and the debounce is 500 ms, the second write path is found (for example a node data update on selection) and closed in the same change.
- **Tests:** `flowEditorStore.test.ts` (new or added to the store's existing test): `onNodesChange` with `select`, `dimensions`, `position`, `add`, `remove` (S26); the harness (S27) as the check.

## Workstream 5: the missing-key words (R5)

- `flowModelDefaults.ts`: a copy object per key (`OPENAI_KEY_NEEDED`, `GOOGLE_AI_KEY_NEEDED`), the Experience lead's sentences and tooltips word for word; `GOOGLE_IMAGE_KEY_NEEDED` keeps its text (the Google image step's words are the same sentence).
- `ImageNodeExecutor.ts:224`, `LLMNodeExecutor.ts:197` and `:272`, and `FlowEditorProvider.ts:870` throw `StepNeedsKeyError` with the right copy. A run's error stays plain text (the existing path).
- **Settings:** `SettingsSection` gains `'openai-api-key'`; the OpenAI card gets `id="settings-section-openai-api-key"`, beside the Google card's. This is the one line in `src/settings/`, which is why PR 3 names its tier honestly.
- **The panel:** the image step's panel already shows the sentence and link from the model list's error. An AI step's panel has no such check today: for an AI step, `flow:getModels` for the LLM list also answers with `error` and `errorAction` when that provider's key is missing, the host checking only that a key exists. `NodeConfigPanel.tsx` shows it for both step kinds in one place, and the tooltip carries the key's name.
- **Tests:** the copy objects and thrown errors; the host's answer with and without a key; the panel's render for each; the anchor scroll. The existing `modelConfig.test.ts` expectations for the Google copy stay.

## Workstream 6: the done card (R6)

- `RuntimeNotice.tsx`: the `success` tone draws in ink (the heading's colour); the soft background by the Experience lead's answer. `TurnFailureCard` is unchanged unless the tone is renamed.
- The other uses of the success colour (the table above) go to the Experience lead as a list. None changes in this PR without the word.
- **Tests:** a render test pinning the check's class and absence of `--r-success`, as `OnboardingWizard.test.ts` does for "You're all set!". Screenshots in Light and Dark.

## Workstream 7: Settings' version (R7)

- `webview/components/settings/`: a small pure `versionLabel(version)` that drops a bare `-0` suffix (`/-0$/`) and nothing else, used for the extension version in the versions line. `pendingRestartVersion` and `availableUpdate.version` are `-ext.N` values and are not passed through it.
- Nothing in `src/update/`. The update comparison keeps the floored value.
- **Tests:** `versionLabel.test.ts` (S37); the update service's existing tests (S38).

## Workstream 8: the log lines (R8)

- **The font.** If A7 confirms patch 001's `iconRegistry.ts` registration, the hunk registers the font at its real place the way the codicon font does, through `create-patch.sh` onto patch 001 (no new patch file). It goes in PR 5, on a CoW-cloned, patched `vscode/`.
- **DEP0169.** The caller found by A7: Ritemark's code or a bundled dependency moves to `new URL()` or to a version that has; VS Code's own is recorded, and what stays is said.
- **Check:** `main.log` and `exthost.log` of a fresh hidden launch (S39, S40), then on the candidate (S41).

## Workstream 9: the project switch (R9)

By A3. Candidates, in the order the data points to them:
1. **The extension's timers** (`permanentTabs.ts:159`, `extension.ts:379–382`): the AI column shown with the landing, with the same `preserveFocus`, so it doesn't wait for 4 s; or Home waits for it. Extension-tier, PR 2.
2. **The workbench's restore** (the document in front for about 440 ms before the extension exists): patch 002/018, PR 5. This is the one that needs the shell and the Windows proof at Gate 2.
The first switch of a launch (the outlier) is checked on its own.

## Workstream 10: the first Windows start (R10)

- **The second flash, extension (PR 2):** `welcomeHost.ts` keeps sending a restored terminal behind the welcome through its first minute instead of zeroing `keepInFrontUntil` after one reveal; the person using the welcome still ends the hold (`welcomeHost.ts:595`). A unit test of the rule; checked on Windows.
- **The first wait, shell (PR 5), by A4 and decision 3:** in `RitemarkTerminalTabs.moveToDesk` (patch 019), a revived terminal is not opened into a group that has no tab in front, or waits for one. A person's own new terminal still opens in front. Through `create-patch.sh` onto patch 019, checked on a CoW-cloned, patched `vscode/`.
- If A4 shows another cause, this section changes first.

## Workstream 11: the keyboard (R11)

By A5; no code before a reproduction. `scripts/qa/home-keys-check.mjs` is added either way. If a person reproduces it, the three places Sprint 143 listed are checked in order (Home's page, Ritemark's host moving the focus, VS Code's webview host); a patch hunk would be shell-tier and go in PR 5 under the scope-change protocol.

## Workstream 12: the Electron (R12)

By A6. If a 43.x with Node 24.22.1 or later is published: patch 020 gets the new target in `.npmrc`, Electron's own `SHASUMS256.txt` byte for byte in `build/checksums/electron.txt`, the new versions in `cgmanifest.json`, and its header is updated, as Sprint 144 did. PR 6 on a CoW-cloned, patched `vscode/`: `./scripts/apply-patches.sh --dry-run` passes, the native-module ABI is checked, the extension host and the integrated browser start, About shows the Node version. If none is published, no PR: the risk goes in the release plan's Risks and on the issue, with decision 4.

## Delivery plan

Six PRs, listed with their tiers in the sprint plan. How each gets there:
- Each branch is made from `origin/main` after approval; `git branch --show-current` shows it before any edit. The documents in this folder are updated in the PR that does the work.
- Each PR's Risk section names its tier and the paths that set it. `REVIEW.md`'s review runs at that tier on the PR's head; every finding is answered; the merge is at the reviewed head. At most three rounds.
- **PR 5 and PR 6** are built on a CoW-cloned, patched `vscode/` in the worktree, through `create-patch.sh` onto the existing patches, with the drift check at merge, and a frame check (`scripts/qa/frame-screenshots.mjs`) if a hunk touches patch 018. **PR 1 too, since 1 November** (patch 014's reload participant): shell-tier, High.
- **Gate 2 on Windows** carries the proof for what the overlay can't test (PR 5 and PR 6).
- Everything merges before 2.2's first release candidate; main is frozen from that build.

## Coordination

- **Sprint 146** (controls and the frame) changes tooltips, narrow buttons and focus in `components/ui/`. R2's buttons are the shared Button with a Tooltip; this sprint restyles nothing. 146's #598 puts a task card in a dialog over the board: PR 4 lands first, and the two meet in `components/tasks/`.
- **Sprint 147** (the new Settings) rebuilds Settings from today's cards. R5's section id and R7's label helper are what it takes over.
- **The Experience lead** sees the screenshots before each UI merge and supplies the drawings and words in the sprint plan.
- **The "Ritemark on Windows" session** runs A1's Windows half, A4, A5 and the overlay checks.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The guard asks where a writer was right | The false-positive set is run before the window and threshold are fixed; decision 1 names the cost |
| A text isn't in the memory when its receipt arrives | Then nothing is guarded for that save, which is today's behaviour; the memory keeps every state seen in the change event |
| A large document's texts are too big to keep | A size bound; the document runs without the guard and the record says where the limit is |
| A stale write long after the last save still wins | S8 says so in plain words; A2 shows which AI tools refuse such writes themselves |
| "Couldn't read" hides a class of error we map wrongly | The mapping has a default sentence; the raw error is in the log; the Experience lead approves the words |
| Remove trashes the wrong file | The handler accepts only a bare name that is an unreadable entry of this board; S17 |
| The optimistic move disagrees with the host | The host stays the authority; a refusal puts the card back; S20–S23 |
| A Try again on a hung file holds the board | A8 measures it; the read moves out of the lock if it does |
| #569's cause is in the workbench | PR 5 and the tier line; Windows proof at Gate 2 |
| (1 Nov) The writer's copy has no base (a whole-file rewrite or a reformat) | The fallback question within 30 s; the false-positive set fixes the base threshold; A2's tools when someone can sign one in |
| (1 Nov) The merge's undo step in the editor fights VS Code's own undo of the same document | A11 before the code; the custom editor's double-undo rule (`editorUndoKeybindings`) is the place |
| (1 Nov) The AI isn't known as the writer | A10; the words say "another app" |
| #501's guess about empty groups is wrong | A4 reads the source and runs the reproduction before any patch |
| The OpenAI section id collides with Sprint 147's new Settings | The id is the key's own name, the same as the Google one; 147 carries it over |
| No fixed Electron by the candidate | Decision 4 and the release plan's Risks |
| Six PRs' reviews slow the sprint | Each is small and single-tier; PR 2 and 3 may merge as one |
