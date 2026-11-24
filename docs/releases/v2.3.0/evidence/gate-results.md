# v2.3.0 gate results

The candidate is RC4, `e4e642cca402d40fa6fc9fbe1b8c347d0d45dd06`, built on 23 November 2026 in `.worktrees/release-e4e642cca402`. It is RC3 plus the fix for #978 (PR #979, patch 022): a document double-clicked in Finder or Explorer while Ritemark is closed opens in Ritemark's editor.

## Release session, arm64 (23 November)

- **The build** ran with `build-prod.sh` in a new release worktree. `codesign-app.sh` signed 48 components with 0 failures. The bundle carries `registerSingleton(ICustomEditorService, …, Eager)`.
- **The DMG** was made with the `ditto` + `hdiutil` fallback, because `create-dmg` stopped on Finder's AppleScript error -1743, as expected here. It was signed and built at 17:24 EET, un-notarized SHA-256 `0adc5a43…a6c0`.

## Gate 1, macOS arm64

- **The Development manager's smoke test on the installed RC4:** 29 passed, 0 failed. Publish was not run, because test windows never sign in. The run covered:
  - Settings, a document round-trip read back from disk, the Task board and search;
  - Decks: a new deck, the handout, themes, slide settings, `/` blocks, Present, Save as PDF, the Slide library, a `.rtms` from Documents;
  - Excel: a one-cell save left `styles.xml` byte-identical, and sorting left the file unchanged;
  - pictures, tables, Tabs, Button and `/photo`.
- **Row 24za on the Mac** (double-click with Ritemark closed, used isolated profile): `.md` 3/3 and `.rtms` 3/3 opened in Ritemark's editor.
- **Five smoke-test findings** went to v2.4.0 as issues #980–#984, on Jarmo's word. None blocks 2.3.
- **Jarmo:** "Gate 1 passed" (23 November, 19:12 EET).
- **Notarized** more than 60 minutes after the DMG was built: Accepted, stapled, validated. Published SHA-256 `c6f7adb6…852f`.

## Gate 2, macOS x64 and Windows

- **macOS x64:** CI run 45200955347 at `e4e642cc`. `codesign-app.sh darwin-x64` with `RITEMARK_RELEASE_COMMIT=e4e642cc…` signed 49 components with 0 failures. The DMG was built with the fallback at 18:01 EET, un-notarized SHA-256 `86bb5fc1…`. Notarized after Gate 2 and the hardening hour: Accepted, stapled, validated. Published SHA-256 `e2b080f3…359b`.
- **Windows:** CI run 45200964871 at `e4e642cc`. The round-trip passed: fresh install and an update from 1.14.0 (the CI's pinned earlier installer, `8f109ea8…`) both started the app, and the update left no stale files (`win32-roundtrip/`). Installer SHA-256 `8eb804c6…54a6`.
- **Row 24za on Windows:** with Ritemark closed, 10/10 on a used and on a fresh profile. With Ritemark already open, Jarmo's own double-click worked.
- **Jarmo:** "Gate 2 passed" (23 November).
