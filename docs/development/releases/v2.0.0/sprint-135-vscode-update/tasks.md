# Sprint 135 Tasks

Nothing here starts before Jarmo approves the sprint plan, and not before Steps 1, 2 and 3 are merged. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch, freeze and starting tree

- [x] Steps 1–3 merged; confirm on `origin/main` and note the commit: `3c8a7c30` (Sprint 134, #467)
- [x] `git checkout -b sprint-135-vscode-update` from `origin/main`; `git branch --show-current` shows it (2026-10-19, after Jarmo's approval)
- [x] Freeze the target by R1's rule; write `notes/freeze.md` (tag, commit, date, Node, Electron, server Node); put the target in the sprint plan's status line (W1, S1): 1.142.0, `d956e8a6`, 2026-10-19
- [x] Record the rollback point: main's last 1.117.0 commit and its clean-room build check, in the release plan's tracker (R10, W11): `3c8a7c30` for now, with Sprint 134's E5 build check; confirmed or moved to the PR's base before the PR
- [x] `check-vscode-drift.sh <target>` on main after Step 3, with the hunk counts, into `notes/drift.md` (E1): 13 of 18 patches fail in 59 file patches; 105 of 400 hunks
- [x] The upstream diff inventory for every patched file (W1): `notes/upstream-diff.md`
- [x] List Steps 2 and 3's patches and their shell scenarios by number below, under Phase 7 (R7)
- [x] Record every patch's file list and count before the rebase, in `notes/rebase.md` (`PATCH-RULES.md` §8)
- [x] `vscode/` from a copy-on-write clone; fetch the target and the pin (depth 1); pristine at the target with `clean -fd -e extensions/ritemark`

## Phase 1: Audits first (W2)

- [x] `research/frame-audit.md`: every 018 and 019 file sorted into moved lines, changed mechanism or upstream offers it; the selector audit of `ritemarkSurfaces.css`; the remaining DOM reads; for each changed mechanism, carry, re-cut or adopt; the newest release where any uncarriable mechanism still holds (D3)
- [x] `research/toolchain-audit.md`: Node 24 arm64, its npm and node-gyp (VS 2026?), local `node-gyp` pins in `vscode/`'s lockfiles, Xcode and Python, the gulp and esbuild steps `build-prod.sh` relies on, Electron 39 → target breaking changes for 004, 012, 018 and the extension
- [x] `research/browser-bridge-audit.md`: 009, 010 and Browser Recent mapped onto the target's `browserView`
- [x] `research/surfaces-audit.md`: new chat and agent entry points; new built-ins; default drift; new `product.json` fields
- [x] If any audit says the target cannot carry a mechanism, stop and bring D3 to Jarmo with the audit's evidence before Phase 3 — not needed: every mechanism carries (frame audit §5)

## Phase 2: Tooling and toolchain (W10, W4)

- [x] `check-vscode-drift.sh`: hunk counts (E1)
- [x] `update-vscode.sh`: explicit tag fetched exactly; `--check` through `check-vscode-drift.sh` (no stash, no checkout); `clean -fd -e extensions/ritemark`; the new checklist (E2). Tried on 1.117.0 first
- [x] One commit: the root `.nvmrc` and the six workflow Node pins; grep for the old version outside `docs/` and `vscode/` (R3)
- [x] Node `<target>` arm64 installed by `nvm`; `validate-build-env.sh` passes, and fails on Node 22 and on x64 (S7) — VS Code's preinstall refuses Node 22 by name; `validate-build-env.sh` selects the `.nvmrc` Node through nvm, so it passes from a Node 22 shell (qa-evidence S7)

## Phase 3: The rebase (W3, R2)

One commit per patch, in order. For each: `git apply --3way`, resolve by intent, classify every hunk in `notes/rebase.md`, regenerate from the scratch commits, run the hunk-level diff against main's patch, count and diff the files.

- [x] 001
- [x] 002
- [x] 003, with `PATCH-RULES.md` §2's inventory checked against all of 003's files
- [x] 004
- [x] 005
- [x] 006 (applied at 1.142.0; confirm on the target)
- [x] 007, including whether `onboardingVariationA.ts` still needs the fallback
- [x] 008
- [x] 009
- [x] 010
- [x] 011, 012, 014 (applied at 1.142.0; confirm on the target)
- [x] 013
- [x] 015
- [x] 016, 017 (cascade at 1.142.0; confirm, or drop if Step 2 removed their base)
- [x] 018, following `research/frame-audit.md`
- [x] 019
- [x] The patches Steps 2 and 3 added (named at Phase 0): none. Steps 2 and 3 added no patch file; they retired 017 (Sprint 133) and grew 001, 003, 009, 015, 018 and 019, which are rebased above
- [x] `check-patch-stacking.mjs` passes; any change to its known pairs explained
- [x] `apply-patches.sh --dry-run` counts read; a real apply from pristine; a second run applies nothing and exits 0 (S5)
- [ ] The target's `core-ci` type-check and the minified bundle compile, with no unused imports — the type-check: 0 errors; the minified bundle compiles in the clean-room build after the merge (Phase 10)
- [x] Every patch header names the target version

## Phase 4: Branding, defaults and stray surfaces (W8, R8)

- [x] New upstream `product.json` fields merged into `branding/product.json`
- [x] Drifted chrome defaults pinned in `configurationDefaults` (S15)
- [x] New chat and agent entry points hidden in 003, or 007 for Copilot Chat (S24)
- [x] Each new built-in shipped, hidden or stripped, decision recorded (S25)
- [x] `PATCH-RULES.md` §3–§7 expected states describe 2.0

## Phase 5: Native modules (W5, R4)

- [x] `npm ci` in `vscode/` under the arm64 wrapper; built-in extensions' `out/` wiped; compile
- [x] `check-native-modules.sh` derives its list from the `.node` files present; passes; catches an x64 module (S9)
- [x] `validate-build-output.sh` checks every `.node` file's architecture in the built app
- [ ] The JSON, CSS and HTML language servers start in dev — JSON and CSS: a broken file of each gets its problem marks; HTML opens in Ritemark's browser by default and was not opened as text

## Phase 6: Windows workflows (W6, R5)

- [x] `build-windows.yml` and `windows-canary.yml` in one commit: node-gyp layers 1–3 per `research/toolchain-audit.md`
- [x] `windows-test-overlay.yml`'s Node pin (in Phase 2's commit)

## Phase 7: Checks on the Mac, before the PR

- [x] The extension on the new Node: `npm run compile`, the webview's `npm run build`, the unit tests (R3)
- [x] VS Code unit tests: `ritemarkPermanentTabs.test.ts`, `ritemarkTerminalTabs.test.ts`, and Steps 2 and 3's (R7)
- [x] `frame-geometry.mjs`, every scene, equal to Sprint 132 merge 2's numbers (S16)
- [ ] `frame-screenshots.mjs`, light and dark, fresh profile; `qa/screenshot-diff.md` written; pinnable causes pinned; the rest to the Experience lead, then Jarmo (S13–S15, D5) — written; the pins in; the Experience lead decided the browser bar (010); Jarmo's baseline approval still to come
- [ ] Sprint 132's scenarios on the updated build, in dev on the Mac (S17): S1–S6, S12–S40, S42–S46. S41 only for the surfaces drawn by then — mostly pass (qa-evidence S17)
- [x] Steps 2 and 3's shell scenarios (S18), the ones that run through a patch — all run on the Mac (qa-evidence); the ones that need a signed-in AI turn or the microphone are Gate 2's
  - Sprint 133 on the Mac: S1, S3, S38, S40, S41, S42, S43, S48, S49, S54 (the first window, Help: Welcome and every way in, the welcome alone on the ground, the muted extension, the empty desks' tiles); on Windows, after the merge: S45–S47
  - Sprint 134 on the Mac: S12, S13, S18–S21, S27–S31, S33, S44–S46, S48, S50, S52, S55–S58, S61 (the Tasks tab's count, the permanent tabs, the heads' rows, the switcher flyout, File ▸ New tab / Switch project / Share, About this project and the hidden pointer `CLAUDE.md`, the switch question on VS Code's own routes, the splash's ground, the share question on the AI's sheet, the palette with no developer commands, the chosen row's colour); on Windows, after the merge: S41, S42
- [ ] The inventory (S22) and both profiles (S23) — the profiles pass; the inventory partial (qa-evidence S22, S23)
- [ ] The browser (S26), the runtimes on darwin-arm64 (S27), saving and the small patches (S28), the native features in dev (S10)
- [ ] Flows mock suite (`flow-testing`), PDF and DOCX export, Office previews, dictation — the Flows mock suite passes (in `npm test`); Office previews match 1.117; PDF and Word export write their files; dictation not run (the microphone)
- [ ] The fresh-clone walk-through from `SKILL.md` (S8)
- [x] The rollback rehearsal on a scratch branch, never pushed (S20)

## Phase 8: Docs (E3)

- [x] `CLAUDE.md`: the patch table (007's line), anything naming 1.117
- [x] `PATCH-RULES.md`: the table; 003's inventory (21 files)
- [x] `SKILL.md`: the Node table; "VS Code 1.142 upgrade pitfalls" (or the target's number); the rollback recipe
- [x] `references/layout-invariants.md`: enforcing files and symbols that moved
- [x] `architecture.md`: history line; anything naming the pin
- [x] Release plan: the Update row's status and tracker; the drift risk retired or updated

## Phase 9: PR and merge

- [ ] `./scripts/validate-qa.sh`; the pre-commit hook passes (run by hand in the worktree with `CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] qa-validator and pr-reviewer
- [ ] The PR links `notes/rebase.md`, `qa/screenshot-diff.md` and Jarmo's baseline approval
- [ ] Jarmo's admin-merge yes; one squash merge

## Phase 10: After the merge (E3, R5)

Main stays closed to other shell-tier merges until this phase is green or rolled back (D4).

- [ ] A clean-room release worktree at the merged commit; `release-preflight.sh`; `build-prod.sh`; `validate-build-output.sh`; provenance names the new gitlink (S30)
- [ ] The production build: the native features (S10), the fonts, a runtime turn, the frame
- [ ] macOS x64 CI green; S27 on darwin-x64
- [ ] Windows CI green with the installer round trip (S11)
- [ ] On a Windows PC: S12 (with Windows screenshots against the last round's), S27, S29, and Sprint 132's S7–S11
- [ ] Release plan: tracker updated; the rollback point marked as no longer needed, or used (S21)
