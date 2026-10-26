# Sprint 137 Tasks

Nothing here starts before Jarmo approves the plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] Jarmo's approval of this plan, with his answers to *Decisions for Jarmo* written into `sprint-plan.md` and, where they change a requirement, into `spec.md` first *(approved 26 October by the Development manager under Jarmo's delegation; the answers are in sprint-plan.md, and spec.md follows them)*
- [x] `git checkout -b sprint-137-files-as-written` from `origin/main`; `git branch --show-current` shows it *(rebased onto main after #540 merged)*
- [x] VS Code at the pin with all patches from reset, clean and apply (a copy-on-write clone for the worktree)
- [x] Patch 014's file list and hunk count in `notes/patches-before.md` (`PATCH-RULES.md` §8)
- [x] `media/webview.js` size in `notes/bundle.md` (E3)

## Phase 1: Audits first

- [x] `research/fidelity-audit.md` (R1–R9): *(the bytes are the evidence, screenshots were not kept; the captures are modelled by the team, no real Google Docs or Obsidian export)*
  - the pre-audit's three losses and #270's two cases reproduced in a dev build, each with a screenshot and `cat -A` after one and two saves;
  - the real-tool captures, scrubbed and sorted into kept, known or cleanup;
  - the frequency checks (`1. 1. 1.`, `_em_`, a list under a line in an item);
  - the second-save instability's form;
  - every webview path that parses or serializes Markdown
- [ ] With Jarmo's yes (question 5): his folder measured on his Mac, numbers per class only, recorded in the audit *(not done: no folder named, and reading `~/Documents` from the session can raise a privacy prompt on Jarmo's screen; the measure is ready)*
- [x] `research/save-conflict-audit.md` (R10, R11): *(on the Mac; Windows and OneDrive in the Windows round)*
  - the two prompts reproduced on the Mac, and on Windows through the Development manager's Windows session;
  - every path into `FILE_MODIFIED_SINCE`;
  - Ritemark's `editorId` and `findEditors` with Ritemark, a text editor and both;
  - `executeCommand` before the extension registers;
  - each resolution's end state;
  - the disk-unchanged case, a OneDrive folder included
