# Sprint 136: QA evidence

Status: **Pass**, **Partial** (what was not run is named), **Not run** (with the reason), **Later** (the dress rehearsal or a gate).

## The dev walk of the first sprint PR (20 October)

A dev build of the sprint branch on VS Code 1.142 (Electron 43.7.7), launched in the background (`open -n -g`) with its own short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, `--use-mock-keychain` and the three backgrounding flags, driven over CDP. Projects: a copy of the shipped sample project ("Leadership programme"), and two scratch folders (`plain`, `With space`). Claude was signed in through this Mac's own login, so the turns ran on the updated Claude Code 2.1.304. ChatGPT was signed in too; no ChatGPT turn was sent (the 19 October rule for the real `~/.codex`).

| Scenario | Status | Evidence and notes |
|---|---|---|
| S35 A task card's tab (#477) | Pass, with one finding | Opening "Draft Module 4 from the brief" from the board: the tab reads "Draft Module 4 from th…" with the check-square, and the chip shows the check-square and the full title. A plain document keeps its name ("Module 1.md"). **Finding:** after a restart, a card tab that is not in front reads its file name ("m4d7r2-draft-module-4.md") until it is clicked, because VS Code resolves a background tab only when it is shown and does not keep a webview's title. Recorded for the Experience lead; not fixed here |
| S36 The chip follows the document in front (#485) | Pass | Module 1 in front: "Active: Modules/Module 1.md". Closed with the card behind it: the chip names the card. The last document closed (Home in front): no chip. A document deleted from disk while open (in a window whose file watcher works): the chip goes |
| S37 Codex on a free account (#482) | Partial | ChatGPT is signed in on this Mac, so the signed-out line was not shown on screen. The built bundle carries "Any ChatGPT account works, Free included. Paid plans get higher limits." and no "Requires ChatGPT Plus" |
| S38 Dictation's first language (#486) | Pass on an English Mac | The control reads as drawn: the microphone, then "EN ⌄"; the microphone's tooltip "Dictate, in English". Picking Finnish through More languages… only set it: nothing recorded, the control read "FI" and "Dictate, in Finnish". Finnish was still set in another document's editor and after Reload Window, and the menu ticks it. A computer in another language is covered by the unit tests (`dictationLanguage.test.ts`, `systemLanguage.test.ts`), not on screen |
| S39 The left column stays (#487) | Pass, after a fix | With the column on Home, a chat's start and end leave Home. With the column closed, a turn that wrote a file left it closed. **Found:** without any refresh, Documents did not list a file Claude wrote: that window's file watcher had stopped delivering (see below), which is bug #33, the reason the refresh existed. **Fixed:** patch 002 gives Refresh Explorer `{ reveal: false }`, and every turn's end refreshes Documents without opening it. Re-run on the fix: the column stayed closed through a turn that wrote `later.md`, Documents listed it when opened, and a turn with Home showing left Home |
| S40 A restored chat's time (#488) | Pass for a restart | After Reload Window the restored chat read "Done in 11s" and its earlier turn "Activity (4 steps · 9.3s)". A project switch goes through the same projection; it is checked at the dress rehearsal |
| S41 A flow's Claude step, signed out (#459) | Partial | Claude was signed in (signing out would sign Jarmo out), so the run was not made. The built extension carries "Claude is not signed in. In Ritemark Settings, sign in with Claude.ai under API Keys, then run the flow again." and no "under Agent Runtime" |
| S34 Our own runs are marked (#480) | Later | A dev run is always `dev`; the marker is for installed builds. Unit-tested (`consent.test.ts`); on the dress rehearsal's build |
| S42 A fresh profile with another build's recents (#475) | Partial | The run's log: "Creating shared storage database at …/rm136/shared/sharedStorage/state.vscdb", so the flag isolates the recent list. The installed app's list before and after is checked at the dress rehearsal |
| S18 A Claude turn (arm64, dev) | Pass | Four Claude turns on 2.1.304 in the 1.142 shell: "pong" (Done in 4.3s), two file writes (11s, 9.3s), "ok" (4.2s). The first signed-in turn on 1.142 |

### Found in the walk

- **A payload key the editor refused.** The first build put the operating system's language into the editor's render payload without adding it to the payload's parser, which accepts only known keys, so every Ritemark document stayed on "Loading…". `test:editor-sync` covers that parser and `npm test` does not; the parser now takes `systemLanguage`, with a test, and every offline `test:*` script runs before a PR.
- **A keychain prompt.** The first launch left out `--use-mock-keychain`; an unsigned dev Electron then asks the keychain, a password prompt lands on the screen, and the main process blocks (CDP hung). The instance was stopped at once, which withdraws the prompt. The `ritemark-automation` skill's launches now carry the flag.
- **A window's file watcher stopped delivering** in two of three windows (one after a Reload Window, one after a few Claude turns): Documents kept a deleted file and missed new ones, while a third window on the same instance kept working. Not reproduced on demand and not explained. The turn-end refresh covers what the AI writes; whether a production build's watcher behaves the same is checked at the dress rehearsal (S39 there, with a file created outside Ritemark).
- **1.x words in app strings**, seen by the user-docs pass: the board's "at the bottom of the Tasks side bar" (`BoardColumns.tsx`), and the Google Docs notifications' "Future Syncs" and "Remove publishing link". For the Experience lead's copy pass.

### Checks

- Every offline test script passes: `npm test`, `test:conversations`, `test:editor-sync`, `test:thinking-effort`, `test:sprint113-language`, `test:task-list-roundtrip`, `test:security-backports`, `test:claude-auth`, `test:update`, `test:integration:free`. `test:integration` was not run (it calls real models).
- The extension compiles (`tsc` and esbuild) and the webview builds; VS Code's `typecheck-client` has no errors after the 002 change.
- `check-patch-stacking.mjs`: 18 patches OK. `apply-patches.sh --dry-run`: 18 can apply, 0 conflicts.
- The runtime update's checks are in `agent-runtime-compatibility.md`, v2.0.0.
