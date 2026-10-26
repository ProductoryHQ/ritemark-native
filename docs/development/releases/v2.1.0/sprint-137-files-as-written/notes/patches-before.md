# Patch 014 before and after (PATCH-RULES.md §8)

VS Code pin: `d956e8a6ac5d904486557eea07e1d6bd62a4d36f` (1.142.0), unchanged by this sprint.

## Before (main, 08761e71)

`014-ritemark-save-receipts.patch`: 7 files, 16 hunks.

- `src/vs/workbench/api/browser/mainThreadDocuments.ts`
- `src/vs/workbench/api/common/extHost.protocol.ts`
- `src/vs/workbench/api/common/extHostDocumentData.ts`
- `src/vs/workbench/api/common/extHostDocuments.ts`
- `src/vs/workbench/services/textfile/common/textFileEditorModel.ts`
- `src/vs/workbench/services/textfile/common/textfiles.ts`
- `src/vs/workbench/services/textfile/test/browser/textFileEditorModel.test.ts`

## After (this branch)

`014-ritemark-save-receipts.patch`: 9 files, 22 hunks. The seven files above are byte-for-byte the same hunks; two files are added:

- `src/vs/workbench/contrib/files/browser/editors/textFileSaveErrorHandler.ts` (5 hunks): `ICommandService` in the constructor, `RITEMARK_EDITOR_ID`, `RITEMARK_ANSWER_SAVE_CONFLICT_COMMAND`, `shouldHandSaveConflictToRitemark`, one line at the top of `onSaveError` (with its `ritemarkDeclined` parameter), `handOverToRitemark` and `askRitemark`.
- `src/vs/workbench/contrib/files/test/browser/ritemarkSaveConflict.test.ts` (new, 1 hunk): which refused saves go to Ritemark.

No other patch touches either file, and no patch is added (one domain per patch, §1). The diff was made with `scripts/create-patch.sh` on each file, and the two temporary patches were folded into 014 with its header's *File(s)* and *Updated* lines.

## Checks (26 October 2026)

From `git reset --hard HEAD` and `git clean -fd -e extensions/ritemark` in `vscode/` at the pin:

- `./scripts/apply-patches.sh --dry-run`: 18 can apply, 0 already applied, 0 conflicts.
- `./scripts/apply-patches.sh`: 18 applied. A second run: 0 applied, 18 already applied.
- `node scripts/check-patch-stacking.mjs`: "Patch stacking OK: 18 patches, no hunk builds on another patch's lines outside the known pairs."
- `npm run typecheck-client`: exit 0. (`compile-check-ts-native`, which the plan names, no longer exists in VS Code 1.142; `typecheck-client` is the type check of `src/` it has.)
- `npm run build-fast -- --client-only`: exit 0.
- `./scripts/test.sh --grep "Ritemark save conflict|TextFileEditorModel"`: 55 passing, the two hand-over tests among them.