- [x] Where an audit changes a requirement, `spec.md` changes first (the scope-change protocol), then scenarios, plan and tasks *(spec.md's *Scope changes during the sprint*)*

## Phase 2: The pipeline in one module (W1)

- [x] Write the corpus files: `webview/src/utils/fidelity-corpus/kept/`, `known/` with `*.expected.md`, `cleanup/` with `*.expected.md`, from the audit's captures and #270's fixtures. No real names, paths, addresses or accounts
- [x] `look-baseline.json` captured from `main`'s pipeline before any change (R7)
- [x] `webview/src/utils/editorMarkdown.ts`:
  - `editorMarked` with the lazy comment tokenizer;
  - `markdownToEditorHTML`;
  - `editorHTMLToMarkdown`;
  - `preprocessTableHTML`;
  - `createEditorTurndownService`;
  - `markdownSchemaExtensions`
- [x] `Editor.tsx` uses it at all three parse places and for `serializeEditorHTML`; the image's node view stays in the editor; `App.tsx` imports `preprocessTableHTML` and the service from it
- [x] The existing round-trip tests switched to the module, all green, with no assertion changed
- [x] The look baseline equal before and after the move

## Phase 3: The corpus test (W2)

- [x] `webview/src/utils/markdownFidelity.test.ts`:
  - byte identity after one save and after two;
  - the one-word edit;
  - the known and cleanup outputs;
  - no loss;
  - the negative fixtures;
  - the look baseline;
  - no trailing whitespace
- [x] The test joins `test:editor-sync` in `extensions/ritemark/package.json`. It fails on `main`'s behaviour, and the failures are recorded in `notes/corpus-before.md`
- [x] The CRLF and BOM test through `serializeSyncEdit` and `encodeDocumentBytes` (R9)
- [x] `scripts/qa/markdown-fidelity-measure.mjs`, the measuring harness, for the before and after numbers

## Phase 4: Lists, breaks and whitespace (W3, W4; R1–R3)

- [x] `webview/src/utils/markdownAsWritten.ts`: the `list` renderer extension and the lexer walk for `mdAttached`; the tab check; `markdownAsWritten.test.ts`
- [x] The list attributes on `BulletList`, `BoundedOrderedList` and `TaskList`, data-only, from the source alone *(as global attributes from one `MarkdownAsWritten` extension)*
- [x] `transformTaskListElements` marks continuation runs (`data-md-continues`)
- [x] The Turndown list, list-item, tight-paragraph and attached-list rules; `tiptapTaskItem`'s space-joining gone; empty lines never indented
- [x] The `br` extension, `HardBreak`'s `mdBreak` and the `br` rule (the new-break form per question 3) *(`data-md-break`; a typed break is a backslash (decision 3))*
- [x] The blockquote rule's empty `>` lines
- [x] Corpus: R1–R3's kept files byte-identical; S1–S16 in a dev build *(S7, S8 and S12 by test: keyboard input does not reach a hidden window)*

## Phase 5: The other forms, front matter, nothing lost, new writing (W4–W7; R4–R8)

- [x] `hr`, `link` and `table` renderer extensions and their attributes; `mdAlign` on cells, data-only
- [x] The rules for thematic breaks (with the first-block case), bare and angle links, table rows and cells, and empty cells
- [x] The escape changes in `turndownService.ts`: underscores in words, brackets that open no link, line-start escapes at the start of a line; the negative fixtures *(plus the backslash and `<` scope changes)*
- [x] `serializeFrontMatter` keeps the head when the properties are unchanged; its test, dates included (R5) *(`editorSync/frontMatter.ts`)*
- [x] `CustomLink`'s `isAllowedUri`; its accepted and refused addresses test (R6)
- [x] `Code` mark `excludes: 'code'`; S29 and S33's code checks (R6)
- [x] The block image rule; S30 (R6)
- [x] The defaults in `createTurndownService` (R8); the Word preview's Save as Markdown checked (S36) *(S36 by test, not with a `.docx` in the app)*
- [x] Corpus: every kept file byte-identical, the known and cleanup outputs pinned, the look baseline equal apart from R6's listed exceptions

## Phase 6: One question for a conflict (W8; R10, R11)

- [x] Patch 014: the hand-over in `textFileSaveErrorHandler.ts`, `ICommandService`, `shouldHandSaveConflictToRitemark`, `ritemarkSaveConflict.test.ts`; the patch header's file list and *Updated* line
- [x] `classifyRefusedSave` in `editorSync/state.ts`, with tests from the audit's table
- [x] `_ritemark.editorSync.answerSaveConflict` in `DocumentSyncCoordinator.ts`: Review changes, the notification for a hidden tab, the converged revert, the disk-unchanged save *(the converged and disk-unchanged cases are answered with the shell's own overwrite save, not a revert or an extension-side write)*
- [x] Dry run, real apply from pristine, a second run clean; `node scripts/check-patch-stacking.mjs`; `compile-check-ts-native` green; the file list diffed against `notes/patches-before.md` *(`typecheck-client` in place of `compile-check-ts-native`, which VS Code 1.142 no longer has)*
- [x] S40–S49 on the Mac *(S46 and S48 not run; qa-evidence.md)*

## Phase 7: QA, merge and closeout

- [x] `media/webview.js` measured after; `notes/bundle.md` (E3)
- [x] Docs (E4): *(2.1's notes draft is `notes/release-notes-draft.md`, so the four sprints don't write one file at once)*
  - `architecture.md`: the editor's Markdown pipeline, and the hand-over in *Editor–disk synchronization*;
  - `CLAUDE.md`'s and `PATCH-RULES.md`'s rows for 014;
  - `docs/CHANGELOG.md`;
  - 2.1's notes draft, with the bound in plain words
- [x] Manual QA on the Mac: S1–S49, evidence in `qa-evidence.md`, with what could not be run here and why *(what could not be run is listed there)*
- [ ] The look: S32's screenshots of `main` and the branch, to the Experience lead with the PR (memory: match the Experience prototype) *(not done)*
- [x] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; Jarmo's "admin merge", naming the PR *(PR opened; the review, the smoke test by the manager and the merge are pending)*
- [ ] After the merge: a production build from a clean-room worktree at the merged commit, as a build check (E5)
- [ ] After the merge: the Windows round from main for S38 and S40–S48 (E5)
- [ ] After the merge: the drift check for patch 014 on the newest VS Code release, into the release plan's risk register (E5)
- [ ] The out-of-bound list as one GitHub issue for after 2.1, with each fixture and today's output; the Development manager files it (E6) *(drafted in `notes/out-of-bound.md`)*
- [ ] Linked issues: #270 and #454 closed with evidence, or updated with what is left
- [ ] Release plan: tracker, feature-complete rows and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
