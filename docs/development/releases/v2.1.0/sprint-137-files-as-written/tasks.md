# Sprint 137 Tasks

Nothing here starts before Jarmo approves the plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [ ] Jarmo's approval of this plan, with his answers to *Decisions for Jarmo* written into `sprint-plan.md` and, where they change a requirement, into `spec.md` first
- [ ] `git checkout -b sprint-137-files-as-written` from `origin/main`; `git branch --show-current` shows it
- [ ] VS Code at the pin with all patches from reset, clean and apply (a copy-on-write clone for the worktree)
- [ ] Patch 014's file list and hunk count in `notes/patches-before.md` (`PATCH-RULES.md` §8)
- [ ] `media/webview.js` size in `notes/bundle.md` (E3)

## Phase 1: Audits first

- [ ] `research/fidelity-audit.md` (R1–R9):
  - the pre-audit's three losses and #270's two cases reproduced in a dev build, each with a screenshot and `cat -A` after one and two saves;
  - the real-tool captures, scrubbed and sorted into kept, known or cleanup;
  - the frequency checks (`1. 1. 1.`, `_em_`, a list under a line in an item);
  - the second-save instability's form;
  - every webview path that parses or serializes Markdown
- [ ] With Jarmo's yes (question 5): his folder measured on his Mac, numbers per class only, recorded in the audit
- [ ] `research/save-conflict-audit.md` (R10, R11):
  - the two prompts reproduced on the Mac, and on Windows through the Development manager's Windows session;
  - every path into `FILE_MODIFIED_SINCE`;
  - Ritemark's `editorId` and `findEditors` with Ritemark, a text editor and both;
  - `executeCommand` before the extension registers;
  - each resolution's end state;
  - the disk-unchanged case, a OneDrive folder included
- [ ] Where an audit changes a requirement, `spec.md` changes first (the scope-change protocol), then scenarios, plan and tasks

## Phase 2: The pipeline in one module (W1)

- [ ] Write the corpus files: `webview/src/utils/fidelity-corpus/kept/`, `known/` with `*.expected.md`, `cleanup/` with `*.expected.md`, from the audit's captures and #270's fixtures. No real names, paths, addresses or accounts
- [ ] `look-baseline.json` captured from `main`'s pipeline before any change (R7)
- [ ] `webview/src/utils/editorMarkdown.ts`:
  - `editorMarked` with the lazy comment tokenizer;
  - `markdownToEditorHTML`;
  - `editorHTMLToMarkdown`;
  - `preprocessTableHTML`;
  - `createEditorTurndownService`;
  - `markdownSchemaExtensions`
- [ ] `Editor.tsx` uses it at all three parse places and for `serializeEditorHTML`; the image's node view stays in the editor; `App.tsx` imports `preprocessTableHTML` and the service from it
- [ ] The existing round-trip tests switched to the module, all green, with no assertion changed
- [ ] The look baseline equal before and after the move

## Phase 3: The corpus test (W2)

- [ ] `webview/src/utils/markdownFidelity.test.ts`:
  - byte identity after one save and after two;
  - the one-word edit;
  - the known and cleanup outputs;
  - no loss;
  - the negative fixtures;
  - the look baseline;
  - no trailing whitespace
- [ ] The test joins `test:editor-sync` in `extensions/ritemark/package.json`. It fails on `main`'s behaviour, and the failures are recorded in `notes/corpus-before.md`
- [ ] The CRLF and BOM test through `serializeSyncEdit` and `encodeDocumentBytes` (R9)
- [ ] `scripts/qa/markdown-fidelity-measure.mjs`, the measuring harness, for the before and after numbers

## Phase 4: Lists, breaks and whitespace (W3, W4; R1–R3)

- [ ] `webview/src/utils/markdownAsWritten.ts`: the `list` renderer extension and the lexer walk for `mdAttached`; the tab check; `markdownAsWritten.test.ts`
- [ ] The list attributes on `BulletList`, `BoundedOrderedList` and `TaskList`, data-only, from the source alone
- [ ] `transformTaskListElements` marks continuation runs (`data-md-continues`)
- [ ] The Turndown list, list-item, tight-paragraph and attached-list rules; `tiptapTaskItem`'s space-joining gone; empty lines never indented
- [ ] The `br` extension, `HardBreak`'s `mdBreak` and the `br` rule (the new-break form per question 3)
- [ ] The blockquote rule's empty `>` lines
- [ ] Corpus: R1–R3's kept files byte-identical; S1–S16 in a dev build

## Phase 5: The other forms, front matter, nothing lost, new writing (W4–W7; R4–R8)

- [ ] `hr`, `link` and `table` renderer extensions and their attributes; `mdAlign` on cells, data-only
- [ ] The rules for thematic breaks (with the first-block case), bare and angle links, table rows and cells, and empty cells
- [ ] The escape changes in `turndownService.ts`: underscores in words, brackets that open no link, line-start escapes at the start of a line; the negative fixtures
- [ ] `serializeFrontMatter` keeps the head when the properties are unchanged; its test, dates included (R5)
- [ ] `CustomLink`'s `isAllowedUri`; its accepted and refused addresses test (R6)
- [ ] `Code` mark `excludes: 'code'`; S29 and S33's code checks (R6)
- [ ] The block image rule; S30 (R6)
- [ ] The defaults in `createTurndownService` (R8); the Word preview's Save as Markdown checked (S36)
- [ ] Corpus: every kept file byte-identical, the known and cleanup outputs pinned, the look baseline equal apart from R6's listed exceptions

## Phase 6: One question for a conflict (W8; R10, R11)

- [ ] Patch 014: the hand-over in `textFileSaveErrorHandler.ts`, `ICommandService`, `shouldHandSaveConflictToRitemark`, `ritemarkSaveConflict.test.ts`; the patch header's file list and *Updated* line
- [ ] `classifyRefusedSave` in `editorSync/state.ts`, with tests from the audit's table
- [ ] `_ritemark.editorSync.answerSaveConflict` in `DocumentSyncCoordinator.ts`: Review changes, the notification for a hidden tab, the converged revert, the disk-unchanged save
- [ ] Dry run, real apply from pristine, a second run clean; `node scripts/check-patch-stacking.mjs`; `compile-check-ts-native` green; the file list diffed against `notes/patches-before.md`
- [ ] S40–S49 on the Mac

## Phase 7: QA, merge and closeout

- [ ] `media/webview.js` measured after; `notes/bundle.md` (E3)
- [ ] Docs (E4):
  - `architecture.md`: the editor's Markdown pipeline, and the hand-over in *Editor–disk synchronization*;
  - `CLAUDE.md`'s and `PATCH-RULES.md`'s rows for 014;
  - `docs/CHANGELOG.md`;
  - 2.1's notes draft, with the bound in plain words
- [ ] Manual QA on the Mac: S1–S49, evidence in `qa-evidence.md`, with what could not be run here and why
- [ ] The look: S32's screenshots of `main` and the branch, to the Experience lead with the PR (memory: match the Experience prototype)
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; Jarmo's "admin merge", naming the PR
- [ ] After the merge: a production build from a clean-room worktree at the merged commit, as a build check (E5)
- [ ] After the merge: the Windows round from main for S38 and S40–S48 (E5)
- [ ] After the merge: the drift check for patch 014 on the newest VS Code release, into the release plan's risk register (E5)
- [ ] The out-of-bound list as one GitHub issue for after 2.1, with each fixture and today's output; the Development manager files it (E6)
- [ ] Linked issues: #270 and #454 closed with evidence, or updated with what is left
- [ ] Release plan: tracker, feature-complete rows and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
